import assert from 'node:assert/strict';
import test from 'node:test';
import { filterRecordsBySearch } from './adminSearch.ts';

const courseText = (course: { title: string; description: string | null }) => [
  course.title,
  course.description,
];

test('an edit refresh keeps the active search and shows only matching records', () => {
  const searchTerm = 'english';
  const loadedCourses = [
    { id: 'spoken', title: 'Spoken English', description: 'Conversation' },
    { id: 'math', title: 'Math Basics', description: 'Numbers' },
  ];

  const visibleBeforeEdit = filterRecordsBySearch(loadedCourses, searchTerm, courseText);
  assert.deepEqual(visibleBeforeEdit.map((course) => course.id), ['spoken']);

  const refreshedAfterEdit = [
    { id: 'spoken', title: 'Spoken English', description: 'Updated conversation practice' },
    { id: 'math', title: 'Math Basics', description: 'Numbers' },
    { id: 'science', title: 'Science Lab', description: 'Experiments' },
  ];
  const visibleAfterEdit = filterRecordsBySearch(refreshedAfterEdit, searchTerm, courseText);

  assert.equal(searchTerm, 'english');
  assert.deepEqual(visibleAfterEdit.map((course) => course.id), ['spoken']);
  assert.equal(visibleAfterEdit[0].description, 'Updated conversation practice');
});

test('a blank search still shows every record after a refresh', () => {
  const refreshedRecords = [
    { title: 'Spoken English' },
    { title: 'Math Basics' },
  ];

  assert.deepEqual(
    filterRecordsBySearch(refreshedRecords, '   ', (record) => [record.title]),
    refreshedRecords,
  );
});

test('search matches any field without caring about letter case', () => {
  const users = [
    { email: 'ada@example.com', fullName: 'Ada', role: 'admin' },
    { email: 'grace@example.com', fullName: 'Grace', role: 'student' },
  ];

  const matches = filterRecordsBySearch(users, 'STUDENT', (user) => [
    user.email,
    user.fullName,
    user.role,
  ]);

  assert.deepEqual(matches.map((user) => user.email), ['grace@example.com']);
});
