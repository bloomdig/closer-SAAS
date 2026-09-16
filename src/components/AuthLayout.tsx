import { Sparkles } from "lucide-react";

/**
 * Panneau de marque du flux d'authentification. Remplace la photo de stock
 * générique par un motif géométrique inspiré du zellige marocain, tracé en
 * SVG — cohérent avec l'identité de marque plutôt que décoratif au hasard.
 */
export function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-white">
      <div className="relative hidden w-[42%] shrink-0 overflow-hidden bg-[#14181f] lg:block">
        <svg
          className="absolute inset-0 h-full w-full opacity-[0.07]"
          viewBox="0 0 200 200"
          preserveAspectRatio="xMidYMid slice"
        >
          <defs>
            <pattern id="zellige" width="20" height="20" patternUnits="userSpaceOnUse">
              <path d="M10 0 L20 10 L10 20 L0 10 Z" fill="none" stroke="#fdfcf9" strokeWidth="0.6" />
            </pattern>
          </defs>
          <rect width="200" height="200" fill="url(#zellige)" />
        </svg>

        <div className="relative flex h-full flex-col justify-between p-12">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#1e5f6e]">
              <Sparkles className="h-4 w-4 text-white" strokeWidth={2.5} />
            </div>
            <span className="font-display text-[17px] font-medium text-white">CLOSER</span>
          </div>

          <div className="max-w-sm">
            <p className="font-display text-[24px] font-medium leading-snug text-white">
              Votre agent commercial ne dort jamais.
            </p>
            <p className="mt-3 text-[14px] leading-relaxed text-[#a8a396]">
              CLOSER répond, qualifie et confirme vos commandes COD sur WhatsApp — en darija, arabe et
              français, pendant que vous gérez le reste.
            </p>
          </div>

          <p className="text-[12px] text-[#6b6558]">© 2026 CLOSER</p>
        </div>
      </div>

      <div className="flex w-full items-center justify-center px-6 py-12 lg:px-16">
        <div className="w-full max-w-sm">{children}</div>
      </div>
    </div>
  );
}
