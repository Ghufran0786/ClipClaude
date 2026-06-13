/** Max serialized TipTap JSON size persisted/broadcast per room (512 KB). */
export const MAX_CLIPBOARD_CONTENT_BYTES = 512 * 1024;

/** nanoid default alphabet: A-Za-z0-9_- */
export const ROOM_ID_PATTERN = /^[A-Za-z0-9_-]{8,21}$/;

export function validateRoomId(roomId: string): boolean {
  return ROOM_ID_PATTERN.test(roomId);
}

export function getContentByteSize(content: Record<string, unknown>): number {
  return new TextEncoder().encode(JSON.stringify(content)).length;
}

export function isContentWithinLimit(content: Record<string, unknown>): boolean {
  return getContentByteSize(content) <= MAX_CLIPBOARD_CONTENT_BYTES;
}
