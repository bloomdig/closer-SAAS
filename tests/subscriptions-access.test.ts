/**
 * Évaluation d'accès (§18–§20, §42).
 * Vérifie : essai expiré → lecture seule avec données conservées,
 * suspension → blocage total, période de grâce après impayé,
 * limites par forfait issues de la configuration centrale.
 */
import { describe, expect, it } from "vitest";
import { evaluateAccess } from "@/lib/subscriptions/access";
import { DEFAULT_PLANS, getPlanDefinition } from "@/lib/subscriptions/plans";

const NOW = new Date("2026-09-12T12:00:00Z");

describe("compte suspendu", () => {
  it("bloque tout accès quelle que soit la souscription", () => {
    const decision = evaluateAccess({
      now: NOW,
      merchantStatus: "suspended",
      subscriptionStatus: "active",
      plan: "pro",
    });
    expect(decision.level).toBe("blocked");
    expect(decision.features.aiReplies).toBe(false);
    expect(decision.features.newOrders).toBe(false);
    expect(decision.banner).toContain("suspendu");
  });
});

describe("essai gratuit", () => {
  it("essai en cours : accès complet", () => {
    const decision = evaluateAccess({
      now: NOW,
      merchantStatus: "active",
      subscriptionStatus: "trialing",
      plan: "starter",
      trialEndsAt: new Date("2026-09-15T12:00:00Z"),
    });
    expect(decision.level).toBe("full");
    expect(decision.trialDaysLeft).toBe(3);
    expect(decision.requireUpgrade).toBe(false);
  });

  it("essai expiré : lecture seule, données conservées, écran de mise à niveau", () => {
    const decision = evaluateAccess({
      now: NOW,
      merchantStatus: "active",
      subscriptionStatus: "trialing",
      plan: "starter",
      trialEndsAt: new Date("2026-09-10T12:00:00Z"),
    });
    expect(decision.level).toBe("read_only");
    expect(decision.requireUpgrade).toBe(true);
    // Lecture conservée, écriture coupée.
    expect(decision.features.exports).toBe(true);
    expect(decision.features.newOrders).toBe(false);
    expect(decision.features.aiReplies).toBe(false);
    expect(decision.banner).toBeTruthy();
  });
});

describe("abonnement actif et impayé", () => {
  it("abonnement actif : accès complet", () => {
    const decision = evaluateAccess({
      now: NOW,
      merchantStatus: "active",
      subscriptionStatus: "active",
      plan: "business",
      currentPeriodEnd: new Date("2026-10-01T00:00:00Z"),
    });
    expect(decision.level).toBe("full");
    expect(decision.requireUpgrade).toBe(false);
  });

  it("impayé récent : période de grâce, on avertit sans couper", () => {
    const decision = evaluateAccess({
      now: NOW,
      merchantStatus: "active",
      subscriptionStatus: "past_due",
      plan: "pro",
      currentPeriodEnd: new Date("2026-09-11T00:00:00Z"), // expiré hier
    });
    expect(decision.gracePeriod).toBe(true);
    expect(decision.level).not.toBe("blocked");
    expect(decision.features.newOrders).toBe(true);
  });

  it("impayé ancien (> grâce) : IA et automatisations coupées, données toujours accessibles", () => {
    const decision = evaluateAccess({
      now: NOW,
      merchantStatus: "active",
      subscriptionStatus: "past_due",
      plan: "pro",
      currentPeriodEnd: new Date("2026-08-20T00:00:00Z"), // expiré il y a 3 semaines
    });
    expect(decision.gracePeriod).toBe(false);
    expect(decision.level).toBe("restricted");
    expect(decision.requireUpgrade).toBe(true);
    // L'IA est coupée mais les données restent accessibles (§42 : on ne perd rien).
    expect(decision.features.aiReplies).toBe(false);
    expect(decision.features.automations).toBe(false);
    expect(decision.features.newOrders).toBe(true);
    expect(decision.banner).toContain("Paiement échoué");
  });

  it("annulation en fin de période : accès jusqu'à l'échéance", () => {
    const decision = evaluateAccess({
      now: NOW,
      merchantStatus: "active",
      subscriptionStatus: "active",
      plan: "starter",
      currentPeriodEnd: new Date("2026-09-30T00:00:00Z"),
      cancelAtPeriodEnd: true,
    });
    expect(decision.level).toBe("full");
  });
});

describe("forfaits (§19, §42)", () => {
  it("prix conformes : 99 / 249 / 499 MAD par mois, en centimes", () => {
    expect(DEFAULT_PLANS.map((plan) => plan.priceMonthly)).toEqual([9900, 24900, 49900]);
    expect(DEFAULT_PLANS.every((plan) => plan.currency === "MAD")).toBe(true);
  });

  it("essai de 7 jours par défaut", () => {
    expect(DEFAULT_PLANS.every((plan) => plan.trialDays === 7)).toBe(true);
  });

  it("limites croissantes du Starter au Business", () => {
    const starter = getPlanDefinition("starter");
    const pro = getPlanDefinition("pro");
    const business = getPlanDefinition("business");
    expect(pro.limits.aiConversationsPerMonth).toBeGreaterThan(
      starter.limits.aiConversationsPerMonth,
    );
    expect(business.limits.aiConversationsPerMonth).toBeGreaterThanOrEqual(
      pro.limits.aiConversationsPerMonth,
    );
    expect(business.limits.products).toBeGreaterThan(starter.limits.products);
  });

  it("Instagram réservé aux offres supérieures au Starter (limite de canaux)", () => {
    expect(getPlanDefinition("starter").limits.channels).toBe(1);
    expect(getPlanDefinition("pro").limits.channels).toBeGreaterThanOrEqual(2);
    expect(
      getPlanDefinition("pro").features.some((feature) => feature.includes("Instagram")),
    ).toBe(true);
    expect(
      getPlanDefinition("starter").features.some((feature) => feature.includes("Instagram")),
    ).toBe(false);
  });
});
