import assert from 'node:assert/strict';
import test from 'node:test';
import { groupAssessmentRows, courseFieldsFromRow } from './sheetRows.ts';
import { buildCsv, missingSheetColumns, parseCsv, rowsToRecords } from './spreadsheet.ts';
import { assessmentSheetHeaders, assessmentSheetSample } from './sheetTemplates.ts';

test('csv cells keep commas, quotes, and line breaks', () => {
  const rows = parseCsv('email,note\n"ada@example.com","Hello, ""Ada""\nNext"\n');
  const records = rowsToRecords(rows);
  assert.equal(records.length, 1);
  assert.equal(records[0].email, 'ada@example.com');
  assert.equal(records[0].note, 'Hello, "Ada"\nNext');
});

test('headers with spaces become column names', () => {
  const records = rowsToRecords(parseCsv('Full Name,Email\nAda,ada@example.com'));
  assert.deepEqual(missingSheetColumns(records, ['full_name', 'email']), []);
  assert.equal(records[0].full_name, 'Ada');
});

test('course rows split lists and keep the price', () => {
  const fields = courseFieldsFromRow({
    title: 'Spoken English',
    price: '499',
    highlights: 'Live practice | Weekly feedback',
    status: '',
  }, 2);
  assert.ok(!('error' in fields));
  if (!('error' in fields)) {
    assert.equal(fields.price, 499);
    assert.deepEqual(fields.highlights, ['Live practice', 'Weekly feedback']);
    assert.equal(fields.status, 'active');
  }
});

test('assessment rows with the same title become one assessment', () => {
  const records = rowsToRecords(parseCsv(buildCsv(assessmentSheetHeaders, assessmentSheetSample)));
  const grouped = groupAssessmentRows(records);
  assert.deepEqual(grouped.errors, []);
  assert.equal(grouped.groups.length, 1);
  assert.equal(grouped.groups[0].questions.length, 2);
  assert.equal(grouped.groups[0].questions[0].kind, 'choice');
  assert.equal(grouped.groups[0].questions[1].kind, 'blank');
  assert.equal(grouped.groups[0].isPublished, false);
});
