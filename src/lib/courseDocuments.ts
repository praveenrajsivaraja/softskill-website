import { supabase } from '@/integrations/supabase/client';
import { fetchPaidCourseAttachments } from '@/lib/courseAttachment';
import { isGoogleDriveAttachmentUrl } from '@/lib/courseAttachmentLink';

export interface CourseMaterial {
  id: string;
  title: string;
  monthIndex: number;
  driveUrl: string;
  previewImageUrl: string | null;
  sortOrder: number;
}

export interface CourseDocumentDraft {
  key: string;
  title: string;
  monthIndex: string;
  driveUrl: string;
  previewImageUrl: string;
}

export interface SavedCourseDocument {
  title: string;
  monthIndex: number;
  driveUrl: string;
  previewImageUrl: string | null;
  sortOrder: number;
}

export const createDocumentDraft = (partial?: Partial<CourseDocumentDraft>): CourseDocumentDraft => ({
  key: partial?.key ?? crypto.randomUUID(),
  title: partial?.title ?? '',
  monthIndex: partial?.monthIndex ?? '1',
  driveUrl: partial?.driveUrl ?? '',
  previewImageUrl: partial?.previewImageUrl ?? '',
});

export const documentsReadyToSave = (
  drafts: CourseDocumentDraft[],
): { documents: SavedCourseDocument[] } | { error: string } => {
  const filledDrafts = drafts.filter((draft) =>
    draft.driveUrl.trim() || draft.title.trim() || draft.previewImageUrl.trim()
  );
  const documents: SavedCourseDocument[] = [];

  for (const [index, draft] of filledDrafts.entries()) {
    const driveUrl = draft.driveUrl.trim();
    if (!isGoogleDriveAttachmentUrl(driveUrl)) {
      return { error: 'Each document needs a Google Drive or Google Docs share link.' };
    }

    const monthIndex = Number(draft.monthIndex);
    if (!Number.isInteger(monthIndex) || monthIndex < 1 || monthIndex > 24) {
      return { error: 'Each document needs a month from 1 to 24.' };
    }

    const previewImageUrl = draft.previewImageUrl.trim();
    if (previewImageUrl && !previewImageUrl.startsWith('https://')) {
      return { error: 'A preview image must be an https link.' };
    }

    documents.push({
      title: draft.title.trim() || `Document ${index + 1}`,
      monthIndex,
      driveUrl,
      previewImageUrl: previewImageUrl || null,
      sortOrder: index,
    });
  }

  return { documents };
};

const isDocumentTableMissing = (error: { code?: string; message?: string } | null): boolean => {
  if (!error) {
    return false;
  }
  return error.code === '42P01'
    || error.code === 'PGRST205'
    || error.message.includes('course_documents');
};

const readCurrentUserId = async (): Promise<string | null> => {
  const { data: userData } = await supabase.auth.getUser();
  if (userData.user?.id) {
    return userData.user.id;
  }
  const { data: sessionData } = await supabase.auth.getSession();
  return sessionData.session?.user.id ?? null;
};

const userCanReadCourseMaterials = async (userId: string, courseId: string): Promise<boolean> => {
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .maybeSingle();

  if (profile?.role === 'admin') {
    return true;
  }

  const [enrollmentResult, orderResult] = await Promise.all([
    supabase
      .from('enrollments')
      .select('id')
      .eq('student_id', userId)
      .eq('course_id', courseId)
      .in('status', ['enrolled', 'completed'])
      .limit(1),
    supabase
      .from('orders')
      .select('id, order_items!inner(course_id)')
      .eq('user_id', userId)
      .in('status', ['confirmed', 'completed'])
      .eq('order_items.course_id', courseId)
      .limit(1),
  ]);

  if (enrollmentResult.error) {
    console.error(JSON.stringify({
      event: 'course_material_enrollment_lookup_failed',
      code: enrollmentResult.error.code,
      message: enrollmentResult.error.message,
    }));
  }
  if (orderResult.error) {
    console.error(JSON.stringify({
      event: 'course_material_order_lookup_failed',
      code: orderResult.error.code,
      message: orderResult.error.message,
    }));
  }

  return (enrollmentResult.data?.length ?? 0) > 0 || (orderResult.data?.length ?? 0) > 0;
};

const attachmentAsMaterial = (courseId: string, title: string | null, driveUrl: string): CourseMaterial => ({
  id: `attachment-${courseId}`,
  title: title?.trim() || 'Document',
  monthIndex: 1,
  driveUrl,
  previewImageUrl: null,
  sortOrder: 0,
});

export const fetchCourseMaterials = async (courseId: string): Promise<CourseMaterial[]> => {
  const userId = await readCurrentUserId();
  if (!userId || !await userCanReadCourseMaterials(userId, courseId)) {
    return [];
  }

  const { data, error } = await supabase
    .from('course_documents')
    .select('id, title, month_index, drive_url, preview_image_url, sort_order')
    .eq('course_id', courseId)
    .order('month_index', { ascending: true })
    .order('sort_order', { ascending: true });

  if (!error && data && data.length > 0) {
    return data.map((document) => ({
      id: document.id,
      title: document.title,
      monthIndex: document.month_index,
      driveUrl: document.drive_url,
      previewImageUrl: document.preview_image_url,
      sortOrder: document.sort_order,
    }));
  }

  if (error && !isDocumentTableMissing(error)) {
    console.error(JSON.stringify({
      event: 'course_document_read_failed',
      code: error.code,
      message: error.message,
    }));
  }

  const [attachment] = await fetchPaidCourseAttachments([courseId]);
  if (!attachment) {
    return [];
  }

  return [attachmentAsMaterial(courseId, attachment.attachmentName, attachment.attachmentUrl)];
};

export const fetchCourseDocumentDrafts = async (courseId: string): Promise<CourseDocumentDraft[] | null> => {
  const { data, error } = await supabase
    .from('course_documents')
    .select('id, title, month_index, drive_url, preview_image_url, sort_order')
    .eq('course_id', courseId)
    .order('month_index', { ascending: true })
    .order('sort_order', { ascending: true });

  if (error) {
    if (!isDocumentTableMissing(error)) {
      console.error(JSON.stringify({
        event: 'course_document_draft_read_failed',
        code: error.code,
        message: error.message,
      }));
    }
    return null;
  }

  return data.map((document) => createDocumentDraft({
    key: document.id,
    title: document.title,
    monthIndex: String(document.month_index),
    driveUrl: document.drive_url,
    previewImageUrl: document.preview_image_url ?? '',
  }));
};

const saveLegacyAttachment = async (courseId: string, document: SavedCourseDocument | undefined) => {
  if (!document) {
    const { error } = await supabase
      .from('course_attachments')
      .delete()
      .eq('course_id', courseId);
    if (error) {
      console.error(JSON.stringify({
        event: 'course_attachment_clear_failed',
        code: error.code,
        message: error.message,
      }));
    }
    return;
  }

  const { error } = await supabase
    .from('course_attachments')
    .upsert({
      course_id: courseId,
      attachment_name: document.title,
      attachment_url: document.driveUrl,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'course_id' });

  if (error) {
    console.error(JSON.stringify({
      event: 'course_attachment_sync_failed',
      code: error.code,
      message: error.message,
    }));
  }
};

export const saveCourseMaterials = async (courseId: string, documents: SavedCourseDocument[]) => {
  const { error: deleteError } = await supabase
    .from('course_documents')
    .delete()
    .eq('course_id', courseId);

  if (deleteError) {
    if (isDocumentTableMissing(deleteError)) {
      await saveLegacyAttachment(courseId, documents[0]);
      if (documents.length > 1) {
        throw new Error('Run the course document SQL in Supabase before saving more than one Google Drive link.');
      }
      return;
    }
    throw deleteError;
  }

  if (documents.length > 0) {
    const { error } = await supabase
      .from('course_documents')
      .insert(documents.map((document) => ({
        course_id: courseId,
        title: document.title,
        month_index: document.monthIndex,
        drive_url: document.driveUrl,
        preview_image_url: document.previewImageUrl,
        sort_order: document.sortOrder,
        updated_at: new Date().toISOString(),
      })));

    if (error) {
      throw error;
    }
  }

  await saveLegacyAttachment(courseId, documents[0]);
};
