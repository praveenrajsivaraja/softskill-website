import assert from 'node:assert/strict';
import test from 'node:test';
import { nextUnansweredQuestionIndex, unansweredQuestionCount } from './assessmentNavigation.ts';

test('the next skipped question wraps around the list', () => {
  const answers = { a: 'yes', b: '', c: 'no', d: '' };
  assert.equal(nextUnansweredQuestionIndex(answers, ['a', 'b', 'c', 'd'], 0), 1);
  assert.equal(nextUnansweredQuestionIndex(answers, ['a', 'b', 'c', 'd'], 1), 3);
  assert.equal(nextUnansweredQuestionIndex(answers, ['a', 'b', 'c', 'd'], 3), 1);
  assert.equal(nextUnansweredQuestionIndex({ a: 'yes', b: 'yes' }, ['a', 'b'], 1), -1);
});

test('blank answers count as skipped', () => {
  assert.equal(unansweredQuestionCount({ a: 'yes', b: '  ', c: '' }, ['a', 'b', 'c']), 2);
});
