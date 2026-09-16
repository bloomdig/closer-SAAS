/**
 * Cron des automatisations (§15).
 * Protégé par `CRON_SECRET` : Vercel Cron envoie automatiquement
 * `Authorization: Bearer <CRON_SECRET>`.
 *
 * `vercel.json` :
 *   { "crons": [{ "path": "/api/cron/automations", "schedule": "*\/10 * * * *" }] }
 * Plan Hobby : 1 déclenchement/jour maximum — passer au plan Pro pour 10 min.
 */
import { NextResponse, type NextRequest } from "next/server";
import { processDueAutomations } from "@/lib/automation/runner";
import { timingSafeEqualString } from "@/lib/security/timing";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    console.warn("[cron] CRON_SECRET absente : exécution refusée.");
    return NextResponse.json(
      { error: "Cron non configuré." },
      { status: 503 },
    );
  }

  const header = request.headers.get("authorization") ?? "";
  const provided = header.replace(/^Bearer\s+/i, "");
  const urlToken = request.nextUrl.searchParams.get("secret") ?? "";

  if (
    !timingSafeEqualString(provided, expected) &&
    !timingSafeEqualString(urlToken, expected)
  ) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  const startedAt = Date.now();
  const summary = await processDueAutomations();

  return NextResponse.json({
    ...summary,
    durationMs: Date.now() - startedAt,
  });
}

/** Certains planificateurs envoient un POST : même traitement. */
export async function POST(request: NextRequest) {
  return GET(request);
}
