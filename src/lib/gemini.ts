import { GoogleGenerativeAI } from "@google/generative-ai";

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  throw new Error("GEMINI_API_KEY is not configured in environment variables");
}

const genAI = new GoogleGenerativeAI(apiKey);

export interface AIMessage {
  role: "user" | "model";
  parts: string;
}

export interface AIContext {
  merchantName: string;
  businessName: string;
  products: Array<{ name: string; price: number; stock: number; description: string }>;
  settings: {
    businessInfo?: string;
    deliveryFees?: Record<string, number>;
    deliveryZones?: string;
    deliveryTimes?: string;
    promotions?: string;
    faq?: string;
    returnPolicy?: string;
    exchangePolicy?: string;
    customInstructions?: string;
  };
}

export async function generateSalesResponse(
  messages: AIMessage[],
  context: AIContext
): Promise<string> {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-pro" });

    const systemInstruction = buildSystemInstruction(context);

    const chat = model.startChat({
      history: messages.map((m) => ({
        role: m.role,
        parts: [{ text: m.parts }],
      })),
      generationConfig: {
        temperature: 0.3,
        topP: 0.9,
        maxOutputTokens: 1024,
      },
    });

    // We inject the system instruction as the first context
    // Gemini works best with system prompts embedded in user messages for flash
    const fullPrompt = `${systemInstruction}\n\nMessage du client: ${messages[messages.length - 1]?.parts || ""}`;

    const result = await chat.sendMessage(fullPrompt);
    const response = await result.response;
    const text = response.text();
    return text || "Je suis désolé, je n'ai pas pu répondre. Pouvez-vous reformuler ?";
  } catch (error: any) {
    console.error("Gemini API error:", error.message || error);
    return "Une erreur est survenue avec l'assistant. Un membre de l'équipe va vous répondre sous peu.";
  }
}

function buildSystemInstruction(context: AIContext): string {
  const productsText = context.products
    .map(
      (p) =>
        `- ${p.name}: ${p.price} DH. Stock: ${p.stock}. ${p.description}`
    )
    .join("\n");

  const deliveryFeesText = context.settings.deliveryFees
    ? Object.entries(context.settings.deliveryFees)
        .map(([zone, fee]) => `- ${zone}: ${fee} DH`)
        .join("\n")
    : "Non spécifié";

  return `Tu es un agent commercial professionnel pour ${context.businessName} (${context.merchantName}).
Tu réponds en français, darija marocaine, arabe ou mélangé selon la langue du client.
Tu es poli, direct, efficace. Tu ne parles jamais comme un robot générique.

INFORMATIONS COMMERCIALES :
${context.settings.businessInfo || "Non spécifié"}

PRODUITS DISPONIBLES :
${productsText || "Aucun produit listé."}

FRAIS DE LIVRAISON :
${deliveryFeesText}

ZONES : ${context.settings.deliveryZones || "Non spécifié"}
DÉLAIS : ${context.settings.deliveryTimes || "Non spécifié"}
PROMOTIONS : ${context.settings.promotions || "Aucune"}
POLITIQUE RETOUR : ${context.settings.returnPolicy || "Non spécifiée"}
POLITIQUE ÉCHANGE : ${context.settings.exchangePolicy || "Non spécifiée"}

INSTRUCTIONS PERSONNALISÉES :
${context.settings.customInstructions || "Sois professionnel et vends."}

RÈGLES CRITIQUES :
- Ne JAMAIS inventer de prix, de stock, de promotions ou de frais de livraison.
- Si une info est manquante, indique clairement que le marchand doit vérifier.
- Confirme toujours les commandes COD avec nom, adresse, produit, quantité, zone, total.
- Propose des produits complémentaires (upsell) quand c'est pertinent.
- Réponds brièvement et utilement.`;
}
