export default function AutomationsPage() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-[28px] font-extrabold tracking-[-0.03em] text-[#0a0a0a]">Automatisations</h1>
        <p className="mt-1 text-[14px] text-[#6b6b6b]">Configurez vos réponses automatiques et vos relances.</p>
      </div>
      <div className="rounded-[24px] border border-[#eaeaea] bg-white p-10 shadow-[0_4px_20px_rgba(0,0,0,0.03)]">
        <h2 className="text-[17px] font-extrabold text-[#0a0a0a] mb-4">Agent commercial</h2>
        <p className="text-[14px] text-[#6b6b6b] mb-5">Votre agent commercial est actif et répond automatiquement aux messages clients dans la langue qu'ils utilisent.</p>
        <a href="#" className="inline-flex items-center gap-2 rounded-full bg-[#c2185b] px-5 py-2.5 text-[13px] font-extrabold text-white shadow-[0_2px_12px_rgba(194,24,91,0.2)] hover:bg-[#a8144a] transition hover:-translate-y-0.5">Modifier les instructions</a>
      </div>
    </div>
  );
}
