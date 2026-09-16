import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";

export function Header() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-[#e4e0d3] bg-white/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 lg:px-10 py-4">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#1e5f6e] shadow-sm shadow-[#1e5f6e]/20">
            <Sparkles className="h-4 w-4 text-white" strokeWidth={2.5} />
          </div>
          <div className="flex flex-col leading-none">
            <span className="font-display text-[18px] font-medium tracking-tight text-[#14181f]">CLOSER</span>
            <span className="text-[9px] font-semibold tracking-[0.15em] text-[#6b6558]">AGENT COMMERCIAL</span>
          </div>
        </Link>
        <nav className="hidden items-center gap-8 md:flex">
          <a href="#probleme" className="text-[13px] font-medium text-[#6b6558] transition-colors hover:text-[#14181f]">Problème</a>
          <a href="#solution" className="text-[13px] font-medium text-[#6b6558] transition-colors hover:text-[#14181f]">Solution</a>
          <a href="#fonctionnalites" className="text-[13px] font-medium text-[#6b6558] transition-colors hover:text-[#14181f]">Fonctionnalités</a>
          <a href="#tarifs" className="text-[13px] font-medium text-[#6b6558] transition-colors hover:text-[#14181f]">Tarifs</a>
        </nav>
        <div className="flex items-center gap-3">
          <Link href="/login" className="hidden text-[13px] font-semibold text-[#6b6558] transition-colors hover:text-[#14181f] sm:block">Connexion</Link>
          <Link href="/signup" className="inline-flex items-center gap-2 rounded-lg bg-[#14181f] px-4 py-2.5 text-[13px] font-semibold text-white transition hover:bg-[#252b38]">
            Essai gratuit <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </header>
  );
}
