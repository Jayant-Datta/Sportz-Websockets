import { WebSocket, WebSocketServer } from "ws";
import { wsArcjet } from "../arcjet.js";

const matchSubscribers = new Map();

function subscribe(matchId, socket) {
    if (!matchSubscribers.has(matchId)) {
        matchSubscribers.set(matchId, new Set());
    }
    
    matchSubscribers.get(matchId).add(socket);
}

function unsubscribe(matchId, socket) {
    const subscribers = matchSubscribers.get(matchId);

    if(!subscribers) return;

    // Remove the specific socket from the Set
    subscribers.delete(socket);

    // If no one is listening to this match anymore, clear the match key entirely
    if(subscribers.size === 0) {
        matchSubscribers.delete(matchId);
    }
}

function cleanupSubscriptions(socket) {
    // Loop through every matchId this specific socket was subscribed to
    for (const matchId of socket.subscriptions) {
        unsubscribe(matchId, socket);
    }
}



function sendJson(socket, payload){
    if(socket.readyState !== WebSocket.OPEN) return;
    socket.send(JSON.stringify(payload));
}

function broadcastToAll(wss, payload){
    for (const client of wss.clients){
        if(client.readyState !== WebSocket.OPEN) continue;
        client.send(JSON.stringify(payload));
    }
}

function broadcastToMatch(matchId, payload) {
    const subscribers = matchSubscribers.get(matchId);
    
    // Safety check: if no one is listening, don't bother sending anything
    if (!subscribers || subscribers.size === 0) return;

    const message = JSON.stringify(payload);

    // Loop through every single active socket connection listening to this match
    for (const client of subscribers) {
        // Ensure the connection is still alive before pushing data
        if (client.readyState === WebSocket.OPEN) {
            client.send(message);
        }
    }
}

function handleMessage(socket, data) {
    let message;

    try {
        // Parse the incoming raw buffer data into a JSON object
        message = JSON.parse(data.toString());
    } catch {
        // If the client sends malformed data, respond with a JSON error
        sendJson(socket, { type: 'error', message: 'Invalid JSON' });
        return; // Early return to prevent execution crashes
    }

    // 1. Handle "subscribe" request type
    if (message?.type === 'subscribe' && Number.isInteger(message.matchId)) {
        subscribe(message.matchId, socket);
        socket.subscriptions.add(message.matchId);
        sendJson(socket, { type: 'subscribed', matchId: message.matchId });
        return;
    }

    // 2. Handle "unsubscribe" request type
    if (message?.type === 'unsubscribe' && Number.isInteger(message.matchId)) {
        unsubscribe(message.matchId, socket);
        socket.subscriptions.delete(message.matchId);
        sendJson(socket, { type: 'unsubscribed', matchId: message.matchId });
        return;
    }
}

export function attachWebSocketServer(server){
    // 1. Use noServer: true instead of attaching it directly
    const wss = new WebSocketServer({ noServer: true, maxPayload: 1024 * 1024 });

    // 2. Intercept the HTTP upgrade request before the WebSocket connects
    server.on('upgrade', async (req, socket, head) => {
        // Ensure we only handle requests meant for our WebSocket path
        if (req.url !== '/ws') {
            socket.destroy();
            return;
        }

        if (wsArcjet) {
            try {
                const decision = await wsArcjet.protect(req);
                
                if (decision.isDenied()) {
                    // Reject at the HTTP level!
                    const statusCode = decision.reason.isRateLimit() ? '429 Too Many Requests' : '403 Forbidden';
                    socket.write(`HTTP/1.1 ${statusCode}\r\n\r\n`);
                    socket.destroy();
                    return;
                }
            } catch (e) {
                console.error('WS upgrade error', e);
                socket.write('HTTP/1.1 500 Internal Server Error\r\n\r\n');
                socket.destroy();
                return;
            }
        }

        // If Arcjet approves, manually upgrade the connection
        wss.handleUpgrade(req, socket, head, (ws) => {
            wss.emit('connection', ws, req);
        });
    });

    // 3. This now only fires for fully authorized clients
    wss.on('connection', (socket, req) => {
        socket.isAlive = true;
        socket.on('pong', () => { socket.isAlive = true; });
        
        socket.subscriptions = new Set();

        sendJson(socket, { type: 'welcome' });

        socket.on('message', (data) => {
            handleMessage(socket, data);
        });

        // Terminate socket cleanly if connection issues pop up
        socket.on('error', () => {
            socket.terminate();
        });

        // Handle connection closure event
        socket.on('close', () => {
            cleanupSubscriptions(socket);
        });

        socket.on('error', console.error);
    });

    // Ping/Pong interval to clear dead connections
    const interval = setInterval(() => {
        // Fixed typo here: changed (wss) to (ws)
        wss.clients.forEach((ws) => { 
            if(ws.isAlive === false) return ws.terminate();
            ws.isAlive = false;
            ws.ping();
        });
    }, 30000);

    wss.on('close', () => clearInterval(interval));

    function broadcastMatchCreated(match) {
        broadcastToAll(wss, { type: 'match_created', data: match });
    }

    function broadcastCommentary(matchId, comment) {
        broadcastToMatch(matchId, {type: 'commentary' , data: comment} );
    }

    return { broadcastMatchCreated , broadcastCommentary };
}