import Link from "next/link";
import { ArrowRight, Sparkles, ShieldCheck } from "lucide-react";

export function Header() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-[#eaeaea] bg-white/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 lg:px-10 py-4">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#c2185b] shadow-sm shadow-[#c2185b]/20">
            <Sparkles className="h-4 w-4 text-white" strokeWidth={2.5} />
          </div>
          <div className="flex flex-col leading-none">
            <span className="text-[17px] font-extrabold tracking-tight text-[#0a0a0a]">CLOSER</span>
            <span className="text-[9px] font-semibold tracking-[0.15em] text-[#6b6b6b]">AGENT COMMERCIAL</span>
          </div>
        </Link>
        <nav className="hidden items-center gap-8 md:flex">
          <a href="#probleme" className="text-[13px] font-medium text-[#6b6b6b] transition-colors hover:text-[#0a0a0a]">Problème</a>
          <a href="#solution" className="text-[13px] font-medium text-[#6b6b6b] transition-colors hover:text-[#0a0a0a]">Solution</a>
          <a href="#fonctionnalites" className="text-[13px] font-medium text-[#6b6b6b] transition-colors hover:text-[#0a0a0a]">Fonctionnalités</a>
          <a href="#tarifs" className="text-[13px] font-medium text-[#6b6b6b] transition-colors hover:text-[#0a0a0a]">Tarifs</a>
        </nav>
        <div className="flex items-center gap-3">
          <Link href="/login" className="hidden text-[13px] font-semibold text-[#6b6b6b] transition-colors hover:text-[#0a0a0a] sm:block">Connexion</Link>
          <Link href="/signup" className="inline-flex items-center gap-2 rounded-full bg-[#c2185b] px-5 py-2.5 text-[13px] font-bold text-white shadow-[0_2px_12px_rgba(194,24,91,0.18)] transition hover:bg-[#a8144a] hover:shadow-[0_4px_16px_rgba(194,24,91,0.25)]">
            Essai gratuit <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </header>
  );
}
