/** Client (CRM) — profil complet : infos, commandes, conversations (§14). */
import { requireMerchantApi } from "@/lib/auth/guards";
import { getCustomerProfile, logAudit, updateCustomer } from "@/lib/repositories";
import { city as cityField, email as emailField, notFound, ok, phone as phoneField, readJson, str, throwIfInvalid, withErrorHandling, type FieldErrors } from "@/lib/api/validation-bridge";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

export const GET = withErrorHandling("customers.get", async (_request: Request, ctx: Params) => {
  const authed = await requireMerchantApi();
  const { id } = await ctx.params;

  const profile = await getCustomerProfile(authed.session.merchantId, id);
  if (!profile.customer) throw notFound("Client introuvable.");

  return ok(profile);
});

export const PATCH = withErrorHandling("customers.update", async (request: Request, ctx: Params) => {
  const authed = await requireMerchantApi();
  const { id } = await ctx.params;

  const existing = await getCustomerProfile(authed.session.merchantId, id);
  if (!existing.customer) throw notFound("Client introuvable.");

  const body = await readJson<Record<string, unknown>>(request);
  const errors: FieldErrors = {};
  const patch: Record<string, unknown> = {};

  if (body.name !== undefined) patch.name = str(body.name, "name", { label: "Nom", min: 2, max: 160 }, errors);
  if (body.phone !== undefined) patch.phone = phoneField(body.phone, "phone", "Téléphone", errors);
  if (body.email !== undefined) patch.email = emailField(body.email, "email", "E-mail", errors) ?? null;
  if (body.city !== undefined) patch.city = cityField(body.city, "city", errors) ?? null;
  if (body.address !== undefined) patch.address = str(body.address, "address", { label: "Adresse", max: 400, optional: true }, errors) ?? null;
  if (body.notes !== undefined) patch.notes = str(body.notes, "notes", { label: "Notes", max: 1000, optional: true }, errors) ?? null;
  if (body.status !== undefined) {
    const allowed = ["new", "active", "vip", "inactive", "blacklisted"] as const;
    const value = typeof body.status === "string" && allowed.includes(body.status as never) ? body.status : undefined;
    if (!value) errors.status = "Statut invalide.";
    else patch.status = value;
  }

  throwIfInvalid(errors);

  const updated = await updateCustomer(authed.session.merchantId, id, patch);

  await logAudit({
    merchantId: authed.session.merchantId,
    actorId: authed.session.userId,
    actorRole: authed.session.role,
    action: "customer.update",
    entityType: "customer",
    entityId: id,
  });

  return ok(updated);
});
