REVOKE ALL ON FUNCTION public.set_mahalla_password(text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.verify_mahalla_password(text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mahalla_slug(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_mahalla_password(text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.verify_mahalla_password(text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.mahalla_slug(text) TO service_role;