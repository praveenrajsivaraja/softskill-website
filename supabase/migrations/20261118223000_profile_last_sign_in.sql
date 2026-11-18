-- Copy each account's sign-in time onto the profile so the admin user list
-- can show it, and backfill the dates already stored on auth.users.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS last_sign_in_at timestamptz;

UPDATE public.profiles AS profile
SET last_sign_in_at = auth_user.last_sign_in_at
FROM auth.users AS auth_user
WHERE profile.id = auth_user.id
  AND auth_user.last_sign_in_at IS NOT NULL
  AND profile.last_sign_in_at IS DISTINCT FROM auth_user.last_sign_in_at;

CREATE OR REPLACE FUNCTION public.admin_user_sign_ins()
RETURNS TABLE (user_id uuid, last_sign_in_at timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT profile.id, COALESCE(auth_user.last_sign_in_at, profile.last_sign_in_at)
  FROM public.profiles AS profile
  LEFT JOIN auth.users AS auth_user ON auth_user.id = profile.id
  WHERE public.is_admin(auth.uid());
$$;

REVOKE ALL ON FUNCTION public.admin_user_sign_ins() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_user_sign_ins() TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
