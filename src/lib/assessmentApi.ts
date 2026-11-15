import { supabase } from '@/integrations/supabase/client';
import type { AssessmentQuestionPayload } from '@/lib/assessmentModel';

export interface ProgramAssessment {
  id: string;
  courseId: string;
  title: string;
  description: string | null;
  instructions: string | null;
  durationMinutes: number;
  passingScore: number;
  sequence: number;
  isActive: boolean;
  isPublished: boolean;
  showFeedback: boolean;
  allowReview: boolean;
}

export interface AssessmentSettingsInput {
  courseId: string;
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
}

export interface LearnerAssessmentQuestion {
  id: string;
  sectionTitle: string;
  sectionInstructions: string | null;
  sectionOrder: number;
  prompt: string;
  kind: AssessmentQuestionPayload['kind'];
  pictureText: string | null;
  pictureUrl: string | null;
  passageTitle: string | null;
  passage: string | null;
  listeningScript: string | null;
  marks: number;
  sortOrder: number;
  wordBank: string[];
  options: Array<{ id: string; label: string }>;
}

export interface LearnerAssessment {
  assessment: {
    id: string;
    title: string;
    description: string | null;
    instructions: string | null;
    durationMinutes: number;
    passingScore: number;
    showFeedback: boolean;
    allowReview: boolean;
  };
  questions: LearnerAssessmentQuestion[];
}

export interface AssessmentAttemptSummary {
  id: string;
  score: number;
  totalMarks: number;
  passed: boolean;
  submittedAt: string;
  results: Array<{
    questionId: string;
    prompt: string;
    sectionTitle: string;
    awarded: boolean;
    marks: number;
    guidance: string | null;
  }>;
}

const missingTable = (error: { code?: string; message?: string } | null): boolean => {
  if (!error) {
    return false;
  }
  return error.code === '42P01'
    || error.code === 'PGRST205'
    || error.message.includes('assessments');
};

export const isAssessmentStorageMissing = missingTable;

const toProgramAssessment = (row: {
  id: string;
  course_id: string;
  title: string;
  description: string | null;
  instructions: string | null;
  duration_minutes: number;
  passing_score: number;
  sequence: number;
  is_active: boolean;
  is_published: boolean;
  show_feedback: boolean;
  allow_review: boolean;
}): ProgramAssessment => ({
  id: row.id,
  courseId: row.course_id,
  title: row.title,
  description: row.description,
  instructions: row.instructions,
  durationMinutes: row.duration_minutes,
  passingScore: row.passing_score,
  sequence: row.sequence,
  isActive: row.is_active,
  isPublished: row.is_published,
  showFeedback: row.show_feedback,
  allowReview: row.allow_review,
});

export const fetchProgramAssessments = async (courseId: string): Promise<ProgramAssessment[]> => {
  const { data, error } = await supabase
    .from('assessments')
    .select('id, course_id, title, description, instructions, duration_minutes, passing_score, sequence, is_active, is_published, show_feedback, allow_review')
    .eq('course_id', courseId)
    .order('sequence', { ascending: true });

  if (error) {
    if (missingTable(error)) {
      return [];
    }
    throw error;
  }
  return (data ?? []).map(toProgramAssessment);
};

export const saveAssessmentSettings = async (
  assessmentId: string | null,
  input: AssessmentSettingsInput,
): Promise<string> => {
  const record = {
    course_id: input.courseId,
    title: input.title.trim(),
    description: input.description.trim() || null,
    instructions: input.instructions.trim() || null,
    duration_minutes: input.durationMinutes,
    passing_score: input.passingScore,
    sequence: input.sequence,
    is_active: input.isActive,
    is_published: input.isPublished,
    show_feedback: input.showFeedback,
    allow_review: input.allowReview,
    updated_at: new Date().toISOString(),
  };

  if (assessmentId) {
    const { error } = await supabase.from('assessments').update(record).eq('id', assessmentId);
    if (error) {
      throw error;
    }
    return assessmentId;
  }

  const { data, error } = await supabase.from('assessments').insert(record).select('id').single();
  if (error) {
    throw error;
  }
  return data.id;
};

export const deleteAssessment = async (assessmentId: string) => {
  const { error } = await supabase.from('assessments').delete().eq('id', assessmentId);
  if (error) {
    throw error;
  }
};

export const replaceAssessmentQuestions = async (
  assessmentId: string,
  questions: AssessmentQuestionPayload[],
) => {
  const { error } = await supabase.rpc('replace_assessment_questions', {
    target_assessment_id: assessmentId,
    questions,
  });
  if (error) {
    throw error;
  }
};

export const fetchAssessmentQuestions = async (assessmentId: string) => {
  const { data, error } = await supabase
    .from('assessment_questions')
    .select('*, assessment_options(id, label, is_correct, sort_order)')
    .eq('assessment_id', assessmentId)
    .order('section_order', { ascending: true })
    .order('sort_order', { ascending: true });

  if (error) {
    throw error;
  }
  return data ?? [];
};

export const openLearnerAssessment = async (assessmentId: string): Promise<LearnerAssessment> => {
  const { data, error } = await supabase.rpc('get_assessment_for_learner', {
    target_assessment_id: assessmentId,
  });
  if (error) {
    throw error;
  }
  return data as unknown as LearnerAssessment;
};

export const checkLearnerAnswer = async (questionId: string, response: string): Promise<boolean> => {
  const { data, error } = await supabase.rpc('check_assessment_answer', {
    target_question_id: questionId,
    response,
  });
  if (error) {
    throw error;
  }
  return Boolean(data);
};

export const submitLearnerAssessment = async (
  assessmentId: string,
  answers: Record<string, string>,
): Promise<AssessmentAttemptSummary> => {
  const { data, error } = await supabase.rpc('submit_assessment_attempt', {
    target_assessment_id: assessmentId,
    responses: answers,
  });
  if (error) {
    throw error;
  }
  const result = data as {
    attemptId: string;
    score: number;
    totalMarks: number;
    passed: boolean;
    results: AssessmentAttemptSummary['results'];
  };
  return {
    id: result.attemptId,
    score: result.score,
    totalMarks: result.totalMarks,
    passed: result.passed,
    submittedAt: new Date().toISOString(),
    results: result.results ?? [],
  };
};

export const fetchMyAssessmentAttempts = async (assessmentId: string): Promise<AssessmentAttemptSummary[]> => {
  const { data, error } = await supabase
    .from('assessment_attempts')
    .select('id, score, total_marks, passed, submitted_at, results')
    .eq('assessment_id', assessmentId)
    .order('submitted_at', { ascending: false });

  if (error) {
    if (missingTable(error)) {
      return [];
    }
    throw error;
  }

  return (data ?? []).map((attempt) => ({
    id: attempt.id,
    score: attempt.score,
    totalMarks: attempt.total_marks,
    passed: attempt.passed,
    submittedAt: attempt.submitted_at,
    results: Array.isArray(attempt.results) ? attempt.results as AssessmentAttemptSummary['results'] : [],
  }));
};
