import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Fraunces, Public_Sans } from "next/font/google";
import "./globals.css";

/**
 * Typographie de marque CLOSER.
 * - Fraunces (serif à personnalité, optical sizing) : titres marketing.
 * - Public Sans (grotesk dense, lisible en tableau) : interface produit.
 * Choix délibéré pour sortir du duo Inter/Helvetica par défaut.
 */
const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-display-family",
  axes: ["opsz", "SOFT", "WONK"],
  weight: ["400", "500", "600"],
});

const publicSans = Public_Sans({
  subsets: ["latin"],
  variable: "--font-sans-family",
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "CLOSER — Agent commercial IA pour e-commerce marocain",
  description: "Votre agent commercial automatique pour WhatsApp et Instagram. Confirmations COD, recommandations produits, suivi client — en darija, arabe et français.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fr" className={`${fraunces.variable} ${publicSans.variable}`}>
      <body className="bg-[var(--color-canvas)] text-[var(--color-ink)] antialiased">{children}</body>
    </html>
  );
}
