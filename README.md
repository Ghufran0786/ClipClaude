# ClipClaude

Real-time clipboard sharing across devices. Paste on one device, copy from the other — instantly. Supports rich text formatting, code blocks with syntax highlighting, and images.

## Features

- **Real-time sync** — Changes appear on all connected devices instantly via Supabase Realtime
- **Rich text editor** — Bold, italic, headings, lists, links, highlights, and more (powered by TipTap)
- **Code blocks** — Syntax-highlighted code blocks with language detection
- **Image support** — Paste or drag-and-drop images, uploaded to Supabase Storage
- **Format-preserving copy** — Copy button preserves formatting (HTML + plain text)
- **Authentication** — Supabase Auth with email/password sign-in and sign-up
- **Dark/Light mode** — Theme toggle with system preference detection
- **Room-based sharing** — Create or join rooms with shareable codes/links

## Tech Stack

- **Framework:** Next.js 16 (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS 4
- **Editor:** TipTap with extensions (code-block-lowlight, image, highlight, etc.)
- **Backend:** Supabase (Auth, Realtime Broadcast, Storage)
- **Deployment:** Vercel

## Getting Started

### Prerequisites

- Node.js 18+
- A [Supabase](https://supabase.com) project

### Supabase Setup

1. Create a new project at [supabase.com](https://supabase.com)
2. Enable **Email Auth** in Authentication > Providers
3. Create a public storage bucket named `clipboard-images`
4. Copy your project URL and anon key from Settings > API

### Installation

```bash
git clone https://github.com/Ghufran0786/ClipClaude.git
cd ClipClaude
npm install
```

### Environment Variables

Create a `.env.local` file in the root directory:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
```

### Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Production Build

```bash
npm run build
npm start
```

## How It Works

1. Sign in with your email and password
2. Create a new room or join an existing one with a room code
3. Paste or type content in the editor — it syncs to all devices in the same room in real-time
4. Use the Copy button to copy content with formatting preserved
5. Share the room link or code with your other devices

## Deployment

Deploy to Vercel and add your `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` environment variables in the project settings.

## License

MIT
