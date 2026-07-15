import AgentAPI from 'apminsight';
AgentAPI.config();

import cors from 'cors';
import express from 'express';
import http from 'http';
import axios from 'axios'; // Required to fetch live data from the third-party API
import { eq } from 'drizzle-orm';

import { matchRouter } from '../src/routes/matches.js';
import { attachWebSocketServer } from './ws/server.js';
import { securityMiddleware } from './arcjet.js';
import { commentaryRouter } from './routes/commentary.js';

import { db } from '../src/db/db.js'; 
import { matches, commentary } from '../src/db/schema.js'; 
import { getMatchStatus } from '../src/utils/match-status.js'; 

const PORT = Number(process.env.PORT || 8000);
const HOST = process.env.HOST || '0.0.0.0';

const app = express();
const server = http.createServer(app);

// Middleware
app.use(cors());
app.use(express.json());

// Root GET route
app.get('/', (req, res) => {
  res.send('Welcome to the Sportz API!');
});

app.use(securityMiddleware());
app.use('/matches', matchRouter);
app.use('/matches/:id/commentary', commentaryRouter);

// --- LIVE WORLD CUP SYNC ROUTE (With Bulletproof Team Fallback) ---
// Add this variable just above your route to prevent overlapping intervals 
// if the interviewer clicks the button multiple times!
let activeSimulationInterval = null;

// --- MOCK LIVE WORLD CUP SYNC ROUTE (Bulletproof for Interviews) ---
app.post('/simulate', async (req, res) => {
  try {
    console.log('🚀 Starting Local Live Football Simulation (5 Minutes)...');

    // Clear any existing simulation loop if they click the button twice
    if (activeSimulationInterval) {
        clearInterval(activeSimulationInterval);
    }

    // 1. Define 5 classic football matchups
    const demoMatchups = [
        { home: 'Real Madrid', away: 'FC Barcelona' },
        { home: 'Manchester United', away: 'Liverpool' },
        { home: 'Bayern Munich', away: 'Borussia Dortmund' },
        { home: 'AC Milan', away: 'Inter Milan' },
        { home: 'Paris Saint-Germain', away: 'Marseille' }
    ];

    const activeMatches = [];

    // 2. Insert these matches into your database as "LIVE"
    for (const match of demoMatchups) {
        const [newMatch] = await db.insert(matches).values({
            sport: 'FOOTBALL',
            homeTeam: match.home,
            awayTeam: match.away,
            startTime: new Date(),
            endTime: new Date(Date.now() + 90 * 60000), // Ends in 90 mins
            homeScore: 0,
            awayScore: 0,
            status: 'live' 
            // Note: Omitted apiId so it defaults to null, avoiding unique constraint errors
        }).returning();

        activeMatches.push(newMatch);

        // Instantly push the new match to the frontend via WebSockets
        if (app.locals.broadcastMatchCreated) {
            app.locals.broadcastMatchCreated(newMatch);
        }
    }

    res.status(200).json({ message: 'Live simulation started! Generating data for 5 minutes.' });

    // 3. Start the 5-Minute Background WebSocket Loop
    let elapsedSeconds = 0;
    const MAX_DURATION = 300; // 5 minutes in seconds

    activeSimulationInterval = setInterval(async () => {
        elapsedSeconds += 5; // The loop runs every 5 seconds

        // Stop the simulation automatically after 5 minutes
        if (elapsedSeconds > MAX_DURATION) {
            clearInterval(activeSimulationInterval);
            console.log('🏁 5-Minute Demo Simulation Finished.');
            return;
        }

        // Pick a random match from our 5 generated games
        const randomMatch = activeMatches[Math.floor(Math.random() * activeMatches.length)];
        
        // Randomize the event (10% chance of a goal every 5 seconds)
        const isGoal = Math.random() > 0.90; 
        const isHome = Math.random() > 0.5;
        const teamName = isHome ? randomMatch.homeTeam : randomMatch.awayTeam;
        const minute = Math.floor(elapsedSeconds / 60) + 1;

        let eventType = 'possession';
        let message = `${teamName} is keeping possession well in the midfield.`;
        
        if (isGoal) {
            eventType = 'goal';
            message = `GOALLLL! Brilliant strike by ${teamName}! What a phenomenal finish!`;
        } else if (Math.random() > 0.6) {
            eventType = 'shot';
            message = `Great shot by ${teamName}, but the keeper makes a fantastic save.`;
        } else if (Math.random() > 0.8) {
            eventType = 'foul';
            message = `Heavy tackle by ${teamName}. The referee blows for a free kick.`;
        }

        try {
            // 4. Save the new commentary to the database
            const [newCommentary] = await db.insert(commentary).values({
                matchId: randomMatch.id,
                minute: minute,
                sequence: Math.floor(Math.random() * 1000), // Required by your schema
                period: '1st Half',
                eventType: eventType,
                team: teamName,
                message: message,
            }).returning();

            // 5. Broadcast the commentary to the specific match channel
            if (app.locals.broadcastCommentary) {
                app.locals.broadcastCommentary(randomMatch.id, newCommentary);
            }

            // 6. If it's a goal, update the database scores and broadcast the match update
            if (isGoal) {
                const newHomeScore = isHome ? randomMatch.homeScore + 1 : randomMatch.homeScore;
                const newAwayScore = !isHome ? randomMatch.awayScore + 1 : randomMatch.awayScore;
                
                // Update our local tracking object
                randomMatch.homeScore = newHomeScore;
                randomMatch.awayScore = newAwayScore;

                const [updatedMatch] = await db.update(matches)
                    .set({ homeScore: newHomeScore, awayScore: newAwayScore })
                    .where(eq(matches.id, randomMatch.id))
                    .returning();
                
                // Blast the new score globally to all clients
                if (app.locals.broadcastMatchUpdated) {
                    app.locals.broadcastMatchUpdated(updatedMatch);
                }
            }

        } catch (err) {
            console.error("Simulation tick error:", err.message);
        }

    }, 5000); // interval fires every 5,000 ms (5 seconds)

  } catch (error) {
    console.error('❌ Sync Error:', error.message);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to start demo simulation' });
    }
  }
});
const { broadcastMatchCreated ,broadcastCommentary , broadcastMatchUpdated} = attachWebSocketServer(server);

app.locals.broadcastMatchCreated = broadcastMatchCreated;
app.locals.broadcastCommentary = broadcastCommentary;
app.locals.broadcastMatchUpdated = broadcastMatchUpdated;

// Start server
server.listen(PORT, HOST, () => {
  const baseURL = HOST ==  '0.0.0.0' ? `http://localhost:${PORT}` : `http://${HOST}:${PORT}`;
  console.log(`Server is running ON ${baseURL}`);
  console.log(`WebSocket Server is running on ${baseURL.replace('http', 'ws')}/ws`);
});