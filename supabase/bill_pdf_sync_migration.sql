-- ============================================================
-- MIGRATION: Bill PDF Sync
-- Run this in Supabase SQL editor (one-time)
-- ============================================================

-- 1. Add bill_pdf_url column to bills table
ALTER TABLE bills
  ADD COLUMN IF NOT EXISTS bill_pdf_url TEXT;

-- 2. Create the 'bills' storage bucket (public read)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'bills',
  'bills',
  true,
  10485760,                    -- 10 MB max per file
  ARRAY['application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- 3. Public read policy — anyone with the URL can view the PDF
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename  = 'objects'
      AND policyname = 'Public read bills bucket'
  ) THEN
    CREATE POLICY "Public read bills bucket"
      ON storage.objects FOR SELECT
      TO public
      USING (bucket_id = 'bills');
  END IF;
END $$;

-- 4. Service role write policy — only n8n (service_role key) can upload
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename  = 'objects'
      AND policyname = 'Service role write bills bucket'
  ) THEN
    CREATE POLICY "Service role write bills bucket"
      ON storage.objects FOR ALL
      TO service_role
      USING (bucket_id = 'bills')
      WITH CHECK (bucket_id = 'bills');
  END IF;
END $$;

-- ============================================================
-- Verification query — run after migration to confirm:
-- ============================================================
-- SELECT column_name, data_type FROM information_schema.columns
--   WHERE table_name = 'bills' AND column_name = 'bill_pdf_url';
-- SELECT id, name, public FROM storage.buckets WHERE id = 'bills';
