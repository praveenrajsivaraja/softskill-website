import { supabase } from '@/integrations/supabase/client';

export interface LocalReply {
  text: string;
  table: { columns: string[]; rows: string[][] } | null;
  stats: { label: string; value: string }[] | null;
  links: { label: string; path: string }[];
}

type AppRole = 'guest' | 'student' | 'instructor' | 'admin';

const text = (value: unknown, fallback = '—'): string => {
  if (typeof value === 'string' && value.trim()) {
    return value.trim();
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }
  return fallback;
};

const normalize = (question: string) => question.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();

const reply = (
  textValue: string,
  extra: Partial<Omit<LocalReply, 'text'>> = {},
): LocalReply => ({
  text: textValue,
  table: extra.table ?? null,
  stats: extra.stats ?? null,
  links: extra.links ?? [],
});

const denied = () => reply('You do not have access to that information.');

const signIn = (purpose: string) => reply(`Sign in to ${purpose}.`, { links: [{ label: 'Sign in', path: '/login' }] });

export const answerLocally = async (
  question: string,
  role: AppRole,
  userId: string | null,
): Promise<LocalReply | null> => {
  const asked = normalize(question);
  const isAdmin = role === 'admin';
  if (!asked) {
    return null;
  }
  const guide = navigationReply(asked, isAdmin);
  if (guide) {
    return guide;
  }
  if (/(how do i enroll|enroll in a course|join a course)/.test(asked)) {
    return reply('Open a program, add it to the cart, and finish checkout. Your learning then appears on My learning.', {
      links: [
        { label: 'Programs', path: '/programs' },
        { label: 'Cart', path: '/cart' },
        { label: 'My learning', path: '/enrolled-courses' },
      ],
    });
  }
  if (/(thumbnail|image size|aspect ratio)/.test(asked)) {
    return reply('There is no required thumbnail size or aspect ratio. A course image is a Google or Drive link.', {
      links: isAdmin ? [{ label: 'Courses', path: '/admin/courses' }] : [{ label: 'Programs', path: '/programs' }],
    });
  }
  if (/(where can i add|add a new course|create a course|new course)/.test(asked)) {
    return isAdmin
      ? reply('Add a course from the Courses screen in the admin panel.', { links: [{ label: 'Courses', path: '/admin/courses' }] })
      : denied();
  }
  if (/(how many courses|count of courses|number of courses)/.test(asked)) {
    return isAdmin ? countCourses() : denied();
  }
  if (/(how many users|registered users|how many people)/.test(asked)) {
    return isAdmin ? countUsers() : denied();
  }
  if (/(highest enrollment|most users|most enrolled)/.test(asked)) {
    return isAdmin ? highestEnrollment() : denied();
  }
  if (/(overview|platform summary)/.test(asked)) {
    return isAdmin ? platformOverview() : listCourses();
  }
  if (/(inactive users|who is inactive)/.test(asked)) {
    return isAdmin ? inactiveUsers() : denied();
  }
  if (/(average score|average assessment)/.test(asked)) {
    return isAdmin ? averageScore() : denied();
  }
  if (/(my enrollment|am i enrolled|courses am i|my courses|my learning)/.test(asked)) {
    return userId ? myEnrollments(userId) : signIn('see your courses');
  }
  if (/(assessment score|my score|my attempt|check my assessment)/.test(asked)) {
    return userId ? myAttempts(userId) : signIn('see your scores');
  }
  if (/(courses i can join|available courses|show me the courses|show courses|list courses|what courses)/.test(asked)) {
    return listCourses();
  }
  if (/(how|where|navigate|which screen|what page|can i)/.test(asked)) {
    return navigationMenu(isAdmin);
  }
  return null;
};

const adminOnly = (textValue: string, path: string, label: string, isAdmin: boolean): LocalReply => {
  if (!isAdmin) {
    return reply('An administrator does that from the admin panel. You can browse programs, enroll, and review your own learning.');
  }
  return reply(textValue, { links: [{ label, path }] });
};

const navigationReply = (asked: string, isAdmin: boolean): LocalReply | null => {
  if (/(add|create|new|build|upload).{0,24}(assessment|question)|(assessment|question).{0,24}(add|create|new|upload)/.test(asked)) {
    return adminOnly(
      'Open Assessments in the admin panel. Choose the program, then New assessment and Create single assessment. Enter the title, instructions, duration, and passing score. Use Add question for each question, then save. A CSV also works: one row is one question, and program_title must match a saved course title. Saving over an existing assessment title replaces that assessment\'s questions.',
      '/admin/assessments',
      'Assessments',
      isAdmin,
    );
  }
  if (/how (does|do assessments|are assessments|is an assessment)|evaluation work|passing score/.test(asked)) {
    return reply('Each assessment belongs to one program. Question types are multiple choice, listening, fill in the blank, matching, word order, and written response. The passing score is set on that assessment. The answer is checked when the learner submits, and a learner is not shown the answer key.');
  }
  if (/(upload|add|attach).{0,20}(material|document|file|pdf)|(course material|course document)/.test(asked)) {
    return adminOnly(
      'Open Courses, edit the program, and add the document link. Use a Google or Drive link, and share the file so anyone with the link can view it. After purchase, the course page groups those files by month.',
      '/admin/courses',
      'Courses',
      isAdmin,
    );
  }
  if (/(add|create|new).{0,16}(course|program)|where.{0,20}(course|program)/.test(asked)) {
    return adminOnly(
      'Open Courses in the admin panel. Choose Add course, then Create single course, and save the form. You can also upload a CSV. A row with the same title updates that course. The image is a Google or Drive link, and there is no required pixel size.',
      '/admin/courses',
      'Courses',
      isAdmin,
    );
  }
  if (/(career test)/.test(asked) && /(add|create|edit|manage|where)/.test(asked)) {
    return adminOnly(
      'Open Career Test in the admin panel to add or edit a career test. Learners open the career test from the public Career Test page.',
      '/admin/career-test',
      'Career Test',
      isAdmin,
    );
  }
  if (/(manage|add|create|edit|delete).{0,16}user|where.{0,16}user/.test(asked)) {
    return adminOnly(
      'Open Users in the admin panel. Create one person, or upload a CSV. A matching email updates that user. Roles are student, instructor, and admin. KIKI cannot create accounts or change passwords.',
      '/admin/users',
      'Users',
      isAdmin,
    );
  }
  if (/(coupon|discount)/.test(asked)) {
    return adminOnly('Open Coupons in the admin panel to add or edit a discount code.', '/admin/coupons', 'Coupons', isAdmin);
  }
  if (/(homepage|home page)/.test(asked) && !/(overview)/.test(asked)) {
    return adminOnly('Open Homepage in the admin panel to change the public homepage content.', '/admin/homepage', 'Homepage', isAdmin);
  }
  if (/(student progress|view progress|scores and answers|see student score|where.{0,30}(progress|score))/.test(asked) && isAdmin && !/(my score|my assessment|check my)/.test(asked)) {
    return reply('Open Progress in the admin panel to see scores and answers. Open Enrollments to see who joined each program.', {
      links: [
        { label: 'Progress', path: '/admin/progress' },
        { label: 'Enrollments', path: '/admin/enrollments' },
      ],
    });
  }
  if (/(where.{0,24}(assessment)|find my assessment|take an assessment|my assessment)/.test(asked)) {
    return reply('After you enroll, open that program from My Courses. Its assessments are on the program page.', {
      links: [
        { label: 'My learning', path: '/enrolled-courses' },
        { label: 'Programs', path: '/programs' },
      ],
    });
  }
  if (/(my progress|learning progress|check my progress)/.test(asked)) {
    return reply('Open My Courses to see the programs you joined and your progress.', {
      links: [{ label: 'My learning', path: '/enrolled-courses' }],
    });
  }
  if (/(sign up|register|create an account)/.test(asked)) {
    return reply('Open Login and choose Sign Up. A new account is created as a student.', {
      links: [{ label: 'Sign in', path: '/login' }],
    });
  }
  if (/(cart|checkout|pay for)/.test(asked)) {
    return reply('Add a program to the cart, then open the cart and continue to checkout.', {
      links: [
        { label: 'Programs', path: '/programs' },
        { label: 'Cart', path: '/cart' },
        { label: 'Checkout', path: '/checkout' },
      ],
    });
  }
  return null;
};

const navigationMenu = (isAdmin: boolean): LocalReply => {
  if (!isAdmin) {
    return reply('You can browse programs, add one to the cart, and finish checkout. Your programs and assessments are on My Courses.', {
      links: [
        { label: 'Programs', path: '/programs' },
        { label: 'My learning', path: '/enrolled-courses' },
        { label: 'Cart', path: '/cart' },
      ],
    });
  }
  return reply('Use the admin panel: Courses to add a program, Assessments to add questions, Users to manage accounts, Progress for scores, and Enrollments for who joined.', {
    links: [
      { label: 'Courses', path: '/admin/courses' },
      { label: 'Assessments', path: '/admin/assessments' },
      { label: 'Users', path: '/admin/users' },
      { label: 'Progress', path: '/admin/progress' },
    ],
  });
};

const listCourses = async (): Promise<LocalReply> => {
  const { data, error } = await supabase
    .from('courses')
    .select('id, title, category, price, duration, age_range, mode')
    .eq('status', 'active')
    .order('title')
    .limit(50);
  if (error) {
    console.error(JSON.stringify({ event: 'kiki_local_courses_failed', code: error.code }));
    return reply('The course list could not be loaded.');
  }
  const courses = data ?? [];
  return reply(courses.length === 0 ? 'No active courses are available.' : `${courses.length} active course(s) are available.`, {
    stats: [{ label: 'Courses', value: String(courses.length) }],
    table: {
      columns: ['Title', 'Category', 'Price', 'Duration', 'Ages', 'Mode'],
      rows: courses.map((course) => [text(course.title), text(course.category), text(course.price), text(course.duration), text(course.age_range), text(course.mode)]),
    },
    links: courses.slice(0, 8).map((course) => ({ label: text(course.title, 'Open course'), path: `/course/${course.id}` })),
  });
};

const myEnrollments = async (userId: string): Promise<LocalReply> => {
  const { data, error } = await supabase
    .from('enrollments')
    .select('status, progress, enrolled_at, completed_at, courses(title)')
    .eq('student_id', userId)
    .limit(50);
  if (error) {
    console.error(JSON.stringify({ event: 'kiki_local_enrollments_failed', code: error.code }));
    return reply('Your enrollments could not be loaded.');
  }
  const rows = data ?? [];
  return reply(rows.length === 0 ? 'You have no enrollments yet.' : `You have ${rows.length} enrollment(s).`, {
    stats: [{ label: 'Enrollments', value: String(rows.length) }],
    table: {
      columns: ['Course', 'Status', 'Progress', 'Enrolled'],
      rows: rows.map((row) => {
        const course = Array.isArray(row.courses) ? row.courses[0] : row.courses;
        return [text(course?.title), text(row.status), `${text(row.progress, '0')}%`, text(row.enrolled_at).slice(0, 10)];
      }),
    },
    links: [{ label: 'My learning', path: '/enrolled-courses' }],
  });
};

const myAttempts = async (userId: string): Promise<LocalReply> => {
  const { data, error } = await supabase
    .from('assessment_attempts')
    .select('score, total_marks, passed, submitted_at, assessments(title)')
    .eq('user_id', userId)
    .order('submitted_at', { ascending: false })
    .limit(50);
  if (error) {
    console.error(JSON.stringify({ event: 'kiki_local_attempts_failed', code: error.code }));
    return reply('Your assessment scores could not be loaded.');
  }
  const rows = data ?? [];
  return reply(rows.length === 0 ? 'You have no submitted assessments yet.' : `You have ${rows.length} submitted assessment(s).`, {
    table: {
      columns: ['Assessment', 'Score', 'Total', 'Passed', 'Submitted'],
      rows: rows.map((row) => {
        const assessment = Array.isArray(row.assessments) ? row.assessments[0] : row.assessments;
        return [text(assessment?.title), text(row.score, '0'), text(row.total_marks, '0'), row.passed ? 'Yes' : 'No', text(row.submitted_at).slice(0, 10)];
      }),
    },
    links: [{ label: 'My learning', path: '/enrolled-courses' }],
  });
};

const countCourses = async (): Promise<LocalReply> => {
  const { count, error } = await supabase.from('courses').select('id', { count: 'exact', head: true });
  if (error) {
    console.error(JSON.stringify({ event: 'kiki_local_count_courses_failed', code: error.code }));
    return reply('Courses could not be counted.');
  }
  const value = count ?? 0;
  return reply(`There are ${value} course(s).`, { stats: [{ label: 'Courses', value: String(value) }] });
};

const countUsers = async (): Promise<LocalReply> => {
  const { count, error } = await supabase.from('profiles').select('id', { count: 'exact', head: true });
  if (error) {
    console.error(JSON.stringify({ event: 'kiki_local_count_users_failed', code: error.code }));
    return reply('Users could not be counted.');
  }
  const value = count ?? 0;
  return reply(`There are ${value} registered user(s).`, { stats: [{ label: 'Registered users', value: String(value) }] });
};

const platformOverview = async (): Promise<LocalReply> => {
  const [courses, users, enrollments] = await Promise.all([
    supabase.from('courses').select('id', { count: 'exact', head: true }),
    supabase.from('profiles').select('id', { count: 'exact', head: true }),
    supabase.from('enrollments').select('id', { count: 'exact', head: true }),
  ]);
  if (courses.error || users.error || enrollments.error) {
    console.error(JSON.stringify({
      event: 'kiki_local_overview_failed',
      code: courses.error?.code ?? users.error?.code ?? enrollments.error?.code ?? 'query_failed',
    }));
    return reply('The platform overview could not be loaded.');
  }
  return reply('Here is the current platform overview.', {
    stats: [
      { label: 'Courses', value: String(courses.count ?? 0) },
      { label: 'Registered users', value: String(users.count ?? 0) },
      { label: 'Enrollments', value: String(enrollments.count ?? 0) },
    ],
    links: [{ label: 'Dashboard', path: '/admin' }],
  });
};

const highestEnrollment = async (): Promise<LocalReply> => {
  const courses = await supabase.from('courses').select('id, title').limit(200);
  const enrollments = await supabase.from('enrollments').select('course_id').limit(5000);
  if (courses.error || enrollments.error) {
    console.error(JSON.stringify({
      event: 'kiki_local_enrollment_rank_failed',
      code: courses.error?.code ?? enrollments.error?.code ?? 'query_failed',
    }));
    return reply('Enrollment could not be compared.');
  }
  const counts = new Map<string, number>();
  for (const enrollment of enrollments.data ?? []) {
    if (enrollment.course_id) {
      counts.set(enrollment.course_id, (counts.get(enrollment.course_id) ?? 0) + 1);
    }
  }
  let winner: { id: string; title: string | null } | null = null;
  let winnerCount = 0;
  for (const course of courses.data ?? []) {
    const count = counts.get(course.id) ?? 0;
    if (count > winnerCount) {
      winner = course;
      winnerCount = count;
    }
  }
  if (!winner) {
    return reply('No enrollments are recorded.');
  }
  return reply(`${text(winner.title)} has the highest enrollment, with ${winnerCount} enrollment(s).`, {
    stats: [{ label: 'Highest enrollment', value: `${text(winner.title)} (${winnerCount})` }],
    links: [{ label: text(winner.title, 'Open course'), path: `/course/${winner.id}` }],
  });
};

const averageScore = async (): Promise<LocalReply> => {
  const { data, error } = await supabase.from('assessment_attempts').select('score, total_marks').limit(5000);
  if (error) {
    console.error(JSON.stringify({ event: 'kiki_local_average_failed', code: error.code }));
    return reply('The average score could not be loaded.');
  }
  const attempts = data ?? [];
  if (attempts.length === 0) {
    return reply('No assessment attempts are recorded.');
  }
  const scoreTotal = attempts.reduce((sum, attempt) => sum + (attempt.score ?? 0), 0);
  const marksTotal = attempts.reduce((sum, attempt) => sum + (attempt.total_marks ?? 0), 0);
  const average = Math.round((scoreTotal / attempts.length) * 10) / 10;
  const percents = attempts.filter((attempt) => (attempt.total_marks ?? 0) > 0);
  const percent = percents.length === 0
    ? null
    : Math.round((percents.reduce((sum, attempt) => sum + ((attempt.score ?? 0) / (attempt.total_marks ?? 1)) * 100, 0) / percents.length) * 10) / 10;
  const stats = [
    { label: 'Attempts', value: String(attempts.length) },
    { label: 'Average score', value: String(average) },
    { label: 'Average total marks', value: String(Math.round((marksTotal / attempts.length) * 10) / 10) },
  ];
  if (percent !== null) {
    stats.push({ label: 'Average percent', value: `${percent}%` });
  }
  return reply(`The average score is ${average} across ${attempts.length} attempt(s).`, { stats });
};

const inactiveUsers = async (): Promise<LocalReply> => {
  const profiles = await supabase.from('profiles').select('id, full_name, email, is_active').limit(5000);
  const signIns = await supabase.rpc('admin_user_sign_ins');
  if (profiles.error) {
    console.error(JSON.stringify({ event: 'kiki_local_inactive_failed', code: profiles.error.code }));
    return reply('Inactive users could not be loaded.');
  }
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
  const inactive = (profiles.data ?? []).filter((person) => {
    if (person.is_active === false) {
      return true;
    }
    if (signIns.error) {
      return false;
    }
    const last = lastSignIn.get(person.id);
    return !last || new Date(last).getTime() < cutoff;
  });
  return reply(`${inactive.length} inactive user(s).${signInNote}`, {
    stats: [{ label: 'Inactive users', value: String(inactive.length) }],
    table: {
      columns: ['Name', 'Email'],
      rows: inactive.slice(0, 20).map((person) => [text(person.full_name), text(person.email)]),
    },
    links: [{ label: 'Users', path: '/admin/users' }],
  });
};
