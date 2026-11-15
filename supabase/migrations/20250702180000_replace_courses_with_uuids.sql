-- Refresh the course catalog without removing courses that orders or enrollments still use.
-- The MBTI course is one of those referenced rows, so a full delete fails on order_items.

DO $$
DECLARE
  delete_unreferenced_courses text := $delete$
    DELETE FROM public.courses AS course
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.order_items AS order_item
      WHERE order_item.course_id = course.id
    )
    AND NOT EXISTS (
      SELECT 1
      FROM public.enrollments AS enrollment
      WHERE enrollment.course_id = course.id
    )
  $delete$;
BEGIN
  IF to_regclass('public.cart_items') IS NULL THEN
    EXECUTE delete_unreferenced_courses;
  ELSE
    EXECUTE delete_unreferenced_courses || $cart$
      AND NOT EXISTS (
        SELECT 1
        FROM public.cart_items AS cart_item
        WHERE cart_item.course_id = course.id
      )
    $cart$;
  END IF;
END $$;

INSERT INTO public.courses (id, title, description, image_url, price, original_price, duration, mode, age_range, category)
SELECT
  gen_random_uuid(),
  seed.title,
  seed.description,
  seed.image_url,
  seed.price,
  seed.original_price,
  seed.duration,
  seed.mode,
  seed.age_range,
  seed.category
FROM (
  VALUES
    ('Art & Craft Classes', 'Explore creativity through various art and craft activities. Perfect for developing artistic skills and imagination.', '/course-images/art-and-craft.jpg', 1500::numeric, 2000::numeric, '4 weeks', 'Offline', '6-16 years', 'Creative'),
    ('Spoken English Class', 'Master fluent English communication and build confidence in speaking with native-like fluency.', '/course-images/spoken-english.png', 1999::numeric, 2999::numeric, '8 weeks', 'Hybrid', '10+ years', 'Language'),
    ('Spoken Hindi Class', 'Learn to speak Hindi fluently with proper pronunciation and grammar for effective communication.', '/course-images/spoken-hindi.png', 1799::numeric, 2499::numeric, '6 weeks', 'Offline', '8+ years', 'Language'),
    ('Soft Skill Training', 'Develop essential soft skills for personal and professional success in todays competitive world.', '/course-images/soft-skill-training.png', 3499::numeric, 4999::numeric, '4 weeks', 'Online', '15+ years', 'Professional'),
    ('Public Speaking', 'Overcome stage fear and become a confident public speaker with proven techniques and practice.', '/course-images/public-speaking.png', 2499::numeric, 3499::numeric, '3 weeks', 'Offline', '12+ years', 'Communication'),
    ('Personality Development Class', 'Transform your personality and build self-confidence for personal and professional growth.', '/course-images/personality-development.png', 2999::numeric, 4499::numeric, '6 weeks', 'Hybrid', '14+ years', 'Personal Development'),
    ('Career Counseling', 'Get expert guidance for career planning and make informed decisions about your future path.', '/course-images/career-counseling.jpg', 1999::numeric, 2999::numeric, '2 sessions', 'Online', '16+ years', 'Counseling'),
    ('Health Insurance', 'Understand health insurance policies and make the right choices for you and your familys wellbeing.', '/course-images/health-insurance.jpg', 999::numeric, 1499::numeric, '1 session', 'Online', '18+ years', 'Insurance'),
    ('Tarot Reading', 'Discover insights into your life path through professional tarot card reading sessions.', '/course-images/tarot-reading.jpg', 1299::numeric, 1999::numeric, '1 session', 'Offline', '18+ years', 'Spiritual'),
    ('Business Consulting', 'Get expert advice for starting and growing your business with proven strategies and insights.', '/course-images/business-consulting.jpg', 4999::numeric, 7499::numeric, '3 sessions', 'Hybrid', '21+ years', 'Business')
) AS seed(title, description, image_url, price, original_price, duration, mode, age_range, category)
WHERE NOT EXISTS (
  SELECT 1
  FROM public.courses AS existing_course
  WHERE existing_course.title = seed.title
     OR (
       seed.title = 'Personality Development Class'
       AND existing_course.title ILIKE 'Personality Development%'
     )
);
