import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Handles the OAuth-style callback used by:
//   - Email confirmation (signup)
//   - Password recovery ("send reset link")
//
// Supabase redirects the browser here with a `code` (PKCE) that we
// exchange for a session, then forward to `next` (defaulting to /).

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") ?? "/";

  if (code) {
    const supabase = createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(new URL(next, request.url));
    }
    // Fall through on error — dump them at login with a hint.
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(error.message)}`, request.url)
    );
  }

  return NextResponse.redirect(new URL("/login", request.url));
}
