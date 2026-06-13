import { getSupabase } from "@/lib/supabase";

export interface RoomClipboardRow {
  room_id: string;
  content: Record<string, unknown>;
  version: number;
  updated_at: string;
}

export async function fetchRoomContent(
  roomId: string
): Promise<RoomClipboardRow | null> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("room_clipboard")
    .select("room_id, content, version, updated_at")
    .eq("room_id", roomId)
    .maybeSingle();

  if (error) {
    console.error("Failed to fetch room content:", error.message);
    return null;
  }

  return data;
}

export async function persistRoomContent(
  roomId: string,
  content: Record<string, unknown>
): Promise<{ version: number | null; error: Error | null }> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("room_clipboard")
    .upsert({ room_id: roomId, content }, { onConflict: "room_id" })
    .select("version")
    .single();

  if (error) {
    return { version: null, error: new Error(error.message) };
  }

  return { version: data?.version ?? null, error: null };
}
