-- Admins can remove a course that still has orders, cart rows, or assessment attempts.
-- Those child tables either block the delete or hide the cascading rows from the admin role.

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.courses TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.enrollments TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.payments TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.order_items TO authenticated;
GRANT DELETE ON TABLE public.assessment_attempts TO authenticated;

DROP POLICY IF EXISTS "Admins delete assessment attempts" ON public.assessment_attempts;
CREATE POLICY "Admins delete assessment attempts"
  ON public.assessment_attempts
  FOR DELETE
  TO authenticated
  USING (public.is_admin(auth.uid()));

ALTER TABLE public.order_items DROP CONSTRAINT IF EXISTS order_items_course_id_fkey;
ALTER TABLE public.order_items
  ADD CONSTRAINT order_items_course_id_fkey
  FOREIGN KEY (course_id) REFERENCES public.courses(id) ON DELETE CASCADE;

DROP POLICY IF EXISTS "Admins can delete order items" ON public.order_items;
CREATE POLICY "Admins can delete order items"
  ON public.order_items
  FOR DELETE
  TO authenticated
  USING (public.is_admin(auth.uid()));

DO $$
DECLARE
  cart_constraint text;
BEGIN
  IF to_regclass('public.cart_items') IS NULL THEN
    RETURN;
  END IF;

  SELECT constraint_row.conname
  INTO cart_constraint
  FROM pg_constraint AS constraint_row
  JOIN pg_class AS relation ON relation.oid = constraint_row.conrelid
  JOIN pg_namespace AS schema_namespace ON schema_namespace.oid = relation.relnamespace
  WHERE schema_namespace.nspname = 'public'
    AND relation.relname = 'cart_items'
    AND constraint_row.contype = 'f'
    AND pg_get_constraintdef(constraint_row.oid) ILIKE '%courses%';

  IF cart_constraint IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.cart_items DROP CONSTRAINT %I', cart_constraint);
    ALTER TABLE public.cart_items
      ADD CONSTRAINT cart_items_course_id_fkey
      FOREIGN KEY (course_id) REFERENCES public.courses(id) ON DELETE CASCADE;
  END IF;

  GRANT DELETE ON TABLE public.cart_items TO authenticated;

  IF EXISTS (
    SELECT 1
    FROM pg_class AS relation
    JOIN pg_namespace AS schema_namespace ON schema_namespace.oid = relation.relnamespace
    WHERE schema_namespace.nspname = 'public'
      AND relation.relname = 'cart_items'
      AND relation.relrowsecurity
  ) THEN
    DROP POLICY IF EXISTS "Admins can delete cart items" ON public.cart_items;
    CREATE POLICY "Admins can delete cart items"
      ON public.cart_items
      FOR DELETE
      TO authenticated
      USING (public.is_admin(auth.uid()));
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.admin_delete_course(target_course_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Only an admin can delete a course';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.courses WHERE id = target_course_id) THEN
    RAISE EXCEPTION 'Course not found';
  END IF;

  IF to_regclass('public.assessments') IS NOT NULL THEN
    IF to_regclass('public.assessment_attempts') IS NOT NULL THEN
      DELETE FROM public.assessment_attempts
      WHERE assessment_id IN (
        SELECT assessment.id
        FROM public.assessments AS assessment
        WHERE assessment.course_id = target_course_id
      );
    END IF;

    IF to_regclass('public.assessment_options') IS NOT NULL
       AND to_regclass('public.assessment_questions') IS NOT NULL THEN
      DELETE FROM public.assessment_options
      WHERE question_id IN (
        SELECT question.id
        FROM public.assessment_questions AS question
        JOIN public.assessments AS assessment ON assessment.id = question.assessment_id
        WHERE assessment.course_id = target_course_id
      );
    END IF;

    IF to_regclass('public.assessment_questions') IS NOT NULL THEN
      DELETE FROM public.assessment_questions
      WHERE assessment_id IN (
        SELECT assessment.id
        FROM public.assessments AS assessment
        WHERE assessment.course_id = target_course_id
      );
    END IF;

    DELETE FROM public.assessments
    WHERE course_id = target_course_id;
  END IF;

  IF to_regclass('public.order_items') IS NOT NULL THEN
    DELETE FROM public.order_items
    WHERE course_id = target_course_id;
  END IF;

  IF to_regclass('public.cart_items') IS NOT NULL THEN
    DELETE FROM public.cart_items
    WHERE course_id = target_course_id;
  END IF;

  IF to_regclass('public.payments') IS NOT NULL THEN
    DELETE FROM public.payments
    WHERE course_id = target_course_id;
  END IF;

  IF to_regclass('public.enrollments') IS NOT NULL THEN
    DELETE FROM public.enrollments
    WHERE course_id = target_course_id;
  END IF;

  IF to_regclass('public.course_documents') IS NOT NULL THEN
    DELETE FROM public.course_documents
    WHERE course_id = target_course_id;
  END IF;

  IF to_regclass('public.course_attachments') IS NOT NULL THEN
    DELETE FROM public.course_attachments
    WHERE course_id = target_course_id;
  END IF;

  IF to_regclass('public.course_contents') IS NOT NULL
     AND to_regclass('public.course_sections') IS NOT NULL THEN
    DELETE FROM public.course_contents
    WHERE section_id IN (
      SELECT section.id
      FROM public.course_sections AS section
      WHERE section.course_id = target_course_id
    );
  END IF;

  IF to_regclass('public.course_sections') IS NOT NULL THEN
    DELETE FROM public.course_sections
    WHERE course_id = target_course_id;
  END IF;

  DELETE FROM public.courses
  WHERE id = target_course_id;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_delete_course(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_delete_course(uuid) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
