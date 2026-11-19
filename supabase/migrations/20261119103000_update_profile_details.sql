-- Let a person edit their own name, email, and phone, and let an admin edit
-- those same fields for any account. Role and active status stay on their
-- existing controls. The sign-in record is updated in the same transaction
-- so the profile and the login email stay together.

CREATE OR REPLACE FUNCTION public.update_profile_details(
  target_user_id uuid,
  next_full_name text,
  next_phone text,
  next_email text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_id uuid := auth.uid();
  cleaned_name text := NULLIF(btrim(COALESCE(next_full_name, '')), '');
  cleaned_phone text := NULLIF(btrim(COALESCE(next_phone, '')), '');
  cleaned_email text := lower(btrim(COALESCE(next_email, '')));
BEGIN
  IF caller_id IS NULL THEN
    RAISE EXCEPTION 'Sign in to update a profile';
  END IF;

  IF caller_id IS DISTINCT FROM target_user_id AND NOT public.is_admin(caller_id) THEN
    RAISE EXCEPTION 'You can only edit your own profile';
  END IF;

  IF cleaned_name IS NULL THEN
    RAISE EXCEPTION 'Enter a name';
  END IF;

  IF char_length(cleaned_name) > 120 THEN
    RAISE EXCEPTION 'Name must be 120 characters or fewer';
  END IF;

  IF cleaned_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' THEN
    RAISE EXCEPTION 'Enter a valid email address';
  END IF;

  IF cleaned_phone IS NOT NULL AND (
    char_length(cleaned_phone) > 20
    OR cleaned_phone !~ '^[0-9+\-().[:space:]]+$'
  ) THEN
    RAISE EXCEPTION 'Enter a valid phone number';
  END IF;

  UPDATE public.profiles
  SET
    full_name = cleaned_name,
    phone = cleaned_phone,
    email = cleaned_email,
    updated_at = now()
  WHERE id = target_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'This profile was not found';
  END IF;

  UPDATE auth.users
  SET
    email = cleaned_email,
    raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb)
      || jsonb_build_object('full_name', cleaned_name),
    updated_at = now()
  WHERE id = target_user_id;

  BEGIN
    UPDATE auth.identities
    SET
      identity_data = jsonb_set(
        COALESCE(identity_data, '{}'::jsonb),
        '{email}',
        to_jsonb(cleaned_email)
      ),
      updated_at = now()
    WHERE user_id = target_user_id
      AND provider = 'email';
  EXCEPTION
    WHEN undefined_column THEN
      UPDATE auth.identities
      SET
        identity_data = jsonb_set(
          COALESCE(identity_data, '{}'::jsonb),
          '{email}',
          to_jsonb(cleaned_email)
        )
      WHERE user_id = target_user_id
        AND provider = 'email';
    WHEN undefined_table THEN
      NULL;
  END;
EXCEPTION
  WHEN unique_violation THEN
    RAISE EXCEPTION 'That email is already used by another account';
END;
$$;

REVOKE ALL ON FUNCTION public.update_profile_details(uuid, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_profile_details(uuid, text, text, text) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
