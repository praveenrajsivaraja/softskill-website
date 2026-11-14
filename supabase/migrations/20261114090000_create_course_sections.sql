-- The live database has courses but is missing the curriculum tables.

CREATE TABLE IF NOT EXISTS public.course_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  order_index INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.course_contents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  section_id UUID NOT NULL REFERENCES public.course_sections(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  type TEXT NOT NULL,
  content_url TEXT,
  description TEXT,
  order_index INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.course_contents DROP CONSTRAINT IF EXISTS course_contents_type_check;
ALTER TABLE public.course_contents
  ADD CONSTRAINT course_contents_type_check
  CHECK (type IN ('video', 'document', 'quiz', 'text', 'image', 'link'));

CREATE INDEX IF NOT EXISTS idx_course_sections_course_id ON public.course_sections(course_id);
CREATE INDEX IF NOT EXISTS idx_course_sections_order ON public.course_sections(course_id, order_index);
CREATE INDEX IF NOT EXISTS idx_course_contents_section_id ON public.course_contents(section_id);
CREATE INDEX IF NOT EXISTS idx_course_contents_order ON public.course_contents(section_id, order_index);

ALTER TABLE public.course_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_contents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view course sections" ON public.course_sections;
CREATE POLICY "Anyone can view course sections"
  ON public.course_sections
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Admins can manage course sections" ON public.course_sections;
CREATE POLICY "Admins can manage course sections"
  ON public.course_sections
  FOR ALL
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Anyone can view course contents" ON public.course_contents;
CREATE POLICY "Anyone can view course contents"
  ON public.course_contents
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Admins can manage course contents" ON public.course_contents;
CREATE POLICY "Admins can manage course contents"
  ON public.course_contents
  FOR ALL
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

GRANT SELECT ON public.course_sections TO anon, authenticated;
GRANT SELECT ON public.course_contents TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.course_sections TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.course_contents TO authenticated;
