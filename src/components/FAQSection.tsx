"use client";
import { useState } from "react";
import { Plus, Minus } from "lucide-react";

const faqs = [
  { q: "Comment l'IA comprend-elle le darija et l'arabe ?", a: "CLOSER est conçu pour les expressions marocaines. Il comprend le darija, l'arabe marocain, le français et les messages qui mélangent les trois. Il reconnaît les noms de produits, les prix en DH et les expressions courantes des clients." },
  { q: "Est-ce que ça marche avec WhatsApp ?", a: "Oui. CLOSER se connecte à WhatsApp et répond en temps réel. Il supporte aussi Instagram et le chat web." },
  { q: "L'IA peut-elle confirmer des commandes COD ?", a: "Oui. L'agent collecte le nom du client, l'adresse, le produit choisi, la quantité et la zone de livraison, puis confirme automatiquement la commande COD." },
  { q: "Quelles langues parle CLOSER ?", a: "Le darija, l'arabe marocain, le français et toute combinaison des trois. Vous pouvez configurer vos préférences dans le tableau de bord." },
  { q: "Y a-t-il un essai gratuit ?", a: "Oui. Chaque compte démarre avec 7 jours d'essai gratuit. Aucune carte de crédit requise. Vous pouvez annuler à tout moment." },
  { q: "Comment fonctionne la tarification ?", a: "Nous proposons Starter (299 DH/mois), Pro (599 DH/mois) et Business (999 DH/mois). L'administration peut configurer les prix. Tous les forfaits incluent 7 jours d'essai." },
  { q: "Puis-je annuler mon abonnement ?", a: "Oui. Vous pouvez annuler à tout moment depuis votre tableau de bord. Vos données sont conservées et vous pouvez vous réabonner plus tard." },
  { q: "Qu'en est-il de mes données ?", a: "Vos données vous appartiennent. Nous ne partageons pas les données des clients. Toutes les conversations et commandes appartiennent à votre compte." },
  { q: "Un humain peut-il reprendre une conversation ?", a: "Oui. À tout moment, vous ou votre équipe pouvez reprendre une conversation manuellement. L'agent IA arrête alors de répondre dans ce fil." },
  { q: "Qu'est-ce qu'une commande COD ?", a: "COD signifie Paiement à la livraison (Cash on Delivery). CLOSER confirme tous les détails et enregistre la commande avec le statut COD." },
];

export function FAQSection() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <section className="bg-white py-24 md:py-32">
      <div className="mx-auto max-w-3xl px-6 lg:px-10">
        <div className="text-center">
          <span className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-[#c2185b]">FAQ</span>
          <h2 className="mt-4 text-[32px] font-extrabold tracking-[-0.03em] leading-[1.1] text-[#0a0a0a] md:text-[42px]">Questions fréquentes.</h2>
        </div>
        <div className="mt-12 space-y-3">
          {faqs.map((faq, i) => (
            <div key={i} className="rounded-2xl border border-[#eaeaea] bg-white overflow-hidden">
              <button onClick={() => setOpen(open === i ? null : i)} className="flex w-full items-center justify-between px-6 py-5 text-left">
                <span className="text-[14px] font-extrabold text-[#0a0a0a]">{faq.q}</span>
                {open === i ? <Minus className="h-4 w-4 text-[#c2185b] shrink-0 ml-4" strokeWidth={2.5} /> : <Plus className="h-4 w-4 text-[#9a9a9a] shrink-0 ml-4" strokeWidth={2.5} />}
              </button>
              <div className={`transition-all duration-300 ease-in-out overflow-hidden ${open === i ? "max-h-96 px-6 pb-5" : "max-h-0"}`}>
                <p className="text-[13px] leading-[1.6] text-[#6b6b6b]">{faq.a}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
