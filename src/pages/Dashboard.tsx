import { useMemo } from "react";
import { useSettings, useStockPurchases, useRevenuePayouts, useExpenses, useSalesRecords, useTransactions, useStockPurchaseItems, useSalesItems, useRevenueItems, useProducts, useGeneralReceivedPayments, useOpeningBalance, useOpeningBalanceItems, useMarketingCampaignItems, usePersonalWithdrawals, useCashAdjustments, useInventoryAdjustments, computeReport, fmt } from "@/hooks/useFinance";
import { MetricCard } from "@/components/MetricCard";
import { Wallet, TrendingUp, Receipt, LineChart as LineIcon, Banknote, Truck, Clock } from "lucide-react";
import { Card } from "@/components/ui/card";
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend, LineChart, Line } from "recharts";

const COLORS = ["hsl(158 64% 38%)", "hsl(217 91% 55%)", "hsl(38 92% 50%)", "hsl(280 70% 55%)", "hsl(0 72% 51%)", "hsl(180 60% 40%)"];

export default function Dashboard() {
  const { data: settings } = useSettings();
  const { data: stock = [] } = useStockPurchases();
  const { data: revenue = [] } = useRevenuePayouts();
  const { data: expenses = [] } = useExpenses();
  const { data: sales = [] } = useSalesRecords();
  const { data: txs = [] } = useTransactions();
  const { data: stockItems = [] } = useStockPurchaseItems();
  const { data: salesItems = [] } = useSalesItems();
  const { data: revenueItems = [] } = useRevenueItems();
  const { data: products = [] } = useProducts();
  const { data: generalReceived = [] } = useGeneralReceivedPayments();
  const { data: openingBalance = null } = useOpeningBalance();
  const { data: openingItems = [] } = useOpeningBalanceItems();
  const { data: marketingItems = [] } = useMarketingCampaignItems();
  const { data: withdrawals = [] } = usePersonalWithdrawals();
  const { data: cashAdjustments = [] } = useCashAdjustments();
  const { data: inventoryAdjustments = [] } = useInventoryAdjustments();

  const report = useMemo(
    () => settings ? computeReport({ settings, stock, stockItems, revenue, revenueItems, expenses, sales, salesItems, products, generalReceived, openingBalance, openingItems, marketingItems, withdrawals, cashAdjustments, inventoryAdjustments }) : null,
    [settings, stock, stockItems, revenue, revenueItems, expenses, sales, salesItems, products, generalReceived, openingBalance, openingItems, marketingItems, withdrawals, cashAdjustments, inventoryAdjustments]
  );

  const expensesByCategory = useMemo(() => {
    const map = new Map<string, number>();
    expenses.forEach((e) => map.set(e.category, (map.get(e.category) ?? 0) + Number(e.amount)));
    return Array.from(map, ([name, value]) => ({ name, value }));
  }, [expenses]);

  const monthly = useMemo(() => {
    const map = new Map<string, { month: string; revenue: number; expenses: number; profit: number }>();
    const get = (k: string) => map.get(k) ?? { month: k, revenue: 0, expenses: 0, profit: 0 };
    revenue.forEach((r) => { const k = r.date.slice(0, 7); const v = get(k); v.revenue += Number(r.earned_amount); map.set(k, v); });
    expenses.forEach((e) => { const k = e.date.slice(0, 7); const v = get(k); v.expenses += Number(e.amount); map.set(k, v); });
    const arr = Array.from(map.values()).sort((a, b) => a.month.localeCompare(b.month));
    arr.forEach((v) => v.profit = v.revenue - v.expenses);
    return arr;
  }, [revenue, expenses]);

  if (!report) return <div className="text-muted-foreground">Loading...</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Real-time view of your business finances</p>
      </div>

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Total Revenue (Earned)" value={fmt(report.revenue)} icon={<TrendingUp className="h-4 w-4" />} />
        <MetricCard label="Total Cash Received" value={fmt(report.cashReceived)} icon={<Banknote className="h-4 w-4" />} />
        <MetricCard label="Shipping Wallet Balance" value={fmt(report.walletBalance)} hint="Held by shipping company" icon={<Truck className="h-4 w-4" />} />
        <MetricCard label="Pending Revenue" value={fmt(report.walletPeriod)} hint="Earned − Received (period)" icon={<Clock className="h-4 w-4" />} />
      </div>

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Cash Balance" value={fmt(report.cash)} numeric={report.cash} tone="auto" icon={<Wallet className="h-4 w-4" />} />
        <MetricCard label="Total Expenses" value={fmt(report.expenses)} icon={<Receipt className="h-4 w-4" />} />
        <MetricCard label="Gross Profit" value={fmt(report.grossProfit)} numeric={report.grossProfit} tone="auto" icon={<LineIcon className="h-4 w-4" />} />
        <MetricCard label="Net Profit" value={fmt(report.netProfit)} numeric={report.netProfit} tone="auto" icon={<LineIcon className="h-4 w-4" />} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <h3 className="font-semibold mb-4">Expenses by Category</h3>
          <div className="h-64">
            {expensesByCategory.length === 0 ? <Empty /> : (
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={expensesByCategory} dataKey="value" nameKey="name" outerRadius={80} label>
                    {expensesByCategory.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v: number) => fmt(v)} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>
        <Card className="p-5">
          <h3 className="font-semibold mb-4">Revenue vs Expenses</h3>
          <div className="h-64">
            {monthly.length === 0 ? <Empty /> : (
              <ResponsiveContainer>
                <BarChart data={monthly}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                  <XAxis dataKey="month" fontSize={12} />
                  <YAxis fontSize={12} />
                  <Tooltip formatter={(v: number) => fmt(v)} />
                  <Legend />
                  <Bar dataKey="revenue" fill="hsl(158 64% 38%)" />
                  <Bar dataKey="expenses" fill="hsl(0 72% 51%)" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>
      </div>

      <Card className="p-5">
        <h3 className="font-semibold mb-4">Profit Trend</h3>
        <div className="h-64">
          {monthly.length === 0 ? <Empty /> : (
            <ResponsiveContainer>
              <LineChart data={monthly}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="month" fontSize={12} />
                <YAxis fontSize={12} />
                <Tooltip formatter={(v: number) => fmt(v)} />
                <Line type="monotone" dataKey="profit" stroke="hsl(158 64% 38%)" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </Card>

      <Card className="p-5">
        <h3 className="font-semibold mb-4">Recent Activity</h3>
        <div className="space-y-2">
          {txs.slice(0, 8).map((t) => (
            <div key={t.id} className="flex items-center justify-between py-2 border-b last:border-0">
              <div>
                <div className="font-medium text-sm">{t.type}{t.category ? ` · ${t.category}` : ""}</div>
                <div className="text-xs text-muted-foreground">{t.date}{t.notes ? ` · ${t.notes}` : ""}</div>
              </div>
              <div className={`font-semibold tabular-nums ${t.type === "Expense" || t.type === "Stock Purchase" ? "text-destructive" : "text-success"}`}>
                {t.type === "Expense" || t.type === "Stock Purchase" ? "-" : "+"}{fmt(Number(t.amount))}
              </div>
            </div>
          ))}
          {txs.length === 0 && <p className="text-sm text-muted-foreground">No activity yet. Add your first stock purchase, revenue, or expense.</p>}
        </div>
      </Card>
    </div>
  );
}

const Empty = () => <div className="h-full grid place-items-center text-sm text-muted-foreground">No data yet</div>;
