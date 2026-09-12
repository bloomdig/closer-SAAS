import { cookies } from "next/headers";

export async function POST() {
  try {
    (await cookies()).delete("closer_session");
    return Response.json({ success: true });
  } catch {
    return Response.json({ error: "Logout failed" }, { status: 500 });
  }
}
