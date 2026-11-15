export type AssessmentQuestionKind = 'choice' | 'blank' | 'match' | 'order' | 'written' | 'listening';

interface AssessmentQuestionBase {
  id: number;
  prompt: string;
}

export interface ChoiceAssessmentQuestion extends AssessmentQuestionBase {
  kind: 'choice' | 'listening';
  detail?: string;
  picture?: string;
  passageTitle?: string;
  passage?: string;
  listeningScript?: string;
  choices: string[];
  answer: string;
}

export interface BlankAssessmentQuestion extends AssessmentQuestionBase {
  kind: 'blank';
  accepted: string[];
}

export interface MatchAssessmentQuestion extends AssessmentQuestionBase {
  kind: 'match';
  choices: string[];
  answer: string;
}

export interface OrderAssessmentQuestion extends AssessmentQuestionBase {
  kind: 'order';
  words: string[];
  answer: string;
}

export interface WrittenAssessmentQuestion extends AssessmentQuestionBase {
  kind: 'written';
  picture?: string;
  guidance: string;
  minimumWords: number;
  requiredPhrases?: string[][];
}

export type AssessmentQuestion =
  | ChoiceAssessmentQuestion
  | BlankAssessmentQuestion
  | MatchAssessmentQuestion
  | OrderAssessmentQuestion
  | WrittenAssessmentQuestion;

export interface AssessmentSection {
  title: string;
  instructions: string;
  questions: AssessmentQuestion[];
}

const matchMeanings = [
  'A. Work together.',
  'B. Investigate something.',
  'C. Contact someone again.',
  'D. Decide what is most important.',
  'E. Postpone something.',
];

export const englishSkillsAssessment = {
  title: 'English That Works!',
  eyebrow: 'Month 1 – English Skills Challenge',
  audience: 'First-year undergraduate students',
  questionCount: 50,
  marks: 50,
  duration: '30–35 minutes',
  sections: [
    {
      title: 'Choose the correct answer',
      instructions: 'Questions 1–6. Choose one answer.',
      questions: [
        {
          id: 1,
          kind: 'choice',
          prompt: 'Complete the sentence. The placement interview is scheduled ___ 26 February.',
          choices: ['A. At', 'B. On', 'C. In', 'D. By'],
          answer: 'B',
        },
        {
          id: 2,
          kind: 'choice',
          prompt: 'Choose the correct sentence.',
          choices: [
            "A. She don't attend meetings regularly.",
            "B. She doesn't attends meetings regularly.",
            "C. She doesn't attend meetings regularly.",
            'D. She not attending meetings regularly.',
          ],
          answer: 'C',
        },
        {
          id: 3,
          kind: 'choice',
          prompt: 'Select the most professional expression. You want to ask your professor for an extension.',
          choices: [
            'A. Give me two more days.',
            "B. I can't finish it now.",
            'C. Would it be possible to extend the submission deadline by two days?',
            'D. You have to give me more time.',
          ],
          answer: 'C',
        },
        {
          id: 4,
          kind: 'choice',
          prompt: 'The company is looking for candidates who can work effectively in a team. They should be good at:',
          choices: ['A. Collaboration', 'B. Isolation', 'C. Hesitation', 'D. Interruption'],
          answer: 'A',
        },
        {
          id: 5,
          kind: 'choice',
          prompt: 'Choose the correct expression. I look forward to ___ from you.',
          choices: ['A. Hear', 'B. Hearing', 'C. Heard', 'D. Have heard'],
          answer: 'B',
        },
        {
          id: 6,
          kind: 'choice',
          prompt: 'Which is the most suitable email subject line? You are sending your completed internship report to your supervisor.',
          choices: ['A. Hi', 'B. Important', 'C. Submission of Internship Report – Priya', 'D. Please See'],
          answer: 'C',
        },
      ],
    },
    {
      title: 'Fill in the blanks',
      instructions: 'Questions 7–14. Type the missing word.',
      questions: [
        { id: 7, kind: 'blank', prompt: 'The HR manager will meet the candidates ___ 10 AM.', accepted: ['at'] },
        { id: 8, kind: 'blank', prompt: 'We have been preparing for the college event ___ Monday.', accepted: ['since'] },
        { id: 9, kind: 'blank', prompt: 'Each student ___ required to carry their college ID card.', accepted: ['is'] },
        { id: 10, kind: 'blank', prompt: 'Please ___ the attached document before the meeting.', accepted: ['review'] },
        { id: 11, kind: 'blank', prompt: 'The team needs to ___ the most urgent tasks first.', accepted: ['prioritise', 'prioritize'] },
        { id: 12, kind: 'blank', prompt: 'I am interested ___ the internship opportunity.', accepted: ['in'] },
        { id: 13, kind: 'blank', prompt: 'The manager asked us to ___ the proposal before Friday.', accepted: ['finalise', 'finalize', 'review'] },
        { id: 14, kind: 'blank', prompt: 'The new employee is responsible ___ coordinating the training programme.', accepted: ['for'] },
      ],
    },
    {
      title: 'Picture composition',
      instructions: 'Questions 15–19. Read the picture description, then answer.',
      questions: [
        {
          id: 15,
          kind: 'choice',
          prompt: 'The Teamwork Test. Which sentence best describes the picture?',
          picture: 'Three college students sitting around a laptop, discussing a project, sharing notes and working together.',
          choices: [
            'A. The students are attending a cultural programme.',
            'B. The students are collaborating on a group project.',
            'C. The students are waiting for their examination.',
            'D. The students are attending an interview.',
          ],
          answer: 'B',
        },
        {
          id: 16,
          kind: 'choice',
          prompt: 'The Professional Meeting. What is the employee doing?',
          picture: 'A young employee presenting a chart to two managers in a meeting room.',
          choices: [
            'A. Conducting a presentation.',
            'B. Attending a farewell party.',
            'C. Completing a written examination.',
            'D. Participating in a sports event.',
          ],
          answer: 'A',
        },
        {
          id: 17,
          kind: 'choice',
          prompt: 'The Email Situation. What is the most likely activity?',
          picture: 'A student sitting at a desk with a laptop open, reviewing a professional email and a calendar.',
          choices: [
            'A. Watching an entertainment video.',
            'B. Preparing a professional communication.',
            'C. Playing an online game.',
            'D. Browsing shopping websites.',
          ],
          answer: 'B',
        },
        {
          id: 18,
          kind: 'choice',
          prompt: 'The Listening Challenge. Which communication skill is demonstrated?',
          picture: 'Two people having a conversation. One person is speaking while the other is listening attentively, maintaining eye contact and taking notes.',
          choices: ['A. Active listening.', 'B. Public speaking.', 'C. Negotiation.', 'D. Written communication.'],
          answer: 'A',
        },
        {
          id: 19,
          kind: 'written',
          prompt: 'Describe What You See. Write one meaningful sentence describing the picture.',
          picture: 'A college placement drive with students waiting in a queue outside an interview room, holding resumes.',
          guidance: 'One mark for a sentence that describes students waiting for interviews or holding resumes.',
          minimumWords: 6,
          requiredPhrases: [['student', 'students'], ['interview', 'resume', 'placement', 'queue', 'waiting']],
        },
      ],
    },
    {
      title: 'Read and answer',
      instructions: 'Questions 20–25. Read each passage, then answer.',
      questions: [
        {
          id: 20,
          kind: 'choice',
          prompt: 'Which company is conducting the recruitment drive?',
          passageTitle: 'Passage A – The Placement Announcement',
          passage: 'The campus recruitment drive for BrightPath Technologies will take place on Friday, 6 March, at 9:30 AM in Seminar Hall 2. Eligible students must bring two copies of their updated resume, a college ID card, and one passport-size photograph. Students are requested to report at least 30 minutes before the scheduled time. Formal attire is compulsory.',
          choices: ['A. BrightPath Technologies', 'B. Future Skills Academy', 'C. Digital World Solutions', 'D. Career Connect'],
          answer: 'A',
        },
        {
          id: 21,
          kind: 'choice',
          prompt: 'Where should students report?',
          passageTitle: 'Passage A – The Placement Announcement',
          choices: ['A. Auditorium 1', 'B. Seminar Hall 2', 'C. Computer Laboratory', 'D. Library'],
          answer: 'B',
        },
        {
          id: 22,
          kind: 'choice',
          prompt: 'At what time should students ideally report?',
          passageTitle: 'Passage A – The Placement Announcement',
          choices: ['A. 9:00 AM', 'B. 9:30 AM', 'C. 10:00 AM', 'D. 8:30 AM'],
          answer: 'A',
        },
        {
          id: 23,
          kind: 'choice',
          prompt: "What was Ananya's initial challenge?",
          passageTitle: 'Passage B – The Internship Experience',
          passage: 'Ananya joined a marketing company as an intern. During her first week, she was assigned to prepare a presentation about customer preferences. Initially, she hesitated to share her ideas during team meetings. Her supervisor encouraged her to contribute at least one idea in every meeting. Over time, Ananya became more confident. She learned that professional growth develops through observation, practice, feedback and consistent effort.',
          choices: [
            'A. She could not use a computer.',
            'B. She hesitated to share ideas.',
            'C. She did not understand marketing.',
            'D. She wanted to leave the internship.',
          ],
          answer: 'B',
        },
        {
          id: 24,
          kind: 'choice',
          prompt: 'What did her supervisor encourage her to do?',
          passageTitle: 'Passage B – The Internship Experience',
          choices: [
            'A. Attend fewer meetings.',
            'B. Prepare another report every day.',
            'C. Contribute at least one idea in each meeting.',
            'D. Avoid asking questions.',
          ],
          answer: 'C',
        },
        {
          id: 25,
          kind: 'choice',
          prompt: 'What is the main lesson from the passage?',
          passageTitle: 'Passage B – The Internship Experience',
          choices: [
            'A. Professional growth requires consistent practice.',
            'B. Internships are only about completing assignments.',
            'C. Experienced employees never make mistakes.',
            'D. Confidence develops without effort.',
          ],
          answer: 'A',
        },
      ],
    },
    {
      title: 'Listen and answer',
      instructions: 'Questions 26–30. Play each recording, then answer. The script stays hidden.',
      questions: [
        {
          id: 26,
          kind: 'listening',
          prompt: 'What should the student bring for the interview?',
          listeningScript: "Hello, everyone. This is a reminder from the Placement Cell. Tomorrow's interview will begin at 10 AM. Please arrive by 9:30 AM and carry two copies of your updated resume along with your college ID card. Formal attire is compulsory.",
          choices: ['A. Resume and college ID card.', 'B. Laptop and notebook.', 'C. Project report and fee receipt.', 'D. Passport and bank statement.'],
          answer: 'A',
        },
        {
          id: 27,
          kind: 'listening',
          prompt: 'What does the manager ask the employee to do?',
          listeningScript: "Good morning, Riya. Have you completed the client presentation? Almost, sir. I need to verify two figures. That's fine. Please check the figures and share the final presentation before 2 PM.",
          choices: ['A. Cancel the presentation.', 'B. Verify the figures and submit the presentation.', 'C. Contact the client immediately.', 'D. Prepare a completely new report.'],
          answer: 'B',
        },
        {
          id: 28,
          kind: 'listening',
          prompt: 'When will the student call the recruiter back?',
          listeningScript: "Hello, may I speak to Rahul? Hello, this is Rahul speaking. I'm calling regarding your internship application. Thank you for calling. I'm currently in class. Could I call you back after 3 PM? Certainly. I'll be available.",
          choices: ['A. Before 10 AM.', 'B. At lunchtime.', 'C. After 3 PM.', 'D. The next morning.'],
          answer: 'C',
        },
        {
          id: 29,
          kind: 'listening',
          prompt: 'What is the purpose of the announcement?',
          listeningScript: 'Attention students. The Business Communication Workshop scheduled for Wednesday has been moved to Thursday due to unavoidable circumstances. The venue remains Seminar Hall 1. All registered participants are requested to attend.',
          choices: ['A. To cancel the workshop.', 'B. To change the venue.', 'C. To announce a change in the workshop date.', 'D. To invite new participants.'],
          answer: 'C',
        },
        {
          id: 30,
          kind: 'listening',
          prompt: 'What does the team decide to do first?',
          listeningScript: "We have only two days left for the college fest. I suggest we finalise the event schedule first. Agreed. After that, we can assign responsibilities. Perfect. I'll prepare the schedule and share it with everyone.",
          choices: ['A. Print the certificates.', 'B. Finalise the event schedule.', 'C. Cancel the event.', 'D. Invite the chief guest.'],
          answer: 'B',
        },
      ],
    },
    {
      title: 'Match the pairs',
      instructions: 'Questions 31–35. Match each expression with its meaning.',
      questions: [
        { id: 31, kind: 'match', prompt: 'Follow up', choices: matchMeanings, answer: 'C' },
        { id: 32, kind: 'match', prompt: 'Prioritise', choices: matchMeanings, answer: 'D' },
        { id: 33, kind: 'match', prompt: 'Collaborate', choices: matchMeanings, answer: 'A' },
        { id: 34, kind: 'match', prompt: 'Look into', choices: matchMeanings, answer: 'B' },
        { id: 35, kind: 'match', prompt: 'Put off', choices: matchMeanings, answer: 'E' },
      ],
    },
    {
      title: 'Arrange the words',
      instructions: 'Questions 36–39. Arrange the words into a meaningful sentence.',
      questions: [
        { id: 36, kind: 'order', prompt: 'Arrange these words.', words: ['interview', 'tomorrow', 'my', 'scheduled', 'is'], answer: 'My interview is scheduled tomorrow.' },
        { id: 37, kind: 'order', prompt: 'Arrange these words.', words: ['please', 'report', 'submit', 'the', 'before', 'deadline', 'the'], answer: 'Please submit the report before the deadline.' },
        { id: 38, kind: 'order', prompt: 'Arrange these words.', words: ['team', 'successfully', 'the', 'completed', 'project', 'the'], answer: 'The team successfully completed the project.' },
        { id: 39, kind: 'order', prompt: 'Arrange these words.', words: ['opportunity', 'I', 'appreciate', 'this', 'truly'], answer: 'I truly appreciate this opportunity.' },
      ],
    },
    {
      title: 'Identify the error',
      instructions: 'Questions 40–43. Choose the correct replacement.',
      questions: [
        {
          id: 40,
          kind: 'choice',
          prompt: 'She don\'t know the interview schedule. Which word should be replaced?',
          choices: ['A. She → Her', "B. don't → doesn't", 'C. know → knows', 'D. schedule → scheduling'],
          answer: 'B',
        },
        {
          id: 41,
          kind: 'choice',
          prompt: 'I am interested on this internship. Replace the incorrect preposition.',
          choices: ['A. On → In', 'B. On → At', 'C. On → By', 'D. On → From'],
          answer: 'A',
        },
        {
          id: 42,
          kind: 'choice',
          prompt: 'He have submitted the assignment. Replace the incorrect verb.',
          choices: ['A. Have → Has', 'B. Have → Had been', 'C. Submitted → Submitting', 'D. Assignment → Assignments'],
          answer: 'A',
        },
        {
          id: 43,
          kind: 'choice',
          prompt: 'I have completed the work yesterday. Choose the corrected sentence.',
          choices: [
            'A. I have complete the work yesterday.',
            'B. I completed the work yesterday.',
            'C. I completing the work yesterday.',
            'D. I has completed the work yesterday.',
          ],
          answer: 'B',
        },
      ],
    },
    {
      title: 'Complete the conversation',
      instructions: 'Questions 44–47. Choose the most appropriate response.',
      questions: [
        {
          id: 44,
          kind: 'choice',
          prompt: 'Recruiter: "Could you briefly introduce yourself?"',
          choices: [
            'A. What do you want to know?',
            'B. My name is Priya. I am pursuing B.Com and have a strong interest in marketing and communication.',
            "C. I don't know where to start.",
            'D. My friend knows me well.',
          ],
          answer: 'B',
        },
        {
          id: 45,
          kind: 'choice',
          prompt: 'Professor: "Why were you absent yesterday?"',
          choices: [
            "A. I didn't feel like coming.",
            "B. That's not important.",
            'C. I was unwell yesterday. I apologise for missing the class.',
            'D. I was doing something else.',
          ],
          answer: 'C',
        },
        {
          id: 46,
          kind: 'choice',
          prompt: 'Colleague: "Could you help me review this presentation?"',
          choices: ["A. That's not my work.", "B. Sure. I'd be happy to review it.", 'C. Why should I?', "D. I don't want to."],
          answer: 'B',
        },
        {
          id: 47,
          kind: 'choice',
          prompt: 'Manager: "The client has requested a few changes."',
          choices: ["A. That's impossible.", "B. I don't care.", "C. Understood. I'll review the feedback and make the necessary changes.", 'D. Ask someone else.'],
          answer: 'C',
        },
      ],
    },
    {
      title: 'Real-world communication challenge',
      instructions: 'Questions 48–50. Write a short response for each situation.',
      questions: [
        {
          id: 48,
          kind: 'written',
          prompt: 'You have an interview tomorrow at 10 AM. Your friend asks you for the details. Write a short message informing your friend about the interview.',
          guidance: 'Include the interview and the time.',
          minimumWords: 8,
          requiredPhrases: [['interview'], ['10', 'tomorrow', 'morning', 'am']],
        },
        {
          id: 49,
          kind: 'written',
          prompt: 'Your professor has asked you to submit an assignment today, but you need one additional day. Write one polite sentence requesting an extension.',
          guidance: 'Use a respectful request and mention the extra day or extension.',
          minimumWords: 6,
          requiredPhrases: [['please', 'could', 'would', 'may'], ['day', 'extension', 'time', 'tomorrow']],
        },
        {
          id: 50,
          kind: 'written',
          prompt: 'You are attending a college placement orientation. Introduce yourself in 3–4 sentences. Include your name and course, one strength or interest, and one goal.',
          guidance: 'Write a clear introduction with your course, an interest or strength, and a goal.',
          minimumWords: 18,
          requiredPhrases: [['course', 'b.com', 'student', 'studying', 'study', 'pursuing'], ['goal', 'hope', 'want', 'aim', 'interest', 'interested']],
        },
      ],
    },
  ] satisfies AssessmentSection[],
};

export const assessmentQuestions = englishSkillsAssessment.sections.flatMap((section) => section.questions);

const normalizeAnswer = (value: string): string => {
  return value.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
};

const wordCount = (value: string): number => {
  const normalized = normalizeAnswer(value);
  return normalized ? normalized.split(' ').length : 0;
};

const choiceLetter = (value: string): string => value.trim().charAt(0).toUpperCase();

export const isQuestionCorrect = (question: AssessmentQuestion, value: string | undefined): boolean => {
  const answer = value?.trim() ?? '';
  if (!answer) {
    return false;
  }

  if (question.kind === 'choice' || question.kind === 'listening' || question.kind === 'match') {
    return choiceLetter(answer) === question.answer;
  }

  if (question.kind === 'blank') {
    return question.accepted.some((accepted) => normalizeAnswer(accepted) === normalizeAnswer(answer));
  }

  if (question.kind === 'order') {
    return normalizeAnswer(answer) === normalizeAnswer(question.answer);
  }

  if (wordCount(answer) < question.minimumWords) {
    return false;
  }

  return (question.requiredPhrases ?? []).every((phrases) =>
    phrases.some((phrase) => normalizeAnswer(answer).includes(normalizeAnswer(phrase)))
  );
};

export interface AssessmentScore {
  score: number;
  total: number;
  results: Array<{ id: number; awarded: boolean; response: string }>;
}

export const scoreAssessment = (answers: Record<number, string>): AssessmentScore => {
  const results = assessmentQuestions.map((question) => ({
    id: question.id,
    awarded: isQuestionCorrect(question, answers[question.id]),
    response: answers[question.id]?.trim() ?? '',
  }));

  return {
    score: results.filter((result) => result.awarded).length,
    total: assessmentQuestions.length,
    results,
  };
};
