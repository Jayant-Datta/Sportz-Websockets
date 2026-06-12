import { WebSocket, WebSocketServer } from "ws";
import { wsArcjet } from "../arcjet.js";

function sendJson(socket, payload){
    if(socket.readyState !== WebSocket.OPEN) return;
    socket.send(JSON.stringify(payload));
}

function broadcast(wss, payload){
    for (const client of wss.clients){
        if(client.readyState !== WebSocket.OPEN) continue;
        client.send(JSON.stringify(payload));
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

        sendJson(socket, { type: 'welcome' });
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
        broadcast(wss, { type: 'match_created', data: match });
    }

    return { broadcastMatchCreated };
}