import { requireMerchantPage } from "@/lib/auth/guards";
import { getSettings } from "@/lib/repositories";
import { PageHeader } from "@/components/ui";
import { SettingsForm, type SettingsPayload } from "@/components/settings/SettingsForm";
import { can } from "@/lib/security/tenant";

export const dynamic = "force-dynamic";

/**
 * Paramètres du marchand (§8, §22, §23).
 * Toutes les valeurs alimentent réellement le comportement du produit :
 * frais de livraison, zones, promotions, mode de l’IA, langues.
 */
export default async function SettingsPage() {
  const authed = await requireMerchantPage();

  const settings = await getSettings(authed.session.merchantId);
  const configuration = settings as SettingsPayload;

  return (
    <div className="mx-auto max-w-[860px]">
      <PageHeader
        title="Paramètres"
        subtitle="Informations de votre boutique, livraison, promotions et comportement de l’IA."
      />
      <SettingsForm
        initial={configuration}
        merchant={{
          businessName: authed.merchant.businessName ?? authed.merchant.name,
          email: authed.merchant.email,
          phone: authed.merchant.phone ?? null,
          timezone: authed.merchant.timezone,
        }}
        canManage={can(authed.session.role, "settings:manage")}
        aiConfigured={Boolean(process.env.GEMINI_API_KEY)}
      />
    </div>
  );
}
