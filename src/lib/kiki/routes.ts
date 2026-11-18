export interface AssistantLink {
  label: string;
  path: string;
}

const learnerPaths = new Set([
  '/',
  '/programs',
  '/cart',
  '/checkout',
  '/enrolled-courses',
  '/career-test',
  '/login',
]);

const adminPaths = new Set([
  '/admin',
  '/admin/users',
  '/admin/courses',
  '/admin/assessments',
  '/admin/progress',
  '/admin/career-test',
  '/admin/enrollments',
  '/admin/homepage',
  '/admin/coupons',
]);

const coursePath = /^\/course\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const hiddenAssistantPaths = new Set(['/login', '/admin-login', '/auth/confirm']);

export const studentSuggestions = [
  'Show me the courses I can join.',
  'Which courses am I enrolled in?',
  'How do I check my assessment scores?',
  'How do I enroll in a course?',
];

export const adminSuggestions = [
  'How do I add an assessment?',
  'How do I add a course?',
  'How many courses are available?',
  'Give me an overview of the platform.',
];

const normalizeQuestion = (question: string) => question.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();

const relatedPool = (asked: string, isAdmin: boolean): string[] => {
  if (/(add|create|new|upload).{0,24}(assessment|question)|(assessment|question).{0,24}(add|create)/.test(asked)) {
    return isAdmin
      ? ['How do I add a course?', 'How do I upload course materials?', 'Where do I see student scores?', 'How many courses are available?']
      : ['How do I enroll in a course?', 'Where do I find my assessments?', 'Which courses am I enrolled in?'];
  }
  if (/(material|document|upload a file)/.test(asked)) {
    return isAdmin
      ? ['How do I add a course?', 'How do I add an assessment?', 'How many courses are available?']
      : ['Show me the courses I can join.', 'How do I enroll in a course?'];
  }
  if (/(how do i enroll|enroll in a course|join a course)/.test(asked)) {
    return ['Show me the courses I can join.', 'Which courses am I enrolled in?', 'How do I check my assessment scores?'];
  }
  if (/(thumbnail|image size|aspect ratio|add a new course|create a course|where can i add)/.test(asked)) {
    return isAdmin
      ? ['How many courses are available?', 'Show me the courses I can join.', 'Give me an overview of the platform.']
      : ['Show me the courses I can join.', 'How do I enroll in a course?', 'Which courses am I enrolled in?'];
  }
  if (/(how many courses|number of courses|count of courses)/.test(asked)) {
    return isAdmin
      ? ['Show me the courses I can join.', 'Which course has the highest enrollment?', 'Give me an overview of the platform.', 'How many registered users are there?']
      : ['Show me the courses I can join.', 'Which courses am I enrolled in?', 'How do I enroll in a course?'];
  }
  if (/(how many users|registered users|how many people|inactive users)/.test(asked)) {
    return isAdmin
      ? ['Which course has the highest enrollment?', 'Give me an overview of the platform.', 'How many courses are available?', 'What is the average assessment score?']
      : studentSuggestions;
  }
  if (/(highest enrollment|most users|most enrolled)/.test(asked)) {
    return isAdmin
      ? ['Show me the courses I can join.', 'How many registered users are there?', 'Give me an overview of the platform.', 'What is the average assessment score?']
      : ['Show me the courses I can join.', 'Which courses am I enrolled in?', 'How do I enroll in a course?'];
  }
  if (/(overview|platform summary)/.test(asked)) {
    return isAdmin
      ? ['How many courses are available?', 'How many registered users are there?', 'Which course has the highest enrollment?', 'Which users are inactive?']
      : ['Show me the courses I can join.', 'Which courses am I enrolled in?', 'How do I check my assessment scores?'];
  }
  if (/(average score|average assessment)/.test(asked)) {
    return isAdmin
      ? ['Give me an overview of the platform.', 'Which course has the highest enrollment?', 'How many courses are available?']
      : ['How do I check my assessment scores?', 'Which courses am I enrolled in?', 'Show me the courses I can join.'];
  }
  if (/(my enrollment|am i enrolled|courses am i|my courses|my learning)/.test(asked)) {
    return ['How do I check my assessment scores?', 'Show me the courses I can join.', 'How do I enroll in a course?'];
  }
  if (/(assessment score|my score|my attempt|check my assessment)/.test(asked)) {
    return ['Which courses am I enrolled in?', 'Show me the courses I can join.', 'How do I enroll in a course?'];
  }
  if (/(courses i can join|available courses|show me the courses|show courses|list courses|what courses)/.test(asked)) {
    return isAdmin
      ? ['How many courses are available?', 'Which course has the highest enrollment?', 'How do I enroll in a course?', 'Give me an overview of the platform.']
      : ['How do I enroll in a course?', 'Which courses am I enrolled in?', 'How do I check my assessment scores?'];
  }
  return isAdmin ? adminSuggestions : studentSuggestions;
};

export const followUpQuestions = (question: string, isAdmin: boolean): string[] => {
  const asked = normalizeQuestion(question);
  const starters = isAdmin ? adminSuggestions : studentSuggestions;
  const unique: string[] = [];
  for (const item of [...relatedPool(asked, isAdmin), ...starters]) {
    if (normalizeQuestion(item) === asked || unique.includes(item)) {
      continue;
    }
    unique.push(item);
    if (unique.length === 4) {
      break;
    }
  }
  return unique;
};

export const starterQuestions = (isAdmin: boolean): string[] => (isAdmin ? adminSuggestions : studentSuggestions);

export const sanitizeAssistantLinks = (links: AssistantLink[], isAdmin: boolean): AssistantLink[] => {
  const seen = new Set<string>();
  const cleaned: AssistantLink[] = [];
  for (const link of links) {
    const path = link.path.trim();
    const label = link.label.trim();
    const isAllowed = learnerPaths.has(path) || coursePath.test(path) || (isAdmin && adminPaths.has(path));
    if (!label || seen.has(path) || !isAllowed) {
      continue;
    }
    seen.add(path);
    cleaned.push({ label, path });
  }
  return cleaned.slice(0, 8);
};
