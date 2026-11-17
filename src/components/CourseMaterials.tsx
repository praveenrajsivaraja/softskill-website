import { useState } from 'react';
import { Download, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  buildAttachmentDownloadUrl,
  buildDocumentEmbedUrl,
  buildDocumentPreviewImageUrl,
  groupDocumentsByMonth,
} from '@/lib/courseAttachmentLink';
import type { CourseMaterial } from '@/lib/courseDocuments';
import ProgramAssessments from '@/components/ProgramAssessments';

interface CourseMaterialsProps {
  courseId: string;
  documents: CourseMaterial[];
  canUsePurchasedActions: boolean;
}

const documentPurchaseMessage = 'Purchase to open and download this document.';

const CourseMaterials = ({ courseId, documents, canUsePurchasedActions }: CourseMaterialsProps) => {
  const [openDocument, setOpenDocument] = useState<CourseMaterial | null>(null);
  const [failedPreviews, setFailedPreviews] = useState<Set<string>>(new Set());
  const monthGroups = groupDocumentsByMonth(documents);
  const embedUrl = openDocument ? buildDocumentEmbedUrl(openDocument.driveUrl) : null;
  const downloadUrl = openDocument ? buildAttachmentDownloadUrl(openDocument.driveUrl) : null;

  if (monthGroups.length === 0) {
    return (
      <section id="materials" className="container mx-auto px-4 pt-8 scroll-mt-24">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Course materials</h2>
        <p className="text-gray-600">Documents for this course will appear here, grouped by month.</p>
        <ProgramAssessments courseId={courseId} canStart={canUsePurchasedActions} />
      </section>
    );
  }

  return (
    <section id="materials" className="container mx-auto px-4 pt-8 scroll-mt-24">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Course materials</h2>
      <div className="space-y-8">
        {monthGroups.map((group) => (
          <div key={group.monthIndex}>
            <h3 className="text-lg font-semibold text-kiki-purple-700 mb-4">Month {group.monthIndex}</h3>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {group.documents.map((document) => {
                const previewUrl = failedPreviews.has(document.id)
                  ? null
                  : buildDocumentPreviewImageUrl(document.driveUrl, document.previewImageUrl);
                const documentDownloadUrl = buildAttachmentDownloadUrl(document.driveUrl);

                const preview = (
                  <>
                    <div className="aspect-[4/3] bg-kiki-purple-50 flex items-center justify-center">
                      {previewUrl ? (
                        <img
                          src={previewUrl}
                          alt=""
                          className="h-full w-full object-cover"
                          onError={() => {
                            setFailedPreviews((current) => new Set(current).add(document.id));
                          }}
                        />
                      ) : (
                        <FileText className="h-12 w-12 text-kiki-purple-400" />
                      )}
                    </div>
                    <div className="p-4">
                      <h4 className="font-semibold text-gray-900">{document.title}</h4>
                      <p className="text-sm text-kiki-purple-600 mt-1">
                        {canUsePurchasedActions ? 'Open document' : documentPurchaseMessage}
                      </p>
                    </div>
                  </>
                );

                return (
                  <article key={document.id} className="overflow-hidden rounded-xl border bg-white shadow-sm">
                    {canUsePurchasedActions ? (
                      <button
                        type="button"
                        className="block w-full text-left"
                        onClick={() => setOpenDocument(document)}
                      >
                        {preview}
                      </button>
                    ) : (
                      <div className="block w-full text-left">{preview}</div>
                    )}
                    {canUsePurchasedActions && documentDownloadUrl && (
                      <div className="px-4 pb-4">
                        <Button asChild variant="outline" size="sm">
                          <a href={documentDownloadUrl} target="_blank" rel="noopener noreferrer">
                            <Download className="h-4 w-4 mr-2" />
                            Download
                          </a>
                        </Button>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      <ProgramAssessments courseId={courseId} canStart={canUsePurchasedActions} />

      <Dialog open={openDocument !== null} onOpenChange={(isOpen) => { if (!isOpen) setOpenDocument(null); }}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>{openDocument?.title}</DialogTitle>
          </DialogHeader>
          {canUsePurchasedActions && embedUrl && (
            <iframe
              src={embedUrl}
              title={openDocument?.title ?? 'Course document'}
              className="h-[70vh] w-full rounded-md border"
            />
          )}
          {canUsePurchasedActions && (
          <DialogFooter className="gap-2 sm:justify-start">
            {downloadUrl && (
              <Button asChild>
                <a href={downloadUrl} target="_blank" rel="noopener noreferrer">
                  <Download className="h-4 w-4 mr-2" />
                  Download
                </a>
              </Button>
            )}
            {openDocument && (
              <Button asChild variant="outline">
                <a href={openDocument.driveUrl} target="_blank" rel="noopener noreferrer">
                  Open in Google Drive
                </a>
              </Button>
            )}
          </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
};

export default CourseMaterials;
