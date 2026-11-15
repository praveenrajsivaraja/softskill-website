-- Each learning program owns its own assessments, questions, and results.
-- Learners can read published assessment details without the answer key.
-- Scoring runs in the database so the answer key stays on the server.

CREATE OR REPLACE FUNCTION public.user_can_read_course_attachment(target_course_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.is_admin(auth.uid())
    OR EXISTS (
      SELECT 1
      FROM public.enrollments
      WHERE enrollments.course_id = target_course_id
        AND enrollments.student_id = auth.uid()
        AND enrollments.status IN ('enrolled', 'completed')
    )
    OR EXISTS (
      SELECT 1
      FROM public.orders
      JOIN public.order_items ON order_items.order_id = orders.id
      WHERE order_items.course_id = target_course_id
        AND orders.user_id = auth.uid()
        AND orders.status IN ('confirmed', 'completed')
    );
$$;

CREATE OR REPLACE FUNCTION public.normalize_assessment_text(value text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT btrim(regexp_replace(regexp_replace(lower(COALESCE(value, '')), '[^a-z0-9\s]', ' ', 'g'), '\s+', ' ', 'g'));
$$;

CREATE OR REPLACE FUNCTION public.assessment_word_count(value text)
RETURNS integer
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN public.normalize_assessment_text(value) = '' THEN 0
    ELSE array_length(string_to_array(public.normalize_assessment_text(value), ' '), 1)
  END;
$$;

CREATE OR REPLACE FUNCTION public.written_answer_meets_rules(
  response text,
  minimum_words integer,
  required_phrases jsonb
)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  phrase_group jsonb;
  phrase text;
  group_matched boolean;
  normalized_response text;
BEGIN
  IF public.assessment_word_count(response) < COALESCE(minimum_words, 1) THEN
    RETURN false;
  END IF;

  normalized_response := public.normalize_assessment_text(response);
  FOR phrase_group IN SELECT value FROM jsonb_array_elements(COALESCE(required_phrases, '[]'::jsonb))
  LOOP
    group_matched := false;
    FOR phrase IN SELECT jsonb_array_elements_text(phrase_group)
    LOOP
      IF normalized_response LIKE '%' || public.normalize_assessment_text(phrase) || '%' THEN
        group_matched := true;
      END IF;
    END LOOP;
    IF NOT group_matched THEN
      RETURN false;
    END IF;
  END LOOP;
  RETURN true;
END;
$$;

CREATE TABLE IF NOT EXISTS public.assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  instructions text,
  duration_minutes integer NOT NULL DEFAULT 30 CHECK (duration_minutes > 0),
  passing_score integer NOT NULL DEFAULT 70 CHECK (passing_score BETWEEN 0 AND 100),
  sequence integer NOT NULL DEFAULT 1,
  is_active boolean NOT NULL DEFAULT true,
  is_published boolean NOT NULL DEFAULT false,
  show_feedback boolean NOT NULL DEFAULT true,
  allow_review boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.assessment_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id uuid NOT NULL REFERENCES public.assessments(id) ON DELETE CASCADE,
  section_title text NOT NULL DEFAULT 'Questions',
  section_instructions text,
  section_order integer NOT NULL DEFAULT 1,
  prompt text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('choice', 'listening', 'blank', 'match', 'order', 'written')),
  picture_text text,
  picture_url text,
  passage_title text,
  passage text,
  listening_script text,
  marks integer NOT NULL DEFAULT 1 CHECK (marks > 0),
  sort_order integer NOT NULL DEFAULT 0,
  minimum_words integer,
  accepted_answers text[],
  model_answer text,
  word_bank text[],
  required_phrases jsonb,
  guidance text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.assessment_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id uuid NOT NULL REFERENCES public.assessment_questions(id) ON DELETE CASCADE,
  label text NOT NULL,
  is_correct boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.assessment_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id uuid NOT NULL REFERENCES public.assessments(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  score integer NOT NULL,
  total_marks integer NOT NULL,
  passed boolean NOT NULL,
  answers jsonb NOT NULL,
  results jsonb NOT NULL,
  submitted_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS assessments_course_sequence_idx
  ON public.assessments (course_id, sequence, created_at);
CREATE INDEX IF NOT EXISTS assessment_questions_order_idx
  ON public.assessment_questions (assessment_id, section_order, sort_order);
CREATE INDEX IF NOT EXISTS assessment_attempts_user_idx
  ON public.assessment_attempts (assessment_id, user_id, submitted_at DESC);

ALTER TABLE public.assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessment_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessment_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessment_attempts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage assessments" ON public.assessments;
CREATE POLICY "Admins manage assessments"
  ON public.assessments FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Enrolled learners read published assessments" ON public.assessments;
CREATE POLICY "Enrolled learners read published assessments"
  ON public.assessments FOR SELECT TO authenticated
  USING (
    is_published
    AND is_active
    AND public.user_can_read_course_attachment(course_id)
  );

DROP POLICY IF EXISTS "Admins manage assessment questions" ON public.assessment_questions;
CREATE POLICY "Admins manage assessment questions"
  ON public.assessment_questions FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins manage assessment options" ON public.assessment_options;
CREATE POLICY "Admins manage assessment options"
  ON public.assessment_options FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Learners read their assessment attempts" ON public.assessment_attempts;
CREATE POLICY "Learners read their assessment attempts"
  ON public.assessment_attempts FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin(auth.uid()));

REVOKE ALL ON TABLE public.assessments FROM PUBLIC, anon;
REVOKE ALL ON TABLE public.assessment_questions FROM PUBLIC, anon;
REVOKE ALL ON TABLE public.assessment_options FROM PUBLIC, anon;
REVOKE ALL ON TABLE public.assessment_attempts FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.assessments TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.assessment_questions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.assessment_options TO authenticated;
GRANT SELECT ON TABLE public.assessment_attempts TO authenticated;
GRANT ALL ON TABLE public.assessments, public.assessment_questions, public.assessment_options, public.assessment_attempts TO service_role;

CREATE OR REPLACE FUNCTION public.replace_assessment_questions(
  target_assessment_id uuid,
  questions jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  question_item jsonb;
  option_item jsonb;
  new_question_id uuid;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Only an admin can edit assessment questions';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.assessments WHERE id = target_assessment_id) THEN
    RAISE EXCEPTION 'Assessment not found';
  END IF;

  DELETE FROM public.assessment_questions WHERE assessment_id = target_assessment_id;

  FOR question_item IN SELECT value FROM jsonb_array_elements(COALESCE(questions, '[]'::jsonb))
  LOOP
    INSERT INTO public.assessment_questions (
      assessment_id, section_title, section_instructions, section_order, prompt, kind,
      picture_text, picture_url, passage_title, passage, listening_script, marks, sort_order,
      minimum_words, accepted_answers, model_answer, word_bank, required_phrases, guidance
    ) VALUES (
      target_assessment_id,
      COALESCE(NULLIF(question_item ->> 'sectionTitle', ''), 'Questions'),
      NULLIF(question_item ->> 'sectionInstructions', ''),
      COALESCE((question_item ->> 'sectionOrder')::integer, 1),
      question_item ->> 'prompt',
      question_item ->> 'kind',
      NULLIF(question_item ->> 'pictureText', ''),
      NULLIF(question_item ->> 'pictureUrl', ''),
      NULLIF(question_item ->> 'passageTitle', ''),
      NULLIF(question_item ->> 'passage', ''),
      NULLIF(question_item ->> 'listeningScript', ''),
      COALESCE((question_item ->> 'marks')::integer, 1),
      COALESCE((question_item ->> 'sortOrder')::integer, 0),
      NULLIF(question_item ->> 'minimumWords', '')::integer,
      ARRAY(SELECT jsonb_array_elements_text(COALESCE(question_item -> 'acceptedAnswers', '[]'::jsonb))),
      NULLIF(question_item ->> 'modelAnswer', ''),
      ARRAY(SELECT jsonb_array_elements_text(COALESCE(question_item -> 'wordBank', '[]'::jsonb))),
      COALESCE(question_item -> 'requiredPhrases', '[]'::jsonb),
      NULLIF(question_item ->> 'guidance', '')
    ) RETURNING id INTO new_question_id;

    FOR option_item IN SELECT value FROM jsonb_array_elements(COALESCE(question_item -> 'options', '[]'::jsonb))
    LOOP
      INSERT INTO public.assessment_options (question_id, label, is_correct, sort_order)
      VALUES (
        new_question_id,
        option_item ->> 'label',
        COALESCE((option_item ->> 'isCorrect')::boolean, false),
        COALESCE((option_item ->> 'sortOrder')::integer, 0)
      );
    END LOOP;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_assessment_for_learner(target_assessment_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  assessment_row public.assessments%ROWTYPE;
  questions jsonb;
BEGIN
  SELECT * INTO assessment_row FROM public.assessments WHERE id = target_assessment_id;
  IF NOT FOUND OR NOT assessment_row.is_published OR NOT assessment_row.is_active THEN
    RAISE EXCEPTION 'This assessment is not available';
  END IF;
  IF NOT public.user_can_read_course_attachment(assessment_row.course_id) THEN
    RAISE EXCEPTION 'Enroll in this program before opening the assessment';
  END IF;

  SELECT COALESCE(jsonb_agg(question_json ORDER BY section_order, sort_order), '[]'::jsonb)
  INTO questions
  FROM (
    SELECT
      question.section_order,
      question.sort_order,
      jsonb_build_object(
        'id', question.id,
        'sectionTitle', question.section_title,
        'sectionInstructions', question.section_instructions,
        'sectionOrder', question.section_order,
        'prompt', question.prompt,
        'kind', question.kind,
        'pictureText', question.picture_text,
        'pictureUrl', question.picture_url,
        'passageTitle', question.passage_title,
        'passage', question.passage,
        'listeningScript', question.listening_script,
        'marks', question.marks,
        'sortOrder', question.sort_order,
        'wordBank', COALESCE(to_jsonb(question.word_bank), '[]'::jsonb),
        'options', COALESCE((
          SELECT jsonb_agg(jsonb_build_object('id', option.id, 'label', option.label) ORDER BY option.sort_order)
          FROM public.assessment_options AS option
          WHERE option.question_id = question.id
        ), '[]'::jsonb)
      ) AS question_json
    FROM public.assessment_questions AS question
    WHERE question.assessment_id = target_assessment_id
  ) AS ordered_questions;

  RETURN jsonb_build_object(
    'assessment', jsonb_build_object(
      'id', assessment_row.id,
      'title', assessment_row.title,
      'description', assessment_row.description,
      'instructions', assessment_row.instructions,
      'durationMinutes', assessment_row.duration_minutes,
      'passingScore', assessment_row.passing_score,
      'showFeedback', assessment_row.show_feedback,
      'allowReview', assessment_row.allow_review
    ),
    'questions', questions
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.assessment_response_is_correct(
  question_row public.assessment_questions,
  response text
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  option_correct boolean;
BEGIN
  IF question_row.kind IN ('choice', 'listening', 'match') THEN
    SELECT is_correct INTO option_correct
    FROM public.assessment_options
    WHERE id::text = response AND question_id = question_row.id;
    RETURN COALESCE(option_correct, false);
  ELSIF question_row.kind = 'blank' THEN
    RETURN EXISTS (
      SELECT 1 FROM unnest(COALESCE(question_row.accepted_answers, ARRAY[]::text[])) AS accepted
      WHERE public.normalize_assessment_text(accepted) = public.normalize_assessment_text(response)
    );
  ELSIF question_row.kind = 'order' THEN
    RETURN public.normalize_assessment_text(response) = public.normalize_assessment_text(COALESCE(question_row.model_answer, ''));
  ELSIF question_row.kind = 'written' THEN
    RETURN public.written_answer_meets_rules(response, question_row.minimum_words, question_row.required_phrases);
  END IF;
  RETURN false;
END;
$$;

CREATE OR REPLACE FUNCTION public.check_assessment_answer(
  target_question_id uuid,
  response text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  question_row public.assessment_questions%ROWTYPE;
  assessment_row public.assessments%ROWTYPE;
BEGIN
  SELECT * INTO question_row FROM public.assessment_questions WHERE id = target_question_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Question not found';
  END IF;
  SELECT * INTO assessment_row FROM public.assessments WHERE id = question_row.assessment_id;
  IF NOT assessment_row.show_feedback OR NOT assessment_row.is_published OR NOT assessment_row.is_active THEN
    RAISE EXCEPTION 'Feedback is not available for this assessment';
  END IF;
  IF NOT public.user_can_read_course_attachment(assessment_row.course_id) THEN
    RAISE EXCEPTION 'Enroll in this program before answering';
  END IF;
  RETURN public.assessment_response_is_correct(question_row, response);
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

  RETURN jsonb_build_object(
    'attemptId', attempt_id,
    'score', earned,
    'totalMarks', possible,
    'passed', passed,
    'passingScore', assessment_row.passing_score,
    'results', CASE WHEN assessment_row.allow_review THEN result_items ELSE '[]'::jsonb END
  );
END;
$$;

REVOKE ALL ON FUNCTION public.normalize_assessment_text(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.assessment_word_count(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.written_answer_meets_rules(text, integer, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.assessment_response_is_correct(public.assessment_questions, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.replace_assessment_questions(uuid, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_assessment_for_learner(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.check_assessment_answer(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.submit_assessment_attempt(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.replace_assessment_questions(uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_assessment_for_learner(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_assessment_answer(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_assessment_attempt(uuid, jsonb) TO authenticated;
