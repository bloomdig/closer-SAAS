/**
 * Seed DÉMONSTRATION — strictement réservé au mode démo (§23).
 * =====================================================================
 * Refusé si `DEMO_MODE` n’est pas explicitement `true`, et refusé en
 * production. Les données créées sont marquées `is_demo = true` afin qu’elles
 * ne se mélangent jamais aux marchands réels (l’admin peut les purger).
 *
 *   DEMO_MODE=true npm run db:seed:demo
 *
 * Compte de démonstration :
 *   e-mail       : demo@closer.ma
 *   mot de passe : Demo2026!
 */
import { config } from "dotenv";
config();

import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db, closeDatabase } from "./index";
import {
  automationRules,
  conversations,
  customers,
  merchants,
  merchantSettings,
  messages,
  orders,
  products,
  subscriptions,
} from "./schema";
import { DEFAULT_AUTOMATIONS } from "@/lib/automation/defaults";
import { BCRYPT_ROUNDS } from "@/lib/auth/session";
import { generateOrderReference } from "@/lib/orders/status";

const DEMO_EMAIL = "demo@closer.ma";
const DEMO_PASSWORD = "Demo2026!";

function assertDemoAllowed() {
  if (process.env.APP_ENV === "production" && process.env.DEMO_MODE !== "true") {
    throw new Error(
      "Seed de démonstration refusé : APP_ENV=production et DEMO_MODE différent de true.",
    );
  }
  if (process.env.DEMO_MODE !== "true") {
    throw new Error(
      "Seed de démonstration refusé. Définissez DEMO_MODE=true pour l’exécuter.",
    );
  }
}

async function main() {
  assertDemoAllowed();

  console.log("Seed de démonstration CLOSER (DEMO_MODE=true)");
  console.log("─────────────────────────────────────────────");

  const existing = await db.query.merchants.findFirst({
    where: eq(merchants.email, DEMO_EMAIL),
  });
  if (existing) {
    console.log(`  ✓ compte de démonstration déjà présent : ${DEMO_EMAIL}`);
    return;
  }

  const now = new Date();
  const trialEndsAt = new Date(now.getTime() + 7 * 86_400_000);

  const [merchant] = await db
    .insert(merchants)
    .values({
      name: "Amine El Fassi",
      businessName: "Fashion Maroc",
      email: DEMO_EMAIL,
      phone: "+212612345678",
      passwordHash: await bcrypt.hash(DEMO_PASSWORD, BCRYPT_ROUNDS),
      status: "active",
      trialStartedAt: now,
      trialEndsAt,
      subscriptionStatus: "trialing",
      subscriptionPlan: "pro",
      locale: "fr-MA",
      timezone: "Africa/Casablanca",
      isDemo: true,
    })
    .returning();

  await db.insert(merchantSettings).values({
    merchantId: merchant.id,
    businessDescription:
      "Fashion Maroc est une boutique en ligne de prêt-à-porter féminin et masculin basée à Casablanca. Livraison partout au Maroc, paiement à la livraison.",
    openingHours: [
      { day: "monday", open: "09:00", close: "20:00", closed: false },
      { day: "tuesday", open: "09:00", close: "20:00", closed: false },
      { day: "wednesday", open: "09:00", close: "20:00", closed: false },
      { day: "thursday", open: "09:00", close: "20:00", closed: false },
      { day: "friday", open: "09:00", close: "20:00", closed: false },
      { day: "saturday", open: "09:00", close: "20:00", closed: false },
      { day: "sunday", open: "00:00", close: "00:00", closed: true },
    ],
    deliveryFeeDefault: 3000,
    deliveryZones: [
      { city: "Casablanca", fee: 2000, eta: "24 h", enabled: true },
      { city: "Rabat", fee: 2500, eta: "24-48 h", enabled: true },
      { city: "Marrakech", fee: 3500, eta: "48 h", enabled: true },
      { city: "Fès", fee: 3000, eta: "48 h", enabled: true },
      { city: "Tanger", fee: 3500, eta: "48 h", enabled: true },
      { city: "Agadir", fee: 4000, eta: "48-72 h", enabled: true },
    ],
    deliveryEtaDaysMin: 1,
    deliveryEtaDaysMax: 3,
    freeShippingThreshold: 40000,
    returnPolicy: "Retour possible sous 7 jours, article non porté avec étiquette.",
    exchangePolicy: "Échange de taille possible sous 14 jours selon disponibilité.",
    faq: [
      {
        question: "Comment passer commande ?",
        answer:
          "Donnez-moi le produit, la taille ou le coloris, votre nom, votre ville et votre adresse. Le paiement se fait à la livraison.",
      },
      {
        question: "Quel est le mode de paiement ?",
        answer: "Paiement à la livraison (COD) partout au Maroc.",
      },
      {
        question: "Quels sont les délais ?",
        answer: "1 à 3 jours ouvrables selon la ville.",
      },
    ],
    promotions: [
      {
        title: "Livraison offerte dès 400 DH",
        description: "Automatique, sans code.",
        code: null,
        discountCents: 0,
        active: true,
      },
    ],
    customInstructions:
      "Toujours proposer une pièce complémentaire pertinente. Confirmer chaque commande COD avec le récapitulatif complet avant création.",
    tone: "friendly",
    preferredLanguage: "fr",
    currency: "MAD",
    defaultPaymentMethod: "cod",
    defaultHandoffMode: "ai",
    aiEnabled: true,
    upsellEnabled: true,
  });

  await db.insert(subscriptions).values({
    merchantId: merchant.id,
    plan: "pro",
    status: "trialing",
    interval: "month",
    amount: 24900,
    currency: "MAD",
    trialStart: now,
    trialEnd: trialEndsAt,
    currentPeriodStart: now,
    currentPeriodEnd: trialEndsAt,
  });

  for (const automation of DEFAULT_AUTOMATIONS) {
    await db.insert(automationRules).values({
      merchantId: merchant.id,
      type: automation.type,
      name: automation.name,
      enabled: automation.type === "abandoned_conversation",
      delayMinutes: automation.delayMinutes,
      configuration: {
        messageTemplate: automation.template,
        language: "auto",
        maxSendsPerCustomerPerDay: 1,
        quietHoursStart: 22,
        quietHoursEnd: 9,
      },
    });
  }

  const [robe, veste, pantalon] = await db
    .insert(products)
    .values([
      {
        merchantId: merchant.id,
        name: "Robe Noire Élégante",
        description:
          "Robe noire en viscose, coupe droite, manches longues. Idéale pour les soirées et les occasions.",
        price: 34900,
        stock: 15,
        sku: "FM-ROBE-001",
        sizes: ["S", "M", "L", "XL"],
        colors: ["Noir", "Bordeaux"],
        searchKeywords: ["robe", "soria", "فستان", "soirée", "noire"],
        status: "active" as const,
      },
      {
        merchantId: merchant.id,
        name: "Veste en Denim",
        description:
          "Veste en denim bleu, coupe oversized, style urbain. Unisexe.",
        price: 27900,
        salePrice: 24900,
        stock: 8,
        sku: "FM-VESTE-002",
        sizes: ["S", "M", "L", "XL"],
        colors: ["Bleu", "Noir"],
        searchKeywords: ["veste", "denim", "jacket", "جاكيط"],
        status: "active" as const,
      },
      {
        merchantId: merchant.id,
        name: "Pantalon Beige",
        description: "Pantalon beige en coton, coupe slim, confortable au quotidien.",
        price: 19900,
        stock: 0,
        sku: "FM-PANT-003",
        sizes: ["38", "40", "42", "44"],
        colors: ["Beige", "Kaki"],
        searchKeywords: ["pantalon", "srval", "سروال", "coton"],
        status: "out_of_stock" as const,
      },
    ])
    .returning();

  const [karim, sara, youssef] = await db
    .insert(customers)
    .values([
      {
        merchantId: merchant.id,
        name: "Karim Idrissi",
        phone: "+212661234567",
        city: "Casablanca",
        address: "Résidence Al Manar, Appartement 12, Maârif",
        status: "vip",
        totalSpent: 174500,
        ordersCount: 5,
        lastInteractionAt: new Date(now.getTime() - 2 * 60_000),
      },
      {
        merchantId: merchant.id,
        name: "Sara Benali",
        phone: "+212662345678",
        city: "Rabat",
        address: "14 rue Ibn Batouta, Agdal",
        status: "active",
        totalSpent: 62800,
        ordersCount: 2,
        lastInteractionAt: new Date(now.getTime() - 15 * 60_000),
      },
      {
        merchantId: merchant.id,
        name: "Youssef Amrani",
        phone: "+212663456789",
        city: "Marrakech",
        address: "Résidence Nakhil, Imm. 3, Guéliz",
        status: "new",
        totalSpent: 0,
        ordersCount: 0,
        lastInteractionAt: new Date(now.getTime() - 32 * 60_000),
      },
    ])
    .returning();

  // Conversation convertie (Karim)
  const [convKarim] = await db
    .insert(conversations)
    .values({
      merchantId: merchant.id,
      customerId: karim.id,
      source: "whatsapp",
      status: "resolved",
      handoffMode: "ai",
      aiEnabled: true,
      unreadCount: 0,
      lastMessageAt: new Date(now.getTime() - 2 * 60_000),
      lastMessagePreview: "Commande CL-DEMO-001 confirmée.",
    })
    .returning();

  await db.insert(messages).values([
    {
      conversationId: convKarim.id,
      merchantId: merchant.id,
      senderType: "customer",
      content: "Salam, had robe kayna en noir ?",
      language: "darija",
      createdAt: new Date(now.getTime() - 12 * 60_000),
    },
    {
      conversationId: convKarim.id,
      merchantId: merchant.id,
      senderType: "ai",
      content:
        "Salam ! Oui, la Robe Noire Élégante est disponible en noir, à 349 DH. Tailles S à XL. Je vous la réserve ?",
      language: "fr",
      aiGenerated: true,
      createdAt: new Date(now.getTime() - 11 * 60_000),
    },
    {
      conversationId: convKarim.id,
      merchantId: merchant.id,
      senderType: "customer",
      content: "Kayna en M ? w ch7al livraison l Casa ?",
      language: "darija",
      createdAt: new Date(now.getTime() - 10 * 60_000),
    },
    {
      conversationId: convKarim.id,
      merchantId: merchant.id,
      senderType: "ai",
      content:
        "Oui, le M est disponible. Livraison à Casablanca : 20 DH, sous 24 h. Total : 369 DH, paiement à la livraison. Je confirme ?",
      language: "fr",
      aiGenerated: true,
      createdAt: new Date(now.getTime() - 9 * 60_000),
    },
    {
      conversationId: convKarim.id,
      merchantId: merchant.id,
      senderType: "customer",
      content: "Wakha, confirmi. Karim Idrissi, Résidence Al Manar, App 12, Maârif",
      language: "darija",
      createdAt: new Date(now.getTime() - 8 * 60_000),
    },
    {
      conversationId: convKarim.id,
      merchantId: merchant.id,
      senderType: "ai",
      content:
        "C’est confirmé. Votre commande CL-DEMO-001 est enregistrée : Robe Noire Élégante (M), 369 DH à la livraison. Vous recevrez un appel avant la livraison.",
      language: "fr",
      aiGenerated: true,
      createdAt: new Date(now.getTime() - 7 * 60_000),
    },
  ]);

  await db.insert(orders).values({
    merchantId: merchant.id,
    customerId: karim.id,
    conversationId: convKarim.id,
    reference: "CL-DEMO-001",
    items: [
      {
        productId: robe.id,
        name: "Robe Noire Élégante",
        variant: "Noir / M",
        quantity: 1,
        unitPrice: 34900,
        lineTotal: 34900,
      },
    ],
    subtotal: 34900,
    deliveryFee: 2000,
    discount: 0,
    total: 36900,
    currency: "MAD",
    paymentMethod: "cod",
    paymentStatus: "pending",
    orderStatus: "confirmed",
    customerName: "Karim Idrissi",
    customerPhone: "+212661234567",
    city: "Casablanca",
    address: "Résidence Al Manar, Appartement 12, Maârif",
    statusHistory: [
      { from: null, to: "pending_confirmation", by: "ai", at: new Date(now.getTime() - 8 * 60_000).toISOString() },
      { from: "pending_confirmation", to: "confirmed", by: "ai", at: new Date(now.getTime() - 7 * 60_000).toISOString() },
    ],
    createdByAi: true,
    confirmedAt: new Date(now.getTime() - 7 * 60_000),
  });

  // Conversation ouverte (Sara)
  const [convSara] = await db
    .insert(conversations)
    .values({
      merchantId: merchant.id,
      customerId: sara.id,
      source: "instagram",
      status: "open",
      handoffMode: "approval",
      aiEnabled: true,
      unreadCount: 1,
      lastMessageAt: new Date(now.getTime() - 15 * 60_000),
      lastMessagePreview: "Wach kayna livraison l Rabat ?",
    })
    .returning();

  await db.insert(messages).values([
    {
      conversationId: convSara.id,
      merchantId: merchant.id,
      senderType: "customer",
      content: "Bonjour, la veste en denim est encore en promo ?",
      language: "fr",
      createdAt: new Date(now.getTime() - 20 * 60_000),
    },
    {
      conversationId: convSara.id,
      merchantId: merchant.id,
      senderType: "ai",
      content:
        "Bonjour Sara ! Oui, la Veste en Denim est à 249 DH au lieu de 279 DH. Il reste 8 pièces. Quelle taille vous faut-il ?",
      language: "fr",
      aiGenerated: true,
      createdAt: new Date(now.getTime() - 19 * 60_000),
    },
    {
      conversationId: convSara.id,
      merchantId: merchant.id,
      senderType: "customer",
      content: "M. Wach kayna livraison l Rabat ?",
      language: "darija",
      createdAt: new Date(now.getTime() - 15 * 60_000),
    },
  ]);

  // Conversation à traiter par un humain (Youssef)
  const [convYoussef] = await db
    .insert(conversations)
    .values({
      merchantId: merchant.id,
      customerId: youssef.id,
      source: "whatsapp",
      status: "open",
      handoffMode: "manual",
      aiEnabled: false,
      needsHumanReview: true,
      reviewReason: "Le client demande un retour sur une commande livrée.",
      unreadCount: 2,
      lastMessageAt: new Date(now.getTime() - 32 * 60_000),
      lastMessagePreview: "Bghit nrje3 la commande, makanch mzyan.",
    })
    .returning();

  await db.insert(messages).values([
    {
      conversationId: convYoussef.id,
      merchantId: merchant.id,
      senderType: "customer",
      content: "Salam, bghit nrje3 la commande dyal l pantalon, makanch mzyan.",
      language: "darija",
      createdAt: new Date(now.getTime() - 35 * 60_000),
    },
    {
      conversationId: convYoussef.id,
      merchantId: merchant.id,
      senderType: "ai",
      content:
        "Salam Youssef. Je transmets immédiatement votre demande de retour à un conseiller, il vous répond dans quelques minutes.",
      language: "fr",
      aiGenerated: true,
      createdAt: new Date(now.getTime() - 34 * 60_000),
    },
    {
      conversationId: convYoussef.id,
      merchantId: merchant.id,
      senderType: "customer",
      content: "Chokran.wach momkin nbdlha b taille 42 ?",
      language: "darija",
      createdAt: new Date(now.getTime() - 32 * 60_000),
    },
  ]);

  // Commandes historiques pour alimenter les statistiques
  await db.insert(orders).values([
    {
      merchantId: merchant.id,
      customerId: sara.id,
      reference: "CL-DEMO-002",
      items: [
        { productId: veste.id, name: "Veste en Denim", variant: "Bleu / M", quantity: 1, unitPrice: 24900, lineTotal: 24900 },
      ],
      subtotal: 24900,
      deliveryFee: 2500,
      total: 27400,
      paymentMethod: "cod",
      paymentStatus: "paid",
      orderStatus: "delivered",
      customerName: "Sara Benali",
      customerPhone: "+212662345678",
      city: "Rabat",
      address: "14 rue Ibn Batouta, Agdal",
      createdByAi: true,
      deliveredAt: new Date(now.getTime() - 3 * 86_400_000),
    },
    {
      merchantId: merchant.id,
      customerId: karim.id,
      reference: "CL-DEMO-003",
      items: [
        { productId: robe.id, name: "Robe Noire Élégante", variant: "Noir / L", quantity: 1, unitPrice: 34900, lineTotal: 34900 },
      ],
      subtotal: 34900,
      deliveryFee: 2000,
      total: 36900,
      paymentMethod: "cod",
      paymentStatus: "refunded",
      orderStatus: "refused",
      customerName: "Karim Idrissi",
      customerPhone: "+212661234567",
      city: "Casablanca",
      address: "Résidence Al Manar, Appartement 12, Maârif",
      createdByAi: false,
      cancelledAt: new Date(now.getTime() - 5 * 86_400_000),
    },
    {
      merchantId: merchant.id,
      customerId: karim.id,
      reference: "CL-DEMO-004",
      items: [
        { productId: pantalon.id, name: "Pantalon Beige", variant: "Beige / 42", quantity: 2, unitPrice: 19900, lineTotal: 39800 },
      ],
      subtotal: 39800,
      deliveryFee: 0,
      total: 39800,
      paymentMethod: "cod",
      paymentStatus: "pending",
      orderStatus: "shipped",
      customerName: "Karim Idrissi",
      customerPhone: "+212661234567",
      city: "Casablanca",
      address: "Résidence Al Manar, Appartement 12, Maârif",
      createdByAi: true,
    },
  ]);

  console.log("  ✓ marchand de démonstration : Fashion Maroc");
  console.log("  ✓ 3 produits, 3 clients, 3 conversations, 4 commandes");
  console.log("  ✓ identifiants : demo@closer.ma / Demo2026!");
  console.log("─────────────────────────────────────────────");
  console.log("Ces données sont marquées is_demo = true.");
}

main()
  .catch((error) => {
    console.error("Échec du seed de démonstration :", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeDatabase();
  });
