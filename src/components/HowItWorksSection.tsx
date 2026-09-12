import { Plug, Database, Bot, TrendingUp } from "lucide-react";

const steps = [
  { num: "01", title: "Connectez vos canaux", desc: "Reliez WhatsApp, Instagram ou le chat web à CLOSER.", icon: Plug },
  { num: "02", title: "Ajoutez vos produits", desc: "Téléchargez vos produits, prix, frais de livraison, zones et promotions.", icon: Database },
  { num: "03", title: "Activez l'agent", desc: "Activez l'agent IA et configurez vos préférences de langue : darija, arabe, français.", icon: Bot },
  { num: "04", title: "Convertissez", desc: "Regardez vos clients devenir des commandes confirmées — automatiquement.", icon: TrendingUp },
];

export function HowItWorksSection() {
  return (
    <section id="fonctionnement" className="bg-[#fafafa] py-24 md:py-32">
      <div className="mx-auto max-w-6xl px-6 lg:px-10">
        <div className="mx-auto max-w-2xl text-center">
          <span className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-[#c2185b]">Comment ça marche</span>
          <h2 className="mt-4 text-[32px] font-extrabold tracking-[-0.03em] leading-[1.1] text-[#0a0a0a] md:text-[42px]">4 étapes vers la vente automatisée.</h2>
        </div>

        <div className="mt-16 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
          {steps.map((s) => (
            <div key={s.num} className="relative rounded-2xl border border-[#eaeaea] bg-white p-7">
              <span className="absolute -top-3 left-6 rounded-full bg-[#c2185b] px-3 py-1 text-[10px] font-extrabold text-white shadow-[0_2px_8px_rgba(194,24,91,0.25)]">ÉTAPE {s.num}</span>
              <div className="mb-5 mt-2 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-[#c2185b]/5 text-[#c2185b]">
                <s.icon className="h-5 w-5" strokeWidth={2} />
              </div>
              <h3 className="text-[16px] font-extrabold text-[#0a0a0a]">{s.title}</h3>
              <p className="mt-2.5 text-[13px] leading-[1.6] text-[#6b6b6b]">{s.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
