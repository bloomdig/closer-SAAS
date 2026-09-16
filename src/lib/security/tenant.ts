/**
 * Garde-fous multi-tenant.
 * ------------------------------------------------------------------
 * Toute requête métier DOIT passer par `tenantScope()`. Un marchand ne peut
 * jamais lire ni écrire les données d’un autre marchand. La restriction est
 * appliquée côté serveur, jamais uniquement dans l’interface.
 */
import { eq, and, type SQL } from "drizzle-orm";
import type { Column } from "drizzle-orm";

export type Role = "owner" | "admin" | "agent";

export type Session = {
  /** Identifiant du compte marchand (tenant). */
  merchantId: string;
  /** Identifiant de l’utilisateur connecté (peut être le marchand lui-même). */
  userId: string;
  role: Role;
  email: string;
  name?: string | null;
};

/** Matrice de permissions — source de vérité unique (server-side). */
export const PERMISSIONS = {
  "billing:read": ["owner", "admin"],
  "billing:manage": ["owner"],
  "team:read": ["owner", "admin"],
  "team:manage": ["owner"],
  "settings:read": ["owner", "admin", "agent"],
  "settings:manage": ["owner", "admin"],
  "products:read": ["owner", "admin", "agent"],
  "products:manage": ["owner", "admin"],
  "customers:read": ["owner", "admin", "agent"],
  "customers:manage": ["owner", "admin", "agent"],
  "conversations:read": ["owner", "admin", "agent"],
  "conversations:manage": ["owner", "admin", "agent"],
  "orders:read": ["owner", "admin", "agent"],
  "orders:manage": ["owner", "admin", "agent"],
  "analytics:read": ["owner", "admin"],
  "automations:read": ["owner", "admin"],
  "automations:manage": ["owner", "admin"],
  "channels:read": ["owner", "admin"],
  "channels:manage": ["owner", "admin"],
} as const satisfies Record<string, readonly Role[]>;

export type Permission = keyof typeof PERMISSIONS;

export class AuthorizationError extends Error {
  readonly status = 403;
  constructor(message = "Accès refusé.") {
    super(message);
    this.name = "AuthorizationError";
  }
}

export function can(role: Role, permission: Permission): boolean {
  return (PERMISSIONS[permission] as readonly Role[]).includes(role);
}

export function requirePermission(session: Session, permission: Permission) {
  if (!can(session.role, permission)) {
    throw new AuthorizationError(
      "Votre rôle ne permet pas cette action.",
    );
  }
}

/**
 * Construit la condition SQL `merchant_id = <session.merchantId>`.
 * À combiner avec les autres filtres : `where(and(tenantScope(...), eq(...)))`.
 */
export function tenantScope(column: Column, session: Session): SQL {
  if (!session?.merchantId) {
    throw new AuthorizationError("Session invalide : marchand introuvable.");
  }
  return eq(column, session.merchantId);
}

/** Variante pratique acceptant directement un merchantId. */
export function merchantScope(
  column: Column,
  merchantId: string | undefined | null,
): SQL {
  if (!merchantId) {
    throw new AuthorizationError("Identifiant marchand manquant.");
  }
  return eq(column, merchantId);
}

/**
 * Valide qu’une entité chargée appartient bien au tenant courant.
 * À appeler après chaque `findMany` / `findFirst` sur une ressource ciblée par id.
 */
export function assertOwnership<T extends { merchantId: string | null }>(
  row: T | null | undefined,
  session: Session,
  label = "ressource",
): T {
  if (!row) {
    // 404 plutôt que 403 : ne pas révéler l’existence d’une ressource d’un autre tenant.
    const error = new Error(`${label} introuvable.`) as Error & { status: number };
    error.status = 404;
    throw error;
  }
  if (row.merchantId !== session.merchantId) {
    throw new AuthorizationError(`${label} introuvable.`);
  }
  return row;
}

/** Combine le filtre tenant avec d’autres conditions optionnelles. */
export function scoped(
  column: Column,
  session: Session,
  ...extra: (SQL | undefined)[]
): SQL {
  const conditions = [tenantScope(column, session), ...extra.filter(Boolean)];
  return conditions.length === 1
    ? (conditions[0] as SQL)
    : and(...(conditions as [SQL, ...SQL[]]))!;
}
