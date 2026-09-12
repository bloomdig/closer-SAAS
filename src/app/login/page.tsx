import Link from "next/link";
import { Sparkles, ArrowRight } from "lucide-react";
import { AuthLayout } from "@/components/AuthLayout";

export const metadata = {
  title: "Connexion — CLOSER",
};

export default function LoginPage() {
  return (
    <AuthLayout>
      <div className="flex items-center gap-2.5 mb-8">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#c2185b] shadow-sm shadow-[#c2185b]/20">
          <Sparkles className="h-5 w-5 text-white" strokeWidth={2.5} />
        </div>
        <span className="text-xl font-extrabold tracking-tight text-[#0a0a0a]">CLOSER</span>
      </div>
      <h1 className="text-[28px] font-extrabold tracking-[-0.03em] text-[#0a0a0a] leading-tight">Bienvenue.</h1>
      <p className="mt-3 text-[14px] text-[#6b6b6b] leading-relaxed">Connectez-vous pour gérer votre agent commercial et suivre vos ventes.</p>
      <form className="mt-8 space-y-4" action="/api/auth/login" method="POST">
        <input type="email" name="email" placeholder="Adresse e-mail" required className="w-full rounded-xl border border-[#eaeaea] bg-[#fafafa] px-4 py-3.5 text-[14px] text-[#0a0a0a] placeholder:text-[#9a9a9a] focus:border-[#c2185b]/30 focus:outline-none focus:ring-1 focus:ring-[#c2185b]/10 transition" />
        <input type="password" name="password" placeholder="Mot de passe" required className="w-full rounded-xl border border-[#eaeaea] bg-[#fafafa] px-4 py-3.5 text-[14px] text-[#0a0a0a] placeholder:text-[#9a9a9a] focus:border-[#c2185b]/30 focus:outline-none focus:ring-1 focus:ring-[#c2185b]/10 transition" />
        <button type="submit" className="w-full rounded-full bg-[#c2185b] py-3.5 text-[14px] font-extrabold text-white shadow-[0_2px_12px_rgba(194,24,91,0.22)] transition hover:bg-[#a8144a] hover:shadow-[0_4px_16px_rgba(194,24,91,0.3)] hover:-translate-y-0.5 flex items-center justify-center gap-2">
          Se connecter <ArrowRight className="h-4 w-4" />
        </button>
      </form>
      <p className="mt-6 text-center text-[12px] text-[#6b6b6b]">
        Pas encore de compte ? <Link href="/signup" className="font-extrabold text-[#c2185b] hover:text-[#a8144a] transition">Créer un compte</Link>
      </p>
    </AuthLayout>
  );
}
