import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { buildAttachmentDownloadUrl } from '@/lib/courseAttachment';

interface ProgramAttachmentDownloadProps {
  attachmentUrl: string | null | undefined;
  attachmentName?: string | null;
  className?: string;
}

const ProgramAttachmentDownload = ({
  attachmentUrl,
  attachmentName,
  className,
}: ProgramAttachmentDownloadProps) => {
  const downloadUrl = buildAttachmentDownloadUrl(attachmentUrl);
  if (!downloadUrl) {
    return null;
  }

  const label = attachmentName?.trim() || 'Download attachment';

  return (
    <Button asChild variant="outline" size="sm" className={className}>
      <a href={downloadUrl} target="_blank" rel="noopener noreferrer">
        <Download className="h-4 w-4 mr-2" />
        {label}
      </a>
    </Button>
  );
};

export default ProgramAttachmentDownload;
