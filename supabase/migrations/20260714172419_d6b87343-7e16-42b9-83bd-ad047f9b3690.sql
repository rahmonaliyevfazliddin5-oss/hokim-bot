DROP POLICY IF EXISTS "Upload complaint images only" ON storage.objects;

CREATE POLICY "Upload complaint images only"
ON storage.objects
FOR INSERT
TO anon, authenticated
WITH CHECK (
  bucket_id = 'complaint-images'
  AND lower(coalesce(metadata->>'mimetype','')) IN ('image/jpeg','image/png','image/webp','image/heic','image/heif','image/gif')
  AND coalesce((metadata->>'size')::bigint, 0) <= 5242880
);