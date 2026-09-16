/**
 * Outils / actions de l’agent de vente (function calling Gemini).
 * =====================================================================
 * Le modèle ne touche JAMAIS la base de données directement.
 * Chaque appel d’outil est :
 *   1. validé (schéma + limites),
 *   2. exécuté côté serveur avec un périmètre marchand strict,
 *   3. journalisé (messages.tool_calls).
 * Un échec de validation renvoie une erreur structurée au modèle, jamais une
 * exception brute.
 */

export const AI_TOOLS = [
  {
    name: "search_products",
    description:
      "Recherche des produits du catalogue du marchand par mots-clés (français, darija, arabe), catégorie, prix max ou disponibilité. À utiliser dès qu’un client demande si un article existe.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "Mots-clés du client" },
        category: { type: "string" },
        maxPrice: { type: "number", description: "Prix maximum en MAD" },
        inStockOnly: { type: "boolean" },
        limit: { type: "number", description: "5 par défaut, 20 maximum" },
      },
      required: [],
    },
  },
  {
    name: "get_product_details",
    description:
      "Récupère la fiche complète d’un produit : prix réel, stock, variantes, tailles, couleurs, description.",
    parameters: {
      type: "object",
      properties: { productId: { type: "string" } },
      required: ["productId"],
    },
  },
  {
    name: "check_product_stock",
    description:
      "Vérifie la disponibilité d’un produit et, si pertinent, d’une variante (taille/couleur).",
    parameters: {
      type: "object",
      properties: {
        productId: { type: "string" },
        size: { type: "string" },
        color: { type: "string" },
        quantity: { type: "number", description: "1 par défaut" },
      },
      required: ["productId"],
    },
  },
  {
    name: "calculate_order_total",
    description:
      "Calcule le total exact : sous-total, frais de livraison selon la ville, remise, total TTC. OBLIGATOIRE avant de présenter un récapitulatif. Ne jamais calculer le total soi-même.",
    parameters: {
      type: "object",
      properties: {
        items: {
          type: "array",
          items: {
            type: "object",
            properties: {
              productId: { type: "string" },
              quantity: { type: "number" },
              variant: { type: "string" },
            },
            required: ["productId", "quantity"],
          },
        },
        city: { type: "string", description: "Ville de livraison" },
        promoCode: { type: "string" },
      },
      required: ["items"],
    },
  },
  {
    name: "create_customer",
    description:
      "Crée ou retrouve un client (par téléphone) avec nom, téléphone, ville, adresse.",
    parameters: {
      type: "object",
      properties: {
        name: { type: "string" },
        phone: { type: "string", description: "Format marocain, ex. 0612345678" },
        city: { type: "string" },
        address: { type: "string" },
        notes: { type: "string" },
      },
      required: ["phone"],
    },
  },
  {
    name: "update_customer",
    description: "Met à jour les informations d’un client existant.",
    parameters: {
      type: "object",
      properties: {
        customerId: { type: "string" },
        name: { type: "string" },
        phone: { type: "string" },
        city: { type: "string" },
        address: { type: "string" },
        notes: { type: "string" },
      },
      required: ["customerId"],
    },
  },
  {
    name: "create_order",
    description:
      "Crée la commande réelle en base (paiement à la livraison par défaut). À n’appeler QU’APRÈS une confirmation explicite du client sur le récapitulatif.",
    parameters: {
      type: "object",
      properties: {
        customerId: { type: "string" },
        customerName: { type: "string" },
        customerPhone: { type: "string" },
        city: { type: "string" },
        address: { type: "string" },
        items: {
          type: "array",
          items: {
            type: "object",
            properties: {
              productId: { type: "string" },
              quantity: { type: "number" },
              variant: { type: "string" },
            },
            required: ["productId", "quantity"],
          },
        },
        notes: { type: "string" },
        paymentMethod: {
          type: "string",
          enum: ["cod", "card", "bank_transfer", "wallet"],
        },
      },
      required: ["customerName", "customerPhone", "city", "address", "items"],
    },
  },
  {
    name: "update_order",
    description:
      "Modifie une commande créée dans cette conversation (article, quantité, adresse, notes).",
    parameters: {
      type: "object",
      properties: {
        orderId: { type: "string" },
        city: { type: "string" },
        address: { type: "string" },
        notes: { type: "string" },
        customerPhone: { type: "string" },
      },
      required: ["orderId"],
    },
  },
  {
    name: "confirm_order",
    description:
      "Passe une commande en « en attente de confirmation » ou « confirmée » après validation explicite du client.",
    parameters: {
      type: "object",
      properties: {
        orderId: { type: "string" },
        status: {
          type: "string",
          enum: ["pending_confirmation", "confirmed"],
        },
      },
      required: ["orderId", "status"],
    },
  },
  {
    name: "request_human_agent",
    description:
      "Bascule la conversation en mode manuel et alerte le marchand. À utiliser pour : réclamation, retour, litige, client mécontent, information manquante, gros montant, demande explicite d’un humain.",
    parameters: {
      type: "object",
      properties: {
        reason: { type: "string", description: "Raison courte affichée au marchand" },
        urgent: { type: "boolean" },
      },
      required: ["reason"],
    },
  },
] as const;

export type AiToolName = (typeof AI_TOOLS)[number]["name"];

/** Limites dures appliquées côté serveur, quoi que demande le modèle. */
export const TOOL_LIMITS = {
  maxSearchResults: 20,
  maxOrderItems: 20,
  maxQuantityPerItem: 100,
  maxOrderTotalCents: 5_000_000, // 50 000 DH → au-delà, humain requis
  maxToolCallsPerTurn: 6,
  maxCustomerNameLength: 160,
  maxNoteLength: 500,
} as const;

export type ToolExecutionResult = {
  ok: boolean;
  /** Résultat renvoyé au modèle (JSON-sérialisable, sans secret). */
  data?: unknown;
  /** Message d’erreur compréhensible par le modèle pour qu’il se corrige. */
  error?: string;
  /** Effet de bord à appliquer après génération (ex. passer en mode manuel). */
  sideEffects?: {
    setHandoffMode?: "manual" | "approval";
    flagForHumanReview?: boolean;
    reviewReason?: string;
    createdOrderId?: string;
  };
};

/**
 * Interface de l’exécuteur. L’implémentation réelle vit dans
 * `src/lib/ai/tool-executor.ts` et reçoit le `merchantId` depuis la session
 * serveur — jamais depuis la sortie du modèle.
 */
export type ToolExecutionContext = {
  merchantId: string;
  conversationId: string;
  customerId: string | null;
  locale: string;
};

export type ToolExecutor = (
  name: string,
  args: Record<string, unknown>,
  ctx: ToolExecutionContext,
) => Promise<ToolExecutionResult>;

/* ----------------------------- validation ----------------------------- */

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function asString(
  value: unknown,
  field: string,
  maxLength = 500,
): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  return trimmed.slice(0, maxLength);
}

export function asInt(
  value: unknown,
  field: string,
  min: number,
  max: number,
): number | null {
  const n = typeof value === "string" ? Number(value) : value;
  if (typeof n !== "number" || !Number.isFinite(n)) return null;
  const i = Math.trunc(n);
  if (i < min || i > max) return null;
  return i;
}

/**
 * Normalise un numéro de téléphone marocain en E.164.
 * Accepte 06/07xxxxxxxx, +2126xxxxxxxx, 002126xxxxxxxx, avec espaces/tirets.
 */
export function normalizeMoroccanPhone(input: unknown): string | null {
  const raw = asString(input, "phone", 32);
  if (!raw) return null;

  const digits = raw.replace(/[^\d+]/g, "");
  let normalized = digits.startsWith("+") ? digits.slice(1) : digits;

  if (normalized.startsWith("00212")) normalized = `212${normalized.slice(5)}`;
  else if (normalized.startsWith("212")) normalized = normalized;
  else if (normalized.startsWith("0") && normalized.length === 10)
    normalized = `212${normalized.slice(1)}`;
  else if (/^[5-7]\d{8}$/.test(normalized)) normalized = `212${normalized}`;

  if (!/^212[5-7]\d{8}$/.test(normalized)) return null;
  return `+${normalized}`;
}

/** Villes marocaines principales — pour valider/corriger la saisie. */
export const MOROCCAN_CITIES = [
  "Casablanca",
  "Rabat",
  "Salé",
  "Marrakech",
  "Fès",
  "Tanger",
  "Agadir",
  "Meknès",
  "Oujda",
  "Kénitra",
  "Tétouan",
  "Safi",
  "Mohammedia",
  "El Jadida",
  "Béni Mellal",
  "Nador",
  "Laâyoune",
  "Dakhla",
  "Khouribga",
  "Settat",
  "Berrechid",
  "Temara",
  "Inezgane",
  "Ksar El Kébir",
  "Larache",
  "Guelmim",
  "Errachidia",
  "Ouarzazate",
  "Essaouira",
  "Ifrane",
  "Azrou",
  "Taza",
  "Al Hoceïma",
] as const;

export function matchMoroccanCity(input: unknown): string | null {
  const raw = asString(input, "city", 120);
  if (!raw) return null;

  const target = raw
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z ]/g, "")
    .trim();

  for (const city of MOROCCAN_CITIES) {
    const candidate = city
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z ]/g, "")
      .trim();
    if (candidate === target || target.startsWith(candidate)) return city;
  }

  // Ville inconnue : on garde la saisie (le marchand a pu configurer d’autres zones).
  return raw;
}

export function isKnownTool(name: unknown): name is AiToolName {
  return (
    typeof name === "string" &&
    (AI_TOOLS as readonly { name: string }[]).some((t) => t.name === name)
  );
}
