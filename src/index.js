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
app.post('/simulate', async (req, res) => {
  try {
    console.log('🌍 Fetching Live Data from SportAPI...');

    const API_KEY = process.env.RAPIDAPI_KEY; 
    if (!API_KEY) {
        return res.status(500).json({ error: 'Server configuration error: Missing API Key' });
    }

    const headers = {
      'x-rapidapi-key': API_KEY,
      'x-rapidapi-host': 'sportapi7.p.rapidapi.com',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
    };

    // 1. Try to fetch LIVE games first
    let url = 'https://sportapi7.p.rapidapi.com/api/v1/sport/football/events/live';
    let response = await axios.get(url, { headers });
    let gamesList = response.data.events || [];

    // 2. GUARANTEED FALLBACK: If no live games, fetch historical/recent events for Real Madrid (Team ID: 2829)
    if (gamesList.length === 0) {
        console.log('ℹ️ No live games. Switching to Real Madrid historical match data fallback...');
        url = 'https://sportapi7.p.rapidapi.com/api/v1/team/2829/events/last/0'; // Fetch last matches
        response = await axios.get(url, { headers });
        gamesList = response.data.events || [];
    }

    if (gamesList.length === 0) {
        console.log('ℹ️ Absolute zero games found anywhere.');
        return res.status(200).json({ message: 'No games available right now.' });
    }

    // Process the match payload safely
    const apiMatch = gamesList[0]; 
    const matchApiId = apiMatch.id;

    // Check if it already exists in our local PostgreSQL DB
    const [existingMatch] = await db.select().from(matches).where(eq(matches.apiId, matchApiId)).limit(1);

    // Determine clean match status string mapping
    let matchStatus = 'scheduled';
    if (apiMatch.status?.type === 'inprogress') matchStatus = 'live';
    if (apiMatch.status?.type === 'finished') matchStatus = 'finished';

    if (!existingMatch) {
        console.log(`🆕 Importing game: ${apiMatch.homeTeam?.name} vs ${apiMatch.awayTeam?.name} (${matchStatus})`);
        
        const [newMatch] = await db.insert(matches).values({
            apiId: matchApiId,
            sport: 'FOOTBALL',
            homeTeam: apiMatch.homeTeam?.name || 'Home Team',
            awayTeam: apiMatch.awayTeam?.name || 'Away Team',
            startTime: apiMatch.startTimestamp ? new Date(apiMatch.startTimestamp * 1000) : new Date(),
            endTime: apiMatch.startTimestamp ? new Date((apiMatch.startTimestamp * 1000) + 7200000) : new Date(), 
            homeScore: apiMatch.homeScore?.current ?? 0,
            awayScore: apiMatch.awayScore?.current ?? 0,
            status: matchStatus
        }).returning();

        if (app.locals.broadcastMatchCreated) {
            app.locals.broadcastMatchCreated(newMatch);
        }
        res.status(200).json({ message: 'Match loaded into dashboard!', matchId: newMatch.id });
    } else {
        console.log(`🔄 Syncing existing data for: ${existingMatch.homeTeam} vs ${existingMatch.awayTeam}`);
        
        const latestHomeScore = apiMatch.homeScore?.current ?? 0;
        const latestAwayScore = apiMatch.awayScore?.current ?? 0;

        if (existingMatch.homeScore !== latestHomeScore || existingMatch.awayScore !== latestAwayScore || existingMatch.status !== matchStatus) {
            const [updatedMatch] = await db.update(matches)
                .set({ 
                    homeScore: latestHomeScore, 
                    awayScore: latestAwayScore,
                    status: matchStatus
                })
                .where(eq(matches.id, existingMatch.id))
                .returning();

            if (app.locals.broadcastMatchUpdated) {
                app.locals.broadcastMatchUpdated(updatedMatch);
            }
        }
        res.status(200).json({ message: 'Match synced seamlessly!', matchId: existingMatch.id });
    }

  } catch (error) {
    console.error('❌ Sync Error:', error.message);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to sync live data' });
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