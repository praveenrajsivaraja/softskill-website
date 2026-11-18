export const paidOrderStatuses = ['confirmed', 'completed'] as const;

export interface SaleProgram {
  courseId: string;
  title: string;
  price: number;
}

export interface SaleOrder {
  id: string;
  buyerName: string;
  buyerEmail: string;
  amount: number;
  status: string;
  paymentMethod: string | null;
  createdAt: string;
  programs: SaleProgram[];
}

export interface ProgramSaleTotal {
  courseId: string;
  title: string;
  unitsSold: number;
  revenue: number;
}

export interface ProgramSalesSummary {
  paidRevenue: number;
  paidOrderCount: number;
  averageOrderValue: number;
  programsSold: number;
  programTotals: ProgramSaleTotal[];
}

interface RawOrder {
  id: string;
  userId: string;
  amount: number;
  status: string;
  paymentMethod: string | null;
  createdAt: string;
}

interface RawItem {
  orderId: string;
  courseId: string;
  price: number;
}

interface RawBuyer {
  id: string;
  fullName: string | null;
  email: string;
}

interface RawCourse {
  id: string;
  title: string;
}

export const isPaidOrder = (status: string) =>
  paidOrderStatuses.includes(status as (typeof paidOrderStatuses)[number]);

export const enrollmentCompletionPercent = (completedCount: number, activeCount: number) => {
  const total = completedCount + activeCount;
  if (total <= 0) {
    return 0;
  }
  return Math.round((completedCount / total) * 100);
};

export const buildSaleOrders = (
  orders: RawOrder[],
  items: RawItem[],
  buyers: RawBuyer[],
  courses: RawCourse[],
): SaleOrder[] => {
  const buyerById = new Map(buyers.map((buyer) => [buyer.id, buyer]));
  const titleByCourseId = new Map(courses.map((course) => [course.id, course.title]));
  const itemsByOrderId = new Map<string, RawItem[]>();
  for (const item of items) {
    const existing = itemsByOrderId.get(item.orderId) ?? [];
    existing.push(item);
    itemsByOrderId.set(item.orderId, existing);
  }

  return orders.map((order) => {
    const buyer = buyerById.get(order.userId);
    return {
      id: order.id,
      buyerName: buyer?.fullName?.trim() || 'Unknown buyer',
      buyerEmail: buyer?.email ?? '—',
      amount: order.amount,
      status: order.status,
      paymentMethod: order.paymentMethod,
      createdAt: order.createdAt,
      programs: (itemsByOrderId.get(order.id) ?? []).map((item) => ({
        courseId: item.courseId,
        title: titleByCourseId.get(item.courseId) ?? 'Untitled program',
        price: item.price,
      })),
    };
  });
};

export const summarizeProgramSales = (orders: SaleOrder[]): ProgramSalesSummary => {
  const paidOrders = orders.filter((order) => isPaidOrder(order.status));
  const paidRevenue = paidOrders.reduce((sum, order) => sum + order.amount, 0);
  const totals = new Map<string, ProgramSaleTotal>();

  for (const order of paidOrders) {
    for (const program of order.programs) {
      const current = totals.get(program.courseId) ?? {
        courseId: program.courseId,
        title: program.title,
        unitsSold: 0,
        revenue: 0,
      };
      current.unitsSold += 1;
      current.revenue += program.price;
      totals.set(program.courseId, current);
    }
  }

  return {
    paidRevenue,
    paidOrderCount: paidOrders.length,
    averageOrderValue: paidOrders.length === 0 ? 0 : paidRevenue / paidOrders.length,
    programsSold: paidOrders.reduce((sum, order) => sum + order.programs.length, 0),
    programTotals: [...totals.values()].sort((left, right) => right.revenue - left.revenue || left.title.localeCompare(right.title)),
  };
};
