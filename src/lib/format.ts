/**
 * Libellés français centralisés (§29).
 * Aucune étiquette anglaise aléatoire dans l’interface : tout passe par ici.
 */
import type { OrderStatus } from "@/lib/orders/status";
import type { BadgeTone } from "@/components/ui";

export const ORDER_STATUS_FR: Record<OrderStatus, string> = {
  new: "Nouvelle",
  ai_qualified: "Qualifiée par l’IA",
  pending_confirmation: "À confirmer",
  confirmed: "Confirmée",
  processing: "En préparation",
  shipped: "Expédiée",
  delivered: "Livrée",
  cancelled: "Annulée",
  refused: "Refusée",
  returned: "Retournée",
};

export const ORDER_STATUS_TONE: Record<OrderStatus, BadgeTone> = {
  new: "neutral",
  ai_qualified: "info",
  pending_confirmation: "warning",
  confirmed: "positive",
  processing: "info",
  shipped: "info",
  delivered: "positive",
  cancelled: "neutral",
  refused: "negative",
  returned: "warning",
};

export const SUBSCRIPTION_STATUS_FR: Record<string, string> = {
  trialing: "Essai en cours",
  active: "Actif",
  past_due: "Retard de paiement",
  payment_failed: "Paiement échoué",
  cancelled: "Résilié",
  expired: "Expiré",
  suspended: "Suspendu",
};

export const SUBSCRIPTION_STATUS_TONE: Record<string, BadgeTone> = {
  trialing: "accent",
  active: "positive",
  past_due: "warning",
  payment_failed: "negative",
  cancelled: "neutral",
  expired: "neutral",
  suspended: "negative",
};

export const MERCHANT_STATUS_FR: Record<string, string> = {
  pending: "En attente",
  active: "Actif",
  suspended: "Suspendu",
  deactivated: "Désactivé",
};

export const CONVERSATION_STATUS_FR: Record<string, string> = {
  open: "Ouverte",
  pending: "En attente",
  resolved: "Résolue",
  archived: "Archivée",
};

export const HANDOFF_MODE_FR: Record<string, string> = {
  ai: "IA active",
  approval: "Validation requise",
  manual: "Mode manuel",
};

export const HANDOFF_MODE_DESCRIPTION_FR: Record<string, string> = {
  ai: "CLOSER répond automatiquement aux clients.",
  approval: "CLOSER prépare la réponse, vous validez avant l’envoi.",
  manual: "Vous répondez vous-même, CLOSER n’intervient pas.",
};

export const CHANNEL_FR: Record<string, string> = {
  web: "Chat web",
  whatsapp: "WhatsApp",
  instagram: "Instagram",
  facebook: "Facebook",
  sms: "SMS",
  email: "E-mail",
};

export const SENDER_FR: Record<string, string> = {
  customer: "Client",
  ai: "CLOSER",
  agent: "Conseiller",
  system: "Système",
};

export const PRODUCT_STATUS_FR: Record<string, string> = {
  active: "Actif",
  draft: "Brouillon",
  archived: "Archivé",
  out_of_stock: "Rupture de stock",
};

export const PRODUCT_STATUS_TONE: Record<string, BadgeTone> = {
  active: "positive",
  draft: "neutral",
  archived: "neutral",
  out_of_stock: "warning",
};

export const CUSTOMER_STATUS_FR: Record<string, string> = {
  new: "Nouveau",
  active: "Actif",
  vip: "VIP",
  inactive: "Inactif",
  blacklisted: "Bloqué",
};

export const PAYMENT_METHOD_FR: Record<string, string> = {
  cod: "Paiement à la livraison",
  card: "Carte bancaire",
  bank_transfer: "Virement bancaire",
  wallet: "Portefeuille électronique",
};

export const PAYMENT_STATUS_FR: Record<string, string> = {
  unpaid: "Non payée",
  pending: "En attente",
  paid: "Payée",
  partially_paid: "Partiellement payée",
  refunded: "Remboursée",
  failed: "Échouée",
};

export const ROLE_FR: Record<string, string> = {
  owner: "Propriétaire",
  admin: "Administrateur",
  agent: "Agent",
};

export const PLAN_FR: Record<string, string> = {
  starter: "Starter",
  pro: "Pro",
  business: "Business",
};

/** Formatage d’un numéro marocain : +212661234567 → 06 61 23 45 67 (§30). */
export function formatMoroccanPhone(phone: string | null | undefined): string {
  if (!phone) return "—";
  const digits = phone.replace(/\D/g, "");

  if (digits.startsWith("212") && digits.length === 12) {
    const local = `0${digits.slice(3)}`;
    return local.replace(/(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})/, "$1 $2 $3 $4 $5");
  }
  if (digits.length === 10) {
    return digits.replace(/(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})/, "$1 $2 $3 $4 $5");
  }
  return phone;
}

/** Initiales pour les avatars (sans photo). */
export function initials(name: string | null | undefined): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** Durée lisible en français : 90 → « 1 h 30 ». */
export function formatDurationMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours < 24) return rest === 0 ? `${hours} h` : `${hours} h ${String(rest).padStart(2, "0")}`;
  const days = Math.floor(hours / 24);
  const restHours = hours % 24;
  return restHours === 0 ? `${days} j` : `${days} j ${restHours} h`;
}

/** Secondes → durée lisible (délai de réponse moyen). */
export function formatSeconds(seconds: number | null): string {
  if (seconds === null) return "—";
  if (seconds < 60) return `${Math.round(seconds)} s`;
  return formatDurationMinutes(Math.round(seconds / 60));
}

/** Pourcentage avec une décimale, sans « NaN % ». */
export function formatRate(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return `${value.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} %`;
}

/** Nombre entier formaté à la française. */
export function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined) return "0";
  return value.toLocaleString("fr-FR");
}

/* ------------------------------------------------------------------ */
/* Dates, montants et forfaits                                         */
/* ------------------------------------------------------------------ */

/** Date lisible en français (fuseau de Casablanca par défaut). */
export function formatDate(value: Date | string | null | undefined): string {
  if (!value) return "—";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Africa/Casablanca",
  });
}

/** Date + heure lisibles en français. */
export function formatDateTime(value: Date | string | null | undefined): string {
  if (!value) return "—";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("fr-FR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Africa/Casablanca",
  });
}

/** Noms de forfaits affichés côté marchand (§19). */
export const PLAN_NAMES_FR: Record<string, string> = PLAN_FR;

export { formatMad } from "@/lib/subscriptions/plans";
