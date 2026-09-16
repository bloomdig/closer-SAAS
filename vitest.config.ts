import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // Les modules serveur (db, engine) exigent DATABASE_URL à l'import
    // (fail-fast assumé). Les tests unitaires n'ouvrent aucune connexion :
    // le pool `pg` est paresseux, cette URL ne pointe vers rien.
    env: {
      DATABASE_URL:
        "postgresql://test:test@127.0.0.1:1/test?sslmode=disable",
    },
  },
});
