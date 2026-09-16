/**
 * Réponses d’API normalisées.
 * =====================================================================
 * - Codes HTTP corrects.
 * - Messages utiles en français, jamais de stack trace exposée au marchand.
 * - Journalisation sans secret.
 *
 * Utilisation dans une route :
 *   export async function GET(req: NextRequest) {
 *     return withErrorHandling(async () => { ... return ok(data); })();
 *   }
 */
import { NextResponse } from "next/server";

export type ApiErrorBody = {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
};

export type ApiOkBody<T> = {
  data: T;
  meta?: Record<string, unknown>;
};

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export const badRequest = (message: string, code = "invalid_request") =>
  new ApiError(400, code, message);
export const unauthorized = (message = "Authentification requise.") =>
  new ApiError(401, "unauthorized", message);
export const forbidden = (message = "Accès refusé.") =>
  new ApiError(403, "forbidden", message);
export const notFound = (message = "Ressource introuvable.") =>
  new ApiError(404, "not_found", message);
export const conflict = (message: string, code = "conflict") =>
  new ApiError(409, code, message);
export const paymentRequired = (message: string) =>
  new ApiError(402, "subscription_required", message);
export const tooManyRequests = (message = "Trop de requêtes. Réessayez dans un instant.") =>
  new ApiError(429, "rate_limited", message);
export const serverError = (message = "Une erreur est survenue. Réessayez.") =>
  new ApiError(500, "internal_error", message);

export function ok<T>(data: T, meta?: Record<string, unknown>, status = 200) {
  const body: ApiOkBody<T> = meta ? { data, meta } : { data };
  return NextResponse.json(body, { status });
}

export function created<T>(data: T) {
  return ok(data, undefined, 201);
}

export function fail(error: unknown, context: string) {
  const known =
    error instanceof ApiError
      ? error
      : (error as { status?: number; code?: string; message?: string })?.status
        ? new ApiError(
            Number((error as { status: number }).status),
            String((error as { code?: string }).code ?? "error"),
            String((error as { message?: string }).message ?? "Erreur."),
          )
        : null;

  if (!known) {
    // Erreur inattendue : on journalise, on n’expose rien.
    console.error(`[api:${context}]`, error);
    return NextResponse.json<ApiErrorBody>(
      {
        error: {
          code: "internal_error",
          message: "Une erreur est survenue. Réessayez dans un instant.",
        },
      },
      { status: 500 },
    );
  }

  if (known.status >= 500) {
    console.error(`[api:${context}] ${known.code}:`, known.message);
  } else {
    console.warn(`[api:${context}] ${known.status} ${known.code}: ${known.message}`);
  }

  return NextResponse.json<ApiErrorBody>(
    {
      error: {
        code: known.code,
        message: known.message,
        ...(known.details ? { details: known.details } : {}),
      },
    },
    { status: known.status },
  );
}

/** Enveloppe standardisée pour les handlers de route. */
export function withErrorHandling<T extends unknown[]>(
  context: string,
  handler: (...args: T) => Promise<Response>,
) {
  return async (...args: T): Promise<Response> => {
    try {
      return await handler(...args);
    } catch (error) {
      return fail(error, context);
    }
  };
}

/**
 * Lit le corps JSON en toute sécurité (taille bornée, erreur claire).
 * Évite les `await req.json()` non protégés qui lèvent sur un corps vide.
 */
export async function readJson<T>(
  request: Request,
  maxBytes = 1_000_000,
): Promise<T> {
  const raw = await request.text();
  if (!raw) throw badRequest("Corps de requête vide.");
  if (raw.length > maxBytes) throw badRequest("Requête trop volumineuse.");

  try {
    return JSON.parse(raw) as T;
  } catch {
    throw badRequest("JSON invalide.");
  }
}

/**
 * Récupère le corps BRUT d’un webhook (nécessaire à la vérification de
 * signature) — ne jamais utiliser `req.json()` avant validation HMAC.
 */
export async function readRawBody(
  request: Request,
  maxBytes = 512_000,
): Promise<string> {
  const raw = await request.text();
  if (raw.length > maxBytes) throw badRequest("Webhook trop volumineux.");
  return raw;
}

/** Métadonnées de pagination normalisées. */
export function paginationMeta(params: {
  page: number;
  pageSize: number;
  total: number;
}) {
  const totalPages = Math.max(1, Math.ceil(params.total / params.pageSize));
  return {
    page: params.page,
    pageSize: params.pageSize,
    total: params.total,
    totalPages,
    hasNext: params.page < totalPages,
    hasPrev: params.page > 1,
  };
}

export function parsePagination(
  searchParams: URLSearchParams,
  defaults = { page: 1, pageSize: 25 },
  maxPageSize = 100,
) {
  const page = Math.max(1, Number(searchParams.get("page") ?? defaults.page) || 1);
  const pageSize = Math.min(
    maxPageSize,
    Math.max(1, Number(searchParams.get("pageSize") ?? defaults.pageSize) || defaults.pageSize),
  );
  return { page, pageSize, offset: (page - 1) * pageSize, limit: pageSize };
}
