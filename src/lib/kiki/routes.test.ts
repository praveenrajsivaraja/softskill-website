import assert from 'node:assert/strict';
import test from 'node:test';
import { followUpQuestions, isCourseCountQuestion, notUnderstoodText } from './routes.ts';

test('total courses is treated as a course count question', () => {
  assert.equal(isCourseCountQuestion('total courses'), true);
  assert.equal(isCourseCountQuestion('What is the total number of courses?'), true);
  assert.equal(isCourseCountQuestion('how to add assessment'), false);
});

test('an unrecognized question suggests questions that share its words', () => {
  const suggestions = followUpQuestions('how do I delete a course', true);

  assert.ok(suggestions.some((item) => /course/i.test(item)));
  assert.equal(suggestions.includes(notUnderstoodText), false);
  assert.ok(suggestions.length > 0);
});

test('total courses suggests other course questions', () => {
  const suggestions = followUpQuestions('total courses', true);

  assert.ok(suggestions.some((item) => /course/i.test(item)));
  assert.equal(suggestions.some((item) => /total courses/i.test(item)), false);
});
