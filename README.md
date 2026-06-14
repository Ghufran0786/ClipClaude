# ClipClaude

Real-time clipboard sharing across devices. Paste on one device, copy from the other — instantly. Supports rich text formatting, code blocks with syntax highlighting, and images.

## Features
- **Real-time sync** — Changes appear on all connected devices instantly via Supabase Realtime
- **Rich text editor** — Bold, italic, headings, lists, links, highlights, and more (powered by TipTap)
- **Code blocks** — Syntax-highlighted code blocks with language detection
- **Image support** — Paste or drag-and-drop images, uploaded to Supabase Storage
- **Format-preserving copy** — Copy button preserves formatting (HTML + plain text); graceful fallback in Firefox/Safari
- **Authentication** — Supabase Auth with email/password sign-in and sign-up
- **Dark/Light mode** — Theme toggle with system preference detection
- **Room-based sharing** — Create or join rooms with shareable codes/links

## Tech Stack

- **Framework:** Next.js 16 (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS 4
- **Editor:** TipTap with extensions (code-block-lowlight, image, highlight, etc.)
- **Backend:** Supabase (Auth, Realtime Broadcast, Storage, Postgres)
- **Deployment:** Vercel

## Setup

### Prerequisites

- Node.js 18+
- A [Supabase](https://supabase.com) project

### 1. Clone and install

```bash
git clone https://github.com/Ghufran0786/ClipClaude.git
cd ClipClaude
npm install
```

### 2. Environment variables

Copy the example file and fill in your Supabase credentials:

```bash
cp .env.example .env.local
```

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Project URL from Supabase Dashboard → Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Anon/public key from the same page |
| `NEXT_PUBLIC_SUPABASE_REALTIME_DEBUG` | No | Set to `true` to log Realtime worker/heartbeat events in the browser console (debug only) |

### 3. Supabase dashboard

1. **Email auth** — Authentication → Providers → enable Email.
2. **Realtime** — Database → Replication (or Project Settings → Realtime) → confirm Realtime is enabled for the project. Broadcast channels do not require a table, but Realtime must be on.
3. **SQL migrations** — Open the SQL Editor and run **`supabase/init.sql`** (single combined, idempotent script). Alternatively run `001` then `002` from `supabase/migrations/` in order.

   **Verify:** In SQL Editor run `SELECT * FROM public.room_clipboard;` — expect 0 rows (not an error). The init script ends with `NOTIFY pgrst, 'reload schema'`; if REST still 404s, wait a few seconds or re-run that notify.

   If migrations were not applied, the app shows: *"Database not initialized — run supabase/init.sql in Supabase Dashboard → SQL Editor"*.

4. **Storage bucket** — After running 001, confirm under Storage that bucket `clipboard-images` exists and is public. The migration creates it if missing.

5. **API keys** — Copy the project URL and anon key into `.env.local`.

### 4. Local development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### 5. Production build

```bash
npm run build
npm start
```

For deployment (e.g. Vercel), set the same environment variables in the project settings.

## Architecture

### Realtime resilience (Bug #1)

The browser Supabase client uses a single singleton (`getSupabase()` in `src/lib/supabase.ts`) with `realtime.worker: true` so heartbeats survive background-tab timer throttling, a 15s heartbeat interval, and capped exponential reconnect backoff. The editor monitors heartbeat status and channel subscribe state, coalesces reconnect attempts, tears down and re-subscribes channels after drops, and re-hydrates from the database on `visibilitychange`. Reconnect retries indefinitely (backoff caps at 10s; no max-attempt cutoff). A Content-Security-Policy header includes `worker-src 'self' blob: https://*.supabase.co` so a future CSP cannot silently kill the Realtime worker.

### Version-based reconciliation (Bug #3)

Room content is persisted in `room_clipboard` with a DB-incremented `version bigint` (set to 1 on insert, incremented on every update via trigger). Clients reconcile solely on this integer — never wall-clock timestamps. On join and reconnect, the latest row is fetched and applied only if `version > lastApplied`. Live typing uses optimistic version numbers for fast broadcast (150ms); authoritative server version is written on persist (400ms debounce) and re-broadcast. **Known limitation:** true simultaneous typing on two devices can briefly reject intermediate optimistic updates when both clients generate the same optimistic version before the server persist settles; the final state converges correctly once typing stops (last-write-wins). This is acceptable for a shared clipboard but would not suit collaborative document editing without CRDTs/OT.

### Image flow (Bug #2)

Image paste/drop is intercepted before TipTap's default handler (`allowBase64: false`). The blob is uploaded to Supabase Storage (`clipboard-images` bucket), and only after a public HTTPS URL is returned is the TipTap image node inserted — which then triggers sync. Outgoing payloads are sanitized to strip any `blob:` or `data:` image URLs. Copy uses `ClipboardItem` with promise-based blobs (Safari-safe) and falls back to plain text or image URL with a user-visible toast when binary image copy is unsupported.

## How It Works

1. Sign in with your email and password
2. Create a new room or join an existing one with a room code
3. Paste or type content in the editor — it syncs to all devices in the same room in real-time
4. Use the Copy button to copy content with formatting preserved
5. Share the room link or code with your other devices

## Deployment

Deploy to Vercel and add `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and optionally `NEXT_PUBLIC_SUPABASE_REALTIME_DEBUG` in the project settings. Run both SQL migrations against your production Supabase project before going live.

## License

MIT
