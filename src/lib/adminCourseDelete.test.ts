import assert from 'node:assert/strict';
import test from 'node:test';
import { courseDeleteErrorMessage, deleteAdminCourse, type CourseDeleteClient } from './adminCourseDelete.ts';

const courseId = '11111111-1111-4111-8111-111111111101';

test('an admin delete goes through the database function', async () => {
  let calledFunction = '';
  const client: CourseDeleteClient = {
    rpc: async (functionName) => {
      calledFunction = functionName;
      return { error: null };
    },
    from: () => {
      throw new Error('direct delete should not run');
    },
  };

  await deleteAdminCourse(client, courseId);
  assert.equal(calledFunction, 'admin_delete_course');
});

test('a missing delete function falls back to deleting the course row', async () => {
  let deletedId = '';
  const client: CourseDeleteClient = {
    rpc: async () => ({
      error: { message: 'Could not find the function public.admin_delete_course(target_course_id) in the schema cache' },
    }),
    from: () => ({
      delete: () => ({
        eq: (_column, id) => ({
          select: async () => {
            deletedId = id;
            return { data: [{ id }], error: null };
          },
        }),
      }),
    }),
  };

  await deleteAdminCourse(client, courseId);
  assert.equal(deletedId, courseId);
});

test('a linked order or attempt is explained instead of a generic failure', () => {
  assert.match(
    courseDeleteErrorMessage({ message: 'update or delete on table "courses" violates foreign key constraint "order_items_course_id_fkey"' }),
    /order/,
  );
  assert.match(
    courseDeleteErrorMessage({ message: 'permission denied for table assessment_attempts' }),
    /assessment attempt/,
  );
  assert.equal(
    courseDeleteErrorMessage(new Error('Only an admin can delete a course')),
    'Only an admin can delete a course',
  );
});
