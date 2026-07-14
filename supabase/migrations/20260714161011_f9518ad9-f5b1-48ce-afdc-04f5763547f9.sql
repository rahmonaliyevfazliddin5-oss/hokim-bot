
CREATE TABLE public.admin_alerts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  kind text NOT NULL,
  mahalla text,
  ip text,
  count integer NOT NULL DEFAULT 0,
  window_minutes integer NOT NULL DEFAULT 15,
  details text,
  seen_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.admin_alerts TO service_role;
ALTER TABLE public.admin_alerts ENABLE ROW LEVEL SECURITY;
CREATE INDEX admin_alerts_created_idx ON public.admin_alerts (created_at DESC);
CREATE INDEX admin_alerts_seen_idx ON public.admin_alerts (seen_at) WHERE seen_at IS NULL;
