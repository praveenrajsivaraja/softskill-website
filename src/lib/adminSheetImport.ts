import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/integrations/supabase/types';
import { supabase } from '@/integrations/supabase/client';
import { replaceAssessmentQuestions, saveAssessmentSettings } from '@/lib/assessmentApi';
import { careerSectionFromRow, courseFieldsFromRow, groupAssessmentRows } from '@/lib/sheetRows';
import { missingSheetColumns, readBoolean, type SheetImportResult } from '@/lib/spreadsheet';

type UserRole = 'student' | 'instructor' | 'admin';

const userRoles: UserRole[] = ['student', 'instructor', 'admin'];

const emptyResult = (): SheetImportResult => ({ created: 0, updated: 0, errors: [] });

const errorMessage = (error: unknown): string => {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') {
    return error.message;
  }
  return 'The row could not be saved.';
};

const logSheetError = (table: string, message: string) => {
  console.error(JSON.stringify({ event: 'sheet_import_failed', table, message }));
};

const signupClient = () => {
  const url = import.meta.env.VITE_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY ?? import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  return createClient<Database>(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
      storageKey: 'sheet-signup',
    },
  });
};

const findProfileByEmail = async (email: string) => {
  const { data, error } = await supabase.from('profiles').select('id, email');
  if (error) {
    throw error;
  }
  return (data ?? []).find((profile) => profile.email?.trim().toLowerCase() === email.toLowerCase()) ?? null;
};

const updateProfile = async (
  profileId: string,
  fullName: string | null,
  role: UserRole,
  isActive: boolean,
) => {
  const patch = {
    full_name: fullName,
    role,
    is_active: isActive,
    updated_at: new Date().toISOString(),
  };
  const { error } = await supabase.from('profiles').update(patch).eq('id', profileId);
  if (!error) {
    return null;
  }
  if (!error.message.toLowerCase().includes('is_active')) {
    throw error;
  }
  const { error: retryError } = await supabase
    .from('profiles')
    .update({ full_name: fullName, role, updated_at: patch.updated_at })
    .eq('id', profileId);
  if (retryError) {
    throw retryError;
  }
  return 'Status was not changed. Run the activate-users SQL before uploading is_active.';
};

export const importUsers = async (
  rows: Record<string, string>[],
  signedInUserId: string | null,
): Promise<SheetImportResult> => {
  const result = emptyResult();
  const columnErrors = missingSheetColumns(rows, ['email']);
  if (columnErrors.length > 0) {
    return { ...result, errors: columnErrors };
  }

  const { data: profileRows, error: profileError } = await supabase.from('profiles').select('id, email');
  if (profileError) {
    logSheetError('profiles', profileError.message);
    return { ...result, errors: [profileError.message] };
  }
  const profiles = profileRows ?? [];
  const authClient = signupClient();
  for (const [index, row] of rows.entries()) {
    const line = index + 2;
    const email = (row.email ?? '').trim().toLowerCase();
    const fullName = (row.full_name ?? '').trim() || null;
    const password = (row.password ?? '').trim();
    const role = ((row.role ?? '').trim().toLowerCase() || 'student') as UserRole;
    const isActive = readBoolean(row.is_active, true);

    if (!email || !email.includes('@')) {
      result.errors.push(`Row ${line}: email is required.`);
      continue;
    }
    if (!userRoles.includes(role)) {
      result.errors.push(`Row ${line}: role must be student, instructor, or admin.`);
      continue;
    }
    if (isActive === null) {
      result.errors.push(`Row ${line}: is_active must be true or false.`);
      continue;
    }

    try {
      const existing = profiles.find((profile) => profile.email?.trim().toLowerCase() === email) ?? null;
      if (existing) {
        if (existing.id === signedInUserId && !isActive) {
          result.errors.push(`Row ${line}: you cannot deactivate the account you are signed in with.`);
          continue;
        }
        const statusNote = await updateProfile(existing.id, fullName, role, isActive);
        result.updated += 1;
        if (password) {
          result.errors.push(`Row ${line}: the profile was updated. The password of an existing account was left unchanged.`);
        }
        if (statusNote) {
          result.errors.push(`Row ${line}: ${statusNote}`);
        }
        continue;
      }

      if (password.length < 6) {
        result.errors.push(`Row ${line}: a new user needs a password of at least 6 characters.`);
        continue;
      }

      const { data, error } = await authClient.auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName } },
      });
      if (error) {
        throw error;
      }
      const createdUser = data.user;
      if (!createdUser) {
        throw new Error('The account was not created.');
      }
      const alreadyRegistered = Array.isArray(createdUser.identities) && createdUser.identities.length === 0;
      const profile = await findProfileByEmail(email);
      if (profile && !profiles.some((saved) => saved.id === profile.id)) {
        profiles.push(profile);
      }
      if (!profile) {
        throw new Error(alreadyRegistered
          ? 'This email is already registered, but no profile was found to update.'
          : 'The account was created, but the profile was not ready to update.');
      }
      const statusNote = await updateProfile(profile.id, fullName, role, isActive);
      if (alreadyRegistered) {
        result.updated += 1;
        if (password) {
          result.errors.push(`Row ${line}: the profile was updated. The password of an existing account was left unchanged.`);
        }
      } else {
        result.created += 1;
      }
      if (statusNote) {
        result.errors.push(`Row ${line}: ${statusNote}`);
      }
      await authClient.auth.signOut();
    } catch (error) {
      const message = errorMessage(error);
      logSheetError('profiles', message);
      result.errors.push(`Row ${line}: ${message}`);
    }
  }

  return result;
};

export const importCourses = async (
  rows: Record<string, string>[],
  courseType: string,
): Promise<SheetImportResult> => {
  const result = emptyResult();
  const columnErrors = missingSheetColumns(rows, ['title', 'price']);
  if (columnErrors.length > 0) {
    return { ...result, errors: columnErrors };
  }

  const { data: existingCourses, error } = await supabase.from('courses').select('id, title, course_type');
  if (error) {
    logSheetError('courses', error.message);
    return { ...result, errors: [error.message] };
  }
  const catalog = existingCourses ?? [];

  for (const [index, row] of rows.entries()) {
    const line = index + 2;
    const fields = courseFieldsFromRow(row, line);
    if ('error' in fields) {
      result.errors.push(fields.error);
      continue;
    }
    const matches = catalog.filter((course) => (
      course.course_type === courseType && course.title.trim().toLowerCase() === fields.title.toLowerCase()
    ));
    if (matches.length > 1) {
      result.errors.push(`Row ${line}: more than one saved item uses the title "${fields.title}".`);
      continue;
    }

    const record = {
      title: fields.title,
      description: fields.description,
      price: fields.price,
      original_price: fields.originalPrice,
      category: fields.category,
      duration: fields.duration,
      age_range: fields.ageRange,
      mode: fields.mode,
      status: fields.status,
      total_lessons: fields.totalLessons,
      course_type: courseType,
      highlights: fields.highlights,
      learning_points: fields.learningPoints,
      updated_at: new Date().toISOString(),
    };

    try {
      if (matches.length === 1) {
        const { error: updateError } = await supabase.from('courses').update(record).eq('id', matches[0].id);
        if (updateError) {
          throw updateError;
        }
        result.updated += 1;
      } else {
        const { data: created, error: insertError } = await supabase.from('courses').insert(record).select('id, title, course_type').single();
        if (insertError) {
          throw insertError;
        }
        catalog.push(created);
        result.created += 1;
      }
    } catch (saveError) {
      const message = errorMessage(saveError);
      logSheetError('courses', message);
      result.errors.push(`Row ${line}: ${message}`);
    }
  }

  return result;
};

export const importAssessments = async (rows: Record<string, string>[]): Promise<SheetImportResult> => {
  const result = emptyResult();
  const grouped = groupAssessmentRows(rows);
  result.errors.push(...grouped.errors);
  if (grouped.groups.length === 0) {
    return result;
  }

  const { data: courses, error } = await supabase.from('courses').select('id, title');
  if (error) {
    logSheetError('assessments', error.message);
    result.errors.push(error.message);
    return result;
  }

  for (const group of grouped.groups) {
    const matches = (courses ?? []).filter((course) => course.title.trim().toLowerCase() === group.programTitle.toLowerCase());
    if (matches.length !== 1) {
      result.errors.push(matches.length === 0
        ? `Row ${group.createdFromLine}: no program is named "${group.programTitle}".`
        : `Row ${group.createdFromLine}: more than one program is named "${group.programTitle}".`);
      continue;
    }

    try {
      const { data: savedAssessments, error: listError } = await supabase
        .from('assessments')
        .select('id, title')
        .eq('course_id', matches[0].id);
      if (listError) {
        throw listError;
      }
      const existing = (savedAssessments ?? []).find((assessment) => assessment.title.trim().toLowerCase() === group.title.toLowerCase());
      const assessmentId = await saveAssessmentSettings(existing?.id ?? null, {
        courseId: matches[0].id,
        title: group.title,
        description: group.description,
        instructions: group.instructions,
        durationMinutes: group.durationMinutes,
        passingScore: group.passingScore,
        sequence: group.sequence,
        isActive: group.isActive,
        isPublished: group.isPublished,
        showFeedback: group.showFeedback,
        allowReview: group.allowReview,
      });
      await replaceAssessmentQuestions(assessmentId, group.questions);
      if (existing) {
        result.updated += 1;
      } else {
        result.created += 1;
      }
    } catch (saveError) {
      const message = errorMessage(saveError);
      logSheetError('assessments', message);
      result.errors.push(`Row ${group.createdFromLine}: ${message}`);
    }
  }

  return result;
};

export const importCareerSections = async (rows: Record<string, string>[]): Promise<SheetImportResult> => {
  const result = emptyResult();
  const columnErrors = missingSheetColumns(rows, ['section_key', 'title']);
  if (columnErrors.length > 0) {
    return { ...result, errors: columnErrors };
  }

  const { data: existingSections, error } = await supabase
    .from('page_sections')
    .select('id, section_key, title')
    .eq('page_key', 'career_test');
  if (error) {
    logSheetError('page_sections', error.message);
    return { ...result, errors: [error.message] };
  }
  const sections = existingSections ?? [];

  for (const [index, row] of rows.entries()) {
    const line = index + 2;
    const fields = careerSectionFromRow(row, line);
    if ('error' in fields) {
      result.errors.push(fields.error);
      continue;
    }
    const matches = sections.filter((section) => (
      section.section_key === fields.sectionKey && (section.title ?? '').trim().toLowerCase() === fields.title.toLowerCase()
    ));
    if (matches.length > 1) {
      result.errors.push(`Row ${line}: more than one section uses ${fields.sectionKey} and "${fields.title}".`);
      continue;
    }

    const record = {
      page_key: 'career_test',
      section_key: fields.sectionKey,
      title: fields.title,
      description: fields.description,
      order_index: fields.orderIndex,
      is_active: fields.isActive,
      updated_at: new Date().toISOString(),
    };

    try {
      if (matches.length === 1) {
        const { error: updateError } = await supabase.from('page_sections').update(record).eq('id', matches[0].id);
        if (updateError) {
          throw updateError;
        }
        result.updated += 1;
      } else {
        const { data: created, error: insertError } = await supabase
          .from('page_sections')
          .insert(record)
          .select('id, section_key, title')
          .single();
        if (insertError) {
          throw insertError;
        }
        sections.push(created);
        result.created += 1;
      }
    } catch (saveError) {
      const message = errorMessage(saveError);
      logSheetError('page_sections', message);
      result.errors.push(`Row ${line}: ${message}`);
    }
  }

  return result;
};
