export const COURSE_TYPE_COURSE = 'course';
export const COURSE_TYPE_CAREER_TEST = 'career_test';

export function isCareerTestCourse(course: { course_type?: string | null }): boolean {
  return course.course_type === COURSE_TYPE_CAREER_TEST;
}

export function linesToList(value: string): string[] {
  return value
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

export function listToLines(values: string[] | null | undefined): string {
  return (values ?? []).join('\n');
}
