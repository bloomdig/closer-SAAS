/**
 * Machine à états des commandes (§13).
 * Garantit que seules les transitions légitimes sont acceptées et que les
 * statuts finaux sont bien terminaux.
 */
import { describe, expect, it } from "vitest";
import {
  ORDER_STATUSES,
  REVENUE_STATUSES,
  TERMINAL_STATUSES,
  allowedTransitions,
  assertTransition,
  canTransition,
  generateOrderReference,
  InvalidOrderTransitionError,
  isOrderStatus,
} from "@/lib/orders/status";

describe("statuts de commande", () => {
  it("couvre les 10 statuts du cahier des charges", () => {
    expect(ORDER_STATUSES).toHaveLength(10);
    expect(ORDER_STATUSES).toEqual(
      expect.arrayContaining([
        "new",
        "ai_qualified",
        "pending_confirmation",
        "confirmed",
        "processing",
        "shipped",
        "delivered",
        "refused",
        "cancelled",
        "returned",
      ]),
    );
  });

  it("isOrderStatus rejette les valeurs inconnues", () => {
    expect(isOrderStatus("confirmed")).toBe(true);
    expect(isOrderStatus("paid")).toBe(false);
    expect(isOrderStatus(null)).toBe(false);
    expect(isOrderStatus(42)).toBe(false);
  });
});

describe("transitions", () => {
  it("autorise une transition légitime du flux COD", () => {
    expect(canTransition("new", "ai_qualified")).toBe(true);
    expect(canTransition("ai_qualified", "confirmed")).toBe(true);
    expect(canTransition("confirmed", "processing")).toBe(true);
    expect(canTransition("processing", "shipped")).toBe(true);
    expect(canTransition("shipped", "delivered")).toBe(true);
  });

  it("autorise le refus / l'annulation avant expédition", () => {
    expect(canTransition("confirmed", "cancelled")).toBe(true);
    expect(canTransition("ai_qualified", "refused")).toBe(true);
  });

  it("interdit les sauts illogiques", () => {
    // Une commande livrée ne repart pas en traitement.
    expect(canTransition("delivered", "processing")).toBe(false);
    // On n'expédie pas une commande annulée.
    expect(canTransition("cancelled", "shipped")).toBe(false);
    // Une nouvelle commande ne passe pas directement à livrée.
    expect(canTransition("new", "delivered")).toBe(false);
  });

  it("cancelled, refused et returned n'ont aucune transition sortante", () => {
    for (const status of ["cancelled", "refused", "returned"] as const) {
      expect(allowedTransitions(status)).toEqual([]);
    }
  });

  it("une commande livrée peut encore être retournée (SAV)", () => {
    expect(canTransition("delivered", "returned")).toBe(true);
    expect(canTransition("shipped", "returned")).toBe(true);
  });

  it("assertTransition lève une erreur 409 en français sur transition invalide", () => {
    expect(() => assertTransition("new", "confirmed")).not.toThrow();
    expect(() => assertTransition("delivered", "new")).toThrow(
      InvalidOrderTransitionError,
    );
    try {
      assertTransition("cancelled", "shipped");
    } catch (error) {
      const err = error as InvalidOrderTransitionError;
      expect(err.status).toBe(409);
      expect(err.code).toBe("invalid_order_transition");
      expect(err.message).toContain("Transition impossible");
    }
  });

  it("rester sur le même statut est toujours accepté (idempotence)", () => {
    for (const status of ORDER_STATUSES) {
      expect(canTransition(status, status)).toBe(true);
    }
  });
});

describe("revenu et référence", () => {
  it("le revenu ne compte que les statuts encaissables", () => {
    expect(REVENUE_STATUSES).toContain("delivered");
    expect(REVENUE_STATUSES).not.toContain("cancelled");
    expect(REVENUE_STATUSES).not.toContain("refused");
  });

  it("génère une référence au format CL-YYMMDD-XXXX", () => {
    const ref = generateOrderReference(new Date("2026-03-09T10:00:00Z"));
    expect(ref).toMatch(/^CL-2603\d{2}-[A-Z0-9]{4}$/);
  });
});
