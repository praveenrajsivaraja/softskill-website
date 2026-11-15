-- Buyers open course details and see one or more Drive documents, grouped by month.

CREATE TABLE IF NOT EXISTS public.course_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  title text NOT NULL,
  month_index integer NOT NULL DEFAULT 1 CHECK (month_index BETWEEN 1 AND 24),
  drive_url text NOT NULL,
  preview_image_url text,
  sort_order integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS course_documents_course_id_idx
  ON public.course_documents (course_id, month_index, sort_order);

ALTER TABLE public.course_documents ENABLE ROW LEVEL SECURITY;

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

REVOKE ALL ON FUNCTION public.user_can_read_course_attachment(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.user_can_read_course_attachment(uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS "Buyers can view course documents" ON public.course_documents;
CREATE POLICY "Buyers can view course documents"
  ON public.course_documents
  FOR SELECT
  TO authenticated
  USING (public.user_can_read_course_attachment(course_id));

DROP POLICY IF EXISTS "Admins can manage course documents" ON public.course_documents;
CREATE POLICY "Admins can manage course documents"
  ON public.course_documents
  FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

REVOKE ALL ON TABLE public.course_documents FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.course_documents TO authenticated;
GRANT ALL ON TABLE public.course_documents TO service_role;

INSERT INTO public.course_documents (course_id, title, month_index, drive_url, sort_order)
SELECT attachment.course_id,
       COALESCE(NULLIF(btrim(attachment.attachment_name), ''), 'Document'),
       1,
       btrim(attachment.attachment_url),
       0
FROM public.course_attachments AS attachment
WHERE btrim(attachment.attachment_url) <> ''
  AND NOT EXISTS (
    SELECT 1
    FROM public.course_documents AS existing_document
    WHERE existing_document.course_id = attachment.course_id
      AND existing_document.drive_url = btrim(attachment.attachment_url)
  );

INSERT INTO public.course_documents (course_id, title, month_index, drive_url, sort_order)
SELECT course.id,
       COALESCE(NULLIF(btrim(course.attachment_name), ''), 'Document'),
       1,
       btrim(course.attachment_url),
       0
FROM public.courses AS course
WHERE course.attachment_url IS NOT NULL
  AND btrim(course.attachment_url) <> ''
  AND NOT EXISTS (
    SELECT 1
    FROM public.course_documents AS existing_document
    WHERE existing_document.course_id = course.id
      AND existing_document.drive_url = btrim(course.attachment_url)
  );
