import assert from 'node:assert/strict';
import test from 'node:test';
import { enrollmentExpiresAt, summarizeUserLearning } from './userLearningSummary.ts';

test('course access ends after the stated weeks or months', () => {
  assert.equal(
    enrollmentExpiresAt('2026-01-01T00:00:00.000Z', '4 weeks'),
    '2026-01-29T00:00:00.000Z',
  );
  assert.equal(
    enrollmentExpiresAt('2026-01-15T00:00:00.000Z', '3 months'),
    '2026-04-15T00:00:00.000Z',
  );
  assert.equal(enrollmentExpiresAt('2026-01-01T00:00:00.000Z', '2 sessions'), null);
  assert.equal(enrollmentExpiresAt('2026-01-01T00:00:00.000Z', '30 minutes'), null);
  assert.equal(enrollmentExpiresAt(null, '4 weeks'), null);
});

test('a user summary keeps current courses and the latest enrollment', () => {
  const summary = summarizeUserLearning([
    {
      id: 'spoken-english',
      courseTitle: 'Spoken English',
      duration: '4 weeks',
      status: 'completed',
      progress: 100,
      enrolledAt: '2026-01-01T00:00:00.000Z',
      completedAt: '2026-01-20T00:00:00.000Z',
    },
    {
      id: 'public-speaking',
      courseTitle: 'Public Speaking',
      duration: '3 weeks',
      status: 'enrolled',
      progress: 40,
      enrolledAt: '2026-02-01T00:00:00.000Z',
      completedAt: null,
    },
  ], new Date('2026-02-10T00:00:00.000Z'));

  assert.deepEqual(summary.currentTitles, ['Public Speaking']);
  assert.equal(summary.recentCourseTitle, 'Public Speaking');
  assert.equal(summary.recentEnrolledAt, '2026-02-01T00:00:00.000Z');
  assert.equal(summary.recentExpiresAt, '2026-02-22T00:00:00.000Z');
  assert.equal(summary.recentAccess, 'open');
  assert.equal(summary.recentProgress, 40);
  assert.equal(summary.enrollmentCount, 2);
});

test('access is expired once the enrollment window has passed', () => {
  const summary = summarizeUserLearning([
    {
      id: 'art-and-craft',
      courseTitle: 'Art & Craft',
      duration: '1 week',
      status: 'enrolled',
      progress: 10,
      enrolledAt: '2026-01-01T00:00:00.000Z',
      completedAt: null,
    },
  ], new Date('2026-02-01T00:00:00.000Z'));

  assert.equal(summary.recentAccess, 'expired');
});
