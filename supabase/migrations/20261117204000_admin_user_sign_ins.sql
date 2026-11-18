-- Admins can see when each account last signed in. That timestamp lives on auth.users,
-- which the dashboard cannot read directly.

CREATE OR REPLACE FUNCTION public.admin_user_sign_ins()
RETURNS TABLE (user_id uuid, last_sign_in_at timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth_user.id, auth_user.last_sign_in_at
  FROM auth.users AS auth_user
  WHERE public.is_admin(auth.uid());
$$;

REVOKE ALL ON FUNCTION public.admin_user_sign_ins() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_user_sign_ins() FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_user_sign_ins() TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
