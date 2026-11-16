export const assessmentQuestionKinds = [
  'choice',
  'listening',
  'blank',
  'match',
  'order',
  'written',
] as const;

export type AssessmentQuestionKind = (typeof assessmentQuestionKinds)[number];

export const assessmentQuestionKindLabels: Record<AssessmentQuestionKind, string> = {
  choice: 'Multiple choice',
  listening: 'Listen and choose',
  blank: 'Fill in the blank',
  match: 'Match the meaning',
  order: 'Arrange the words',
  written: 'Written response',
};

export interface AssessmentOptionPayload {
  label: string;
  isCorrect: boolean;
  sortOrder: number;
}

export interface AssessmentQuestionPayload {
  sectionTitle: string;
  sectionInstructions: string | null;
  sectionOrder: number;
  prompt: string;
  kind: AssessmentQuestionKind;
  pictureText: string | null;
  pictureUrl: string | null;
  passageTitle: string | null;
  passage: string | null;
  listeningScript: string | null;
  marks: number;
  sortOrder: number;
  minimumWords: number | null;
  acceptedAnswers: string[];
  modelAnswer: string | null;
  wordBank: string[];
  requiredPhrases: string[][];
  guidance: string | null;
  options: AssessmentOptionPayload[];
}

export interface AssessmentQuestionDraft {
  key: string;
  sectionTitle: string;
  sectionInstructions: string;
  prompt: string;
  kind: AssessmentQuestionKind;
  pictureText: string;
  pictureUrl: string;
  passageTitle: string;
  passage: string;
  listeningScript: string;
  marks: string;
  minimumWords: string;
  acceptedAnswers: string;
  modelAnswer: string;
  wordBank: string;
  requiredPhrases: string;
  guidance: string;
  options: Array<{ key: string; label: string; isCorrect: boolean }>;
}

export const normalizeAssessmentText = (value: string): string => {
  return value.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
};

export const assessmentWordCount = (value: string): number => {
  const normalized = normalizeAssessmentText(value);
  return normalized ? normalized.split(' ').length : 0;
};

export const parseRequiredPhrases = (value: string): string[][] => {
  return value
    .split('\n')
    .map((line) => line.split('|').map((phrase) => phrase.trim()).filter(Boolean))
    .filter((group) => group.length > 0);
};

export const formatRequiredPhrases = (groups: string[][]): string => {
  return groups.map((group) => group.join(' | ')).join('\n');
};

export const writtenAnswerMeetsRules = (
  response: string,
  minimumWords: number | null,
  requiredPhrases: string[][],
): boolean => {
  if (assessmentWordCount(response) < (minimumWords ?? 1)) {
    return false;
  }
  const normalizedResponse = normalizeAssessmentText(response);
  return requiredPhrases.every((group) =>
    group.some((phrase) => normalizedResponse.includes(normalizeAssessmentText(phrase)))
  );
};

export const isAssessmentResponseCorrect = (
  question: {
    kind: AssessmentQuestionKind;
    acceptedAnswers: string[];
    modelAnswer: string | null;
    minimumWords: number | null;
    requiredPhrases: string[][];
    options: Array<{ id?: string; isCorrect: boolean }>;
  },
  response: string,
): boolean => {
  if (question.kind === 'choice' || question.kind === 'listening' || question.kind === 'match') {
    return question.options.some((option) => option.isCorrect && option.id === response);
  }
  if (question.kind === 'blank') {
    const normalized = normalizeAssessmentText(response);
    return question.acceptedAnswers.some((accepted) => normalizeAssessmentText(accepted) === normalized);
  }
  if (question.kind === 'order') {
    return normalizeAssessmentText(response) === normalizeAssessmentText(question.modelAnswer ?? '');
  }
  return writtenAnswerMeetsRules(response, question.minimumWords, question.requiredPhrases);
};

const splitList = (value: string): string[] => {
  return value.split(/[,|\n]/).map((item) => item.trim()).filter(Boolean);
};

export const createQuestionDraft = (partial?: Partial<AssessmentQuestionDraft>): AssessmentQuestionDraft => ({
  key: partial?.key ?? crypto.randomUUID(),
  sectionTitle: partial?.sectionTitle ?? 'Questions',
  sectionInstructions: partial?.sectionInstructions ?? '',
  prompt: partial?.prompt ?? '',
  kind: partial?.kind ?? 'choice',
  pictureText: partial?.pictureText ?? '',
  pictureUrl: partial?.pictureUrl ?? '',
  passageTitle: partial?.passageTitle ?? '',
  passage: partial?.passage ?? '',
  listeningScript: partial?.listeningScript ?? '',
  marks: partial?.marks ?? '1',
  minimumWords: partial?.minimumWords ?? '1',
  acceptedAnswers: partial?.acceptedAnswers ?? '',
  modelAnswer: partial?.modelAnswer ?? '',
  wordBank: partial?.wordBank ?? '',
  requiredPhrases: partial?.requiredPhrases ?? '',
  guidance: partial?.guidance ?? '',
  options: partial?.options ?? [
    { key: crypto.randomUUID(), label: '', isCorrect: true },
    { key: crypto.randomUUID(), label: '', isCorrect: false },
  ],
});

export const questionDraftToPayload = (
  draft: AssessmentQuestionDraft,
  sectionOrder: number,
  sortOrder: number,
): AssessmentQuestionPayload | { error: string } => {
  const prompt = draft.prompt.trim();
  if (!prompt) {
    return { error: 'Every question needs a prompt.' };
  }
  const marks = Number(draft.marks);
  if (!Number.isInteger(marks) || marks < 1) {
    return { error: 'Every question needs at least 1 mark.' };
  }

  const options = draft.options
    .map((option, index) => ({ label: option.label.trim(), isCorrect: option.isCorrect, sortOrder: index }))
    .filter((option) => option.label);
  const usesOptions = draft.kind === 'choice' || draft.kind === 'listening' || draft.kind === 'match';
  if (usesOptions && (options.length < 2 || !options.some((option) => option.isCorrect))) {
    return { error: 'Choice questions need at least two options and at least one correct answer.' };
  }

  const acceptedAnswers = splitList(draft.acceptedAnswers);
  if (draft.kind === 'blank' && acceptedAnswers.length === 0) {
    return { error: 'Fill-in-the-blank questions need at least one accepted answer.' };
  }

  const wordBank = draft.wordBank.split('/').map((word) => word.trim()).filter(Boolean);
  if (draft.kind === 'order' && (!draft.modelAnswer.trim() || wordBank.length < 2)) {
    return { error: 'Arrange-the-words questions need a word bank and the correct sentence.' };
  }
  if (draft.kind === 'listening' && !draft.listeningScript.trim()) {
    return { error: 'Listening questions need a recording script. Learners hear it, and it stays hidden.' };
  }

  const minimumWords = draft.kind === 'written' ? Number(draft.minimumWords || '1') : null;
  if (draft.kind === 'written' && (!Number.isInteger(minimumWords) || (minimumWords ?? 0) < 1)) {
    return { error: 'Written questions need a minimum word count.' };
  }

  return {
    sectionTitle: draft.sectionTitle.trim() || 'Questions',
    sectionInstructions: draft.sectionInstructions.trim() || null,
    sectionOrder,
    prompt,
    kind: draft.kind,
    pictureText: draft.pictureText.trim() || null,
    pictureUrl: draft.pictureUrl.trim() || null,
    passageTitle: draft.passageTitle.trim() || null,
    passage: draft.passage.trim() || null,
    listeningScript: draft.listeningScript.trim() || null,
    marks,
    sortOrder,
    minimumWords,
    acceptedAnswers: draft.kind === 'blank' ? acceptedAnswers : [],
    modelAnswer: draft.kind === 'order' ? draft.modelAnswer.trim() : null,
    wordBank: draft.kind === 'order' ? wordBank : [],
    requiredPhrases: draft.kind === 'written' ? parseRequiredPhrases(draft.requiredPhrases) : [],
    guidance: draft.guidance.trim() || null,
    options: usesOptions ? options : [],
  };
};

export const draftsToPayloads = (
  drafts: AssessmentQuestionDraft[],
): AssessmentQuestionPayload[] | { error: string } => {
  const sectionOrders = new Map<string, number>();
  const payloads: AssessmentQuestionPayload[] = [];

  for (const [index, draft] of drafts.entries()) {
    const sectionTitle = draft.sectionTitle.trim() || 'Questions';
    if (!sectionOrders.has(sectionTitle)) {
      sectionOrders.set(sectionTitle, sectionOrders.size + 1);
    }
    const payload = questionDraftToPayload(draft, sectionOrders.get(sectionTitle) ?? 1, index);
    if ('error' in payload) {
      return payload;
    }
    payloads.push(payload);
  }

  return payloads;
};
