/**
 * Validation des entrées — toutes les routes API.
 * =====================================================================
 * Corrige S5 et le §36 : aucune donnée client n’atteint la base sans
 * validation. Les messages d’erreur sont en français et actionnables.
 * Zéro dépendance supplémentaire.
 */
import { normalizeMoroccanPhone, matchMoroccanCity } from "@/lib/ai/tools";

export type FieldErrors = Record<string, string>;

export class ValidationError extends Error {
  readonly status = 422;
  readonly code = "validation_error";
  constructor(readonly fields: FieldErrors, message = "Formulaire incomplet ou invalide.") {
    super(message);
    this.name = "ValidationError";
  }
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/* ------------------------------ primitives ------------------------------ */

export function str(
  value: unknown,
  field: string,
  opts: {
    label: string;
    min?: number;
    max?: number;
    optional?: boolean;
    trim?: boolean;
  },
  errors: FieldErrors,
): string | undefined {
  if (value === undefined || value === null || value === "") {
    if (opts.optional) return undefined;
    errors[field] = `${opts.label} est requis.`;
    return undefined;
  }
  if (typeof value !== "string") {
    errors[field] = `${opts.label} doit être du texte.`;
    return undefined;
  }

  let out = opts.trim === false ? value : value.trim();
  if (opts.min !== undefined && out.length < opts.min) {
    errors[field] = `${opts.label} : ${opts.min} caractères minimum.`;
    return undefined;
  }
  if (opts.max !== undefined && out.length > opts.max) {
    out = out.slice(0, opts.max);
  }
  return out;
}

export function email(value: unknown, field: string, label: string, errors: FieldErrors): string | undefined {
  const raw = str(value, field, { label, max: 255 }, errors);
  if (raw === undefined) return undefined;

  // Normalisation : corrige S4 (casse et espaces).
  const normalized = raw.toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(normalized)) {
    errors[field] = `${label} invalide.`;
    return undefined;
  }
  return normalized;
}

export function password(value: unknown, field: string, errors: FieldErrors): string | undefined {
  if (typeof value !== "string" || value.length === 0) {
    errors[field] = "Mot de passe requis.";
    return undefined;
  }
  if (value.length < 8) {
    errors[field] = "Le mot de passe doit contenir au moins 8 caractères.";
    return undefined;
  }
  if (value.length > 200) {
    errors[field] = "Le mot de passe est trop long.";
    return undefined;
  }
  if (!/[a-zA-Z]/.test(value) || !/\d/.test(value)) {
    errors[field] = "Le mot de passe doit contenir au moins une lettre et un chiffre.";
    return undefined;
  }
  return value;
}

export function phone(value: unknown, field: string, label: string, errors: FieldErrors, optional = false): string | undefined {
  const normalized = normalizeMoroccanPhone(value);
  if (!normalized) {
    if (optional && (value === undefined || value === null || value === "")) return undefined;
    errors[field] = `${label} invalide. Format attendu : 06XXXXXXXX ou +2126XXXXXXXX.`;
    return undefined;
  }
  return normalized;
}

export function city(value: unknown, field: string, errors: FieldErrors, optional = true): string | undefined {
  if (value === undefined || value === null || value === "") {
    if (optional) return undefined;
    errors[field] = "Ville requise.";
    return undefined;
  }
  return matchMoroccanCity(value) ?? undefined;
}

export function int(
  value: unknown,
  field: string,
  opts: { label: string; min?: number; max?: number; optional?: boolean; fallback?: number },
  errors: FieldErrors,
): number | undefined {
  if (value === undefined || value === null || value === "") {
    if (opts.optional) return opts.fallback;
    errors[field] = `${opts.label} est requis.`;
    return undefined;
  }
  const n = typeof value === "string" ? Number(value.replace(",", ".")) : value;
  if (typeof n !== "number" || !Number.isFinite(n)) {
    errors[field] = `${opts.label} doit être un nombre.`;
    return undefined;
  }
  const i = Math.trunc(n);
  if (opts.min !== undefined && i < opts.min) {
    errors[field] = `${opts.label} : minimum ${opts.min}.`;
    return undefined;
  }
  if (opts.max !== undefined && i > opts.max) {
    errors[field] = `${opts.label} : maximum ${opts.max}.`;
    return undefined;
  }
  return i;
}

/** Montant MAD saisi par le marchand (DH, décimales autorisées) → centimes. */
export function madAmount(
  value: unknown,
  field: string,
  label: string,
  errors: FieldErrors,
  opts: { optional?: boolean; max?: number } = {},
): number | undefined {
  if (value === undefined || value === null || value === "") {
    if (opts.optional) return undefined;
    errors[field] = `${label} est requis.`;
    return undefined;
  }
  const n = typeof value === "string" ? Number(value.replace(",", ".")) : value;
  if (typeof n !== "number" || !Number.isFinite(n) || n < 0) {
    errors[field] = `${label} invalide.`;
    return undefined;
  }
  const cents = Math.round(n * 100);
  const max = opts.max ?? 100_000_000; // 1 000 000 DH
  if (cents > max) {
    errors[field] = `${label} trop élevé.`;
    return undefined;
  }
  return cents;
}

export function bool(value: unknown, fallback = false): boolean {
  if (typeof value === "boolean") return value;
  if (value === "true" || value === "1" || value === "on") return true;
  if (value === "false" || value === "0" || value === "off") return false;
  return fallback;
}

export function oneOf<T extends string>(
  value: unknown,
  allowed: readonly T[],
  field: string,
  label: string,
  errors: FieldErrors,
  opts: { optional?: boolean; fallback?: T } = {},
): T | undefined {
  if (value === undefined || value === null || value === "") {
    if (opts.optional) return opts.fallback;
    errors[field] = `${label} est requis.`;
    return undefined;
  }
  if (typeof value !== "string" || !allowed.includes(value as T)) {
    errors[field] = `${label} invalide.`;
    return undefined;
  }
  return value as T;
}

export function uuidValue(value: unknown, field: string, label: string, errors: FieldErrors): string | undefined {
  if (typeof value !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) {
    errors[field] = `${label} invalide.`;
    return undefined;
  }
  return value;
}

export function arrayField<T>(
  value: unknown,
  field: string,
  label: string,
  errors: FieldErrors,
  item: (raw: unknown, index: number) => T | undefined,
  opts: { max?: number; optional?: boolean } = {},
): T[] | undefined {
  if (value === undefined || value === null) {
    if (opts.optional) return undefined;
    errors[field] = `${label} est requis.`;
    return undefined;
  }
  if (!Array.isArray(value)) {
    errors[field] = `${label} doit être une liste.`;
    return undefined;
  }
  const max = opts.max ?? 100;
  if (value.length > max) {
    errors[field] = `${label} : ${max} éléments maximum.`;
    return undefined;
  }
  const out: T[] = [];
  value.forEach((raw, index) => {
    const parsed = item(raw, index);
    if (parsed !== undefined) out.push(parsed);
  });
  return out;
}

/** Termine la validation : lève si des erreurs ont été collectées. */
export function throwIfInvalid(errors: FieldErrors): void {
  if (Object.keys(errors).length > 0) {
    throw new ValidationError(errors);
  }
}
