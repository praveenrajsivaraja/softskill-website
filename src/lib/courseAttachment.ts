import { supabase } from '@/integrations/supabase/client';
import { chooseCourseAttachments, type CourseAttachmentRecord } from '@/lib/courseAttachmentLink';

export type { CourseAttachmentRecord as PaidCourseAttachment } from '@/lib/courseAttachmentLink';
export { buildAttachmentDownloadUrl, isGoogleDriveAttachmentUrl } from '@/lib/courseAttachmentLink';

const toPaidAttachments = (
  rows: Array<{ course_id?: string; id?: string; attachment_name: string | null; attachment_url: string | null }>,
): CourseAttachmentRecord[] => {
  return rows.flatMap((row) => {
    const courseId = row.course_id ?? row.id;
    const attachmentUrl = row.attachment_url?.trim() ?? '';
    if (!courseId || !attachmentUrl) {
      return [];
    }
    return [{
      courseId,
      attachmentName: row.attachment_name,
      attachmentUrl,
    }];
  });
};

export const isAttachmentTableMissing = (error: { code?: string; message?: string } | null): boolean => {
  if (!error) {
    return false;
  }
  return error.code === '42P01'
    || error.code === 'PGRST205'
    || error.message.includes('course_attachments');
};

const readAccessibleCourseIds = async (userId: string, courseIds: string[]): Promise<string[]> => {
  const [ordersResult, enrollmentsResult] = await Promise.all([
    supabase
      .from('orders')
      .select('order_items!inner(course_id)')
      .eq('user_id', userId)
      .in('status', ['confirmed', 'completed'])
      .in('order_items.course_id', courseIds),
    supabase
      .from('enrollments')
      .select('course_id')
      .eq('student_id', userId)
      .in('status', ['enrolled', 'completed'])
      .in('course_id', courseIds),
  ]);

  const paidCourseIds = ordersResult.error || !ordersResult.data
    ? []
    : ordersResult.data.flatMap((order) => order.order_items.map((item) => item.course_id));
  const enrolledCourseIds = enrollmentsResult.error || !enrollmentsResult.data
    ? []
    : enrollmentsResult.data.flatMap((enrollment) => enrollment.course_id ? [enrollment.course_id] : []);

  if (ordersResult.error) {
    console.error(JSON.stringify({
      event: 'paid_order_lookup_failed',
      code: ordersResult.error.code,
      message: ordersResult.error.message,
    }));
  }
  if (enrollmentsResult.error) {
    console.error(JSON.stringify({
      event: 'enrollment_lookup_failed',
      code: enrollmentsResult.error.code,
      message: enrollmentsResult.error.message,
    }));
  }

  return [...new Set([...paidCourseIds, ...enrolledCourseIds])];
};

const readCourseColumnAttachments = async (courseIds: string[]): Promise<CourseAttachmentRecord[]> => {
  if (courseIds.length === 0) {
    return [];
  }

  const { data, error } = await supabase
    .from('courses')
    .select('id, attachment_name, attachment_url')
    .in('id', courseIds);

  if (error || !data) {
    if (error) {
      console.error(JSON.stringify({
        event: 'course_attachment_column_read_failed',
        code: error.code,
        message: error.message,
      }));
    }
    return [];
  }

  return toPaidAttachments(data);
};

export const fetchPaidCourseAttachments = async (courseIds: string[]): Promise<CourseAttachmentRecord[]> => {
  const uniqueCourseIds = [...new Set(courseIds.filter(Boolean))];
  if (uniqueCourseIds.length === 0) {
    return [];
  }

  const { data: userData } = await supabase.auth.getUser();
  const sessionUserId = userData.user?.id ?? (await supabase.auth.getSession()).data.session?.user.id;
  if (!sessionUserId) {
    return [];
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', sessionUserId)
    .maybeSingle();

  const accessibleCourseIds = profile?.role === 'admin'
    ? uniqueCourseIds
    : await readAccessibleCourseIds(sessionUserId, uniqueCourseIds);

  if (accessibleCourseIds.length === 0) {
    return [];
  }

  const { data, error } = await supabase
    .from('course_attachments')
    .select('course_id, attachment_name, attachment_url')
    .in('course_id', accessibleCourseIds);

  if (error && !isAttachmentTableMissing(error)) {
    console.error(JSON.stringify({
      event: 'course_attachment_read_failed',
      code: error.code,
      message: error.message,
    }));
  }

  const protectedAttachments = error ? [] : toPaidAttachments(data ?? []);
  const foundCourseIds = new Set(protectedAttachments.map((attachment) => attachment.courseId));
  const missingCourseIds = accessibleCourseIds.filter((courseId) => !foundCourseIds.has(courseId));
  if (missingCourseIds.length === 0) {
    return protectedAttachments;
  }

  const courseColumnAttachments = await readCourseColumnAttachments(missingCourseIds);
  return chooseCourseAttachments(protectedAttachments, courseColumnAttachments);
};
