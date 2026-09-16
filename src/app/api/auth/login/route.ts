/**
 * Connexion marchand.
 * Corrige : S2 (requête ciblée), S4 (e-mail normalisé), S5 (limitation de
 * débit sur les tentatives), S6 (message d’erreur générique, aucun détail
 * interne), S7 (le jeton porte le rôle et le tenant).
 */
import bcrypt from "bcryptjs";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { merchants } from "@/db/schema";
import { createMerchantSession } from "@/lib/auth/session";
import {
  clientKey,
  enforceRateLimit,
  RATE_LIMITS,
  rateLimiter,
} from "@/lib/security/rate-limit";
import { email as emailField, throwIfInvalid, type FieldErrors } from "@/lib/validation";
import { ApiError, ok, readJson, withErrorHandling } from "@/lib/api/respond";
import { logAudit } from "@/lib/repositories";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type LoginBody = { email?: unknown; password?: unknown };

/** Message identique quel que soit l’échec : aucune énumération de comptes. */
const INVALID_CREDENTIALS = new ApiError(
  401,
  "invalid_credentials",
  "Adresse e-mail ou mot de passe incorrect.",
);

export const POST = withErrorHandling("auth.login", async (request: Request) => {
  const key = clientKey(request, "login");
  enforceRateLimit(key, RATE_LIMITS.login, "Trop de tentatives de connexion. Réessayez dans 5 minutes.");

  const body = await readJson<LoginBody>(request);
  const errors: FieldErrors = {};
  const emailValue = emailField(body.email, "email", "Adresse e-mail", errors);
  if (typeof body.password !== "string" || body.password.length === 0) {
    errors.password = "Mot de passe requis.";
  }
  throwIfInvalid(errors);

  const merchant = await db.query.merchants.findFirst({
    where: eq(sql`lower(${merchants.email})`, emailValue!.toLowerCase()),
  });

  if (!merchant) {
    // On hache quand même pour égaliser le temps de réponse.
    await bcrypt.compare(body.password as string, "$2a$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidin");
    throw INVALID_CREDENTIALS;
  }

  const valid = await bcrypt.compare(body.password as string, merchant.passwordHash);
  if (!valid) throw INVALID_CREDENTIALS;

  if (merchant.status === "suspended" || merchant.status === "deactivated") {
    throw new ApiError(
      403,
      "account_suspended",
      "Ce compte est suspendu. Contactez l’équipe CLOSER.",
    );
  }

  await db
    .update(merchants)
    .set({ lastLoginAt: new Date() })
    .where(eq(merchants.id, merchant.id));

  await createMerchantSession({
    merchantId: merchant.id,
    userId: merchant.id,
    role: "owner",
    email: merchant.email,
    name: merchant.name,
  });

  // Tentatives réussies : on vide le compteur de limitation de débit.
  rateLimiter.reset(key);

  await logAudit({
    merchantId: merchant.id,
    actorId: merchant.id,
    actorRole: "owner",
    action: "auth.login",
    ipAddress: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
  });

  return ok({
    merchantId: merchant.id,
    businessName: merchant.businessName ?? merchant.name,
    subscriptionStatus: merchant.subscriptionStatus,
    trialEndsAt: merchant.trialEndsAt?.toISOString() ?? null,
  });
});
