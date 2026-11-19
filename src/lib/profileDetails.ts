export interface ProfileDetailsInput {
  fullName: string;
  email: string;
  phone: string;
}

export interface NormalizedProfileDetails {
  fullName: string;
  email: string;
  phone: string | null;
}

export interface SavedProfileDetails extends NormalizedProfileDetails {
  syncedSignIn: boolean;
}

export interface ProfileDetailsPatch {
  full_name: string;
  email: string;
  phone: string | null;
  updated_at: string;
}

type ProfileWriteError = {
  message: string;
};

export type ProfileDetailsClient = {
  rpc: (
    functionName: 'update_profile_details',
    args: {
      target_user_id: string;
      next_full_name: string;
      next_phone: string;
      next_email: string;
    },
  ) => PromiseLike<{ error: ProfileWriteError | null }>;
  from: (table: 'profiles') => {
    update: (values: ProfileDetailsPatch) => {
      eq: (column: 'id', userId: string) => PromiseLike<{ error: ProfileWriteError | null }>;
    };
  };
  auth: {
    updateUser: (attributes: {
      email: string;
      data: { full_name: string };
    }) => PromiseLike<{ error: ProfileWriteError | null }>;
    refreshSession: () => PromiseLike<{ error: ProfileWriteError | null }>;
  };
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PATTERN = /^[0-9+\-().\s]+$/;

const missingProfileFunction = (message: string) =>
  /update_profile_details/i.test(message)
  && /schema cache|could not find the function/i.test(message);

export const normalizeProfileDetails = (
  input: ProfileDetailsInput,
): { details: NormalizedProfileDetails } | { error: string } => {
  const fullName = input.fullName.trim();
  const email = input.email.trim().toLowerCase();
  const phone = input.phone.trim();

  if (!fullName) {
    return { error: 'Enter a name.' };
  }
  if (fullName.length > 120) {
    return { error: 'Name must be 120 characters or fewer.' };
  }
  if (!EMAIL_PATTERN.test(email)) {
    return { error: 'Enter a valid email address.' };
  }
  if (phone.length > 20 || (phone.length > 0 && !PHONE_PATTERN.test(phone))) {
    return { error: 'Enter a valid phone number.' };
  }

  return {
    details: {
      fullName,
      email,
      phone: phone.length > 0 ? phone : null,
    },
  };
};

export const profileUpdateErrorMessage = (error: unknown) => {
  const message = error instanceof Error
    ? error.message
    : typeof error === 'object' && error !== null && 'message' in error && typeof error.message === 'string'
      ? error.message
      : '';
  const normalized = message.toLowerCase();

  if (missingProfileFunction(message)) {
    return 'Profile editing is not available yet. Run the latest Supabase migration, then try again.';
  }
  if (normalized.includes('already used') || normalized.includes('duplicate') || normalized.includes('unique')) {
    return 'That email is already used by another account.';
  }
  if (normalized.includes('valid email') || normalized.includes('email address')) {
    return 'Enter a valid email address.';
  }
  if (normalized.includes('enter a name') || normalized.includes('120 characters')) {
    return normalized.includes('120')
      ? 'Name must be 120 characters or fewer.'
      : 'Enter a name.';
  }
  if (normalized.includes('phone')) {
    return 'Enter a valid phone number.';
  }
  if (normalized.includes('only edit your own')) {
    return 'You can only edit your own profile.';
  }
  if (normalized.includes('not found')) {
    return 'This profile was not found.';
  }
  if (normalized.includes('sign in')) {
    return 'Sign in to update a profile.';
  }
  if (message.length > 0) {
    return 'Could not save these details.';
  }
  return 'Could not save these details.';
};

export const saveProfileDetails = async (
  client: ProfileDetailsClient,
  userId: string,
  input: ProfileDetailsInput,
  isCurrentUser: boolean,
) => {
  const normalized = normalizeProfileDetails(input);
  if ('error' in normalized) {
    throw new Error(normalized.error);
  }

  const { fullName, email, phone } = normalized.details;
  const { error } = await client.rpc('update_profile_details', {
    target_user_id: userId,
    next_full_name: fullName,
    next_phone: phone ?? '',
    next_email: email,
  });

  if (!error) {
    if (isCurrentUser) {
      const refresh = await client.auth.refreshSession();
      if (refresh.error) {
        console.error(JSON.stringify({
          event: 'profile_session_refresh_failed',
        }));
      }
    }
    return { ...normalized.details, syncedSignIn: true };
  }

  if (!missingProfileFunction(error.message)) {
    console.error(JSON.stringify({ event: 'profile_details_save_failed' }));
    throw new Error(profileUpdateErrorMessage(error));
  }

  const { error: updateError } = await client
    .from('profiles')
    .update({
      full_name: fullName,
      email,
      phone,
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId);

  if (updateError) {
    console.error(JSON.stringify({ event: 'profile_details_save_failed' }));
    throw new Error(profileUpdateErrorMessage(updateError));
  }

  if (isCurrentUser) {
    const authResult = await client.auth.updateUser({
      email,
      data: { full_name: fullName },
    });
    if (authResult.error) {
      console.error(JSON.stringify({ event: 'profile_sign_in_email_update_failed' }));
      throw new Error('The profile was saved. The sign-in email could not be changed.');
    }
  }

  return { ...normalized.details, syncedSignIn: isCurrentUser };
};

export type AccountPasswordClient = {
  rpc: (
    functionName: 'update_account_password',
    args: {
      target_user_id: string;
      next_password: string;
    },
  ) => PromiseLike<{ error: ProfileWriteError | null }>;
  auth: {
    updateUser: (attributes: { password: string }) => PromiseLike<{ error: ProfileWriteError | null }>;
    refreshSession: () => PromiseLike<{ error: ProfileWriteError | null }>;
  };
};

const missingPasswordFunction = (message: string) =>
  /update_account_password/i.test(message)
  && /schema cache|could not find the function/i.test(message);

export const normalizePasswordChange = (
  password: string,
  confirmation: string,
): { password: string | null } | { error: string } => {
  if (password.length === 0 && confirmation.length === 0) {
    return { password: null };
  }
  if (password !== confirmation) {
    return { error: 'Passwords do not match.' };
  }
  if (password.length < 6) {
    return { error: 'Password must be at least 6 characters.' };
  }
  if (password.length > 72) {
    return { error: 'Password must be 72 characters or fewer.' };
  }
  return { password };
};

export const passwordChangeErrorMessage = (error: unknown) => {
  const message = error instanceof Error
    ? error.message
    : typeof error === 'object' && error !== null && 'message' in error && typeof error.message === 'string'
      ? error.message
      : '';
  const normalized = message.toLowerCase();

  if (missingPasswordFunction(message)) {
    return 'Changing another account password needs the latest database migration.';
  }
  if (normalized.includes('at least 6')) {
    return 'Password must be at least 6 characters.';
  }
  if (normalized.includes('72')) {
    return 'Password must be 72 characters or fewer.';
  }
  if (normalized.includes('only change your own')) {
    return 'You can only change your own password.';
  }
  if (normalized.includes('not found')) {
    return 'This account was not found.';
  }
  if (normalized.includes('sign in')) {
    return 'Sign in to update a password.';
  }
  return 'Could not change the password.';
};

export const saveAccountPassword = async (
  client: AccountPasswordClient,
  userId: string,
  password: string,
  isCurrentUser: boolean,
) => {
  const { error } = await client.rpc('update_account_password', {
    target_user_id: userId,
    next_password: password,
  });

  if (!error) {
    if (isCurrentUser) {
      const refresh = await client.auth.refreshSession();
      if (refresh.error) {
        console.error(JSON.stringify({ event: 'password_session_refresh_failed' }));
      }
    }
    return;
  }

  if (!missingPasswordFunction(error.message)) {
    console.error(JSON.stringify({ event: 'account_password_save_failed' }));
    throw new Error(passwordChangeErrorMessage(error));
  }

  if (!isCurrentUser) {
    throw new Error(passwordChangeErrorMessage(error));
  }

  const authResult = await client.auth.updateUser({ password });
  if (authResult.error) {
    console.error(JSON.stringify({ event: 'account_password_save_failed' }));
    throw new Error(passwordChangeErrorMessage(authResult.error));
  }
};
