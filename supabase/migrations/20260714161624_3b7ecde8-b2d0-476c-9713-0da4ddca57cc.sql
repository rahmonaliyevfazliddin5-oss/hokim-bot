
CREATE TABLE public.admin_alert_config (
  id integer PRIMARY KEY DEFAULT 1,
  approaching_threshold integer NOT NULL DEFAULT 3,
  block_threshold integer NOT NULL DEFAULT 5,
  window_minutes integer NOT NULL DEFAULT 15,
  email_enabled boolean NOT NULL DEFAULT false,
  email_provider text NOT NULL DEFAULT 'resend',
  email_from text,
  email_recipients text[] NOT NULL DEFAULT '{}'::text[],
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by text,
  CONSTRAINT admin_alert_config_singleton CHECK (id = 1)
);
GRANT ALL ON public.admin_alert_config TO service_role;
ALTER TABLE public.admin_alert_config ENABLE ROW LEVEL SECURITY;
INSERT INTO public.admin_alert_config (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

CREATE TABLE public.admin_alert_deliveries (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  alert_id uuid NOT NULL REFERENCES public.admin_alerts(id) ON DELETE CASCADE,
  channel text NOT NULL,
  recipient text,
  status text NOT NULL,
  error text,
  provider_message_id text,
  delivered_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.admin_alert_deliveries TO service_role;
ALTER TABLE public.admin_alert_deliveries ENABLE ROW LEVEL SECURITY;
CREATE INDEX admin_alert_deliveries_alert_idx ON public.admin_alert_deliveries (alert_id);
CREATE INDEX admin_alert_deliveries_created_idx ON public.admin_alert_deliveries (created_at DESC);
