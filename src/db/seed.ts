/**
 * Seed PLATEFORME — données structurelles, jamais de démonstration (§23).
 * =====================================================================
 * Crée :
 *   - les 3 offres avec les prix exigés : 99 / 249 / 499 MAD, essai 7 jours
 *   - les paramètres globaux de la plateforme
 *   - le compte administrateur (si ADMIN_EMAIL / ADMIN_PASSWORD sont définies)
 *
 * Idempotent : peut être relancé sans créer de doublons.
 *   npm run db:seed
 */
import { config } from "dotenv";
config();

import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db, closeDatabase } from "./index";
import { plans, platformSettings } from "./schema";
import { platformAdmins } from "./admin-schema";
import { DEFAULT_PLANS } from "@/lib/subscriptions/plans";
import { BCRYPT_ROUNDS } from "@/lib/auth/session";

async function seedPlans() {
  for (const plan of DEFAULT_PLANS) {
    await db
      .insert(plans)
      .values({
        slug: plan.slug,
        name: plan.name,
        priceMonthly: plan.priceMonthly,
        priceYearly: plan.priceYearly,
        currency: plan.currency,
        trialDays: plan.trialDays,
        limits: plan.limits,
        features: plan.features,
        position: plan.position,
        isActive: true,
      })
      .onConflictDoUpdate({
        target: plans.slug,
        set: {
          name: plan.name,
          priceMonthly: plan.priceMonthly,
          priceYearly: plan.priceYearly,
          currency: plan.currency,
          trialDays: plan.trialDays,
          limits: plan.limits,
          features: plan.features,
          position: plan.position,
          updatedAt: new Date(),
        },
      });
    console.log(`  ✓ offre ${plan.name} — ${plan.priceMonthly / 100} MAD/mois`);
  }
}

const PLATFORM_DEFAULTS: { key: string; value: unknown; description: string }[] = [
  {
    key: "trial_days",
    value: 7,
    description: "Durée de l’essai gratuit en jours",
  },
  {
    key: "currency",
    value: "MAD",
    description: "Devise de la plateforme",
  },
  {
    key: "grace_days",
    value: 3,
    description: "Jours de grâce après un paiement échoué",
  },
  {
    key: "support_email",
    value: "support@closer.ma",
    description: "E-mail de support affiché aux marchands",
  },
  {
    key: "maintenance_mode",
    value: false,
    description: "Coupe l’inscription de nouveaux marchands",
  },
];

async function seedPlatformSettings() {
  for (const setting of PLATFORM_DEFAULTS) {
    await db
      .insert(platformSettings)
      .values({ key: setting.key, value: setting.value, description: setting.description })
      .onConflictDoNothing();
  }
  console.log(`  ✓ ${PLATFORM_DEFAULTS.length} paramètres plateforme`);
}

async function seedAdmin() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;

  if (!email || !password) {
    console.log("  ⚠ compte administrateur non créé (ADMIN_EMAIL / ADMIN_PASSWORD absentes)");
    return;
  }
  if (password.length < 12) {
    throw new Error("ADMIN_PASSWORD doit contenir au moins 12 caractères.");
  }

  const existing = await db.query.platformAdmins.findFirst({
    where: eq(platformAdmins.email, email),
  });
  if (existing) {
    console.log(`  ✓ administrateur déjà présent : ${email}`);
    return;
  }

  await db.insert(platformAdmins).values({
    name: "Administrateur CLOSER",
    email,
    passwordHash: await bcrypt.hash(password, BCRYPT_ROUNDS),
    isActive: true,
  });
  console.log(`  ✓ administrateur créé : ${email}`);
}

async function main() {
  console.log("Seed plateforme CLOSER");
  console.log("──────────────────────");

  await seedPlans();
  await seedPlatformSettings();
  await seedAdmin();

  console.log("──────────────────────");
  console.log("Terminé.");
}

main()
  .catch((error) => {
    console.error("Échec du seed :", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    // Ferme explicitement le pool : sinon le processus reste vivant (bug D4).
    await closeDatabase();
  });
