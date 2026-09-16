/**
 * Validation des entrées (§24) — téléphone marocain, montants MAD,
 * e-mail, mot de passe. Aucune dépendance externe : logique pure.
 */
import { describe, expect, it } from "vitest";
import {
  email,
  madAmount,
  password,
  phone,
  throwIfInvalid,
  ValidationError,
  type FieldErrors,
} from "@/lib/validation";
import { normalizeMoroccanPhone } from "@/lib/ai/tools";

describe("normalizeMoroccanPhone", () => {
  it("accepte les formats locaux et internationaux", () => {
    expect(normalizeMoroccanPhone("0661234567")).toBe("+212661234567");
    expect(normalizeMoroccanPhone("+212661234567")).toBe("+212661234567");
    expect(normalizeMoroccanPhone("00212661234567")).toBe("+212661234567");
    expect(normalizeMoroccanPhone("212661234567")).toBe("+212661234567");
    expect(normalizeMoroccanPhone("06 61 23 45 67")).toBe("+212661234567");
    expect(normalizeMoroccanPhone("06-61-23-45-67")).toBe("+212661234567");
  });

  it("rejette les numéros invalides", () => {
    expect(normalizeMoroccanPhone("0612345")).toBeNull(); // trop court
    expect(normalizeMoroccanPhone("0361234567")).toBeNull(); // préfixe invalide
    expect(normalizeMoroccanPhone("+33612345678")).toBeNull(); // pas le Maroc
    expect(normalizeMoroccanPhone("abc")).toBeNull();
    expect(normalizeMoroccanPhone("")).toBeNull();
    expect(normalizeMoroccanPhone(null)).toBeNull();
  });
});

describe("phone (champ de formulaire)", () => {
  it("normalise et signale l'erreur en français", () => {
    const errors: FieldErrors = {};
    expect(phone("0661234567", "phone", "Téléphone", errors)).toBe("+212661234567");
    expect(errors).toEqual({});

    phone("12345", "phone", "Téléphone", errors);
    expect(errors.phone).toContain("06XXXXXXXX");
  });

  it("un champ optionnel vide ne produit pas d'erreur", () => {
    const errors: FieldErrors = {};
    expect(phone("", "phone", "Téléphone", errors, true)).toBeUndefined();
    expect(errors).toEqual({});
  });
});

describe("madAmount", () => {
  it("convertit les dirhams en centimes entiers", () => {
    const errors: FieldErrors = {};
    expect(madAmount("249", "price", "Prix", errors)).toBe(24900);
    expect(madAmount(249.99, "price", "Prix", errors)).toBe(24999);
    expect(madAmount("199,90", "price", "Prix", errors)).toBe(19990);
    expect(errors).toEqual({});
  });

  it("refuse les montants négatifs, non numériques et excessifs", () => {
    const errors: FieldErrors = {};
    expect(madAmount(-5, "price", "Prix", errors)).toBeUndefined();
    expect(madAmount("abc", "price", "Prix", errors)).toBeUndefined();
    expect(madAmount(2_000_000, "price", "Prix", errors)).toBeUndefined();
    expect(Object.keys(errors).length).toBeGreaterThan(0);
  });

  it("optionnel : une valeur vide ne produit pas d'erreur", () => {
    const errors: FieldErrors = {};
    expect(madAmount("", "price", "Prix", errors, { optional: true })).toBeUndefined();
    expect(errors).toEqual({});
  });
});

describe("email", () => {
  it("normalise en minuscules", () => {
    const errors: FieldErrors = {};
    expect(email("  Karim@Example.MA ", "email", "E-mail", errors)).toBe("karim@example.ma");
    expect(errors).toEqual({});
  });

  it("rejette les e-mails invalides", () => {
    const errors: FieldErrors = {};
    expect(email("karim@", "email", "E-mail", errors)).toBeUndefined();
    expect(errors.email).toContain("invalide");
  });
});

describe("password", () => {
  it("exige 8 caractères minimum avec lettre et chiffre", () => {
    const errors: FieldErrors = {};
    expect(password("abc12345", "password", errors)).toBe("abc12345");
    expect(errors).toEqual({});

    expect(password("court1", "password", errors)).toBeUndefined();
    expect(password("seulementdeslettres", "password", errors)).toBeUndefined();
    expect(password("12345678", "password", errors)).toBeUndefined();
  });
});

describe("throwIfInvalid", () => {
  it("lève une ValidationError 422 avec le détail des champs", () => {
    expect(() => throwIfInvalid({})).not.toThrow();
    try {
      throwIfInvalid({ phone: "Téléphone invalide." });
      throw new Error("aurait dû lever");
    } catch (error) {
      expect(error).toBeInstanceOf(ValidationError);
      const err = error as ValidationError;
      expect(err.status).toBe(422);
      expect(err.fields).toEqual({ phone: "Téléphone invalide." });
    }
  });
});
