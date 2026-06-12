import { Router } from "express";
import { matchIdParamSchema } from "../validation/matches.js";
import { createCommentarySchema, listCommentaryQuerySchema } from "../validation/commentary.js";
import { db } from "../db/db.js";
import { commentary, matches } from "../db/schema.js"; // <-- Added matches here
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

        // 3. Broadcast the update via WebSockets
        if (res.app.locals.broadcastCommentary) {
            res.app.locals.broadcastCommentary(result.matchId, result);
        }

        res.status(201).json({ data: result });
    } catch (error) {
        console.error('Failed to create commentary:', error);
        res.status(500).json({ error: 'Failed to create commentary.' });
    }
});