/**
 * Abstraction paiement — Maroc.
 * =====================================================================
 *  - PAS de Stripe. Aucune dépendance, aucun identifiant Stripe.
 *  - Le fournisseur final (Payzone, NAPS, autre prestataire agréé marocain)
 *    est sélectionné puis configuré séparément.
 *  - Sans identifiants configurés : `getPaymentProvider()` renvoie
 *    `NotConfiguredPaymentProvider` → l’UI affiche
 *    « Fournisseur de paiement non configuré ». Aucun paiement simulé.
 *  - Aucune donnée de carte (PAN, CVV, credentials bancaires) n’est stockée
 *    dans la base CLOSER : seule la référence fournisseur est conservée.
 *
 * Séparation des responsabilités :
 *   1. PaymentProvider      → échange technique avec la passerelle
 *   2. subscriptions/       → cycle de vie de l’abonnement (états, périodes)
 *   3. schema.subscriptions → état de facturation du compte marchand
 *   4. access.ts            → ce que le compte a le droit de faire
 */

export type BillingInterval = "month" | "year";

export type CheckoutSessionInput = {
  merchantId: string;
  subscriptionId: string;
  plan: string;
  /** Montant en centimes MAD. */
  amount: number;
  currency: string;
  interval: BillingInterval;
  customerEmail: string;
  customerName?: string | null;
  successUrl: string;
  cancelUrl: string;
  /** Référence interne idempotente. */
  reference: string;
};

export type CheckoutSession = {
  id: string;
  url: string;
  provider: string;
  expiresAt?: string;
};

export type WebhookEventKind =
  | "checkout.completed"
  | "payment.succeeded"
  | "payment.failed"
  | "subscription.created"
  | "subscription.renewed"
  | "subscription.cancelled"
  | "subscription.paused"
  | "subscription.resumed"
  | "refund.created"
  | "unknown";

export type NormalizedWebhookEvent = {
  kind: WebhookEventKind;
  provider: string;
  eventId: string;
  /** Identifiant fournisseur de l’abonnement. */
  providerSubscriptionId?: string | null;
  /** Identifiant fournisseur du client. */
  providerCustomerId?: string | null;
  /** Identifiant fournisseur du paiement. */
  providerPaymentId?: string | null;
  /** Nos références internes (renvoyées en `metadata` / `reference`). */
  merchantId?: string | null;
  subscriptionId?: string | null;
  amount?: number | null;
  currency?: string | null;
  status?: string | null;
  failureCode?: string | null;
  failureReason?: string | null;
  periodStart?: string | null;
  periodEnd?: string | null;
  invoiceUrl?: string | null;
  receivedAt: string;
  raw: unknown;
};

export type CancelResult = {
  cancelledAtPeriodEnd: boolean;
  effectiveAt?: string | null;
};

export type ProviderStatus = {
  configured: boolean;
  provider: string;
  mode: "test" | "live" | "none";
  missing: string[];
};

export interface PaymentProvider {
  readonly name: string;
  /** Le fournisseur est-il réellement configuré ? Jamais simulé. */
  getStatus(): ProviderStatus;
  /** Crée une page de paiement hébergée par le fournisseur. */
  createCheckout(input: CheckoutSessionInput): Promise<CheckoutSession>;
  /** Vérifie la signature du webhook ET normalise l’événement. */
  verifyWebhook(
    rawBody: string,
    signature: string | null,
  ): Promise<NormalizedWebhookEvent>;
  cancelSubscription(
    providerSubscriptionId: string,
    atPeriodEnd: boolean,
  ): Promise<CancelResult>;
  reactivateSubscription?(
    providerSubscriptionId: string,
  ): Promise<{ reactivated: boolean }>;
  /** Relance un paiement échoué, si le fournisseur le permet. */
  retryPayment?(providerPaymentId: string): Promise<{ retried: boolean }>;
  /** Récupère l’état d’un abonnement (synchronisation / rattrapage). */
  retrieveSubscription?(
    providerSubscriptionId: string,
  ): Promise<{ status: string; periodEnd?: string | null }>;
}

export class PaymentNotConfiguredError extends Error {
  readonly status = 503;
  readonly code = "payment_provider_not_configured";
  constructor(
    message = "Fournisseur de paiement non configuré.",
  ) {
    super(message);
    this.name = "PaymentNotConfiguredError";
  }
}

/**
 * Implémentation par défaut : le système de facturation est complet côté
 * CLOSER (abonnements, essais, états, accès), mais aucune passerelle n’est
 * branchée. Rien n’est feint : chaque opération renvoie une erreur explicite.
 */
export class NotConfiguredPaymentProvider implements PaymentProvider {
  readonly name = "none";

  getStatus(): ProviderStatus {
    return {
      configured: false,
      provider: "none",
      mode: "none",
      missing: ["PAYMENT_PROVIDER", "PAYMENT_PROVIDER_KEY", "PAYMENT_WEBHOOK_SECRET"],
    };
  }

  async createCheckout(): Promise<CheckoutSession> {
    throw new PaymentNotConfiguredError(
      "Le paiement en ligne n’est pas encore activé. Contactez l’équipe CLOSER " +
        "ou réglez votre abonnement par virement bancaire.",
    );
  }

  async verifyWebhook(): Promise<NormalizedWebhookEvent> {
    throw new PaymentNotConfiguredError(
      "Aucun fournisseur de paiement configuré : webhook refusé.",
    );
  }

  async cancelSubscription(): Promise<CancelResult> {
    throw new PaymentNotConfiguredError();
  }
}

let providerInstance: PaymentProvider | null = null;

/**
 * Fabrique du fournisseur. Ajoutez ici le branchement réel :
 *
 *   case "payzone": return new PayzoneProvider({...});
 *   case "naps":    return new NapsProvider({...});
 *
 * L’implémentation du fournisseur doit vivre dans `providers/<nom>.ts` et
 * respecter exactement l’interface ci-dessus — le reste de l’application
 * n’a pas à être modifié.
 */
export function getPaymentProvider(): PaymentProvider {
  if (providerInstance) return providerInstance;

  const name = (process.env.PAYMENT_PROVIDER ?? "none").trim().toLowerCase();

  switch (name) {
    case "payzone":
    case "naps":
      // Branchement à activer une fois les identifiants marchand obtenus.
      // Tant que ce n’est pas fait, on tombe volontairement dans `default`
      // pour ne jamais prétendre qu’un paiement est possible.
      providerInstance = new NotConfiguredPaymentProvider();
      break;
    default:
      providerInstance = new NotConfiguredPaymentProvider();
  }

  return providerInstance;
}

/** Utile pour les tests. */
export function __resetPaymentProvider(): void {
  providerInstance = null;
}

export function isPaymentsConfigured(): boolean {
  return getPaymentProvider().getStatus().configured;
}
