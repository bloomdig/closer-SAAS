import Link from "next/link";
import { LogOut, TriangleAlert } from "lucide-react";
import { requireMerchantPage } from "@/lib/auth/guards";
import { getMerchantSession } from "@/lib/auth/session";
import { logoutAction } from "@/lib/auth/guards";
import { Sidebar, MobileNav } from "@/components/dashboard/Sidebar";
import { Badge } from "@/components/ui";
import { initials } from "@/lib/format";
import { countUnreadConversations } from "@/lib/repositories";
import {
  SUBSCRIPTION_STATUS_FR,
  SUBSCRIPTION_STATUS_TONE,
  PLAN_FR,
} from "@/lib/format";

export const dynamic = "force-dynamic";

/**
 * Structure du tableau de bord (§25, §31).
 * La protection est serveur : `requireMerchantPage` redirige toute requête
 * non authentifiée, quelle que soit la page demandée (corrige E11).
 */
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const authed = await requireMerchantPage();
  const session = await getMerchantSession();
  const unread = await countUnreadConversations(authed.session.merchantId);

  const banner = authed.access.banner;
  const businessName = authed.merchant.businessName ?? authed.merchant.name;

  return (
    <div className="min-h-screen bg-[var(--color-canvas)]">
      <Sidebar unreadCount={unread} />
      <MobileNav unreadCount={unread} />

      <div className="lg:pl-[212px]">
        {/* Barre supérieure — visible sur grand écran */}
        <header className="sticky top-0 z-20 hidden h-[48px] items-center justify-between border-b border-[var(--color-line)] bg-[var(--color-canvas)] px-5 lg:flex">
          <div className="flex items-center gap-2.5 text-[var(--text-sm)]">
            <span className="font-medium text-[var(--color-ink)]">{businessName}</span>
            <span className="text-[var(--color-line-strong)]">/</span>
            <Badge tone={SUBSCRIPTION_STATUS_TONE[authed.access.subscriptionStatus] ?? "neutral"}>
              {SUBSCRIPTION_STATUS_FR[authed.access.subscriptionStatus] ??
                authed.access.subscriptionStatus}
            </Badge>
            <span className="meta-label">
              {PLAN_FR[authed.merchant.subscriptionPlan] ?? authed.merchant.subscriptionPlan}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <span className="flex items-center gap-2 text-[var(--text-sm)] text-[var(--color-ink-secondary)]">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--color-surface-sunken)] text-[10px] font-medium text-[var(--color-ink-secondary)]">
                {initials(session?.name ?? authed.merchant.name)}
              </span>
              <span className="max-w-[160px] truncate">{session?.name ?? authed.merchant.email}</span>
            </span>
            <form action={logoutAction}>
              <button type="submit" className="btn btn-ghost btn-sm" title="Se déconnecter">
                <LogOut className="h-[15px] w-[15px]" strokeWidth={1.8} />
              </button>
            </form>
          </div>
        </header>

        {/* Bandeau d’état d’abonnement — réel, calculé en base (corrige D3/D6) */}
        {banner ? (
          <div
            className={`flex flex-col gap-2 border-b px-4 py-2.5 sm:flex-row sm:items-center sm:justify-between ${
              authed.access.requireUpgrade
                ? "border-[var(--color-accent-line)] bg-[var(--color-accent-soft)]"
                : "border-[var(--color-line)] bg-[var(--color-surface)]"
            }`}
          >
            <p className="flex items-start gap-2 text-[var(--text-sm)] text-[var(--color-ink-secondary)]">
              <TriangleAlert
                className="mt-px h-[15px] w-[15px] shrink-0 text-[var(--color-accent)]"
                strokeWidth={1.8}
              />
              <span>{banner}</span>
            </p>
            {authed.access.requireUpgrade ? (
              <Link href="/dashboard/subscription" className="btn btn-accent btn-sm shrink-0">
                Voir les offres
              </Link>
            ) : null}
          </div>
        ) : null}

        <main className="px-4 py-5 sm:px-5 lg:px-6">{children}</main>
      </div>
    </div>
  );
}
