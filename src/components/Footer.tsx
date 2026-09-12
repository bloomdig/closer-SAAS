import { Sparkles } from "lucide-react";

export function Footer() {
  return (
    <footer className="border-t border-[#eaeaea] bg-white py-10">
      <div className="mx-auto max-w-6xl px-6 lg:px-10">
        <div className="flex flex-col items-center justify-between gap-4 md:flex-row">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#c2185b] shadow-sm shadow-[#c2185b]/15">
              <Sparkles className="h-4 w-4 text-white" strokeWidth={2.5} />
            </div>
            <div className="flex flex-col leading-none">
              <span className="text-[16px] font-extrabold tracking-tight text-[#0a0a0a]">CLOSER</span>
              <span className="text-[9px] font-semibold tracking-[0.15em] text-[#9a9a9a]">AGENT COMMERCIAL</span>
            </div>
          </div>
          <p className="text-[11px] font-medium text-[#9a9a9a]">© 2026 CLOSER. Conçu pour le e-commerce marocain.</p>
        </div>
      </div>
    </footer>
  );
}
