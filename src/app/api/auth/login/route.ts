import { db } from "@/db";
import { merchants } from "@/db/schema";
import bcrypt from "bcryptjs";
import { createSession } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return Response.json({ error: "Email and password required" }, { status: 400 });
    }

    const allMerchants = await db.select().from(merchants);
    const user = allMerchants.find((m: any) => m.email === email);
    if (!user) {
      return Response.json({ error: "Invalid credentials" }, { status: 401 });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return Response.json({ error: "Invalid credentials" }, { status: 401 });
    }

    await createSession(user.id, user.email);

    return Response.json({ success: true, merchantId: user.id });
  } catch (e: any) {
    return Response.json({ error: e.message || "Login failed" }, { status: 500 });
  }
}
