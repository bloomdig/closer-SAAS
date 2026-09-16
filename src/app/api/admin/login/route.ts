/**
 * Connexion à l’administration de la plateforme CLOSER (§22).
 * Séparée de la connexion marchand : un compte marchand ne peut en aucun cas
 * accéder à l’administration (corrige la faille critique S1).
 */
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { platformAdmins } from "@/db/admin-schema";
import { createAdminSession } from "@/lib/auth/session";
import { clientKey, enforceRateLimit, RATE_LIMITS } from "@/lib/security/rate-limit";
import { ApiError, ok, readJson, withErrorHandling } from "@/lib/api/respond";
import { logAudit } from "@/lib/repositories";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const INVALID = new ApiError(401, "invalid_credentials", "Identifiants incorrects.");

export const POST = withErrorHandling("admin.login", async (request: Request) => {
  enforceRateLimit(clientKey(request, "admin-login"), { limit: 5, window: 900 });

  const body = await readJson<{ email?: unknown; password?: unknown }>(request);
  const emailValue = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const passwordValue = typeof body.password === "string" ? body.password : "";

  if (!emailValue || !passwordValue) throw INVALID;

  const admin = await db.query.platformAdmins.findFirst({
    where: eq(platformAdmins.email, emailValue),
  });
  if (!admin || !admin.isActive) throw INVALID;

  const valid = await bcrypt.compare(passwordValue, admin.passwordHash);
  if (!valid) throw INVALID;

  await db
    .update(platformAdmins)
    .set({ lastLoginAt: new Date() })
    .where(eq(platformAdmins.id, admin.id));

  await createAdminSession({
    adminId: admin.id,
    email: admin.email,
    name: admin.name,
  });

  await logAudit({
    actorId: admin.id,
    action: "admin.login",
    entityType: "platform_admin",
    entityId: admin.id,
  });

  return ok({ adminId: admin.id, name: admin.name });
});
