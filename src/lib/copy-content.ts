/**
 * Copy editor content to the OS clipboard with graceful degradation for image support.
 * Safari requires ClipboardItem blobs as Promises (constructed synchronously).
 */
export async function copyEditorContent(options: {
  text: string;
  html: string;
  hasImage: boolean;
  imageUrl?: string | null;
}): Promise<{ mode: "rich" | "text" | "url" | "unsupported" }> {
  const { text, html, hasImage, imageUrl } = options;
  const trimmed = text.trim();

  if (!trimmed && !hasImage) {
    throw new Error("empty");
  }

  const canWriteRich =
    typeof ClipboardItem !== "undefined" &&
    typeof navigator.clipboard?.write === "function";

  if (canWriteRich) {
    try {
      const items: Record<string, string | Blob | Promise<Blob>> = {};

      if (trimmed) {
        items["text/plain"] = new Blob([text], { type: "text/plain" });
        items["text/html"] = new Blob([html], { type: "text/html" });
      }

      if (hasImage && imageUrl && !imageUrl.startsWith("blob:")) {
        // Promise form is required for Safari; must not await before ClipboardItem().
        items["image/png"] = fetch(imageUrl).then((response) => {
          if (!response.ok) throw new Error("image fetch failed");
          return response.blob();
        });
      }

      await navigator.clipboard.write([new ClipboardItem(items)]);
      return { mode: hasImage ? "rich" : "rich" };
    } catch {
      // Fall through to simpler strategies.
    }
  }

  if (trimmed) {
    try {
      await navigator.clipboard.writeText(text);
      return { mode: "text" };
    } catch {
      // Fall through.
    }
  }

  if (hasImage && imageUrl && !imageUrl.startsWith("blob:")) {
    try {
      await navigator.clipboard.writeText(imageUrl);
      return { mode: "url" };
    } catch {
      // Fall through.
    }
  }

  return { mode: "unsupported" };
}

export function supportsClipboardImageWrite(): boolean {
  return (
    typeof ClipboardItem !== "undefined" &&
    typeof navigator.clipboard?.write === "function"
  );
}
