const googleDriveHosts = new Set([
  'drive.google.com',
  'docs.google.com',
  'drive.usercontent.google.com',
]);

const bareHost = (hostname: string) => hostname.toLowerCase().replace(/^www\./, '');

const isAcceptedGoogleHost = (hostname: string) => {
  const host = bareHost(hostname);
  return googleDriveHosts.has(host)
    || host === 'googleusercontent.com'
    || host.endsWith('.googleusercontent.com');
};

const normalizeGoogleLink = (value: string) => {
  let candidate = value.trim();
  if (/^(drive|docs)\.google\.com\//i.test(candidate)) {
    candidate = `https://${candidate}`;
  }

  try {
    const url = new URL(candidate);
    const host = bareHost(url.hostname);
    const innerLink = url.searchParams.get('q') || url.searchParams.get('url') || url.searchParams.get('imgurl');
    if ((host === 'google.com' || host.endsWith('.google.com')) && innerLink && (url.pathname === '/url' || url.pathname === '/imgres')) {
      return normalizeGoogleLink(innerLink);
    }
    return url.toString();
  } catch {
    return candidate;
  }
};

export interface CourseAttachmentRecord {
  courseId: string;
  attachmentName: string | null;
  attachmentUrl: string;
}

export const chooseCourseAttachments = <T extends { courseId: string }>(
  protectedAttachments: T[],
  courseColumnAttachments: T[],
): T[] => {
  const protectedCourseIds = new Set(protectedAttachments.map((attachment) => attachment.courseId));
  return [
    ...protectedAttachments,
    ...courseColumnAttachments.filter((attachment) => !protectedCourseIds.has(attachment.courseId)),
  ];
};

type DriveFileKind = 'file' | 'document' | 'spreadsheet' | 'presentation';

const isGoogleHost = (value: string): URL | null => {
  try {
    const url = new URL(normalizeGoogleLink(value));
    if (url.protocol !== 'https:' || !isAcceptedGoogleHost(url.hostname)) {
      return null;
    }
    return url;
  } catch {
    return null;
  }
};

export const isGoogleDriveAttachmentUrl = (value: string): boolean => {
  return isGoogleHost(value) !== null;
};

const readDriveFile = (url: URL): { id: string; kind: DriveFileKind; isPublished: boolean } | null => {
  const pathPatterns: Array<{ kind: DriveFileKind; pattern: RegExp }> = [
    { kind: 'file', pattern: /\/file\/(?:u\/\d+\/)?d\/([a-zA-Z0-9_-]+)/ },
    { kind: 'document', pattern: /\/document\/(?:u\/\d+\/)?d\/(?:e\/)?([a-zA-Z0-9_-]+)/ },
    { kind: 'spreadsheet', pattern: /\/spreadsheets\/(?:u\/\d+\/)?d\/(?:e\/)?([a-zA-Z0-9_-]+)/ },
    { kind: 'presentation', pattern: /\/presentation\/(?:u\/\d+\/)?d\/(?:e\/)?([a-zA-Z0-9_-]+)/ },
  ];

  for (const pathPattern of pathPatterns) {
    const match = url.pathname.match(pathPattern.pattern);
    if (match) {
      return { id: match[1], kind: pathPattern.kind, isPublished: /\/d\/e\//.test(url.pathname) };
    }
  }

  const queryId = url.searchParams.get('id');
  if (queryId && /^[a-zA-Z0-9_-]+$/.test(queryId)) {
    return { id: queryId, kind: 'file', isPublished: false };
  }

  if (bareHost(url.hostname).endsWith('googleusercontent.com')) {
    const hostedFile = url.pathname.match(/\/d\/([a-zA-Z0-9_-]+)/);
    if (hostedFile) {
      return { id: hostedFile[1], kind: 'file', isPublished: false };
    }
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

export interface MonthDocumentGroup<T extends { monthIndex: number; sortOrder: number }> {
  monthIndex: number;
  documents: T[];
}

export const groupDocumentsByMonth = <T extends { monthIndex: number; sortOrder: number }>(
  documents: T[],
): MonthDocumentGroup<T>[] => {
  const groups = new Map<number, T[]>();
  for (const document of documents) {
    const monthDocuments = groups.get(document.monthIndex) ?? [];
    monthDocuments.push(document);
    groups.set(document.monthIndex, monthDocuments);
  }

  return [...groups.entries()]
    .sort(([leftMonth], [rightMonth]) => leftMonth - rightMonth)
    .map(([monthIndex, monthDocuments]) => ({
      monthIndex,
      documents: [...monthDocuments].sort((left, right) => left.sortOrder - right.sortOrder),
    }));
};

const readDriveFileFromText = (value: string) => {
  const url = isGoogleHost(value.trim());
  if (!url) {
    return null;
  }
  return readDriveFile(url);
};

export const assessmentPictureSources = (pictureUrl: string | null | undefined): string[] => {
  const trimmedUrl = pictureUrl?.trim() ?? '';
  if (!trimmedUrl) {
    return [];
  }

  const normalizedUrl = normalizeGoogleLink(trimmedUrl);
  const parsedUrl = isGoogleHost(normalizedUrl);
  if (parsedUrl && bareHost(parsedUrl.hostname).endsWith('googleusercontent.com')) {
    return [parsedUrl.toString()];
  }

  const driveFile = parsedUrl ? readDriveFile(parsedUrl) : null;
  if (!driveFile) {
    return [normalizedUrl.startsWith('http') ? normalizedUrl : trimmedUrl];
  }

  const thumbnail = `https://drive.google.com/thumbnail?id=${driveFile.id}&sz=w1000`;
  if (driveFile.kind !== 'file') {
    return [thumbnail];
  }

  return [
    `https://lh3.googleusercontent.com/d/${driveFile.id}`,
    thumbnail,
  ];
};

export const buildDocumentPreviewImageUrl = (
  driveUrl: string,
  previewImageUrl?: string | null,
): string | null => {
  const customPreview = previewImageUrl?.trim() ?? '';
  if (customPreview) {
    const previewSource = assessmentPictureSources(customPreview)[0];
    if (previewSource && (previewSource.startsWith('https://') || previewSource.startsWith('http://') || previewSource.startsWith('/'))) {
      return previewSource;
    }
  }

  const driveFile = readDriveFileFromText(driveUrl);
  if (!driveFile) {
    return null;
  }

  return `https://drive.google.com/thumbnail?id=${driveFile.id}&sz=w800`;
};

export const buildDocumentEmbedUrl = (driveUrl: string): string | null => {
  const trimmedUrl = driveUrl.trim();
  const driveFile = readDriveFileFromText(trimmedUrl);
  if (!driveFile) {
    return isGoogleHost(trimmedUrl) ? trimmedUrl : null;
  }

  if (driveFile.kind === 'document') {
    return `https://docs.google.com/document/d/${driveFile.id}/preview`;
  }
  if (driveFile.kind === 'spreadsheet') {
    return `https://docs.google.com/spreadsheets/d/${driveFile.id}/preview`;
  }
  if (driveFile.kind === 'presentation') {
    // A published deck uses the slideshow player. Any other Slides link, including
    // an address-bar link with /u/0/, uses /preview so a file already opened in
    // Drive can render with the current Google session.
    if (driveFile.isPublished) {
      return `https://docs.google.com/presentation/d/e/${driveFile.id}/embed?start=false&loop=false&delayms=3000`;
    }
    return `https://docs.google.com/presentation/d/${driveFile.id}/preview`;
  }

  return `https://drive.google.com/file/d/${driveFile.id}/preview`;
};
