import Link from "next/link";
import { ShoppingCart } from "lucide-react";
import { requireMerchantPage } from "@/lib/auth/guards";
import { getDashboardStats, listOrders } from "@/lib/repositories";
import { Badge, EmptyState, Money, PageHeader, Panel, RelativeTime } from "@/components/ui";
import { OrderStatusControl, OrderStatusFilters } from "@/components/orders/OrderStatusControl";
import {
  PAYMENT_METHOD_FR,
  formatMoroccanPhone,
  formatNumber,
} from "@/lib/format";
import { ORDER_STATUSES, type OrderStatus } from "@/lib/orders/status";
import { db } from "@/db";
import { and, eq, sql } from "drizzle-orm";
import { orders } from "@/db/schema";

export const dynamic = "force-dynamic";

/**
 * Commandes — données réelles, filtres fonctionnels, transitions de statut
 * validées côté serveur (§10, §11). Plus aucune commande fictive.
 */
export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string; search?: string }>;
}) {
  const authed = await requireMerchantPage();
  const params = await searchParams;
  const merchantId = authed.session.merchantId;

  const statusParam = params.status ?? "";
  const page = Math.max(1, Number(params.page ?? 1) || 1);

  const [result, counts, stats] = await Promise.all([
    listOrders(merchantId, {
      status: statusParam && statusParam !== "all" ? (statusParam as OrderStatus) : undefined,
      search: params.search ?? undefined,
      page,
      pageSize: 25,
    }),
    getStatusCounts(merchantId),
    getDashboardStats(merchantId, startOfDay(), new Date()),
  ]);

  const totalPages = Math.max(1, Math.ceil(result.total / 25));

  return (
    <div className="mx-auto max-w-[1180px]">
      <PageHeader
        title="Commandes"
        subtitle="Paiement à la livraison par défaut. Le statut est mis à jour immédiatement dans le tableau de bord."
      />

      <div className="mb-4 grid grid-cols-2 gap-px overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-line)] sm:grid-cols-4">
        <Summary label="À traiter" value={formatNumber(stats.orders.pending ?? 0)} href="/dashboard/orders?status=pending_confirmation" />
        <Summary label="Confirmées" value={formatNumber(stats.orders.confirmed ?? 0)} href="/dashboard/orders?status=confirmed" />
        <Summary label="Livrées" value={formatNumber(stats.orders.delivered ?? 0)} href="/dashboard/orders?status=delivered" />
        <Summary label="Refusées" value={formatNumber(stats.orders.refused ?? 0)} href="/dashboard/orders?status=refused" />
      </div>

      <div className="mb-3 flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
        <OrderStatusFilters counts={counts} active={statusParam} />
        <form action="/dashboard/orders" className="flex items-center gap-2">
          {statusParam ? <input type="hidden" name="status" value={statusParam} /> : null}
          <input
            type="search"
            name="search"
            defaultValue={params.search ?? ""}
            placeholder="Référence, client, téléphone…"
            className="field h-8 w-full text-[var(--text-sm)] sm:w-[220px]"
            aria-label="Rechercher une commande"
          />
          <button type="submit" className="btn btn-secondary btn-sm">
            Rechercher
          </button>
        </form>
      </div>

      <Panel flush>
        {result.rows.length === 0 ? (
          <EmptyState
            icon={<ShoppingCart className="h-4 w-4" strokeWidth={1.8} />}
            title={params.search || statusParam ? "Aucune commande ne correspond" : "Aucune commande"}
            description={
              params.search || statusParam
                ? "Modifiez votre recherche ou vos filtres."
                : "Les commandes créées par CLOSER ou saisies manuellement apparaîtront ici."
            }
            action={
              params.search || statusParam ? (
                <Link href="/dashboard/orders" className="btn btn-secondary btn-sm">
                  Réinitialiser les filtres
                </Link>
              ) : undefined
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Référence</th>
                  <th>Client</th>
                  <th>Ville</th>
                  <th className="table-numeric">Total</th>
                  <th>Paiement</th>
                  <th>Statut</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {result.rows.map((order) => (
                  <tr key={order.id}>
                    <td>
                      <Link
                        href={`/dashboard/orders?id=${order.id}`}
                        className="font-mono text-[var(--text-xs)] text-[var(--color-ink)] hover:underline"
                      >
                        {order.reference}
                      </Link>
                      {order.createdByAi ? (
                        <span className="mt-0.5 block">
                          <Badge tone="accent">CLOSER</Badge>
                        </span>
                      ) : null}
                    </td>
                    <td>
                      <span className="block font-medium text-[var(--color-ink)]">
                        {order.customerName}
                      </span>
                      <span className="meta-label block">{formatMoroccanPhone(order.customerPhone)}</span>
                    </td>
                    <td>{order.city ?? "—"}</td>
                    <td className="table-numeric font-medium text-[var(--color-ink)]">
                      <Money cents={order.total} />
                    </td>
                    <td>
                      <span className="block">{PAYMENT_METHOD_FR[order.paymentMethod] ?? order.paymentMethod}</span>
                      <span className="meta-label block">
                        {order.paymentStatus === "paid"
                          ? "Encaissée"
                          : order.paymentStatus === "refunded"
                            ? "Remboursée"
                            : order.paymentStatus === "failed"
                              ? "Échec"
                              : "À encaisser"}
                      </span>
                    </td>
                    <td>
                      <OrderStatusControl
                        orderId={order.id}
                        current={order.orderStatus}
                        allowed={allowedFor(order.orderStatus)}
                      />
                    </td>
                    <td className="meta-label whitespace-nowrap">
                      <RelativeTime date={order.createdAt} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 ? (
          <div className="flex items-center justify-between border-t border-[var(--color-line)] px-4 py-2.5">
            <span className="meta-label">
              Page {page} sur {totalPages} · {formatNumber(result.total)} commandes
            </span>
            <div className="flex items-center gap-1.5">
              {page > 1 ? (
                <Link
                  href={buildHref(statusParam, params.search, page - 1)}
                  className="btn btn-secondary btn-sm"
                >
                  Précédent
                </Link>
              ) : null}
              {page < totalPages ? (
                <Link
                  href={buildHref(statusParam, params.search, page + 1)}
                  className="btn btn-secondary btn-sm"
                >
                  Suivant
                </Link>
              ) : null}
            </div>
          </div>
        ) : null}
      </Panel>
    </div>
  );
}

function allowedFor(status: OrderStatus): OrderStatus[] {
  const map: Record<OrderStatus, OrderStatus[]> = {
    new: ["ai_qualified", "pending_confirmation", "confirmed", "cancelled", "refused"],
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
  return map[status] ?? [];
}

function buildHref(status: string, search: string | undefined, page: number): string {
  const params = new URLSearchParams();
  if (status) params.set("status", status);
  if (search) params.set("search", search);
  if (page > 1) params.set("page", String(page));
  const query = params.toString();
  return query ? `/dashboard/orders?${query}` : "/dashboard/orders";
}

function Summary({ label, value, href }: { label: string; value: string; href: string }) {
  return (
    <Link href={href} className="block bg-[var(--color-canvas)] px-4 py-3 transition-colors hover:bg-[var(--color-surface)]">
      <p className="meta-label">{label}</p>
      <p className="mt-0.5 text-[var(--text-lg)] font-semibold text-[var(--color-ink)]">{value}</p>
    </Link>
  );
}

async function getStatusCounts(merchantId: string): Promise<Record<string, number>> {
  const rows = await db
    .select({
      status: orders.orderStatus,
      count: sql<number>`count(*)::int`,
    })
    .from(orders)
    .where(and(eq(orders.merchantId, merchantId)))
    .groupBy(orders.orderStatus);

  const counts: Record<string, number> = {};
  for (const status of ORDER_STATUSES) counts[status] = 0;
  for (const row of rows) counts[row.status] = row.count;
  return counts;
}

function startOfDay(daysBack = 29): Date {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - daysBack);
  return date;
}
