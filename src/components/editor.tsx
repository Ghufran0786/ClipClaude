"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import Placeholder from "@tiptap/extension-placeholder";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import Highlight from "@tiptap/extension-highlight";
import TextAlign from "@tiptap/extension-text-align";
import { useEffect, useRef, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { Toolbar } from "./toolbar";
import type { RealtimeChannel } from "@supabase/supabase-js";

interface ClipEditorProps {
  roomId: string;
  onStatusChange?: (status: "connected" | "connecting" | "disconnected") => void;
}

export function ClipEditor({ roomId, onStatusChange }: ClipEditorProps) {
  const channelRef = useRef<RealtimeChannel | null>(null);
  const isRemoteUpdate = useRef(false);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sessionId = useRef(
    typeof crypto !== "undefined" ? crypto.randomUUID() : Math.random().toString(36).slice(2)
  );

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Image.configure({ inline: true, allowBase64: true }),
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
            if (file) handleImageUpload(file);
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
            handleImageUpload(file);
            return true;
          }
        }

        return false;
      },
    },
    onUpdate: ({ editor: e }) => {
      if (isRemoteUpdate.current) return;

      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      debounceTimer.current = setTimeout(() => {
        broadcastContent(e.getJSON());
      }, 150);
    },
  });

  const handleImageUpload = useCallback(
    async (file: File) => {
      if (!editor) return;

      const fileName = `${roomId}/${Date.now()}-${file.name || "pasted-image"}`;
      const { data, error } = await supabase.storage
        .from("clipboard-images")
        .upload(fileName, file, {
          cacheControl: "3600",
          upsert: false,
        });

      if (error) {
        console.error("Image upload failed:", error.message);
        return;
      }

      const {
        data: { publicUrl },
      } = supabase.storage.from("clipboard-images").getPublicUrl(data.path);

      editor.chain().focus().setImage({ src: publicUrl }).run();
    },
    [editor, roomId]
  );

  const broadcastContent = useCallback(
    (content: Record<string, unknown>) => {
      if (!channelRef.current) return;

      channelRef.current.send({
        type: "broadcast",
        event: "content-sync",
        payload: {
          content,
          sender: sessionId.current,
        },
      });
    },
    []
  );

  const handleFileInput = useCallback(() => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) handleImageUpload(file);
    };
    input.click();
  }, [handleImageUpload]);

  useEffect(() => {
    if (!editor) return;

    onStatusChange?.("connecting");

    const channel = supabase.channel(`room:${roomId}`, {
      config: { broadcast: { self: false } },
    });

    channel
      .on("broadcast", { event: "content-sync" }, ({ payload }) => {
        if (payload.sender === sessionId.current) return;

        isRemoteUpdate.current = true;
        const currentSelection = editor.state.selection;
        editor.commands.setContent(payload.content, { emitUpdate: false });

        try {
          const maxPos = editor.state.doc.content.size;
          const safeFrom = Math.min(currentSelection.from, maxPos);
          const safeTo = Math.min(currentSelection.to, maxPos);
          editor.commands.setTextSelection({ from: safeFrom, to: safeTo });
        } catch {
          // Selection restore can fail if doc structure changed significantly
        }

        isRemoteUpdate.current = false;
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          onStatusChange?.("connected");
        } else if (status === "CLOSED" || status === "CHANNEL_ERROR") {
          onStatusChange?.("disconnected");
        }
      });

    channelRef.current = channel;

    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      supabase.removeChannel(channel);
    };
  }, [editor, roomId, onStatusChange]);

  return (
    <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm transition-colors dark:border-zinc-700 dark:bg-zinc-900">
      <Toolbar editor={editor} onImageUpload={handleFileInput} />
      <EditorContent editor={editor} />
    </div>
  );
}
