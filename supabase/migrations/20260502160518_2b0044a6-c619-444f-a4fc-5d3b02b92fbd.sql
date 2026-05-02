
CREATE TABLE public.complaints (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  citizen_name TEXT NOT NULL,
  citizen_phone TEXT NOT NULL,
  text TEXT NOT NULL,
  image_url TEXT,
  location TEXT,
  region TEXT,
  category TEXT NOT NULL DEFAULT 'boshqa',
  status TEXT NOT NULL DEFAULT 'yangi',
  ai_confidence NUMERIC DEFAULT 0,
  ai_response TEXT,
  admin_notes TEXT,
  tracking_code TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.activity_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  action TEXT NOT NULL,
  details TEXT,
  actor TEXT,
  complaint_id UUID REFERENCES public.complaints(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.complaints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

-- MVP: public access (no auth)
CREATE POLICY "Anyone can view complaints" ON public.complaints FOR SELECT USING (true);
CREATE POLICY "Anyone can insert complaints" ON public.complaints FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update complaints" ON public.complaints FOR UPDATE USING (true);

CREATE POLICY "Anyone can view logs" ON public.activity_logs FOR SELECT USING (true);
CREATE POLICY "Anyone can insert logs" ON public.activity_logs FOR INSERT WITH CHECK (true);

CREATE INDEX idx_complaints_status ON public.complaints(status);
CREATE INDEX idx_complaints_created ON public.complaints(created_at DESC);
CREATE INDEX idx_complaints_tracking ON public.complaints(tracking_code);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER complaints_updated_at BEFORE UPDATE ON public.complaints
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
