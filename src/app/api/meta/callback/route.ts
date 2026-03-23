import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role === "CLIENT") {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  const code = req.nextUrl.searchParams.get("code");
  const error = req.nextUrl.searchParams.get("error");

  if (error || !code) {
    const errorMsg = req.nextUrl.searchParams.get("error_description") || "Authorization denied";
    return NextResponse.redirect(
      new URL(`/settings?tab=accounts&error=${encodeURIComponent(errorMsg)}`, req.url)
    );
  }

  const appId = process.env.META_APP_ID!;
  const appSecret = process.env.META_APP_SECRET!;
  const redirectUri = `${process.env.NEXTAUTH_URL}/api/meta/callback`;

  try {
    const tokenUrl = new URL("https://graph.facebook.com/v21.0/oauth/access_token");
    tokenUrl.searchParams.set("client_id", appId);
    tokenUrl.searchParams.set("client_secret", appSecret);
    tokenUrl.searchParams.set("redirect_uri", redirectUri);
    tokenUrl.searchParams.set("code", code);

    const tokenRes = await fetch(tokenUrl.toString());
    if (!tokenRes.ok) {
      const err = await tokenRes.json();
      throw new Error(err.error?.message || "Failed to exchange code for token");
    }

    const { access_token: shortToken } = await tokenRes.json();

    const longTokenUrl = new URL("https://graph.facebook.com/v21.0/oauth/access_token");
    longTokenUrl.searchParams.set("grant_type", "fb_exchange_token");
    longTokenUrl.searchParams.set("client_id", appId);
    longTokenUrl.searchParams.set("client_secret", appSecret);
    longTokenUrl.searchParams.set("fb_exchange_token", shortToken);

    const longTokenRes = await fetch(longTokenUrl.toString());
    if (!longTokenRes.ok) {
      throw new Error("Failed to exchange for long-lived token");
    }

    const { access_token: longToken, expires_in } = await longTokenRes.json();

    const expiresAt = new Date(Date.now() + (expires_in || 5184000) * 1000).toISOString();

    return NextResponse.redirect(
      new URL(
        `/settings?tab=accounts&meta_token=${encodeURIComponent(longToken)}&expires_at=${encodeURIComponent(expiresAt)}`,
        req.url
      )
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "OAuth failed";
    return NextResponse.redirect(
      new URL(`/settings?tab=accounts&error=${encodeURIComponent(message)}`, req.url)
    );
  }
}
