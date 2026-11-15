-- Completing an assessment updates the enrollment progress for that program.
-- Progress is the share of published assessments the student has submitted.

CREATE OR REPLACE FUNCTION public.refresh_program_progress(
  target_course_id uuid,
  target_user_id uuid
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  published_count integer;
  completed_count integer;
  progress_percent integer;
BEGIN
  SELECT count(*)::integer
  INTO published_count
  FROM public.assessments
  WHERE course_id = target_course_id
    AND is_published
    AND is_active;

  IF published_count = 0 THEN
    RETURN NULL;
  END IF;

  SELECT count(DISTINCT attempt.assessment_id)::integer
  INTO completed_count
  FROM public.assessment_attempts AS attempt
  JOIN public.assessments AS assessment ON assessment.id = attempt.assessment_id
  WHERE attempt.user_id = target_user_id
    AND assessment.course_id = target_course_id
    AND assessment.is_published
    AND assessment.is_active;

  progress_percent := LEAST(100, ROUND((completed_count::numeric * 100) / published_count)::integer);

  UPDATE public.enrollments
  SET progress = progress_percent,
      completed_lessons = completed_count
  WHERE student_id = target_user_id
    AND course_id = target_course_id
    AND status IN ('enrolled', 'completed');

  RETURN progress_percent;
END;
$$;

CREATE OR REPLACE FUNCTION public.submit_assessment_attempt(
  target_assessment_id uuid,
  responses jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  assessment_row public.assessments%ROWTYPE;
  question_row public.assessment_questions%ROWTYPE;
  response_text text;
  awarded boolean;
  earned integer := 0;
  possible integer := 0;
  result_items jsonb := '[]'::jsonb;
  passed boolean;
  attempt_id uuid;
  program_progress integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in to submit an assessment';
  END IF;

  SELECT * INTO assessment_row FROM public.assessments WHERE id = target_assessment_id;
  IF NOT FOUND OR NOT assessment_row.is_published OR NOT assessment_row.is_active THEN
    RAISE EXCEPTION 'This assessment is not available';
  END IF;
  IF NOT public.user_can_read_course_attachment(assessment_row.course_id) THEN
    RAISE EXCEPTION 'Enroll in this program before taking the assessment';
  END IF;

  FOR question_row IN
    SELECT * FROM public.assessment_questions
    WHERE assessment_id = target_assessment_id
    ORDER BY section_order, sort_order, id
  LOOP
    possible := possible + question_row.marks;
    response_text := COALESCE(responses ->> question_row.id::text, '');
    awarded := public.assessment_response_is_correct(question_row, response_text);
    IF awarded THEN
      earned := earned + question_row.marks;
    END IF;
    result_items := result_items || jsonb_build_array(jsonb_build_object(
      'questionId', question_row.id,
      'prompt', question_row.prompt,
      'sectionTitle', question_row.section_title,
      'awarded', awarded,
      'marks', question_row.marks,
      'guidance', CASE WHEN awarded THEN NULL ELSE question_row.guidance END
    ));
  END LOOP;

  passed := possible = 0 OR ((earned::numeric * 100) / possible) >= assessment_row.passing_score;

  INSERT INTO public.assessment_attempts (
    assessment_id, user_id, score, total_marks, passed, answers, results
  ) VALUES (
    target_assessment_id,
    auth.uid(),
    earned,
    possible,
    passed,
    COALESCE(responses, '{}'::jsonb),
    CASE WHEN assessment_row.allow_review THEN result_items ELSE '[]'::jsonb END
  ) RETURNING id INTO attempt_id;

  program_progress := public.refresh_program_progress(assessment_row.course_id, auth.uid());

  RETURN jsonb_build_object(
    'attemptId', attempt_id,
    'score', earned,
    'totalMarks', possible,
    'passed', passed,
    'passingScore', assessment_row.passing_score,
    'programProgress', program_progress,
    'results', CASE WHEN assessment_row.allow_review THEN result_items ELSE '[]'::jsonb END
  );
END;
$$;

REVOKE ALL ON FUNCTION public.refresh_program_progress(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.submit_assessment_attempt(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_assessment_attempt(uuid, jsonb) TO authenticated;

DO $$
DECLARE
  progress_pair record;
BEGIN
  FOR progress_pair IN
    SELECT DISTINCT assessment.course_id, attempt.user_id
    FROM public.assessment_attempts AS attempt
    JOIN public.assessments AS assessment ON assessment.id = attempt.assessment_id
  LOOP
    PERFORM public.refresh_program_progress(progress_pair.course_id, progress_pair.user_id);
  END LOOP;
END;
$$;
