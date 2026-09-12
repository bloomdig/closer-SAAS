import { Sparkles } from "lucide-react";

export function ConversationDemo() {
  return (
    <section className="mx-auto max-w-6xl px-6 lg:px-10 pb-20 md:pb-28">
      <div className="mx-auto max-w-[640px] rounded-[24px] border border-[#eaeaea] bg-[#fafafa] p-6 shadow-[0_24px_60px_rgba(0,0,0,0.06)] md:p-10">
        <div className="mb-6 flex items-center gap-3">
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-[10px] font-extrabold uppercase tracking-[0.15em] text-[#9a9a9a]">Conversation WhatsApp — en direct</span>
        </div>

        <div className="space-y-4">
          <div className="flex gap-3">
            <div className="h-8 w-8 shrink-0 rounded-full bg-[#0a0a0a] flex items-center justify-center text-[10px] font-extrabold text-white">AM</div>
            <div className="rounded-2xl rounded-tl-sm bg-white px-4 py-3 text-[14px] leading-relaxed text-[#0a0a0a] border border-[#eaeaea] shadow-[0_1px_3px_rgba(0,0,0,0.03)]">
              Salam, had robe kayna en noir ?
            </div>
          </div>
          <div className="flex gap-3 flex-row-reverse">
            <div className="h-8 w-8 shrink-0 rounded-full bg-[#c2185b] flex items-center justify-center shadow-[0_2px_8px_rgba(194,24,91,0.2)]">
              <Sparkles className="h-4 w-4 text-white" strokeWidth={2.5} />
            </div>
            <div className="rounded-2xl rounded-tr-sm bg-[#c2185b] px-4 py-3 text-[14px] leading-relaxed text-white shadow-[0_2px_8px_rgba(194,24,91,0.15)]">
              Salam 👋 Oui, kayna en noir. Taman dyalha <strong>349 DH</strong>. Bghiti nconfirmi lik wa7da ?
            </div>
          </div>
          <div className="flex gap-3">
            <div className="h-8 w-8 shrink-0 rounded-full bg-[#0a0a0a] flex items-center justify-center text-[10px] font-extrabold text-white">AM</div>
            <div className="rounded-2xl rounded-tl-sm bg-white px-4 py-3 text-[14px] leading-relaxed text-[#0a0a0a] border border-[#eaeaea] shadow-[0_1px_3px_rgba(0,0,0,0.03)]">
              Oui ana f Casa
            </div>
          </div>
          <div className="flex gap-3 flex-row-reverse">
            <div className="h-8 w-8 shrink-0 rounded-full bg-[#c2185b] flex items-center justify-center shadow-[0_2px_8px_rgba(194,24,91,0.2)]">
              <Sparkles className="h-4 w-4 text-white" strokeWidth={2.5} />
            </div>
            <div className="rounded-2xl rounded-tr-sm bg-[#c2185b] px-4 py-3 text-[14px] leading-relaxed text-white shadow-[0_2px_8px_rgba(194,24,91,0.15)]">
              Perfect. Livraison à Casablanca katkon b <strong>20 DH</strong>. Sift lia smiytek w l'adresse bach nconfirmi lik la commande.
            </div>
          </div>
          <div className="flex gap-3">
            <div className="h-8 w-8 shrink-0 rounded-full bg-[#0a0a0a] flex items-center justify-center text-[10px] font-extrabold text-white">AM</div>
            <div className="rounded-2xl rounded-tl-sm bg-white px-4 py-3 text-[14px] leading-relaxed text-[#0a0a0a] border border-[#eaeaea] shadow-[0_1px_3px_rgba(0,0,0,0.03)]">
              Amine El Fassi, 123 Rue Zerktouni
            </div>
          </div>
          <div className="flex gap-3 flex-row-reverse">
            <div className="h-8 w-8 shrink-0 rounded-full bg-[#c2185b] flex items-center justify-center shadow-[0_2px_8px_rgba(194,24,91,0.2)]">
              <Sparkles className="h-4 w-4 text-white" strokeWidth={2.5} />
            </div>
            <div className="rounded-2xl rounded-tr-sm bg-[#c2185b] px-4 py-3 text-[14px] leading-relaxed text-white shadow-[0_2px_8px_rgba(194,24,91,0.15)]">
              ✅ Commande confirmée : <strong>Robe Noire — 349 DH + 20 DH livraison</strong>. Total : <strong>369 DH</strong>. Paiement à la livraison (COD).
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
