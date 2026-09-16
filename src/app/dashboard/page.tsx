import Link from "next/link";
import {
  ArrowRight,
  MessageSquare,
  Plus,
  Radio,
  ShoppingCart,
  TriangleAlert,
} from "lucide-react";
import { requireMerchantPage } from "@/lib/auth/guards";
import {
  getDailySeries,
  getDashboardStats,
  listConversations,
  listOrders,
  countProducts,
} from "@/lib/repositories";
import { Badge, EmptyState, Money, Panel, PanelHeader, RelativeTime } from "@/components/ui";
import {
  CHANNEL_FR,
  HANDOFF_MODE_FR,
  ORDER_STATUS_FR,
  ORDER_STATUS_TONE,
  formatNumber,
  formatRate,
  initials,
} from "@/lib/format";
import { safeRate } from "@/lib/orders/status";

export const dynamic = "force-dynamic";

/**
 * Vue d’ensemble — données réelles uniquement (§21).
 * Corrige D2 : plus aucun client ni commande codé en dur. Un marchand qui
 * vient de s’inscrire voit un état vide explicite, pas les données d’un autre.
 */
export default async function DashboardPage() {
  const authed = await requireMerchantPage();
  const merchantId = authed.session.merchantId;

  const since = new Date();
  since.setHours(0, 0, 0, 0);
  since.setDate(since.getDate() - 29);
  const until = new Date();

  const [stats, series, recentConversations, recentOrders, productCount] =
    await Promise.all([
      getDashboardStats(merchantId, since, until),
      getDailySeries(merchantId, 30),
      listConversations(merchantId, { pageSize: 5 }),
      listOrders(merchantId, { pageSize: 6 }),
      countProducts(merchantId),
    ]);

  const orderCount = stats.orders.total ?? 0;
  const confirmedCount = stats.orders.confirmed ?? 0;
  const conversationCount = stats.conversations.total ?? 0;
  const conversionRate = safeRate(confirmedCount, conversationCount);
  const confirmationRate = safeRate(confirmedCount, orderCount);
  const refusalRate = safeRate(stats.orders.refused ?? 0, orderCount);
  const averageOrderValue = confirmedCount > 0 ? Math.round((stats.orders.revenue ?? 0) / confirmedCount) : 0;
  const businessName = authed.merchant.businessName ?? authed.merchant.name;
  const hasData = orderCount > 0 || conversationCount > 0 || productCount > 0;

  return (
    <div className="mx-auto max-w-[1180px]">
      <div className="mb-5">
        <h1 className="page-title">Vue d’ensemble</h1>
        <p className="page-subtitle">
          Activité des 30 derniers jours · {businessName}
        </p>
      </div>

      {/* Première connexion : parcours guidé plutôt qu’un tableau vide (§37) */}
      {!hasData ? (
        <Panel className="mb-5">
          <div className="px-5 py-6">
            <h2 className="text-[var(--text-md)] font-semibold text-[var(--color-ink)]">
              Bienvenue sur CLOSER
            </h2>
            <p className="mt-1 max-w-xl text-[var(--text-sm)] text-[var(--color-ink-muted)]">
              Trois étapes suffisent pour que CLOSER commence à transformer vos
              conversations en commandes confirmées.
            </p>
            <ol className="mt-4 space-y-2">
              {[
                {
                  label: "Décrivez votre boutique et vos règles de livraison",
                  href: "/dashboard/settings",
                  done: false,
                },
                {
                  label: "Ajoutez vos produits",
                  href: "/dashboard/products",
                  done: productCount > 0,
                },
                {
                  label: "Connectez WhatsApp ou Instagram",
                  href: "/dashboard/channels",
                  done: false,
                },
              ].map((step, index) => (
                <li key={step.href}>
                  <Link
                    href={step.href}
                    className="flex items-center gap-3 rounded-[var(--radius-md)] border border-[var(--color-line)] px-3 py-2.5 transition-colors hover:border-[var(--color-line-strong)] hover:bg-[var(--color-surface)]"
                  >
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-[var(--color-line-strong)] text-[10px] font-medium text-[var(--color-ink-muted)]">
                      {index + 1}
                    </span>
                    <span className="flex-1 text-[var(--text-sm)] text-[var(--color-ink-secondary)]">
                      {step.label}
                    </span>
                    {step.done ? (
                      <Badge tone="positive">Fait</Badge>
                    ) : (
                      <ArrowRight className="h-[14px] w-[14px] text-[var(--color-ink-faint)]" />
                    )}
                  </Link>
                </li>
              ))}
            </ol>
          </div>
        </Panel>
      ) : null}

      {/* Indicateurs */}
      <div className="mb-5 grid grid-cols-2 gap-px overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-line)] lg:grid-cols-4">
        <Metric
          label="Commandes"
          value={formatNumber(orderCount)}
          hint={`${formatNumber(stats.orders.pending ?? 0)} à traiter`}
          href="/dashboard/orders"
        />
        <Metric
          label="Chiffre d’affaires confirmé"
          value={`${formatNumber(Math.round((stats.orders.revenue ?? 0) / 100))} DH`}
          hint={`${formatNumber(stats.orders.delivered ?? 0)} livrées`}
          href="/dashboard/orders?status=delivered"
        />
        <Metric
          label="Conversations"
          value={formatNumber(conversationCount)}
          hint={`${formatNumber(stats.conversations.needReview ?? 0)} à revoir`}
          href="/dashboard/chat"
        />
        <Metric
          label="Taux de conversion"
          value={formatRate(conversionRate)}
          hint={`${formatNumber(stats.newCustomers)} nouveaux clients`}
          href="/dashboard/analytics"
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <div className="space-y-5">
          {/* Revenu attribué à CLOSER — estimation clairement étiquetée (§21) */}
          <Panel>
            <PanelHeader
              title="Revenu attribué à CLOSER"
              description="Estimation : commandes créées par l’agent de vente, hors commandes saisies manuellement."
            />
            <div className="grid grid-cols-2 gap-px bg-[var(--color-line)] sm:grid-cols-4">
              <div className="bg-[var(--color-canvas)] px-4 py-3">
                <p className="meta-label">Attribué (estimation)</p>
                <p className="mt-1 text-[var(--text-lg)] font-semibold text-[var(--color-ink)]">
                  {formatNumber(Math.round((stats.orders.revenueByAi ?? 0) / 100))} DH
                </p>
              </div>
              <div className="bg-[var(--color-canvas)] px-4 py-3">
                <p className="meta-label">Panier moyen</p>
                <p className="mt-1 text-[var(--text-lg)] font-semibold text-[var(--color-ink)]">
                  {formatNumber(Math.round(averageOrderValue / 100))} DH
                </p>
              </div>
              <div className="bg-[var(--color-canvas)] px-4 py-3">
                <p className="meta-label">Taux de confirmation</p>
                <p className="mt-1 text-[var(--text-lg)] font-semibold text-[var(--color-ink)]">
                  {formatRate(confirmationRate)}
                </p>
              </div>
              <div className="bg-[var(--color-canvas)] px-4 py-3">
                <p className="meta-label">Taux de refus</p>
                <p className="mt-1 text-[var(--text-lg)] font-semibold text-[var(--color-ink)]">
                  {formatRate(refusalRate)}
                </p>
              </div>
            </div>
            <div className="border-t border-[var(--color-line)] px-4 py-2.5">
              <p className="text-[var(--text-xs)] text-[var(--color-ink-muted)]">
                Cette valeur est une estimation d’attribution, pas un revenu
                garanti. Elle comptabilise les commandes dont la conversation a
                été traitée par l’IA.
              </p>
            </div>
            {series.length > 0 ? <Sparkline data={series.map((row) => row.revenue)} /> : null}
          </Panel>

          {/* Conversations récentes */}
          <Panel flush>
            <PanelHeader
              title="Conversations récentes"
              action={
                <Link href="/dashboard/chat" className="link text-[var(--text-sm)]">
                  Tout voir
                </Link>
              }
            />
            {recentConversations.rows.length === 0 ? (
              <EmptyState
                icon={<MessageSquare className="h-4 w-4" strokeWidth={1.8} />}
                title="Aucune conversation"
                description="Connectez un canal pour commencer à recevoir des messages clients."
                action={
                  <Link href="/dashboard/channels" className="btn btn-secondary btn-sm">
                    <Radio className="h-3.5 w-3.5" strokeWidth={1.8} />
                    Connecter un canal
                  </Link>
                }
              />
            ) : (
              <ul className="divide-y divide-[var(--color-line)]">
                {recentConversations.rows.map((conversation) => (
                  <li key={conversation.id}>
                    <Link
                      href={`/dashboard/chat?id=${conversation.id}`}
                      className="flex items-start gap-3 px-4 py-2.5 transition-colors hover:bg-[var(--color-surface)]"
                    >
                      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--color-surface-sunken)] text-[10px] font-medium text-[var(--color-ink-secondary)]">
                        {initials(conversation.customerName ?? conversation.customerPhone)}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-baseline justify-between gap-2">
                          <span className="truncate text-[var(--text-sm)] font-medium text-[var(--color-ink)]">
                            {conversation.customerName ?? conversation.customerPhone ?? "Client"}
                          </span>
                          <span className="meta-label shrink-0">
                            <RelativeTime date={conversation.lastMessageAt} />
                          </span>
                        </span>
                        <span className="mt-0.5 block truncate text-[var(--text-sm)] text-[var(--color-ink-muted)]">
                          {conversation.lastMessagePreview ?? "Aucun message"}
                        </span>
                        <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
                          <Badge tone="neutral">{CHANNEL_FR[conversation.source] ?? conversation.source}</Badge>
                          {conversation.needsHumanReview ? (
                            <Badge tone="warning">À traiter</Badge>
                          ) : (
                            <Badge tone={conversation.handoffMode === "manual" ? "neutral" : "accent"}>
                              {HANDOFF_MODE_FR[conversation.handoffMode]}
                            </Badge>
                          )}
                          {conversation.unreadCount > 0 ? (
                            <Badge tone="info">{conversation.unreadCount} non lus</Badge>
                          ) : null}
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>

        {/* Colonne latérale */}
        <div className="space-y-5">
          {stats.conversations.needReview > 0 ? (
            <div className="flex items-start gap-2.5 rounded-[var(--radius-lg)] border border-[#fde68a] bg-[var(--color-warning-soft)] px-3.5 py-3">
              <TriangleAlert className="mt-px h-4 w-4 shrink-0 text-[var(--color-warning)]" strokeWidth={1.8} />
              <div className="min-w-0">
                <p className="text-[var(--text-sm)] font-medium text-[var(--color-ink)]">
                  {formatNumber(stats.conversations.needReview)} conversation
                  {(stats.conversations.needReview ?? 0) > 1 ? "s" : ""} à traiter
                </p>
                <Link href="/dashboard/chat?needsReview=true" className="link mt-1 inline-block text-[var(--text-sm)]">
                  Ouvrir la file d’attente
                </Link>
              </div>
            </div>
          ) : null}

          <Panel flush>
            <PanelHeader
              title="Dernières commandes"
              action={
                <Link href="/dashboard/orders" className="link text-[var(--text-sm)]">
                  Tout voir
                </Link>
              }
            />
            {recentOrders.rows.length === 0 ? (
              <EmptyState
                icon={<ShoppingCart className="h-4 w-4" strokeWidth={1.8} />}
                title="Aucune commande"
                description="Les commandes créées par CLOSER apparaîtront ici."
              />
            ) : (
              <ul className="divide-y divide-[var(--color-line)]">
                {recentOrders.rows.map((order) => (
                  <li key={order.id}>
                    <Link
                      href={`/dashboard/orders?id=${order.id}`}
                      className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-[var(--color-surface)]"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[var(--text-sm)] font-medium text-[var(--color-ink)]">
                          {order.customerName}
                        </span>
                        <span className="meta-label block truncate">
                          {order.reference} · {order.city ?? "—"}
                        </span>
                      </span>
                      <span className="shrink-0 text-right">
                        <Money cents={order.total} className="block text-[var(--text-sm)] font-medium text-[var(--color-ink)]" />
                        <span className="mt-0.5 block">
                          <Badge tone={ORDER_STATUS_TONE[order.orderStatus]}>
                            {ORDER_STATUS_FR[order.orderStatus]}
                          </Badge>
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel>
            <PanelHeader title="Catalogue" />
            <div className="space-y-2 px-4 py-3">
              <div className="flex items-center justify-between text-[var(--text-sm)]">
                <span className="text-[var(--color-ink-muted)]">Produits</span>
                <span className="font-medium text-[var(--color-ink)]">{formatNumber(productCount)}</span>
              </div>
              <div className="flex items-center justify-between text-[var(--text-sm)]">
                <span className="text-[var(--color-ink-muted)]">Actifs</span>
                <span className="font-medium text-[var(--color-ink)]">
                  {formatNumber(stats.products.active ?? 0)}
                </span>
              </div>
              <div className="flex items-center justify-between text-[var(--text-sm)]">
                <span className="text-[var(--color-ink-muted)]">Stock faible ou vide</span>
                <span className="font-medium text-[var(--color-ink)]">
                  {formatNumber(stats.products.outOfStock ?? 0)}
                </span>
              </div>
              <Link href="/dashboard/products" className="btn btn-secondary btn-sm btn-block mt-3">
                <Plus className="h-3.5 w-3.5" strokeWidth={1.8} />
                Gérer les produits
              </Link>
            </div>
          </Panel>

          <Panel>
            <PanelHeader title="Messages traités" />
            <div className="space-y-2 px-4 py-3 text-[var(--text-sm)]">
              <div className="flex items-center justify-between">
                <span className="text-[var(--color-ink-muted)]">Par CLOSER</span>
                <span className="font-medium text-[var(--color-ink)]">
                  {formatNumber(stats.messages.aiMessages ?? 0)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[var(--color-ink-muted)]">Par vos conseillers</span>
                <span className="font-medium text-[var(--color-ink)]">
                  {formatNumber(stats.messages.agentMessages ?? 0)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[var(--color-ink-muted)]">Reçus des clients</span>
                <span className="font-medium text-[var(--color-ink)]">
                  {formatNumber(stats.messages.customerMessages ?? 0)}
                </span>
              </div>
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  hint,
  href,
}: {
  label: string;
  value: string;
  hint?: string;
  href: string;
}) {
  return (
    <Link href={href} className="block bg-[var(--color-canvas)] px-4 py-3 transition-colors hover:bg-[var(--color-surface)]">
      <p className="meta-label truncate">{label}</p>
      <p className="mt-1 text-[var(--text-xl)] font-semibold tracking-[-0.02em] text-[var(--color-ink)]">
        {value}
      </p>
      {hint ? <p className="mt-0.5 text-[var(--text-xs)] text-[var(--color-ink-muted)]">{hint}</p> : null}
    </Link>
  );
}

/**
 * Courbe de chiffre d’affaires sur 30 jours, en SVG inline.
 * Aucune bibliothèque de graphiques : pas de dépendance supplémentaire,
 * rendu net et léger.
 */
function Sparkline({ data }: { data: number[] }) {
  if (data.length < 2) return null;

  const width = 640;
  const height = 56;
  const max = Math.max(...data, 1);
  const step = width / (data.length - 1);

  const points = data.map((value, index) => {
    const x = index * step;
    const y = height - (value / max) * (height - 6) - 3;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  const area = `0,${height} ${points.join(" ")} ${width},${height}`;

  return (
    <div className="border-t border-[var(--color-line)] px-4 pb-3 pt-2">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-14 w-full"
        preserveAspectRatio="none"
        role="img"
        aria-label="Chiffre d’affaires des 30 derniers jours"
      >
        <polygon points={area} fill="rgba(30, 95, 110, 0.08)" />
        <polyline
          points={points.join(" ")}
          fill="none"
          stroke="var(--color-accent)"
          strokeWidth="1.5"
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    </div>
  );
}

