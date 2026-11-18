import assert from 'node:assert/strict';
import test from 'node:test';
import {
  hasSeenAdminMenuTour,
  markAdminMenuTourSeen,
  nextTourIndex,
  previousTourIndex,
  tourStepsForMenu,
  type TourStorage,
} from './adminMenuTour.ts';

const memoryStorage = (): TourStorage => {
  const values = new Map<string, string>();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, value);
    },
    removeItem: (key) => {
      values.delete(key);
    },
  };
};

test('the menu guide follows the admin’s own menu order', () => {
  const steps = tourStepsForMenu([
    { path: '/admin/sales', label: 'Sales' },
    { path: '/admin', label: 'Dashboard' },
  ]);

  assert.deepEqual(steps.map((step) => step.label), ['Sales', 'Dashboard']);
  assert.match(steps[0].text, /paid orders/i);
});

test('next and back stay inside the guide', () => {
  assert.equal(previousTourIndex(0), 0);
  assert.equal(nextTourIndex(0, 3), 1);
  assert.equal(nextTourIndex(2, 3), 2);
});

test('each admin sees the menu guide once', () => {
  const storage = memoryStorage();

  assert.equal(hasSeenAdminMenuTour('admin-a', storage), false);
  markAdminMenuTourSeen('admin-a', storage);

  assert.equal(hasSeenAdminMenuTour('admin-a', storage), true);
  assert.equal(hasSeenAdminMenuTour('admin-b', storage), false);
  assert.equal(hasSeenAdminMenuTour(undefined, storage), true);
});
