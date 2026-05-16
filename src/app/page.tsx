"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { generateRoomId } from "@/lib/utils";
import { ThemeToggle } from "@/components/theme-toggle";
import { UserMenu } from "@/components/user-menu";
import { ArrowRight, Clipboard, Zap, Monitor } from "lucide-react";

export default function Home() {
  const [roomCode, setRoomCode] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const router = useRouter();

  const handleCreateRoom = () => {
    setIsCreating(true);
    const id = generateRoomId();
    router.push(`/room/${id}`);
  };

  const handleJoinRoom = (e: React.FormEvent) => {
    e.preventDefault();
    const code = roomCode.trim();
    if (code) {
      router.push(`/room/${code}`);
    }
  };

  return (
    <div className="flex min-h-screen flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-2">
          <Clipboard size={20} className="text-zinc-900 dark:text-zinc-100" />
          <span className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
            ClipClaude
          </span>
        </div>
        <div className="flex items-center gap-2">
          <UserMenu />
          <ThemeToggle />
        </div>
      </header>

      {/* Hero */}
      <main className="flex flex-1 flex-col items-center justify-center px-6 pb-24">
        <div className="w-full max-w-md space-y-8">
          {/* Title */}
          <div className="space-y-3 text-center">
            <h1 className="text-4xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
              Sync your clipboard
              <br />
              across devices
            </h1>
            <p className="text-base text-zinc-500 dark:text-zinc-400">
              Paste on one device, copy from the other. Instantly.
              <br />
              Text formatting and images included.
            </p>
          </div>

          {/* Actions */}
          <div className="space-y-4">
            {/* Create Room */}
            <button
              onClick={handleCreateRoom}
              disabled={isCreating}
              className="group flex w-full items-center justify-center gap-2 rounded-xl bg-zinc-900 px-5 py-3.5 text-sm font-medium text-white transition-all hover:bg-zinc-800 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              {isCreating ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white dark:border-zinc-900/30 dark:border-t-zinc-900" />
                  Creating...
                </span>
              ) : (
                <>
                  Create new room
                  <ArrowRight
                    size={16}
                    className="transition-transform group-hover:translate-x-0.5"
                  />
                </>
              )}
            </button>

            {/* Divider */}
            <div className="flex items-center gap-3">
              <div className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
              <span className="text-xs font-medium text-zinc-400 dark:text-zinc-500">
                or join existing
              </span>
              <div className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
            </div>

            {/* Join Room */}
            <form onSubmit={handleJoinRoom} className="flex gap-2">
              <input
                type="text"
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value)}
                placeholder="Enter room code"
                className="flex-1 rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-zinc-500 dark:focus:ring-zinc-500"
              />
              <button
                type="submit"
                disabled={!roomCode.trim()}
                className="rounded-xl border border-zinc-200 bg-white px-5 py-3 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:opacity-40 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
              >
                Join
              </button>
            </form>
          </div>

          {/* Features */}
          <div className="grid grid-cols-3 gap-4 pt-4">
            <div className="flex flex-col items-center gap-2 text-center">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-100 dark:bg-zinc-800">
                <Zap size={18} className="text-zinc-600 dark:text-zinc-400" />
              </div>
              <span className="text-xs text-zinc-500 dark:text-zinc-400">
                Real-time sync
              </span>
            </div>
            <div className="flex flex-col items-center gap-2 text-center">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-100 dark:bg-zinc-800">
                <Clipboard
                  size={18}
                  className="text-zinc-600 dark:text-zinc-400"
                />
              </div>
              <span className="text-xs text-zinc-500 dark:text-zinc-400">
                Rich formatting
              </span>
            </div>
            <div className="flex flex-col items-center gap-2 text-center">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-100 dark:bg-zinc-800">
                <Monitor
                  size={18}
                  className="text-zinc-600 dark:text-zinc-400"
                />
              </div>
              <span className="text-xs text-zinc-500 dark:text-zinc-400">
                Cross-device
              </span>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
