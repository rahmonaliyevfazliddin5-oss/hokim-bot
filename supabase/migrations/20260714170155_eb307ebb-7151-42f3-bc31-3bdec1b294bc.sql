
-- Admin users (multi-role admin panel)
CREATE TABLE IF NOT EXISTS public.admin_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  role text NOT NULL CHECK (role IN ('superadmin','editor','operator','auditor')),
  full_name text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by text
);

GRANT ALL ON public.admin_users TO service_role;
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service role only admin_users"
  ON public.admin_users FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE TRIGGER trg_admin_users_updated_at
  BEFORE UPDATE ON public.admin_users
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Escalation rules (single-row config)
CREATE TABLE IF NOT EXISTS public.escalation_rules (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  enabled boolean NOT NULL DEFAULT true,
  severity_bump_days integer NOT NULL DEFAULT 0,      -- overdue days to bump severity by one level
  reroute_to_hokimiyat_days integer NOT NULL DEFAULT 3, -- mahalla → hokimiyat when overdue by this many
  target_status text NOT NULL DEFAULT 'korib_chiqilmoqda',
  max_severity text NOT NULL DEFAULT 'yuqori',
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by text
);

INSERT INTO public.escalation_rules (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

GRANT ALL ON public.escalation_rules TO service_role;
ALTER TABLE public.escalation_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service role only escalation_rules"
  ON public.escalation_rules FOR ALL TO service_role USING (true) WITH CHECK (true);
