export interface CatalogCourse {
  id: string;
  title: string | null;
  category: string | null;
  price: number | null;
  duration: string | null;
  ageRange: string | null;
  mode: string | null;
}

export interface CatalogPresentation {
  text: string;
  table: { columns: string[]; rows: string[][] } | null;
  stats: { label: string; value: string }[] | null;
  links: { label: string; path: string }[];
  includeSpreadsheet: boolean;
}

const display = (value: string | number | null, fallback = '—'): string => {
  if (typeof value === 'string' && value.trim()) {
    return value.trim();
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }
  return fallback;
};

export const presentCourseCatalog = (
  courses: CatalogCourse[],
  summary: string,
  isAdmin: boolean,
): CatalogPresentation => {
  const links = courses.slice(0, 8).map((course) => ({
    label: display(course.title, 'Open course'),
    path: `/course/${course.id}`,
  }));
  if (!isAdmin) {
    return {
      text: `${summary}\n→ Open a program to see the price and enroll`,
      table: null,
      stats: null,
      links,
      includeSpreadsheet: false,
    };
  }
  return {
    text: summary,
    stats: [{ label: 'Courses', value: String(courses.length) }],
    table: {
      columns: ['Title', 'Category', 'Price', 'Duration', 'Ages', 'Mode'],
      rows: courses.slice(0, 20).map((course) => [
        display(course.title),
        display(course.category),
        display(course.price),
        display(course.duration),
        display(course.ageRange),
        display(course.mode),
      ]),
    },
    links,
    includeSpreadsheet: true,
  };
};
