
REVOKE ALL ON FUNCTION public.set_admin_user_password(text, text, text) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.verify_admin_user_password(text, text) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_admin_user_password(text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.verify_admin_user_password(text, text) TO service_role;
