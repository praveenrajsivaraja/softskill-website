import { supabase } from '@/integrations/supabase/client';
import {
  assessmentReportSheet,
  careerSectionReportSheet,
  couponReportSheet,
  courseReportSheet,
  dashboardReportSheet,
  enrollmentReportSheets,
  progressReportSheets,
  salesReportSheets,
  userReportSheet,
} from '@/lib/adminScreenReports';
import { COURSE_TYPE_CAREER_TEST } from '@/lib/courseCatalog';
import type { ExcelDownload, ExcelSheet } from '@/lib/excelReport';
import { buildSaleOrders, enrollmentCompletionPercent, summarizeProgramSales } from '@/lib/programSales';
import { fetchAdminStudentProgress } from '@/lib/assessmentApi';
import { summarizeUserLearning, type EnrollmentRecord } from '@/lib/userLearningSummary';
import type { AdminReportKind } from '@/lib/kiki/routes';

const formatMoney = (amount: number) => new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
}).format(amount);

const formatWhen = (value: string | null | undefined): string => {
  if (!value) {
    return '';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  return date.toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};

const formatDay = (value: string | null | undefined): string => {
  if (!value) {
    return '';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
};

const readCourse = (
  course: { title: string | null; duration?: string | null } | { title: string | null; duration?: string | null }[] | null,
) => (Array.isArray(course) ? course[0] ?? null : course);

export interface LoadedAdminReport {
  filename: string;
  sheets: ExcelSheet[];
  text: string;
  links: { label: string; path: string }[];
}

const usersReport = async (): Promise<LoadedAdminReport> => {
  const [profileResult, enrollmentResult, signInResult] = await Promise.all([
    supabase.from('profiles').select('id, email, full_name, phone, role, is_active, created_at, last_sign_in_at').order('created_at', { ascending: false }),
    supabase.from('enrollments').select('id, student_id, status, progress, enrolled_at, completed_at, courses(title, duration)'),
    supabase.rpc('admin_user_sign_ins'),
  ]);
  if (profileResult.error) {
    console.error(JSON.stringify({ event: 'admin_excel_users_failed', code: profileResult.error.code }));
    throw profileResult.error;
  }
  const lastSignIn = new Map<string, string | null>();
  if (!signInResult.error) {
    for (const row of signInResult.data ?? []) {
      lastSignIn.set(row.user_id, row.last_sign_in_at);
    }
  }
  const enrollmentsByStudent = new Map<string, EnrollmentRecord[]>();
  for (const enrollment of enrollmentResult.data ?? []) {
    if (!enrollment.student_id) {
      continue;
    }
    const course = readCourse(enrollment.courses);
    const existing = enrollmentsByStudent.get(enrollment.student_id) ?? [];
    existing.push({
      id: enrollment.id,
      courseTitle: course?.title ?? 'Untitled course',
      duration: course?.duration ?? null,
      status: enrollment.status,
      progress: enrollment.progress,
      enrolledAt: enrollment.enrolled_at,
      completedAt: enrollment.completed_at,
    });
    enrollmentsByStudent.set(enrollment.student_id, existing);
  }
  const observedAt = new Date();
  const users = (profileResult.data ?? []).map((profile) => {
    const learning = summarizeUserLearning(enrollmentsByStudent.get(profile.id) ?? [], observedAt);
    const last = lastSignIn.get(profile.id) ?? profile.last_sign_in_at;
    return {
      email: profile.email,
      fullName: profile.full_name,
      phone: profile.phone,
      role: profile.role,
      isActive: profile.is_active !== false,
      currentCourses: learning.currentTitles.join(', '),
      recentCourse: learning.recentCourseTitle ?? '',
      enrolledAt: formatDay(learning.recentEnrolledAt),
      expiresAt: learning.recentExpiresAt ? formatDay(learning.recentExpiresAt) : '',
      lastLogin: signInResult.error ? 'Unavailable' : (last ? formatWhen(last) : 'Never'),
      joined: formatDay(profile.created_at),
    };
  });
  return {
    filename: 'users-report.xls',
    sheets: [userReportSheet(users)],
    text: `Exported ${users.length} user(s) to Excel.`,
    links: [{ label: 'Users', path: '/admin/users' }],
  };
};

const salesReport = async (): Promise<LoadedAdminReport> => {
  const { data: orders, error } = await supabase
    .from('orders')
    .select('id, user_id, total_amount, status, payment_method, created_at')
    .order('created_at', { ascending: false })
    .limit(1000);
  if (error) {
    console.error(JSON.stringify({ event: 'admin_excel_sales_failed', code: error.code }));
    throw error;
  }
  const orderRows = orders ?? [];
  const orderIds = orderRows.map((order) => order.id);
  const userIds = [...new Set(orderRows.map((order) => order.user_id))];
  const [itemResult, buyerResult] = await Promise.all([
    orderIds.length === 0
      ? Promise.resolve({ data: [], error: null })
      : supabase.from('order_items').select('order_id, course_id, price').in('order_id', orderIds),
    userIds.length === 0
      ? Promise.resolve({ data: [], error: null })
      : supabase.from('profiles').select('id, full_name, email').in('id', userIds),
  ]);
  const itemRows = itemResult.data ?? [];
  const courseIds = [...new Set(itemRows.map((item) => item.course_id))];
  const courseResult = courseIds.length === 0
    ? { data: [], error: null }
    : await supabase.from('courses').select('id, title').in('id', courseIds);
  const sales = buildSaleOrders(
    orderRows.map((order) => ({
      id: order.id,
      userId: order.user_id,
      amount: order.total_amount,
      status: order.status,
      paymentMethod: order.payment_method,
      createdAt: order.created_at,
    })),
    itemRows.map((item) => ({ orderId: item.order_id, courseId: item.course_id, price: item.price })),
    (buyerResult.data ?? []).map((buyer) => ({ id: buyer.id, fullName: buyer.full_name, email: buyer.email })),
    (courseResult.data ?? []).map((course) => ({ id: course.id, title: course.title })),
  );
  const summary = summarizeProgramSales(sales);
  return {
    filename: 'sales-report.xls',
    sheets: salesReportSheets(
      [
        { label: 'Paid revenue', value: formatMoney(summary.paidRevenue) },
        { label: 'Paid orders', value: String(summary.paidOrderCount) },
        { label: 'Average order', value: formatMoney(summary.averageOrderValue) },
        { label: 'Programs sold', value: String(summary.programsSold) },
      ],
      summary.programTotals,
      sales,
      formatMoney,
      (value) => formatWhen(value),
    ),
    text: `Exported ${sales.length} sale(s) to Excel.`,
    links: [{ label: 'Sales', path: '/admin/sales' }],
  };
};

const coursesReport = async (careerTests: boolean): Promise<LoadedAdminReport> => {
  const { data, error } = await supabase
    .from('courses')
    .select('title, description, price, original_price, category, duration, status, total_lessons, course_type')
    .order('title');
  if (error) {
    console.error(JSON.stringify({ event: 'admin_excel_courses_failed', code: error.code }));
    throw error;
  }
  const courses = (data ?? []).filter((course) => (
    careerTests ? course.course_type === COURSE_TYPE_CAREER_TEST : course.course_type !== COURSE_TYPE_CAREER_TEST
  ));
  return {
    filename: careerTests ? 'career-tests-report.xls' : 'courses-report.xls',
    sheets: [courseReportSheet(courses.map((course) => ({
      title: course.title,
      description: course.description,
      price: course.price,
      originalPrice: course.original_price,
      category: course.category,
      duration: course.duration,
      status: course.status,
      lessons: course.total_lessons,
      type: course.course_type === COURSE_TYPE_CAREER_TEST ? 'Career test' : 'Course',
    })))],
    text: `Exported ${courses.length} ${careerTests ? 'career test(s)' : 'course(s)'} to Excel.`,
    links: [{ label: careerTests ? 'Career Test' : 'Courses', path: careerTests ? '/admin/career-test' : '/admin/courses' }],
  };
};

const progressReport = async (): Promise<LoadedAdminReport> => {
  const progress = await fetchAdminStudentProgress();
  return {
    filename: 'progress-report.xls',
    sheets: progressReportSheets(progress.students, progress.questionsByAssessmentId),
    text: `Exported progress for ${progress.students.length} student(s) to Excel.`,
    links: [{ label: 'Progress', path: '/admin/progress' }],
  };
};

const enrollmentsReport = async (): Promise<LoadedAdminReport> => {
  const [enrollmentResult, orderResult] = await Promise.all([
    supabase.from('enrollments').select('status, progress, completed_lessons, enrolled_at, completed_at, student_id, course_id').order('enrolled_at', { ascending: false }),
    supabase.from('orders').select('id, user_id, total_amount, created_at').eq('status', 'pending').order('created_at', { ascending: false }),
  ]);
  if (enrollmentResult.error || orderResult.error) {
    console.error(JSON.stringify({
      event: 'admin_excel_enrollments_failed',
      code: enrollmentResult.error?.code ?? orderResult.error?.code ?? 'query_failed',
    }));
    throw enrollmentResult.error ?? orderResult.error;
  }
  const enrollments = enrollmentResult.data ?? [];
  const orders = orderResult.data ?? [];
  const userIds = [...new Set([...enrollments.map((row) => row.student_id), ...orders.map((row) => row.user_id)].filter(Boolean))] as string[];
  const courseIds = [...new Set(enrollments.map((row) => row.course_id).filter(Boolean))] as string[];
  const [profileResult, courseResult, itemResult] = await Promise.all([
    userIds.length === 0 ? Promise.resolve({ data: [] }) : supabase.from('profiles').select('id, full_name, email').in('id', userIds),
    courseIds.length === 0 ? Promise.resolve({ data: [] }) : supabase.from('courses').select('id, title, total_lessons').in('id', courseIds),
    orders.length === 0
      ? Promise.resolve({ data: [] })
      : supabase.from('order_items').select('order_id, course_id').in('order_id', orders.map((order) => order.id)),
  ]);
  const profiles = new Map((profileResult.data ?? []).map((profile) => [profile.id, profile]));
  const courses = new Map((courseResult.data ?? []).map((course) => [course.id, course]));
  const extraCourseIds = [...new Set((itemResult.data ?? []).map((item) => item.course_id).filter((id) => !courses.has(id)))];
  if (extraCourseIds.length > 0) {
    const extraCourses = await supabase.from('courses').select('id, title, total_lessons').in('id', extraCourseIds);
    for (const course of extraCourses.data ?? []) {
      courses.set(course.id, course);
    }
  }
  const itemsByOrder = new Map<string, string[]>();
  for (const item of itemResult.data ?? []) {
    const titles = itemsByOrder.get(item.order_id) ?? [];
    titles.push(courses.get(item.course_id)?.title ?? 'Untitled course');
    itemsByOrder.set(item.order_id, titles);
  }
  return {
    filename: 'enrollments-report.xls',
    sheets: enrollmentReportSheets(
      orders.map((order) => {
        const profile = profiles.get(order.user_id);
        return {
          studentName: profile?.full_name ?? '',
          email: profile?.email ?? '',
          courses: (itemsByOrder.get(order.id) ?? []).join(', '),
          amount: formatMoney(order.total_amount),
          requested: formatDay(order.created_at),
        };
      }),
      enrollments.map((enrollment) => {
        const profile = profiles.get(enrollment.student_id);
        const course = courses.get(enrollment.course_id);
        return {
          studentName: profile?.full_name ?? '',
          email: profile?.email ?? '',
          course: course?.title ?? '',
          lessons: `${enrollment.completed_lessons ?? 0}/${course?.total_lessons ?? 0}`,
          status: enrollment.status ?? '',
          progress: `${enrollment.progress ?? 0}%`,
          enrolled: formatDay(enrollment.enrolled_at),
          completed: formatDay(enrollment.completed_at),
        };
      }),
    ),
    text: `Exported ${enrollments.length} enrollment(s) and ${orders.length} pending request(s) to Excel.`,
    links: [{ label: 'Enrollments', path: '/admin/enrollments' }],
  };
};

const assessmentsReport = async (): Promise<LoadedAdminReport> => {
  const [assessmentResult, courseResult] = await Promise.all([
    supabase.from('assessments').select('course_id, title, description, duration_minutes, passing_score, sequence, is_published, is_active').order('sequence'),
    supabase.from('courses').select('id, title'),
  ]);
  if (assessmentResult.error) {
    console.error(JSON.stringify({ event: 'admin_excel_assessments_failed', code: assessmentResult.error.code }));
    throw assessmentResult.error;
  }
  const titles = new Map((courseResult.data ?? []).map((course) => [course.id, course.title]));
  const assessments = assessmentResult.data ?? [];
  return {
    filename: 'assessments-report.xls',
    sheets: [assessmentReportSheet(assessments.map((assessment) => ({
      program: titles.get(assessment.course_id) ?? '',
      title: assessment.title,
      description: assessment.description,
      durationMinutes: assessment.duration_minutes,
      passingScore: assessment.passing_score,
      sequence: assessment.sequence,
      isPublished: assessment.is_published,
      isActive: assessment.is_active,
    })))],
    text: `Exported ${assessments.length} assessment(s) to Excel.`,
    links: [{ label: 'Assessments', path: '/admin/assessments' }],
  };
};

const couponsReport = async (): Promise<LoadedAdminReport> => {
  const [couponResult, courseResult] = await Promise.all([
    supabase.from('coupons').select('code, discount_type, discount_amount, course_restrictions, is_active, new_users_only, usage_limit, used_count, valid_until').order('code'),
    supabase.from('courses').select('id, title'),
  ]);
  if (couponResult.error) {
    console.error(JSON.stringify({ event: 'admin_excel_coupons_failed', code: couponResult.error.code }));
    throw couponResult.error;
  }
  const titles = new Map((courseResult.data ?? []).map((course) => [course.id, course.title]));
  const coupons = couponResult.data ?? [];
  return {
    filename: 'coupons-report.xls',
    sheets: [couponReportSheet(coupons.map((coupon) => {
      const restrictedId = coupon.course_restrictions?.[0];
      return {
        code: coupon.code,
        discountType: coupon.discount_type === 'fixed' ? 'Fixed' : 'Percentage',
        discount: coupon.discount_type === 'fixed' ? formatMoney(coupon.discount_amount) : `${coupon.discount_amount}%`,
        course: restrictedId ? (titles.get(restrictedId) ?? 'Selected course') : 'All courses',
        usage: `${coupon.used_count}${coupon.usage_limit ? `/${coupon.usage_limit}` : ''}`,
        status: coupon.is_active ? 'Active' : 'Inactive',
        newUsersOnly: coupon.new_users_only === true,
        validUntil: formatDay(coupon.valid_until),
      };
    }))],
    text: `Exported ${coupons.length} coupon(s) to Excel.`,
    links: [{ label: 'Coupons', path: '/admin/coupons' }],
  };
};

const careerReport = async (): Promise<LoadedAdminReport> => {
  const [tests, sectionsResult] = await Promise.all([
    coursesReport(true),
    supabase.from('page_sections').select('section_key, title, description, order_index').eq('page_key', 'career_test').order('order_index'),
  ]);
  const sectionSheet = careerSectionReportSheet((sectionsResult.data ?? []).map((section) => ({
    sectionKey: section.section_key,
    title: section.title ?? '',
    description: section.description,
    orderIndex: section.order_index,
  })));
  return {
    filename: 'career-test-report.xls',
    sheets: [...tests.sheets, sectionSheet],
    text: tests.text.replace(' to Excel.', ` and ${sectionSheet.rows.length} page section(s) to Excel.`),
    links: [{ label: 'Career Test', path: '/admin/career-test' }],
  };
};

const dashboardReport = async (): Promise<LoadedAdminReport> => {
  const [users, courses, paidOrders, activeEnrollments, completedEnrollments, orderAmounts] = await Promise.all([
    supabase.from('profiles').select('id', { count: 'exact', head: true }),
    supabase.from('courses').select('id', { count: 'exact', head: true }),
    supabase.from('orders').select('id', { count: 'exact', head: true }).in('status', ['confirmed', 'completed']),
    supabase.from('enrollments').select('id', { count: 'exact', head: true }).eq('status', 'enrolled'),
    supabase.from('enrollments').select('id', { count: 'exact', head: true }).eq('status', 'completed'),
    supabase.from('orders').select('total_amount').in('status', ['confirmed', 'completed']),
  ]);
  const revenue = (orderAmounts.data ?? []).reduce((sum, order) => sum + (order.total_amount || 0), 0);
  const stats = [
    { label: 'Users', value: String(users.count ?? 0) },
    { label: 'Courses', value: String(courses.count ?? 0) },
    { label: 'Paid orders', value: String(paidOrders.count ?? 0) },
    { label: 'Paid revenue', value: formatMoney(revenue) },
    { label: 'Active enrollments', value: String(activeEnrollments.count ?? 0) },
    { label: 'Completion', value: `${enrollmentCompletionPercent(completedEnrollments.count ?? 0, activeEnrollments.count ?? 0)}%` },
  ];
  return {
    filename: 'dashboard-report.xls',
    sheets: [dashboardReportSheet(stats)],
    text: 'Exported the dashboard summary to Excel.',
    links: [{ label: 'Dashboard', path: '/admin' }],
  };
};

const loadOne = (kind: AdminReportKind): Promise<LoadedAdminReport> => {
  switch (kind) {
    case 'users':
      return usersReport();
    case 'sales':
      return salesReport();
    case 'courses':
      return coursesReport(false);
    case 'progress':
      return progressReport();
    case 'enrollments':
      return enrollmentsReport();
    case 'assessments':
      return assessmentsReport();
    case 'coupons':
      return couponsReport();
    case 'career':
      return careerReport();
    case 'dashboard':
      return dashboardReport();
    default: {
      const unmet: never = kind;
      throw new Error(`Unknown report: ${String(unmet)}`);
    }
  }
};

export const loadAdminExcelReport = async (kind: AdminReportKind | 'all'): Promise<LoadedAdminReport | null> => {
  if (kind !== 'all') {
    return loadOne(kind);
  }
  const kinds: AdminReportKind[] = ['users', 'sales', 'courses', 'progress', 'enrollments', 'assessments', 'coupons', 'career', 'dashboard'];
  const loaded = await Promise.all(kinds.map(async (item) => {
    try {
      return await loadOne(item);
    } catch (error) {
      console.error(JSON.stringify({
        event: 'admin_excel_report_failed',
        report: item,
        message: error instanceof Error ? error.message : 'unknown',
      }));
      return null;
    }
  }));
  const sheets = loaded.flatMap((item) => item?.sheets ?? []);
  if (sheets.length === 0) {
    return null;
  }
  return {
    filename: 'admin-reports.xls',
    sheets,
    text: 'Exported the admin reports to one Excel file.',
    links: [{ label: 'Dashboard', path: '/admin' }],
  };
};

export const excelDownloadFromReport = (report: LoadedAdminReport): ExcelDownload => ({
  filename: report.filename,
  sheets: report.sheets,
  downloadNow: true,
});
