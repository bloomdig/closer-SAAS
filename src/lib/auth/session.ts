/**
 * Sessions — jetons JWT signés (`jose`) stockés dans un cookie httpOnly.
 * =====================================================================
 * Corrige les failles S3, S4, S7 de l’audit :
 *  - plus de secret par défaut : l’absence de `JWT_SECRET` est fatale ;
 *  - le jeton porte le rôle et le tenant, vérifiés à chaque requête ;
 *  - un compte suspendu est refusé même si son jeton est encore valide ;
 *  - deux portées distinctes : `merchant` et `platform`.
 */
import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import { cookies } from "next/headers";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { merchants, users } from "@/db/schema";
import { platformAdmins } from "@/db/admin-schema";

export const SESSION_COOKIE = "closer_session";
export const ADMIN_SESSION_COOKIE = "closer_admin_session";

const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 jours
const BCRYPT_ROUNDS = Number(process.env.BCRYPT_ROUNDS ?? 12);

export type MerchantSession = {
  scope: "merchant";
  merchantId: string;
  userId: string;
  role: "owner" | "admin" | "agent";
  email: string;
  name: string | null;
};

export type AdminSession = {
  scope: "platform";
  adminId: string;
  email: string;
  name: string;
};

export type Session = MerchantSession | AdminSession;

/** Corrige S3 : aucun repli secret. */
function getSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.trim().length < 32) {
    throw new Error(
      "JWT_SECRET est absente ou trop courte (32 caractères minimum). " +
        "Générez-en une avec : openssl rand -base64 48",
    );
  }
  return new TextEncoder().encode(secret);
}

export { BCRYPT_ROUNDS };

function cookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    maxAge: SESSION_MAX_AGE_SECONDS,
    path: "/",
  };
}

/* ------------------------------ création ------------------------------ */

export async function createMerchantSession(
  payload: Omit<MerchantSession, "scope">,
): Promise<string> {
  const token = await new SignJWT({ ...payload, scope: "merchant" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE_SECONDS}s`)
    .setIssuer("closer")
    .setAudience("closer-merchant")
    .sign(getSecret());

  (await cookies()).set(SESSION_COOKIE, token, cookieOptions());
  return token;
}

export async function createAdminSession(
  payload: Omit<AdminSession, "scope">,
): Promise<string> {
  const token = await new SignJWT({ ...payload, scope: "platform" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE_SECONDS}s`)
    .setIssuer("closer")
    .setAudience("closer-admin")
    .sign(getSecret());

  (await cookies()).set(ADMIN_SESSION_COOKIE, token, {
    ...cookieOptions(),
    path: "/admin",
  });
  return token;
}

export async function destroySessions(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
  store.delete(ADMIN_SESSION_COOKIE);
}

/* ------------------------------ lecture ------------------------------ */

async function readToken(cookieName: string): Promise<JWTPayload | null> {
  const token = (await cookies()).get(cookieName)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSecret(), {
      issuer: "closer",
    });
    return payload;
  } catch {
    return null;
  }
}

export function isMerchantSession(s: Session | null): s is MerchantSession {
  return s?.scope === "merchant";
}

export function isAdminSession(s: Session | null): s is AdminSession {
  return s?.scope === "platform";
}

/**
 * Résout la session marchand ET revérifie l’état du compte en base.
 * Corrige S7 : un marchand suspendu ou désactivé est rejeté immédiatement,
 * sans attendre l’expiration du jeton.
 */
export async function getMerchantSession(): Promise<MerchantSession | null> {
  const payload = await readToken(SESSION_COOKIE);
  if (!payload || payload.scope !== "merchant") return null;

  const merchantId = String(payload.merchantId ?? "");
  const userId = String(payload.userId ?? "");
  if (!merchantId || !userId) return null;

  const merchant = await db.query.merchants.findFirst({
    where: eq(merchants.id, merchantId),
    columns: {
      id: true,
      status: true,
      email: true,
      name: true,
      subscriptionStatus: true,
      trialEndsAt: true,
      subscriptionPlan: true,
    },
  });
  if (!merchant) return null;
  if (merchant.status === "suspended" || merchant.status === "deactivated") {
    return null;
  }

  // Le propriétaire est le marchand lui-même ; les autres viennent de `users`.
  if (userId === merchantId) {
    return {
      scope: "merchant",
      merchantId,
      userId,
      role: "owner",
      email: merchant.email,
      name: merchant.name,
    };
  }

  const user = await db.query.users.findFirst({
    where: and(eq(users.id, userId), eq(users.merchantId, merchantId)),
    columns: { id: true, role: true, email: true, name: true, isActive: true },
  });
  if (!user || !user.isActive) return null;

  return {
    scope: "merchant",
    merchantId,
    userId,
    role: user.role,
    email: user.email,
    name: user.name,
  };
}

export async function getAdminSession(): Promise<AdminSession | null> {
  const payload = await readToken(ADMIN_SESSION_COOKIE);
  if (!payload || payload.scope !== "platform") return null;

  const adminId = String(payload.adminId ?? "");
  if (!adminId) return null;

  const admin = await db.query.platformAdmins.findFirst({
    where: and(
      eq(platformAdmins.id, adminId),
      eq(platformAdmins.isActive, true),
    ),
  });
  if (!admin) return null;

  return {
    scope: "platform",
    adminId: admin.id,
    email: admin.email,
    name: admin.name,
  };
}

/** Session quelconque (utilisé par les pages publiques). */
export async function getSession(): Promise<Session | null> {
  return (await getMerchantSession()) ?? (await getAdminSession());
}
