import { ArrowRight } from "lucide-react";
import { ConversationDemo } from "@/components/ConversationDemo";

export function HeroSection() {
  return (
    <section className="border-b border-[#e4e0d3] bg-white">
      <div className="mx-auto grid max-w-6xl gap-14 px-6 pb-20 pt-16 md:pt-24 md:pb-24 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:px-10">
        <div>
          <h1 className="font-display text-[38px] font-medium leading-[1.12] tracking-[-0.02em] text-[#14181f] md:text-[50px]">
            L’agent commercial qui répond à votre place sur WhatsApp.
          </h1>

          <p className="mt-6 max-w-lg text-[16px] leading-[1.7] text-[#3f4552] md:text-[17px]">
            CLOSER discute avec vos clients en darija, en arabe et en français, recommande vos produits,
            confirme les commandes en paiement à la livraison et relance automatiquement — sans jamais
            inventer un prix, un stock ou un délai qui n’existe pas dans votre catalogue.
          </p>

          <div className="mt-9 flex flex-wrap items-center gap-5">
            <a
              href="/signup"
              className="inline-flex items-center gap-2 rounded-lg bg-[#14181f] px-6 py-3 text-[14px] font-semibold text-white transition hover:bg-[#252b38]"
            >
              Démarrer l’essai gratuit <ArrowRight className="h-4 w-4" />
            </a>
            <a href="#solution" className="text-[14px] font-medium text-[#3f4552] underline decoration-[#d3cdba] underline-offset-4 transition hover:text-[#14181f]">
              Voir comment ça marche
            </a>
          </div>

          <p className="mt-8 text-[13px] text-[#6b6558]">
            7 jours d’essai gratuit · sans engagement · résiliable à tout moment
          </p>
        </div>

        <ConversationDemo standalone={false} />
      </div>
    </section>
  );
}
