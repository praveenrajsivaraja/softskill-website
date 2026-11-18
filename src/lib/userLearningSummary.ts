export type EnrollmentStatus = 'enrolled' | 'completed' | 'dropped' | 'pending';

export interface EnrollmentRecord {
  id: string;
  courseTitle: string;
  duration: string | null;
  status: EnrollmentStatus | null;
  progress: number | null;
  enrolledAt: string | null;
  completedAt: string | null;
}

export type AccessWindow = 'open' | 'expired' | 'none';

export interface UserLearningSummary {
  currentTitles: string[];
  recentCourseTitle: string | null;
  recentEnrolledAt: string | null;
  recentExpiresAt: string | null;
  recentStatus: EnrollmentStatus | null;
  recentProgress: number | null;
  recentAccess: AccessWindow;
  enrollmentCount: number;
}

const calendarDuration = /^(\d+)\s*(day|week|month|year)s?$/i;

export const enrollmentExpiresAt = (enrolledAt: string | null, duration: string | null) => {
  if (!enrolledAt || !duration) {
    return null;
  }

  const match = duration.trim().match(calendarDuration);
  if (!match) {
    return null;
  }

  const enrolled = new Date(enrolledAt);
  if (Number.isNaN(enrolled.getTime())) {
    return null;
  }

  const amount = Number(match[1]);
  const unit = match[2].toLowerCase();
  if (unit === 'day') {
    enrolled.setUTCDate(enrolled.getUTCDate() + amount);
  } else if (unit === 'week') {
    enrolled.setUTCDate(enrolled.getUTCDate() + amount * 7);
  } else if (unit === 'month') {
    enrolled.setUTCMonth(enrolled.getUTCMonth() + amount);
  } else {
    enrolled.setUTCFullYear(enrolled.getUTCFullYear() + amount);
  }

  return enrolled.toISOString();
};

const byMostRecentEnrollment = (left: EnrollmentRecord, right: EnrollmentRecord) => {
  const leftTime = left.enrolledAt ? new Date(left.enrolledAt).getTime() : 0;
  const rightTime = right.enrolledAt ? new Date(right.enrolledAt).getTime() : 0;
  return rightTime - leftTime;
};

export const summarizeUserLearning = (
  enrollments: EnrollmentRecord[],
  now: Date = new Date(),
): UserLearningSummary => {
  const recent = [...enrollments].sort(byMostRecentEnrollment)[0] ?? null;
  const recentExpiresAt = recent
    ? enrollmentExpiresAt(recent.enrolledAt, recent.duration)
    : null;
  const recentAccess: AccessWindow = recentExpiresAt
    ? new Date(recentExpiresAt).getTime() <= now.getTime() ? 'expired' : 'open'
    : 'none';

  return {
    currentTitles: enrollments
      .filter((enrollment) => enrollment.status === 'enrolled')
      .map((enrollment) => enrollment.courseTitle)
      .filter((title) => title.length > 0),
    recentCourseTitle: recent?.courseTitle || null,
    recentEnrolledAt: recent?.enrolledAt ?? null,
    recentExpiresAt,
    recentStatus: recent?.status ?? null,
    recentProgress: recent?.progress ?? null,
    recentAccess,
    enrollmentCount: enrollments.length,
  };
};
