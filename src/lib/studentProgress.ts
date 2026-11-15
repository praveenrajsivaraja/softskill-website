import {
  assessmentQuestionKinds,
  isAssessmentResponseCorrect,
  type AssessmentQuestionKind,
} from './assessmentModel.ts';

export interface ProgressEnrollment {
  studentId: string;
  studentName: string;
  email: string;
  phone: string | null;
  courseId: string;
  courseTitle: string;
  enrollmentStatus: string;
  progress: number;
}

export interface ProgressAssessment {
  id: string;
  courseId: string;
  title: string;
  sequence: number;
  isPublished: boolean;
  isActive: boolean;
}

export interface ProgressAttempt {
  id: string;
  userId: string;
  assessmentId: string;
  score: number;
  totalMarks: number;
  passed: boolean;
  submittedAt: string;
  answers: Record<string, string>;
}

export interface StoredQuestion {
  id: string;
  assessmentId: string;
  prompt: string;
  sectionTitle: string;
  sortOrder: number;
  kind: AssessmentQuestionKind;
  marks: number;
  acceptedAnswers: string[];
  modelAnswer: string | null;
  minimumWords: number | null;
  requiredPhrases: string[][];
  guidance: string | null;
  options: Array<{ id: string; label: string; isCorrect: boolean }>;
}

export interface StudentAttemptView {
  id: string;
  score: number;
  totalMarks: number;
  passed: boolean;
  submittedAt: string;
  answers: Record<string, string>;
}

export interface StudentAssessmentView {
  id: string;
  title: string;
  isPublished: boolean;
  latest: StudentAttemptView | null;
  attempts: StudentAttemptView[];
}

export interface StudentProgramView {
  courseId: string;
  courseTitle: string;
  enrollmentStatus: string;
  progress: number;
  passedCount: number;
  assessmentCount: number;
  assessments: StudentAssessmentView[];
}

export interface StudentProgressView {
  studentId: string;
  studentName: string;
  email: string;
  phone: string | null;
  programs: StudentProgramView[];
}

export interface AttemptAnswerDetail {
  questionId: string;
  prompt: string;
  sectionTitle: string;
  responseLabel: string;
  expectedLabel: string;
  awarded: boolean;
  marks: number;
  guidance: string | null;
}

const isQuestionKind = (value: string): value is AssessmentQuestionKind => {
  return (assessmentQuestionKinds as readonly string[]).includes(value);
};

export const readAnswerMap = (value: unknown): Record<string, string> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }
  const answers: Record<string, string> = {};
  for (const [questionId, response] of Object.entries(value)) {
    if (typeof response === 'string') {
      answers[questionId] = response;
    }
  }
  return answers;
};

export const readPhraseGroups = (value: unknown): string[][] => {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.flatMap((group) => {
    if (!Array.isArray(group)) {
      return [];
    }
    const phrases = group.filter((phrase): phrase is string => typeof phrase === 'string' && phrase.trim().length > 0);
    return phrases.length > 0 ? [phrases] : [];
  });
};

export const readQuestionKind = (value: string): AssessmentQuestionKind | null => {
  return isQuestionKind(value) ? value : null;
};

const expectedLabel = (question: StoredQuestion): string => {
  if (question.kind === 'choice' || question.kind === 'listening' || question.kind === 'match') {
    return question.options.filter((option) => option.isCorrect).map((option) => option.label).join(', ') || 'No correct option';
  }
  if (question.kind === 'blank') {
    return question.acceptedAnswers.join(', ');
  }
  if (question.kind === 'order') {
    return question.modelAnswer ?? '';
  }
  return question.guidance ?? 'A written answer that meets the marking rules';
};

export const describeAttemptAnswers = (
  questions: StoredQuestion[],
  answers: Record<string, string>,
): AttemptAnswerDetail[] => {
  return [...questions]
    .sort((left, right) => left.sortOrder - right.sortOrder)
    .map((question) => {
      const response = answers[question.id] ?? '';
      const matchedOption = question.options.find((option) => option.id === response);
      const awarded = isAssessmentResponseCorrect(question, response);
      return {
        questionId: question.id,
        prompt: question.prompt,
        sectionTitle: question.sectionTitle,
        responseLabel: matchedOption?.label || response.trim() || 'No answer',
        expectedLabel: expectedLabel(question),
        awarded,
        marks: question.marks,
        guidance: awarded ? null : question.guidance,
      };
    });
};

const toAttemptView = (attempt: ProgressAttempt): StudentAttemptView => ({
  id: attempt.id,
  score: attempt.score,
  totalMarks: attempt.totalMarks,
  passed: attempt.passed,
  submittedAt: attempt.submittedAt,
  answers: attempt.answers,
});

export const groupStudentProgress = (
  enrollments: ProgressEnrollment[],
  assessments: ProgressAssessment[],
  attempts: ProgressAttempt[],
): StudentProgressView[] => {
  const students = new Map<string, StudentProgressView>();

  for (const enrollment of enrollments) {
    const student = students.get(enrollment.studentId) ?? {
      studentId: enrollment.studentId,
      studentName: enrollment.studentName,
      email: enrollment.email,
      phone: enrollment.phone,
      programs: [],
    };
    const courseAssessments = assessments
      .filter((assessment) => assessment.courseId === enrollment.courseId)
      .sort((left, right) => left.sequence - right.sequence || left.title.localeCompare(right.title));
    const assessmentViews = courseAssessments.map((assessment) => {
      const assessmentAttempts = attempts
        .filter((attempt) => attempt.userId === enrollment.studentId && attempt.assessmentId === assessment.id)
        .sort((left, right) => right.submittedAt.localeCompare(left.submittedAt))
        .map(toAttemptView);
      return {
        id: assessment.id,
        title: assessment.title,
        isPublished: assessment.isPublished && assessment.isActive,
        latest: assessmentAttempts[0] ?? null,
        attempts: assessmentAttempts,
      };
    });
    const published = assessmentViews.filter((assessment) => assessment.isPublished);
    student.programs.push({
      courseId: enrollment.courseId,
      courseTitle: enrollment.courseTitle,
      enrollmentStatus: enrollment.enrollmentStatus,
      progress: enrollment.progress,
      passedCount: published.filter((assessment) => assessment.latest?.passed).length,
      assessmentCount: published.length,
      assessments: assessmentViews,
    });
    students.set(enrollment.studentId, student);
  }

  return [...students.values()].sort((left, right) => left.studentName.localeCompare(right.studentName));
};
