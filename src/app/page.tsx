import { Header } from "@/components/Header";
import { HeroSection } from "@/components/HeroSection";
import { ConversationDemo } from "@/components/ConversationDemo";
import { ProblemSection } from "@/components/ProblemSection";
import { SolutionSection } from "@/components/SolutionSection";
import { HowItWorksSection } from "@/components/HowItWorksSection";
import { FeaturesSection } from "@/components/FeaturesSection";
import { DashboardPreview } from "@/components/DashboardPreview";
import { ROICalculator } from "@/components/ROICalculator";
import { PricingSection } from "@/components/PricingSection";
import { FAQSection } from "@/components/FAQSection";
import { FinalCTA } from "@/components/FinalCTA";
import { Footer } from "@/components/Footer";

export const metadata = {
  title: "CLOSER — Agent commercial IA pour e-commerce marocain",
  description: "Votre agent commercial automatique pour WhatsApp et Instagram. Confirmations COD, recommandations produits, suivi client — en darija, arabe et français.",
};

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white text-[#0a0a0a] selection:bg-[#c2185b]/10">
      <Header />
      <main>
        <HeroSection />
        <ConversationDemo />
        <ProblemSection />
        <SolutionSection />
        <HowItWorksSection />
        <FeaturesSection />
        <DashboardPreview />
        <ROICalculator />
        <PricingSection />
        <FAQSection />
        <FinalCTA />
      </main>
      <Footer />
    </div>
  );
}
