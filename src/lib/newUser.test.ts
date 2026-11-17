import assert from 'node:assert/strict';
import test from 'node:test';
import { canUseNewUserCoupon, isNewSiteUser, NEW_USER_WINDOW_MS } from './newUser.ts';

const joinedAt = '2026-11-01T00:00:00.000Z';
const joinedTime = Date.parse(joinedAt);

test('a user stays new for 7 days and the tag ends after that', () => {
  assert.equal(isNewSiteUser(joinedAt, joinedTime + NEW_USER_WINDOW_MS - 1), true);
  assert.equal(isNewSiteUser(joinedAt, joinedTime + NEW_USER_WINDOW_MS), false);
  assert.equal(isNewSiteUser(null, joinedTime), false);
});

test('a new-user coupon is refused for older accounts', () => {
  assert.equal(canUseNewUserCoupon(false, joinedAt, joinedTime + NEW_USER_WINDOW_MS + 1), true);
  assert.equal(canUseNewUserCoupon(true, joinedAt, joinedTime + 1000), true);
  assert.equal(canUseNewUserCoupon(true, joinedAt, joinedTime + NEW_USER_WINDOW_MS), false);
});
