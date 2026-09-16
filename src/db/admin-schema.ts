import { pgTable, uuid, varchar, text, boolean, timestamp } from "drizzle-orm/pg-core";

/**
 * Comptes administrateurs de la plateforme CLOSER.
 * Volontairement séparés de `merchants` : un administrateur n’est pas un
 * marchand et n’appartient à aucun tenant. L’accès à `/admin` est refusé à
 * tout jeton qui ne vient pas de cette table.
 */
export const platformAdmins = pgTable("platform_admins", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 120 }).notNull(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  passwordHash: varchar("password_hash", { length: 255 }).notNull(),
  isActive: boolean("is_active").notNull().default(true),
  lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type PlatformAdmin = typeof platformAdmins.$inferSelect;
