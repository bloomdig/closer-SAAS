import { db } from "@/db";
import { merchants, products, merchantSettings } from "@/db/schema";
import { generateSalesResponse } from "@/lib/gemini";
import { verifySession } from "@/lib/verify";

export async function POST(request: Request) {
  try {
    const session = await verifySession();
    if (!session) {
      return Response.json({ error: "Non autorisé" }, { status: 401 });
    }

    const body = await request.json();
    const { message, conversationId } = body;

    const allMerchants = await db.select().from(merchants);
    const merchant = allMerchants.find((m: any) => m.id === session.userId);
    if (!merchant) {
      return Response.json({ error: "Merchant non trouvé" }, { status: 404 });
    }

    const merchantProducts = await db.select().from(products);
    const productsFiltered = merchantProducts.filter((p: any) => p.merchantId === session.userId);

    const merchantSettingsList = await db.select().from(merchantSettings);
    const settingsRow: any = merchantSettingsList.find((s: any) => s.merchantId === session.userId) || {};

    const context = {
      merchantName: merchant.fullName,
      businessName: merchant.businessName,
      products: productsFiltered.map((p: any) => ({
        name: p.name,
        price: parseFloat(p.price),
        stock: p.stock,
        description: p.description || "",
      })),
      settings: {
        businessInfo: settingsRow.businessInfo || "",
        deliveryFees: settingsRow.deliveryFees ? JSON.parse(String(settingsRow.deliveryFees)) : {},
        deliveryZones: settingsRow.deliveryZones || "",
        deliveryTimes: settingsRow.deliveryTimes || "",
        promotions: settingsRow.promotions || "",
        faq: settingsRow.faq || "",
        returnPolicy: settingsRow.returnPolicy || "",
        exchangePolicy: settingsRow.exchangePolicy || "",
        customInstructions: settingsRow.customInstructions || "",
      },
    };

    // Build conversation history from the request or use a simple two-turn
    const messages = [
      { role: "user" as const, parts: message || "Bonjour" },
    ];

    const responseText = await generateSalesResponse(messages, context);

    return Response.json({
      response: responseText,
      merchantId: session.userId,
    });
  } catch (e: any) {
    console.error("AI response error:", e.message || e);
    return Response.json({ error: "Erreur lors de la génération de la réponse" }, { status: 500 });
  }
}
