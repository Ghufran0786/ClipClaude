"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import Image from "@tiptap/extension-image";
import Placeholder from "@tiptap/extension-placeholder";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import Highlight from "@tiptap/extension-highlight";
import TextAlign from "@tiptap/extension-text-align";
import { common, createLowlight } from "lowlight";
import { useEffect, useRef, useCallback, useState } from "react";
import { getSupabase } from "@/lib/supabase";
import {
  fetchRoomContent,
  persistRoomContent,
  ROOM_CLIPBOARD_MIGRATION_MESSAGE,
} from "@/lib/room-content";
import { isContentWithinLimit } from "@/lib/content-limits";
import { copyEditorContent } from "@/lib/copy-content";
import { Toolbar } from "./toolbar";
import { Copy, Check } from "lucide-react";
import { toast } from "sonner";
import type { RealtimeChannel } from "@supabase/supabase-js";
import type { Editor } from "@tiptap/react";
import type { JSONContent } from "@tiptap/core";

const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/gif", "image/webp"];
const BROADCAST_DEBOUNCE_MS = 150;
const PERSIST_DEBOUNCE_MS = 400;
const RECONNECT_DEBOUNCE_MS = 500;
/** Backoff steps cap at 10s; attempt counter never stops reconnects. */
const RECONNECT_BACKOFF_MS = [1000, 2000, 5000, 10_000];

function docHasImage(node: JSONContent): boolean {
  if (node.type === "image") return true;
  return node.content?.some(docHasImage) ?? false;
}

function getFirstImageUrl(node: JSONContent): string | null {
  if (node.type === "image" && typeof node.attrs?.src === "string") {
    return node.attrs.src;
  }
  for (const child of node.content ?? []) {
    const url = getFirstImageUrl(child);
    if (url) return url;
  }
  return null;
}

/** Strip blob:/data: image URLs so receivers never get broken placeholders. */
function sanitizeContentForSync(content: JSONContent): Record<string, unknown> {
  const clone = JSON.parse(JSON.stringify(content)) as JSONContent;

  const walk = (node: JSONContent) => {
    if (node.type === "image" && typeof node.attrs?.src === "string") {
      const src = node.attrs.src;
      if (src.startsWith("blob:") || src.startsWith("data:")) {
        delete node.attrs.src;
      }
    }
    node.content?.forEach(walk);
  };

  walk(clone);
  return clone as Record<string, unknown>;
}

interface ClipEditorProps {
  roomId: string;
  onStatusChange?: (status: "connected" | "connecting" | "disconnected") => void;
}

export function ClipEditor({ roomId, onStatusChange }: ClipEditorProps) {
  const channelRef = useRef<RealtimeChannel | null>(null);
  const isRemoteUpdate = useRef(false);
  const broadcastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const persistTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptRef = useRef(0);
  /** Highest monotonic room version applied to the editor (DB + broadcast). */
  const lastAppliedVersionRef = useRef(0);
  /** Highest server-assigned version known locally (hydrate/persist). */
  const lastKnownServerVersionRef = useRef(0);
  /** Optimistic version counter for fast live broadcasts before persist completes. */
  const localOptimisticVersionRef = useRef(0);
  const fetchGenerationRef = useRef(0);
  const migrationWarningShownRef = useRef(false);
  const editorRef = useRef<Editor | null>(null);

  const showMigrationMissingToast = useCallback(() => {
    if (migrationWarningShownRef.current) return;
    migrationWarningShownRef.current = true;
    toast.error(ROOM_CLIPBOARD_MIGRATION_MESSAGE, { duration: 8000 });
  }, []);
  const [contentCopied, setContentCopied] = useState(false);
  const [sessionId] = useState(() => crypto.randomUUID());

  const lowlight = createLowlight(common);

  const nextOptimisticVersion = useCallback(() => {
    const base = Math.max(
      lastAppliedVersionRef.current,
      lastKnownServerVersionRef.current,
      localOptimisticVersionRef.current
    );
    localOptimisticVersionRef.current = base + 1;
    return localOptimisticVersionRef.current;
  }, []);

  /**
   * Reconcile on monotonic room version (server-assigned bigint), never wall-clock time.
   * A peer broadcast with version 15 is kept when a stale DB hydrate returns version 10.
   */
  const applyRemoteContent = useCallback(
    (content: Record<string, unknown>, version: number) => {
      const ed = editorRef.current;
      if (!ed) return false;

      if (version <= lastAppliedVersionRef.current) {
        return false;
      }

      isRemoteUpdate.current = true;
      const currentSelection = ed.state.selection;
      ed.commands.setContent(content, { emitUpdate: false });

      try {
        const maxPos = ed.state.doc.content.size;
        const safeFrom = Math.min(currentSelection.from, maxPos);
        const safeTo = Math.min(currentSelection.to, maxPos);
        ed.commands.setTextSelection({ from: safeFrom, to: safeTo });
      } catch {
        // Selection restore can fail if doc structure changed significantly
      }

      isRemoteUpdate.current = false;

      lastAppliedVersionRef.current = version;
      lastKnownServerVersionRef.current = Math.max(
        lastKnownServerVersionRef.current,
        version
      );
      localOptimisticVersionRef.current = Math.max(
        localOptimisticVersionRef.current,
        version
      );

      return true;
    },
    []
  );

  const broadcastContent = useCallback(
    (content: Record<string, unknown>, version: number) => {
      if (!channelRef.current) return;

      channelRef.current.send({
        type: "broadcast",
        event: "content-sync",
        payload: {
          content,
          version,
          sender: sessionId,
        },
      });
    },
    [sessionId]
  );

  const persistContent = useCallback(
    async (content: Record<string, unknown>) => {
      const { version, error, migrationMissing, contentTooLarge } =
        await persistRoomContent(roomId, content);

      if (error) {
        console.error("Failed to persist content:", error.message);
        if (migrationMissing) {
          showMigrationMissingToast();
        } else if (contentTooLarge) {
          toast.error("Content is too large to save (max 512 KB)");
        } else {
          toast.error("Failed to save content");
        }
        return;
      }

      if (version === null) return;

      lastKnownServerVersionRef.current = Math.max(
        lastKnownServerVersionRef.current,
        version
      );
      localOptimisticVersionRef.current = Math.max(
        localOptimisticVersionRef.current,
        version
      );

      // Authoritative broadcast with server-assigned version after persist.
      broadcastContent(content, version);
    },
    [roomId, broadcastContent, showMigrationMissingToast]
  );

  const queueLocalSync = useCallback(
    (rawContent: JSONContent) => {
      const content = sanitizeContentForSync(rawContent);

      if (!isContentWithinLimit(content)) {
        toast.error("Content is too large to sync (max 512 KB)");
        return;
      }

      if (broadcastTimerRef.current) clearTimeout(broadcastTimerRef.current);
      broadcastTimerRef.current = setTimeout(() => {
        broadcastContent(content, nextOptimisticVersion());
      }, BROADCAST_DEBOUNCE_MS);

      if (persistTimerRef.current) clearTimeout(persistTimerRef.current);
      persistTimerRef.current = setTimeout(() => {
        void persistContent(content);
      }, PERSIST_DEBOUNCE_MS);
    },
    [broadcastContent, persistContent, nextOptimisticVersion]
  );

  const hydrateFromDb = useCallback(async () => {
    const generation = ++fetchGenerationRef.current;
    const { row, migrationMissing } = await fetchRoomContent(roomId);

    if (generation !== fetchGenerationRef.current) return;

    if (migrationMissing) {
      showMigrationMissingToast();
      return;
    }

    if (!row?.content) return;

    lastKnownServerVersionRef.current = Math.max(
      lastKnownServerVersionRef.current,
      row.version
    );

    applyRemoteContent(row.content as Record<string, unknown>, row.version);
  }, [roomId, applyRemoteContent, showMigrationMissingToast]);

  const handleImageUpload = useCallback(
    async (file: File) => {
      if (!editorRef.current) return;

      if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
        toast.error("Unsupported image type. Use PNG, JPEG, GIF, or WebP.");
        return;
      }

      if (file.size > MAX_IMAGE_SIZE_BYTES) {
        toast.error("Image is too large. Maximum size is 5 MB.");
        return;
      }

      const extension = file.type.split("/")[1] ?? "png";
      const fileName = `${roomId}/${Date.now()}-pasted-image.${extension}`;
      const supabase = getSupabase();

      const { data, error } = await supabase.storage
        .from("clipboard-images")
        .upload(fileName, file, {
          cacheControl: "3600",
          upsert: false,
          contentType: file.type,
        });

      if (error) {
        console.error("Image upload failed:", error.message);
        toast.error("Image upload failed. Check storage bucket setup.");
        return;
      }

      const {
        data: { publicUrl },
      } = supabase.storage.from("clipboard-images").getPublicUrl(data.path);

      editorRef.current
        .chain()
        .focus()
        .setImage({ src: publicUrl, alt: "Pasted image" })
        .run();
      toast.success("Image pasted");
    },
    [roomId]
  );

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        codeBlock: false,
        link: false,
        underline: false,
      }),
      CodeBlockLowlight.configure({ lowlight }),
      Image.configure({ inline: true, allowBase64: false }),
      Placeholder.configure({
        placeholder: "Paste or type anything here — it syncs instantly to your other device...",
      }),
      Underline,
      Link.configure({ openOnClick: false, autolink: true }),
      Highlight,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
    ],
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class:
          "prose prose-zinc dark:prose-invert max-w-none min-h-[300px] px-5 py-4 focus:outline-none",
      },
      handlePaste: (_view, event) => {
        const items = event.clipboardData?.items;
        if (!items) return false;

        for (const item of Array.from(items)) {
          if (item.type.startsWith("image/")) {
            event.preventDefault();
            const file = item.getAsFile();
            if (file) void handleImageUpload(file);
            return true;
          }
        }

        return false;
      },
      handleDrop: (_view, event) => {
        const files = event.dataTransfer?.files;
        if (!files?.length) return false;

        for (const file of Array.from(files)) {
          if (file.type.startsWith("image/")) {
            event.preventDefault();
            void handleImageUpload(file);
            return true;
          }
        }

        return false;
      },
    },
    onUpdate: ({ editor: e }) => {
      if (isRemoteUpdate.current) return;
      queueLocalSync(e.getJSON());
    },
  });

  useEffect(() => {
    editorRef.current = editor;
  }, [editor]);

  const handleCopyContent = useCallback(async () => {
    if (!editor) return;

    const json = editor.getJSON();
    const text = editor.getText();
    const html = editor.getHTML();
    const hasImage = docHasImage(json);
    const imageUrl = getFirstImageUrl(json);

    try {
      const result = await copyEditorContent({ text, html, hasImage, imageUrl });

      if (result.mode === "unsupported") {
        toast.error("Image copy is not supported in this browser");
        return;
      }

      setContentCopied(true);
      if (result.mode === "url") {
        toast.success("Image URL copied (image binary copy not supported here)");
      } else if (result.mode === "text") {
        toast.success(
          hasImage
            ? "Text copied; image copy is not supported in this browser"
            : "Content copied as plain text"
        );
      } else {
        toast.success(hasImage ? "Content copied with image" : "Content copied with formatting");
      }
      setTimeout(() => setContentCopied(false), 2000);
    } catch {
      toast.error("Nothing to copy");
    }
  }, [editor]);

  const handleFileInput = useCallback(() => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) void handleImageUpload(file);
    };
    input.click();
  }, [handleImageUpload]);

  useEffect(() => {
    if (!editor) return;

    lastAppliedVersionRef.current = 0;
    lastKnownServerVersionRef.current = 0;
    localOptimisticVersionRef.current = 0;
    reconnectAttemptRef.current = 0;

    const supabase = getSupabase();
    let cancelled = false;

    const clearReconnectTimer = () => {
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
    };

    const clearReconnectDebounce = () => {
      if (reconnectDebounceRef.current) {
        clearTimeout(reconnectDebounceRef.current);
        reconnectDebounceRef.current = null;
      }
    };

    const teardownChannel = async () => {
      if (channelRef.current) {
        await supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };

    const setupChannel = () => {
      onStatusChange?.("connecting");

      const channel = supabase.channel(`room:${roomId}`, {
        config: { broadcast: { self: false } },
      });

      channel
        .on("broadcast", { event: "content-sync" }, ({ payload }) => {
          if (payload.sender === sessionId) return;
          if (typeof payload.version !== "number") return;
          applyRemoteContent(payload.content, payload.version);
        })
        .subscribe((status) => {
          if (cancelled) return;

          if (status === "SUBSCRIBED") {
            reconnectAttemptRef.current = 0;
            onStatusChange?.("connected");
          } else if (
            status === "TIMED_OUT" ||
            status === "CLOSED" ||
            status === "CHANNEL_ERROR"
          ) {
            void requestReconnect();
          }
        });

      channelRef.current = channel;
    };

    /**
     * Reconnect retries indefinitely: attempt counter only selects backoff delay
     * (capped at 10s) and resets on SUBSCRIBED — there is no max-attempt cutoff.
     */
    const executeReconnect = async () => {
      if (cancelled) return;

      onStatusChange?.("connecting");

      const delay =
        RECONNECT_BACKOFF_MS[
          Math.min(reconnectAttemptRef.current, RECONNECT_BACKOFF_MS.length - 1)
        ];
      reconnectAttemptRef.current += 1;

      clearReconnectTimer();
      reconnectTimerRef.current = setTimeout(async () => {
        if (cancelled) return;

        await teardownChannel();

        if (!supabase.realtime.isConnected()) {
          supabase.realtime.connect();
        }

        await hydrateFromDb();
        setupChannel();
        // If subscribe fails again, channel status handler calls requestReconnect → repeat forever.
      }, delay);
    };

    const requestReconnect = async () => {
      if (cancelled) return;

      onStatusChange?.("disconnected");
      await teardownChannel();

      if (reconnectDebounceRef.current) return;

      reconnectDebounceRef.current = setTimeout(() => {
        reconnectDebounceRef.current = null;
        void executeReconnect();
      }, RECONNECT_DEBOUNCE_MS);
    };

    const handleHeartbeat = (status: string) => {
      if (cancelled) return;

      if (status === "ok" || status === "sent") {
        if (channelRef.current?.state === "joined") {
          reconnectAttemptRef.current = 0;
          onStatusChange?.("connected");
        }
      } else if (status === "timeout" || status === "disconnected") {
        void requestReconnect();
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState !== "visible" || cancelled) return;

      if (!supabase.realtime.isConnected()) {
        supabase.realtime.connect();
      }

      void hydrateFromDb();

      if (channelRef.current?.state !== "joined") {
        void requestReconnect();
      }
    };

    onStatusChange?.("connecting");
    supabase.realtime.onHeartbeat(handleHeartbeat);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    void (async () => {
      await hydrateFromDb();
      if (!cancelled) setupChannel();
    })();

    return () => {
      cancelled = true;
      fetchGenerationRef.current += 1;
      clearReconnectTimer();
      clearReconnectDebounce();
      if (broadcastTimerRef.current) clearTimeout(broadcastTimerRef.current);
      if (persistTimerRef.current) clearTimeout(persistTimerRef.current);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      supabase.realtime.onHeartbeat(() => {});
      void teardownChannel();
    };
  }, [editor, roomId, onStatusChange, applyRemoteContent, hydrateFromDb, sessionId]);

  return (
    <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm transition-colors dark:border-zinc-700 dark:bg-zinc-900">
      <div className="flex items-center justify-between">
        <div className="flex-1 overflow-x-auto">
          <Toolbar editor={editor} onImageUpload={handleFileInput} />
        </div>
        <button
          onClick={handleCopyContent}
          className="mr-2 flex shrink-0 items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
          title="Copy all content"
        >
          {contentCopied ? (
            <>
              <Check size={13} />
              Copied!
            </>
          ) : (
            <>
              <Copy size={13} />
              Copy
            </>
          )}
        </button>
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}
