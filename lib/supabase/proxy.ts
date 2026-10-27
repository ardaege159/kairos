import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Refreshes the Supabase session cookie. Market pages are public; personal data (watchlist, portfolios,
 * alerts, notifications) is checked per request with getOwner() and protected by row-level security.
 */
export async function updateSession(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;

  // Magic links fall back to the Site URL root when the callback URL is not allow-listed.
  if (pathname === "/" && searchParams.has("code")) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth/callback";
    return NextResponse.redirect(url);
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    },
  );

  // Must run right after creating the client; it refreshes expired tokens.
  await supabase.auth.getClaims();

  return response;
}
