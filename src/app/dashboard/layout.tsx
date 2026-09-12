import { redirect } from "next/navigation";
import Link from "next/link";
import {
  Sparkles, LayoutDashboard, Package, MessageCircle, CreditCard,
  Settings, LogOut, Bell, ShieldCheck, ChartLine, Zap, Users, FolderOpen
} from "lucide-react";
import { verifySession } from "@/lib/verify";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await verifySession();
  if (!session) redirect("/login");

  const navItems = [
    { href: "/dashboard", label: "Vue d'ensemble", icon: LayoutDashboard },
    { href: "/dashboard/chat", label: "Conversations", icon: MessageCircle },
    { href: "/dashboard/orders", label: "Commandes", icon: CreditCard },
    { href: "/dashboard/products", label: "Produits", icon: Package },
    { href: "/dashboard/analytics", label: "Analyse", icon: ChartLine },
    { href: "/dashboard/automations", label: "Automatisations", icon: Zap },
    { href: "/dashboard/customers", label: "Clients", icon: Users },
    { href: "/dashboard/settings", label: "Configuration", icon: Settings },
  ];

  return (
    <div className="flex min-h-screen bg-[#fafafa] text-[#0a0a0a]">
      {/* Sidebar */}
      <aside className="fixed left-0 top-0 z-40 hidden h-screen w-[260px] flex-col border-r border-[#eaeaea] bg-white lg:flex">
        <div className="flex h-[72px] items-center gap-2.5 px-6 border-b border-[#eaeaea]">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#c2185b] shadow-sm shadow-[#c2185b]/15">
            <Sparkles className="h-4 w-4 text-white" strokeWidth={2.5} />
          </div>
          <div className="flex flex-col leading-none">
            <span className="text-[16px] font-extrabold tracking-tight">CLOSER</span>
            <span className="text-[9px] font-semibold tracking-[0.15em] text-[#9a9a9a]">AGENT COMMERCIAL</span>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-4 py-6 space-y-0.5">
          {navItems.map((item) => (
            <Link key={item.href} href={item.href} className="flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-[13px] font-semibold text-[#6b6b6b] hover:text-[#0a0a0a] hover:bg-[#fafafa] transition-colors">
              <item.icon className="h-4 w-4 text-[#9a9a9a]" strokeWidth={2} />
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>

        <div className="border-t border-[#eaeaea] px-4 py-5">
          <form action="/api/auth/logout" method="POST" className="w-full">
            <button type="submit" className="flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-[13px] font-semibold text-[#6b6b6b] hover:text-[#0a0a0a] hover:bg-[#fafafa] transition-colors">
              <LogOut className="h-4 w-4" strokeWidth={2} /> Déconnexion
            </button>
          </form>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 lg:ml-[260px]">
        <header className="sticky top-0 z-30 flex h-[72px] items-center justify-between border-b border-[#eaeaea] bg-white/80 px-6 md:px-10 backdrop-blur-md">
          <div className="flex items-center gap-3 lg:hidden">
            <span className="text-[14px] font-extrabold">Tableau de bord</span>
          </div>
          <div className="flex items-center gap-3 ml-auto">
            <a href="/dashboard/subscription" className="hidden rounded-full bg-[#c2185b]/8 border border-[#c2185b]/15 px-3.5 py-1.5 text-[11px] font-extrabold text-[#c2185b] hover:bg-[#c2185b]/12 transition md:inline-flex items-center gap-1.5">
              Essai : <span>7 jours</span>
            </a>
            <button className="rounded-full p-2 hover:bg-[#fafafa] transition-colors"><Bell className="h-4 w-4 text-[#9a9a9a]" strokeWidth={2} /></button>
          </div>
        </header>
        <main className="p-6 md:p-10">{children}</main>
      </div>
    </div>
  );
}
