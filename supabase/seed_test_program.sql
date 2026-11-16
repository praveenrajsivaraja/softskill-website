-- TEST program: monthly documents plus one example of every assessment question type.
-- Run this in the Supabase SQL editor. It replaces any existing course titled TEST.

BEGIN;

DELETE FROM public.courses
WHERE id = '11111111-1111-4111-8111-111111111101'
   OR title = 'TEST';

INSERT INTO public.courses (
  id,
  title,
  description,
  price,
  original_price,
  duration,
  status,
  category,
  age_range,
  mode,
  total_lessons,
  course_type,
  highlights,
  learning_points
) VALUES (
  '11111111-1111-4111-8111-111111111101',
  'TEST',
  'A practice program with monthly documents and short lesson-style assessments. Each question type is included so you can try the learner flow.',
  0,
  499,
  '3 months',
  'active',
  'Practice',
  'All ages',
  'online',
  5,
  'course',
  ARRAY['Short lessons', 'Instant feedback', 'Monthly documents'],
  ARRAY[
    'Choose the right word',
    'Listen and answer',
    'Look at a picture and describe what is happening'
  ]
);

INSERT INTO public.course_documents (course_id, title, month_index, drive_url, sort_order)
VALUES
  (
    '11111111-1111-4111-8111-111111111101',
    'Month 1 notes',
    1,
    'https://drive.google.com/file/d/1H2jMVu-N_DEQdNP7dNCd8NnNRtQRa0JN/view?usp=drive_link',
    0
  ),
  (
    '11111111-1111-4111-8111-111111111101',
    'Month 1 practice file',
    1,
    'https://drive.google.com/file/d/182BukxgqVBwra-1wdQ4dJTxibIjvr77m/view?usp=drive_link',
    1
  ),
  (
    '11111111-1111-4111-8111-111111111101',
    'Month 2 slides',
    2,
    'https://docs.google.com/presentation/d/1S9PU6R8E-w77-R936kqYacuJNUdH1iet/edit?usp=drive_link&ouid=111132057323059974544&rtpof=true&sd=true',
    0
  ),
  (
    '11111111-1111-4111-8111-111111111101',
    'Month 2 slides, part 2',
    2,
    'https://docs.google.com/presentation/d/1iNrXsVcu6m1ZT9WxnIq0yd_g0G3uhane/edit?usp=drive_link&ouid=111132057323059974544&rtpof=true&sd=true',
    1
  ),
  (
    '11111111-1111-4111-8111-111111111101',
    'Month 3 slides',
    3,
    'https://docs.google.com/presentation/d/1oKxb0j0_WV-kFNUqeEGAmxliQtUK1CcZ/edit?usp=drive_link&ouid=111132057323059974544&rtpof=true&sd=true',
    0
  );

INSERT INTO public.assessments (
  id, course_id, title, description, instructions,
  duration_minutes, passing_score, sequence,
  is_active, is_published, show_feedback, allow_review
) VALUES
  (
    '11111111-1111-4111-8111-111111111201',
    '11111111-1111-4111-8111-111111111101',
    'Lesson 1: Words',
    'A short lesson. Check each answer before you move on.',
    'Pick one answer, then tap Check. You will see right away whether it was correct.',
    8,
    70,
    1,
    true,
    true,
    true,
    true
  ),
  (
    '11111111-1111-4111-8111-111111111202',
    '11111111-1111-4111-8111-111111111101',
    'Lesson 2: Sentences',
    'Match a meaning, arrange words, then write one sentence.',
    'Take your time. Check each answer, then continue to the next question.',
    10,
    70,
    2,
    true,
    true,
    true,
    true
  ),
  (
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
  );

INSERT INTO public.assessment_questions (
  id, assessment_id, section_title, section_instructions, section_order,
  prompt, kind, picture_text, passage_title, passage, listening_script,
  marks, sort_order, minimum_words, accepted_answers, model_answer, word_bank,
  required_phrases, guidance
) VALUES
  (
    '11111111-1111-4111-8111-111111111301',
    '11111111-1111-4111-8111-111111111201',
    'Choose',
    'Tap the word that matches the picture.',
    1,
    'What is the student holding?',
    'choice',
    'A student in a classroom, holding a notebook.',
    NULL,
    NULL,
    NULL,
    1,
    0,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL
  ),
  (
    '11111111-1111-4111-8111-111111111302',
    '11111111-1111-4111-8111-111111111201',
    'Listen',
    'Play the recording, then choose what you heard.',
    2,
    'What time is the meeting?',
    'listening',
    NULL,
    NULL,
    NULL,
    'The meeting is at ten.',
    1,
    1,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL
  ),
  (
    '11111111-1111-4111-8111-111111111303',
    '11111111-1111-4111-8111-111111111201',
    'Fill the blank',
    'Type the missing word.',
    3,
    'She ___ to class every morning.',
    'blank',
    NULL,
    NULL,
    NULL,
    NULL,
    1,
    2,
    NULL,
    ARRAY['goes'],
    NULL,
    NULL,
    NULL,
    NULL
  ),
  (
    '11111111-1111-4111-8111-111111111304',
    '11111111-1111-4111-8111-111111111202',
    'Match',
    'Choose the meaning of the phrase.',
    1,
    'What does "thank you" mean?',
    'match',
    NULL,
    'A short note',
    'After the interview, Riya said thank you and left the room.',
    NULL,
    1,
    0,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL
  ),
  (
    '11111111-1111-4111-8111-111111111305',
    '11111111-1111-4111-8111-111111111202',
    'Arrange',
    'Put the words in the right order.',
    2,
    'Arrange the words into a sentence.',
    'order',
    NULL,
    NULL,
    NULL,
    NULL,
    1,
    1,
    NULL,
    NULL,
    'My interview is tomorrow.',
    ARRAY['is', 'my', 'tomorrow', 'interview'],
    NULL,
    NULL
  ),
  (
    '11111111-1111-4111-8111-111111111306',
    '11111111-1111-4111-8111-111111111202',
    'Write',
    'Write a short answer in your own words.',
    3,
    'Write one sentence about a goal you have for this program.',
    'written',
    NULL,
    NULL,
    NULL,
    NULL,
    1,
    2,
    6,
    NULL,
    NULL,
    NULL,
    '[["goal","want","hope","aim"]]'::jsonb,
    'Use at least 6 words and mention a goal, hope, want, or aim.'
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
  ('11111111-1111-4111-8111-111111111301', 'A notebook', true, 0),
  ('11111111-1111-4111-8111-111111111301', 'A bicycle', false, 1),
  ('11111111-1111-4111-8111-111111111301', 'A coffee cup', false, 2),
  ('11111111-1111-4111-8111-111111111302', 'The meeting is at ten.', true, 0),
  ('11111111-1111-4111-8111-111111111302', 'The meeting is at two.', false, 1),
  ('11111111-1111-4111-8111-111111111302', 'The meeting was yesterday.', false, 2),
  ('11111111-1111-4111-8111-111111111304', 'A polite way to show gratitude', true, 0),
  ('11111111-1111-4111-8111-111111111304', 'A way to say goodbye', false, 1),
  ('11111111-1111-4111-8111-111111111304', 'A way to ask for help', false, 2),
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
