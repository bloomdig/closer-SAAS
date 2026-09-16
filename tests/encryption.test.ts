/**
 * Chiffrement des identifiants de canaux (§16, §17).
 * AES-256-GCM : aller-retour fidèle, altération détectée, masquage des
 * secrets dans les réponses API.
 */
import { beforeAll, describe, expect, it } from "vitest";

beforeAll(() => {
  process.env.CREDENTIALS_ENCRYPTION_KEY =
    "test-encryption-key-0123456789abcdef-0123456789";
});

describe("encryptCredentials / decryptCredentials", () => {
  it("aller-retour fidèle des identifiants", async () => {
    const { encryptCredentials, decryptCredentials } = await import(
      "@/lib/security/encryption"
    );
    const payload = encryptCredentials({
      WHATSAPP_ACCESS_TOKEN: "EAAG-token-secret",
      WHATSAPP_PHONE_NUMBER_ID: "109876543210",
      EMPTY: "",
      MISSING: null,
    });
    const decrypted = decryptCredentials(payload);
    expect(decrypted.WHATSAPP_ACCESS_TOKEN).toBe("EAAG-token-secret");
    expect(decrypted.WHATSAPP_PHONE_NUMBER_ID).toBe("109876543210");
    // Les champs vides ne sont pas conservés.
    expect(decrypted.EMPTY).toBeUndefined();
    expect(decrypted.MISSING).toBeUndefined();
  });

  it("le texte chiffré ne contient jamais le secret en clair", async () => {
    const { encryptCredentials } = await import("@/lib/security/encryption");
    const payload = encryptCredentials({ TOKEN: "super-secret-value" });
    expect(payload).not.toContain("super-secret-value");
  });

  it("deux chiffrements du même secret produisent des payloads différents (IV aléatoire)", async () => {
    const { encryptCredentials } = await import("@/lib/security/encryption");
    const a = encryptCredentials({ TOKEN: "same" });
    const b = encryptCredentials({ TOKEN: "same" });
    expect(a).not.toBe(b);
  });

  it("toute altération du payload est détectée (tag GCM)", async () => {
    const { encryptCredentials, decryptCredentials } = await import(
      "@/lib/security/encryption"
    );
    const payload = encryptCredentials({ TOKEN: "value" });
    const parts = payload.split(".");
    // Altération du dernier caractère du corps chiffré.
    const body = parts[3];
    parts[3] = (body[0] === "A" ? "B" : "A") + body.slice(1);
    expect(() => decryptCredentials(parts.join("."))).toThrow();
  });

  it("un payload malformé est rejeté", async () => {
    const { decryptCredentials } = await import("@/lib/security/encryption");
    expect(() => decryptCredentials("garbage")).toThrow();
    expect(decryptCredentials("")).toEqual({});
  });
});

describe("maskSecret", () => {
  it("masque l'essentiel du secret en n'exposant que la fin", async () => {
    const { maskSecret } = await import("@/lib/security/encryption");
    const masked = maskSecret("EAAG1234567890abcdef");
    expect(masked).toBeTruthy();
    expect(masked).not.toContain("EAAG1234567890");
    expect(masked!.length).toBeLessThan("EAAG1234567890abcdef".length + 4);
    expect(maskSecret(null)).toBeNull();
    expect(maskSecret("")).toBeNull();
    expect(maskSecret("abc")).toBe("••••");
  });
});
