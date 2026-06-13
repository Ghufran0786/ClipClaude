import { getSupabase } from "@/lib/supabase";
import {
  isContentWithinLimit,
  validateRoomId,
} from "@/lib/content-limits";

export const ROOM_CLIPBOARD_MIGRATION_MESSAGE =
  "Database not initialized — run supabase/init.sql in Supabase Dashboard → SQL Editor";

export interface RoomClipboardRow {
  room_id: string;
  content: Record<string, unknown>;
  version: number;
  updated_at: string;
}

/** PostgREST PGRST205 = table missing from schema cache; also match message text. */
export function isRoomClipboardMissingError(
  error: { message?: string; code?: string } | null | undefined
): boolean {
  if (!error) return false;

  const msg = (error.message ?? "").toLowerCase();

  return (
    error.code === "PGRST205" ||
    (msg.includes("room_clipboard") &&
      (msg.includes("schema cache") ||
        msg.includes("does not exist") ||
        msg.includes("could not find")))
  );
}

export async function fetchRoomContent(
  roomId: string
): Promise<{
  row: RoomClipboardRow | null;
  migrationMissing: boolean;
  invalidRoomId?: boolean;
}> {
  if (!validateRoomId(roomId)) {
    return { row: null, migrationMissing: false, invalidRoomId: true };
  }

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("room_clipboard")
    .select("room_id, content, version, updated_at")
    .eq("room_id", roomId)
    .maybeSingle();

  if (error) {
    const migrationMissing = isRoomClipboardMissingError(error);
    console.error("Failed to fetch room content:", error.message);
    return { row: null, migrationMissing };
  }

  return { row: data, migrationMissing: false };
}

export async function persistRoomContent(
  roomId: string,
  content: Record<string, unknown>
): Promise<{
  version: number | null;
  error: Error | null;
  migrationMissing: boolean;
  contentTooLarge?: boolean;
  invalidRoomId?: boolean;
}> {
  if (!validateRoomId(roomId)) {
    return {
      version: null,
      error: new Error("Invalid room id"),
      migrationMissing: false,
      invalidRoomId: true,
    };
  }

  if (!isContentWithinLimit(content)) {
    return {
      version: null,
      error: new Error("Content exceeds maximum size"),
      migrationMissing: false,
      contentTooLarge: true,
    };
  }

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("room_clipboard")
    .upsert({ room_id: roomId, content }, { onConflict: "room_id" })
    .select("version")
    .single();

  if (error) {
    return {
      version: null,
      error: new Error(error.message),
      migrationMissing: isRoomClipboardMissingError(error),
    };
  }

  return { version: data?.version ?? null, error: null, migrationMissing: false };
}
