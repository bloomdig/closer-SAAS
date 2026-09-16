"use client";

/**
 * Tableau de bord de l’administration plateforme (§22).
 * Marchands réels issus de la base : suspension, réactivation, extension
 * d’essai, changement de forfait — chaque action appelle l’API admin et
 * journalise l’opération.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Search } from "lucide-react";
import { Badge, Panel, PanelHeader, buttonClass } from "@/components/ui";
import { formatDate } from "@/lib/format";

export type AdminMerchantRow = {
  id: string;
  name: string;
  businessName: string | null;
  email: string;
  status: string;
  subscriptionPlan: string;
  subscriptionStatus: string;
  trialEndsAt: string | null;
  isDemo: boolean;
  createdAt: string;
  conversationCount: number;
  orderCount: number;
  productCount: number;
};

export type AdminPlanRow = {
  slug: string;
  name: string;
  priceMonthly: number;
  priceYearly: number | null;
  trialDays: number;
  isActive: boolean;
  position: number;
};

const STATUS_TONES: Record<string, "positive" | "warning" | "negative" | "neutral"> = {
  active: "positive",
  trial: "warning",
  suspended: "negative",
  pending: "neutral",
  churned: "neutral",
};

export function AdminDashboard({
  merchants: initialMerchants,
  plans: initialPlans,
  adminName,
}: {
  merchants: AdminMerchantRow[];
  plans: AdminPlanRow[];
  adminName: string;
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [planDrafts, setPlanDrafts] = useState<Record<string, { priceMonthly: string; trialDays: string; isActive: boolean }>>(
    Object.fromEntries(
      initialPlans.map((plan) => [
        plan.slug,
        {
          priceMonthly: (plan.priceMonthly / 100).toFixed(0),
          trialDays: String(plan.trialDays),
          isActive: plan.isActive,
        },
      ]),
    ),
  );
  const [savingPlan, setSavingPlan] = useState<string | null>(null);

  const act = async (merchant: AdminMerchantRow, action: string, extra?: Record<string, unknown>) => {
    setBusyId(merchant.id);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch(`/api/admin/merchants/${merchant.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...extra }),
      });
      const json = (await response.json().catch(() => ({}))) as { error?: { message?: string } };
      if (!response.ok) throw new Error(json.error?.message ?? "Action impossible.");
      setNotice(`${merchant.businessName ?? merchant.name} : ${action.replace("_", " ")} effectué.`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action impossible.");
    } finally {
      setBusyId(null);
    }
  };

  const savePlan = async (slug: string) => {
    const draft = planDrafts[slug];
    setSavingPlan(slug);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch("/api/admin/plans", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug,
          priceMonthly: Number(draft.priceMonthly),
          trialDays: Number(draft.trialDays),
          isActive: draft.isActive,
        }),
      });
      const json = (await response.json().catch(() => ({}))) as { error?: { message?: string } };
      if (!response.ok) throw new Error(json.error?.message ?? "Enregistrement impossible.");
      setNotice(`Forfait ${slug} mis à jour.`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Enregistrement impossible.");
    } finally {
      setSavingPlan(null);
    }
  };

  const filtered = initialMerchants.filter((merchant) => {
    if (!search.trim()) return true;
    const needle = search.trim().toLowerCase();
    return (
      merchant.businessName?.toLowerCase().includes(needle) ||
      merchant.email.toLowerCase().includes(needle) ||
      merchant.name.toLowerCase().includes(needle)
    );
  });

  return (
    <div className="min-h-dvh bg-[var(--color-surface-sunken)]">
      <header className="sticky top-0 z-20 border-b border-[var(--color-line)] bg-[var(--color-surface)]">
        <div className="mx-auto flex h-14 max-w-[1200px] items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-2.5">
            <span className="text-[var(--text-base)] font-semibold tracking-[-0.01em] text-[var(--color-ink)]">
              CLOSER
            </span>
            <Badge tone="neutral">Administration plateforme</Badge>
          </div>
          <span className="meta-label">{adminName}</span>
        </div>
      </header>

      <main className="mx-auto max-w-[1200px] px-4 py-6 sm:px-6">
        {error ? (
          <p className="mb-4 rounded-[var(--radius-md)] border border-[#fecaca] bg-[var(--color-negative-soft)] px-3 py-2 text-[var(--text-sm)] text-[var(--color-negative)]">
            {error}
          </p>
        ) : null}
        {notice ? (
          <p className="mb-4 rounded-[var(--radius-md)] border border-[#bbf7d0] bg-[var(--color-positive-soft)] px-3 py-2 text-[var(--text-sm)] text-[var(--color-positive)]">
            {notice}
          </p>
        ) : null}

        <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
          {/* Marchands */}
          <div>
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="text-[var(--text-base)] font-semibold text-[var(--color-ink)]">
                Marchands ({filtered.length})
              </h2>
              <div className="relative w-full max-w-[260px]">
                <Search
                  className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--color-ink-faint)]"
                  strokeWidth={1.8}
                />
                <input
                  className="field pl-8"
                  placeholder="Rechercher…"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  aria-label="Rechercher un marchand"
                />
              </div>
            </div>

            <Panel>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-[var(--text-sm)]">
                  <thead>
                    <tr className="border-b border-[var(--color-line)] bg-[var(--color-surface-sunken)] text-left">
                      <th className="px-3.5 py-2 font-medium text-[var(--color-ink-muted)]">Boutique</th>
                      <th className="px-3.5 py-2 font-medium text-[var(--color-ink-muted)]">Statut</th>
                      <th className="px-3.5 py-2 font-medium text-[var(--color-ink-muted)]">Forfait</th>
                      <th className="px-3.5 py-2 font-medium text-[var(--color-ink-muted)]">Usage</th>
                      <th className="px-3.5 py-2 font-medium text-[var(--color-ink-muted)]">Inscrit le</th>
                      <th className="px-3.5 py-2 text-right font-medium text-[var(--color-ink-muted)]">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--color-line)]">
                    {filtered.map((merchant) => (
                      <tr key={merchant.id} className="transition hover:bg-[var(--color-surface-sunken)]">
                        <td className="px-3.5 py-2.5">
                          <p className="font-medium text-[var(--color-ink)]">
                            {merchant.businessName ?? merchant.name}
                            {merchant.isDemo ? <Badge tone="neutral" className="ml-1.5">démo</Badge> : null}
                          </p>
                          <p className="meta-label">{merchant.email}</p>
                        </td>
                        <td className="px-3.5 py-2.5">
                          <Badge tone={STATUS_TONES[merchant.status] ?? "neutral"} dot>
                            {merchant.status}
                          </Badge>
                          {merchant.trialEndsAt ? (
                            <p className="meta-label mt-1">Essai : {formatDate(new Date(merchant.trialEndsAt))}</p>
                          ) : null}
                        </td>
                        <td className="px-3.5 py-2.5 capitalize text-[var(--color-ink-secondary)]">
                          {merchant.subscriptionPlan}
                          <p className="meta-label">{merchant.subscriptionStatus}</p>
                        </td>
                        <td className="px-3.5 py-2.5 text-[var(--color-ink-secondary)]">
                          {merchant.conversationCount} conv. · {merchant.orderCount} cmd · {merchant.productCount} prod.
                        </td>
                        <td className="px-3.5 py-2.5 text-[var(--color-ink-muted)]">
                          {formatDate(new Date(merchant.createdAt))}
                        </td>
                        <td className="px-3.5 py-2.5">
                          <div className="flex justify-end gap-1.5">
                            {merchant.status === "suspended" ? (
                              <button
                                type="button"
                                disabled={busyId === merchant.id}
                                onClick={() => void act(merchant, "reactivate")}
                                className={`${buttonClass("secondary", "sm")} cursor-pointer`}
                              >
                                {busyId === merchant.id ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                                Réactiver
                              </button>
                            ) : (
                              <button
                                type="button"
                                disabled={busyId === merchant.id}
                                onClick={() => {
                                  if (window.confirm(`Suspendre ${merchant.businessName ?? merchant.name} ? L’accès sera coupé immédiatement.`)) {
                                    void act(merchant, "suspend");
                                  }
                                }}
                                className={`${buttonClass("danger", "sm")} cursor-pointer`}
                              >
                                {busyId === merchant.id ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                                Suspendre
                              </button>
                            )}
                            <button
                              type="button"
                              disabled={busyId === merchant.id}
                              onClick={() => {
                                const days = window.prompt("Prolonger l’essai de combien de jours ?", "7");
                                if (days) void act(merchant, "extend_trial", { trialDays: Number(days) });
                              }}
                              className={`${buttonClass("ghost", "sm")} cursor-pointer`}
                            >
                              + Essai
                            </button>
                            <select
                              className="field h-7 w-auto px-2 text-[var(--text-xs)]"
                              value={merchant.subscriptionPlan}
                              disabled={busyId === merchant.id}
                              onChange={(event) =>
                                void act(merchant, "change_plan", { plan: event.target.value })
                              }
                              aria-label={`Forfait de ${merchant.businessName ?? merchant.name}`}
                            >
                              <option value="starter">starter</option>
                              <option value="pro">pro</option>
                              <option value="business">business</option>
                            </select>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {filtered.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-3.5 py-8 text-center text-[var(--text-sm)] text-[var(--color-ink-muted)]">
                          Aucun marchand trouvé.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </Panel>
          </div>

          {/* Forfaits */}
          <div>
            <h2 className="mb-3 text-[var(--text-base)] font-semibold text-[var(--color-ink)]">Forfaits</h2>
            <div className="space-y-3">
              {initialPlans.map((plan) => {
                const draft = planDrafts[plan.slug];
                return (
                  <Panel key={plan.slug}>
                    <PanelHeader title={`${plan.name} (${plan.slug})`} />
                    <div className="space-y-3 px-4 py-3.5">
                      <div>
                        <label className="field-label" htmlFor={`plan-price-${plan.slug}`}>
                          Prix mensuel (MAD)
                        </label>
                        <input
                          id={`plan-price-${plan.slug}`}
                          type="number"
                          min={0}
                          className="field"
                          value={draft.priceMonthly}
                          onChange={(event) =>
                            setPlanDrafts({
                              ...planDrafts,
                              [plan.slug]: { ...draft, priceMonthly: event.target.value },
                            })
                          }
                        />
                      </div>
                      <div>
                        <label className="field-label" htmlFor={`plan-trial-${plan.slug}`}>
                          Essai (jours)
                        </label>
                        <input
                          id={`plan-trial-${plan.slug}`}
                          type="number"
                          min={0}
                          max={90}
                          className="field"
                          value={draft.trialDays}
                          onChange={(event) =>
                            setPlanDrafts({
                              ...planDrafts,
                              [plan.slug]: { ...draft, trialDays: event.target.value },
                            })
                          }
                        />
                      </div>
                      <label className="toggle-label">
                        <input
                          type="checkbox"
                          checked={draft.isActive}
                          onChange={(event) =>
                            setPlanDrafts({
                              ...planDrafts,
                              [plan.slug]: { ...draft, isActive: event.target.checked },
                            })
                          }
                        />
                        <span className="toggle-track" aria-hidden="true">
                          <span className="toggle-thumb" />
                        </span>
                        <span className="text-[var(--text-sm)] text-[var(--color-ink-secondary)]">
                          Visible côté marchands
                        </span>
                      </label>
                      <button
                        type="button"
                        disabled={savingPlan === plan.slug}
                        onClick={() => void savePlan(plan.slug)}
                        className={`${buttonClass("primary", "sm")} w-full cursor-pointer`}
                      >
                        {savingPlan === plan.slug ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                        Enregistrer
                      </button>
                    </div>
                  </Panel>
                );
              })}
            </div>

            <p className="meta-label mt-3">
              Les prix modifiés ici sont immédiatement reflétés sur la page Abonnement
              des marchands. Aucune donnée n’est codée en dur côté client.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
