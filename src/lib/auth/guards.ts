import { redirect } from "next/navigation";
import {
  can,
  AuthorizationError,
  type Permission,
  type Session as TenantSession,
} from "@/lib/security/tenant";
import {
  destroySessions,
  getAdminSession,
  getMerchantSession,
  type MerchantSession,
  type AdminSession,
} from "@/lib/auth/session";
import { evaluateAccess, type AccessDecision } from "@/lib/subscriptions/access";
import { db } from "@/db";
import { eq } from "drizzle-orm";
import { merchants, subscriptions } from "@/db/schema";

/**
 * Gardes d’accès serveur.
 * =====================================================================
 * Corrige S1 : `/admin` exige désormais un jeton de portée `platform`.
 * Toute page et toute route API passe par ces fonctions — la restriction
 * n’est jamais laissée au frontend (§4).
 *
 * Deux variantes à chaque fois :
 *  - `*Page` : redirige (comportement attendu d’un navigateur)
 *  - `*Api`  : lève une erreur avec code HTTP (une redirection HTML
 *              casserait les appels `fetch` du client)
 */

export type AuthedMerchant = {
  session: MerchantSession;
  /** Session au format utilisé par les gardes multi-tenant. */
  tenant: TenantSession;
  access: AccessDecision;
  merchant: {
    id: string;
    name: string;
    businessName: string | null;
    email: string;
    locale: string;
    timezone: string;
    subscriptionPlan: "starter" | "pro" | "business";
    subscriptionStatus: string;
    status: string;
    phone: string | null;
    trialEndsAt: Date | null;
    isDemo: boolean;
  };
};

class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

/** Résolution commune : session + marchand + abonnement + droits d’accès. */
async function resolveMerchant(): Promise<AuthedMerchant | null> {
  const session = await getMerchantSession();
  if (!session) return null;

  const merchant = await db.query.merchants.findFirst({
    where: eq(merchants.id, session.merchantId),
  });
  if (!merchant) return null;

  const subscription = await db.query.subscriptions.findFirst({
    where: eq(subscriptions.merchantId, session.merchantId),
  });

  const access = evaluateAccess({
    merchantStatus: merchant.status,
    subscriptionStatus: (subscription?.status ??
      merchant.subscriptionStatus) as never,
    plan: (subscription?.plan ?? merchant.subscriptionPlan) as never,
    trialEndsAt: subscription?.trialEnd ?? merchant.trialEndsAt,
    currentPeriodEnd: subscription?.currentPeriodEnd,
    cancelAtPeriodEnd: subscription?.cancelAtPeriodEnd,
  });

  return {
    session,
    tenant: {
      merchantId: session.merchantId,
      userId: session.userId,
      role: session.role,
      email: session.email,
      name: session.name,
    },
    access,
    merchant: {
      id: merchant.id,
      name: merchant.name,
      businessName: merchant.businessName,
      email: merchant.email,
      locale: merchant.locale,
      timezone: merchant.timezone,
      subscriptionPlan: merchant.subscriptionPlan,
      subscriptionStatus: merchant.subscriptionStatus,
      status: merchant.status,
      phone: merchant.phone,
      trialEndsAt: merchant.trialEndsAt,
      isDemo: merchant.isDemo,
    },
  };
}

/** Page marchand : redirige vers /login si non authentifié. */
export async function requireMerchantPage(): Promise<AuthedMerchant> {
  const authed = await resolveMerchant();
  if (!authed) redirect("/login");
  return authed;
}

/** Route API marchand : 401 JSON si non authentifié. */
export async function requireMerchantApi(): Promise<AuthedMerchant> {
  const authed = await resolveMerchant();
  if (!authed) {
    throw new HttpError(401, "unauthorized", "Authentification requise.");
  }
  return authed;
}

/** Vérifie une permission du rôle (owner / admin / agent). */
export function requireRole(
  session: MerchantSession,
  permission: Permission,
): void {
  if (!can(session.role, permission)) {
    throw new AuthorizationError("Votre rôle ne permet pas cette action.");
  }
}

/** Refuse l’accès si l’abonnement ne permet pas la fonctionnalité (§19). */
export function requireFeatureAccess(
  authed: AuthedMerchant,
  feature: keyof AccessDecision["features"],
): void {
  if (authed.access.level === "blocked") {
    throw new HttpError(403, "account_suspended", authed.access.banner ?? "Compte suspendu.");
  }
  if (!authed.access.features[feature]) {
    throw new HttpError(
      402,
      "subscription_required",
      authed.access.banner ??
        "Cette fonctionnalité n’est pas disponible avec votre abonnement actuel.",
    );
  }
}

/** Page administration plateforme. */
export async function requireAdminPage(): Promise<AdminSession> {
  const session = await getAdminSession();
  if (!session) redirect("/admin/login");
  return session;
}

/** Route API administration plateforme. */
export async function requireAdminApi(): Promise<AdminSession> {
  const session = await getAdminSession();
  if (!session) {
    throw new HttpError(
      401,
      "unauthorized",
      "Accès réservé à l’administration CLOSER.",
    );
  }
  return session;
}

/** Déconnexion (Server Action). */
export async function logoutAction(): Promise<void> {
  "use server";
  await destroySessions();
  redirect("/login");
}
