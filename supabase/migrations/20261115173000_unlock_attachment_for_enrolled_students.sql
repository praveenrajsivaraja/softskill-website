-- Buyers are enrolled after checkout. Let that enrollment read the Drive link,
-- and move any link still stored on the public course row into the protected table.

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

DROP POLICY IF EXISTS "Paid students can download course attachments" ON public.course_attachments;
CREATE POLICY "Paid students can download course attachments"
  ON public.course_attachments
  FOR SELECT
  TO authenticated
  USING (public.user_can_read_course_attachment(course_id));

INSERT INTO public.course_attachments (course_id, attachment_name, attachment_url)
SELECT course.id, course.attachment_name, btrim(course.attachment_url)
FROM public.courses AS course
WHERE course.attachment_url IS NOT NULL
  AND btrim(course.attachment_url) <> ''
ON CONFLICT (course_id) DO UPDATE
  SET attachment_name = EXCLUDED.attachment_name,
      attachment_url = EXCLUDED.attachment_url,
      updated_at = now();

UPDATE public.courses
SET attachment_url = NULL,
    attachment_name = NULL,
    updated_at = now()
WHERE attachment_url IS NOT NULL
   OR attachment_name IS NOT NULL;
