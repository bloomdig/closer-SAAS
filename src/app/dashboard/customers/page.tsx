export default function CustomersPage() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-[28px] font-extrabold tracking-[-0.03em] text-[#0a0a0a]">Clients</h1>
        <p className="mt-1 text-[14px] text-[#6b6b6b]">Gérez votre base de clients et leur historique.</p>
      </div>
      <div className="rounded-[24px] border border-[#eaeaea] bg-white shadow-[0_4px_20px_rgba(0,0,0,0.03)] overflow-hidden">
        <table className="w-full text-[13px]">
          <thead className="bg-[#fafafa] border-b border-[#eaeaea] text-[10px] font-extrabold uppercase tracking-[0.1em] text-[#9a9a9a]">
            <tr>
              <th className="text-left px-6 py-4">Nom</th>
              <th className="text-left px-6 py-4">Téléphone</th>
              <th className="text-left px-6 py-4">Commandes</th>
              <th className="text-left px-6 py-4">Dernier contact</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#eaeaea]">
            {[
              { name: "Karim Idrissi", phone: "+212 612 345 678", orders: 5, last: "2 min" },
              { name: "Sara Benali", phone: "+212 661 234 567", orders: 3, last: "15 min" },
              { name: "Amine El Fassi", phone: "+212 601 987 654", orders: 8, last: "32 min" },
            ].map((c) => (
              <tr key={c.name} className="hover:bg-[#fafafa] transition">
                <td className="px-6 py-4 font-bold text-[#0a0a0a]">{c.name}</td>
                <td className="px-6 py-4 text-[#6b6b6b]">{c.phone}</td>
                <td className="px-6 py-4 font-medium text-[#0a0a0a]">{c.orders}</td>
                <td className="px-6 py-4 text-[11px] text-[#9a9a9a]">{c.last}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
