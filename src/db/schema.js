import { 
  pgEnum, 
  pgTable, 
  serial, 
  text, 
  timestamp, 
  integer,
  jsonb,
  varchar
} from 'drizzle-orm/pg-core';

// Match status enum
export const matchStatusEnum = pgEnum('match_status', ['scheduled', 'live', 'finished']);

// Matches table
export const matches = pgTable('matches', {
  id: serial('id').primaryKey(),
  apiId: integer('api_id').unique(), // NEW: Tracks the ID from the external Sports API
  sport: varchar('sport', { length: 255 }).notNull(),
  homeTeam: varchar('home_team', { length: 255 }).notNull(),
  awayTeam: varchar('away_team', { length: 255 }).notNull(),
  status: matchStatusEnum('status').notNull().default('scheduled'),
  startTime: timestamp('start_time', { withTimezone: true }).notNull(),
  endTime: timestamp('end_time', { withTimezone: true }),
  homeScore: integer('home_score').notNull().default(0),
  awayScore: integer('away_score').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// Commentary table (Remains exactly the same)
export const commentary = pgTable('commentary', {
  id: serial('id').primaryKey(),
  matchId: integer('match_id').notNull().references(() => matches.id, { onDelete: 'cascade' }),
  minute: integer('minute'),
  sequence: integer('sequence').notNull(),
  period: varchar('period', { length: 100 }).notNull(),
  eventType: varchar('event_type', { length: 100 }).notNull(),
  actor: varchar('actor', { length: 255 }),
  team: varchar('team', { length: 255 }),
  message: text('message').notNull(),
  metadata: jsonb('metadata'),
  tags: text('tags').array(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});