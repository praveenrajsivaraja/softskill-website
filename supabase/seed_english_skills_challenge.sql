-- English That Works: all 50 questions from Sample Assessment.txt.
-- Run this in the Supabase SQL editor. Safe to run again: it replaces this assessment only.
-- It is attached to the course whose title starts with "Spoken English".
-- Change that match below if it should live on a different program.

BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.courses WHERE title ILIKE 'Spoken English%'
  ) THEN
    RAISE EXCEPTION 'No course title starts with Spoken English. Edit the title match in this script before running it.';
  END IF;
END $$;

INSERT INTO public.assessments (
  id, course_id, title, description, instructions,
  duration_minutes, passing_score, sequence,
  is_active, is_published, show_feedback, allow_review
)
SELECT
  '22222222-2222-4222-8222-222222222201',
  course.id,
  'English That Works!',
  'Month 1 English Skills Challenge for first-year undergraduate students. 50 questions, 50 marks.',
  'Learn. Practise. Apply. Achieve. Listening questions play a script. Write your own words for the open questions.',
  35,
  70,
  COALESCE((
    SELECT MAX(existing.sequence)
    FROM public.assessments AS existing
    WHERE existing.course_id = course.id
      AND existing.id <> '22222222-2222-4222-8222-222222222201'
  ), 0) + 1,
  true,
  true,
  true,
  true
FROM public.courses AS course
WHERE course.title ILIKE 'Spoken English%'
ORDER BY course.title
LIMIT 1
ON CONFLICT (id) DO UPDATE SET
  course_id = EXCLUDED.course_id,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  instructions = EXCLUDED.instructions,
  duration_minutes = EXCLUDED.duration_minutes,
  passing_score = EXCLUDED.passing_score,
  is_active = EXCLUDED.is_active,
  is_published = EXCLUDED.is_published,
  show_feedback = EXCLUDED.show_feedback,
  allow_review = EXCLUDED.allow_review,
  updated_at = now();

DELETE FROM public.assessment_questions
WHERE assessment_id = '22222222-2222-4222-8222-222222222201';

INSERT INTO public.assessment_questions (
  id, assessment_id, section_title, section_instructions, section_order,
  prompt, kind, picture_text, picture_url, passage_title, passage, listening_script,
  marks, sort_order, minimum_words, accepted_answers, model_answer, word_bank,
  required_phrases, guidance
) VALUES
  (
    '22222222-2222-4222-8222-222222222301',
    '22222222-2222-4222-8222-222222222201',
    'Choose the correct answer',
    'Questions 1–6. Choose the correct answer.',
    1,
    'Complete the sentence. The placement interview is scheduled ___ 26 February.',
    'choice', NULL, NULL, NULL, NULL, NULL,
    1, 0, NULL, NULL, NULL, NULL, NULL,
    'Use on before a date.'
  ),
  (
    '22222222-2222-4222-8222-222222222302',
    '22222222-2222-4222-8222-222222222201',
    'Choose the correct answer',
    'Questions 1–6. Choose the correct answer.',
    1,
    'Choose the correct sentence.',
    'choice', NULL, NULL, NULL, NULL, NULL,
    1, 1, NULL, NULL, NULL, NULL, NULL,
    'She doesn''t attend meetings regularly.'
  ),
  (
    '22222222-2222-4222-8222-222222222303',
    '22222222-2222-4222-8222-222222222201',
    'Choose the correct answer',
    'Questions 1–6. Choose the correct answer.',
    1,
    'Select the most professional expression. You want to ask your professor for an extension.',
    'choice', NULL, NULL, NULL, NULL, NULL,
    1, 2, NULL, NULL, NULL, NULL, NULL,
    'A polite request asks whether an extension is possible.'
  ),
  (
    '22222222-2222-4222-8222-222222222304',
    '22222222-2222-4222-8222-222222222201',
    'Choose the correct answer',
    'Questions 1–6. Choose the correct answer.',
    1,
    'Choose the correct word. The company is looking for candidates who can work effectively in a team. They should be good at:',
    'choice', NULL, NULL, NULL, NULL, NULL,
    1, 3, NULL, NULL, NULL, NULL, NULL,
    'Working in a team is collaboration.'
  ),
  (
    '22222222-2222-4222-8222-222222222305',
    '22222222-2222-4222-8222-222222222201',
    'Choose the correct answer',
    'Questions 1–6. Choose the correct answer.',
    1,
    'Choose the correct expression. I look forward to ___ from you.',
    'choice', NULL, NULL, NULL, NULL, NULL,
    1, 4, NULL, NULL, NULL, NULL, NULL,
    'Look forward to is followed by hearing.'
  ),
  (
    '22222222-2222-4222-8222-222222222306',
    '22222222-2222-4222-8222-222222222201',
    'Choose the correct answer',
    'Questions 1–6. Choose the correct answer.',
    1,
    'Which is the most suitable email subject line? You are sending your completed internship report to your supervisor.',
    'choice', NULL, NULL, NULL, NULL, NULL,
    1, 5, NULL, NULL, NULL, NULL, NULL,
    'A subject line should name the document and the sender.'
  ),
  (
    '22222222-2222-4222-8222-222222222307',
    '22222222-2222-4222-8222-222222222201',
    'Fill in the blanks',
    'Questions 7–14. Type the missing word.',
    2,
    'The HR manager will meet the candidates ___ 10 AM.',
    'blank', NULL, NULL, NULL, NULL, NULL,
    1, 0, NULL, ARRAY['at'], NULL, NULL, NULL,
    'Use at before a clock time.'
  ),
  (
    '22222222-2222-4222-8222-222222222308',
    '22222222-2222-4222-8222-222222222201',
    'Fill in the blanks',
    'Questions 7–14. Type the missing word.',
    2,
    'We have been preparing for the college event ___ Monday.',
    'blank', NULL, NULL, NULL, NULL, NULL,
    1, 1, NULL, ARRAY['since'], NULL, NULL, NULL,
    'Use since with a starting point.'
  ),
  (
    '22222222-2222-4222-8222-222222222309',
    '22222222-2222-4222-8222-222222222201',
    'Fill in the blanks',
    'Questions 7–14. Type the missing word.',
    2,
    'Each student ___ required to carry their college ID card.',
    'blank', NULL, NULL, NULL, NULL, NULL,
    1, 2, NULL, ARRAY['is'], NULL, NULL, NULL,
    'Each student takes is.'
  ),
  (
    '22222222-2222-4222-8222-222222222310',
    '22222222-2222-4222-8222-222222222201',
    'Fill in the blanks',
    'Questions 7–14. Type the missing word.',
    2,
    'Please ___ the attached document before the meeting.',
    'blank', NULL, NULL, NULL, NULL, NULL,
    1, 3, NULL, ARRAY['review'], NULL, NULL, NULL,
    'Review the attached document.'
  ),
  (
    '22222222-2222-4222-8222-222222222311',
    '22222222-2222-4222-8222-222222222201',
    'Fill in the blanks',
    'Questions 7–14. Type the missing word.',
    2,
    'The team needs to ___ the most urgent tasks first.',
    'blank', NULL, NULL, NULL, NULL, NULL,
    1, 4, NULL, ARRAY['prioritise', 'prioritize'], NULL, NULL, NULL,
    'Put the most urgent tasks first: prioritise.'
  ),
  (
    '22222222-2222-4222-8222-222222222312',
    '22222222-2222-4222-8222-222222222201',
    'Fill in the blanks',
    'Questions 7–14. Type the missing word.',
    2,
    'I am interested ___ the internship opportunity.',
    'blank', NULL, NULL, NULL, NULL, NULL,
    1, 5, NULL, ARRAY['in'], NULL, NULL, NULL,
    'Interested is followed by in.'
  ),
  (
    '22222222-2222-4222-8222-222222222313',
    '22222222-2222-4222-8222-222222222201',
    'Fill in the blanks',
    'Questions 7–14. Type the missing word.',
    2,
    'The manager asked us to ___ the proposal before Friday.',
    'blank', NULL, NULL, NULL, NULL, NULL,
    1, 6, NULL, ARRAY['finalise', 'finalize', 'review'], NULL, NULL, NULL,
    'Accept finalise, finalize, or review.'
  ),
  (
    '22222222-2222-4222-8222-222222222314',
    '22222222-2222-4222-8222-222222222201',
    'Fill in the blanks',
    'Questions 7–14. Type the missing word.',
    2,
    'The new employee is responsible ___ coordinating the training programme.',
    'blank', NULL, NULL, NULL, NULL, NULL,
    1, 7, NULL, ARRAY['for'], NULL, NULL, NULL,
    'Responsible is followed by for.'
  ),
  (
    '22222222-2222-4222-8222-222222222315',
    '22222222-2222-4222-8222-222222222201',
    'Picture composition',
    'Questions 15–19. Observe the picture, then choose the best description or write one sentence.',
    3,
    'The Teamwork Test. Which sentence best describes the picture?',
    'choice',
    'Three college students sitting around a laptop, discussing a project, sharing notes and working together.',
    '/assessment-pictures/teamwork.svg',
    NULL, NULL, NULL,
    1, 0, NULL, NULL, NULL, NULL, NULL,
    'The students are working together on a project.'
  ),
  (
    '22222222-2222-4222-8222-222222222316',
    '22222222-2222-4222-8222-222222222201',
    'Picture composition',
    'Questions 15–19. Observe the picture, then choose the best description or write one sentence.',
    3,
    'The Professional Meeting. What is the employee doing?',
    'choice',
    'A young employee presenting a chart to two managers in a meeting room.',
    '/assessment-pictures/meeting.svg',
    NULL, NULL, NULL,
    1, 1, NULL, NULL, NULL, NULL, NULL,
    'The employee is presenting.'
  ),
  (
    '22222222-2222-4222-8222-222222222317',
    '22222222-2222-4222-8222-222222222201',
    'Picture composition',
    'Questions 15–19. Observe the picture, then choose the best description or write one sentence.',
    3,
    'The Email Situation. What is the most likely activity?',
    'choice',
    'A student sitting at a desk with a laptop open, reviewing a professional email and a calendar.',
    '/assessment-pictures/email.svg',
    NULL, NULL, NULL,
    1, 2, NULL, NULL, NULL, NULL, NULL,
    'The student is preparing a professional message.'
  ),
  (
    '22222222-2222-4222-8222-222222222318',
    '22222222-2222-4222-8222-222222222201',
    'Picture composition',
    'Questions 15–19. Observe the picture, then choose the best description or write one sentence.',
    3,
    'The Listening Challenge. Which communication skill is demonstrated?',
    'choice',
    'Two people having a conversation. One person is speaking while the other is listening attentively, maintaining eye contact and taking notes.',
    '/assessment-pictures/listening.svg',
    NULL, NULL, NULL,
    1, 3, NULL, NULL, NULL, NULL, NULL,
    'Attentive listening with notes is active listening.'
  ),
  (
    '22222222-2222-4222-8222-222222222319',
    '22222222-2222-4222-8222-222222222201',
    'Picture composition',
    'Questions 15–19. Observe the picture, then choose the best description or write one sentence.',
    3,
    'Describe What You See. Write ONE meaningful sentence describing the picture.',
    'written',
    'A college placement drive with students waiting in a queue outside an interview room, holding resumes.',
    '/assessment-pictures/placement.svg',
    NULL, NULL, NULL,
    1, 4, 6, NULL, NULL, NULL,
    '[["student","students"],["interview","placement","resume","resumes","queue","waiting","wait"]]'::jsonb,
    '1 mark for one sentence of at least 6 words that describes students waiting for an interview, a placement drive, or a queue with resumes.'
  ),
  (
    '22222222-2222-4222-8222-222222222320',
    '22222222-2222-4222-8222-222222222201',
    'Read and answer',
    'Questions 20–25. Read the passage, then answer.',
    4,
    'Which company is conducting the recruitment drive?',
    'choice', NULL, NULL,
    'Passage A – The Placement Announcement',
    $passage$PLACEMENT CELL – IMPORTANT NOTICE

Dear Students,

The campus recruitment drive for BrightPath Technologies will take place on Friday, 6 March, at 9:30 AM in Seminar Hall 2.

Eligible students must bring:
- Two copies of their updated resume.
- College ID card.
- One passport-size photograph.

Students are requested to report at least 30 minutes before the scheduled time. Formal attire is compulsory.

For queries, contact the Placement Cell.$passage$,
    NULL,
    1, 0, NULL, NULL, NULL, NULL, NULL,
    'The notice names BrightPath Technologies.'
  ),
  (
    '22222222-2222-4222-8222-222222222321',
    '22222222-2222-4222-8222-222222222201',
    'Read and answer',
    'Questions 20–25. Read the passage, then answer.',
    4,
    'Where should students report?',
    'choice', NULL, NULL,
    'Passage A – The Placement Announcement',
    $passage$PLACEMENT CELL – IMPORTANT NOTICE

Dear Students,

The campus recruitment drive for BrightPath Technologies will take place on Friday, 6 March, at 9:30 AM in Seminar Hall 2.

Eligible students must bring:
- Two copies of their updated resume.
- College ID card.
- One passport-size photograph.

Students are requested to report at least 30 minutes before the scheduled time. Formal attire is compulsory.

For queries, contact the Placement Cell.$passage$,
    NULL,
    1, 1, NULL, NULL, NULL, NULL, NULL,
    'The venue is Seminar Hall 2.'
  ),
  (
    '22222222-2222-4222-8222-222222222322',
    '22222222-2222-4222-8222-222222222201',
    'Read and answer',
    'Questions 20–25. Read the passage, then answer.',
    4,
    'At what time should students ideally report?',
    'choice', NULL, NULL,
    'Passage A – The Placement Announcement',
    $passage$PLACEMENT CELL – IMPORTANT NOTICE

Dear Students,

The campus recruitment drive for BrightPath Technologies will take place on Friday, 6 March, at 9:30 AM in Seminar Hall 2.

Eligible students must bring:
- Two copies of their updated resume.
- College ID card.
- One passport-size photograph.

Students are requested to report at least 30 minutes before the scheduled time. Formal attire is compulsory.

For queries, contact the Placement Cell.$passage$,
    NULL,
    1, 2, NULL, NULL, NULL, NULL, NULL,
    '30 minutes before 9:30 AM is 9:00 AM.'
  ),
  (
    '22222222-2222-4222-8222-222222222323',
    '22222222-2222-4222-8222-222222222201',
    'Read and answer',
    'Questions 20–25. Read the passage, then answer.',
    4,
    'What was Ananya''s initial challenge?',
    'choice', NULL, NULL,
    'Passage B – The Internship Experience',
    $passage$Ananya joined a marketing company as an intern. During her first week, she was assigned to prepare a presentation about customer preferences.

Initially, she hesitated to share her ideas during team meetings. However, she began observing how experienced employees communicated, asked questions and presented their suggestions.

Her supervisor encouraged her to contribute at least one idea in every meeting.

Over time, Ananya became more confident. She learned that professional growth does not happen overnight. It develops through observation, practice, feedback and consistent effort.$passage$,
    NULL,
    1, 3, NULL, NULL, NULL, NULL, NULL,
    'She hesitated to share her ideas.'
  ),
  (
    '22222222-2222-4222-8222-222222222324',
    '22222222-2222-4222-8222-222222222201',
    'Read and answer',
    'Questions 20–25. Read the passage, then answer.',
    4,
    'What did her supervisor encourage her to do?',
    'choice', NULL, NULL,
    'Passage B – The Internship Experience',
    $passage$Ananya joined a marketing company as an intern. During her first week, she was assigned to prepare a presentation about customer preferences.

Initially, she hesitated to share her ideas during team meetings. However, she began observing how experienced employees communicated, asked questions and presented their suggestions.

Her supervisor encouraged her to contribute at least one idea in every meeting.

Over time, Ananya became more confident. She learned that professional growth does not happen overnight. It develops through observation, practice, feedback and consistent effort.$passage$,
    NULL,
    1, 4, NULL, NULL, NULL, NULL, NULL,
    'Contribute at least one idea in each meeting.'
  ),
  (
    '22222222-2222-4222-8222-222222222325',
    '22222222-2222-4222-8222-222222222201',
    'Read and answer',
    'Questions 20–25. Read the passage, then answer.',
    4,
    'What is the main lesson from the passage?',
    'choice', NULL, NULL,
    'Passage B – The Internship Experience',
    $passage$Ananya joined a marketing company as an intern. During her first week, she was assigned to prepare a presentation about customer preferences.

Initially, she hesitated to share her ideas during team meetings. However, she began observing how experienced employees communicated, asked questions and presented their suggestions.

Her supervisor encouraged her to contribute at least one idea in every meeting.

Over time, Ananya became more confident. She learned that professional growth does not happen overnight. It develops through observation, practice, feedback and consistent effort.$passage$,
    NULL,
    1, 5, NULL, NULL, NULL, NULL, NULL,
    'Professional growth comes from consistent practice.'
  ),
  (
    '22222222-2222-4222-8222-222222222326',
    '22222222-2222-4222-8222-222222222201',
    'Listen and answer',
    'Questions 26–30. Listen to the recording. The script is spoken and is not shown during the test.',
    5,
    'What should the student bring for the interview?',
    'listening', NULL, NULL, NULL, NULL,
    'Hello, everyone. This is a reminder from the Placement Cell. Tomorrow''s interview will begin at 10 AM. Please arrive by 9:30 AM and carry two copies of your updated resume along with your college ID card. Formal attire is compulsory.',
    1, 0, NULL, NULL, NULL, NULL, NULL,
    'Bring a resume and the college ID card.'
  ),
  (
    '22222222-2222-4222-8222-222222222327',
    '22222222-2222-4222-8222-222222222201',
    'Listen and answer',
    'Questions 26–30. Listen to the recording. The script is spoken and is not shown during the test.',
    5,
    'What does the manager ask the employee to do?',
    'listening', NULL, NULL, NULL, NULL,
    'Good morning, Riya. Have you completed the client presentation? Almost, sir. I need to verify two figures. That''s fine. Please check the figures and share the final presentation before 2 PM.',
    1, 1, NULL, NULL, NULL, NULL, NULL,
    'Check the figures and share the presentation.'
  ),
  (
    '22222222-2222-4222-8222-222222222328',
    '22222222-2222-4222-8222-222222222201',
    'Listen and answer',
    'Questions 26–30. Listen to the recording. The script is spoken and is not shown during the test.',
    5,
    'When will the student call the recruiter back?',
    'listening', NULL, NULL, NULL, NULL,
    'Hello, may I speak to Rahul? Hello, this is Rahul speaking. I''m calling regarding your internship application. Thank you for calling. I''m currently in class. Could I call you back after 3 PM? Certainly. I''ll be available.',
    1, 2, NULL, NULL, NULL, NULL, NULL,
    'Rahul asks to call back after 3 PM.'
  ),
  (
    '22222222-2222-4222-8222-222222222329',
    '22222222-2222-4222-8222-222222222201',
    'Listen and answer',
    'Questions 26–30. Listen to the recording. The script is spoken and is not shown during the test.',
    5,
    'What is the purpose of the announcement?',
    'listening', NULL, NULL, NULL, NULL,
    'Attention students. The Business Communication Workshop scheduled for Wednesday has been moved to Thursday due to unavoidable circumstances. The venue remains Seminar Hall 1. All registered participants are requested to attend.',
    1, 3, NULL, NULL, NULL, NULL, NULL,
    'The workshop date moved from Wednesday to Thursday.'
  ),
  (
    '22222222-2222-4222-8222-222222222330',
    '22222222-2222-4222-8222-222222222201',
    'Listen and answer',
    'Questions 26–30. Listen to the recording. The script is spoken and is not shown during the test.',
    5,
    'What does the team decide to do first?',
    'listening', NULL, NULL, NULL, NULL,
    'We have only two days left for the college fest. I suggest we finalise the event schedule first. Agreed. After that, we can assign responsibilities. Perfect. I''ll prepare the schedule and share it with everyone.',
    1, 4, NULL, NULL, NULL, NULL, NULL,
    'They agree to finalise the event schedule first.'
  ),
  (
    '22222222-2222-4222-8222-222222222331',
    '22222222-2222-4222-8222-222222222201',
    'Match the pairs',
    'Questions 31–35. Choose the meaning of each expression.',
    6,
    'Follow up',
    'match', NULL, NULL, NULL, NULL, NULL,
    1, 0, NULL, NULL, NULL, NULL, NULL,
    'Follow up means to contact someone again.'
  ),
  (
    '22222222-2222-4222-8222-222222222332',
    '22222222-2222-4222-8222-222222222201',
    'Match the pairs',
    'Questions 31–35. Choose the meaning of each expression.',
    6,
    'Prioritise',
    'match', NULL, NULL, NULL, NULL, NULL,
    1, 1, NULL, NULL, NULL, NULL, NULL,
    'Prioritise means to decide what is most important.'
  ),
  (
    '22222222-2222-4222-8222-222222222333',
    '22222222-2222-4222-8222-222222222201',
    'Match the pairs',
    'Questions 31–35. Choose the meaning of each expression.',
    6,
    'Collaborate',
    'match', NULL, NULL, NULL, NULL, NULL,
    1, 2, NULL, NULL, NULL, NULL, NULL,
    'Collaborate means to work together.'
  ),
  (
    '22222222-2222-4222-8222-222222222334',
    '22222222-2222-4222-8222-222222222201',
    'Match the pairs',
    'Questions 31–35. Choose the meaning of each expression.',
    6,
    'Look into',
    'match', NULL, NULL, NULL, NULL, NULL,
    1, 3, NULL, NULL, NULL, NULL, NULL,
    'Look into means to investigate something.'
  ),
  (
    '22222222-2222-4222-8222-222222222335',
    '22222222-2222-4222-8222-222222222201',
    'Match the pairs',
    'Questions 31–35. Choose the meaning of each expression.',
    6,
    'Put off',
    'match', NULL, NULL, NULL, NULL, NULL,
    1, 4, NULL, NULL, NULL, NULL, NULL,
    'Put off means to postpone something.'
  ),
  (
    '22222222-2222-4222-8222-222222222336',
    '22222222-2222-4222-8222-222222222201',
    'Arrange the words',
    'Questions 36–39. Put the words in the correct order.',
    7,
    'Arrange the words into a sentence.',
    'order', NULL, NULL, NULL, NULL, NULL,
    1, 0, NULL, NULL,
    'My interview is scheduled tomorrow.',
    ARRAY['interview', 'tomorrow', 'my', 'scheduled', 'is'],
    NULL, NULL
  ),
  (
    '22222222-2222-4222-8222-222222222337',
    '22222222-2222-4222-8222-222222222201',
    'Arrange the words',
    'Questions 36–39. Put the words in the correct order.',
    7,
    'Arrange the words into a sentence.',
    'order', NULL, NULL, NULL, NULL, NULL,
    1, 1, NULL, NULL,
    'Please submit the report before the deadline.',
    ARRAY['please', 'report', 'submit', 'the', 'before', 'deadline', 'the'],
    NULL, NULL
  ),
  (
    '22222222-2222-4222-8222-222222222338',
    '22222222-2222-4222-8222-222222222201',
    'Arrange the words',
    'Questions 36–39. Put the words in the correct order.',
    7,
    'Arrange the words into a sentence.',
    'order', NULL, NULL, NULL, NULL, NULL,
    1, 2, NULL, NULL,
    'The team successfully completed the project.',
    ARRAY['team', 'successfully', 'the', 'completed', 'project', 'the'],
    NULL, NULL
  ),
  (
    '22222222-2222-4222-8222-222222222339',
    '22222222-2222-4222-8222-222222222201',
    'Arrange the words',
    'Questions 36–39. Put the words in the correct order.',
    7,
    'Arrange the words into a sentence.',
    'order', NULL, NULL, NULL, NULL, NULL,
    1, 3, NULL, NULL,
    'I truly appreciate this opportunity.',
    ARRAY['opportunity', 'I', 'appreciate', 'this', 'truly'],
    NULL, NULL
  ),
  (
    '22222222-2222-4222-8222-222222222340',
    '22222222-2222-4222-8222-222222222201',
    'Identify the error',
    'Questions 40–43. Choose the correct replacement.',
    8,
    'She don''t know the interview schedule. Which word should be replaced?',
    'choice', NULL, NULL, NULL, NULL, NULL,
    1, 0, NULL, NULL, NULL, NULL, NULL,
    'don''t should be doesn''t.'
  ),
  (
    '22222222-2222-4222-8222-222222222341',
    '22222222-2222-4222-8222-222222222201',
    'Identify the error',
    'Questions 40–43. Choose the correct replacement.',
    8,
    'I am interested on this internship. Replace the incorrect preposition.',
    'choice', NULL, NULL, NULL, NULL, NULL,
    1, 1, NULL, NULL, NULL, NULL, NULL,
    'Interested on should be interested in.'
  ),
  (
    '22222222-2222-4222-8222-222222222342',
    '22222222-2222-4222-8222-222222222201',
    'Identify the error',
    'Questions 40–43. Choose the correct replacement.',
    8,
    'He have submitted the assignment. Replace the incorrect verb.',
    'choice', NULL, NULL, NULL, NULL, NULL,
    1, 2, NULL, NULL, NULL, NULL, NULL,
    'He have should be He has.'
  ),
  (
    '22222222-2222-4222-8222-222222222343',
    '22222222-2222-4222-8222-222222222201',
    'Identify the error',
    'Questions 40–43. Choose the correct replacement.',
    8,
    'I have completed the work yesterday. Choose the corrected sentence.',
    'choice', NULL, NULL, NULL, NULL, NULL,
    1, 3, NULL, NULL, NULL, NULL, NULL,
    'Yesterday needs the past simple: I completed the work yesterday.'
  ),
  (
    '22222222-2222-4222-8222-222222222344',
    '22222222-2222-4222-8222-222222222201',
    'Complete the conversation',
    'Questions 44–47. Choose the most appropriate response.',
    9,
    'Recruiter: "Could you briefly introduce yourself?" You:',
    'choice', NULL, NULL, NULL, NULL, NULL,
    1, 0, NULL, NULL, NULL, NULL, NULL,
    'Give your name, course, and an interest.'
  ),
  (
    '22222222-2222-4222-8222-222222222345',
    '22222222-2222-4222-8222-222222222201',
    'Complete the conversation',
    'Questions 44–47. Choose the most appropriate response.',
    9,
    'Professor: "Why were you absent yesterday?" You:',
    'choice', NULL, NULL, NULL, NULL, NULL,
    1, 1, NULL, NULL, NULL, NULL, NULL,
    'Explain the reason and apologise.'
  ),
  (
    '22222222-2222-4222-8222-222222222346',
    '22222222-2222-4222-8222-222222222201',
    'Complete the conversation',
    'Questions 44–47. Choose the most appropriate response.',
    9,
    'Colleague: "Could you help me review this presentation?" You:',
    'choice', NULL, NULL, NULL, NULL, NULL,
    1, 2, NULL, NULL, NULL, NULL, NULL,
    'Agree to help.'
  ),
  (
    '22222222-2222-4222-8222-222222222347',
    '22222222-2222-4222-8222-222222222201',
    'Complete the conversation',
    'Questions 44–47. Choose the most appropriate response.',
    9,
    'Manager: "The client has requested a few changes." You:',
    'choice', NULL, NULL, NULL, NULL, NULL,
    1, 3, NULL, NULL, NULL, NULL, NULL,
    'Confirm that you will review the feedback and make the changes.'
  ),
  (
    '22222222-2222-4222-8222-222222222348',
    '22222222-2222-4222-8222-222222222201',
    'Real-world communication',
    'Questions 48–50. Write your own answer. The mark is for a clear message, not one fixed sentence.',
    10,
    'The Professional Message. You have an interview tomorrow at 10 AM. Your friend asks you for the details. Write a short message informing your friend about the interview.',
    'written', NULL, NULL, NULL, NULL, NULL,
    1, 0, 8, NULL, NULL, NULL,
    '[["interview"],["10","ten"]]'::jsonb,
    '1 mark for a clear message that mentions the interview and the 10 AM time.'
  ),
  (
    '22222222-2222-4222-8222-222222222349',
    '22222222-2222-4222-8222-222222222201',
    'Real-world communication',
    'Questions 48–50. Write your own answer. The mark is for a clear message, not one fixed sentence.',
    10,
    'The Polite Request. Your professor has asked you to submit an assignment today, but you need one additional day. Write one polite sentence requesting an extension.',
    'written', NULL, NULL, NULL, NULL, NULL,
    1, 1, 6, NULL, NULL, NULL,
    '[["please","would","could","may"],["extension","extend","day","deadline"]]'::jsonb,
    '1 mark for a respectful sentence that asks for more time or an extension.'
  ),
  (
    '22222222-2222-4222-8222-222222222350',
    '22222222-2222-4222-8222-222222222201',
    'Real-world communication',
    'Questions 48–50. Write your own answer. The mark is for a clear message, not one fixed sentence.',
    10,
    'The Confidence Challenge. You are attending a college placement orientation. Introduce yourself in 3–4 sentences. Include your name and course, one strength or area of interest, and one professional or personal goal.',
    'written', NULL, NULL, NULL, NULL, NULL,
    1, 2, 20, NULL, NULL, NULL,
    NULL,
    '1 mark for about 3–4 sentences. The score checks length because each student uses their own name, course, and goal.'
  );

INSERT INTO public.assessment_options (question_id, label, is_correct, sort_order)
VALUES
  ('22222222-2222-4222-8222-222222222301', 'At', false, 0),
  ('22222222-2222-4222-8222-222222222301', 'On', true, 1),
  ('22222222-2222-4222-8222-222222222301', 'In', false, 2),
  ('22222222-2222-4222-8222-222222222301', 'By', false, 3),
  ('22222222-2222-4222-8222-222222222302', 'She don''t attend meetings regularly.', false, 0),
  ('22222222-2222-4222-8222-222222222302', 'She doesn''t attends meetings regularly.', false, 1),
  ('22222222-2222-4222-8222-222222222302', 'She doesn''t attend meetings regularly.', true, 2),
  ('22222222-2222-4222-8222-222222222302', 'She not attending meetings regularly.', false, 3),
  ('22222222-2222-4222-8222-222222222303', 'Give me two more days.', false, 0),
  ('22222222-2222-4222-8222-222222222303', 'I can''t finish it now.', false, 1),
  ('22222222-2222-4222-8222-222222222303', 'Would it be possible to extend the submission deadline by two days?', true, 2),
  ('22222222-2222-4222-8222-222222222303', 'You have to give me more time.', false, 3),
  ('22222222-2222-4222-8222-222222222304', 'Collaboration', true, 0),
  ('22222222-2222-4222-8222-222222222304', 'Isolation', false, 1),
  ('22222222-2222-4222-8222-222222222304', 'Hesitation', false, 2),
  ('22222222-2222-4222-8222-222222222304', 'Interruption', false, 3),
  ('22222222-2222-4222-8222-222222222305', 'Hear', false, 0),
  ('22222222-2222-4222-8222-222222222305', 'Hearing', true, 1),
  ('22222222-2222-4222-8222-222222222305', 'Heard', false, 2),
  ('22222222-2222-4222-8222-222222222305', 'Have heard', false, 3),
  ('22222222-2222-4222-8222-222222222306', 'Hi', false, 0),
  ('22222222-2222-4222-8222-222222222306', 'Important', false, 1),
  ('22222222-2222-4222-8222-222222222306', 'Submission of Internship Report – Priya', true, 2),
  ('22222222-2222-4222-8222-222222222306', 'Please See', false, 3),
  ('22222222-2222-4222-8222-222222222315', 'The students are attending a cultural programme.', false, 0),
  ('22222222-2222-4222-8222-222222222315', 'The students are collaborating on a group project.', true, 1),
  ('22222222-2222-4222-8222-222222222315', 'The students are waiting for their examination.', false, 2),
  ('22222222-2222-4222-8222-222222222315', 'The students are attending an interview.', false, 3),
  ('22222222-2222-4222-8222-222222222316', 'Conducting a presentation.', true, 0),
  ('22222222-2222-4222-8222-222222222316', 'Attending a farewell party.', false, 1),
  ('22222222-2222-4222-8222-222222222316', 'Completing a written examination.', false, 2),
  ('22222222-2222-4222-8222-222222222316', 'Participating in a sports event.', false, 3),
  ('22222222-2222-4222-8222-222222222317', 'Watching an entertainment video.', false, 0),
  ('22222222-2222-4222-8222-222222222317', 'Preparing a professional communication.', true, 1),
  ('22222222-2222-4222-8222-222222222317', 'Playing an online game.', false, 2),
  ('22222222-2222-4222-8222-222222222317', 'Browsing shopping websites.', false, 3),
  ('22222222-2222-4222-8222-222222222318', 'Active listening.', true, 0),
  ('22222222-2222-4222-8222-222222222318', 'Public speaking.', false, 1),
  ('22222222-2222-4222-8222-222222222318', 'Negotiation.', false, 2),
  ('22222222-2222-4222-8222-222222222318', 'Written communication.', false, 3),
  ('22222222-2222-4222-8222-222222222320', 'BrightPath Technologies', true, 0),
  ('22222222-2222-4222-8222-222222222320', 'Future Skills Academy', false, 1),
  ('22222222-2222-4222-8222-222222222320', 'Digital World Solutions', false, 2),
  ('22222222-2222-4222-8222-222222222320', 'Career Connect', false, 3),
  ('22222222-2222-4222-8222-222222222321', 'Auditorium 1', false, 0),
  ('22222222-2222-4222-8222-222222222321', 'Seminar Hall 2', true, 1),
  ('22222222-2222-4222-8222-222222222321', 'Computer Laboratory', false, 2),
  ('22222222-2222-4222-8222-222222222321', 'Library', false, 3),
  ('22222222-2222-4222-8222-222222222322', '9:00 AM', true, 0),
  ('22222222-2222-4222-8222-222222222322', '9:30 AM', false, 1),
  ('22222222-2222-4222-8222-222222222322', '10:00 AM', false, 2),
  ('22222222-2222-4222-8222-222222222322', '8:30 AM', false, 3),
  ('22222222-2222-4222-8222-222222222323', 'She could not use a computer.', false, 0),
  ('22222222-2222-4222-8222-222222222323', 'She hesitated to share ideas.', true, 1),
  ('22222222-2222-4222-8222-222222222323', 'She did not understand marketing.', false, 2),
  ('22222222-2222-4222-8222-222222222323', 'She wanted to leave the internship.', false, 3),
  ('22222222-2222-4222-8222-222222222324', 'Attend fewer meetings.', false, 0),
  ('22222222-2222-4222-8222-222222222324', 'Prepare another report every day.', false, 1),
  ('22222222-2222-4222-8222-222222222324', 'Contribute at least one idea in each meeting.', true, 2),
  ('22222222-2222-4222-8222-222222222324', 'Avoid asking questions.', false, 3),
  ('22222222-2222-4222-8222-222222222325', 'Professional growth requires consistent practice.', true, 0),
  ('22222222-2222-4222-8222-222222222325', 'Internships are only about completing assignments.', false, 1),
  ('22222222-2222-4222-8222-222222222325', 'Experienced employees never make mistakes.', false, 2),
  ('22222222-2222-4222-8222-222222222325', 'Confidence develops without effort.', false, 3),
  ('22222222-2222-4222-8222-222222222326', 'Resume and college ID card.', true, 0),
  ('22222222-2222-4222-8222-222222222326', 'Laptop and notebook.', false, 1),
  ('22222222-2222-4222-8222-222222222326', 'Project report and fee receipt.', false, 2),
  ('22222222-2222-4222-8222-222222222326', 'Passport and bank statement.', false, 3),
  ('22222222-2222-4222-8222-222222222327', 'Cancel the presentation.', false, 0),
  ('22222222-2222-4222-8222-222222222327', 'Verify the figures and submit the presentation.', true, 1),
  ('22222222-2222-4222-8222-222222222327', 'Contact the client immediately.', false, 2),
  ('22222222-2222-4222-8222-222222222327', 'Prepare a completely new report.', false, 3),
  ('22222222-2222-4222-8222-222222222328', 'Before 10 AM.', false, 0),
  ('22222222-2222-4222-8222-222222222328', 'At lunchtime.', false, 1),
  ('22222222-2222-4222-8222-222222222328', 'After 3 PM.', true, 2),
  ('22222222-2222-4222-8222-222222222328', 'The next morning.', false, 3),
  ('22222222-2222-4222-8222-222222222329', 'To cancel the workshop.', false, 0),
  ('22222222-2222-4222-8222-222222222329', 'To change the venue.', false, 1),
  ('22222222-2222-4222-8222-222222222329', 'To announce a change in the workshop date.', true, 2),
  ('22222222-2222-4222-8222-222222222329', 'To invite new participants.', false, 3),
  ('22222222-2222-4222-8222-222222222330', 'Print the certificates.', false, 0),
  ('22222222-2222-4222-8222-222222222330', 'Finalise the event schedule.', true, 1),
  ('22222222-2222-4222-8222-222222222330', 'Cancel the event.', false, 2),
  ('22222222-2222-4222-8222-222222222330', 'Invite the chief guest.', false, 3),
  ('22222222-2222-4222-8222-222222222331', 'Work together.', false, 0),
  ('22222222-2222-4222-8222-222222222331', 'Investigate something.', false, 1),
  ('22222222-2222-4222-8222-222222222331', 'Contact someone again.', true, 2),
  ('22222222-2222-4222-8222-222222222331', 'Decide what is most important.', false, 3),
  ('22222222-2222-4222-8222-222222222331', 'Postpone something.', false, 4),
  ('22222222-2222-4222-8222-222222222332', 'Work together.', false, 0),
  ('22222222-2222-4222-8222-222222222332', 'Investigate something.', false, 1),
  ('22222222-2222-4222-8222-222222222332', 'Contact someone again.', false, 2),
  ('22222222-2222-4222-8222-222222222332', 'Decide what is most important.', true, 3),
  ('22222222-2222-4222-8222-222222222332', 'Postpone something.', false, 4),
  ('22222222-2222-4222-8222-222222222333', 'Work together.', true, 0),
  ('22222222-2222-4222-8222-222222222333', 'Investigate something.', false, 1),
  ('22222222-2222-4222-8222-222222222333', 'Contact someone again.', false, 2),
  ('22222222-2222-4222-8222-222222222333', 'Decide what is most important.', false, 3),
  ('22222222-2222-4222-8222-222222222333', 'Postpone something.', false, 4),
  ('22222222-2222-4222-8222-222222222334', 'Work together.', false, 0),
  ('22222222-2222-4222-8222-222222222334', 'Investigate something.', true, 1),
  ('22222222-2222-4222-8222-222222222334', 'Contact someone again.', false, 2),
  ('22222222-2222-4222-8222-222222222334', 'Decide what is most important.', false, 3),
  ('22222222-2222-4222-8222-222222222334', 'Postpone something.', false, 4),
  ('22222222-2222-4222-8222-222222222335', 'Work together.', false, 0),
  ('22222222-2222-4222-8222-222222222335', 'Investigate something.', false, 1),
  ('22222222-2222-4222-8222-222222222335', 'Contact someone again.', false, 2),
  ('22222222-2222-4222-8222-222222222335', 'Decide what is most important.', false, 3),
  ('22222222-2222-4222-8222-222222222335', 'Postpone something.', true, 4),
  ('22222222-2222-4222-8222-222222222340', 'She → Her', false, 0),
  ('22222222-2222-4222-8222-222222222340', 'don''t → doesn''t', true, 1),
  ('22222222-2222-4222-8222-222222222340', 'know → knows', false, 2),
  ('22222222-2222-4222-8222-222222222340', 'schedule → scheduling', false, 3),
  ('22222222-2222-4222-8222-222222222341', 'On → In', true, 0),
  ('22222222-2222-4222-8222-222222222341', 'On → At', false, 1),
  ('22222222-2222-4222-8222-222222222341', 'On → By', false, 2),
  ('22222222-2222-4222-8222-222222222341', 'On → From', false, 3),
  ('22222222-2222-4222-8222-222222222342', 'Have → Has', true, 0),
  ('22222222-2222-4222-8222-222222222342', 'Have → Had been', false, 1),
  ('22222222-2222-4222-8222-222222222342', 'Submitted → Submitting', false, 2),
  ('22222222-2222-4222-8222-222222222342', 'Assignment → Assignments', false, 3),
  ('22222222-2222-4222-8222-222222222343', 'I have complete the work yesterday.', false, 0),
  ('22222222-2222-4222-8222-222222222343', 'I completed the work yesterday.', true, 1),
  ('22222222-2222-4222-8222-222222222343', 'I completing the work yesterday.', false, 2),
  ('22222222-2222-4222-8222-222222222343', 'I has completed the work yesterday.', false, 3),
  ('22222222-2222-4222-8222-222222222344', 'What do you want to know?', false, 0),
  ('22222222-2222-4222-8222-222222222344', 'My name is Priya. I am pursuing B.Com and have a strong interest in marketing and communication.', true, 1),
  ('22222222-2222-4222-8222-222222222344', 'I don''t know where to start.', false, 2),
  ('22222222-2222-4222-8222-222222222344', 'My friend knows me well.', false, 3),
  ('22222222-2222-4222-8222-222222222345', 'I didn''t feel like coming.', false, 0),
  ('22222222-2222-4222-8222-222222222345', 'That''s not important.', false, 1),
  ('22222222-2222-4222-8222-222222222345', 'I was unwell yesterday. I apologise for missing the class.', true, 2),
  ('22222222-2222-4222-8222-222222222345', 'I was doing something else.', false, 3),
  ('22222222-2222-4222-8222-222222222346', 'That''s not my work.', false, 0),
  ('22222222-2222-4222-8222-222222222346', 'Sure. I''d be happy to review it.', true, 1),
  ('22222222-2222-4222-8222-222222222346', 'Why should I?', false, 2),
  ('22222222-2222-4222-8222-222222222346', 'I don''t want to.', false, 3),
  ('22222222-2222-4222-8222-222222222347', 'That''s impossible.', false, 0),
  ('22222222-2222-4222-8222-222222222347', 'I don''t care.', false, 1),
  ('22222222-2222-4222-8222-222222222347', 'Understood. I''ll review the feedback and make the necessary changes.', true, 2),
  ('22222222-2222-4222-8222-222222222347', 'Ask someone else.', false, 3);

COMMIT;
