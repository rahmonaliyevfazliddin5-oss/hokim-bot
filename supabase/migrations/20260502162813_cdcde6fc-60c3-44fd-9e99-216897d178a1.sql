
-- Add new columns to complaints
ALTER TABLE public.complaints
  ADD COLUMN IF NOT EXISTS categories text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS category_details jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS district text,
  ADD COLUMN IF NOT EXISTS mahalla text,
  ADD COLUMN IF NOT EXISTS latitude double precision,
  ADD COLUMN IF NOT EXISTS longitude double precision,
  ADD COLUMN IF NOT EXISTS map_link text,
  ADD COLUMN IF NOT EXISTS image_urls text[] NOT NULL DEFAULT '{}';

-- Storage bucket for images
INSERT INTO storage.buckets (id, name, public)
VALUES ('complaint-images', 'complaint-images', true)
ON CONFLICT (id) DO NOTHING;

-- Public read
DROP POLICY IF EXISTS "Public read complaint images" ON storage.objects;
CREATE POLICY "Public read complaint images" ON storage.objects
  FOR SELECT USING (bucket_id = 'complaint-images');

-- Anyone can upload (citizens are anonymous)
DROP POLICY IF EXISTS "Anyone can upload complaint images" ON storage.objects;
CREATE POLICY "Anyone can upload complaint images" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'complaint-images');
