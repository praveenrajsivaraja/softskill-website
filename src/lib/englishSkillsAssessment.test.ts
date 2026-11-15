import assert from 'node:assert/strict';
import test from 'node:test';
import { isQuestionCorrect, scoreAssessment, assessmentQuestions } from './englishSkillsAssessment.ts';

const question = (id: number) => {
  const found = assessmentQuestions.find((item) => item.id === id);
  if (!found) {
    throw new Error(`Missing question ${id}`);
  }
  return found;
};

test('the sample answer key scores objective and written responses', () => {
  assert.equal(assessmentQuestions.length, 50);
  assert.equal(isQuestionCorrect(question(1), 'B'), true);
  assert.equal(isQuestionCorrect(question(5), 'b'), true);
  assert.equal(isQuestionCorrect(question(11), 'Prioritize'), true);
  assert.equal(isQuestionCorrect(question(13), 'finalise'), true);
  assert.equal(isQuestionCorrect(question(36), 'My interview is scheduled tomorrow.'), true);
  assert.equal(isQuestionCorrect(question(36), 'Tomorrow my interview is scheduled.'), false);
  assert.equal(
    isQuestionCorrect(question(19), 'Students are waiting in a queue for their placement interviews.'),
    true,
  );
  assert.equal(isQuestionCorrect(question(19), 'Nice picture.'), false);
  assert.equal(
    isQuestionCorrect(question(48), 'Your interview is tomorrow at 10 AM in the placement cell.'),
    true,
  );

  const answers = Object.fromEntries(assessmentQuestions.map((item) => {
    if (item.kind === 'choice' || item.kind === 'listening' || item.kind === 'match') {
      return [item.id, item.answer];
    }
    if (item.kind === 'blank') {
      return [item.id, item.accepted[0]];
    }
    if (item.kind === 'order') {
      return [item.id, item.answer];
    }
    if (item.id === 19) {
      return [item.id, 'Students are waiting outside the interview room with their resumes.'];
    }
    if (item.id === 48) {
      return [item.id, 'I have an interview tomorrow at 10 AM. Please wish me luck.'];
    }
    if (item.id === 49) {
      return [item.id, 'Could I have one more day to submit the assignment, please?'];
    }
    return [item.id, 'My name is Priya and I am a student pursuing this course. I am interested in communication. My goal is to speak clearly at work.'];
  }));

  const score = scoreAssessment(answers);
  assert.equal(score.total, 50);
  assert.equal(score.score, 50);
});
