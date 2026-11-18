export type CallerRole = 'guest' | 'student' | 'instructor' | 'admin';

export type ImportKind = 'courses' | 'assessments' | 'career_sections';

export interface AssistantLink {
  label: string;
  path: string;
}

const learnerTools = new Set([
  'list_available_courses',
  'get_course',
  'list_my_enrollments',
  'list_my_attempts',
]);

const adminTools = new Set([
  'count_courses',
  'count_users',
  'count_registrations',
  'highest_enrollment',
  'users_completed_course',
  'average_attempt_score',
  'program_engagement',
  'inactive_users',
  'course_report',
  'list_assessments',
  'assessment_questions',
]);

const optionalArgs: Record<string, string[]> = {
  list_available_courses: ['category'],
  get_course: ['title'],
  list_my_enrollments: [],
  list_my_attempts: [],
  count_courses: [],
  count_users: [],
  count_registrations: ['from', 'to'],
  highest_enrollment: [],
  users_completed_course: ['title'],
  average_attempt_score: ['title'],
  program_engagement: [],
  inactive_users: [],
  course_report: ['title'],
  list_assessments: ['title'],
  assessment_questions: ['programTitle', 'assessmentTitle'],
};

const requiredArgs: Record<string, string[]> = {
  get_course: ['title'],
  count_registrations: ['from', 'to'],
  users_completed_course: ['title'],
  course_report: ['title'],
  list_assessments: ['title'],
  assessment_questions: ['programTitle', 'assessmentTitle'],
};

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
const calendarDate = /^\d{4}-\d{2}-\d{2}$/;
const sqlShapedName = /[;\s]|\b(select|insert|update|delete|drop|alter|union)\b/i;

export const courseColumns = [
  'title',
  'description',
  'price',
  'original_price',
  'category',
  'duration',
  'age_range',
  'mode',
  'status',
  'total_lessons',
  'highlights',
  'learning_points',
  'image_url',
];

export const assessmentColumns = [
  'program_title',
  'assessment_title',
  'description',
  'instructions',
  'duration_minutes',
  'passing_score',
  'sequence',
  'is_active',
  'is_published',
  'show_feedback',
  'allow_review',
  'section_title',
  'section_instructions',
  'prompt',
  'kind',
  'marks',
  'picture_text',
  'picture_url',
  'passage_title',
  'passage',
  'listening_script',
  'option_1',
  'option_1_correct',
  'option_2',
  'option_2_correct',
  'option_3',
  'option_3_correct',
  'option_4',
  'option_4_correct',
  'accepted_answers',
  'model_answer',
  'word_bank',
  'minimum_words',
  'required_phrases',
  'guidance',
];

export const careerColumns = ['section_key', 'title', 'description', 'order_index', 'is_active'];

const questionKinds = new Set(['choice', 'listening', 'blank', 'match', 'order', 'written']);
const courseStatuses = new Set(['active', 'inactive', 'archived']);
const sectionKeys = new Set(['hero', 'feature', 'benefit', 'cta']);

export const toolsForRole = (role: CallerRole): string[] => {
  if (role === 'guest') {
    return [];
  }
  const tools = [...learnerTools];
  if (role === 'admin') {
    tools.push(...adminTools);
  }
  return tools;
};

export const sanitizeLinks = (links: AssistantLink[], role: CallerRole): AssistantLink[] => {
  const seen = new Set<string>();
  const cleaned: AssistantLink[] = [];
  for (const link of links) {
    const path = link.path.trim();
    const label = link.label.trim().slice(0, 80);
    const isLearnerPath = learnerPaths.has(path) || coursePath.test(path);
    const isAdminPath = role === 'admin' && adminPaths.has(path);
    if (!label || seen.has(path) || (!isLearnerPath && !isAdminPath)) {
      continue;
    }
    seen.add(path);
    cleaned.push({ label, path });
    if (cleaned.length === 8) {
      break;
    }
  }
  return cleaned;
};

const readLinkList = (value: unknown): AssistantLink[] => {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.flatMap((item) => {
    if (!item || typeof item !== 'object') {
      return [];
    }
    const label = (item as { label?: unknown }).label;
    const path = (item as { path?: unknown }).path;
    if (typeof label !== 'string' || typeof path !== 'string') {
      return [];
    }
    return [{ label, path }];
  });
};

export const sanitizeModelLinks = (value: unknown, role: CallerRole): AssistantLink[] => {
  return sanitizeLinks(readLinkList(value), role);
};

export const parseToolCall = (
  role: CallerRole,
  value: unknown,
): { name: string; args: Record<string, string> } | { error: string } => {
  if (value === null || value === undefined) {
    return { name: '', args: {} };
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { error: 'KIKI could not use that request.' };
  }
  const name = (value as { name?: unknown }).name;
  if (typeof name !== 'string' || name.trim().length === 0) {
    return { name: '', args: {} };
  }
  if (sqlShapedName.test(name) || !optionalArgs[name]) {
    return { error: 'KIKI cannot run that kind of request.' };
  }
  const allowed = new Set(toolsForRole(role));
  if (!allowed.has(name)) {
    return { error: 'You do not have access to that information.' };
  }
  const rawArgs = (value as { args?: unknown }).args ?? {};
  if (!rawArgs || typeof rawArgs !== 'object' || Array.isArray(rawArgs)) {
    return { error: 'KIKI could not use that request.' };
  }
  const allowedKeys = new Set(optionalArgs[name]);
  const args: Record<string, string> = {};
  for (const [key, argValue] of Object.entries(rawArgs)) {
    if (!allowedKeys.has(key) || typeof argValue !== 'string') {
      return { error: 'KIKI could not use that request.' };
    }
    const text = argValue.trim();
    if (text.length > 200) {
      return { error: 'That name is too long.' };
    }
    if (text) {
      args[key] = text;
    }
  }
  for (const key of requiredArgs[name] ?? []) {
    if (!args[key]) {
      return { error: 'KIKI needs a more specific question.' };
    }
  }
  if (name === 'count_registrations' && !isDateRange(args.from, args.to)) {
    return { error: 'KIKI needs a start date and an end date.' };
  }
  return { name, args };
};

const isDateRange = (from: string, to: string): boolean => {
  if (!calendarDate.test(from) || !calendarDate.test(to)) {
    return false;
  }
  return from <= to;
};

const asText = (value: unknown): string => (typeof value === 'string' ? value.trim() : value == null ? '' : String(value).trim());

const blankRow = (row: Record<string, string>): boolean => Object.values(row).every((value) => value.length === 0);

export const normalizeImportRows = (
  kind: ImportKind,
  value: unknown,
): { rows: Record<string, string>[]; errors: string[] } | { error: string } => {
  if (!Array.isArray(value)) {
    return { error: 'KIKI could not read any rows in that document.' };
  }
  if (value.length > 200) {
    return { error: 'KIKI can prepare at most 200 rows at a time.' };
  }
  const columns = kind === 'courses' ? courseColumns : kind === 'assessments' ? assessmentColumns : careerColumns;
  const allowed = new Set(columns);
  const rows: Record<string, string>[] = [];
  for (const item of value) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      return { error: 'KIKI could not read a row in that document.' };
    }
    const source = item as Record<string, unknown>;
    if ('password' in source || 'email' in source || 'role' in source) {
      return { error: 'KIKI cannot create accounts, set passwords, or change roles.' };
    }
    const row: Record<string, string> = {};
    for (const [key, cell] of Object.entries(source)) {
      if (allowed.has(key)) {
        row[key] = asText(cell);
      }
    }
    if (!blankRow(row)) {
      rows.push(row);
    }
  }
  if (rows.length === 0) {
    return { error: 'KIKI did not find any rows to import.' };
  }
  return { rows, errors: fieldErrors(kind, rows) };
};

const fieldErrors = (kind: ImportKind, rows: Record<string, string>[]): string[] => {
  if (kind === 'courses') {
    return courseErrors(rows);
  }
  if (kind === 'assessments') {
    return assessmentErrors(rows);
  }
  return careerErrors(rows);
};

const courseErrors = (rows: Record<string, string>[]): string[] => {
  const errors: string[] = [];
  rows.forEach((row, index) => {
    const line = index + 2;
    if (!row.title?.trim()) {
      errors.push(`Row ${line}: title is required.`);
    }
    const price = Number(row.price ?? '');
    if (!row.price?.trim() || Number.isNaN(price) || price < 0) {
      errors.push(`Row ${line}: price must be a number that is 0 or more.`);
    }
    if (row.status && !courseStatuses.has(row.status.toLowerCase())) {
      errors.push(`Row ${line}: status must be active, inactive, or archived.`);
    }
  });
  return errors;
};

const assessmentErrors = (rows: Record<string, string>[]): string[] => {
  const errors: string[] = [];
  rows.forEach((row, index) => {
    const line = index + 2;
    if (!row.program_title?.trim() || !row.assessment_title?.trim() || !row.prompt?.trim()) {
      errors.push(`Row ${line}: program_title, assessment_title, and prompt are required.`);
    }
    const kind = (row.kind ?? '').trim().toLowerCase();
    if (kind && !questionKinds.has(kind)) {
      errors.push(`Row ${line}: kind must be choice, listening, blank, match, order, or written.`);
    }
  });
  return errors;
};

const careerErrors = (rows: Record<string, string>[]): string[] => {
  const errors: string[] = [];
  rows.forEach((row, index) => {
    const line = index + 2;
    if (!sectionKeys.has((row.section_key ?? '').trim().toLowerCase())) {
      errors.push(`Row ${line}: section_key must be hero, feature, benefit, or cta.`);
    }
    if (!row.title?.trim()) {
      errors.push(`Row ${line}: title is required.`);
    }
  });
  return errors;
};

export const literalIlike = (value: string): string => value.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');

export const readImportKind = (value: unknown): ImportKind | null => {
  if (value === 'courses' || value === 'assessments' || value === 'career_sections') {
    return value;
  }
  return null;
};
