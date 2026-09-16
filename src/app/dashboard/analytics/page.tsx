import { requireMerchantPage } from "@/lib/auth/guards";
import {
  getAverageResponseTime,
  getDailySeries,
  getDashboardStats,
} from "@/lib/repositories";
import { EmptyState, PageHeader, Panel, PanelHeader } from "@/components/ui";
import { formatNumber, formatRate, formatSeconds } from "@/lib/format";
import { safeRate } from "@/lib/orders/status";
import { BarChart3 } from "lucide-react";

export const dynamic = "force-dynamic";

/**
 * Analyse — métriques réelles issues de la base (§21).
 * Le « revenu récupéré par CLOSER » est explicitement étiqueté comme estimation.
 */
export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string }>;
}) {
  const authed = await requireMerchantPage();
  const params = await searchParams;
  const days = Math.min(180, Math.max(7, Number(params.days ?? 30) || 30));

  const from = new Date();
  from.setHours(0, 0, 0, 0);
  from.setDate(from.getDate() - (days - 1));
  const to = new Date();

  const [stats, series, responseTime] = await Promise.all([
    getDashboardStats(authed.session.merchantId, from, to),
    getDailySeries(authed.session.merchantId, days),
    getAverageResponseTime(authed.session.merchantId, from, to),
  ]);

  const orders = stats.orders;
  const conversations = stats.conversations;
  const orderCount = orders.total ?? 0;
  const confirmed = orders.confirmed ?? 0;
  const delivered = orders.delivered ?? 0;
  const refused = orders.refused ?? 0;
  const returned = orders.returned ?? 0;

  const metrics = [
    { label: "Conversations", value: formatNumber(conversations.total ?? 0), hint: `${formatNumber(conversations.open ?? 0)} ouvertes` },
    { label: "Commandes", value: formatNumber(orderCount), hint: `${formatNumber(orders.pending ?? 0)} à traiter` },
    { label: "Commandes confirmées", value: formatNumber(confirmed), hint: formatRate(safeRate(confirmed, orderCount)) + " des commandes" },
    { label: "Commandes livrées", value: formatNumber(delivered), hint: formatRate(safeRate(delivered, orderCount)) + " des commandes" },
    { label: "Commandes refusées", value: formatNumber(refused), hint: formatRate(safeRate(refused, orderCount)) + " des commandes" },
    { label: "Retours", value: formatNumber(returned), hint: formatRate(safeRate(returned, delivered)) + " des livraisons" },
    { label: "Taux de conversion", value: formatRate(safeRate(confirmed, conversations.total ?? 0)), hint: "conversations → commandes confirmées" },
    { label: "Taux de confirmation", value: formatRate(safeRate(confirmed, orderCount)), hint: "commandes créées → confirmées" },
    { label: "Taux de refus", value: formatRate(safeRate(refused, orderCount)), hint: "commandes refusées ou annulées" },
    { label: "Taux de retour", value: formatRate(safeRate(returned, delivered)), hint: "livraisons retournées" },
    { label: "Chiffre d’affaires confirmé", value: `${formatNumber(Math.round((orders.revenue ?? 0) / 100))} DH`, hint: "commandes confirmées et au-delà" },
    { label: "Chiffre d’affaires encaissé", value: `${formatNumber(Math.round((orders.revenueDelivered ?? 0) / 100))} DH`, hint: "commandes livrées" },
    { label: "Panier moyen", value: `${formatNumber(confirmed > 0 ? Math.round(orders.revenue! / confirmed / 100) : 0)} DH`, hint: "sur les commandes confirmées" },
    { label: "Délai de réponse moyen", value: formatSeconds(responseTime), hint: "première réponse après un message client" },
    { label: "Messages clients", value: formatNumber(stats.messages.customerMessages ?? 0), hint: `${formatNumber(stats.messages.aiMessages ?? 0)} réponses de CLOSER` },
    { label: "Nouveaux clients", value: formatNumber(stats.newCustomers), hint: `sur ${days} jours` },
  ];

  const hasData = orderCount > 0 || (conversations.total ?? 0) > 0;

  return (
    <div className="mx-auto max-w-[1180px]">
      <PageHeader
        title="Analyse"
        subtitle={`Performance des ${days} derniers jours.`}
        actions={
          <div className="flex items-center gap-1.5">
            {[7, 30, 90].map((option) => (
              <a
                key={option}
                href={option === 30 ? "/dashboard/analytics" : `/dashboard/analytics?days=${option}`}
                className={`h-7 rounded-[var(--radius-md)] border px-2.5 text-[var(--text-xs)] leading-[26px] transition-colors ${
                  days === option
                    ? "border-[var(--color-ink)] bg-[var(--color-ink)] text-white"
                    : "border-[var(--color-line-strong)] bg-[var(--color-canvas)] text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]"
                }`}
              >
                {option} j
              </a>
            ))}
          </div>
        }
      />

      {!hasData ? (
        <Panel>
          <EmptyState
            icon={<BarChart3 className="h-4 w-4" strokeWidth={1.8} />}
            title="Pas encore de données"
            description="Vos statistiques apparaîtront dès les premières conversations et commandes traitées par CLOSER."
          />
        </Panel>
      ) : (
        <>
          <Panel className="mb-5">
            <PanelHeader title="Chiffre d’affaires quotidien" description="Commandes confirmées et au-delà." />
            <BarChart series={series} />
          </Panel>

          <div className="mb-5 grid grid-cols-2 gap-px overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-line)] md:grid-cols-4">
            {metrics.map((metric) => (
              <div key={metric.label} className="bg-[var(--color-canvas)] px-4 py-3">
                <p className="meta-label truncate">{metric.label}</p>
                <p className="mt-1 text-[var(--text-lg)] font-semibold tracking-[-0.02em] text-[var(--color-ink)]">
                  {metric.value}
                </p>
                <p className="mt-0.5 text-[var(--text-xs)] text-[var(--color-ink-muted)]">{metric.hint}</p>
              </div>
            ))}
          </div>

          <Panel>
            <PanelHeader
              title="Revenu récupéré par CLOSER"
              description="Attribution estimée, pas un revenu garanti."
            />
            <div className="grid grid-cols-2 gap-px bg-[var(--color-line)] md:grid-cols-4">
              <div className="bg-[var(--color-canvas)] px-4 py-3">
                <p className="meta-label">Attribué à CLOSER</p>
                <p className="mt-1 text-[var(--text-lg)] font-semibold text-[var(--color-ink)]">
                  {formatNumber(Math.round((orders.revenueByAi ?? 0) / 100))} DH
                </p>
              </div>
              <div className="bg-[var(--color-canvas)] px-4 py-3">
                <p className="meta-label">Part du total</p>
                <p className="mt-1 text-[var(--text-lg)] font-semibold text-[var(--color-ink)]">
                  {formatRate(safeRate(orders.revenueByAi ?? 0, orders.revenue ?? 0))}
                </p>
              </div>
              <div className="bg-[var(--color-canvas)] px-4 py-3">
                <p className="meta-label">Conversations en mode manuel</p>
                <p className="mt-1 text-[var(--text-lg)] font-semibold text-[var(--color-ink)]">
                  {formatNumber(conversations.manual ?? 0)}
                </p>
              </div>
              <div className="bg-[var(--color-canvas)] px-4 py-3">
                <p className="meta-label">À traiter par un humain</p>
                <p className="mt-1 text-[var(--text-lg)] font-semibold text-[var(--color-ink)]">
                  {formatNumber(conversations.needReview ?? 0)}
                </p>
              </div>
            </div>
            <p className="border-t border-[var(--color-line)] px-4 py-2.5 text-[var(--text-xs)] text-[var(--color-ink-muted)]">
              Méthode d’attribution : une commande est attribuée à CLOSER lorsqu’elle
              a été créée par l’agent de vente depuis une conversation. Les commandes
              saisies manuellement par votre équipe en sont exclues. Cette valeur est
              une estimation commerciale, elle ne constitue pas un revenu garanti.
            </p>
          </Panel>
        </>
      )}
    </div>
  );
}

/** Histogramme en SVG inline — aucune bibliothèque de graphiques. */
function BarChart({ series }: { series: { day: string; revenue: number; ordersCount: number }[] }) {
  if (series.length === 0) {
    return (
      <p className="px-4 py-6 text-center text-[var(--text-sm)] text-[var(--color-ink-muted)]">
        Aucune commande sur la période.
      </p>
    );
  }

  const max = Math.max(...series.map((row) => row.revenue), 1);
  const barWidth = 100 / series.length;

  return (
    <div className="px-4 pb-4 pt-3">
      <div className="flex h-[132px] items-end gap-px">
        {series.map((row) => {
          const height = (row.revenue / max) * 100;
          return (
            <div
              key={row.day}
              className="group relative flex-1"
              style={{ minWidth: 0 }}
              title={`${row.day} — ${Math.round(row.revenue / 100).toLocaleString("fr-FR")} DH · ${row.ordersCount} commande(s)`}
            >
              <div
                className="w-full rounded-t-[2px] bg-[var(--color-accent)]/80 transition-colors group-hover:bg-[var(--color-accent)]"
                style={{ height: `${Math.max(height, row.revenue > 0 ? 3 : 1)}%` }}
              />
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex justify-between">
        <span className="meta-label">{series[0]?.day}</span>
        <span className="meta-label">{series[series.length - 1]?.day}</span>
      </div>
      <p className="meta-label mt-1">
        Pic : {Math.round(max / 100).toLocaleString("fr-FR")} DH · largeur de barre {barWidth.toFixed(1)} %
      </p>
    </div>
  );
}
