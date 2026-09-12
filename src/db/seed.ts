import { db } from "@/db";
import { merchants, merchantSettings, products, adminConfig } from "./schema";
import bcrypt from "bcryptjs";

async function seed() {
  // Admin config
  await db.insert(adminConfig).values({
    starterPrice: "299",
    proPrice: "599",
    businessPrice: "999",
    trialDaysDefault: 7,
  }).onConflictDoNothing();

  // Create a demo merchant
  const hash = await bcrypt.hash("demo123", 10);
  const existing = await db.select().from(merchants);
  if (existing.length === 0) {
    const [m] = await db.insert(merchants).values({
      fullName: "Amine El Fassi",
      businessName: "Fashion Maroc",
      email: "amine@fashionmaroc.ma",
      phone: "+212612345678",
      passwordHash: hash,
      verified: true,
      trialEndsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      trialDaysRemaining: 7,
      status: "trial",
      subscriptionPlan: "starter",
    }).returning();

    await db.insert(merchantSettings).values({
      merchantId: m.id,
      businessInfo: "Fashion Maroc est une boutique en ligne de vêtements modernes au Maroc. Nous livrons dans tout le pays.",
      openingHours: "Lundi - Samedi: 9h - 20h",
      deliveryFees: JSON.stringify({ "Casa": 20, "Rabat": 25, "Fes": 30, "Marrakech": 35, "Autres": 40 }),
      deliveryZones: "Casablanca, Rabat, Fes, Marrakech, Agadir, Tanger",
      deliveryTimes: "1-3 jours ouvrables",
      promotions: "Livraison gratuite pour commandes > 400 DH",
      faq: "Comment passer commande ? Comment payer ? Quand recevrai-je ma commande ?",
      returnPolicy: "Retour possible sous 7 jours avec l'étiquette.",
      exchangePolicy: "Échange possible sous 14 jours si le produit est intact.",
      customInstructions: "Toujours être poli. Proposer des produits complémentaires. Confirmer toutes les commandes par COD.",
      languages: "darija,arabic,french",
    });

    await db.insert(products).values([
      {
        merchantId: m.id,
        name: "Robe Noire Élégante",
        description: "Robe noire en viscose, coupe droite, idéale pour les soirées. Disponible en S, M, L, XL.",
        price: "349.00",
        stock: 15,
        category: "Robes",
        isAvailable: true,
      },
      {
        merchantId: m.id,
        name: "Veste en Denim",
        description: "Veste en denim bleu classique, coupe oversized. Style urbain et tendance.",
        price: "279.00",
        stock: 8,
        category: "Vestes",
        isAvailable: true,
      },
      {
        merchantId: m.id,
        name: "Pantalon Beige",
        description: "Pantalon beige en coton, coupe slim. Confort et élégance au quotidien.",
        price: "199.00",
        stock: 22,
        category: "Pantalons",
        isAvailable: true,
      },
    ]);
  }
}

seed().catch(console.error);
