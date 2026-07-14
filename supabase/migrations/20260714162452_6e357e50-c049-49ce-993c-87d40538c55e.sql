
ALTER TABLE public.complaints
  ADD COLUMN IF NOT EXISTS severity text NOT NULL DEFAULT 'oddiy',
  ADD COLUMN IF NOT EXISTS routing_target text NOT NULL DEFAULT 'mahalla',
  ADD COLUMN IF NOT EXISTS responsible_org text,
  ADD COLUMN IF NOT EXISTS eta_days integer,
  ADD COLUMN IF NOT EXISTS ai_analysis jsonb;

CREATE INDEX IF NOT EXISTS complaints_severity_idx ON public.complaints(severity);
CREATE INDEX IF NOT EXISTS complaints_routing_idx ON public.complaints(routing_target);
CREATE INDEX IF NOT EXISTS complaints_created_at_idx ON public.complaints(created_at DESC);
