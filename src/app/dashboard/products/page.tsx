import Link from "next/link";
import { Plus, Package, ArrowUpRight } from "lucide-react";

export default function ProductsPage() {
  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-[28px] font-extrabold tracking-[-0.03em] text-[#0a0a0a]">Produits</h1>
          <p className="mt-1 text-[14px] text-[#6b6b6b]">Gérez votre catalogue pour l'agent commercial.</p>
        </div>
        <Link href="#" className="inline-flex items-center gap-2 rounded-full bg-[#c2185b] px-5 py-2.5 text-[13px] font-extrabold text-white shadow-[0_2px_12px_rgba(194,24,91,0.2)] hover:bg-[#a8144a] transition hover:-translate-y-0.5">
          <Plus className="h-4 w-4" strokeWidth={2.5} /> Ajouter un produit
        </Link>
      </div>

      <div className="rounded-[24px] border border-[#eaeaea] bg-white shadow-[0_4px_20px_rgba(0,0,0,0.03)] overflow-hidden">
        <table className="w-full text-[13px]">
          <thead className="bg-[#fafafa] border-b border-[#eaeaea] text-[10px] font-extrabold uppercase tracking-[0.1em] text-[#9a9a9a]">
            <tr>
              <th className="text-left px-6 py-4">Produit</th>
              <th className="text-left px-6 py-4">Prix</th>
              <th className="text-left px-6 py-4">Stock</th>
              <th className="text-left px-6 py-4">Statut</th>
              <th className="text-left px-6 py-4">Commandes</th>
              <th className="text-left px-6 py-4">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#eaeaea]">
            {[
              { name: "Robe Noire Élégante", price: "349 DH", stock: 15, status: "Disponible", orders: 12 },
              { name: "Veste en Denim", price: "279 DH", stock: 8, status: "Disponible", orders: 7 },
              { name: "Pantalon Beige", price: "199 DH", stock: 22, status: "Disponible", orders: 5 },
            ].map((p) => (
              <tr key={p.name} className="hover:bg-[#fafafa] transition">
                <td className="px-6 py-4 font-bold text-[#0a0a0a]">{p.name}</td>
                <td className="px-6 py-4 font-semibold text-[#0a0a0a]">{p.price}</td>
                <td className="px-6 py-4 text-[#6b6b6b]">{p.stock}</td>
                <td className="px-6 py-4"><span className="rounded-full bg-emerald-50 text-emerald-700 px-2.5 py-0.5 text-[10px] font-extrabold">{p.status}</span></td>
                <td className="px-6 py-4 font-medium text-[#0a0a0a]">{p.orders}</td>
                <td className="px-6 py-4">
                  <a href="#" className="text-[11px] font-extrabold text-[#c2185b] hover:underline">Modifier</a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
