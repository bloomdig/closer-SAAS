import { requireMerchantPage } from "@/lib/auth/guards";
import { listPayments, listPlans, getSubscription, getUsage } from "@/lib/repositories";
import { getPaymentProvider, isPaymentsConfigured } from "@/lib/payments/provider";
import { DEFAULT_PLANS } from "@/lib/subscriptions/plans";
import { PageHeader } from "@/components/ui";
import { SubscriptionManager, type PlanOffer, type PaymentRow } from "@/components/subscription/SubscriptionManager";
import { formatDate, formatMad, PLAN_NAMES_FR } from "@/lib/format";
import { AlertTriangle, Check } from "lucide-react";

export const dynamic = "force-dynamic";

/** `plans.features` est stocké en jsonb : liste de clés ou objet booléen. */
function toFeatureMap(raw: unknown): PlanOffer["features"] {
  if (Array.isArray(raw)) {
    return Object.fromEntries(raw.map((key) => [String(key), true])) as PlanOffer["features"];
  }
  if (raw && typeof raw === "object") {
    return Object.fromEntries(
      Object.entries(raw as Record<string, unknown>).map(([key, value]) => [key, Boolean(value)]),
    ) as PlanOffer["features"];
  }
  return {};
}

/**
 * Abonnement (§18–§20, §42).
 * Les prix proviennent de la table `plans` (seed 99 / 249 / 499 MAD), jamais
 * du front-end. Tant qu’aucun prestataire marocain n’est branché, la page
 * affiche explicitement « Fournisseur de paiement non configuré » : aucun
 * paiement n’est simulé et aucune donnée bancaire n’est collectée.
 */
export default async function SubscriptionPage() {
  const authed = await requireMerchantPage();
  const merchantId = authed.session.merchantId;

  const [subscription, planRows, paymentRows, usageRows] = await Promise.all([
    getSubscription(merchantId),
    listPlans(),
    listPayments(merchantId, 12),
    getUsage(merchantId),
  ]);

  const aiConversationsUsed =
    usageRows.find((row) => row.metric === "ai_conversations")?.value ?? 0;

  const base = planRows.length
    ? planRows.map((plan) => ({
        slug: plan.slug,
        name: plan.name,
        priceMonthly: plan.priceMonthly,
        priceYearly: plan.priceYearly,
        currency: plan.currency,
        trialDays: plan.trialDays,
        limits: plan.limits as PlanOffer["limits"],
        features: toFeatureMap(plan.features as unknown),
        position: plan.position,
        isActive: plan.isActive,
      }))
    : DEFAULT_PLANS.map((plan) => ({
        slug: plan.slug,
        name: plan.name,
        priceMonthly: plan.priceMonthly,
        priceYearly: plan.priceYearly,
        currency: plan.currency,
        trialDays: plan.trialDays,
        limits: plan.limits as unknown as PlanOffer["limits"],
        features: toFeatureMap(plan.features),
        position: plan.position,
        isActive: true,
      }));

  const offers: PlanOffer[] = base
    .filter((plan) => plan.isActive)
    .sort((a, b) => a.position - b.position)
    .map((plan) => ({ ...plan, priceLabel: formatMad(plan.priceMonthly) }));

  const payments: PaymentRow[] = paymentRows.map((payment) => ({
    id: payment.id,
    amountLabel: formatMad(payment.amount),
    currency: payment.currency,
    status: payment.status,
    createdAtLabel: formatDate(payment.createdAt),
  }));

  const currentSlug = authed.merchant.subscriptionPlan;
  const current = offers.find((offer) => offer.slug === currentSlug);
  const trialsLeft = authed.access.trialDaysLeft;
  const isTrial = authed.merchant.status === "trial";
  const paymentsConfigured = isPaymentsConfigured();

  return (
    <div className="mx-auto max-w-[980px]">
      <PageHeader
        title="Abonnement"
        subtitle={
          current
            ? `Forfait ${PLAN_NAMES_FR[currentSlug] ?? current.name} — ${current.priceLabel} / mois.`
            : "Choisissez le forfait adapté à votre boutique."
        }
      />

      {/* État du compte */}
      <div className="mb-4 grid gap-2 sm:grid-cols-3">
        <div className="rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-surface)] px-3 py-2.5">
          <span className="meta-label">Statut du compte</span>
          <p className="mt-0.5 text-[var(--text-sm)] font-medium capitalize text-[var(--color-ink)]">
            {authed.merchant.status}
          </p>
        </div>
        <div className="rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-surface)] px-3 py-2.5">
          <span className="meta-label">Essai gratuit</span>
          <p className="mt-0.5 text-[var(--text-sm)] font-medium text-[var(--color-ink)]">
            {isTrial && trialsLeft !== null ? `${trialsLeft} jour(s) restant(s)` : "—"}
          </p>
        </div>
        <div className="rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-surface)] px-3 py-2.5">
          <span className="meta-label">Conversations IA du mois</span>
          <p className="mt-0.5 text-[var(--text-sm)] font-medium text-[var(--color-ink)]">
            {aiConversationsUsed} / {authed.access.limits.aiConversationsPerMonth ?? "∞"}
          </p>
        </div>
      </div>

      {/* Avertissement essai */}
      {isTrial && trialsLeft !== null && trialsLeft <= 3 ? (
        <div className="mb-4 flex items-start gap-2.5 rounded-[var(--radius-md)] border border-[#fde68a] bg-[var(--color-warning-soft)] px-3.5 py-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-warning)]" strokeWidth={1.8} />
          <div>
            <p className="text-[var(--text-sm)] font-medium text-[var(--color-warning)]">
              Votre essai se termine dans {trialsLeft} jour(s).
            </p>
            <p className="mt-0.5 text-[var(--text-sm)] text-[var(--color-ink-muted)]">
              Vos données sont conservées. À l’expiration, l’accès passe en lecture seule
              jusqu’à la souscription d’un forfait.
            </p>
          </div>
        </div>
      ) : null}

      {/* Fournisseur de paiement */}
      {!paymentsConfigured ? (
        <div className="mb-4 rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-surface)] px-3.5 py-3">
          <p className="text-[var(--text-sm)] font-medium text-[var(--color-ink)]">
            Fournisseur de paiement non configuré
          </p>
          <p className="mt-1 text-[var(--text-sm)] text-[var(--color-ink-muted)]">
            Le paiement en ligne n’est pas encore activé sur cette instance. CLOSER
            n’encaisse rien et ne simule aucun règlement. Pour activer la facturation,
            branchez un prestataire marocain (Payzone, NAPS ou équivalent) via les
            variables d’environnement — l’architecture d’abstraction est déjà en place
            (fournisseur actuel : <span className="font-medium">{getPaymentProvider().name}</span>).
          </p>
        </div>
      ) : null}

      <SubscriptionManager
        offers={offers}
        currentSlug={currentSlug}
        paymentsConfigured={paymentsConfigured}
        providerName={getPaymentProvider().name}
        payments={payments}
        canManage={authed.session.role === "owner"}
      />

      {/* Comparatif des limites */}
      <div className="mt-6 overflow-x-auto rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-surface)]">
        <table className="w-full min-w-[620px] text-[var(--text-sm)]">
          <thead>
            <tr className="border-b border-[var(--color-line)] bg-[var(--color-surface-sunken)] text-left">
              <th className="px-3.5 py-2.5 font-medium text-[var(--color-ink-muted)]">Limite</th>
              {offers.map((offer) => (
                <th key={offer.slug} className="px-3.5 py-2.5 font-medium text-[var(--color-ink)]">
                  {offer.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-line)]">
            {(
              [
                ["aiConversationsPerMonth", "Conversations IA / mois"],
                ["products", "Produits au catalogue"],
                ["teamMembers", "Membres d’équipe"],
                ["automations", "Automatisations actives"],
                ["aiDailyMessages", "Messages IA / jour"],
              ] as const
            ).map(([key, label]) => (
              <tr key={key}>
                <td className="px-3.5 py-2 text-[var(--color-ink-muted)]">{label}</td>
                {offers.map((offer) => {
                  const value = offer.limits[key];
                  return (
                    <td key={offer.slug} className="px-3.5 py-2 text-[var(--color-ink)]">
                      {value === null || value === undefined ? "Illimité" : value}
                    </td>
                  );
                })}
              </tr>
            ))}
            {(
              [
                ["instagram", "Canal Instagram"],
                ["analytics", "Statistiques avancées"],
                ["automations", "Automatisations"],
                ["team", "Équipe multi-utilisateurs"],
                ["prioritySupport", "Support prioritaire"],
              ] as const
            ).map(([key, label]) => (
              <tr key={key}>
                <td className="px-3.5 py-2 text-[var(--color-ink-muted)]">{label}</td>
                {offers.map((offer) => (
                  <td key={offer.slug} className="px-3.5 py-2">
                    {offer.features[key] ? (
                      <Check className="h-3.5 w-3.5 text-[var(--color-positive)]" strokeWidth={2.2} />
                    ) : (
                      <span className="text-[var(--color-ink-faint)]">—</span>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {subscription ? (
        <p className="meta-label mt-3">
          Abonnement enregistré : {subscription.plan} — statut {subscription.status}
          {subscription.currentPeriodEnd ? ` — période en cours jusqu’au ${formatDate(subscription.currentPeriodEnd)}` : ""}.
        </p>
      ) : null}
    </div>
  );
}
