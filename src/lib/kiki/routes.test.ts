import assert from 'node:assert/strict';
import test from 'node:test';
import { followUpQuestions, isCourseCountQuestion, matchQuestion, notUnderstoodText, searchKeywords } from './routes.ts';

const intentOf = (question: string) => {
  const matched = matchQuestion(question);
  return matched && 'intent' in matched ? matched.intent : null;
};

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

test('questions match by keyword instead of one fixed phrase', () => {
  assert.equal(intentOf('total enrolment'), 'count_enrollments');
  assert.equal(intentOf('total enrollment'), 'count_enrollments');
  assert.equal(intentOf('enrolment count'), 'count_enrollments');
  assert.equal(intentOf('How many courses are available?'), 'count_courses');
  assert.equal(intentOf('How do I add an assessment?'), 'add_assessment');
  assert.equal(intentOf('How do I add a course?'), 'add_course');
  assert.equal(intentOf('Give me an overview of the platform.'), 'overview');
  assert.equal(intentOf('Which course has the highest enrollment?'), 'highest_enrollment');
  assert.equal(intentOf('what is the average score'), 'average_score');
  assert.equal(intentOf('which courses am I enrolled in'), 'my_enrollments');
  assert.equal(intentOf('my courses'), 'my_enrollments');
  assert.equal(intentOf('how do I enroll in a course'), 'enroll');
  assert.equal(intentOf('how many registered users'), 'count_users');
  assert.equal(intentOf('which users are inactive'), 'inactive_users');
  assert.equal(intentOf('Show me the courses I can join.'), 'list_courses');
  assert.equal(intentOf('How do I check my assessment scores?'), 'my_scores');
  assert.equal(intentOf('Where do I find my assessments?'), 'find_assessment');
  assert.equal(intentOf('How do I upload course materials?'), 'upload_material');
  assert.equal(intentOf('Where do I see student scores?'), 'student_progress');
  assert.equal(intentOf('total sales'), 'sales');
  assert.equal(intentOf('what is the total revenue'), 'sales');
  assert.equal(intentOf('my learning'), 'my_progress');
  assert.equal(intentOf('Download the sales report as Excel'), 'export_report');
  assert.equal(intentOf('download the users report'), 'export_report');
  assert.equal(intentOf('export student progress'), 'export_report');
  assert.equal(intentOf('download my scores'), 'my_scores');
});

test('words outside the catalog become course search keywords', () => {
  assert.equal(intentOf('spoken english'), null);
  assert.deepEqual(searchKeywords('spoken english'), ['spoken', 'english']);
  assert.deepEqual(searchKeywords('show me spoken courses'), ['spoken']);
});

test('total enrolment suggests enrollment questions', () => {
  const suggestions = followUpQuestions('total enrolment', true);

  assert.ok(suggestions.some((item) => /enroll/i.test(item)));
});

test('two equally likely topics ask which one was meant', () => {
  const matched = matchQuestion('how many courses and users');

  assert.ok(matched && 'clarify' in matched);
});
