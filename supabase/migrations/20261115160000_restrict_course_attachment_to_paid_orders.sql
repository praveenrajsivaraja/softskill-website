-- The Drive link is readable only after a confirmed or completed order.
-- Admins can still add and update the link.

CREATE TABLE IF NOT EXISTS public.course_attachments (
  course_id uuid PRIMARY KEY REFERENCES public.courses(id) ON DELETE CASCADE,
  attachment_name text,
  attachment_url text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.course_attachments ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'courses'
      AND column_name = 'attachment_url'
  ) THEN
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
  END IF;
END $$;

DROP POLICY IF EXISTS "Paid students can download course attachments" ON public.course_attachments;
CREATE POLICY "Paid students can download course attachments"
  ON public.course_attachments
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.orders AS paid_order
      JOIN public.order_items AS paid_item ON paid_item.order_id = paid_order.id
      WHERE paid_item.course_id = course_attachments.course_id
        AND paid_order.user_id = auth.uid()
        AND paid_order.status IN ('confirmed', 'completed')
    )
  );

DROP POLICY IF EXISTS "Admins can manage course attachments" ON public.course_attachments;
CREATE POLICY "Admins can manage course attachments"
  ON public.course_attachments
  FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

REVOKE ALL ON TABLE public.course_attachments FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.course_attachments TO authenticated;
GRANT ALL ON TABLE public.course_attachments TO service_role;
