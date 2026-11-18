import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.52.0';
import type { CallerRole } from './validate.ts';
import { literalIlike, sanitizeLinks } from './validate.ts';

export interface ToolOutcome {
  summary: string;
  table: { columns: string[]; rows: string[][] } | null;
  stats: { label: string; value: string }[] | null;
  links: { label: string; path: string }[];
  denied: boolean;
  errorCode: string | null;
}

interface CourseRow {
  id: string;
  title: string | null;
  category: string | null;
  price: number | null;
  duration: string | null;
  age_range: string | null;
  mode: string | null;
  status: string | null;
}

const emptyOutcome = (summary: string, errorCode: string | null = null): ToolOutcome => ({
  summary,
  table: null,
  stats: null,
  links: [],
  denied: false,
  errorCode,
});

const deniedOutcome = (): ToolOutcome => ({
  summary: 'You do not have access to that information.',
  table: null,
  stats: null,
  links: [],
  denied: true,
  errorCode: null,
});

const text = (value: unknown, fallback = '—'): string => {
  if (typeof value === 'string' && value.trim()) {
    return value.trim();
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }
  return fallback;
};

const round = (value: number): string => String(Math.round(value * 10) / 10);

const adminOnly = new Set([
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

export const runCatalogTool = async (
  db: SupabaseClient,
  role: CallerRole,
  userId: string,
  name: string,
  args: Record<string, string>,
): Promise<ToolOutcome> => {
  if (role !== 'admin' && adminOnly.has(name)) {
    return deniedOutcome();
  }
  if (role === 'guest') {
    return deniedOutcome();
  }
  if (name === 'list_available_courses') return listCourses(db, role, args.category);
  if (name === 'get_course') return getCourse(db, role, args.title);
  if (name === 'list_my_enrollments') return listMyEnrollments(db, userId);
  if (name === 'list_my_attempts') return listMyAttempts(db, userId);
  if (name === 'count_courses') return countRows(db, 'courses', 'Courses');
  if (name === 'count_users') return countRows(db, 'profiles', 'Registered users');
  if (name === 'count_registrations') return countRegistrations(db, args.from, args.to);
  if (name === 'highest_enrollment') return highestEnrollment(db, role);
  if (name === 'users_completed_course') return usersCompletedCourse(db, args.title);
  if (name === 'average_attempt_score') return averageAttemptScore(db, args.title);
  if (name === 'program_engagement') return programEngagement(db, role);
  if (name === 'inactive_users') return inactiveUsers(db);
  if (name === 'course_report') return courseReport(db, role, args.title);
  if (name === 'list_assessments') return listAssessments(db, args.title);
  if (name === 'assessment_questions') return assessmentQuestions(db, args.programTitle, args.assessmentTitle);
  return deniedOutcome();
};

const pageRows = async (
  load: (from: number, to: number) => PromiseLike<{ data: Record<string, unknown>[] | null; error: { code?: string } | null }>,
): Promise<{ rows: Record<string, unknown>[]; truncated: boolean; errorCode: string | null }> => {
  const rows: Record<string, unknown>[] = [];
  let from = 0;
  while (rows.length < 5000) {
    const { data, error } = await load(from, from + 999);
    if (error) {
      return { rows, truncated: false, errorCode: error.code ?? 'query_failed' };
    }
    const batch = data ?? [];
    rows.push(...batch);
    if (batch.length < 1000) {
      return { rows, truncated: false, errorCode: null };
    }
    from += 1000;
  }
  return { rows, truncated: true, errorCode: null };
};

const findCourses = async (
  db: SupabaseClient,
  role: CallerRole,
  title: string,
): Promise<{ courses: CourseRow[]; errorCode: string | null }> => {
  let query = db.from('courses').select('id, title, category, price, duration, age_range, mode, status').ilike('title', literalIlike(title));
  if (role !== 'admin') {
    query = query.eq('status', 'active');
  }
  const { data, error } = await query.limit(5);
  if (error) {
    return { courses: [], errorCode: error.code ?? 'query_failed' };
  }
  return { courses: (data ?? []) as CourseRow[], errorCode: null };
};

const courseLink = (role: CallerRole, course: CourseRow) => sanitizeLinks([{ label: text(course.title, 'Open course'), path: `/course/${course.id}` }], role);

const listCourses = async (db: SupabaseClient, role: CallerRole, category?: string): Promise<ToolOutcome> => {
  let query = db.from('courses').select('id, title, category, price, duration, age_range, mode, status').eq('status', 'active').order('title').limit(50);
  if (category) {
    query = query.ilike('category', literalIlike(category));
  }
  const { data, error } = await query;
  if (error) {
    return emptyOutcome('The course list could not be loaded.', error.code ?? 'query_failed');
  }
  const courses = (data ?? []) as CourseRow[];
  return {
    summary: courses.length === 0 ? 'No active courses matched.' : `${courses.length} active course(s) matched.`,
    table: {
      columns: ['Title', 'Category', 'Price', 'Duration', 'Ages', 'Mode'],
      rows: courses.map((course) => [text(course.title), text(course.category), text(course.price), text(course.duration), text(course.age_range), text(course.mode)]),
    },
    stats: [{ label: 'Courses', value: String(courses.length) }],
    links: courses.slice(0, 8).flatMap((course) => courseLink(role, course)),
    denied: false,
    errorCode: null,
  };
};

const getCourse = async (db: SupabaseClient, role: CallerRole, title: string): Promise<ToolOutcome> => {
  const found = await findCourses(db, role, title);
  if (found.errorCode) {
    return emptyOutcome('That course could not be loaded.', found.errorCode);
  }
  if (found.courses.length === 0) {
    return emptyOutcome(`No course is named "${title}".`);
  }
  if (found.courses.length > 1) {
    return emptyOutcome(`More than one course is named "${title}".`);
  }
  const course = found.courses[0];
  return {
    summary: `${text(course.title)} is ${text(course.status)}.`,
    table: {
      columns: ['Field', 'Value'],
      rows: [
        ['Title', text(course.title)],
        ['Category', text(course.category)],
        ['Price', text(course.price)],
        ['Duration', text(course.duration)],
        ['Ages', text(course.age_range)],
        ['Mode', text(course.mode)],
        ['Status', text(course.status)],
      ],
    },
    stats: null,
    links: courseLink(role, course),
    denied: false,
    errorCode: null,
  };
};

const listMyEnrollments = async (db: SupabaseClient, userId: string): Promise<ToolOutcome> => {
  const { data, error } = await db
    .from('enrollments')
    .select('status, progress, enrolled_at, completed_at, courses(title)')
    .eq('student_id', userId)
    .limit(50);
  if (error) {
    return emptyOutcome('Your enrollments could not be loaded.', error.code ?? 'query_failed');
  }
  const rows = (data ?? []) as Array<Record<string, unknown>>;
  return {
    summary: rows.length === 0 ? 'You have no enrollments.' : `You have ${rows.length} enrollment(s).`,
    table: {
      columns: ['Course', 'Status', 'Progress', 'Enrolled', 'Completed'],
      rows: rows.map((row) => {
        const course = Array.isArray(row.courses) ? row.courses[0] : row.courses;
        const title = course && typeof course === 'object' ? text((course as { title?: unknown }).title) : '—';
        return [title, text(row.status), `${text(row.progress, '0')}%`, text(row.enrolled_at).slice(0, 10), text(row.completed_at).slice(0, 10)];
      }),
    },
    stats: [{ label: 'Enrollments', value: String(rows.length) }],
    links: sanitizeLinks([{ label: 'My learning', path: '/enrolled-courses' }], 'student'),
    denied: false,
    errorCode: null,
  };
};

const listMyAttempts = async (db: SupabaseClient, userId: string): Promise<ToolOutcome> => {
  const { data, error } = await db
    .from('assessment_attempts')
    .select('score, total_marks, passed, submitted_at, assessments(title)')
    .eq('user_id', userId)
    .order('submitted_at', { ascending: false })
    .limit(50);
  if (error) {
    return emptyOutcome('Your assessment scores could not be loaded.', error.code ?? 'query_failed');
  }
  const rows = (data ?? []) as Array<Record<string, unknown>>;
  return {
    summary: rows.length === 0 ? 'You have no submitted assessments.' : `You have ${rows.length} submitted assessment(s).`,
    table: {
      columns: ['Assessment', 'Score', 'Total', 'Passed', 'Submitted'],
      rows: rows.map((row) => {
        const assessment = Array.isArray(row.assessments) ? row.assessments[0] : row.assessments;
        const title = assessment && typeof assessment === 'object' ? text((assessment as { title?: unknown }).title) : '—';
        return [title, text(row.score, '0'), text(row.total_marks, '0'), row.passed === true ? 'Yes' : 'No', text(row.submitted_at).slice(0, 10)];
      }),
    },
    stats: null,
    links: sanitizeLinks([{ label: 'My learning', path: '/enrolled-courses' }], 'student'),
    denied: false,
    errorCode: null,
  };
};

const countRows = async (db: SupabaseClient, table: 'courses' | 'profiles', label: string): Promise<ToolOutcome> => {
  const { count, error } = await db.from(table).select('id', { count: 'exact', head: true });
  if (error) {
    return emptyOutcome(`${label} could not be counted.`, error.code ?? 'query_failed');
  }
  const value = count ?? 0;
  return {
    summary: `${label}: ${value}.`,
    table: null,
    stats: [{ label, value: String(value) }],
    links: [],
    denied: false,
    errorCode: null,
  };
};

const countRegistrations = async (db: SupabaseClient, from: string, to: string): Promise<ToolOutcome> => {
  const start = `${from}T00:00:00.000Z`;
  const endDate = new Date(`${to}T00:00:00.000Z`);
  endDate.setUTCDate(endDate.getUTCDate() + 1);
  const { count, error } = await db
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .gte('created_at', start)
    .lt('created_at', endDate.toISOString());
  if (error) {
    return emptyOutcome('Registrations could not be counted.', error.code ?? 'query_failed');
  }
  const value = count ?? 0;
  return {
    summary: `${value} account(s) were created from ${from} through ${to}.`,
    table: null,
    stats: [{ label: 'Registrations', value: String(value) }],
    links: [],
    denied: false,
    errorCode: null,
  };
};

const loadCourses = async (db: SupabaseClient): Promise<{ courses: CourseRow[]; errorCode: string | null }> => {
  const loaded = await pageRows((from, to) => db.from('courses').select('id, title, category, price, duration, age_range, mode, status').range(from, to));
  return { courses: loaded.rows as unknown as CourseRow[], errorCode: loaded.errorCode };
};

const countBy = (rows: Record<string, unknown>[], key: string): Map<string, number> => {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const id = row[key];
    if (typeof id === 'string') {
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }
  }
  return counts;
};

const highestEnrollment = async (db: SupabaseClient, role: CallerRole): Promise<ToolOutcome> => {
  const courses = await loadCourses(db);
  if (courses.errorCode) {
    return emptyOutcome('Enrollment could not be compared.', courses.errorCode);
  }
  const enrollments = await pageRows((from, to) => db.from('enrollments').select('course_id').range(from, to));
  if (enrollments.errorCode) {
    return emptyOutcome('Enrollment could not be compared.', enrollments.errorCode);
  }
  const counts = countBy(enrollments.rows, 'course_id');
  let winner: CourseRow | null = null;
  let winnerCount = 0;
  let tied = 0;
  for (const course of courses.courses) {
    const count = counts.get(course.id) ?? 0;
    if (count > winnerCount) {
      winner = course;
      winnerCount = count;
      tied = 1;
    } else if (count > 0 && count === winnerCount) {
      tied += 1;
    }
  }
  if (!winner || winnerCount === 0) {
    return emptyOutcome('No enrollments are recorded.');
  }
  const limitNote = enrollments.truncated ? ' The count uses the first 5000 enrollments.' : '';
  const tieNote = tied > 1 ? ` ${tied} programs share this count.` : '';
  return {
    summary: `${text(winner.title)} has the highest enrollment, with ${winnerCount} enrollment(s).${tieNote}${limitNote}`,
    table: null,
    stats: [{ label: 'Highest enrollment', value: `${text(winner.title)} (${winnerCount})` }],
    links: courseLink(role, winner),
    denied: false,
    errorCode: null,
  };
};

const usersCompletedCourse = async (db: SupabaseClient, title: string): Promise<ToolOutcome> => {
  const found = await findCourses(db, 'admin', title);
  if (found.errorCode) {
    return emptyOutcome('Completed learners could not be loaded.', found.errorCode);
  }
  if (found.courses.length !== 1) {
    return emptyOutcome(found.courses.length === 0 ? `No course is named "${title}".` : `More than one course is named "${title}".`);
  }
  const course = found.courses[0];
  const filter = db.from('enrollments').select('student_id', { count: 'exact' }).eq('course_id', course.id).or('status.eq.completed,completed_at.not.is.null');
  const { data, error, count } = await filter.limit(50);
  if (error) {
    return emptyOutcome('Completed learners could not be loaded.', error.code ?? 'query_failed');
  }
  const ids = [...new Set((data ?? []).map((row) => row.student_id).filter((id): id is string => typeof id === 'string'))];
  const profiles = ids.length === 0
    ? { data: [], error: null }
    : await db.from('profiles').select('id, full_name, email').in('id', ids);
  if (profiles.error) {
    return emptyOutcome('Completed learners could not be loaded.', profiles.error.code ?? 'query_failed');
  }
  const people = (profiles.data ?? []) as Array<{ full_name: string | null; email: string | null }>;
  return {
    summary: `${count ?? people.length} learner(s) completed ${text(course.title)}. Showing ${people.length}.`,
    table: {
      columns: ['Name', 'Email'],
      rows: people.map((person) => [text(person.full_name), text(person.email)]),
    },
    stats: [{ label: 'Completed', value: String(count ?? people.length) }],
    links: [],
    denied: false,
    errorCode: null,
  };
};

const averageAttemptScore = async (db: SupabaseClient, title?: string): Promise<ToolOutcome> => {
  let assessmentIds: string[] | null = null;
  if (title) {
    const found = await findCourses(db, 'admin', title);
    if (found.errorCode) {
      return emptyOutcome('The average score could not be loaded.', found.errorCode);
    }
    if (found.courses.length !== 1) {
      return emptyOutcome(found.courses.length === 0 ? `No course is named "${title}".` : `More than one course is named "${title}".`);
    }
    const { data, error } = await db.from('assessments').select('id').eq('course_id', found.courses[0].id);
    if (error) {
      return emptyOutcome('The average score could not be loaded.', error.code ?? 'query_failed');
    }
    assessmentIds = (data ?? []).map((row) => row.id);
    if (assessmentIds.length === 0) {
      return emptyOutcome(`No assessments are saved for ${text(found.courses[0].title)}.`);
    }
  }
  const loaded = await pageRows((from, to) => {
    let query = db.from('assessment_attempts').select('score, total_marks, assessment_id').range(from, to);
    if (assessmentIds) {
      query = query.in('assessment_id', assessmentIds);
    }
    return query;
  });
  if (loaded.errorCode) {
    return emptyOutcome('The average score could not be loaded.', loaded.errorCode);
  }
  const attempts = loaded.rows as Array<{ score?: number; total_marks?: number }>;
  if (attempts.length === 0) {
    return emptyOutcome('No assessment attempts are recorded.');
  }
  const scoreTotal = attempts.reduce((sum, attempt) => sum + (attempt.score ?? 0), 0);
  const marksTotal = attempts.reduce((sum, attempt) => sum + (attempt.total_marks ?? 0), 0);
  const percents = attempts.filter((attempt) => (attempt.total_marks ?? 0) > 0);
  const percent = percents.length === 0
    ? null
    : percents.reduce((sum, attempt) => sum + ((attempt.score ?? 0) / (attempt.total_marks ?? 1)) * 100, 0) / percents.length;
  const stats = [
    { label: 'Attempts', value: String(attempts.length) },
    { label: 'Average score', value: round(scoreTotal / attempts.length) },
    { label: 'Average total marks', value: round(marksTotal / attempts.length) },
  ];
  if (percent !== null) {
    stats.push({ label: 'Average percent', value: `${round(percent)}%` });
  }
  const limitNote = loaded.truncated ? ' The average uses the first 5000 attempts.' : '';
  return {
    summary: `Average score ${round(scoreTotal / attempts.length)} across ${attempts.length} attempt(s).${limitNote}`,
    table: null,
    stats,
    links: [],
    denied: false,
    errorCode: null,
  };
};

const programEngagement = async (db: SupabaseClient, role: CallerRole): Promise<ToolOutcome> => {
  const courses = await loadCourses(db);
  const enrollments = await pageRows((from, to) => db.from('enrollments').select('course_id').range(from, to));
  const assessments = await pageRows((from, to) => db.from('assessments').select('id, course_id').range(from, to));
  const attempts = await pageRows((from, to) => db.from('assessment_attempts').select('assessment_id').range(from, to));
  const errorCode = courses.errorCode ?? enrollments.errorCode ?? assessments.errorCode ?? attempts.errorCode;
  if (errorCode) {
    return emptyOutcome('Program engagement could not be loaded.', errorCode);
  }
  const enrollmentCounts = countBy(enrollments.rows, 'course_id');
  const courseByAssessment = new Map<string, string>();
  for (const row of assessments.rows) {
    if (typeof row.id === 'string' && typeof row.course_id === 'string') {
      courseByAssessment.set(row.id, row.course_id);
    }
  }
  const attemptCounts = new Map<string, number>();
  for (const row of attempts.rows) {
    const courseId = typeof row.assessment_id === 'string' ? courseByAssessment.get(row.assessment_id) : undefined;
    if (courseId) {
      attemptCounts.set(courseId, (attemptCounts.get(courseId) ?? 0) + 1);
    }
  }
  const ranked = courses.courses
    .map((course) => ({
      course,
      enrollments: enrollmentCounts.get(course.id) ?? 0,
      attempts: attemptCounts.get(course.id) ?? 0,
    }))
    .sort((left, right) => (right.enrollments + right.attempts) - (left.enrollments + left.attempts))
    .slice(0, 10);
  return {
    summary: ranked.length === 0 ? 'No programs are saved.' : 'Engagement is enrollments plus assessment attempts.',
    table: {
      columns: ['Program', 'Enrollments', 'Attempts', 'Engagement'],
      rows: ranked.map((item) => [text(item.course.title), String(item.enrollments), String(item.attempts), String(item.enrollments + item.attempts)]),
    },
    stats: null,
    links: ranked.slice(0, 3).flatMap((item) => courseLink(role, item.course)),
    denied: false,
    errorCode: null,
  };
};

const inactiveUsers = async (db: SupabaseClient): Promise<ToolOutcome> => {
  const profiles = await pageRows((from, to) => db.from('profiles').select('id, full_name, email, is_active').range(from, to));
  if (profiles.errorCode) {
    return emptyOutcome('Inactive users could not be loaded.', profiles.errorCode);
  }
  const signIns = await db.rpc('admin_user_sign_ins');
  const lastSignIn = new Map<string, string | null>();
  let signInNote = '';
  if (signIns.error) {
    signInNote = ' Last sign-in could not be checked, so this list is only deactivated accounts.';
  } else {
    for (const row of signIns.data ?? []) {
      lastSignIn.set(row.user_id, row.last_sign_in_at);
    }
  }
  const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const inactive = (profiles.rows as Array<{ id?: string; full_name?: string | null; email?: string | null; is_active?: boolean }>).filter((person) => {
    if (person.is_active === false) {
      return true;
    }
    if (signIns.error || typeof person.id !== 'string') {
      return false;
    }
    const last = lastSignIn.get(person.id);
    return !last || new Date(last).getTime() < cutoff;
  });
  const shown = inactive.slice(0, 20);
  return {
    summary: `${inactive.length} inactive user(s). Showing ${shown.length}.${signInNote}`,
    table: {
      columns: ['Name', 'Email'],
      rows: shown.map((person) => [text(person.full_name), text(person.email)]),
    },
    stats: [{ label: 'Inactive users', value: String(inactive.length) }],
    links: sanitizeLinks([{ label: 'Users', path: '/admin/users' }], 'admin'),
    denied: false,
    errorCode: null,
  };
};

const courseReport = async (db: SupabaseClient, role: CallerRole, title: string): Promise<ToolOutcome> => {
  const found = await findCourses(db, 'admin', title);
  if (found.errorCode || found.courses.length !== 1) {
    return emptyOutcome(found.errorCode ? 'That course report could not be loaded.' : found.courses.length === 0 ? `No course is named "${title}".` : `More than one course is named "${title}".`, found.errorCode);
  }
  const course = found.courses[0];
  const enrollmentCount = await db.from('enrollments').select('id', { count: 'exact', head: true }).eq('course_id', course.id);
  const completedCount = await db.from('enrollments').select('id', { count: 'exact', head: true }).eq('course_id', course.id).or('status.eq.completed,completed_at.not.is.null');
  const assessments = await db.from('assessments').select('id').eq('course_id', course.id);
  if (enrollmentCount.error || completedCount.error || assessments.error) {
    return emptyOutcome('That course report could not be loaded.', enrollmentCount.error?.code ?? completedCount.error?.code ?? assessments.error?.code ?? 'query_failed');
  }
  const assessmentIds = (assessments.data ?? []).map((row) => row.id);
  let attemptCount = 0;
  if (assessmentIds.length > 0) {
    const attempts = await db.from('assessment_attempts').select('id', { count: 'exact', head: true }).in('assessment_id', assessmentIds);
    if (attempts.error) {
      return emptyOutcome('That course report could not be loaded.', attempts.error.code ?? 'query_failed');
    }
    attemptCount = attempts.count ?? 0;
  }
  return {
    summary: `${text(course.title)} has ${enrollmentCount.count ?? 0} enrollment(s) and ${attemptCount} attempt(s).`,
    table: null,
    stats: [
      { label: 'Enrollments', value: String(enrollmentCount.count ?? 0) },
      { label: 'Completed', value: String(completedCount.count ?? 0) },
      { label: 'Attempts', value: String(attemptCount) },
    ],
    links: courseLink(role, course),
    denied: false,
    errorCode: null,
  };
};

const listAssessments = async (db: SupabaseClient, title: string): Promise<ToolOutcome> => {
  const found = await findCourses(db, 'admin', title);
  if (found.errorCode || found.courses.length !== 1) {
    return emptyOutcome(found.errorCode ? 'Assessments could not be loaded.' : found.courses.length === 0 ? `No program is named "${title}".` : `More than one program is named "${title}".`, found.errorCode);
  }
  const { data, error } = await db
    .from('assessments')
    .select('title, duration_minutes, passing_score, sequence, is_active, is_published')
    .eq('course_id', found.courses[0].id)
    .order('sequence')
    .limit(50);
  if (error) {
    return emptyOutcome('Assessments could not be loaded.', error.code ?? 'query_failed');
  }
  const rows = data ?? [];
  return {
    summary: rows.length === 0 ? `No assessments are saved for ${text(found.courses[0].title)}.` : `${rows.length} assessment(s) for ${text(found.courses[0].title)}.`,
    table: {
      columns: ['Assessment', 'Minutes', 'Pass mark', 'Sequence', 'Active', 'Published'],
      rows: rows.map((row) => [text(row.title), text(row.duration_minutes), text(row.passing_score), text(row.sequence), row.is_active ? 'Yes' : 'No', row.is_published ? 'Yes' : 'No']),
    },
    stats: null,
    links: sanitizeLinks([{ label: 'Assessments', path: '/admin/assessments' }], 'admin'),
    denied: false,
    errorCode: null,
  };
};

const assessmentQuestions = async (db: SupabaseClient, programTitle: string, assessmentTitle: string): Promise<ToolOutcome> => {
  const found = await findCourses(db, 'admin', programTitle);
  if (found.errorCode || found.courses.length !== 1) {
    return emptyOutcome(found.errorCode ? 'Those questions could not be loaded.' : found.courses.length === 0 ? `No program is named "${programTitle}".` : `More than one program is named "${programTitle}".`, found.errorCode);
  }
  const assessments = await db.from('assessments').select('id, title').eq('course_id', found.courses[0].id).ilike('title', literalIlike(assessmentTitle)).limit(5);
  if (assessments.error) {
    return emptyOutcome('Those questions could not be loaded.', assessments.error.code ?? 'query_failed');
  }
  if ((assessments.data ?? []).length !== 1) {
    return emptyOutcome((assessments.data ?? []).length === 0 ? `No assessment is named "${assessmentTitle}".` : `More than one assessment is named "${assessmentTitle}".`);
  }
  const assessment = assessments.data![0];
  const questions = await db
    .from('assessment_questions')
    .select('id, prompt, kind, marks, accepted_answers')
    .eq('assessment_id', assessment.id)
    .order('sort_order')
    .limit(100);
  if (questions.error) {
    return emptyOutcome('Those questions could not be loaded.', questions.error.code ?? 'query_failed');
  }
  const questionRows = questions.data ?? [];
  const questionIds = questionRows.map((row) => row.id);
  const options = questionIds.length === 0
    ? { data: [], error: null }
    : await db.from('assessment_options').select('question_id, label, is_correct').in('question_id', questionIds);
  if (options.error) {
    return emptyOutcome('Those questions could not be loaded.', options.error.code ?? 'query_failed');
  }
  const correctByQuestion = new Map<string, string[]>();
  for (const option of options.data ?? []) {
    if (option.is_correct) {
      const current = correctByQuestion.get(option.question_id) ?? [];
      current.push(option.label);
      correctByQuestion.set(option.question_id, current);
    }
  }
  return {
    summary: `${questionRows.length} question(s) on ${text(assessment.title)}.`,
    table: {
      columns: ['Prompt', 'Kind', 'Marks', 'Correct answer'],
      rows: questionRows.map((row) => {
        const accepted = (row.accepted_answers ?? []).join(', ');
        const correct = (correctByQuestion.get(row.id) ?? []).join(', ');
        return [text(row.prompt), text(row.kind), text(row.marks), correct || accepted || '—'];
      }),
    },
    stats: [{ label: 'Questions', value: String(questionRows.length) }],
    links: sanitizeLinks([{ label: 'Assessments', path: '/admin/assessments' }], 'admin'),
    denied: false,
    errorCode: null,
  };
};
