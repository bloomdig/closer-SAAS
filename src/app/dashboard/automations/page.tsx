import { requireMerchantPage } from "@/lib/auth/guards";
import { listAutomations } from "@/lib/repositories";
import { PageHeader } from "@/components/ui";
import { AutomationsManager, type AutomationRow } from "@/components/automations/AutomationsManager";
import { can } from "@/lib/security/tenant";
import { DEFAULT_PLANS } from "@/lib/subscriptions/plans";
import {
  AUTOMATION_DESCRIPTIONS_FR,
  AUTOMATION_LABELS_FR,
  DEFAULT_DELAY_MINUTES,
  DEFAULT_TEMPLATES_FR,
} from "@/lib/automation/types";

export const dynamic = "force-dynamic";

/**
 * Automatisations (§15) — les 6 types sont toujours présents, activables,
 * configurables et journalisés. Aucun bouton mort.
 */
export default async function AutomationsPage() {
  const authed = await requireMerchantPage();

  const rules = await listAutomations(authed.session.merchantId);
  const types = Object.keys(AUTOMATION_LABELS_FR) as (keyof typeof AUTOMATION_LABELS_FR)[];

  const rows: AutomationRow[] = types.map((type) => {
    const rule = rules.find((item) => item.type === type);
    const configuration = (rule?.configuration ?? {}) as AutomationRow["configuration"];

    return {
      type,
      label: AUTOMATION_LABELS_FR[type],
      description: AUTOMATION_DESCRIPTIONS_FR[type],
      defaultDelayMinutes: DEFAULT_DELAY_MINUTES[type],
      defaultTemplate: DEFAULT_TEMPLATES_FR[type],
      enabled: rule?.enabled ?? false,
      delayMinutes: rule?.delayMinutes ?? DEFAULT_DELAY_MINUTES[type],
      configuration: {
        messageTemplate: configuration.messageTemplate ?? DEFAULT_TEMPLATES_FR[type],
        language: configuration.language ?? "auto",
        maxSendsPerCustomerPerDay: configuration.maxSendsPerCustomerPerDay ?? 1,
        quietHoursStart: configuration.quietHoursStart ?? 22,
        quietHoursEnd: configuration.quietHoursEnd ?? 9,
      },
    };
  });

  const plan = DEFAULT_PLANS.find((item) => item.slug === authed.merchant.subscriptionPlan);
  const activeLimit = plan?.limits.automations ?? 2;
  const activeCount = rows.filter((row) => row.enabled).length;

  return (
    <div className="mx-auto max-w-[900px]">
      <PageHeader
        title="Automatisations"
        subtitle="Relances automatiques envoyées par CLOSER quand un client ne répond plus, ou après une commande."
      />
      <AutomationsManager
        automations={rows}
        canManage={can(authed.session.role, "automations:manage")}
        activeLimit={activeLimit}
        activeCount={activeCount}
        featureBlocked={!authed.access.features.automations}
        featureMessage={authed.access.features.automations ? null : authed.access.banner}
      />
    </div>
  );
}
