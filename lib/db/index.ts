import { config } from "dotenv";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";
import { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { PgTransaction, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { ExtractTablesWithRelations } from "drizzle-orm";

// GENERAL DB
config({ path: ".env" });

// Declare a global variable to store the client
declare global {
  var pgClient: ReturnType<typeof postgres> | undefined;
}

// Reuse the client in development to avoid exhausting the connection pool
const client = global.pgClient || postgres(process.env.DATABASE_URL!);

if (process.env.NODE_ENV !== "production") {
  global.pgClient = client;
}

export const db = drizzle({ client, schema });

// SPECIFIC DB FOR DB.TRANSACTION TO WORK
type TSchema = typeof schema;
export type Transaction = PgTransaction<
  PgQueryResultHKT,
  TSchema,
  ExtractTablesWithRelations<TSchema>
>;
export type DB = PostgresJsDatabase<TSchema> | Transaction;
