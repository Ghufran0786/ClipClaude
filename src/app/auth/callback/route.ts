import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { rateLimit, AUTH_RATE_LIMIT } from "@/lib/rate-limit";
import { headers } from "next/headers";

export async function GET(request: Request) {
  const headersList = await headers();
  const ip =
    headersList.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    headersList.get("x-real-ip") ||
    "unknown";

  const result = rateLimit(`callback:${ip}`, AUTH_RATE_LIMIT);
  if (!result.allowed) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": String(Math.ceil(result.resetIn / 1000)) } }
    );
  }

  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_failed`);
}
