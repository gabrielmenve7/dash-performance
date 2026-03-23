import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role === "CLIENT") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const token = req.nextUrl.searchParams.get("token");
  if (!token) {
    return NextResponse.json({ error: "Missing token" }, { status: 400 });
  }

  try {
    const url = new URL("https://graph.facebook.com/v21.0/me/adaccounts");
    url.searchParams.set("fields", "id,name,account_status,currency,timezone_name,business_name");
    url.searchParams.set("access_token", token);
    url.searchParams.set("limit", "100");

    const res = await fetch(url.toString());
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error?.message || "Failed to fetch ad accounts");
    }

    const data = await res.json();

    const accounts = (data.data || []).map(
      (acc: {
        id: string;
        name: string;
        account_status: number;
        currency?: string;
        timezone_name?: string;
        business_name?: string;
      }) => ({
        id: acc.id.replace("act_", ""),
        name: acc.name,
        status: acc.account_status === 1 ? "active" : "inactive",
        currency: acc.currency,
        timezone: acc.timezone_name,
        businessName: acc.business_name,
      })
    );

    return NextResponse.json(accounts);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
