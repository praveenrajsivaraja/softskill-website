import { supabase } from '@/integrations/supabase/client';
import { excelDownloadFromReport, loadAdminExcelReport } from '@/lib/kiki/adminExcelExport';
import { presentCourseCatalog } from '@/lib/kiki/courseCatalogReply';
import { describeIntent, matchQuestion, reportKindFromQuestion, searchKeywords, type AssistantIntent } from '@/lib/kiki/routes';
import type { ExcelDownload } from '@/lib/excelReport';
import { buildSaleOrders, summarizeProgramSales } from '@/lib/programSales';

export interface LocalReply {
  text: string;
  table: { columns: string[]; rows: string[][] } | null;
  stats: { label: string; value: string }[] | null;
  links: { label: string; path: string }[];
  report: ExcelDownload | null;
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

const reportFromAnswer = (extra: Partial<Omit<LocalReply, 'text'>>, isAdmin: boolean): ExcelDownload | null => {
  if (!isAdmin) {
    return null;
  }
  if (extra.report) {
    return extra.report;
  }
  const sheets: ExcelDownload['sheets'] = [];
  if (extra.stats && extra.stats.length > 0) {
    sheets.push({
      name: 'Summary',
      headers: ['Metric', 'Value'],
      rows: extra.stats.map((stat) => [stat.label, stat.value]),
    });
  }
  if (extra.table && extra.table.rows.length > 0) {
    sheets.push({
      name: 'Details',
      headers: extra.table.columns,
      rows: extra.table.rows,
    });
  }
  if (sheets.length === 0) {
    return null;
  }
  return { filename: 'kiki-details.xls', sheets };
};

const reply = (
  textValue: string,
  extra: Partial<Omit<LocalReply, 'text'>> = {},
  isAdmin = false,
): LocalReply => ({
  text: textValue,
  table: extra.table ?? null,
  stats: extra.stats ?? null,
  links: extra.links ?? [],
  report: reportFromAnswer(extra, isAdmin),
});

const denied = () => reply('You do not have access to that information.');

const signIn = (purpose: string) => reply(`Sign in to ${purpose}.`, { links: [{ label: 'Sign in', path: '/login' }] });

export const answerLocally = async (
  question: string,
  role: AppRole,
  userId: string | null,
): Promise<LocalReply | null> => {
  if (!normalize(question)) {
    return null;
  }
  const matched = matchQuestion(question);
  const keywords = searchKeywords(question);
  const isAdmin = role === 'admin';
  if (matched && 'intent' in matched && matched.intent === 'list_courses' && keywords.length > 0) {
    return (await searchCourses(keywords, isAdmin)) ?? reply(`No active courses match ${keywords.join(' ')}.`, {
      links: [{ label: 'Programs', path: '/programs' }],
    });
  }
  if (!matched) {
    return keywords.length > 0 ? searchCourses(keywords, isAdmin) : null;
  }
  if ('clarify' in matched) {
    return reply(`Do you want ${describeIntent(matched.clarify[0])} or ${describeIntent(matched.clarify[1])}?`);
  }
  return replyForIntent(matched.intent, question, role === 'admin', userId);
};

const adminOnly = (textValue: string, path: string, label: string, isAdmin: boolean): LocalReply => {
  if (!isAdmin) {
    return reply('An administrator does that from the admin panel. You can browse programs, enroll, and review your own learning.');
  }
  return reply(textValue, { links: [{ label, path }] });
};

const replyForIntent = (
  intent: AssistantIntent,
  question: string,
  isAdmin: boolean,
  userId: string | null,
): Promise<LocalReply> | LocalReply => {
  switch (intent) {
    case 'count_courses':
      return isAdmin ? countCourses() : denied();
    case 'count_users':
      return isAdmin ? countUsers() : denied();
    case 'count_enrollments':
      return isAdmin ? countEnrollments() : denied();
    case 'highest_enrollment':
      return isAdmin ? highestEnrollment() : denied();
    case 'overview':
      return isAdmin ? platformOverview() : listCourses(false);
    case 'inactive_users':
      return isAdmin ? inactiveUsers() : denied();
    case 'average_score':
      return isAdmin ? averageScore() : denied();
    case 'my_enrollments':
      return userId ? myEnrollments(userId) : signIn('see your courses');
    case 'my_scores':
      return userId ? myAttempts(userId) : signIn('see your scores');
    case 'list_courses':
      return listCourses(isAdmin);
    case 'enroll':
      return reply('Enroll from the program page.\n→ Open a program\n→ Add it to the cart\n→ Finish checkout\n→ Your learning then appears on My learning', {
        links: [
          { label: 'Programs', path: '/programs' },
          { label: 'Cart', path: '/cart' },
          { label: 'My learning', path: '/enrolled-courses' },
        ],
      });
    case 'thumbnail':
      return reply('A course image is a Google or Drive link.\n→ There is no required thumbnail size or aspect ratio', {
        links: isAdmin ? [{ label: 'Courses', path: '/admin/courses' }] : [{ label: 'Programs', path: '/programs' }],
      });
    case 'add_assessment':
      return adminOnly(
        'Add an assessment in the admin panel.\n→ Open Assessments\n→ Choose the program → New assessment → Create single assessment\n→ Enter the title, instructions, duration, and passing score\n→ Use Add question for each question, then save\n→ A CSV also works: one row is one question, and program_title must match a saved course title\n→ Saving over an existing title replaces that assessment\'s questions',
        '/admin/assessments',
        'Assessments',
        isAdmin,
      );
    case 'assessment_howto':
      return reply('Each assessment belongs to one program.\n→ Question types: multiple choice, listening, fill in the blank, matching, word order, and written response\n→ The passing score is set on that assessment\n→ The answer is checked when the learner submits\n→ A learner is not shown the answer key');
    case 'upload_material':
      return adminOnly(
        'Add a course document from Courses.\n→ Edit the program and add the document link\n→ Use a Google or Drive link\n→ Share the file so anyone with the link can view it\n→ After purchase, the course page groups those files by month',
        '/admin/courses',
        'Courses',
        isAdmin,
      );
    case 'add_course':
      return adminOnly(
        'Add a course from the admin panel.\n→ Open Courses → Add course → Create single course\n→ Save the form, or upload a CSV\n→ A row with the same title updates that course\n→ The image is a Google or Drive link, with no required pixel size',
        '/admin/courses',
        'Courses',
        isAdmin,
      );
    case 'career_test':
      return adminOnly(
        'Career tests have two places.\n→ Admins: Career Test → add or edit a test\n→ Learners: public Career Test page',
        '/admin/career-test',
        'Career Test',
        isAdmin,
      );
    case 'manage_users':
      return adminOnly(
        'Manage accounts from Users.\n→ Create one person, or upload a CSV\n→ A matching email updates that user\n→ Roles are student, instructor, and admin\n→ KIKI cannot create accounts or change passwords',
        '/admin/users',
        'Users',
        isAdmin,
      );
    case 'sales':
      return isAdmin ? totalSales() : denied();
    case 'export_report':
      return isAdmin ? exportReport(question) : denied();
    case 'coupon':
      return adminOnly('Discount codes live on Coupons.\n→ Open Coupons to add or edit a code', '/admin/coupons', 'Coupons', isAdmin);
    case 'homepage':
      return adminOnly('Public homepage content is edited in the admin panel.\n→ Open Homepage', '/admin/homepage', 'Homepage', isAdmin);
    case 'student_progress':
      return isAdmin
        ? reply('Scores and enrollments are on two screens.\n→ Progress → scores and answers\n→ Enrollments → who joined each program', {
          links: [
            { label: 'Progress', path: '/admin/progress' },
            { label: 'Enrollments', path: '/admin/enrollments' },
          ],
        })
        : reply('Your progress is on My learning.\n→ Open My learning\n→ See the programs you joined', {
          links: [{ label: 'My learning', path: '/enrolled-courses' }],
        });
    case 'find_assessment':
      return reply('Assessments are on the program page after you enroll.\n→ Open My learning\n→ Open that program', {
        links: [
          { label: 'My learning', path: '/enrolled-courses' },
          { label: 'Programs', path: '/programs' },
        ],
      });
    case 'my_progress':
      return reply('Your progress is on My learning.\n→ Open My learning\n→ See the programs you joined', {
        links: [{ label: 'My learning', path: '/enrolled-courses' }],
      });
    case 'sign_up':
      return reply('Create a student account from Login.\n→ Open Login → Sign Up\n→ A new account is created as a student', {
        links: [{ label: 'Sign in', path: '/login' }],
      });
    case 'cart':
      return reply('Checkout follows the cart.\n→ Add a program\n→ Open the cart\n→ Continue to checkout', {
        links: [
          { label: 'Programs', path: '/programs' },
          { label: 'Cart', path: '/cart' },
          { label: 'Checkout', path: '/checkout' },
        ],
      });
    case 'navigation':
      return navigationMenu(isAdmin);
    default: {
      const unmetIntent: never = intent;
      throw new Error(`Unhandled assistant question: ${String(unmetIntent)}`);
    }
  }
};

const exportReport = async (question: string): Promise<LocalReply> => {
  const kind = reportKindFromQuestion(question);
  if (!kind) {
    return reply('Choose a report to export as Excel.\n→ Users\n→ Sales\n→ Courses\n→ Progress\n→ Enrollments\n→ Assessments\n→ Coupons\n→ Career tests\n→ Dashboard');
  }
  try {
    const loaded = await loadAdminExcelReport(kind);
    if (!loaded) {
      return reply('That report could not be exported.');
    }
    return reply(loaded.text, {
      links: loaded.links,
      report: excelDownloadFromReport(loaded),
    }, true);
  } catch (error) {
    console.error(JSON.stringify({
      event: 'kiki_excel_export_failed',
      message: error instanceof Error ? error.message : 'unknown',
    }));
    return reply('That report could not be exported.');
  }
};

const navigationMenu = (isAdmin: boolean): LocalReply => {
  if (!isAdmin) {
    return reply('Start from the public site.\n→ Browse programs\n→ Add one to the cart and finish checkout\n→ Your programs and assessments are on My Courses', {
      links: [
        { label: 'Programs', path: '/programs' },
        { label: 'My learning', path: '/enrolled-courses' },
        { label: 'Cart', path: '/cart' },
      ],
    });
  }
  return reply('Use the admin panel.\n→ Courses → add a program\n→ Assessments → add questions\n→ Users → manage accounts\n→ Progress → scores\n→ Enrollments → who joined', {
    links: [
      { label: 'Courses', path: '/admin/courses' },
      { label: 'Assessments', path: '/admin/assessments' },
      { label: 'Users', path: '/admin/users' },
      { label: 'Progress', path: '/admin/progress' },
    ],
  });
};

interface CourseSummary {
  id: string;
  title: string | null;
  category: string | null;
  price: number | null;
  duration: string | null;
  age_range: string | null;
  mode: string | null;
}

const describeCourses = (courses: CourseSummary[], summary: string, isAdmin: boolean): LocalReply => {
  const presented = presentCourseCatalog(
    courses.map((course) => ({
      id: course.id,
      title: course.title,
      category: course.category,
      price: course.price,
      duration: course.duration,
      ageRange: course.age_range,
      mode: course.mode,
    })),
    summary,
    isAdmin,
  );
  return reply(presented.text, {
    stats: presented.stats,
    table: presented.table,
    links: presented.links,
  }, presented.includeSpreadsheet);
};

const listCourses = async (isAdmin: boolean): Promise<LocalReply> => {
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
  if (courses.length === 0) {
    return reply('No active courses are available.');
  }
  return describeCourses(courses, `${courses.length} active course(s) are available.`, isAdmin);
};

const searchCourses = async (keywords: string[], isAdmin: boolean): Promise<LocalReply | null> => {
  if (keywords.length === 0) {
    return null;
  }
  const { data, error } = await supabase
    .from('courses')
    .select('id, title, category, price, duration, age_range, mode')
    .eq('status', 'active')
    .order('title')
    .limit(200);
  if (error) {
    console.error(JSON.stringify({ event: 'kiki_local_course_search_failed', code: error.code }));
    return reply('The course list could not be loaded.');
  }
  const courses = data ?? [];
  const haystack = (course: CourseSummary) => `${course.title ?? ''} ${course.category ?? ''}`.toLowerCase();
  const everyMatch = courses.filter((course) => keywords.every((word) => haystack(course).includes(word)));
  const matched = everyMatch.length > 0
    ? everyMatch
    : courses.filter((course) => keywords.some((word) => haystack(course).includes(word)));
  if (matched.length === 0) {
    return null;
  }
  const label = keywords.join(' ');
  const summary = matched.length === 1 ? `1 course matches ${label}.` : `${matched.length} courses match ${label}.`;
  return describeCourses(matched, summary, isAdmin);
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

const formatInr = (amount: number) => new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
}).format(amount);

const totalSales = async (): Promise<LocalReply> => {
  const { data: orders, error } = await supabase
    .from('orders')
    .select('id, user_id, total_amount, status, payment_method, created_at')
    .order('created_at', { ascending: false })
    .limit(1000);
  if (error) {
    console.error(JSON.stringify({ event: 'kiki_local_sales_failed', code: error.code }));
    return reply('Sales could not be loaded.');
  }
  const orderRows = orders ?? [];
  const orderIds = orderRows.map((order) => order.id);
  const itemResult = orderIds.length === 0
    ? { data: [], error: null }
    : await supabase.from('order_items').select('order_id, course_id, price').in('order_id', orderIds);
  if (itemResult.error) {
    console.error(JSON.stringify({ event: 'kiki_local_sales_items_failed', code: itemResult.error.code }));
  }
  const itemRows = itemResult.data ?? [];
  const courseIds = [...new Set(itemRows.map((item) => item.course_id))];
  const courseResult = courseIds.length === 0
    ? { data: [], error: null }
    : await supabase.from('courses').select('id, title').in('id', courseIds);
  if (courseResult.error) {
    console.error(JSON.stringify({ event: 'kiki_local_sales_courses_failed', code: courseResult.error.code }));
  }
  const summary = summarizeProgramSales(buildSaleOrders(
    orderRows.map((order) => ({
      id: order.id,
      userId: order.user_id,
      amount: order.total_amount,
      status: order.status,
      paymentMethod: order.payment_method,
      createdAt: order.created_at,
    })),
    itemRows.map((item) => ({
      orderId: item.order_id,
      courseId: item.course_id,
      price: item.price,
    })),
    [],
    (courseResult.data ?? []).map((course) => ({ id: course.id, title: course.title })),
  ));
  return reply(`Paid sales total ${formatInr(summary.paidRevenue)} across ${summary.paidOrderCount} paid order(s).`, {
    stats: [
      { label: 'Paid revenue', value: formatInr(summary.paidRevenue) },
      { label: 'Paid orders', value: String(summary.paidOrderCount) },
      { label: 'Average order', value: formatInr(summary.averageOrderValue) },
      { label: 'Programs sold', value: String(summary.programsSold) },
    ],
    table: summary.programTotals.length === 0 ? null : {
      columns: ['Program', 'Sold', 'Revenue'],
      rows: summary.programTotals.slice(0, 10).map((program) => [program.title, String(program.unitsSold), formatInr(program.revenue)]),
    },
    links: [{ label: 'Sales', path: '/admin/sales' }],
  }, true);
};

const countEnrollments = async (): Promise<LocalReply> => {
  const { count, error } = await supabase.from('enrollments').select('id', { count: 'exact', head: true });
  if (error) {
    console.error(JSON.stringify({ event: 'kiki_local_count_enrollments_failed', code: error.code }));
    return reply('Enrollments could not be counted.');
  }
  const value = count ?? 0;
  return reply(`There are ${value} enrollment(s).`, {
    stats: [{ label: 'Enrollments', value: String(value) }],
    links: [{ label: 'Enrollments', path: '/admin/enrollments' }],
  }, true);
};

const countCourses = async (): Promise<LocalReply> => {
  const { count, error } = await supabase.from('courses').select('id', { count: 'exact', head: true });
  if (error) {
    console.error(JSON.stringify({ event: 'kiki_local_count_courses_failed', code: error.code }));
    return reply('Courses could not be counted.');
  }
  const value = count ?? 0;
  return reply(`There are ${value} course(s).`, { stats: [{ label: 'Courses', value: String(value) }] }, true);
};

const countUsers = async (): Promise<LocalReply> => {
  const { count, error } = await supabase.from('profiles').select('id', { count: 'exact', head: true });
  if (error) {
    console.error(JSON.stringify({ event: 'kiki_local_count_users_failed', code: error.code }));
    return reply('Users could not be counted.');
  }
  const value = count ?? 0;
  return reply(`There are ${value} registered user(s).`, { stats: [{ label: 'Registered users', value: String(value) }] }, true);
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
  }, true);
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
  }, true);
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
  return reply(`The average score is ${average} across ${attempts.length} attempt(s).`, { stats }, true);
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
  }, true);
};
