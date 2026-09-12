import { Sparkles } from "lucide-react";

export function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-[#fafafa]">
      <div className="flex w-full flex-col lg:flex-row">
        <div className="relative hidden w-1/2 overflow-hidden lg:block bg-[#0a0a0a]">
          <img src="https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=800&q=80" alt="Commerce" className="h-full w-full object-cover opacity-40" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#0a0a0a]/60 to-transparent" />
          <div className="absolute bottom-12 left-12 max-w-sm">
            <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-[#c2185b] shadow-sm shadow-[#c2185b]/25">
              <Sparkles className="h-5 w-5 text-white" strokeWidth={2.5} />
            </div>
            <h2 className="text-2xl font-extrabold text-white leading-tight">Votre agent commercial ne dort jamais.</h2>
            <p className="mt-3 text-sm text-[#9a9a9a] leading-relaxed">CLOSER transforme vos conversations WhatsApp en commandes confirmées — en darija, arabe et français.</p>
          </div>
        </div>
        <div className="flex w-full items-center justify-center px-6 py-12 lg:w-1/2 lg:px-14 bg-white">
          <div className="w-full max-w-md">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
