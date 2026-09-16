/**
 * Middleware de protection des routes (corrige E11).
 * =====================================================================
 * Vérifie le cookie de session SANS accès à la base de données (le middleware
 * s’exécute sur l’edge) : c’est un premier filtre rapide. La vérification
 * complète (état du compte, rôle, abonnement) est refaite côté serveur dans
 * `requireMerchantPage` / `requireMerchantApi` — la sécurité ne repose jamais
 * sur le middleware seul.
 */
import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";
import { ADMIN_SESSION_COOKIE, SESSION_COOKIE } from "@/lib/auth/session";

const MERCHANT_PREFIXES = ["/dashboard", "/billing"];
const ADMIN_PREFIXES = ["/admin"];

function isProtected(pathname: string, prefixes: string[]): boolean {
  return prefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

async function hasValidToken(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) return false;

  try {
    await jwtVerify(token, new TextEncoder().encode(secret), {
      issuer: "closer",
    });
    return true;
  } catch {
    return false;
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Les webhooks et le cron sont publics (protégés par leur propre signature).
  if (pathname.startsWith("/api/webhooks") || pathname.startsWith("/api/cron")) {
    return NextResponse.next();
  }

  if (isProtected(pathname, MERCHANT_PREFIXES)) {
    const valid = await hasValidToken(request.cookies.get(SESSION_COOKIE)?.value);
    if (!valid) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("next", pathname);
      return NextResponse.redirect(loginUrl);
    }
    return NextResponse.next();
  }

  if (isProtected(pathname, ADMIN_PREFIXES) && pathname !== "/admin/login") {
    const valid = await hasValidToken(
      request.cookies.get(ADMIN_SESSION_COOKIE)?.value,
    );
    if (!valid) {
      return NextResponse.redirect(new URL("/admin/login", request.url));
    }
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/admin/:path*",
    "/billing/:path*",
    "/api/cron/:path*",
  ],
};
