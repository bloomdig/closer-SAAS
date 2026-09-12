import { Sparkles, ArrowRight, CheckCircle2 } from "lucide-react";

export function HeroSection() {
  return (
    <section className="relative overflow-hidden bg-white">
      <div className="mx-auto max-w-6xl px-6 lg:px-10 pt-20 pb-14 md:pt-28 md:pb-20">
        <div className="mx-auto max-w-3xl text-center">
          <a href="#fonctionnalites" className="inline-flex items-center gap-2 rounded-full border border-[#eaeaea] bg-[#fafafa] px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#6b6b6b] transition hover:border-[#c2185b]/20 hover:text-[#0a0a0a]">
            <Sparkles className="h-3.5 w-3.5 text-[#c2185b]" strokeWidth={2.5} />
            Votre agent commercial pour WhatsApp et Instagram
          </a>

          <h1 className="mt-7 text-[42px] font-extrabold leading-[1.08] tracking-[-0.03em] text-[#0a0a0a] md:text-[58px] lg:text-[64px]">
            Transformez vos conversations en <span className="text-[#c2185b]">commandes confirmées</span>.
          </h1>

          <p className="mx-auto mt-7 max-w-xl text-[17px] leading-[1.65] text-[#6b6b6b] md:text-[19px]">
            <strong className="font-extrabold text-[#0a0a0a]">CLOSER</strong> est votre agent commercial pour le e-commerce marocain. Il répond aux clients, recommande vos produits, confirme les commandes COD et suit automatiquement — en darija, arabe et français.
          </p>

          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <a href="/signup" className="inline-flex items-center gap-2.5 rounded-full bg-[#c2185b] px-7 py-3.5 text-[14px] font-extrabold text-white shadow-[0_2px_16px_rgba(194,24,91,0.22)] transition hover:bg-[#a8144a] hover:shadow-[0_4px_20px_rgba(194,24,91,0.3)] hover:-translate-y-0.5">
              Démarrer l'essai gratuit <ArrowRight className="h-4 w-4" />
            </a>
            <a href="#solution" className="inline-flex items-center gap-2 rounded-full border border-[#eaeaea] bg-white px-7 py-3.5 text-[14px] font-semibold text-[#0a0a0a] shadow-[0_1px_6px_rgba(0,0,0,0.04)] transition hover:border-[#0a0a0a]/15 hover:shadow-[0_2px_10px_rgba(0,0,0,0.06)] hover:-translate-y-0.5">
              Voir comment ça marche
            </a>
          </div>

          <div className="mt-5 flex items-center justify-center gap-6 text-[12px] font-medium text-[#9a9a9a]">
            <span className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-[#c2185b]" strokeWidth={2.5} /> 7 jours gratuits</span>
            <span className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-[#c2185b]" strokeWidth={2.5} /> Sans engagement</span>
            <span className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-[#c2185b]" strokeWidth={2.5} /> Annulation possible</span>
          </div>
        </div>
      </div>
    </section>
  );
}
