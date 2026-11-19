import assert from 'node:assert/strict';
import test from 'node:test';
import {
  normalizePasswordChange,
  normalizeProfileDetails,
  passwordChangeErrorMessage,
  profileUpdateErrorMessage,
  saveAccountPassword,
  saveProfileDetails,
  type AccountPasswordClient,
  type ProfileDetailsClient,
} from './profileDetails.ts';

const userId = '11111111-1111-4111-8111-111111111101';

const unusedAuth = {
  updateUser: async () => {
    throw new Error('sign-in update should not run');
  },
  refreshSession: async () => {
    throw new Error('session refresh should not run');
  },
};

test('profile details trim the name, lowercase the email, and clear a blank phone', () => {
  const result = normalizeProfileDetails({
    fullName: '  Ada Lovelace  ',
    email: ' Ada@Example.com ',
    phone: '   ',
  });

  assert.deepEqual(result, {
    details: {
      fullName: 'Ada Lovelace',
      email: 'ada@example.com',
      phone: null,
    },
  });
});

const validationError = (input: { fullName: string; email: string; phone: string }) => {
  const result = normalizeProfileDetails(input);
  return 'error' in result ? result.error : '';
};

test('profile details reject a missing name, a bad email, and a phone with letters', () => {
  assert.equal(validationError({ fullName: ' ', email: 'ada@example.com', phone: '' }), 'Enter a name.');
  assert.equal(validationError({ fullName: 'Ada', email: 'not-an-email', phone: '' }), 'Enter a valid email address.');
  assert.equal(validationError({ fullName: 'Ada', email: 'ada@example.com', phone: '98ab' }), 'Enter a valid phone number.');
});

test('saving profile details goes through the database function', async () => {
  let refreshed = false;
  let args: unknown = null;
  const client: ProfileDetailsClient = {
    rpc: async (_functionName, received) => {
      args = received;
      return { error: null };
    },
    from: () => {
      throw new Error('direct profile update should not run');
    },
    auth: {
      ...unusedAuth,
      refreshSession: async () => {
        refreshed = true;
        return { error: null };
      },
    },
  };

  const saved = await saveProfileDetails(client, userId, {
    fullName: ' Ada ',
    email: 'ADA@example.com',
    phone: '98765 43210',
  }, true);

  assert.deepEqual(args, {
    target_user_id: userId,
    next_full_name: 'Ada',
    next_phone: '98765 43210',
    next_email: 'ada@example.com',
  });
  assert.equal(saved.email, 'ada@example.com');
  assert.equal(saved.syncedSignIn, true);
  assert.equal(refreshed, true);
});

test('an admin edit does not refresh the signed-in session', async () => {
  const client: ProfileDetailsClient = {
    rpc: async () => ({ error: null }),
    from: () => {
      throw new Error('direct profile update should not run');
    },
    auth: unusedAuth,
  };

  await saveProfileDetails(client, userId, {
    fullName: 'Grace Hopper',
    email: 'grace@example.com',
    phone: '',
  }, false);
});

test('a missing profile function updates the profile row directly', async () => {
  let patchedId = '';
  let authEmail = '';
  const client: ProfileDetailsClient = {
    rpc: async () => ({
      error: { message: 'Could not find the function public.update_profile_details(target_user_id) in the schema cache' },
    }),
    from: () => ({
      update: (values) => ({
        eq: async (_column, id) => {
          patchedId = id;
          assert.equal(values.full_name, 'Ada');
          assert.equal(values.email, 'ada@example.com');
          assert.equal(values.phone, null);
          return { error: null };
        },
      }),
    }),
    auth: {
      refreshSession: unusedAuth.refreshSession,
      updateUser: async (attributes) => {
        authEmail = attributes.email;
        return { error: null };
      },
    },
  };

  await saveProfileDetails(client, userId, {
    fullName: 'Ada',
    email: 'ada@example.com',
    phone: '',
  }, true);

  assert.equal(patchedId, userId);
  assert.equal(authEmail, 'ada@example.com');
});

test('editing someone else does not change the signed-in account when the function is missing', async () => {
  const client: ProfileDetailsClient = {
    rpc: async () => ({
      error: { message: 'Could not find the function public.update_profile_details in the schema cache' },
    }),
    from: () => ({
      update: () => ({
        eq: async () => ({ error: null }),
      }),
    }),
    auth: unusedAuth,
  };

  const saved = await saveProfileDetails(client, userId, {
    fullName: 'Grace',
    email: 'grace@example.com',
    phone: '+91 99999 00000',
  }, false);
  assert.equal(saved.syncedSignIn, false);
});

test('a duplicate email stays on the database function and is explained', async () => {
  const client: ProfileDetailsClient = {
    rpc: async () => ({
      error: { message: 'That email is already used by another account' },
    }),
    from: () => {
      throw new Error('direct profile update should not run');
    },
    auth: unusedAuth,
  };

  await assert.rejects(
    () => saveProfileDetails(client, userId, {
      fullName: 'Ada',
      email: 'ada@example.com',
      phone: '',
    }, false),
    /already used/,
  );
  assert.match(
    profileUpdateErrorMessage({ message: 'duplicate key value violates unique constraint "profiles_email_key"' }),
    /already used/,
  );
});

test('only the signed-in user or an admin may save, and a blank form never calls the database', async () => {
  const client: ProfileDetailsClient = {
    rpc: async () => ({ error: { message: 'You can only edit your own profile' } }),
    from: () => {
      throw new Error('direct profile update should not run');
    },
    auth: unusedAuth,
  };

  await assert.rejects(
    () => saveProfileDetails(client, userId, {
      fullName: 'Ada',
      email: 'ada@example.com',
      phone: '',
    }, false),
    /only edit your own profile/,
  );
  await assert.rejects(
    () => saveProfileDetails(client, userId, {
      fullName: ' ',
      email: 'ada@example.com',
      phone: '',
    }, true),
    /Enter a name/,
  );
});

const passwordError = (password: string, confirmation: string) => {
  const result = normalizePasswordChange(password, confirmation);
  return 'error' in result ? result.error : '';
};

test('a blank password keeps the current one, and a mismatch or short password is refused', () => {
  assert.deepEqual(normalizePasswordChange('', ''), { password: null });
  assert.equal(passwordError('secret1', 'secret2'), 'Passwords do not match.');
  assert.equal(passwordError('short', 'short'), 'Password must be at least 6 characters.');
  assert.deepEqual(normalizePasswordChange('secret1', 'secret1'), { password: 'secret1' });
});

test('a password change goes through the database function', async () => {
  let refreshed = false;
  let receivedPassword = '';
  const client: AccountPasswordClient = {
    rpc: async (_functionName, args) => {
      receivedPassword = args.next_password;
      return { error: null };
    },
    auth: {
      updateUser: async () => {
        throw new Error('direct password update should not run');
      },
      refreshSession: async () => {
        refreshed = true;
        return { error: null };
      },
    },
  };

  await saveAccountPassword(client, userId, 'secret1', true);
  assert.equal(receivedPassword, 'secret1');
  assert.equal(refreshed, true);
});

test('the signed-in user can change a password when the database function is missing', async () => {
  let receivedPassword = '';
  const client: AccountPasswordClient = {
    rpc: async () => ({
      error: { message: 'Could not find the function public.update_account_password(target_user_id) in the schema cache' },
    }),
    auth: {
      refreshSession: async () => {
        throw new Error('session refresh should not run');
      },
      updateUser: async (attributes) => {
        receivedPassword = attributes.password;
        return { error: null };
      },
    },
  };

  await saveAccountPassword(client, userId, 'secret1', true);
  assert.equal(receivedPassword, 'secret1');
});

test('an admin cannot change another password until the database function exists', async () => {
  const client: AccountPasswordClient = {
    rpc: async () => ({
      error: { message: 'Could not find the function public.update_account_password in the schema cache' },
    }),
    auth: {
      refreshSession: async () => {
        throw new Error('session refresh should not run');
      },
      updateUser: async () => {
        throw new Error('another account password should not use the signed-in session');
      },
    },
  };

  await assert.rejects(
    () => saveAccountPassword(client, userId, 'secret1', false),
    /latest database migration/,
  );
  assert.match(
    passwordChangeErrorMessage({ message: 'You can only change your own password' }),
    /only change your own password/,
  );
});
