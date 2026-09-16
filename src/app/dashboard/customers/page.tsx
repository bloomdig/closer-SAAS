import Link from "next/link";
import { Users } from "lucide-react";
import { requireMerchantPage } from "@/lib/auth/guards";
import { listCustomers } from "@/lib/repositories";
import { Badge, EmptyState, Money, PageHeader, Panel, RelativeTime } from "@/components/ui";
import {
  CUSTOMER_STATUS_FR,
  formatMoroccanPhone,
  formatNumber,
} from "@/lib/format";

export const dynamic = "force-dynamic";

/**
 * Clients (CRM) — profils réels liés au marchand (§14).
 * Remplace le tableau statique de trois faux clients du prototype.
 */
export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string; search?: string; page?: string; status?: string }>;
}) {
  const authed = await requireMerchantPage();
  const params = await searchParams;
  const page = Math.max(1, Number(params.page ?? 1) || 1);

  const result = await listCustomers(authed.session.merchantId, {
    search: params.search ?? undefined,
    status: params.status ?? undefined,
    page,
    pageSize: 25,
  });

  const totalPages = Math.max(1, Math.ceil(result.total / 25));
  const vipCount = result.rows.filter((row) => row.status === "vip").length;

  return (
    <div className="mx-auto max-w-[1180px]">
      <PageHeader
        title="Clients"
        subtitle="Chaque client est rattaché à votre boutique : historique, dépenses et dernière interaction."
      />

      <div className="mb-3 flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
        <form action="/dashboard/customers" className="flex w-full items-center gap-2 sm:max-w-[320px]">
          <input
            type="search"
            name="search"
            defaultValue={params.search ?? ""}
            placeholder="Nom, téléphone, ville…"
            className="field h-8 flex-1 text-[var(--text-sm)]"
            aria-label="Rechercher un client"
          />
          <button type="submit" className="btn btn-secondary btn-sm">
            Rechercher
          </button>
        </form>
        <span className="meta-label">
          {formatNumber(result.total)} client{result.total > 1 ? "s" : ""}
          {vipCount > 0 ? ` · ${vipCount} VIP` : ""}
        </span>
      </div>

      <Panel flush>
        {result.rows.length === 0 ? (
          <EmptyState
            icon={<Users className="h-4 w-4" strokeWidth={1.8} />}
            title={params.search ? "Aucun client ne correspond" : "Aucun client"}
            description={
              params.search
                ? "Modifiez votre recherche."
                : "Les clients sont créés automatiquement par CLOSER dès qu’il collecte un nom et un téléphone en conversation."
            }
            action={
              params.search ? (
                <Link href="/dashboard/customers" className="btn btn-secondary btn-sm">
                  Réinitialiser
                </Link>
              ) : (
                <Link href="/dashboard/chat" className="btn btn-secondary btn-sm">
                  Ouvrir les conversations
                </Link>
              )
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Client</th>
                  <th>Téléphone</th>
                  <th>Ville</th>
                  <th className="table-numeric">Commandes</th>
                  <th className="table-numeric">Total dépensé</th>
                  <th>Dernier contact</th>
                  <th>Statut</th>
                </tr>
              </thead>
              <tbody>
                {result.rows.map((customer) => (
                  <tr key={customer.id}>
                    <td>
                      <Link
                        href={`/dashboard/customers?id=${customer.id}`}
                        className="font-medium text-[var(--color-ink)] hover:underline"
                      >
                        {customer.name ?? "Sans nom"}
                      </Link>
                      {customer.email ? (
                        <span className="meta-label block">{customer.email}</span>
                      ) : null}
                    </td>
                    <td className="whitespace-nowrap">{formatMoroccanPhone(customer.phone)}</td>
                    <td>{customer.city ?? "—"}</td>
                    <td className="table-numeric">{formatNumber(customer.ordersCount)}</td>
                    <td className="table-numeric font-medium text-[var(--color-ink)]">
                      <Money cents={customer.totalSpent} />
                    </td>
                    <td className="meta-label whitespace-nowrap">
                      <RelativeTime date={customer.lastInteractionAt ?? customer.createdAt} />
                    </td>
                    <td>
                      <Badge tone={customer.status === "vip" ? "accent" : customer.status === "blacklisted" ? "negative" : "neutral"}>
                        {CUSTOMER_STATUS_FR[customer.status] ?? customer.status}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 ? (
          <div className="flex items-center justify-between border-t border-[var(--color-line)] px-4 py-2.5">
            <span className="meta-label">
              Page {page} sur {totalPages}
            </span>
            <div className="flex items-center gap-1.5">
              {page > 1 ? (
                <Link href={href(params, page - 1)} className="btn btn-secondary btn-sm">
                  Précédent
                </Link>
              ) : null}
              {page < totalPages ? (
                <Link href={href(params, page + 1)} className="btn btn-secondary btn-sm">
                  Suivant
                </Link>
              ) : null}
            </div>
          </div>
        ) : null}
      </Panel>
    </div>
  );
}

function href(params: { search?: string; status?: string }, page: number): string {
  const query = new URLSearchParams();
  if (params.search) query.set("search", params.search);
  if (params.status) query.set("status", params.status);
  if (page > 1) query.set("page", String(page));
  const qs = query.toString();
  return qs ? `/dashboard/customers?${qs}` : "/dashboard/customers";
}
