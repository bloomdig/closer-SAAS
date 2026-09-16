import Link from "next/link";
import { Sparkles, ArrowRight } from "lucide-react";
import { AuthLayout } from "@/components/AuthLayout";

export const metadata = {
  title: "Inscription — CLOSER",
};

export default function SignupPage() {
  return (
    <AuthLayout>
      <div className="flex items-center gap-2.5 mb-8">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#1e5f6e]">
          <Sparkles className="h-5 w-5 text-white" strokeWidth={2.5} />
        </div>
        <span className="font-display text-[18px] font-medium tracking-tight text-[#14181f]">CLOSER</span>
      </div>
      <h1 className="font-display text-[26px] font-medium tracking-[-0.01em] text-[#14181f] leading-tight">Commencez votre essai gratuit</h1>
      <p className="mt-3 text-[14px] text-[#6b6558] leading-relaxed">Créez votre espace de travail et commencez à vendre automatiquement en 7 jours.</p>
      <form className="mt-8 space-y-4" action="/api/auth/signup" method="POST">
        <input type="text" name="fullName" placeholder="Nom complet" required className="w-full rounded-lg border border-[#d3cdba] bg-white px-3.5 py-3 text-[14px] text-[#14181f] placeholder:text-[#9b9587] focus:border-[#1e5f6e] focus:outline-none focus:ring-1 focus:ring-[#1e5f6e]/20 transition" />
        <input type="text" name="businessName" placeholder="Nom de l’entreprise" required className="w-full rounded-lg border border-[#d3cdba] bg-white px-3.5 py-3 text-[14px] text-[#14181f] placeholder:text-[#9b9587] focus:border-[#1e5f6e] focus:outline-none focus:ring-1 focus:ring-[#1e5f6e]/20 transition" />
        <input type="email" name="email" placeholder="Adresse e-mail" required className="w-full rounded-lg border border-[#d3cdba] bg-white px-3.5 py-3 text-[14px] text-[#14181f] placeholder:text-[#9b9587] focus:border-[#1e5f6e] focus:outline-none focus:ring-1 focus:ring-[#1e5f6e]/20 transition" />
        <input type="tel" name="phone" placeholder="Numéro de téléphone (+212 ...)" required className="w-full rounded-lg border border-[#d3cdba] bg-white px-3.5 py-3 text-[14px] text-[#14181f] placeholder:text-[#9b9587] focus:border-[#1e5f6e] focus:outline-none focus:ring-1 focus:ring-[#1e5f6e]/20 transition" />
        <input type="password" name="password" placeholder="Mot de passe" required className="w-full rounded-lg border border-[#d3cdba] bg-white px-3.5 py-3 text-[14px] text-[#14181f] placeholder:text-[#9b9587] focus:border-[#1e5f6e] focus:outline-none focus:ring-1 focus:ring-[#1e5f6e]/20 transition" />
        <button type="submit" className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#14181f] py-3 text-[14px] font-semibold text-white transition hover:bg-[#252b38]">
          Créer mon compte <ArrowRight className="h-4 w-4" />
        </button>
      </form>
      <p className="mt-6 text-center text-[12px] text-[#6b6558]">
        Déjà un compte ? <Link href="/login" className="font-semibold text-[#1e5f6e] hover:text-[#164a56] transition">Se connecter</Link>
      </p>
    </AuthLayout>
  );
}
