/**
 * Configuration drizzle-kit — remplace `drizzle.config.json`.
 *
 * Pourquoi ce changement :
 *  - le JSON code en dur `postgresql://postgres:postgres@127.0.0.1:5432/app_db`,
 *    ce qui est interdit en production (§3, §35) ;
 *  - la connexion doit venir de l'environnement (Supabase) ;
 *  - les migrations doivent être versionnées dans `drizzle/`.
 *
 * Utilisation :
 *   npm run db:generate   → crée la migration SQL
 *   npm run db:migrate    → l'applique (connexion directe, port 5432)
 *   npm run db:push       → pousse le schéma sans migration (dev uniquement)
 *   npm run db:studio     → interface Drizzle Studio
 */
import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

config();

/**
 * Les migrations nécessitent la connexion DIRECTE (port 5432) : le pooler
 * transactionnel Supabase (6543) ne supporte pas toutes les opérations DDL
 * ni les prepared statements de drizzle-kit.
 */
const databaseUrl =
  process.env.DATABASE_DIRECT_URL ?? process.env.DATABASE_URL ?? "";

if (!databaseUrl) {
  throw new Error(
    "DATABASE_URL (ou DATABASE_DIRECT_URL) est absente. " +
      "Renseignez la chaîne de connexion Supabase dans .env — voir .env.example.",
  );
}

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    url: databaseUrl,
  },
  verbose: true,
  strict: true,
  // Ne jamais exécuter de suppression destructive sans confirmation explicite.
  migrations: {
    table: "__drizzle_migrations",
  },
});
