
CREATE OR REPLACE FUNCTION public.set_admin_user_password(_username text, _password text, _actor text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  IF _password IS NULL OR length(_password) < 6 THEN
    RAISE EXCEPTION 'password_too_short';
  END IF;
  UPDATE public.admin_users
     SET password_hash = extensions.crypt(_password, extensions.gen_salt('bf', 10)),
         updated_at = now()
   WHERE username = _username;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'admin_user_not_found';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.verify_admin_user_password(_username text, _password text)
RETURNS TABLE(ok boolean, role text, full_name text, active boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE r record;
BEGIN
  SELECT password_hash, admin_users.role, admin_users.full_name, admin_users.active
    INTO r FROM public.admin_users WHERE username = _username;
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, NULL::text, NULL::text, false; RETURN;
  END IF;
  RETURN QUERY SELECT (extensions.crypt(_password, r.password_hash) = r.password_hash),
                      r.role, r.full_name, r.active;
END $$;
