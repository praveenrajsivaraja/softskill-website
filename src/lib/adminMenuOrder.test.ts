import assert from 'node:assert/strict';
import test from 'node:test';
import {
  applySavedMenuOrder,
  readAdminMenuOrder,
  reorderMenuItems,
  writeAdminMenuOrder,
  type MenuOrderStorage,
} from './adminMenuOrder.ts';

const menu = [
  { path: '/admin', label: 'Dashboard' },
  { path: '/admin/users', label: 'Users' },
  { path: '/admin/courses', label: 'Courses' },
];

const memoryStorage = (): MenuOrderStorage & { values: Map<string, string> } => {
  const values = new Map<string, string>();
  return {
    values,
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, value);
    },
  };
};

test('dropping a menu item moves it to the target position', () => {
  const reordered = reorderMenuItems(menu, '/admin', '/admin/courses');

  assert.deepEqual(reordered.map((item) => item.path), [
    '/admin/users',
    '/admin/courses',
    '/admin',
  ]);
});

test('dropping an item on itself keeps the current alignment', () => {
  assert.equal(reorderMenuItems(menu, '/admin/users', '/admin/users'), menu);
});

test('a saved order is restored and new items stay in their default place', () => {
  const saved = ['/admin/courses', '/admin', '/admin/removed'];
  const restored = applySavedMenuOrder(menu, saved);

  assert.deepEqual(restored.map((item) => item.label), ['Courses', 'Dashboard', 'Users']);
});

test('each admin keeps a separate menu alignment', () => {
  const storage = memoryStorage();

  writeAdminMenuOrder('admin-a', ['/admin/users', '/admin'], storage);
  writeAdminMenuOrder('admin-b', ['/admin/courses'], storage);

  assert.deepEqual(readAdminMenuOrder('admin-a', storage), ['/admin/users', '/admin']);
  assert.deepEqual(readAdminMenuOrder('admin-b', storage), ['/admin/courses']);
  assert.equal(readAdminMenuOrder(undefined, storage), null);
});

test('a damaged saved order falls back to the default menu', () => {
  const storage = memoryStorage();
  storage.values.set('admin_menu_order_admin-a', '{not-json');

  assert.equal(readAdminMenuOrder('admin-a', storage), null);
  assert.deepEqual(applySavedMenuOrder(menu, null), menu);
});
