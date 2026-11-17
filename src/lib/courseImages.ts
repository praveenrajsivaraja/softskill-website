import { assessmentPictureSources } from './courseAttachmentLink.ts';

const courseImageByTitlePrefix: { titlePrefix: string; imageUrl: string }[] = [
  { titlePrefix: 'art & craft', imageUrl: '/course-images/art-and-craft.jpg' },
  { titlePrefix: 'spoken english', imageUrl: '/course-images/spoken-english.png' },
  { titlePrefix: 'spoken hindi', imageUrl: '/course-images/spoken-hindi.png' },
  { titlePrefix: 'soft skill', imageUrl: '/course-images/soft-skill-training.png' },
  { titlePrefix: 'public speaking', imageUrl: '/course-images/public-speaking.png' },
  { titlePrefix: 'personality development', imageUrl: '/course-images/personality-development.png' },
  { titlePrefix: 'career counseling', imageUrl: '/course-images/career-counseling.jpg' },
  { titlePrefix: 'health insurance', imageUrl: '/course-images/health-insurance.jpg' },
  { titlePrefix: 'tarot', imageUrl: '/course-images/tarot-reading.jpg' },
  { titlePrefix: 'business consulting', imageUrl: '/course-images/business-consulting.jpg' },
];

const unavailableImageMarkers = [
  '/lovable-uploads/',
  'google.com/imgres',
  'photo-1582562124811',
];

function hasDisplayableImage(imageUrl: string): boolean {
  return !unavailableImageMarkers.some((marker) => imageUrl.includes(marker));
}

export function resolveCourseImageUrl(
  title: string | null | undefined,
  imageUrl: string | null | undefined,
): string | null {
  const storedImageUrl = imageUrl?.trim() ?? '';
  const displayImageUrl = assessmentPictureSources(storedImageUrl)[0] ?? '';
  if (displayImageUrl && hasDisplayableImage(displayImageUrl)) {
    return displayImageUrl;
  }

  const normalizedTitle = title?.trim().toLowerCase() ?? '';
  const matchedCourse = courseImageByTitlePrefix.find((courseImage) =>
    normalizedTitle.startsWith(courseImage.titlePrefix),
  );

  return matchedCourse?.imageUrl ?? (storedImageUrl || null);
}
