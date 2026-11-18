import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Receipt, ShoppingBag, TrendingUp } from 'lucide-react';
import AdminSearchableTab from './AdminSearchableTab';
import { filterRecordsBySearch } from '@/lib/adminSearch';
import {
  buildSaleOrders,
  summarizeProgramSales,
  type SaleOrder,
} from '@/lib/programSales';

const formatCurrency = (amount: number) => new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
}).format(amount);

const formatDateTime = (value: string) => new Date(value).toLocaleString([], {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
});

const statusClassName = (status: string) => {
  if (status === 'completed' || status === 'confirmed') {
    return 'bg-green-100 text-green-800';
  }
  if (status === 'pending') {
    return 'bg-amber-100 text-amber-800';
  }
  return 'bg-red-100 text-red-800';
};

const ProgramSales = () => {
  const { toast } = useToast();
  const [sales, setSales] = useState<SaleOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCourseId, setSelectedCourseId] = useState('all');

  useEffect(() => {
    const loadSales = async () => {
      setIsLoading(true);
      const { data: orders, error: orderError } = await supabase
        .from('orders')
        .select('id, user_id, total_amount, status, payment_method, created_at')
        .order('created_at', { ascending: false })
        .limit(1000);

      if (orderError) {
        console.error(JSON.stringify({ event: 'program_sales_orders_failed', code: orderError.code }));
        toast({
          title: 'Sales',
          description: 'Program sales could not be loaded.',
          variant: 'destructive',
        });
        setIsLoading(false);
        return;
      }

      const orderRows = orders ?? [];
      const orderIds = orderRows.map((order) => order.id);
      const userIds = [...new Set(orderRows.map((order) => order.user_id))];
      const [itemResult, buyerResult] = await Promise.all([
        orderIds.length === 0
          ? Promise.resolve({ data: [], error: null })
          : supabase.from('order_items').select('order_id, course_id, price').in('order_id', orderIds),
        userIds.length === 0
          ? Promise.resolve({ data: [], error: null })
          : supabase.from('profiles').select('id, full_name, email').in('id', userIds),
      ]);

      if (itemResult.error || buyerResult.error) {
        console.error(JSON.stringify({
          event: 'program_sales_details_failed',
          code: itemResult.error?.code ?? buyerResult.error?.code ?? 'unknown',
        }));
      }

      const itemRows = itemResult.data ?? [];
      const courseIds = [...new Set(itemRows.map((item) => item.course_id))];
      const courseResult = courseIds.length === 0
        ? { data: [], error: null }
        : await supabase.from('courses').select('id, title').in('id', courseIds);

      if (courseResult.error) {
        console.error(JSON.stringify({ event: 'program_sales_courses_failed', code: courseResult.error.code }));
      }

      setSales(buildSaleOrders(
        orderRows.map((order) => ({
          id: order.id,
          userId: order.user_id,
          amount: order.total_amount,
          status: order.status,
          paymentMethod: order.payment_method,
          createdAt: order.created_at,
        })),
        itemRows.map((item) => ({
          orderId: item.order_id,
          courseId: item.course_id,
          price: item.price,
        })),
        (buyerResult.data ?? []).map((buyer) => ({
          id: buyer.id,
          fullName: buyer.full_name,
          email: buyer.email,
        })),
        (courseResult.data ?? []).map((course) => ({
          id: course.id,
          title: course.title,
        })),
      ));
      setIsLoading(false);
    };

    void loadSales();
  }, [toast]);

  const summary = useMemo(() => summarizeProgramSales(sales), [sales]);
  const programOptions = useMemo(() => {
    const options = new Map<string, string>();
    for (const sale of sales) {
      for (const program of sale.programs) {
        options.set(program.courseId, program.title);
      }
    }
    return [...options.entries()]
      .map(([courseId, title]) => ({ courseId, title }))
      .sort((left, right) => left.title.localeCompare(right.title));
  }, [sales]);
  const visibleSales = useMemo(() => {
    const forProgram = selectedCourseId === 'all'
      ? sales
      : sales.filter((sale) => sale.programs.some((program) => program.courseId === selectedCourseId));
    return filterRecordsBySearch(forProgram, searchTerm, (sale) => [
      sale.buyerName,
      sale.buyerEmail,
      sale.status,
      sale.paymentMethod,
      ...sale.programs.map((program) => program.title),
    ]);
  }, [sales, searchTerm, selectedCourseId]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16 text-gray-600">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Loading program sales...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Program sales</h2>
        <p className="text-sm text-gray-600">Paid orders, the programs in each order, and revenue by program.</p>
      </div>

      <section className="space-y-3">
        <h3 className="flex items-center gap-2 text-lg font-semibold text-gray-900">
          <TrendingUp className="h-5 w-5 text-red-600" />
          Statistics
        </h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[
            { label: 'Paid revenue', value: formatCurrency(summary.paidRevenue) },
            { label: 'Paid orders', value: summary.paidOrderCount.toLocaleString() },
            { label: 'Average order', value: formatCurrency(summary.averageOrderValue) },
            { label: 'Programs sold', value: summary.programsSold.toLocaleString() },
          ].map((stat) => (
            <Card key={stat.label}>
              <CardContent className="p-5">
                <p className="text-sm text-gray-600">{stat.label}</p>
                <p className="mt-1 text-2xl font-bold text-gray-900">{stat.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="flex items-center gap-2 text-lg font-semibold text-gray-900">
          <Receipt className="h-5 w-5 text-red-600" />
          Sales details
        </h3>
        <Card>
          <CardContent className="space-y-4 p-6">
            <div className="max-w-xs">
              <Select value={selectedCourseId} onValueChange={setSelectedCourseId}>
                <SelectTrigger aria-label="Filter sales by program">
                  <SelectValue placeholder="All programs" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All programs</SelectItem>
                  {programOptions.map((program) => (
                    <SelectItem key={program.courseId} value={program.courseId}>{program.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <AdminSearchableTab
              searchTerm={searchTerm}
              onSearch={setSearchTerm}
              placeholder="Search buyer, email, or program"
            >
              {visibleSales.length === 0 ? (
                <p className="text-sm text-gray-500">No sales match this view.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Buyer</TableHead>
                      <TableHead>Programs</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Payment</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visibleSales.map((sale) => (
                      <TableRow key={sale.id}>
                        <TableCell className="whitespace-nowrap">{formatDateTime(sale.createdAt)}</TableCell>
                        <TableCell>
                          <p className="font-medium">{sale.buyerName}</p>
                          <p className="text-sm text-gray-500">{sale.buyerEmail}</p>
                        </TableCell>
                        <TableCell>{sale.programs.map((program) => program.title).join(', ') || '—'}</TableCell>
                        <TableCell className="whitespace-nowrap">{formatCurrency(sale.amount)}</TableCell>
                        <TableCell>
                          <Badge className={statusClassName(sale.status)}>{sale.status}</Badge>
                        </TableCell>
                        <TableCell>{sale.paymentMethod || '—'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </AdminSearchableTab>
          </CardContent>
        </Card>
      </section>

      <section className="space-y-3">
        <h3 className="flex items-center gap-2 text-lg font-semibold text-gray-900">
          <ShoppingBag className="h-5 w-5 text-red-600" />
          More
        </h3>
        <Card>
          <CardHeader>
            <CardTitle>Revenue by program</CardTitle>
          </CardHeader>
          <CardContent>
            {summary.programTotals.length === 0 ? (
              <p className="text-sm text-gray-500">No paid program sales yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Program</TableHead>
                    <TableHead>Units sold</TableHead>
                    <TableHead>Revenue</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {summary.programTotals.map((program) => (
                    <TableRow key={program.courseId}>
                      <TableCell>{program.title}</TableCell>
                      <TableCell>{program.unitsSold}</TableCell>
                      <TableCell>{formatCurrency(program.revenue)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
            <p className="mt-4 text-sm text-gray-500">
              {sales.length - summary.paidOrderCount} order(s) are still unpaid, failed, or cancelled. Statistics count confirmed and completed orders.
            </p>
          </CardContent>
        </Card>
      </section>
    </div>
  );
};

export default ProgramSales;
