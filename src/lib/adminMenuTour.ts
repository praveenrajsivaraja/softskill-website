export interface TourStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface AdminMenuTourStep {
  path: string;
  label: string;
  text: string;
}

const seenKey = (userId: string) => `admin_menu_tour_seen_${userId}`;

const tourCopy: Record<string, string> = {
  '/admin': 'This is the home of the admin panel. It shows users, courses, orders, and enrollments at a glance.',
  '/admin/users': 'Open Users to create accounts, change a role, or turn an account on or off.',
  '/admin/courses': 'Courses is where a program is added, edited, or removed.',
  '/admin/assessments': 'Assessments keeps the questions for each program.',
  '/admin/progress': 'Progress shows each student’s scores and answers.',
  '/admin/career-test': 'Career Test is where those tests and the public career page are edited.',
  '/admin/enrollments': 'Enrollments shows who joined a program and which requests are waiting.',
  '/admin/sales': 'Sales lists paid orders, the programs in each order, and revenue.',
  '/admin/homepage': 'Homepage edits the content visitors see on the public home page.',
  '/admin/coupons': 'Coupons is where discount codes are created and turned on or off.',
};

export const tourStepsForMenu = (items: Array<{ path: string; label: string }>): AdminMenuTourStep[] =>
  items.map((item) => ({
    path: item.path,
    label: item.label,
    text: tourCopy[item.path] ?? item.label,
  }));

export const nextTourIndex = (index: number, stepCount: number): number =>
  Math.min(Math.max(index, 0) + 1, Math.max(stepCount - 1, 0));

export const previousTourIndex = (index: number): number => Math.max(index - 1, 0);

export const hasSeenAdminMenuTour = (userId: string | undefined, storage: TourStorage): boolean => {
  if (!userId) {
    return true;
  }
  try {
    return storage.getItem(seenKey(userId)) === 'seen';
  } catch (error) {
    console.error(JSON.stringify({
      event: 'admin_menu_tour_read_failed',
      message: error instanceof Error ? error.message : 'unknown',
    }));
    return true;
  }
};

export const markAdminMenuTourSeen = (userId: string | undefined, storage: TourStorage): void => {
  if (!userId) {
    return;
  }
  try {
    storage.setItem(seenKey(userId), 'seen');
  } catch (error) {
    console.error(JSON.stringify({
      event: 'admin_menu_tour_save_failed',
      message: error instanceof Error ? error.message : 'unknown',
    }));
  }
};

export const clearAdminMenuTourSeen = (userId: string | undefined, storage: TourStorage): void => {
  if (!userId) {
    return;
  }
  try {
    storage.removeItem(seenKey(userId));
  } catch (error) {
    console.error(JSON.stringify({
      event: 'admin_menu_tour_clear_failed',
      message: error instanceof Error ? error.message : 'unknown',
    }));
  }
};
