import { supabase } from '@/integrations/supabase/client';
import { importAssessments, importCareerSections, importCourses } from '@/lib/adminSheetImport';
import { COURSE_TYPE_COURSE } from '@/lib/courseCatalog';
import { careerSectionFromRow, courseFieldsFromRow, groupAssessmentRows } from '@/lib/sheetRows';
import { parseCsv, rowsToRecords, type SheetImportResult } from '@/lib/spreadsheet';

export type ImportKind = 'courses' | 'assessments' | 'career_sections';

const forbiddenColumns = new Set(['password', 'email', 'role']);

const literalIlike = (value: string) => value.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');

export const recordsFromCsv = (text: string): Record<string, string>[] => rowsToRecords(parseCsv(text));

export const detectImportKind = (rows: Record<string, string>[]): ImportKind | { error: string } => {
  if (rows.length === 0) {
    return { error: 'The file has no data rows.' };
  }
  const keys = new Set(Object.keys(rows[0]));
  if ([...keys].some((key) => forbiddenColumns.has(key))) {
    return { error: 'KIKI cannot create accounts, set passwords, or change roles.' };
  }
  if (keys.has('program_title') && keys.has('assessment_title') && keys.has('prompt')) {
    return 'assessments';
  }
  if (keys.has('section_key') && keys.has('title') && !keys.has('price')) {
    return 'career_sections';
  }
  if (keys.has('title') && keys.has('price')) {
    return 'courses';
  }
  return { error: 'Use a course, assessment, or career-test section template.' };
};

export const validateClientRows = (kind: ImportKind, rows: Record<string, string>[]): string[] => {
  if (kind === 'courses') {
    return rows.flatMap((row, index) => {
      const fields = courseFieldsFromRow(row, index + 2);
      return 'error' in fields ? [fields.error] : [];
    });
  }
  if (kind === 'assessments') {
    return groupAssessmentRows(rows).errors;
  }
  return rows.flatMap((row, index) => {
    const fields = careerSectionFromRow(row, index + 2);
    return 'error' in fields ? [fields.error] : [];
  });
};

export const savableRowCount = (kind: ImportKind, rows: Record<string, string>[]): number => {
  if (kind === 'courses') {
    return rows.filter((row, index) => !('error' in courseFieldsFromRow(row, index + 2))).length;
  }
  if (kind === 'career_sections') {
    return rows.filter((row, index) => !('error' in careerSectionFromRow(row, index + 2))).length;
  }
  return groupAssessmentRows(rows).groups.length;
};

export const findAssessmentReplaceWarning = async (rows: Record<string, string>[]): Promise<string | null> => {
  const pairs = new Map<string, { program: string; assessment: string }>();
  for (const row of rows) {
    const program = (row.program_title ?? '').trim();
    const assessment = (row.assessment_title ?? '').trim();
    if (program && assessment) {
      pairs.set(`${program.toLowerCase()}::${assessment.toLowerCase()}`, { program, assessment });
    }
  }
  const warnings: string[] = [];
  for (const pair of pairs.values()) {
    const courses = await supabase.from('courses').select('id, title').ilike('title', literalIlike(pair.program)).limit(5);
    if (courses.error) {
      console.error(JSON.stringify({ event: 'kiki_replace_lookup_failed', code: courses.error.code }));
      continue;
    }
    if ((courses.data ?? []).length !== 1) {
      continue;
    }
    const existing = await supabase
      .from('assessments')
      .select('id')
      .eq('course_id', courses.data![0].id)
      .ilike('title', literalIlike(pair.assessment))
      .limit(1);
    if (existing.error) {
      console.error(JSON.stringify({ event: 'kiki_replace_lookup_failed', code: existing.error.code }));
      continue;
    }
    if ((existing.data ?? []).length === 1) {
      warnings.push(`Confirming replaces the questions on "${pair.assessment}" for "${pair.program}".`);
    }
  }
  return warnings.length > 0 ? warnings.join(' ') : null;
};

export const confirmProposedRows = (
  kind: ImportKind,
  rows: Record<string, string>[],
): Promise<SheetImportResult> => {
  if (kind === 'courses') {
    return importCourses(rows, COURSE_TYPE_COURSE);
  }
  if (kind === 'assessments') {
    return importAssessments(rows);
  }
  return importCareerSections(rows);
};
