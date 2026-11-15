-- Course cards were pointing at missing files, a search-page link, or an unrelated photo.
-- Career tests already have a working image, so they are left unchanged.

UPDATE public.courses
SET image_url = '/course-images/art-and-craft.jpg',
    updated_at = now()
WHERE title ILIKE 'Art & Craft%'
  AND course_type <> 'career_test';

UPDATE public.courses
SET image_url = '/course-images/spoken-english.png',
    updated_at = now()
WHERE title ILIKE 'Spoken English%'
  AND course_type <> 'career_test';

UPDATE public.courses
SET image_url = '/course-images/spoken-hindi.png',
    updated_at = now()
WHERE title ILIKE 'Spoken Hindi%'
  AND course_type <> 'career_test';

UPDATE public.courses
SET image_url = '/course-images/soft-skill-training.png',
    updated_at = now()
WHERE title ILIKE 'Soft Skill%'
  AND course_type <> 'career_test';

UPDATE public.courses
SET image_url = '/course-images/public-speaking.png',
    updated_at = now()
WHERE title ILIKE 'Public Speaking%'
  AND course_type <> 'career_test';

UPDATE public.courses
SET image_url = '/course-images/personality-development.png',
    updated_at = now()
WHERE title ILIKE 'Personality Development%'
  AND course_type <> 'career_test';

UPDATE public.courses
SET image_url = '/course-images/career-counseling.jpg',
    updated_at = now()
WHERE title ILIKE 'Career Counseling%'
  AND course_type <> 'career_test';

UPDATE public.courses
SET image_url = '/course-images/health-insurance.jpg',
    updated_at = now()
WHERE title ILIKE 'Health Insurance%'
  AND course_type <> 'career_test';

UPDATE public.courses
SET image_url = '/course-images/tarot-reading.jpg',
    updated_at = now()
WHERE title ILIKE 'Tarot%'
  AND course_type <> 'career_test';

UPDATE public.courses
SET image_url = '/course-images/business-consulting.jpg',
    updated_at = now()
WHERE title ILIKE 'Business Consulting%'
  AND course_type <> 'career_test';
