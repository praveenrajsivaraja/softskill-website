import assert from 'node:assert/strict';
import test from 'node:test';
import { canUsePurchasedCourseActions } from './courseAccess.ts';

test('download and assessment start stay closed until the course is bought or enrolled', () => {
  assert.equal(canUsePurchasedCourseActions({ isEnrolled: false, hasPaidOrder: false }), false);
  assert.equal(canUsePurchasedCourseActions({ isEnrolled: true, hasPaidOrder: false }), true);
  assert.equal(canUsePurchasedCourseActions({ isEnrolled: false, hasPaidOrder: true }), true);
});
