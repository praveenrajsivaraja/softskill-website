import assert from 'node:assert/strict';
import test from 'node:test';
import {
  draftsToPayloads,
  isAssessmentResponseCorrect,
  questionDraftToPayload,
  writtenAnswerMeetsRules,
  type AssessmentQuestionDraft,
} from './assessmentModel.ts';

const choiceDraft = (): AssessmentQuestionDraft => ({
  key: 'q1',
  sectionTitle: 'Choose the correct answer',
  sectionInstructions: 'Choose one answer.',
  prompt: 'The interview is scheduled ___ 26 February.',
  kind: 'choice',
  pictureText: '',
  pictureUrl: '',
  passageTitle: '',
  passage: '',
  listeningScript: '',
  marks: '1',
  minimumWords: '1',
  acceptedAnswers: '',
  modelAnswer: '',
  wordBank: '',
  requiredPhrases: '',
  guidance: '',
  options: [
    { key: 'a', label: 'A. At', isCorrect: false },
    { key: 'b', label: 'B. On', isCorrect: true },
  ],
});

test('a choice question keeps one correct option and scores that option', () => {
  const payload = questionDraftToPayload(choiceDraft(), 1, 0);
  assert.equal('error' in payload, false);
  if ('error' in payload) {
    return;
  }
  const withIds = {
    ...payload,
    options: payload.options.map((option, index) => ({ ...option, id: index === 1 ? 'correct' : 'wrong' })),
  };
  assert.equal(isAssessmentResponseCorrect(withIds, 'correct'), true);
  assert.equal(isAssessmentResponseCorrect(withIds, 'wrong'), false);
});

test('blank, order, and written answers follow the sample marking rules', () => {
  assert.equal(isAssessmentResponseCorrect({
    kind: 'blank',
    acceptedAnswers: ['prioritise', 'prioritize'],
    modelAnswer: null,
    minimumWords: null,
    requiredPhrases: [],
    options: [],
  }, 'Prioritize'), true);

  assert.equal(isAssessmentResponseCorrect({
    kind: 'order',
    acceptedAnswers: [],
    modelAnswer: 'My interview is scheduled tomorrow.',
    minimumWords: null,
    requiredPhrases: [],
    options: [],
  }, 'my interview is scheduled tomorrow'), true);

  assert.equal(writtenAnswerMeetsRules(
    'Students are waiting in a queue for their placement interviews.',
    6,
    [['student', 'students'], ['interview', 'resume']],
  ), true);
  assert.equal(writtenAnswerMeetsRules('Nice picture.', 6, [['students']]), false);
});

test('a question without a correct option cannot be saved', () => {
  const draft = choiceDraft();
  draft.options = draft.options.map((option) => ({ ...option, isCorrect: false }));
  const payloads = draftsToPayloads([draft]);
  assert.equal('error' in payloads, true);
});
