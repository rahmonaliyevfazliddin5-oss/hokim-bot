
DROP POLICY IF EXISTS "Anyone can view complaints" ON public.complaints;
DROP POLICY IF EXISTS "Anyone can update complaints" ON public.complaints;
DROP POLICY IF EXISTS "Anyone can insert complaints" ON public.complaints;

DROP POLICY IF EXISTS "Anyone can view logs" ON public.activity_logs;
DROP POLICY IF EXISTS "Anyone can insert logs" ON public.activity_logs;

ALTER TABLE public.complaints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read complaint images" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can upload complaint images" ON storage.objects;
CREATE POLICY "Upload complaint images only"
  ON storage.objects FOR INSERT TO anon, authenticated
  WITH CHECK (bucket_id = 'complaint-images');
