import { Send, Bot, User, Clock, Phone, MapPin, Package, ShieldCheck } from "lucide-react";

export default function ChatPage() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-[28px] font-extrabold tracking-[-0.03em] text-[#0a0a0a]">Conversations</h1>
        <p className="mt-1 text-[14px] text-[#6b6b6b]">Surveillez et répondez aux messages clients en temps réel.</p>
      </div>

      <div className="flex h-[calc(100vh-200px)] rounded-[24px] border border-[#eaeaea] bg-white overflow-hidden shadow-[0_4px_20px_rgba(0,0,0,0.03)]">
        {/* Colonne 1 - Liste */}
        <div className="w-[320px] border-r border-[#eaeaea] bg-[#fafafa] flex flex-col">
          <div className="p-4 border-b border-[#eaeaea]">
            <h2 className="text-[13px] font-extrabold text-[#0a0a0a]">Conversations</h2>
            <p className="text-[11px] text-[#9a9a9a]">3 actives</p>
          </div>
          <div className="flex-1 overflow-y-auto divide-y divide-[#eaeaea]">
            {[
              { name: "Karim Idrissi", msg: "Bghiti nconfirmi lik wa7da ?", time: "2 min", active: true },
              { name: "Sara Benali", msg: "Salam, had robe kayna ?", time: "15 min", active: false },
              { name: "Amine El Fassi", msg: "Livraison à Marrakech bch7al ?", time: "32 min", active: false },
            ].map((c) => (
              <a key={c.name} href="#" className={`flex items-start gap-3 px-4 py-4 transition hover:bg-white ${c.active ? "bg-white border-l-2 border-[#c2185b]" : ""}`}>
                <div className="h-9 w-9 shrink-0 rounded-full bg-[#0a0a0a] text-white flex items-center justify-center text-[10px] font-extrabold">{c.name.split(" ").map((n) => n[0]).join("")}</div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <p className={`text-[13px] font-bold truncate ${c.active ? "text-[#0a0a0a]" : "text-[#6b6b6b]"}`}>{c.name}</p>
                    <span className="text-[10px] text-[#9a9a9a]">{c.time}</span>
                  </div>
                  <p className="text-[12px] text-[#9a9a9a] truncate">{c.msg}</p>
                </div>
              </a>
            ))}
          </div>
        </div>

        {/* Colonne 2 - Conversation */}
        <div className="flex-1 flex flex-col">
          <div className="flex items-center gap-3 px-6 py-4 border-b border-[#eaeaea] bg-white">
            <div className="h-9 w-9 rounded-full bg-[#0a0a0a] text-white flex items-center justify-center text-[10px] font-extrabold">KI</div>
            <div>
              <h3 className="text-[14px] font-extrabold text-[#0a0a0a]">Karim Idrissi</h3>
              <p className="text-[11px] text-[#6b6b6b]">WhatsApp • Actif</p>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-[#fafafa]">
            <div className="flex gap-3">
              <div className="h-8 w-8 shrink-0 rounded-full bg-[#0a0a0a] text-white flex items-center justify-center text-[10px] font-extrabold">KI</div>
              <div className="rounded-2xl rounded-tl-sm bg-white border border-[#eaeaea] px-4 py-3 text-[14px] leading-relaxed text-[#0a0a0a] shadow-[0_1px_3px_rgba(0,0,0,0.03)] max-w-[80%]">
                Salam, had robe kayna en noir ?
              </div>
            </div>
            <div className="flex gap-3 flex-row-reverse">
              <div className="h-8 w-8 shrink-0 rounded-full bg-[#c2185b] text-white flex items-center justify-center shadow-[0_2px_8px_rgba(194,24,91,0.2)]">
                <Bot className="h-3.5 w-3.5" strokeWidth={2.5} />
              </div>
              <div className="rounded-2xl rounded-tr-sm bg-[#c2185b] px-4 py-3 text-[14px] leading-relaxed text-white shadow-[0_2px_8px_rgba(194,24,91,0.15)] max-w-[80%]">
                Salam 👋 Oui, kayna en noir. Taman dyalha <strong>349 DH</strong>. Bghiti nconfirmi lik wa7da ?
              </div>
            </div>
          </div>

          <div className="p-4 bg-white border-t border-[#eaeaea]">
            <div className="flex items-center gap-3">
              <input type="text" placeholder="Écrivez un message..." className="flex-1 rounded-full border border-[#eaeaea] bg-[#fafafa] px-5 py-3 text-[14px] text-[#0a0a0a] placeholder:text-[#9a9a9a] focus:outline-none focus:border-[#c2185b]/30 focus:ring-1 focus:ring-[#c2185b]/10 transition" />
              <button className="flex h-10 w-10 items-center justify-center rounded-full bg-[#c2185b] text-white shadow-[0_2px_8px_rgba(194,24,91,0.2)] hover:bg-[#a8144a] transition">
                <Send className="h-4 w-4" strokeWidth={2.5} />
              </button>
            </div>
          </div>
        </div>

        {/* Colonne 3 - Client / Commande */}
        <div className="w-[300px] border-l border-[#eaeaea] bg-white p-6">
          <h3 className="text-[13px] font-extrabold text-[#0a0a0a] mb-5">Informations client</h3>
          <div className="space-y-5">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-full bg-[#0a0a0a] text-white flex items-center justify-center text-[14px] font-extrabold">KI</div>
              <div>
                <p className="text-[14px] font-extrabold text-[#0a0a0a]">Karim Idrissi</p>
                <p className="text-[12px] text-[#6b6b6b]">Client depuis 3 mois</p>
              </div>
            </div>

            <div className="rounded-xl border border-[#eaeaea] bg-[#fafafa] p-4">
              <h4 className="text-[11px] font-extrabold uppercase tracking-[0.1em] text-[#9a9a9a] mb-3">Détails</h4>
              <div className="space-y-2.5 text-[13px]">
                <div className="flex items-center gap-2 text-[#6b6b6b]"><Phone className="h-3.5 w-3.5 text-[#c2185b]" strokeWidth={2} /> +212 612 345 678</div>
                <div className="flex items-center gap-2 text-[#6b6b6b]"><MapPin className="h-3.5 w-3.5 text-[#c2185b]" strokeWidth={2} /> Casablanca</div>
              </div>
            </div>

            <div className="rounded-xl border border-[#eaeaea] bg-[#fafafa] p-4">
              <h4 className="text-[11px] font-extrabold uppercase tracking-[0.1em] text-[#9a9a9a] mb-3">Produits concernés</h4>
              <div className="space-y-2.5">
                <div className="flex items-center justify-between text-[13px]">
                  <span className="font-medium text-[#0a0a0a]">Robe Noire Élégante</span>
                  <span className="font-extrabold text-[#0a0a0a]">349 DH</span>
                </div>
                <div className="flex items-center justify-between text-[13px]">
                  <span className="text-[#9a9a9a]">Quantité</span>
                  <span className="font-bold text-[#0a0a0a]">1</span>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-[#eaeaea] bg-[#fafafa] p-4">
              <h4 className="text-[11px] font-extrabold uppercase tracking-[0.1em] text-[#9a9a9a] mb-3">Statut commande</h4>
              <div className="flex items-center gap-2 text-[13px] font-bold text-emerald-600">
                <ShieldCheck className="h-4 w-4" strokeWidth={2} /> Confirmée — COD
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
