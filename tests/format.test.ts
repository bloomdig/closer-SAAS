/**
 * Formatage français / marocain (§29–§30).
 * Montants en DH, numéros +212, dates lisibles — aucune étiquette anglaise.
 */
import { describe, expect, it } from "vitest";
import {
  formatDurationMinutes,
  formatMoroccanPhone,
  formatNumber,
  formatRate,
  initials,
  ORDER_STATUS_FR,
  PLAN_NAMES_FR,
} from "@/lib/format";
import { formatMad } from "@/lib/subscriptions/plans";

describe("formatMad", () => {
  it("centimes → dirhams avec DH", () => {
    expect(formatMad(9900)).toBe("99 DH");
    expect(formatMad(24900)).toContain("249");
    expect(formatMad(19990)).toContain("199");
  });
});

describe("formatMoroccanPhone", () => {
  it("affiche le format local lisible", () => {
    expect(formatMoroccanPhone("+212661234567")).toBe("06 61 23 45 67");
  });

  it("valeurs vides → tiret", () => {
    expect(formatMoroccanPhone(null)).toBe("—");
    expect(formatMoroccanPhone(undefined)).toBe("—");
  });
});

describe("formatDurationMinutes", () => {
  it("durées lisibles en français", () => {
    expect(formatDurationMinutes(30)).toContain("30");
    expect(formatDurationMinutes(120)).toMatch(/h/);
    expect(formatDurationMinutes(1500)).toMatch(/j/);
  });
});

describe("libellés français", () => {
  it("tous les statuts de commande ont un libellé français", () => {
    for (const label of Object.values(ORDER_STATUS_FR)) {
      expect(label.length).toBeGreaterThan(0);
      // Pas de mot anglais courant dans les libellés.
      expect(label.toLowerCase()).not.toMatch(/\b(new|confirmed|shipped|delivered|cancelled)\b/);
    }
  });

  it("les forfaits ont des noms affichables", () => {
    expect(PLAN_NAMES_FR.starter).toBeTruthy();
    expect(PLAN_NAMES_FR.pro).toBeTruthy();
    expect(PLAN_NAMES_FR.business).toBeTruthy();
  });
});

describe("divers", () => {
  it("formatRate n'affiche jamais NaN", () => {
    expect(formatRate(null)).toBe("—");
    expect(formatRate(undefined)).toBe("—");
    expect(formatRate(NaN)).toBe("—");
    expect(formatRate(12.34)).toBe("12,3 %");
  });

  it("formatNumber formate à la française", () => {
    expect(formatNumber(1234)).toMatch(/1.?234/);
    expect(formatNumber(null)).toBe("0");
  });

  it("initials extrait les initiales", () => {
    expect(initials("Karim Idrissi")).toBe("KI");
    expect(initials(null)).toBeTruthy();
  });
});
