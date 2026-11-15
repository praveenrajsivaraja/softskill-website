import { supabase } from '@/integrations/supabase/client';

const googleDriveHosts = new Set(['drive.google.com', 'docs.google.com']);

export interface PaidCourseAttachment {
  courseId: string;
  attachmentName: string | null;
  attachmentUrl: string;
}

const toPaidAttachments = (
  rows: Array<{ course_id?: string; id?: string; attachment_name: string | null; attachment_url: string | null }>,
): PaidCourseAttachment[] => {
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

const readPaidCourseIds = async (userId: string, courseIds: string[]): Promise<string[]> => {
  const { data, error } = await supabase
    .from('orders')
    .select('order_items!inner(course_id)')
    .eq('user_id', userId)
    .in('status', ['confirmed', 'completed'])
    .in('order_items.course_id', courseIds);

  if (error || !data) {
    return [];
  }

  return data.flatMap((order) => order.order_items.map((item) => item.course_id));
};

const readCourseColumnAttachments = async (courseIds: string[]): Promise<PaidCourseAttachment[]> => {
  const { data, error } = await supabase
    .from('courses')
    .select('id, attachment_name, attachment_url')
    .in('id', courseIds);

  if (error || !data) {
    return [];
  }

  return toPaidAttachments(data);
};

export const fetchPaidCourseAttachments = async (courseIds: string[]): Promise<PaidCourseAttachment[]> => {
  const uniqueCourseIds = [...new Set(courseIds.filter(Boolean))];
  if (uniqueCourseIds.length === 0) {
    return [];
  }

  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) {
    return [];
  }

  const { data, error } = await supabase
    .from('course_attachments')
    .select('course_id, attachment_name, attachment_url')
    .in('course_id', uniqueCourseIds);

  if (!error) {
    return toPaidAttachments(data ?? []);
  }

  if (!isAttachmentTableMissing(error)) {
    return [];
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .maybeSingle();

  const courseIdsToRead = profile?.role === 'admin'
    ? uniqueCourseIds
    : await readPaidCourseIds(userId, uniqueCourseIds);

  return readCourseColumnAttachments(courseIdsToRead);
};

type DriveFileKind = 'file' | 'document' | 'spreadsheet' | 'presentation';

const isGoogleHost = (value: string): URL | null => {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || !googleDriveHosts.has(url.hostname)) {
      return null;
    }
    return url;
  } catch {
    return null;
  }
};

export const isGoogleDriveAttachmentUrl = (value: string): boolean => {
  return isGoogleHost(value.trim()) !== null;
};

const readDriveFile = (url: URL): { id: string; kind: DriveFileKind } | null => {
  const pathPatterns: Array<{ kind: DriveFileKind; pattern: RegExp }> = [
    { kind: 'file', pattern: /\/file\/d\/([a-zA-Z0-9_-]+)/ },
    { kind: 'document', pattern: /\/document\/d\/([a-zA-Z0-9_-]+)/ },
    { kind: 'spreadsheet', pattern: /\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/ },
    { kind: 'presentation', pattern: /\/presentation\/d\/([a-zA-Z0-9_-]+)/ },
  ];

  for (const pathPattern of pathPatterns) {
    const match = url.pathname.match(pathPattern.pattern);
    if (match) {
      return { id: match[1], kind: pathPattern.kind };
    }
  }

  const queryId = url.searchParams.get('id');
  if (queryId && /^[a-zA-Z0-9_-]+$/.test(queryId)) {
    return { id: queryId, kind: 'file' };
  }

  return null;
};

export const buildAttachmentDownloadUrl = (attachmentUrl: string | null | undefined): string | null => {
  const trimmedUrl = attachmentUrl?.trim() ?? '';
  const url = isGoogleHost(trimmedUrl);
  if (!url) {
    return null;
  }

  const driveFile = readDriveFile(url);
  if (!driveFile) {
    return trimmedUrl;
  }

  if (driveFile.kind === 'document') {
    return `https://docs.google.com/document/d/${driveFile.id}/export?format=pdf`;
  }
  if (driveFile.kind === 'spreadsheet') {
    return `https://docs.google.com/spreadsheets/d/${driveFile.id}/export?format=pdf`;
  }
  if (driveFile.kind === 'presentation') {
    return `https://docs.google.com/presentation/d/${driveFile.id}/export/pdf`;
  }

  return `https://drive.google.com/uc?export=download&id=${driveFile.id}`;
};
