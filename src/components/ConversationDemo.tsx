import { Sparkles } from "lucide-react";

/**
 * Fil WhatsApp illustratif — contenu réel du produit (darija/français mêlés,
 * prix, livraison, confirmation COD), pas une décoration. Utilisé en pièce
 * centrale du hero (`standalone=false`) ou comme section autonome plus bas
 * dans la page si besoin.
 */
export function ConversationDemo({ standalone = true }: { standalone?: boolean }) {
  const panel = (
    <div className="rounded-2xl border border-[#e4e0d3] bg-[#f6f4ee] p-6 shadow-[0_20px_50px_rgba(20,24,31,0.08)] md:p-7">
      <div className="mb-5 flex items-center gap-2.5">
        <span className="h-2 w-2 rounded-full bg-[#3f7d4c]" />
        <span className="text-[11px] font-medium text-[#6b6558]">WhatsApp — conversation en cours</span>
      </div>

      <div className="space-y-3.5">
        <Bubble from="client" text="Salam, had robe kayna en noir ?" />
        <Bubble from="ai" text={<>Salam 👋 Oui, kayna en noir. Taman dyalha <strong>349 DH</strong>. Bghiti nconfirmi lik wa7da ?</>} />
        <Bubble from="client" text="Oui ana f Casa" />
        <Bubble from="ai" text={<>Perfect. Livraison à Casablanca katkon b <strong>20 DH</strong>. Sift lia smiytek w l’adresse bach nconfirmi lik la commande.</>} />
        <Bubble from="client" text="Amine El Fassi, 123 Rue Zerktouni" />
        <Bubble from="ai" text={<>✅ Commande confirmée : <strong>Robe Noire — 349 DH + 20 DH livraison</strong>. Total : <strong>369 DH</strong>. Paiement à la livraison.</>} />
      </div>
    </div>
  );

  if (!standalone) return panel;

  return (
    <section className="mx-auto max-w-6xl px-6 pb-20 lg:px-10 md:pb-28">
      <div className="mx-auto max-w-[560px]">{panel}</div>
    </section>
  );
}

function Bubble({ from, text }: { from: "client" | "ai"; text: React.ReactNode }) {
  const isAi = from === "ai";
  return (
    <div className={`flex gap-2.5 ${isAi ? "flex-row-reverse" : ""}`}>
      <div
        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold ${
          isAi ? "bg-[#1e5f6e] text-white" : "bg-[#14181f] text-white"
        }`}
      >
        {isAi ? <Sparkles className="h-3.5 w-3.5" strokeWidth={2.5} /> : "AM"}
      </div>
      <div
        className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 text-[13.5px] leading-relaxed ${
          isAi
            ? "rounded-tr-sm bg-[#1e5f6e] text-white"
            : "rounded-tl-sm border border-[#e4e0d3] bg-white text-[#14181f]"
        }`}
      >
        {text}
      </div>
    </div>
  );
}
