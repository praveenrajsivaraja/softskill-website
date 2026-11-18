import assert from 'node:assert/strict';
import test from 'node:test';
import { buildExcelWorkbook } from './excelReport.ts';
import { salesReportSheets, userReportSheet } from './adminScreenReports.ts';

test('an excel report escapes cell text and keeps numbers numeric', () => {
  const workbook = buildExcelWorkbook([userReportSheet([{
    email: 'a&b@example.com',
    fullName: 'A <B>',
    phone: null,
    role: 'student',
    isActive: true,
    currentCourses: 'Spoken English',
    recentCourse: '',
    enrolledAt: '1 Jan 2026',
    expiresAt: '',
    lastLogin: 'Never',
    joined: '1 Jan 2026',
  }])]);

  assert.match(workbook, /ss:Type="String">a&amp;b@example.com</);
  assert.match(workbook, /A &lt;B&gt;/);
  assert.match(workbook, /<Worksheet ss:Name="Users">/);
});

test('a sales report keeps summary, program revenue, and order rows', () => {
  const sheets = salesReportSheets(
    [{ label: 'Paid revenue', value: '₹0' }],
    [{ courseId: 'spoken', title: 'Spoken English', unitsSold: 2, revenue: 0 }],
    [{
      id: 'order-1',
      buyerName: 'Ada',
      buyerEmail: 'ada@example.com',
      amount: 0,
      status: 'confirmed',
      paymentMethod: 'upi',
      createdAt: '2026-01-01T00:00:00.000Z',
      programs: [{ courseId: 'spoken', title: 'Spoken English', price: 0 }],
    }],
    (amount) => `₹${amount}`,
    (value) => value.slice(0, 10),
  );
  const workbook = buildExcelWorkbook(sheets);

  assert.match(workbook, /Paid revenue/);
  assert.match(workbook, /ss:Type="Number">2</);
  assert.match(workbook, /ada@example.com/);
});
