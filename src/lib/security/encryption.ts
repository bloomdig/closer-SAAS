/**
 * Chiffrement des identifiants de canaux (WhatsApp / Instagram).
 * =====================================================================
 * Les jetons d’accès Meta sont des secrets : ils sont chiffrés au repos avec
 * AES-256-GCM avant écriture en base, et ne sont jamais renvoyés en clair au
 * navigateur (§33).
 *
 * La clé de chiffrement (`CREDENTIALS_ENCRYPTION_KEY`) est distincte de
 * `JWT_SECRET` : la compromission de l’une ne compromet pas l’autre.
 *
 * Format stocké : `v1.<iv base64url>.<tag base64url>.<ciphertext base64url>`
 */
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const VERSION = "v1";
const IV_LENGTH = 12;

/** Dérive une clé 256 bits déterministe depuis la variable d’environnement. */
function getKey(): Buffer {
  const secret = process.env.CREDENTIALS_ENCRYPTION_KEY ?? process.env.JWT_SECRET;

  if (!secret || secret.trim().length < 32) {
    throw new Error(
      "CREDENTIALS_ENCRYPTION_KEY est absente ou trop courte (32 caractères minimum). " +
        "Générez-en une avec : openssl rand -base64 48",
    );
  }

  return createHash("sha256").update(secret).digest();
}

export function encryptCredentials(
  credentials: Record<string, string | null | undefined>,
): string {
  // Seuls les champs non vides sont conservés.
  const payload: Record<string, string> = {};
  for (const [key, value] of Object.entries(credentials)) {
    if (typeof value === "string" && value.trim().length > 0) {
      payload[key] = value.trim();
    }
  }

  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, getKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(payload), "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return [
    VERSION,
    iv.toString("base64url"),
    tag.toString("base64url"),
    encrypted.toString("base64url"),
  ].join(".");
}

export function decryptCredentials(payload: string): Record<string, string> {
  if (!payload) return {};

  const parts = payload.split(".");
  if (parts.length !== 4 || parts[0] !== VERSION) {
    throw new Error("Format d’identifiants chiffrés invalide.");
  }

  const [, ivPart, tagPart, dataPart] = parts;
  const iv = Buffer.from(ivPart, "base64url");
  const tag = Buffer.from(tagPart, "base64url");
  const data = Buffer.from(dataPart, "base64url");

  const decipher = createDecipheriv(ALGORITHM, getKey(), iv);
  decipher.setAuthTag(tag);

  const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);
  const parsed = JSON.parse(decrypted.toString("utf8")) as unknown;

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return {};
  }
  return parsed as Record<string, string>;
}

/**
 * Masquage pour affichage : ne montre que les 4 derniers caractères.
 * À utiliser dans toutes les réponses API et l’interface.
 */
export function maskSecret(value: string | null | undefined): string | null {
  if (!value) return null;
  if (value.length <= 4) return "••••";
  return `${"•".repeat(Math.min(12, value.length - 4))}${value.slice(-4)}`;
}
