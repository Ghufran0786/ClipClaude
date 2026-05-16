"use client";

import { useParams, useRouter } from "next/navigation";
import { useState, useCallback } from "react";
import { ClipEditor } from "@/components/editor";
import { ThemeToggle } from "@/components/theme-toggle";
import { toast } from "sonner";
import {
  Clipboard,
  ArrowLeft,
  Copy,
  Check,
  Wifi,
  WifiOff,
  Loader2,
} from "lucide-react";

export default function RoomPage() {
  const params = useParams();
  const router = useRouter();
  const roomId = params.roomId as string;
  const [connectionStatus, setConnectionStatus] = useState<
    "connected" | "connecting" | "disconnected"
  >("connecting");
  const [copied, setCopied] = useState(false);

  const handleCopyRoomLink = useCallback(async () => {
    const url = `${window.location.origin}/room/${roomId}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("Room link copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy link");
    }
  }, [roomId]);

  const handleCopyRoomCode = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(roomId);
      toast.success("Room code copied");
    } catch {
      toast.error("Failed to copy code");
    }
  }, [roomId]);

  const statusConfig = {
    connected: {
      icon: <Wifi size={14} />,
      text: "Connected",
      color: "text-emerald-600 dark:text-emerald-400",
      dot: "bg-emerald-500",
    },
    connecting: {
      icon: <Loader2 size={14} className="animate-spin" />,
      text: "Connecting...",
      color: "text-amber-600 dark:text-amber-400",
      dot: "bg-amber-500",
    },
    disconnected: {
      icon: <WifiOff size={14} />,
      text: "Disconnected",
      color: "text-red-500 dark:text-red-400",
      dot: "bg-red-500",
    },
  };

  const status = statusConfig[connectionStatus];

  return (
    <div className="flex min-h-screen flex-col">
      {/* Header */}
      <header className="border-b border-zinc-200 bg-white/80 backdrop-blur-sm dark:border-zinc-800 dark:bg-zinc-950/80">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push("/")}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
              aria-label="Back to home"
            >
              <ArrowLeft size={18} />
            </button>
            <div className="flex items-center gap-2">
              <Clipboard
                size={18}
                className="text-zinc-900 dark:text-zinc-100"
              />
              <span className="text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
                ClipClaude
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Connection Status */}
            <div
              className={`flex items-center gap-1.5 text-xs font-medium ${status.color}`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${status.dot} ${connectionStatus === "connecting" ? "animate-pulse" : ""}`}
              />
              <span className="hidden sm:inline">{status.text}</span>
            </div>

            {/* Room Code */}
            <button
              onClick={handleCopyRoomCode}
              className="flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-xs font-mono text-zinc-600 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
              title="Click to copy room code"
            >
              {roomId}
            </button>

            {/* Copy Link */}
            <button
              onClick={handleCopyRoomLink}
              className="flex h-8 items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
            >
              {copied ? <Check size={14} /> : <Copy size={14} />}
              <span className="hidden sm:inline">
                {copied ? "Copied!" : "Share link"}
              </span>
            </button>

            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Editor Area */}
      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col px-4 py-6 sm:px-6">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
              Shared Clipboard
            </h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Paste here and it appears on your other device instantly
            </p>
          </div>
        </div>

        <div className="flex-1">
          <ClipEditor
            roomId={roomId}
            onStatusChange={setConnectionStatus}
          />
        </div>

        {/* Footer hint */}
        <div className="mt-4 text-center">
          <p className="text-xs text-zinc-400 dark:text-zinc-600">
            Open this room on your other device to sync &middot; Supports rich
            text, code, and images
          </p>
        </div>
      </main>
    </div>
  );
}
