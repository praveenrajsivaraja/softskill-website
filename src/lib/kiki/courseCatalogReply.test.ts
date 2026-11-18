import assert from 'node:assert/strict';
import test from 'node:test';
import { presentCourseCatalog, type CatalogCourse } from './courseCatalogReply.ts';

const sample: CatalogCourse = {
  id: '6e1f8b8d-055a-4d31-9296-fd1c8d52259e',
  title: 'Art & Craft Classes',
  category: 'Arts',
  price: 2999,
  duration: '6 weeks',
  ageRange: '6-10',
  mode: 'Online',
};

test('students receive course links without prices, stats, or a spreadsheet', () => {
  const reply = presentCourseCatalog([sample], '1 active course(s) are available.', false);

  assert.equal(reply.table, null);
  assert.equal(reply.stats, null);
  assert.equal(reply.includeSpreadsheet, false);
  assert.equal(reply.text.includes('2999'), false);
  assert.deepEqual(reply.links, [{ label: 'Art & Craft Classes', path: '/course/6e1f8b8d-055a-4d31-9296-fd1c8d52259e' }]);
});

test('admins receive the course table and a spreadsheet', () => {
  const reply = presentCourseCatalog([sample], '1 active course(s) are available.', true);

  assert.equal(reply.includeSpreadsheet, true);
  assert.deepEqual(reply.stats, [{ label: 'Courses', value: '1' }]);
  assert.deepEqual(reply.table?.rows, [['Art & Craft Classes', 'Arts', '2999', '6 weeks', '6-10', 'Online']]);
});
