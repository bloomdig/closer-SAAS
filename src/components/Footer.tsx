import { Sparkles } from "lucide-react";

export function Footer() {
  return (
    <footer className="border-t border-[#e4e0d3] bg-white py-10">
      <div className="mx-auto max-w-6xl px-6 lg:px-10">
        <div className="flex flex-col items-center justify-between gap-4 md:flex-row">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#1e5f6e]">
              <Sparkles className="h-4 w-4 text-white" strokeWidth={2.5} />
            </div>
            <div className="flex flex-col leading-none">
              <span className="font-display text-[16px] font-medium tracking-tight text-[#14181f]">CLOSER</span>
              <span className="text-[9px] font-semibold tracking-[0.15em] text-[#9b9587]">AGENT COMMERCIAL</span>
            </div>
          </div>
          <p className="text-[11px] font-medium text-[#9b9587]">© 2026 CLOSER. Conçu pour le e-commerce marocain.</p>
        </div>
      </div>
    </footer>
  );
}
