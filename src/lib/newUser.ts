export const NEW_USER_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

export const NEW_USER_COUPON_MESSAGE = 'This coupon is only for accounts created in the last 7 days.';

export const isNewSiteUser = (createdAt: string | null | undefined, now = Date.now()): boolean => {
  if (!createdAt) {
    return false;
  }
  const joinedAt = Date.parse(createdAt);
  if (Number.isNaN(joinedAt)) {
    return false;
  }
  const age = now - joinedAt;
  return age >= 0 && age < NEW_USER_WINDOW_MS;
};

export const canUseNewUserCoupon = (
  newUsersOnly: boolean | null | undefined,
  createdAt: string | null | undefined,
  now = Date.now(),
): boolean => {
  if (!newUsersOnly) {
    return true;
  }
  return isNewSiteUser(createdAt, now);
};
