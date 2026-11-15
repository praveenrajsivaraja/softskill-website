import assert from 'node:assert/strict';
import test from 'node:test';
import { describeAttemptAnswers, groupStudentProgress, type StoredQuestion } from './studentProgress.ts';

const notebookQuestion: StoredQuestion = {
  id: 'question-1',
  assessmentId: 'assessment-1',
  prompt: 'What is the student holding?',
  sectionTitle: 'Choose',
  sortOrder: 0,
  kind: 'choice',
  marks: 1,
  acceptedAnswers: [],
  modelAnswer: null,
  minimumWords: null,
  requiredPhrases: [],
  guidance: null,
  options: [
    { id: 'option-notebook', label: 'A notebook', isCorrect: true },
    { id: 'option-bicycle', label: 'A bicycle', isCorrect: false },
  ],
};

test('student progress counts the latest published result for that student only', () => {
  const students = groupStudentProgress(
    [{
      studentId: 'student-1',
      studentName: 'Asha',
      email: 'asha@example.com',
      phone: null,
      courseId: 'course-1',
      courseTitle: 'TEST',
      enrollmentStatus: 'enrolled',
      progress: 40,
    }],
    [
      { id: 'assessment-1', courseId: 'course-1', title: 'Lesson 1', sequence: 1, isPublished: true, isActive: true },
      { id: 'assessment-2', courseId: 'course-1', title: 'Lesson 2', sequence: 2, isPublished: true, isActive: true },
      { id: 'assessment-3', courseId: 'course-1', title: 'Draft', sequence: 3, isPublished: false, isActive: true },
    ],
    [
      {
        id: 'attempt-old',
        userId: 'student-1',
        assessmentId: 'assessment-1',
        score: 0,
        totalMarks: 1,
        passed: false,
        submittedAt: '2026-11-01T00:00:00.000Z',
        answers: {},
      },
      {
        id: 'attempt-new',
        userId: 'student-1',
        assessmentId: 'assessment-1',
        score: 1,
        totalMarks: 1,
        passed: true,
        submittedAt: '2026-11-02T00:00:00.000Z',
        answers: { 'question-1': 'option-notebook' },
      },
      {
        id: 'other-student',
        userId: 'student-2',
        assessmentId: 'assessment-2',
        score: 1,
        totalMarks: 1,
        passed: true,
        submittedAt: '2026-11-03T00:00:00.000Z',
        answers: {},
      },
    ],
  );

  const lesson1 = students[0].programs[0].assessments.find((assessment) => assessment.title === 'Lesson 1');
  const lesson2 = students[0].programs[0].assessments.find((assessment) => assessment.title === 'Lesson 2');
  assert.equal(students.length, 1);
  assert.equal(students[0].programs[0].passedCount, 1);
  assert.equal(students[0].programs[0].assessmentCount, 2);
  assert.equal(lesson1?.latest?.id, 'attempt-new');
  assert.equal(lesson2?.latest, null);
});

test('an admin review shows the selected answer and the correct answer', () => {
  const details = describeAttemptAnswers(
    [notebookQuestion],
    { 'question-1': 'option-bicycle' },
  );

  assert.equal(details[0].responseLabel, 'A bicycle');
  assert.equal(details[0].expectedLabel, 'A notebook');
  assert.equal(details[0].awarded, false);
});
