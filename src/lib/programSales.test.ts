import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildSaleOrders,
  enrollmentCompletionPercent,
  summarizeProgramSales,
} from './programSales.ts';

const spoken = { id: 'spoken', title: 'Spoken English' };
const art = { id: 'art', title: 'Art & Craft' };

test('paid program sales ignore pending orders and rank programs by revenue', () => {
  const sales = buildSaleOrders(
    [
      {
        id: 'paid',
        userId: 'buyer-1',
        amount: 1500,
        status: 'completed',
        paymentMethod: 'upi',
        createdAt: '2026-11-01T00:00:00.000Z',
      },
      {
        id: 'waiting',
        userId: 'buyer-2',
        amount: 900,
        status: 'pending',
        paymentMethod: null,
        createdAt: '2026-11-02T00:00:00.000Z',
      },
    ],
    [
      { orderId: 'paid', courseId: spoken.id, price: 1000 },
      { orderId: 'paid', courseId: art.id, price: 500 },
      { orderId: 'waiting', courseId: art.id, price: 900 },
    ],
    [
      { id: 'buyer-1', fullName: 'Asha', email: 'asha@example.com' },
      { id: 'buyer-2', fullName: null, email: 'pending@example.com' },
    ],
    [spoken, art],
  );

  const summary = summarizeProgramSales(sales);

  assert.equal(sales[1].buyerName, 'Unknown buyer');
  assert.equal(summary.paidOrderCount, 1);
  assert.equal(summary.paidRevenue, 1500);
  assert.equal(summary.averageOrderValue, 1500);
  assert.equal(summary.programsSold, 2);
  assert.deepEqual(summary.programTotals.map((program) => program.title), ['Spoken English', 'Art & Craft']);
  assert.equal(summary.programTotals[0].revenue, 1000);
});

test('completion percent uses completed enrollments against active ones', () => {
  assert.equal(enrollmentCompletionPercent(1, 3), 25);
  assert.equal(enrollmentCompletionPercent(0, 0), 0);
});
