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
    max: 5,
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
