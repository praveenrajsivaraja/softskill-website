-- A signed-in person can set a new password, and an admin can set one for
-- any account. The current password is never returned. Leave the field blank
-- in the app to keep the existing password.

CREATE OR REPLACE FUNCTION public.update_account_password(
  target_user_id uuid,
  next_password text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  caller_id uuid := auth.uid();
BEGIN
  IF caller_id IS NULL THEN
    RAISE EXCEPTION 'Sign in to update a password';
  END IF;

  IF caller_id IS DISTINCT FROM target_user_id AND NOT public.is_admin(caller_id) THEN
    RAISE EXCEPTION 'You can only change your own password';
  END IF;

  IF next_password IS NULL OR char_length(next_password) < 6 THEN
    RAISE EXCEPTION 'Password must be at least 6 characters';
  END IF;

  IF char_length(next_password) > 72 THEN
    RAISE EXCEPTION 'Password must be 72 characters or fewer';
  END IF;

  UPDATE auth.users
  SET
    encrypted_password = crypt(next_password, gen_salt('bf')),
    updated_at = now()
  WHERE id = target_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'This account was not found';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.update_account_password(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_account_password(uuid, text) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
