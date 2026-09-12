import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "CLOSER — Agent commercial IA pour e-commerce marocain",
  description: "Votre agent commercial automatique pour WhatsApp et Instagram. Confirmations COD, recommandations produits, suivi client — en darija, arabe et français.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fr">
      <body className="bg-white text-[#0a0a0a] antialiased">{children}</body>
    </html>
  );
}
