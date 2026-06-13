import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

let browserClient: SupabaseClient | null = null;

/**
 * Canonical browser Supabase client (auth + realtime + storage).
 * All client components must use getSupabase() — do not call createBrowserClient elsewhere.
 */
export function getSupabase(): SupabaseClient {
  if (!browserClient) {
    const debugRealtime = process.env.NEXT_PUBLIC_SUPABASE_REALTIME_DEBUG === "true";

    browserClient = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        realtime: {
          worker: true,
          heartbeatIntervalMs: 15_000,
          reconnectAfterMs: (tries) =>
            [1000, 2000, 5000, 10_000][Math.min(tries - 1, 3)] ?? 10_000,
          ...(debugRealtime ? { logLevel: "info" as const } : {}),
        },
      }
    );
  }
  return browserClient;
}
