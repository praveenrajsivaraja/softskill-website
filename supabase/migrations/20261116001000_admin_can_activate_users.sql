-- Admins can activate or deactivate an account.
-- A user cannot change their own active flag or deactivate the account they are signed in with.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

CREATE OR REPLACE FUNCTION public.prevent_non_admin_role_change()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role
     AND auth.uid() IS NOT NULL
     AND NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Only an admin can change a user role';
  END IF;

  IF NEW.is_active IS DISTINCT FROM OLD.is_active
     AND auth.uid() IS NOT NULL
     AND NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Only an admin can activate or deactivate an account';
  END IF;

  IF NEW.is_active = false AND NEW.id = auth.uid() THEN
    RAISE EXCEPTION 'You cannot deactivate your own account';
  END IF;

  RETURN NEW;
END;
$$;
