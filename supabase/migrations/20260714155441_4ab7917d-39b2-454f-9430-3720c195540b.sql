-- Ensure crypto extension for bcrypt (crypt / gen_salt)
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- ============================================================
-- 1) mahalla_credentials: bcrypt-hashed password per MFY
-- ============================================================
CREATE TABLE IF NOT EXISTS public.mahalla_credentials (
  mahalla       text PRIMARY KEY,
  password_hash text NOT NULL,
  updated_at    timestamptz NOT NULL DEFAULT now(),
  updated_by    text
);

GRANT ALL ON public.mahalla_credentials TO service_role;
ALTER TABLE public.mahalla_credentials ENABLE ROW LEVEL SECURITY;
-- No policies: only service_role via edge functions may touch it.

-- ============================================================
-- 2) mahalla_sessions: server-side refresh token store
-- ============================================================
CREATE TABLE IF NOT EXISTS public.mahalla_sessions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mahalla       text NOT NULL,
  refresh_hash  text NOT NULL,
  ip            text,
  user_agent    text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  expires_at    timestamptz NOT NULL,
  revoked_at    timestamptz
);
CREATE INDEX IF NOT EXISTS mahalla_sessions_mahalla_idx ON public.mahalla_sessions(mahalla);
CREATE INDEX IF NOT EXISTS mahalla_sessions_refresh_hash_idx ON public.mahalla_sessions(refresh_hash);

GRANT ALL ON public.mahalla_sessions TO service_role;
ALTER TABLE public.mahalla_sessions ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 3) mahalla_login_attempts: rate limiting / brute-force log
-- ============================================================
CREATE TABLE IF NOT EXISTS public.mahalla_login_attempts (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mahalla      text,
  ip           text,
  success      boolean NOT NULL,
  attempted_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS mahalla_login_attempts_key_idx
  ON public.mahalla_login_attempts(mahalla, ip, attempted_at DESC);

GRANT ALL ON public.mahalla_login_attempts TO service_role;
ALTER TABLE public.mahalla_login_attempts ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- Helper: slug function mirroring client behavior
-- Removes anything that isn't a Latin/Cyrillic letter, digit,
-- apostrophe or ʻ (matches JS: /[^a-z0-9а-яёқғҳўʻ']/gi)
-- ============================================================
CREATE OR REPLACE FUNCTION public.mahalla_slug(_name text)
RETURNS text
LANGUAGE sql IMMUTABLE
SET search_path = public
AS $$
  SELECT lower(regexp_replace(
    coalesce(_name, ''),
    '[^A-Za-z0-9А-Яа-яЁёҚқҒғҲҳЎўʻ'']',
    '', 'g'
  ))
$$;

-- ============================================================
-- set_mahalla_password: bcrypt-hash and upsert
-- ============================================================
CREATE OR REPLACE FUNCTION public.set_mahalla_password(
  _mahalla text,
  _password text,
  _actor text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  IF _password IS NULL OR length(_password) < 6 THEN
    RAISE EXCEPTION 'password_too_short';
  END IF;
  INSERT INTO public.mahalla_credentials(mahalla, password_hash, updated_at, updated_by)
  VALUES (_mahalla, extensions.crypt(_password, extensions.gen_salt('bf', 10)), now(), _actor)
  ON CONFLICT (mahalla) DO UPDATE
    SET password_hash = EXCLUDED.password_hash,
        updated_at = now(),
        updated_by = EXCLUDED.updated_by;
END $$;

-- ============================================================
-- verify_mahalla_password: constant-time-ish bcrypt verify
-- ============================================================
CREATE OR REPLACE FUNCTION public.verify_mahalla_password(
  _mahalla text,
  _password text
)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  h text;
BEGIN
  SELECT password_hash INTO h
  FROM public.mahalla_credentials
  WHERE mahalla = _mahalla;
  IF h IS NULL THEN RETURN false; END IF;
  RETURN extensions.crypt(_password, h) = h;
END $$;

-- Restrict function execution to service_role only
REVOKE ALL ON FUNCTION public.set_mahalla_password(text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.verify_mahalla_password(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mahalla_slug(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_mahalla_password(text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.verify_mahalla_password(text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.mahalla_slug(text) TO service_role;

-- ============================================================
-- Seed all 71 Farg'ona tumani MFYs with hashed default password
-- Default password = slug(name) + '123'
-- ============================================================
DO $seed$
DECLARE
  m text;
  mfys text[] := ARRAY[
    'Shohimardon','Yordon','Vodil','Xo''ja Ahmad Vale','Sanoat','Hosilot','Tinchlik',
    'Beruniy','Bo''ston','Marg''ilon','Dilkusho','Yambaroq','Novkent','Yuksalish',
    'Toshqo''rg''on Aziz','Shohimardonobod','Kaptarxona','Yoyilma','Mehnatobod',
    'Barqaror hamjixatlik','Mindonobod','Yangi asr','Damko''l','Bo''stonobod',
    'Guliston','Oqtom','Yuqori Vodil','Navro''z','Obod','Log''on','Vaziyo',
    'Xurshidi Tobon','Gulpiyon','Mash''al','Avval','Birdamlik','Mozortagi',
    'Qorasuv','O''rta qishloq','Oqtepa','Soy bo''yi','Qo''riq','Pastki Archa',
    'Yuqori Archa','Chimyon','Bahor','Ulug''bek','Langar','Qurilish','Zilol',
    'Shifokor','Do''stlik','Gulshan','Dehqonobod','Boy','Yuqori Gulshan','Mindon',
    'Markaz','Guzar','Xo''roba','Sharq haqiqati','Xonqiz','Oq oltin','O''zbekiston',
    'Farg''ona','Qo''rg''ontepa','Maydon','Yangi yo''l','Satkak','Oqbilol','Konchilar'
  ];
BEGIN
  FOREACH m IN ARRAY mfys LOOP
    -- Only seed if not already set (idempotent)
    IF NOT EXISTS (SELECT 1 FROM public.mahalla_credentials WHERE mahalla = m) THEN
      PERFORM public.set_mahalla_password(m, public.mahalla_slug(m) || '123', 'seed');
    END IF;
  END LOOP;
END $seed$;