/** Comparaison de chaînes en temps constant (évite les attaques temporelles). */
import { timingSafeEqual } from "node:crypto";

export function timingSafeEqualString(a: string, b: string): boolean {
  if (typeof a !== "string" || typeof b !== "string") return false;
  if (a.length === 0 || b.length === 0) return false;

  const bufferA = Buffer.from(a, "utf8");
  const bufferB = Buffer.from(b, "utf8");
  if (bufferA.length !== bufferB.length) return false;

  try {
    return timingSafeEqual(bufferA, bufferB);
  } catch {
    return false;
  }
}
