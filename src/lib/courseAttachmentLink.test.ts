import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildAttachmentDownloadUrl,
  buildDocumentEmbedUrl,
  assessmentPictureSources,
  buildDocumentPreviewImageUrl,
  chooseCourseAttachments,
  groupDocumentsByMonth,
  isGoogleDriveAttachmentUrl,
} from './courseAttachmentLink.ts';
import { resolveCourseImageUrl } from './courseImages.ts';

test('documents are grouped by month and a custom preview image is preferred', () => {
  const groups = groupDocumentsByMonth([
    { id: 'b', monthIndex: 2, sortOrder: 0, driveUrl: 'https://drive.google.com/file/d/month-two/view' },
    { id: 'a2', monthIndex: 1, sortOrder: 2, driveUrl: 'https://drive.google.com/file/d/second/view' },
    { id: 'a1', monthIndex: 1, sortOrder: 1, driveUrl: 'https://drive.google.com/file/d/first/view' },
  ]);

  assert.deepEqual(groups.map((group) => group.monthIndex), [1, 2]);
  assert.deepEqual(groups[0].documents.map((document) => document.id), ['a1', 'a2']);
  assert.equal(
    buildDocumentPreviewImageUrl('https://drive.google.com/file/d/abc_DEF-123/view', 'https://cdn.example.com/preview.png'),
    'https://cdn.example.com/preview.png',
  );
  assert.equal(
    buildDocumentPreviewImageUrl('https://drive.google.com/file/d/abc_DEF-123/view?usp=drive_link', null),
    'https://drive.google.com/thumbnail?id=abc_DEF-123&sz=w800',
  );
  assert.equal(
    buildDocumentEmbedUrl('https://drive.google.com/file/d/abc_DEF-123/view?usp=drive_link'),
    'https://drive.google.com/file/d/abc_DEF-123/preview',
  );
  assert.deepEqual(
    assessmentPictureSources('https://drive.google.com/file/d/abc_DEF-123/view?usp=sharing'),
    [
      'https://lh3.googleusercontent.com/d/abc_DEF-123',
      'https://drive.google.com/thumbnail?id=abc_DEF-123&sz=w1000',
    ],
  );
  assert.deepEqual(
    assessmentPictureSources('https://drive.google.com/open?id=abc_DEF-123'),
    [
      'https://lh3.googleusercontent.com/d/abc_DEF-123',
      'https://drive.google.com/thumbnail?id=abc_DEF-123&sz=w1000',
    ],
  );
  assert.deepEqual(assessmentPictureSources('/assessment-pictures/meeting.svg'), ['/assessment-pictures/meeting.svg']);
  assert.deepEqual(assessmentPictureSources(''), []);
});

test('an enrolled course still gets the Drive link stored on the course when the protected table is empty', () => {
  const courseId = '1565455e-8a90-4665-b291-5ad17536ac96';
  const chosen = chooseCourseAttachments(
    [],
    [{
      courseId,
      attachmentName: 'Supporting Doc',
      attachmentUrl: 'https://drive.google.com/file/d/abc_DEF-123/view?usp=drive_link',
    }],
  );

  assert.equal(chosen.length, 1);
  assert.equal(chosen[0].courseId, courseId);
  assert.equal(
    buildAttachmentDownloadUrl(chosen[0].attachmentUrl),
    'https://drive.google.com/uc?export=download&id=abc_DEF-123',
  );
});

test('a document accepts a Google Docs link, a Drive link, or a Google redirect to either', () => {
  assert.equal(isGoogleDriveAttachmentUrl('https://docs.google.com/document/d/abc_DEF-123/edit?usp=sharing'), true);
  assert.equal(isGoogleDriveAttachmentUrl('https://docs.google.com/presentation/d/abc_DEF-123/edit'), true);
  assert.equal(isGoogleDriveAttachmentUrl('drive.google.com/file/d/abc_DEF-123/view'), true);
  assert.equal(
    isGoogleDriveAttachmentUrl('https://www.google.com/url?q=https%3A%2F%2Fdrive.google.com%2Ffile%2Fd%2Fabc_DEF-123%2Fview'),
    true,
  );
  assert.equal(isGoogleDriveAttachmentUrl('https://example.com/notes.pdf'), false);
  assert.equal(
    buildDocumentEmbedUrl('https://docs.google.com/document/d/abc_DEF-123/edit?usp=sharing'),
    'https://docs.google.com/document/d/abc_DEF-123/preview',
  );
  assert.equal(
    buildDocumentEmbedUrl('https://docs.google.com/presentation/d/abc_DEF-123/edit?usp=sharing'),
    'https://docs.google.com/presentation/d/abc_DEF-123/preview',
  );
  assert.equal(
    buildDocumentEmbedUrl('https://docs.google.com/presentation/u/0/d/abc_DEF-123/edit?usp=sharing'),
    'https://docs.google.com/presentation/d/abc_DEF-123/preview',
  );
  assert.equal(
    buildDocumentEmbedUrl('https://docs.google.com/presentation/d/e/2PACX-abc_DEF-123/embed?start=false'),
    'https://docs.google.com/presentation/d/e/2PACX-abc_DEF-123/embed?start=false&loop=false&delayms=3000',
  );
  assert.equal(
    buildDocumentEmbedUrl('https://docs.google.com/document/u/1/d/abc_DEF-123/edit'),
    'https://docs.google.com/document/d/abc_DEF-123/preview',
  );
  assert.equal(
    buildDocumentPreviewImageUrl(
      'https://docs.google.com/document/d/doc-id/edit',
      'https://drive.google.com/file/d/abc_DEF-123/view',
    ),
    'https://lh3.googleusercontent.com/d/abc_DEF-123',
  );
  assert.equal(
    assessmentPictureSources('https://lh3.googleusercontent.com/d/abc_DEF-123=w1000')[0],
    'https://lh3.googleusercontent.com/d/abc_DEF-123=w1000',
  );
  assert.equal(
    resolveCourseImageUrl('Spoken English Class', 'https://drive.google.com/file/d/abc_DEF-123/view?usp=sharing'),
    'https://lh3.googleusercontent.com/d/abc_DEF-123',
  );
  assert.equal(
    resolveCourseImageUrl('Custom Course', 'https://www.google.com/imgres?imgurl=https%3A%2F%2Fimages.example.com%2Fcover.jpg'),
    'https://images.example.com/cover.jpg',
  );
});

test('a protected attachment is kept when the course row also has a link', () => {
  const chosen = chooseCourseAttachments(
    [{ courseId: 'course-1', attachmentUrl: 'https://drive.google.com/file/d/protected/view' }],
    [{ courseId: 'course-1', attachmentUrl: 'https://drive.google.com/file/d/public/view' }],
  );

  assert.deepEqual(chosen, [
    { courseId: 'course-1', attachmentUrl: 'https://drive.google.com/file/d/protected/view' },
  ]);
});
