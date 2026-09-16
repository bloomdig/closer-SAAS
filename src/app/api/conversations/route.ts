/**
 * Conversations — liste (§28) et création d’une conversation de test web.
 * La liste est paginée et triée par dernière activité (§38).
 */
import { requireMerchantApi } from "@/lib/auth/guards";
import { createConversation, getSettings, listConversations } from "@/lib/repositories";
import { created, ok, parsePagination, paginationMeta, readJson, withErrorHandling } from "@/lib/api/respond";
import { oneOf, str, throwIfInvalid, type FieldErrors } from "@/lib/validation";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const GET = withErrorHandling("conversations.list", async (request: Request) => {
  const authed = await requireMerchantApi();
  const url = new URL(request.url);
  const { page, pageSize } = parsePagination(url.searchParams, { page: 1, pageSize: 30 });

  const result = await listConversations(authed.session.merchantId, {
    status: url.searchParams.get("status") ?? undefined,
    source: url.searchParams.get("source") ?? undefined,
    search: url.searchParams.get("search") ?? undefined,
    needsHumanReview: url.searchParams.get("needsReview") === "true" ? true : undefined,
    page,
    pageSize,
  });

  return ok(result.rows, {
    ...paginationMeta({ page: result.page, pageSize: result.pageSize, total: result.total }),
    unreadTotal: result.unreadTotal,
  });
});

/** Ouvre une conversation manuelle (simulation du chat web du site marchand). */
export const POST = withErrorHandling("conversations.create", async (request: Request) => {
  const authed = await requireMerchantApi();

  const body = await readJson<{ source?: unknown; customerId?: unknown; externalId?: unknown }>(request);
  const errors: FieldErrors = {};

  const source = oneOf(
    body.source,
    ["web", "whatsapp", "instagram", "facebook", "sms", "email"] as const,
    "source",
    "Canal",
    errors,
    { fallback: "web" },
  );
  const customerId = str(body.customerId, "customerId", { label: "Client", max: 64, optional: true }, errors);
  const externalId = str(body.externalId, "externalId", { label: "Identifiant externe", max: 191, optional: true }, errors);

  throwIfInvalid(errors);

  const settings = await getSettings(authed.session.merchantId);

  const conversation = await createConversation(authed.session.merchantId, {
    source: source as never,
    customerId: customerId ?? null,
    externalId: externalId ?? null,
    status: "open",
    handoffMode: settings?.defaultHandoffMode ?? "ai",
    aiEnabled: settings?.aiEnabled ?? true,
    lastMessageAt: new Date(),
  });

  return created(conversation);
});
