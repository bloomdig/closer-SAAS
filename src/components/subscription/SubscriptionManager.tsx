"use client";

/**
 * Gestion de l’abonnement côté client (§18–§20, §42).
 * Le changement d’offre passe par POST /api/subscription qui ouvre une
 * session chez le fournisseur de paiement. Tant qu’aucun prestataire
 * marocain n’est branché, le serveur répond 503 et le message réel est
 * affiché — jamais de paiement simulé.
 */
import { useState } from "react";
import { Check, Loader2, Lock } from "lucide-react";
import { Badge, buttonClass } from "@/components/ui";
import { PLAN_NAMES_FR } from "@/lib/format";

export type PlanOffer = {
  slug: string;
  name: string;
  priceMonthly: number;
  priceYearly: number | null;
  priceLabel: string;
  currency: string;
  trialDays: number;
  limits: Record<string, number | null>;
  features: Record<string, boolean>;
  position: number;
  isActive: boolean;
};

export type PaymentRow = {
  id: string;
  amountLabel: string;
  currency: string;
  status: string;
  createdAtLabel: string;
};

export function SubscriptionManager({
  offers,
  currentSlug,
  paymentsConfigured,
  providerName,
  payments,
  canManage,
}: {
  offers: PlanOffer[];
  currentSlug: string;
  paymentsConfigured: boolean;
  providerName: string;
  payments: PaymentRow[];
  canManage: boolean;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const upgrade = async (slug: string) => {
    setBusy(slug);
    setError(null);
    try {
      const response = await fetch("/api/subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: slug }),
      });
      const json = (await response.json().catch(() => ({}))) as {
        error?: { message?: string };
        data?: { checkoutUrl?: string; message?: string };
      };
      if (!response.ok) throw new Error(json.error?.message ?? "Changement d’offre impossible.");

      if (json.data?.checkoutUrl) {
        window.location.assign(json.data.checkoutUrl);
        return;
      }
      setError(null);
      window.alert(json.data?.message ?? "Demande enregistrée. Notre équipe vous contactera pour finaliser.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Changement d’offre impossible.");
    } finally {
      setBusy(null);
    }
  };

  const limitLine = (value: number | null | undefined, unit: string) =>
    value === null || value === undefined ? `${unit} illimité` : `${value} ${unit}`;

  return (
    <div>
      <div className="grid gap-3 md:grid-cols-3">
        {offers.map((offer) => {
          const isCurrent = offer.slug === currentSlug;
          const isUpgrade = offer.position > (offers.find((item) => item.slug === currentSlug)?.position ?? 0);
          const highlighted = offer.slug === "pro";

          return (
            <div
              key={offer.slug}
              className={`relative flex flex-col rounded-[var(--radius-lg)] border bg-[var(--color-surface)] p-4 ${
                highlighted
                  ? "border-[var(--color-accent)] shadow-[var(--shadow-sm)]"
                  : "border-[var(--color-line)]"
              }`}
            >
              {highlighted ? (
                <span className="absolute -top-2.5 left-4 rounded-full bg-[var(--color-accent)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-white">
                  Recommandé
                </span>
              ) : null}

              <div className="flex items-center justify-between">
                <h3 className="text-[var(--text-base)] font-semibold text-[var(--color-ink)]">
                  {offer.name}
                </h3>
                {isCurrent ? <Badge tone="positive">Forfait actuel</Badge> : null}
              </div>

              <p className="mt-2">
                <span className="text-[22px] font-semibold tracking-[-0.01em] text-[var(--color-ink)]">
                  {offer.priceLabel}
                </span>
                <span className="ml-1 text-[var(--text-sm)] text-[var(--color-ink-muted)]">/ mois</span>
              </p>
              {offer.trialDays > 0 ? (
                <p className="meta-label mt-0.5">{offer.trialDays} jours d’essai gratuit</p>
              ) : null}

              <ul className="mt-3 flex-1 space-y-1.5 border-t border-[var(--color-line)] pt-3 text-[var(--text-sm)] text-[var(--color-ink-secondary)]">
                <li className="flex items-start gap-1.5">
                  <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--color-positive)]" strokeWidth={2.2} />
                  {limitLine(offer.limits.aiConversationsPerMonth, "conversations IA")} / mois
                </li>
                <li className="flex items-start gap-1.5">
                  <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--color-positive)]" strokeWidth={2.2} />
                  {limitLine(offer.limits.products, "produits")} au catalogue
                </li>
                <li className="flex items-start gap-1.5">
                  <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--color-positive)]" strokeWidth={2.2} />
                  {limitLine(offer.limits.teamMembers, "membres")} d’équipe
                </li>
                <li className="flex items-start gap-1.5">
                  <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--color-positive)]" strokeWidth={2.2} />
                  {offer.features.instagram ? "WhatsApp + Instagram" : "WhatsApp uniquement"}
                </li>
                {offer.features.analytics ? (
                  <li className="flex items-start gap-1.5">
                    <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--color-positive)]" strokeWidth={2.2} />
                    Statistiques avancées
                  </li>
                ) : null}
                {offer.features.prioritySupport ? (
                  <li className="flex items-start gap-1.5">
                    <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--color-positive)]" strokeWidth={2.2} />
                    Support prioritaire
                  </li>
                ) : null}
              </ul>

              <div className="mt-4">
                {isCurrent ? (
                  <button type="button" disabled className={`${buttonClass("secondary", "md")} w-full opacity-60`}>
                    Forfait en cours
                  </button>
                ) : canManage ? (
                  <button
                    type="button"
                    onClick={() => void upgrade(offer.slug)}
                    disabled={busy !== null || !paymentsConfigured}
                    className={`${buttonClass(highlighted || isUpgrade ? "primary" : "secondary", "md")} w-full cursor-pointer`}
                    title={
                      paymentsConfigured
                        ? undefined
                        : "Paiement en ligne non activé sur cette instance"
                    }
                  >
                    {busy === offer.slug ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                    {isUpgrade ? `Passer à ${offer.name}` : `Choisir ${offer.name}`}
                  </button>
                ) : (
                  <p className="meta-label text-center">
                    Seul le propriétaire peut changer de forfait.
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {!paymentsConfigured ? (
        <p className="mt-3 flex items-start gap-2 rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-surface-sunken)] px-3 py-2.5 text-[var(--text-sm)] text-[var(--color-ink-muted)]">
          <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={1.8} />
          Le paiement en ligne est désactivé : fournisseur actuel « {providerName} » non
          configuré. Aucun prélèvement n’est effectué et aucune donnée bancaire n’est
          collectée. Contactez l’équipe CLOSER pour activer votre forfait.
        </p>
      ) : null}

      {error ? (
        <p className="mt-3 rounded-[var(--radius-md)] border border-[#fecaca] bg-[var(--color-negative-soft)] px-3 py-2 text-[var(--text-sm)] text-[var(--color-negative)]">
          {error}
        </p>
      ) : null}

      {/* Historique de paiement — réel, jamais inventé */}
      <div className="mt-6">
        <h3 className="mb-2 text-[var(--text-sm)] font-semibold text-[var(--color-ink)]">
          Historique des paiements
        </h3>
        {payments.length === 0 ? (
          <p className="rounded-[var(--radius-md)] border border-dashed border-[var(--color-line-strong)] px-3 py-4 text-center text-[var(--text-sm)] text-[var(--color-ink-muted)]">
            Aucun paiement enregistré.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-surface)]">
            <table className="w-full min-w-[420px] text-[var(--text-sm)]">
              <thead>
                <tr className="border-b border-[var(--color-line)] bg-[var(--color-surface-sunken)] text-left">
                  <th className="px-3.5 py-2 font-medium text-[var(--color-ink-muted)]">Date</th>
                  <th className="px-3.5 py-2 font-medium text-[var(--color-ink-muted)]">Montant</th>
                  <th className="px-3.5 py-2 font-medium text-[var(--color-ink-muted)]">Statut</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-line)]">
                {payments.map((payment) => (
                  <tr key={payment.id}>
                    <td className="px-3.5 py-2 text-[var(--color-ink-secondary)]">{payment.createdAtLabel}</td>
                    <td className="px-3.5 py-2 font-medium text-[var(--color-ink)]">{payment.amountLabel}</td>
                    <td className="px-3.5 py-2">
                      <Badge tone={payment.status === "succeeded" ? "positive" : payment.status === "failed" ? "negative" : "neutral"}>
                        {payment.status}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="meta-label mt-4">
        Forfaits affichés : {offers.map((offer) => `${PLAN_NAMES_FR[offer.slug] ?? offer.name} (${offer.priceLabel})`).join(" · ")}.
        Prix HT en dirhams, mis à jour depuis la base de données.
      </p>
    </div>
  );
}
