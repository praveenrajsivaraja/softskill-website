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
  '/admin/sales',
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
  const matched = matchQuestion(asked);
  if (matched && 'intent' in matched && matched.intent === 'count_enrollments') {
    return isAdmin
      ? ['Which course has the highest enrollment?', 'Give me an overview of the platform.', 'How many courses are available?', 'How many registered users are there?']
      : ['Which courses am I enrolled in?', 'Show me the courses I can join.', 'How do I enroll in a course?'];
  }
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
  if (isCourseCountQuestion(asked)) {
    return isAdmin
      ? ['Show me the courses I can join.', 'Which course has the highest enrollment?', 'Give me an overview of the platform.', 'How many registered users are there?']
      : ['Show me the courses I can join.', 'Which courses am I enrolled in?', 'How do I enroll in a course?'];
  }
  if (isUserCountQuestion(asked) || /(inactive users)/.test(asked)) {
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
  return [];
};

const stopWords = new Set([
  'a', 'an', 'the', 'to', 'of', 'in', 'on', 'for', 'and', 'or', 'my', 'me', 'i',
  'do', 'does', 'is', 'are', 'am', 'how', 'what', 'where', 'which', 'can', 'please',
  'tell', 'show', 'give', 'about', 'with', 'from', 'that', 'this', 'it', 'you', 'your',
  'there', 'be', 'want', 'need', 'know',
]);

const stemWord = (word: string) => {
  if (word.startsWith('enrol')) {
    return 'enroll';
  }
  if (word.startsWith('assess')) {
    return 'assess';
  }
  if (word.endsWith('ies') && word.length > 4) {
    return `${word.slice(0, -3)}y`;
  }
  if (word.endsWith('s') && word.length > 3 && !word.endsWith('ss')) {
    return word.slice(0, -1);
  }
  return word;
};

const questionTokens = (value: string) => new Set(
  normalizeQuestion(value).split(' ').map(stemWord).filter((word) => word.length > 2 && !stopWords.has(word)),
);

const knownQuestions = (isAdmin: boolean): string[] => {
  const shared = [
    'Show me the courses I can join.',
    'Which courses am I enrolled in?',
    'How do I check my assessment scores?',
    'How do I enroll in a course?',
    'Where do I find my assessments?',
  ];
  if (!isAdmin) {
    return shared;
  }
  return [
    'How many courses are available?',
    'How many registered users are there?',
    'Which course has the highest enrollment?',
    'Give me an overview of the platform.',
    'What is the average assessment score?',
    'Which users are inactive?',
    'How do I add an assessment?',
    'How do I add a course?',
    'How do I upload course materials?',
    'Where do I see student scores?',
    'Download the sales report as Excel',
    ...shared,
  ];
};

const rankedByQuestion = (question: string, isAdmin: boolean): string[] => {
  const askedTokens = questionTokens(question);
  return knownQuestions(isAdmin)
    .map((item) => {
      const itemTokens = questionTokens(item);
      let score = 0;
      for (const word of askedTokens) {
        if (itemTokens.has(word)) {
          score += 1;
        }
      }
      return { item, score };
    })
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score || left.item.localeCompare(right.item))
    .map((entry) => entry.item);
};

export type AdminReportKind =
  | 'users'
  | 'sales'
  | 'courses'
  | 'progress'
  | 'enrollments'
  | 'assessments'
  | 'coupons'
  | 'career'
  | 'dashboard';

const exportWords = new Set(['report', 'excel', 'spreadsheet', 'export']);
const exportBlockedWords = new Set(['material', 'document', 'file', 'pdf', 'thumbnail', 'image']);
const reportSubjects: Array<[AdminReportKind, string[]]> = [
  ['progress', ['progress', 'score']],
  ['enrollments', ['enrollment']],
  ['sales', ['sale', 'revenue', 'order']],
  ['assessments', ['assessment']],
  ['coupons', ['coupon', 'discount']],
  ['career', ['career']],
  ['dashboard', ['dashboard', 'overview']],
  ['users', ['user', 'student', 'people', 'account']],
  ['courses', ['course', 'program']],
];

const reportKindFromTokens = (tokens: Set<string>): AdminReportKind | 'all' | null => {
  for (const [kind, words] of reportSubjects) {
    if (words.some((word) => tokens.has(word))) {
      return kind;
    }
  }
  if (tokens.has('all') || tokens.has('everything')) {
    return 'all';
  }
  return null;
};

export const reportKindFromQuestion = (question: string): AdminReportKind | 'all' | null =>
  reportKindFromTokens(new Set(matchTokens(question)));

const isExportQuestion = (tokens: Set<string>): boolean => {
  if ([...tokens].some((token) => exportBlockedWords.has(token)) || tokens.has('my')) {
    return false;
  }
  if ([...exportWords].some((word) => tokens.has(word))) {
    return true;
  }
  return tokens.has('download') && reportKindFromTokens(tokens) !== null;
};

export type AssistantIntent =
  | 'export_report'
  | 'highest_enrollment'
  | 'average_score'
  | 'inactive_users'
  | 'count_enrollments'
  | 'count_courses'
  | 'count_users'
  | 'my_scores'
  | 'student_progress'
  | 'my_enrollments'
  | 'my_progress'
  | 'add_assessment'
  | 'assessment_howto'
  | 'upload_material'
  | 'add_course'
  | 'thumbnail'
  | 'find_assessment'
  | 'enroll'
  | 'career_test'
  | 'manage_users'
  | 'sales'
  | 'coupon'
  | 'homepage'
  | 'sign_up'
  | 'cart'
  | 'list_courses'
  | 'overview'
  | 'navigation';

export interface QuestionMatch {
  intent: AssistantIntent;
}

export interface QuestionClarification {
  clarify: [AssistantIntent, AssistantIntent];
}

interface IntentRule {
  intent: AssistantIntent;
  topics: string[];
  signals: string[];
  minimumSignals: number;
  blockedWords: string[];
}

const intentRule = (
  intent: AssistantIntent,
  topics: string[],
  signals: string[] = [],
  minimumSignals = 0,
  blockedWords: string[] = [],
): IntentRule => ({ intent, topics, signals, minimumSignals, blockedWords });

const intentRules: IntentRule[] = [
  intentRule('highest_enrollment', ['enrollment', 'enrolled', 'course', 'user'], ['highest'], 1, ['average', 'inactive']),
  intentRule('average_score', ['score', 'assessment'], ['average'], 1),
  intentRule('inactive_users', ['user', 'student', 'people'], ['inactive'], 1),
  intentRule('count_enrollments', ['enrollment', 'enrolled'], ['total', 'count'], 1, ['highest', 'average', 'inactive']),
  intentRule('count_courses', ['course', 'program'], ['total', 'count'], 1, ['highest', 'average', 'inactive', 'enrollment', 'enrolled', 'enroll', 'assessment']),
  intentRule('count_users', ['user', 'student', 'people'], ['total', 'count', 'registered'], 1, ['highest', 'inactive', 'enrollment', 'enrolled']),
  intentRule('my_scores', ['score'], ['my', 'check'], 1, ['average', 'student', 'inactive']),
  intentRule('student_progress', ['score', 'progress'], ['student'], 1, ['my', 'average']),
  intentRule('my_enrollments', ['enrolled', 'course'], ['my', 'enrolled'], 1, ['total', 'count', 'highest', 'average', 'add', 'create', 'show', 'available', 'join']),
  intentRule('my_progress', ['progress', 'learning'], ['my', 'learning', 'check'], 1, ['student', 'average', 'course']),
  intentRule('add_assessment', ['assessment', 'question'], ['add', 'create', 'new', 'upload', 'build'], 1, ['score', 'average', 'material']),
  intentRule('assessment_howto', ['assessment', 'evaluation', 'passing'], ['work', 'evaluation', 'passing', 'score'], 1, ['add', 'create', 'new', 'upload', 'build', 'my', 'average', 'student', 'check', 'total', 'count']),
  intentRule('upload_material', ['material', 'document', 'file', 'pdf'], ['upload', 'add', 'attach'], 1, ['assessment']),
  intentRule('add_course', ['course', 'program'], ['add', 'create', 'new', 'edit', 'delete', 'manage'], 1, ['assessment', 'material', 'document', 'file', 'coupon']),
  intentRule('thumbnail', ['thumbnail', 'image', 'aspect', 'ratio'], ['size', 'thumbnail', 'image', 'aspect', 'ratio']),
  intentRule('find_assessment', ['assessment'], ['find', 'take', 'where'], 1, ['add', 'create', 'score', 'average', 'upload']),
  intentRule('enroll', ['enroll', 'join'], ['course', 'how'], 0, ['show', 'list', 'available', 'what', 'which', 'highest', 'total', 'count', 'enrollment']),
  intentRule('career_test', ['career'], ['test', 'add', 'create', 'edit', 'manage', 'where']),
  intentRule('manage_users', ['user'], ['add', 'create', 'edit', 'delete', 'manage'], 1, ['inactive', 'highest', 'count', 'total', 'score', 'enrolled', 'enrollment']),
  intentRule('sales', ['sale', 'revenue']),
  intentRule('coupon', ['coupon', 'discount']),
  intentRule('homepage', ['homepage'], [], 0, ['overview']),
  intentRule('sign_up', ['signup', 'register', 'account']),
  intentRule('cart', ['cart', 'checkout', 'pay']),
  intentRule('list_courses', ['course', 'program'], ['available', 'list', 'show', 'join', 'what', 'which'], 0, ['total', 'count', 'add', 'create', 'delete', 'upload', 'edit', 'manage', 'enroll', 'enrolled', 'enrollment', 'highest', 'average', 'inactive', 'image', 'thumbnail', 'material', 'assessment', 'user', 'my']),
  intentRule('overview', ['overview'], ['platform']),
  intentRule('navigation', ['navigate', 'menu', 'screen'], [], 0, ['course', 'user', 'assessment', 'score', 'enrollment']),
];

const intentLabels: Record<AssistantIntent, string> = {
  export_report: 'an Excel report',
  highest_enrollment: 'the course with the highest enrollment',
  average_score: 'the average assessment score',
  inactive_users: 'inactive users',
  count_enrollments: 'total enrollment',
  count_courses: 'the number of courses',
  count_users: 'the number of users',
  my_scores: 'your assessment scores',
  student_progress: 'student scores',
  my_enrollments: 'your enrollments',
  my_progress: 'your learning progress',
  add_assessment: 'adding an assessment',
  assessment_howto: 'how assessments work',
  upload_material: 'uploading course materials',
  add_course: 'adding a course',
  thumbnail: 'course images',
  find_assessment: 'finding your assessments',
  enroll: 'how to enroll',
  career_test: 'the career test',
  manage_users: 'managing users',
  sales: 'sales',
  coupon: 'coupons',
  homepage: 'the homepage',
  sign_up: 'creating an account',
  cart: 'the cart and checkout',
  list_courses: 'the course list',
  overview: 'the platform overview',
  navigation: 'where to go in the app',
};

const matcherStopWords = new Set([
  'a', 'an', 'the', 'to', 'of', 'in', 'on', 'for', 'and', 'or', 'me', 'i',
  'do', 'does', 'is', 'are', 'am', 'please', 'tell', 'about', 'with', 'from',
  'that', 'this', 'it', 'you', 'your', 'there', 'be', 'want', 'need', 'know',
  'can', 'give', 'has', 'have', 'had', 'was', 'were', 'who', 'whom', 'just',
]);

const catalogWords = new Set([
  'course', 'program', 'user', 'student', 'people', 'admin', 'assessment', 'score',
  'enrollment', 'enroll', 'enrolled', 'question', 'platform', 'total', 'count',
  'available', 'add', 'create', 'show', 'list', 'how', 'what', 'where', 'which',
  'my', 'new', 'help', 'overview', 'homepage', 'cart', 'checkout', 'highest',
  'average', 'inactive', 'registered', 'upload', 'delete', 'edit', 'manage',
  'sale', 'revenue', 'coupon', 'discount', 'thumbnail', 'image', 'progress',
  'report', 'excel', 'spreadsheet', 'export', 'download',
  'learn', 'learning', 'join', 'take', 'find', 'check', 'see', 'work', 'passing',
  'size', 'aspect', 'ratio', 'menu', 'screen', 'navigate', 'signup', 'register',
  'account', 'pay', 'material', 'document', 'file', 'pdf', 'career', 'test',
  'build', 'attach', 'evaluation', 'open', 'get', 'make', 'use', 'using', 'app',
  'website', 'page', 'info', 'information',
]);

const canonicalizeToken = (word: string): string => {
  if (word === 'enrolment' || word === 'enrolments' || word === 'enrollment' || word === 'enrollments') {
    return 'enrollment';
  }
  if (word === 'enrolled') {
    return 'enrolled';
  }
  if (word === 'enroll' || word === 'enrol' || word === 'enrolling') {
    return 'enroll';
  }
  if (word === 'most') {
    return 'highest';
  }
  if (word === 'avg') {
    return 'average';
  }
  if (word === 'summary') {
    return 'overview';
  }
  if (word === 'many' || word === 'number') {
    return 'count';
  }
  if (word === 'programme' || word === 'programmes') {
    return 'program';
  }
  if (word.endsWith('ies') && word.length > 4) {
    return `${word.slice(0, -3)}y`;
  }
  if (word.endsWith('s') && word.length > 3 && !word.endsWith('ss')) {
    return word.slice(0, -1);
  }
  return word;
};

const preparedQuestion = (question: string) => normalizeQuestion(question)
  .replace(/\bhome page\b/g, 'homepage')
  .replace(/\bsign up\b/g, 'signup');

const matchTokens = (question: string): string[] => {
  const unique: string[] = [];
  for (const word of preparedQuestion(question).split(' ')) {
    if (!word || matcherStopWords.has(word)) {
      continue;
    }
    const token = canonicalizeToken(word);
    if ((token.length < 3 && token !== 'my') || matcherStopWords.has(token) || unique.includes(token)) {
      continue;
    }
    unique.push(token);
  }
  return unique;
};

const scoreRule = (tokens: Set<string>, item: IntentRule): number => {
  if (item.blockedWords.some((word) => tokens.has(word))) {
    return 0;
  }
  const topicHits = item.topics.filter((word) => tokens.has(word)).length;
  if (topicHits === 0) {
    return 0;
  }
  const signalHits = item.signals.filter((word) => tokens.has(word)).length;
  if (signalHits < item.minimumSignals) {
    return 0;
  }
  return 10 + signalHits * 5 + topicHits;
};

export const describeIntent = (intent: AssistantIntent): string => intentLabels[intent];

export const matchQuestion = (question: string): QuestionMatch | QuestionClarification | null => {
  const tokens = new Set(matchTokens(question));
  if (tokens.size === 0) {
    return null;
  }
  if (isExportQuestion(tokens)) {
    return { intent: 'export_report' };
  }
  const ranked = intentRules
    .map((item, index) => ({ item, index, score: scoreRule(tokens, item) }))
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score || left.index - right.index);
  const winner = ranked[0];
  if (!winner) {
    return null;
  }
  const runnerUp = ranked[1];
  if (runnerUp && runnerUp.score === winner.score) {
    return { clarify: [winner.item.intent, runnerUp.item.intent] };
  }
  return { intent: winner.item.intent };
};

export const searchKeywords = (question: string): string[] =>
  matchTokens(question).filter((word) => !catalogWords.has(word));

export const isCourseCountQuestion = (question: string) => {
  const matched = matchQuestion(question);
  return matched !== null && 'intent' in matched && matched.intent === 'count_courses';
};

export const isUserCountQuestion = (question: string) => {
  const matched = matchQuestion(question);
  return matched !== null && 'intent' in matched && matched.intent === 'count_users';
};

export const notUnderstoodText = "I'm not able to understand that question.";

export const followUpQuestions = (question: string, isAdmin: boolean): string[] => {
  const asked = normalizeQuestion(question);
  const starters = isAdmin ? adminSuggestions : studentSuggestions;
  const unique: string[] = [];
  for (const item of [...relatedPool(asked, isAdmin), ...rankedByQuestion(question, isAdmin), ...starters]) {
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
