import { config } from "dotenv";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";
import { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { PgTransaction, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { ExtractTablesWithRelations } from "drizzle-orm";
import * as relations from "./relations";

// GENERAL DB
config({ path: ".env" });
const fullSchema = { ...schema, ...relations };

// Declare a global variable to store the client
declare global {
  var pgClient: ReturnType<typeof postgres> | undefined;
}

const client =
  global.pgClient ??
  postgres(process.env.DATABASE_URL!, {
    // Must exceed the widest Promise.all in the app: the Admin page fires 7
    // concurrent loads. At max: 5 two of them queued for a connection, and
    // during `next build` (7 parallel workers, each with its own pool) that
    // wait exceeded the 60s render budget — failing the build ~1 run in 4.
    //
    // Safe against the server ceiling because DATABASE_URL points at Supabase's
    // TRANSACTION POOLER (port 6543): this counts pooler client slots, which are
    // multiplexed onto far fewer Postgres backends. Measured: a 12-way
    // concurrent burst took Postgres from 13 to 23 connections against
    // max_connections = 60.
    max: 12,
    prepare: false, // required for Supabase transaction pooler
  });

global.pgClient = client;

export const db = drizzle(client, { schema: fullSchema });

// SPECIFIC DB FOR DB.TRANSACTION TO WORK ACROSS SERVICE AND REPO LAYERS
type TSchema = typeof fullSchema;
export type Transaction = PgTransaction<
  PgQueryResultHKT,
  TSchema,
  ExtractTablesWithRelations<TSchema>
>;
export type DB = PostgresJsDatabase<TSchema> | Transaction;
