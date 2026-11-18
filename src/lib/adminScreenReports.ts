import type { ExcelSheet } from './excelReport.ts';
import type { ProgramSaleTotal, SaleOrder } from './programSales.ts';
import { describeAttemptAnswers, type StoredQuestion, type StudentProgressView } from './studentProgress.ts';

export interface UserReportInput {
  email: string;
  fullName: string | null;
  phone: string | null;
  role: string | null;
  isActive: boolean;
  currentCourses: string;
  recentCourse: string;
  enrolledAt: string;
  expiresAt: string;
  lastLogin: string;
  joined: string;
}

export interface CourseReportInput {
  title: string;
  description: string | null;
  price: number;
  originalPrice: number | null;
  category: string | null;
  duration: string | null;
  status: string | null;
  lessons: number | null;
  type: string;
}

export interface EnrollmentReportInput {
  studentName: string;
  email: string;
  course: string;
  lessons: string;
  status: string;
  progress: string;
  enrolled: string;
  completed: string;
}

export interface PendingOrderReportInput {
  studentName: string;
  email: string;
  courses: string;
  amount: string;
  requested: string;
}

export interface AssessmentReportInput {
  program: string;
  title: string;
  description: string | null;
  durationMinutes: number;
  passingScore: number;
  sequence: number;
  isPublished: boolean;
  isActive: boolean;
}

export interface CouponReportInput {
  code: string;
  discountType: string;
  discount: string;
  course: string;
  usage: string;
  status: string;
  newUsersOnly: boolean;
  validUntil: string;
}

export interface CareerSectionReportInput {
  sectionKey: string;
  title: string;
  description: string | null;
  orderIndex: number;
}

const blank = (value: string | null | undefined): string => value?.trim() ? value.trim() : '';

export const userReportSheet = (users: UserReportInput[]): ExcelSheet => ({
  name: 'Users',
  headers: ['Email', 'Name', 'Phone', 'Role', 'Status', 'Currently enrolled', 'Recent course', 'Enrolled', 'Expires', 'Last login', 'Joined'],
  rows: users.map((user) => [
    user.email,
    blank(user.fullName),
    blank(user.phone),
    blank(user.role),
    user.isActive ? 'Active' : 'Inactive',
    user.currentCourses,
    user.recentCourse,
    user.enrolledAt,
    user.expiresAt,
    user.lastLogin,
    user.joined,
  ]),
});

export const courseReportSheet = (courses: CourseReportInput[]): ExcelSheet => ({
  name: 'Courses',
  headers: ['Title', 'Description', 'Price', 'Original price', 'Category', 'Duration', 'Status', 'Lessons', 'Type'],
  rows: courses.map((course) => [
    course.title,
    blank(course.description),
    course.price,
    course.originalPrice ?? '',
    blank(course.category),
    blank(course.duration),
    blank(course.status),
    course.lessons ?? 0,
    course.type,
  ]),
});

export const salesReportSheets = (
  summary: Array<{ label: string; value: string }>,
  programTotals: ProgramSaleTotal[],
  sales: SaleOrder[],
  formatMoney: (amount: number) => string,
  formatWhen: (value: string) => string,
): ExcelSheet[] => [
  {
    name: 'Summary',
    headers: ['Metric', 'Value'],
    rows: summary.map((stat) => [stat.label, stat.value]),
  },
  {
    name: 'Revenue by program',
    headers: ['Program', 'Units sold', 'Revenue'],
    rows: programTotals.map((program) => [program.title, program.unitsSold, formatMoney(program.revenue)]),
  },
  {
    name: 'Sales',
    headers: ['Date', 'Buyer', 'Email', 'Programs', 'Amount', 'Status', 'Payment'],
    rows: sales.map((sale) => [
      formatWhen(sale.createdAt),
      sale.buyerName,
      sale.buyerEmail,
      sale.programs.map((program) => program.title).join(', '),
      formatMoney(sale.amount),
      sale.status,
      sale.paymentMethod ?? '',
    ]),
  },
];

export const enrollmentReportSheets = (
  orders: PendingOrderReportInput[],
  enrollments: EnrollmentReportInput[],
): ExcelSheet[] => [
  {
    name: 'Pending requests',
    headers: ['Student', 'Email', 'Courses', 'Amount', 'Request date'],
    rows: orders.map((order) => [order.studentName, order.email, order.courses, order.amount, order.requested]),
  },
  {
    name: 'Enrollments',
    headers: ['Student', 'Email', 'Course', 'Lessons', 'Status', 'Progress', 'Enrolled', 'Completed'],
    rows: enrollments.map((enrollment) => [
      enrollment.studentName,
      enrollment.email,
      enrollment.course,
      enrollment.lessons,
      enrollment.status,
      enrollment.progress,
      enrollment.enrolled,
      enrollment.completed,
    ]),
  },
];

export const progressReportSheets = (
  students: StudentProgressView[],
  questionsByAssessmentId: Record<string, StoredQuestion[]>,
): ExcelSheet[] => {
  const scoreRows: ExcelSheet['rows'] = [];
  const answerRows: ExcelSheet['rows'] = [];

  for (const student of students) {
    for (const program of student.programs) {
      if (program.assessments.length === 0) {
        scoreRows.push([
          student.studentName,
          student.email,
          student.phone ?? '',
          program.courseTitle,
          program.enrollmentStatus,
          program.progress,
          '',
          '',
          '',
          '',
          '',
        ]);
      }
      for (const assessment of program.assessments) {
        const attempts = assessment.attempts.length > 0 ? assessment.attempts : [null];
        for (const attempt of attempts) {
          scoreRows.push([
            student.studentName,
            student.email,
            student.phone ?? '',
            program.courseTitle,
            program.enrollmentStatus,
            program.progress,
            assessment.title,
            assessment.isPublished ? 'Published' : 'Draft',
            attempt ? attempt.submittedAt : '',
            attempt ? attempt.score : '',
            attempt ? (attempt.passed ? 'Passed' : 'Not passed') : 'Not started',
          ]);
          if (!attempt) {
            continue;
          }
          const details = describeAttemptAnswers(questionsByAssessmentId[assessment.id] ?? [], attempt.answers);
          for (const detail of details) {
            answerRows.push([
              student.studentName,
              student.email,
              program.courseTitle,
              assessment.title,
              attempt.submittedAt,
              detail.sectionTitle,
              detail.prompt,
              detail.responseLabel,
              detail.expectedLabel,
              detail.awarded ? 'Correct' : 'Needs practice',
              detail.marks,
            ]);
          }
        }
      }
    }
  }

  return [
    {
      name: 'Scores',
      headers: ['Student', 'Email', 'Phone', 'Program', 'Enrollment', 'Course progress', 'Assessment', 'Published', 'Submitted', 'Score', 'Result'],
      rows: scoreRows,
    },
    {
      name: 'Answers',
      headers: ['Student', 'Email', 'Program', 'Assessment', 'Submitted', 'Section', 'Question', 'Student answer', 'Expected', 'Result', 'Marks'],
      rows: answerRows,
    },
  ];
};

export const assessmentReportSheet = (assessments: AssessmentReportInput[]): ExcelSheet => ({
  name: 'Assessments',
  headers: ['Program', 'Title', 'Description', 'Duration minutes', 'Passing score', 'Sequence', 'Published', 'Active'],
  rows: assessments.map((assessment) => [
    assessment.program,
    assessment.title,
    blank(assessment.description),
    assessment.durationMinutes,
    assessment.passingScore,
    assessment.sequence,
    assessment.isPublished ? 'Published' : 'Draft',
    assessment.isActive ? 'Active' : 'Inactive',
  ]),
});

export const couponReportSheet = (coupons: CouponReportInput[]): ExcelSheet => ({
  name: 'Coupons',
  headers: ['Code', 'Type', 'Discount', 'Course', 'Usage', 'Status', 'New users only', 'Valid until'],
  rows: coupons.map((coupon) => [
    coupon.code,
    coupon.discountType,
    coupon.discount,
    coupon.course,
    coupon.usage,
    coupon.status,
    coupon.newUsersOnly ? 'Yes' : 'No',
    coupon.validUntil,
  ]),
});

export const careerSectionReportSheet = (sections: CareerSectionReportInput[]): ExcelSheet => ({
  name: 'Career test page',
  headers: ['Section', 'Title', 'Description', 'Order'],
  rows: sections.map((section) => [
    section.sectionKey,
    section.title,
    blank(section.description),
    section.orderIndex,
  ]),
});

export const dashboardReportSheet = (stats: Array<{ label: string; value: string }>): ExcelSheet => ({
  name: 'Dashboard',
  headers: ['Metric', 'Value'],
  rows: stats.map((stat) => [stat.label, stat.value]),
});
