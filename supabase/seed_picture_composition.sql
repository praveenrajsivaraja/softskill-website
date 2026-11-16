-- Adds Lesson 3: Picture composition to an existing TEST program.
-- Safe to run again. It does not remove the other TEST lessons.
-- Requires the TEST course from seed_test_program.sql.

BEGIN;

INSERT INTO public.assessments (
  id, course_id, title, description, instructions,
  duration_minutes, passing_score, sequence,
  is_active, is_published, show_feedback, allow_review
) VALUES (
  '11111111-1111-4111-8111-111111111203',
  '11111111-1111-4111-8111-111111111101',
  'Lesson 3: Picture composition',
  'Look at each illustration, then choose the best description or write one sentence.',
  'Questions 15–19. Observe the picture before you answer.',
  10,
  70,
  3,
  true,
  true,
  true,
  true
)
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  instructions = EXCLUDED.instructions,
  duration_minutes = EXCLUDED.duration_minutes,
  passing_score = EXCLUDED.passing_score,
  sequence = EXCLUDED.sequence,
  is_active = EXCLUDED.is_active,
  is_published = EXCLUDED.is_published,
  show_feedback = EXCLUDED.show_feedback,
  allow_review = EXCLUDED.allow_review,
  updated_at = now();

DELETE FROM public.assessment_questions
WHERE id IN (
  '11111111-1111-4111-8111-111111111307',
  '11111111-1111-4111-8111-111111111308',
  '11111111-1111-4111-8111-111111111309',
  '11111111-1111-4111-8111-111111111310',
  '11111111-1111-4111-8111-111111111311'
);

INSERT INTO public.assessment_questions (
  id, assessment_id, section_title, section_instructions, section_order,
  prompt, kind, picture_text, picture_url, marks, sort_order, minimum_words,
  required_phrases, guidance
) VALUES
  (
    '11111111-1111-4111-8111-111111111307',
    '11111111-1111-4111-8111-111111111203',
    'Picture composition',
    'Questions 15–19. Observe the picture, then choose the best description or write one sentence.',
    1,
    'The Teamwork Test. Which sentence best describes the picture?',
    'choice',
    'Three college students sitting around a laptop, discussing a project, sharing notes and working together.',
    '/assessment-pictures/teamwork.svg',
    1,
    0,
    NULL,
    NULL,
    NULL
  ),
  (
    '11111111-1111-4111-8111-111111111308',
    '11111111-1111-4111-8111-111111111203',
    'Picture composition',
    'Questions 15–19. Observe the picture, then choose the best description or write one sentence.',
    1,
    'The Professional Meeting. What is the employee doing?',
    'choice',
    'A young employee presenting a chart to two managers in a meeting room.',
    '/assessment-pictures/meeting.svg',
    1,
    1,
    NULL,
    NULL,
    NULL
  ),
  (
    '11111111-1111-4111-8111-111111111309',
    '11111111-1111-4111-8111-111111111203',
    'Picture composition',
    'Questions 15–19. Observe the picture, then choose the best description or write one sentence.',
    1,
    'The Email Situation. What is the most likely activity?',
    'choice',
    'A student sitting at a desk with a laptop open, reviewing a professional email and a calendar.',
    '/assessment-pictures/email.svg',
    1,
    2,
    NULL,
    NULL,
    NULL
  ),
  (
    '11111111-1111-4111-8111-111111111310',
    '11111111-1111-4111-8111-111111111203',
    'Picture composition',
    'Questions 15–19. Observe the picture, then choose the best description or write one sentence.',
    1,
    'The Listening Challenge. Which communication skill is demonstrated?',
    'choice',
    'Two people having a conversation. One person is speaking while the other is listening attentively, maintaining eye contact and taking notes.',
    '/assessment-pictures/listening.svg',
    1,
    3,
    NULL,
    NULL,
    NULL
  ),
  (
    '11111111-1111-4111-8111-111111111311',
    '11111111-1111-4111-8111-111111111203',
    'Picture composition',
    'Questions 15–19. Observe the picture, then choose the best description or write one sentence.',
    1,
    'Describe What You See. Write ONE meaningful sentence describing the picture.',
    'written',
    'A college placement drive with students waiting in a queue outside an interview room, holding resumes.',
    '/assessment-pictures/placement.svg',
    1,
    4,
    6,
    '[["student","students"],["interview","placement","resume","resumes","queue","waiting","wait"]]'::jsonb,
    '1 mark for one sentence of at least 6 words that describes students waiting for an interview, a placement drive, or a queue with resumes.'
  );

INSERT INTO public.assessment_options (question_id, label, is_correct, sort_order)
VALUES
  ('11111111-1111-4111-8111-111111111307', 'The students are attending a cultural programme.', false, 0),
  ('11111111-1111-4111-8111-111111111307', 'The students are collaborating on a group project.', true, 1),
  ('11111111-1111-4111-8111-111111111307', 'The students are waiting for their examination.', false, 2),
  ('11111111-1111-4111-8111-111111111307', 'The students are attending an interview.', false, 3),
  ('11111111-1111-4111-8111-111111111308', 'Conducting a presentation.', true, 0),
  ('11111111-1111-4111-8111-111111111308', 'Attending a farewell party.', false, 1),
  ('11111111-1111-4111-8111-111111111308', 'Completing a written examination.', false, 2),
  ('11111111-1111-4111-8111-111111111308', 'Participating in a sports event.', false, 3),
  ('11111111-1111-4111-8111-111111111309', 'Watching an entertainment video.', false, 0),
  ('11111111-1111-4111-8111-111111111309', 'Preparing a professional communication.', true, 1),
  ('11111111-1111-4111-8111-111111111309', 'Playing an online game.', false, 2),
  ('11111111-1111-4111-8111-111111111309', 'Browsing shopping websites.', false, 3),
  ('11111111-1111-4111-8111-111111111310', 'Active listening.', true, 0),
  ('11111111-1111-4111-8111-111111111310', 'Public speaking.', false, 1),
  ('11111111-1111-4111-8111-111111111310', 'Negotiation.', false, 2),
  ('11111111-1111-4111-8111-111111111310', 'Written communication.', false, 3);

COMMIT;
