import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { rateLimit, API_RATE_LIMIT } from "@/lib/rate-limit";
import { headers } from "next/headers";

export async function POST(request: Request) {
  const headersList = await headers();
  const ip =
    headersList.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    headersList.get("x-real-ip") ||
    "unknown";

  const result = rateLimit(`signout:${ip}`, API_RATE_LIMIT);
  if (!result.allowed) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": String(Math.ceil(result.resetIn / 1000)) } }
    );
  }

  const supabase = await createClient();
  await supabase.auth.signOut();

  const { origin } = new URL(request.url);
  return NextResponse.redirect(`${origin}/login`, { status: 302 });
}
