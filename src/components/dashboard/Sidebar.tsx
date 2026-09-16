"use client";

/**
 * Navigation latérale + navigation mobile (§31).
 * Le prototype n’avait AUCUNE navigation mobile : la sidebar était
 * `hidden lg:flex` sans alternative. Ici, un panneau coulissant apparaît
 * sous `lg` et la barre inférieure reste disponible sur petit écran.
 */
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  BarChart3,
  LayoutDashboard,
  MessageSquare,
  Package,
  Radio,
  Settings,
  ShoppingCart,
  Users,
  Wallet,
  Zap,
  X,
} from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  badge?: number;
};

export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Vue d’ensemble", icon: LayoutDashboard },
  { href: "/dashboard/chat", label: "Conversations", icon: MessageSquare },
  { href: "/dashboard/orders", label: "Commandes", icon: ShoppingCart },
  { href: "/dashboard/products", label: "Produits", icon: Package },
  { href: "/dashboard/customers", label: "Clients", icon: Users },
  { href: "/dashboard/analytics", label: "Analyse", icon: BarChart3 },
  { href: "/dashboard/automations", label: "Automatisations", icon: Zap },
  { href: "/dashboard/channels", label: "Canaux", icon: Radio },
  { href: "/dashboard/settings", label: "Configuration", icon: Settings },
  { href: "/dashboard/subscription", label: "Abonnement", icon: Wallet },
];

/** Correspondance exacte ou préfixe (pour les sous-routes). */
function isActive(pathname: string, href: string): boolean {
  if (href === "/dashboard") return pathname === "/dashboard";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Wordmark({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/dashboard" className="flex items-center gap-2 px-1">
      <span
        aria-hidden
        className="flex h-6 w-6 items-center justify-center rounded-[var(--radius-sm)] bg-[var(--color-ink)] text-[11px] font-semibold text-white"
      >
        C
      </span>
      {!compact ? (
        <span className="text-[14px] font-semibold tracking-[-0.02em] text-[var(--color-ink)]">
          CLOSER
        </span>
      ) : null}
    </Link>
  );
}

function NavList({
  pathname,
  unreadCount,
  onNavigate,
}: {
  pathname: string;
  unreadCount: number;
  onNavigate?: () => void;
}) {
  return (
    <nav className="flex flex-col gap-px">
      {NAV_ITEMS.map((item) => {
        const active = isActive(pathname, item.href);
        const badge =
          item.href === "/dashboard/chat" && unreadCount > 0 ? unreadCount : item.badge;

        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={`flex h-[30px] items-center gap-2.5 rounded-[var(--radius-md)] px-2.5 text-[var(--text-sm)] transition-colors ${
              active
                ? "bg-[var(--color-surface-sunken)] font-medium text-[var(--color-ink)]"
                : "text-[var(--color-ink-muted)] hover:bg-[var(--color-surface)] hover:text-[var(--color-ink)]"
            }`}
          >
            <item.icon
              className={`h-[15px] w-[15px] shrink-0 ${active ? "text-[var(--color-accent)]" : ""}`}
              strokeWidth={1.8}
            />
            <span className="flex-1 truncate">{item.label}</span>
            {badge ? (
              <span className="min-w-[18px] rounded-[var(--radius-sm)] bg-[var(--color-accent)] px-1 text-center text-[10px] font-medium leading-[16px] text-white">
                {badge > 99 ? "99+" : badge}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}

export function Sidebar({ unreadCount = 0 }: { unreadCount?: number }) {
  const pathname = usePathname();

  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-[212px] flex-col border-r border-[var(--color-line)] bg-[var(--color-canvas)] lg:flex">
      <div className="flex h-[48px] shrink-0 items-center border-b border-[var(--color-line)] px-3.5">
        <Wordmark />
      </div>
      <div className="flex-1 overflow-y-auto px-2 py-3">
        <NavList pathname={pathname} unreadCount={unreadCount} />
      </div>
    </aside>
  );
}

export function MobileNav({ unreadCount = 0 }: { unreadCount?: number }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [previousPathname, setPreviousPathname] = useState(pathname);

  // Ferme le panneau à chaque navigation (ajustement d’état pendant le rendu,
  // motif recommandé par React — pas de setState synchrone dans un effet).
  if (pathname !== previousPathname) {
    setPreviousPathname(pathname);
    setOpen(false);
  }

  // Empêche le défilement de l’arrière-plan quand le panneau est ouvert.
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      {/* Barre supérieure mobile */}
      <header className="sticky top-0 z-30 flex h-[48px] items-center justify-between border-b border-[var(--color-line)] bg-[var(--color-canvas)] px-3 lg:hidden">
        <Wordmark />
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="btn btn-ghost btn-sm"
          aria-label="Ouvrir la navigation"
          aria-expanded={open}
        >
          Menu
        </button>
      </header>

      {/* Panneau coulissant */}
      {open ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Fermer la navigation"
            className="absolute inset-0 bg-black/30"
            onClick={() => setOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 flex w-[260px] flex-col bg-[var(--color-canvas)] shadow-xl">
            <div className="flex h-[48px] items-center justify-between border-b border-[var(--color-line)] px-3.5">
              <Wordmark />
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="btn btn-ghost btn-sm"
                aria-label="Fermer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-2 py-3">
              <NavList
                pathname={pathname}
                unreadCount={unreadCount}
                onNavigate={() => setOpen(false)}
              />
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
