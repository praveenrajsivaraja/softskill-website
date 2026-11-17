type CourseDeleteError = {
  message: string;
};

type CourseDeleteResult = {
  data: { id: string }[] | null;
  error: CourseDeleteError | null;
};

export type CourseDeleteClient = {
  rpc: (
    functionName: 'admin_delete_course',
    args: { target_course_id: string },
  ) => Promise<{ error: CourseDeleteError | null }>;
  from: (table: 'courses') => {
    delete: () => {
      eq: (column: 'id', courseId: string) => {
        select: (columns: 'id') => Promise<CourseDeleteResult>;
      };
    };
  };
};

const missingDeleteFunction = (message: string) =>
  /admin_delete_course/i.test(message)
  && /schema cache|could not find the function/i.test(message);

export const courseDeleteErrorMessage = (error: unknown) => {
  const message = error instanceof Error
    ? error.message
    : typeof error === 'object' && error !== null && 'message' in error && typeof error.message === 'string'
      ? error.message
      : '';

  if (missingDeleteFunction(message)) {
    return 'Course delete is not available yet. Run the latest Supabase migration, then try again.';
  }

  if (message.includes('order_items') || message.includes('cart_items') || message.includes('assessment_attempts')) {
    return 'This course is still linked to an order, a cart, or an assessment attempt, so it was not deleted.';
  }

  if (message.length > 0) {
    return message;
  }

  return 'Failed to delete course.';
};

export const deleteAdminCourse = async (client: CourseDeleteClient, courseId: string) => {
  const { error } = await client.rpc('admin_delete_course', { target_course_id: courseId });
  if (!error) {
    return;
  }

  if (!missingDeleteFunction(error.message)) {
    throw error;
  }

  const { data, error: directError } = await client
    .from('courses')
    .delete()
    .eq('id', courseId)
    .select('id');

  if (directError) {
    throw directError;
  }

  if (!data || data.length === 0) {
    throw new Error('The course is still linked to an order, a cart, or an assessment attempt, so it was not deleted.');
  }
};
