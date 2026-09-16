import { Plug, Database, Bot, TrendingUp } from "lucide-react";

const steps = [
  { num: "01", title: "Connectez vos canaux", desc: "Reliez WhatsApp, Instagram ou le chat web à CLOSER.", icon: Plug },
  { num: "02", title: "Ajoutez vos produits", desc: "Téléchargez vos produits, prix, frais de livraison, zones et promotions.", icon: Database },
  { num: "03", title: "Activez l’agent", desc: "Activez l’agent IA et configurez vos préférences de langue : darija, arabe, français.", icon: Bot },
  { num: "04", title: "Convertissez", desc: "Regardez vos clients devenir des commandes confirmées — automatiquement.", icon: TrendingUp },
];

export function HowItWorksSection() {
  return (
    <section id="fonctionnement" className="bg-[#f6f4ee] py-24 md:py-32">
      <div className="mx-auto max-w-6xl px-6 lg:px-10">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="mt-4 font-display text-[28px] font-medium tracking-[-0.01em] leading-[1.15] text-[#14181f] md:text-[34px]">4 étapes vers la vente automatisée.</h2>
        </div>

        <div className="mt-16 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
          {steps.map((s) => (
            <div key={s.num} className="relative border-l-2 border-[#e4e0d3] pl-5">
              <span className="font-display text-[13px] font-medium text-[#a9762e]">{s.num}</span>
              <div className="mb-4 mt-3 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-[#eaf2f2] text-[#1e5f6e]">
                <s.icon className="h-5 w-5" strokeWidth={2} />
              </div>
              <h3 className="text-[15px] font-semibold text-[#14181f]">{s.title}</h3>
              <p className="mt-2 text-[13px] leading-[1.6] text-[#6b6558]">{s.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
