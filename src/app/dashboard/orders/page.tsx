import { ShieldCheck, Clock, Truck, CheckCircle, XCircle, RotateCcw } from "lucide-react";

const orders = [
  { id: "#1248", customer: "Karim Idrissi", product: "Robe Noire Élégante", total: "349 DH", status: "Confirmée", method: "COD", time: "2 min" },
  { id: "#1247", customer: "Sara Benali", product: "Veste en Denim", total: "279 DH", status: "En préparation", method: "COD", time: "15 min" },
  { id: "#1246", customer: "Amine El Fassi", product: "Pantalon Beige", total: "199 DH", status: "Expédiée", method: "COD", time: "32 min" },
  { id: "#1245", customer: "Leïla Hassan", product: "Robe Noire Élégante", total: "349 DH", status: "Livrée", method: "COD", time: "1 h" },
];

const statusConfig: Record<string, { label: string; color: string; icon: any }> = {
  "Nouvelle": { label: "Nouvelle", color: "bg-[#fafafa] text-[#6b6b6b] border border-[#eaeaea]", icon: Clock },
  "À confirmer": { label: "À confirmer", color: "bg-amber-50 text-amber-700", icon: Clock },
  "Confirmée": { label: "Confirmée", color: "bg-emerald-50 text-emerald-700", icon: ShieldCheck },
  "En préparation": { label: "En préparation", color: "bg-blue-50 text-blue-700", icon: RotateCcw },
  "Expédiée": { label: "Expédiée", color: "bg-purple-50 text-purple-700", icon: Truck },
  "Livrée": { label: "Livrée", color: "bg-emerald-50 text-emerald-700", icon: CheckCircle },
  "Refusée": { label: "Refusée", color: "bg-red-50 text-red-700", icon: XCircle },
  "Annulée": { label: "Annulée", color: "bg-[#fafafa] text-[#6b6b6b] border border-[#eaeaea]", icon: XCircle },
  "Retournée": { label: "Retournée", color: "bg-amber-50 text-amber-700", icon: RotateCcw },
};

export default function OrdersPage() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-[28px] font-extrabold tracking-[-0.03em] text-[#0a0a0a]">Commandes</h1>
        <p className="mt-1 text-[14px] text-[#6b6b6b]">Gérez les commandes COD et suivez leur progression.</p>
      </div>

      <div className="grid gap-3 md:grid-cols-4 mb-6">
        {["Nouvelle", "À confirmer", "Confirmée", "Expédiée", "Livrée", "Refusée", "Annulée", "Retournée"].map((s) => {
          const cfg = statusConfig[s];
          return (
            <a key={s} href="#" className="rounded-xl border border-[#eaeaea] bg-white p-4 text-center transition hover:border-[#c2185b]/15 hover:shadow-[0_2px_8px_rgba(0,0,0,0.03)] hover:-translate-y-0.5">
              <span className={`inline-block rounded-full px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wide ${cfg.color}`}>{s}</span>
            </a>
          );
        })}
      </div>

      <div className="rounded-[24px] border border-[#eaeaea] bg-white shadow-[0_4px_20px_rgba(0,0,0,0.03)] overflow-hidden">
        <table className="w-full text-[13px]">
          <thead className="bg-[#fafafa] border-b border-[#eaeaea] text-[10px] font-extrabold uppercase tracking-[0.1em] text-[#9a9a9a]">
            <tr>
              <th className="text-left px-6 py-4">N° Commande</th>
              <th className="text-left px-6 py-4">Client</th>
              <th className="text-left px-6 py-4">Produit</th>
              <th className="text-left px-6 py-4">Total</th>
              <th className="text-left px-6 py-4">Statut</th>
              <th className="text-left px-6 py-4">Mode</th>
              <th className="text-left px-6 py-4">Temps</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#eaeaea]">
            {orders.map((o) => {
              const cfg = statusConfig[o.status] || statusConfig["Nouvelle"];
              return (
                <tr key={o.id} className="hover:bg-[#fafafa] transition">
                  <td className="px-6 py-4 font-extrabold text-[#0a0a0a]">{o.id}</td>
                  <td className="px-6 py-4 font-semibold text-[#0a0a0a]">{o.customer}</td>
                  <td className="px-6 py-4 text-[#6b6b6b]">{o.product}</td>
                  <td className="px-6 py-4 font-extrabold text-[#0a0a0a]">{o.total}</td>
                  <td className="px-6 py-4"><span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wide ${cfg.color}`}><cfg.icon className="h-3 w-3" strokeWidth={2.5} /> {o.status}</span></td>
                  <td className="px-6 py-4"><span className="font-extrabold text-[#c2185b]">{o.method}</span></td>
                  <td className="px-6 py-4 text-[11px] text-[#9a9a9a]">{o.time}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
