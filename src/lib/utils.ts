import { nanoid } from "nanoid";

export function generateRoomId(): string {
  return nanoid(8);
}

export function cn(...classes: (string | undefined | false)[]): string {
  return classes.filter(Boolean).join(" ");
}
