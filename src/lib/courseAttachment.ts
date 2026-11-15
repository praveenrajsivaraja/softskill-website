const googleDriveHosts = new Set(['drive.google.com', 'docs.google.com']);

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
