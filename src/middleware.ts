import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

export async function middleware(req: NextRequest) {
  // Never run auth on Next internals (HMR, CSS, chunks). A stale or mismatched
  // dev server must not redirect these — missing CSS looks like "no design".
  if (req.nextUrl.pathname.startsWith("/_next")) {
    return NextResponse.next();
  }

  const isLoginPage = req.nextUrl.pathname.startsWith("/login");
  const isApiAuth = req.nextUrl.pathname.startsWith("/api/auth");
  const isApi = req.nextUrl.pathname.startsWith("/api/");

  if (isApiAuth) return NextResponse.next();

  if (req.nextUrl.pathname === "/api/health") {
    return NextResponse.next();
  }

  // GET: Vercel Cron (Bearer CRON_SECRET). POST: session checked in the route.
  if (req.nextUrl.pathname === "/api/sync") {
    return NextResponse.next();
  }

  const token = await getToken({
    req,
    secret: process.env.NEXTAUTH_SECRET,
  });

  const isLoggedIn = !!token;

  if (!isLoggedIn && !isLoginPage) {
    if (isApi) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/login", req.url));
  }

  if (isLoggedIn && isLoginPage) {
    return NextResponse.redirect(new URL("/", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
