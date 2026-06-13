import { nanoid } from "nanoid";

/** 12-char nanoid (~72 bits entropy with default alphabet) — room id acts as shared secret. */
export function generateRoomId(): string {
  return nanoid(12);
}

export function cn(...classes: (string | undefined | false)[]): string {
  return classes.filter(Boolean).join(" ");
}
