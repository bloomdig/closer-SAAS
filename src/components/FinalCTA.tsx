export function FinalCTA() {
  return (
    <section className="bg-[#14181f] py-24 md:py-28">
      <div className="mx-auto max-w-2xl px-6 text-center lg:px-10">
        <h2 className="font-display text-[30px] font-medium leading-[1.15] tracking-[-0.01em] text-white md:text-[38px]">
          Transformez vos conversations WhatsApp en commandes confirmées.
        </h2>
        <p className="mx-auto mt-5 max-w-md text-[15px] leading-[1.65] text-[#a8a396]">
          Essai gratuit de 7 jours. Sans engagement.
        </p>
        <a
          href="/signup"
          className="mt-9 inline-flex items-center gap-2 rounded-lg bg-white px-7 py-3.5 text-[14px] font-semibold text-[#14181f] transition hover:bg-[#f0eee7]"
        >
          Démarrer l’essai gratuit
        </a>
      </div>
    </section>
  );
}
