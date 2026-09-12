import { db } from "@/db";
import { merchants, merchantSettings } from "@/db/schema";
import bcrypt from "bcryptjs";
import { createSession } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { fullName, businessName, email, phone, password } = body;

    if (!fullName || !businessName || !email || !phone || !password) {
      return Response.json({ error: "Missing required fields" }, { status: 400 });
    }

    const allMerchants = await db.select().from(merchants);
    const exists = allMerchants.find((m: any) => m.email === email);
    if (exists) {
      return Response.json({ error: "Email already registered" }, { status: 409 });
    }

    const hash = await bcrypt.hash(password, 10);
    const trialEnds = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const [merchant] = await db.insert(merchants).values({
      fullName,
      businessName,
      email,
      phone,
      passwordHash: hash,
      verified: true,
      trialEndsAt: trialEnds,
      trialDaysRemaining: 7,
      status: "trial",
      subscriptionPlan: "starter",
    }).returning();

    await db.insert(merchantSettings).values({
      merchantId: merchant.id,
      businessInfo: `${businessName} is a Moroccan e-commerce business.` ,
      openingHours: "Lundi - Samedi: 9h - 20h",
      deliveryFees: JSON.stringify({ "Casablanca": 20 }),
      deliveryZones: "Casablanca",
      deliveryTimes: "1-3 jours ouvrables",
      promotions: "Livraison gratuite pour commandes > 400 DH",
      faq: "Comment passer commande ?",
      returnPolicy: "Retour possible sous 7 jours.",
      exchangePolicy: "Échange possible sous 14 jours.",
      customInstructions: "Toujours être poli et professionnel.",
      languages: "darija,arabic,french",
    });

    await createSession(merchant.id, merchant.email);

    return Response.json({ success: true, merchantId: merchant.id }, { status: 201 });
  } catch (e: any) {
    return Response.json({ error: e.message || "Signup failed" }, { status: 500 });
  }
}
