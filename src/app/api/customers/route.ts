/** Clients (CRM) — liste paginée + recherche (§14). */
import { requireMerchantApi } from "@/lib/auth/guards";
import { listCustomers } from "@/lib/repositories";
import { ok, parsePagination, paginationMeta, withErrorHandling } from "@/lib/api/respond";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const GET = withErrorHandling("customers.list", async (request: Request) => {
  const authed = await requireMerchantApi();
  const url = new URL(request.url);
  const { page, pageSize } = parsePagination(url.searchParams);

  const result = await listCustomers(authed.session.merchantId, {
    search: url.searchParams.get("search") ?? undefined,
    status: url.searchParams.get("status") ?? undefined,
    page,
    pageSize,
  });

  return ok(
    result.rows,
    paginationMeta({ page: result.page, pageSize: result.pageSize, total: result.total }),
  );
});
