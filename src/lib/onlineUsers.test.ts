import assert from 'node:assert/strict';
import test from 'node:test';
import { collectOnlineUserIds, sameUserIds } from './onlineUsers.ts';

test('online ids keep one entry per person who has the site open', () => {
  const ids = collectOnlineUserIds({
    tabA: [{ userId: 'user-1' }],
    tabB: [{ userId: 'user-1' }, { userId: 'user-2' }],
    empty: [{ userId: '' }, {}],
  });

  assert.deepEqual([...ids].sort(), ['user-1', 'user-2']);
  assert.equal(sameUserIds(ids, new Set(['user-2', 'user-1'])), true);
  assert.equal(sameUserIds(ids, new Set(['user-1'])), false);
});
