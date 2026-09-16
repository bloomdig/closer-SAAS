/**
 * Client de base de données — PostgreSQL (Supabase) via `pg`.
 *
 * Règles :
 *  - L’URL vient UNIQUEMENT de `DATABASE_URL`. Aucun localhost codé en dur.
 *  - `pg` est utilisé en mode natif (pas de prepared statements nommés) pour
 *    rester compatible avec le pooler transactionnel Supabase (Supavisor, port 6543)
 *    sur Vercel / serverless.
 *  - Les requêtes sont toujours paramétrées par Drizzle → pas de concaténation SQL.
 */
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";
import * as adminSchema from "./admin-schema";

/** Schéma complet exposé à `db.query.*` (tables métier + plateforme). */
const fullSchema = { ...schema, ...adminSchema };
type FullSchema = typeof fullSchema;

const { Pool } = pg;

function resolveDatabaseUrl(): string {
  const url =
    process.env.DATABASE_URL ?? process.env.DATABASE_DIRECT_URL ?? "";

  if (!url || url.trim().length === 0) {
    throw new Error(
      "DATABASE_URL est absente. Configurez la chaîne de connexion Supabase " +
        "(voir .env.example). L’application ne doit jamais dépendre d’une base locale.",
    );
  }

  if (process.env.APP_ENV === "production" && url.includes("127.0.0.1")) {
    throw new Error(
      "DATABASE_URL pointe vers localhost en production. Utilisez Supabase.",
    );
  }

  return url;
}

let pool: pg.Pool | null = null;
let database: NodePgDatabase<FullSchema> | null = null;

export function getPool(): pg.Pool {
  if (!pool) {
    const connectionString = resolveDatabaseUrl();
    const isSupabase = connectionString.includes("supabase.com");

    pool = new Pool({
      connectionString,
      max: 10,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
      ssl:
        isSupabase || connectionString.includes("sslmode=require")
          ? { rejectUnauthorized: false }
          : undefined,
      // Indispensable avec le pooler transactionnel (pas de session state).
      application_name: "closer-app",
      allowExitOnIdle: true,
    });

    pool.on("error", (err) => {
      // Une erreur sur une connexion idle ne doit pas faire tomber le process.
      console.error("[db] erreur de pool ignorée:", err.message);
    });
  }
  return pool;
}

export const db: NodePgDatabase<FullSchema> = (() => {
  if (!database) {
    database = drizzle(getPool(), { schema: fullSchema, logger: false });
  }
  return database;
})();

export type Database = NodePgDatabase<FullSchema>;

export async function closeDatabase(): Promise<void> {
  await pool?.end();
  pool = null;
  database = null;
}

export * as schema from "./schema";
