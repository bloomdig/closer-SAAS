/**
 * Machine à états des commandes.
 * =====================================================================
 * Les transitions invalides sont rejetées côté serveur. Le tableau de bord et
 * les statistiques dépendent de ces états : ils restent donc cohérents.
 */

export const ORDER_STATUSES = [
  "new",
  "ai_qualified",
  "pending_confirmation",
  "confirmed",
  "processing",
  "shipped",
  "delivered",
  "cancelled",
  "refused",
  "returned",
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const ORDER_STATUS_LABELS_FR: Record<OrderStatus, string> = {
  new: "Nouvelle",
  ai_qualified: "Qualifiée par l’IA",
  pending_confirmation: "En attente de confirmation",
  confirmed: "Confirmée",
  processing: "En préparation",
  shipped: "Expédiée",
  delivered: "Livrée",
  cancelled: "Annulée",
  refused: "Refusée",
  returned: "Retournée",
};

/** Ordre d’affichage dans les tableaux et les filtres. */
export const ORDER_STATUS_ORDER: OrderStatus[] = [
  "new",
  "ai_qualified",
  "pending_confirmation",
  "confirmed",
  "processing",
  "shipped",
  "delivered",
  "returned",
  "refused",
  "cancelled",
];

const TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  new: [
    "ai_qualified",
    "pending_confirmation",
    "confirmed",
    "cancelled",
    "refused",
  ],
  ai_qualified: ["pending_confirmation", "confirmed", "cancelled", "refused"],
  pending_confirmation: ["confirmed", "refused", "cancelled"],
  confirmed: ["processing", "shipped", "cancelled", "refused"],
  processing: ["shipped", "cancelled"],
  shipped: ["delivered", "returned", "cancelled"],
  delivered: ["returned"],
  cancelled: [],
  refused: [],
  returned: [],
};

/** Statuts qui comptent dans le chiffre d’affaires confirmé. */
export const REVENUE_STATUSES: OrderStatus[] = [
  "confirmed",
  "processing",
  "shipped",
  "delivered",
];

/** Statuts considérés comme perdus (taux de refus). */
export const LOST_STATUSES: OrderStatus[] = ["refused", "cancelled"];

/** Statuts terminaux. */
export const TERMINAL_STATUSES: OrderStatus[] = [
  "delivered",
  "cancelled",
  "refused",
  "returned",
];

export function isOrderStatus(value: unknown): value is OrderStatus {
  return (
    typeof value === "string" &&
    (ORDER_STATUSES as readonly string[]).includes(value)
  );
}

export function canTransition(
  from: OrderStatus,
  to: OrderStatus,
): boolean {
  if (from === to) return true;
  return TRANSITIONS[from]?.includes(to) ?? false;
}

export function allowedTransitions(from: OrderStatus): OrderStatus[] {
  return TRANSITIONS[from] ?? [];
}

export class InvalidOrderTransitionError extends Error {
  readonly status = 409;
  readonly code = "invalid_order_transition";
  constructor(from: OrderStatus, to: OrderStatus) {
    super(
      `Transition impossible : « ${ORDER_STATUS_LABELS_FR[from]} » vers « ${ORDER_STATUS_LABELS_FR[to]} ».`,
    );
    this.name = "InvalidOrderTransitionError";
  }
}

export function assertTransition(from: OrderStatus, to: OrderStatus): void {
  if (!canTransition(from, to)) {
    throw new InvalidOrderTransitionError(from, to);
  }
}

/** Référence de commande lisible : CL-YYMMDD-XXXX */
export function generateOrderReference(date = new Date()): string {
  const yy = String(date.getFullYear()).slice(2);
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `CL-${yy}${mm}${dd}-${rand}`;
}

export type OrderLine = {
  productId: string;
  name: string;
  variant?: string | null;
  quantity: number;
  /** Centimes MAD. */
  unitPrice: number;
  lineTotal: number;
};

export type OrderTotals = {
  subtotal: number;
  deliveryFee: number;
  discount: number;
  total: number;
  currency: "MAD";
};

/**
 * Calcul monétaire unique et déterministe.
 * Ni l’IA ni le client ne calculent un total : c’est toujours cette fonction.
 */
export function computeTotals(input: {
  lines: OrderLine[];
  deliveryFee: number;
  discount?: number;
}): OrderTotals {
  const subtotal = input.lines.reduce(
    (sum, line) => sum + Math.max(0, Math.round(line.lineTotal)),
    0,
  );
  const discount = Math.min(
    Math.max(0, Math.round(input.discount ?? 0)),
    subtotal,
  );
  const deliveryFee =
    subtotal - discount === 0 ? 0 : Math.max(0, Math.round(input.deliveryFee));

  return {
    subtotal,
    deliveryFee,
    discount,
    total: subtotal - discount + deliveryFee,
    currency: "MAD",
  };
}

/** Taux en pourcentage, arrondi à 1 décimale, sans division par zéro. */
export function safeRate(numerator: number, denominator: number): number {
  if (!denominator) return 0;
  return Math.round((numerator / denominator) * 1000) / 10;
}
