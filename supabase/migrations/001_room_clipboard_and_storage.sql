-- Run this in the Supabase SQL Editor (Dashboard → SQL → New query)
-- Safe to re-run: uses IF NOT EXISTS / DROP ... IF EXISTS throughout.

-- 1. Room clipboard persistence (fixes late-join blank canvas + reconnect hydration)
CREATE TABLE IF NOT EXISTS public.room_clipboard (
  room_id text PRIMARY KEY,
  content jsonb NOT NULL DEFAULT '{}'::jsonb,
  version bigint NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.room_clipboard ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read room content" ON public.room_clipboard;
CREATE POLICY "Authenticated users can read room content"
  ON public.room_clipboard
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Authenticated users can insert room content" ON public.room_clipboard;
CREATE POLICY "Authenticated users can insert room content"
  ON public.room_clipboard
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can update room content" ON public.room_clipboard;
CREATE POLICY "Authenticated users can update room content"
  ON public.room_clipboard
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Monotonic version + updated_at (clock-independent reconciliation)
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

DROP TRIGGER IF EXISTS room_clipboard_updated_at ON public.room_clipboard;
DROP TRIGGER IF EXISTS room_clipboard_before_insert ON public.room_clipboard;
DROP TRIGGER IF EXISTS room_clipboard_before_update ON public.room_clipboard;
DROP TRIGGER IF EXISTS room_clipboard_set_version ON public.room_clipboard;

CREATE TRIGGER room_clipboard_set_version
  BEFORE INSERT OR UPDATE ON public.room_clipboard
  FOR EACH ROW
  EXECUTE FUNCTION public.room_clipboard_set_version();

-- 2. Storage bucket for pasted images
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'clipboard-images',
  'clipboard-images',
  true,
  5242880,
  ARRAY['image/png', 'image/jpeg', 'image/gif', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Authenticated users can upload clipboard images" ON storage.objects;
CREATE POLICY "Authenticated users can upload clipboard images"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'clipboard-images');

DROP POLICY IF EXISTS "Public read access for clipboard images" ON storage.objects;
CREATE POLICY "Public read access for clipboard images"
  ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'clipboard-images');

DROP POLICY IF EXISTS "Authenticated users can update clipboard images" ON storage.objects;
CREATE POLICY "Authenticated users can update clipboard images"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (bucket_id = 'clipboard-images');

DROP POLICY IF EXISTS "Authenticated users can delete clipboard images" ON storage.objects;
CREATE POLICY "Authenticated users can delete clipboard images"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (bucket_id = 'clipboard-images');
