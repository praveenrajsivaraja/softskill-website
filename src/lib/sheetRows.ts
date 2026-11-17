import {
  assessmentQuestionKinds,
  createQuestionDraft,
  draftsToPayloads,
  type AssessmentQuestionKind,
  type AssessmentQuestionPayload,
} from './assessmentModel.ts';
import { lineOrPipeList, missingSheetColumns, pipeList, readBoolean } from './spreadsheet.ts';

export interface CourseSheetFields {
  title: string;
  description: string | null;
  price: number;
  originalPrice: number | null;
  category: string | null;
  duration: string | null;
  ageRange: string | null;
  mode: string | null;
  status: 'active' | 'inactive' | 'archived';
  totalLessons: number;
  highlights: string[];
  learningPoints: string[];
  imageUrl: string | null;
}

const courseStatuses = ['active', 'inactive', 'archived'] as const;

const emptyToNull = (value: string | undefined): string | null => {
  const text = (value ?? '').trim();
  return text ? text : null;
};

const readWholeNumber = (value: string | undefined, fallback: number): number | null => {
  const text = (value ?? '').trim();
  if (!text) {
    return fallback;
  }
  const parsed = Number(text);
  if (!Number.isInteger(parsed) || parsed < 0) {
    return null;
  }
  return parsed;
};

export const courseFieldsFromRow = (row: Record<string, string>, line: number): CourseSheetFields | { error: string } => {
  const title = (row.title ?? '').trim();
  if (!title) {
    return { error: `Row ${line}: title is required.` };
  }
  const priceText = (row.price ?? '').trim();
  const price = Number(priceText);
  if (!priceText || Number.isNaN(price) || price < 0) {
    return { error: `Row ${line}: price must be a number that is 0 or more.` };
  }
  const originalText = (row.original_price ?? '').trim();
  const originalPrice = originalText ? Number(originalText) : null;
  if (originalPrice !== null && (Number.isNaN(originalPrice) || originalPrice < 0)) {
    return { error: `Row ${line}: original_price must be empty or a number that is 0 or more.` };
  }
  const status = ((row.status ?? '').trim().toLowerCase() || 'active') as CourseSheetFields['status'];
  if (!courseStatuses.includes(status)) {
    return { error: `Row ${line}: status must be active, inactive, or archived.` };
  }
  const totalLessons = readWholeNumber(row.total_lessons, 0);
  if (totalLessons === null) {
    return { error: `Row ${line}: total_lessons must be a whole number.` };
  }

  return {
    title,
    description: emptyToNull(row.description),
    price,
    originalPrice,
    category: emptyToNull(row.category),
    duration: emptyToNull(row.duration),
    ageRange: emptyToNull(row.age_range),
    mode: emptyToNull(row.mode),
    status,
    totalLessons,
    highlights: lineOrPipeList(row.highlights),
    learningPoints: lineOrPipeList(row.learning_points),
    imageUrl: emptyToNull(row.image_url),
  };
};

export interface AssessmentSheetGroup {
  programTitle: string;
  title: string;
  description: string;
  instructions: string;
  durationMinutes: number;
  passingScore: number;
  sequence: number;
  isActive: boolean;
  isPublished: boolean;
  showFeedback: boolean;
  allowReview: boolean;
  questions: AssessmentQuestionPayload[];
  createdFromLine: number;
}

const readFlag = (row: Record<string, string>, key: string, fallback: boolean, line: number): boolean | { error: string } => {
  const value = readBoolean(row[key], fallback);
  if (value === null) {
    return { error: `Row ${line}: ${key} must be true or false.` };
  }
  return value;
};

const questionFromRow = (row: Record<string, string>, line: number): ReturnType<typeof createQuestionDraft> | { error: string } => {
  const kind = ((row.kind ?? '').trim().toLowerCase() || 'choice') as AssessmentQuestionKind;
  if (!assessmentQuestionKinds.includes(kind)) {
    return { error: `Row ${line}: kind must be one of ${assessmentQuestionKinds.join(', ')}.` };
  }
  const marks = (row.marks ?? '').trim() || '1';
  const options = [1, 2, 3, 4].map((index) => {
    const label = (row[`option_${index}`] ?? '').trim();
    const correct = readBoolean(row[`option_${index}_correct`], false);
    return { label, correct };
  });
  if (options.some((option) => option.label && option.correct === null)) {
    return { error: `Row ${line}: option correct flags must be true or false.` };
  }

  return createQuestionDraft({
    sectionTitle: (row.section_title ?? '').trim() || 'Questions',
    sectionInstructions: (row.section_instructions ?? '').trim(),
    prompt: (row.prompt ?? '').trim(),
    kind,
    pictureText: (row.picture_text ?? '').trim(),
    pictureUrl: (row.picture_url ?? '').trim(),
    passageTitle: (row.passage_title ?? '').trim(),
    passage: (row.passage ?? '').trim(),
    listeningScript: (row.listening_script ?? '').trim(),
    marks,
    minimumWords: (row.minimum_words ?? '').trim() || '1',
    acceptedAnswers: pipeList(row.accepted_answers).join(', '),
    modelAnswer: (row.model_answer ?? '').trim(),
    wordBank: pipeList(row.word_bank).join(' / '),
    requiredPhrases: (row.required_phrases ?? '').trim(),
    guidance: (row.guidance ?? '').trim(),
    options: options
      .filter((option) => option.label)
      .map((option) => ({ key: crypto.randomUUID(), label: option.label, isCorrect: option.correct === true })),
  });
};

export const groupAssessmentRows = (
  rows: Record<string, string>[],
): { groups: AssessmentSheetGroup[]; errors: string[] } => {
  const columnErrors = missingSheetColumns(rows, ['program_title', 'assessment_title', 'prompt']);
  if (columnErrors.length > 0) {
    return { groups: [], errors: columnErrors };
  }

  const grouped = new Map<string, { rows: Array<{ row: Record<string, string>; line: number }> }>();
  const errors: string[] = [];

  rows.forEach((row, index) => {
    const line = index + 2;
    const programTitle = (row.program_title ?? '').trim();
    const title = (row.assessment_title ?? '').trim();
    if (!programTitle || !title) {
      errors.push(`Row ${line}: program_title and assessment_title are required.`);
      return;
    }
    const key = `${programTitle.toLowerCase()}::${title.toLowerCase()}`;
    const current = grouped.get(key) ?? { rows: [] };
    current.rows.push({ row, line });
    grouped.set(key, current);
  });

  const groups: AssessmentSheetGroup[] = [];
  for (const entry of grouped.values()) {
    const sorted = [...entry.rows].sort((left, right) => left.line - right.line);
    const first = sorted[0];
    const durationMinutes = readWholeNumber(first.row.duration_minutes, 30);
    const passingScore = readWholeNumber(first.row.passing_score, 70);
    const sequence = readWholeNumber(first.row.sequence, 1);
    if (durationMinutes === null || durationMinutes < 1) {
      errors.push(`Row ${first.line}: duration_minutes must be a whole number of at least 1.`);
      continue;
    }
    if (passingScore === null || passingScore > 100) {
      errors.push(`Row ${first.line}: passing_score must be a whole number from 0 to 100.`);
      continue;
    }
    if (sequence === null || sequence < 1) {
      errors.push(`Row ${first.line}: sequence must be a whole number of at least 1.`);
      continue;
    }

    const flags = {
      isActive: readFlag(first.row, 'is_active', true, first.line),
      isPublished: readFlag(first.row, 'is_published', false, first.line),
      showFeedback: readFlag(first.row, 'show_feedback', true, first.line),
      allowReview: readFlag(first.row, 'allow_review', true, first.line),
    };
    const flagError = Object.values(flags).find((value) => typeof value !== 'boolean');
    if (flagError && typeof flagError !== 'boolean') {
      errors.push(flagError.error);
      continue;
    }

    const drafts = [];
    let questionError = '';
    for (const item of sorted) {
      const draft = questionFromRow(item.row, item.line);
      if ('error' in draft) {
        questionError = draft.error;
        break;
      }
      drafts.push(draft);
    }
    if (questionError) {
      errors.push(questionError);
      continue;
    }

    const payloads = draftsToPayloads(drafts);
    if ('error' in payloads) {
      errors.push(`Row ${first.line}: ${payloads.error}`);
      continue;
    }

    groups.push({
      programTitle: (first.row.program_title ?? '').trim(),
      title: (first.row.assessment_title ?? '').trim(),
      description: (first.row.description ?? '').trim(),
      instructions: (first.row.instructions ?? '').trim(),
      durationMinutes,
      passingScore,
      sequence,
      isActive: flags.isActive as boolean,
      isPublished: flags.isPublished as boolean,
      showFeedback: flags.showFeedback as boolean,
      allowReview: flags.allowReview as boolean,
      questions: payloads,
      createdFromLine: first.line,
    });
  }

  return { groups, errors };
};

export const careerSectionFromRow = (
  row: Record<string, string>,
  line: number,
): { sectionKey: 'hero' | 'feature' | 'benefit' | 'cta'; title: string; description: string | null; orderIndex: number; isActive: boolean } | { error: string } => {
  const sectionKey = (row.section_key ?? '').trim().toLowerCase();
  if (sectionKey !== 'hero' && sectionKey !== 'feature' && sectionKey !== 'benefit' && sectionKey !== 'cta') {
    return { error: `Row ${line}: section_key must be hero, feature, benefit, or cta.` };
  }
  const title = (row.title ?? '').trim();
  if (!title) {
    return { error: `Row ${line}: title is required.` };
  }
  const orderIndex = readWholeNumber(row.order_index, 0);
  if (orderIndex === null) {
    return { error: `Row ${line}: order_index must be a whole number.` };
  }
  const isActive = readBoolean(row.is_active, true);
  if (isActive === null) {
    return { error: `Row ${line}: is_active must be true or false.` };
  }
  return {
    sectionKey,
    title,
    description: emptyToNull(row.description),
    orderIndex,
    isActive,
  };
};
