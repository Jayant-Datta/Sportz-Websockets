import { Router } from "express";
import { matchIdParamSchema } from "../validation/matches.js";
import { createCommentarySchema, listCommentaryQuerySchema } from "../validation/commentary.js";
import { db } from "../db/db.js";
import { commentary, matches } from "../db/schema.js";
import { eq, desc } from "drizzle-orm";

const MAX_LIMIT = 100;

export const commentaryRouter = Router({ mergeParams: true });

commentaryRouter.get('/', async (req, res) => {
    const paramsResult = matchIdParamSchema.safeParse(req.params);
    if (!paramsResult.success) {
        return res.status(400).json({ error: 'Invalid match ID.', details: paramsResult.error.issues });
    }

    const queryResult = listCommentaryQuerySchema.safeParse(req.query);
    if (!queryResult.success) {
        return res.status(400).json({ error: 'Invalid query parameters.', details: queryResult.error.issues });
    }

    try {
        const { id: matchId } = paramsResult.data;
        const { limit = 10 } = queryResult.data;

        const safeLimit = Math.min(limit, MAX_LIMIT);

        const results = await db
            .select()
            .from(commentary)
            .where(eq(commentary.matchId, matchId))
            .orderBy(desc(commentary.createdAt))
            .limit(safeLimit);

        res.status(200).json({ data: results });
    } catch (error) {
        console.error('Failed to fetch commentary:', error);
        res.status(500).json({ error: 'Failed to fetch commentary.' });
    }
});

commentaryRouter.post('/', async (req, res) => {
    const paramsResult = matchIdParamSchema.safeParse(req.params);
    if (!paramsResult.success) {
        return res.status(400).json({ error: 'Invalid match ID.', details: paramsResult.error.issues });
    }

    const bodyResult = createCommentarySchema.safeParse(req.body);
    if (!bodyResult.success) {
        return res.status(400).json({ error: 'Invalid commentary payload.', details: bodyResult.error.issues });
    }

    try {
        const { id: matchId } = paramsResult.data;

        // 1. Verify the match actually exists before inserting
        const [existingMatch] = await db
            .select()
            .from(matches)
            .where(eq(matches.id, matchId))
            .limit(1);

        if (!existingMatch) {
            return res.status(404).json({ error: `Match with ID ${matchId} not found.` });
        }

        // 2. If the match exists, proceed to insert the commentary
        const { minute, ...rest } = bodyResult.data;
        const [result] = await db.insert(commentary).values({
            matchId,
            minute,
            ...rest
        }).returning();

        // 3. Broadcast the commentary update via WebSockets
        if (res.app.locals.broadcastCommentary) {
            res.app.locals.broadcastCommentary(result.matchId, result);
        }

        // 4. DYNAMIC SCORING LOGIC
        let runsToAdd = 0;
        const eventType = result.eventType?.toLowerCase();
        
        if (eventType === 'run') runsToAdd = 1;
        if (eventType === 'four') runsToAdd = 4;
        if (eventType === 'six') runsToAdd = 6;

        if (runsToAdd > 0) {
            // Update the database with the new score
            const [updatedMatch] = await db.update(matches)
                .set({ homeScore: existingMatch.homeScore + runsToAdd })
                .where(eq(matches.id, matchId))
                .returning();

            // Blast the new score out to all connected clients!
            if (res.app.locals.broadcastMatchUpdated) {
                res.app.locals.broadcastMatchUpdated(updatedMatch);
            }
        }

        res.status(201).json({ data: result });
    } catch (error) {
        console.error('Failed to create commentary:', error);
        res.status(500).json({ error: 'Failed to create commentary.' });
    }
});