import { destroySessions } from "@/lib/auth/session";
import { ok, withErrorHandling } from "@/lib/api/respond";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Déconnexion : supprime le cookie de session marchand ET admin. */
export const POST = withErrorHandling("auth.logout", async () => {
  await destroySessions();
  return ok({ success: true });
});
