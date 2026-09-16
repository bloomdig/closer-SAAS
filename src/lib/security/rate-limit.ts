/**
 * Limitation de débit en mémoire.
 * =====================================================================
 * Corrige S5 : protège `login`, `signup`, l’IA et les webhooks contre
 * l’énumération et l’abus.
 *
 * Limite connue et assumée : l’état est par instance serverless. Sur Vercel
 * cela freine efficacement les attaques simples ; pour une protection
 * répartie, brancher Upstash Redis derrière la même interface (le contrat
 * `RateLimiter` ne change pas).
 */

export type RateLimiter = {
  /** true si la requête est autorisée. */
  hit(key: string, limit: number, windowSeconds: number): boolean;
  reset(key: string): void;
};

type Bucket = { count: number; resetAt: number };

const BUCKETS = new Map<string, Bucket>();
let lastSweep = Date.now();

const SWEEP_INTERVAL_MS = 60_000;

function sweep(now: number): void {
  if (now - lastSweep < SWEEP_INTERVAL_MS) return;
  lastSweep = now;
  for (const [key, bucket] of BUCKETS) {
    if (bucket.resetAt <= now) BUCKETS.delete(key);
  }
}

export const memoryRateLimiter: RateLimiter = {
  hit(key, limit, windowSeconds) {
    const now = Date.now();
    sweep(now);

    const existing = BUCKETS.get(key);
    if (!existing || existing.resetAt <= now) {
      BUCKETS.set(key, { count: 1, resetAt: now + windowSeconds * 1000 });
      return true;
    }

    existing.count += 1;
    return existing.count <= limit;
  },
  reset(key) {
    BUCKETS.delete(key);
  },
};

export const rateLimiter: RateLimiter = memoryRateLimiter;

/** Limites par défaut, en secondes. */
export const RATE_LIMITS = {
  login: { limit: 8, window: 300 }, // 8 tentatives / 5 min
  signup: { limit: 5, window: 900 },
  aiRespond: { limit: 30, window: 60 },
  customerMessage: { limit: 20, window: 60 },
  genericApi: { limit: 120, window: 60 },
  webhook: { limit: 600, window: 60 },
} as const;

export class RateLimitError extends Error {
  readonly status = 429;
  readonly code = "rate_limited";
  constructor(message = "Trop de tentatives. Réessayez dans quelques minutes.") {
    super(message);
    this.name = "RateLimitError";
  }
}

/** Applique une limite et lève si elle est dépassée. */
export function enforceRateLimit(
  key: string,
  rule: { limit: number; window: number },
  message?: string,
): void {
  if (process.env.RATE_LIMIT_ENABLED === "false") return;
  if (!rateLimiter.hit(key, rule.limit, rule.window)) {
    throw new RateLimitError(message);
  }
}

/** Clé stable pour un appelant : IP (+ empreinte si présente). */
export function clientKey(request: Request, scope: string, extra = ""): string {
  const headers = request.headers;
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = forwarded || headers.get("x-real-ip") || "unknown";
  return `${scope}:${ip}${extra ? `:${extra}` : ""}`;
}
