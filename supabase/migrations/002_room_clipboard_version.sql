-- Safe to re-run. Adds monotonic version column for clock-independent reconciliation.
-- Run after 001_room_clipboard_and_storage.sql if that migration was already applied.

ALTER TABLE public.room_clipboard
  ADD COLUMN IF NOT EXISTS version bigint NOT NULL DEFAULT 0;

-- Column: bigint NOT NULL DEFAULT 0 (never NULL; 0 = pre-migration placeholder)
COMMENT ON COLUMN public.room_clipboard.version IS
  'Monotonic room content version. Set to 1 on INSERT, incremented on UPDATE.';

-- Unified trigger: fires on BOTH INSERT and UPDATE
CREATE OR REPLACE FUNCTION public.room_clipboard_set_version()
RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.version := 1;
  ELSE
    NEW.version := OLD.version + 1;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Remove legacy triggers (from 001 or earlier 002)
DROP TRIGGER IF EXISTS room_clipboard_updated_at ON public.room_clipboard;
DROP TRIGGER IF EXISTS room_clipboard_before_insert ON public.room_clipboard;
DROP TRIGGER IF EXISTS room_clipboard_before_update ON public.room_clipboard;
DROP TRIGGER IF EXISTS room_clipboard_set_version ON public.room_clipboard;

CREATE TRIGGER room_clipboard_set_version
  BEFORE INSERT OR UPDATE ON public.room_clipboard
  FOR EACH ROW
  EXECUTE FUNCTION public.room_clipboard_set_version();

-- Backfill rows created by 001 before version column existed (0 → 1)
UPDATE public.room_clipboard SET version = 1 WHERE version = 0;

-- Drop orphaned single-op functions if present (optional cleanup)
DROP FUNCTION IF EXISTS public.room_clipboard_before_insert();
DROP FUNCTION IF EXISTS public.room_clipboard_before_update();
DROP FUNCTION IF EXISTS public.set_room_clipboard_updated_at();
