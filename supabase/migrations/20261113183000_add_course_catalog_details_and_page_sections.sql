-- Course details and career-test copy live in the database so admin can edit them.

ALTER TABLE public.courses
  ADD COLUMN IF NOT EXISTS course_type text NOT NULL DEFAULT 'course',
  ADD COLUMN IF NOT EXISTS highlights text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS learning_points text[] NOT NULL DEFAULT '{}';

ALTER TABLE public.courses DROP CONSTRAINT IF EXISTS courses_course_type_check;
ALTER TABLE public.courses
  ADD CONSTRAINT courses_course_type_check
  CHECK (course_type IN ('course', 'career_test'));

UPDATE public.courses
SET course_type = 'career_test'
WHERE id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
   OR title ILIKE '%MBTI%'
   OR title ILIKE '%career personality%';

UPDATE public.courses
SET highlights = ARRAY['48 Questions', 'Instant Results', 'Career Recommendations']
WHERE course_type = 'career_test'
  AND cardinality(highlights) = 0;

UPDATE public.courses
SET learning_points = ARRAY[
  'Detailed report of personality, skills, and career matches',
  'Career recommendations ranked by compatibility',
  'Learning path based on your personality type'
]
WHERE course_type = 'career_test'
  AND cardinality(learning_points) = 0;

CREATE TABLE IF NOT EXISTS public.page_sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  page_key text NOT NULL,
  section_key text NOT NULL,
  title text,
  description text,
  order_index integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.page_sections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view active page sections" ON public.page_sections;
CREATE POLICY "Anyone can view active page sections"
  ON public.page_sections
  FOR SELECT
  USING (is_active = true);

DROP POLICY IF EXISTS "Admins can manage page sections" ON public.page_sections;
CREATE POLICY "Admins can manage page sections"
  ON public.page_sections
  FOR ALL
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

GRANT SELECT ON public.page_sections TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.page_sections TO authenticated;

INSERT INTO public.page_sections (page_key, section_key, title, description, order_index)
SELECT seed.page_key, seed.section_key, seed.title, seed.description, seed.order_index
FROM (
  VALUES
    ('career_test', 'hero', 'Discover Your Perfect Career', 'Take our comprehensive MBTI personality assessment to find the career path that aligns with your strengths, interests, and aspirations', 0),
    ('career_test', 'feature', 'Personality Analysis', 'Understand your unique traits and work style preferences', 1),
    ('career_test', 'feature', 'Skills Assessment', 'Identify your strengths and areas for development', 2),
    ('career_test', 'feature', 'Interest Matching', 'Find careers that align with your passions and interests', 3),
    ('career_test', 'feature', 'Growth Roadmap', 'Get a personalized plan for your career development', 4),
    ('career_test', 'benefit', 'Detailed Report', 'Comprehensive analysis of your personality, skills, and career matches', 1),
    ('career_test', 'benefit', 'Career Recommendations', 'Top career options ranked by compatibility with your profile', 2),
    ('career_test', 'benefit', 'Learning Path', 'Skill development recommendations based on your personality type', 3),
    ('career_test', 'cta', 'Ready to Discover Your Future?', 'Open a career test to review the details and enroll', 0)
) AS seed(page_key, section_key, title, description, order_index)
WHERE NOT EXISTS (
  SELECT 1 FROM public.page_sections WHERE page_key = 'career_test'
);
