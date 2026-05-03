import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type Settings = { user_id: string; starting_cash: number; sales_tracking_mode: "per_payout" | "periodic"; };
export type StockPurchase = { id: string; date: string; product_name: string; quantity: number; total_cost: number; notes: string | null; };
export type RevenuePayout = { id: string; date: string; earned_amount: number; received_amount: number; status: string; units_sold: number | null; notes: string | null; };
export type Expense = { id: string; date: string; category: string; amount: number; notes: string | null; };
export type SalesRecord = { id: string; start_date: string; end_date: string; units_sold: number; period_type: string; notes: string | null; };
export type Transaction = { id: string; date: string; type: string; category: string | null; amount: number; notes: string | null; };

const fetchAll = <T,>(table: string, order = "date") => async (): Promise<T[]> => {
  const { data, error } = await supabase.from(table as any).select("*").order(order, { ascending: false });
  if (error) throw error;
  return (data ?? []) as T[];
};

export const useSettings = () => useQuery({
  queryKey: ["settings"],
  queryFn: async (): Promise<Settings> => {
    const { data, error } = await supabase.from("settings").select("*").maybeSingle();
    if (error) throw error;
    return data as Settings;
  },
});

export const useStockPurchases = () => useQuery({ queryKey: ["stock"], queryFn: fetchAll<StockPurchase>("stock_purchases") });
export const useRevenuePayouts = () => useQuery({ queryKey: ["revenue"], queryFn: fetchAll<RevenuePayout>("revenue_payouts") });
export const useExpenses = () => useQuery({ queryKey: ["expenses"], queryFn: fetchAll<Expense>("expenses") });
export const useSalesRecords = () => useQuery({ queryKey: ["sales"], queryFn: fetchAll<SalesRecord>("sales_records", "end_date") });
export const useTransactions = () => useQuery({ queryKey: ["transactions"], queryFn: fetchAll<Transaction>("transactions") });

export const inRange = (d: string, start?: string, end?: string) =>
  (!start || d >= start) && (!end || d <= end);

export type ReportInputs = {
  settings: Settings;
  stock: StockPurchase[];
  revenue: RevenuePayout[];
  expenses: Expense[];
  sales: SalesRecord[];
  start?: string;
  end?: string;
};

export function computeReport({ settings, stock, revenue, expenses, sales, start, end }: ReportInputs) {
  const upToEnd = stock.filter((s) => !end || s.date <= end);
  const totalPurchaseCost = upToEnd.reduce((a, s) => a + Number(s.total_cost), 0);
  const totalUnitsPurchased = upToEnd.reduce((a, s) => a + Number(s.quantity), 0);
  const avgCostPerUnit = totalUnitsPurchased > 0 ? totalPurchaseCost / totalUnitsPurchased : 0;

  const unitsSold = settings?.sales_tracking_mode === "periodic"
    ? sales.filter((s) => inRange(s.end_date, start, end)).reduce((a, s) => a + Number(s.units_sold), 0)
    : revenue.filter((r) => inRange(r.date, start, end)).reduce((a, r) => a + Number(r.units_sold ?? 0), 0);

  const periodRev = revenue.filter((r) => inRange(r.date, start, end));
  // Revenue (business performance) uses EARNED amount
  const revenueTotal = periodRev.reduce((a, r) => a + Number(r.earned_amount), 0);
  // Cash received in period
  const cashReceived = periodRev.reduce((a, r) => a + Number(r.received_amount), 0);
  const expensesTotal = expenses.filter((e) => inRange(e.date, start, end)).reduce((a, e) => a + Number(e.amount), 0);
  const stockOutflow = stock.filter((s) => inRange(s.date, start, end)).reduce((a, s) => a + Number(s.total_cost), 0);

  const cogs = unitsSold * avgCostPerUnit;
  const grossProfit = revenueTotal - cogs;
  const netProfit = grossProfit - expensesTotal;
  const grossMargin = revenueTotal > 0 ? (grossProfit / revenueTotal) * 100 : 0;
  const netMargin = revenueTotal > 0 ? (netProfit / revenueTotal) * 100 : 0;

  // Wallet balance for the period (earned - received)
  const walletPeriod = revenueTotal - cashReceived;

  // All-time totals for cash & wallet balance
  const allTimeEarned = revenue.reduce((a, r) => a + Number(r.earned_amount), 0);
  const allTimeReceived = revenue.reduce((a, r) => a + Number(r.received_amount), 0);
  const allTimeExpenses = expenses.reduce((a, e) => a + Number(e.amount), 0);
  const allTimeStock = stock.reduce((a, s) => a + Number(s.total_cost), 0);
  // Cash on hand uses RECEIVED money only
  const cash = Number(settings?.starting_cash ?? 0) + allTimeReceived - allTimeExpenses - allTimeStock;
  const walletBalance = allTimeEarned - allTimeReceived;

  return {
    revenue: revenueTotal, cashReceived, expenses: expensesTotal, cogs, grossProfit, netProfit,
    grossMargin, netMargin, unitsSold, avgCostPerUnit, totalPurchaseCost, totalUnitsPurchased,
    inflows: cashReceived, outflows: expensesTotal + stockOutflow, netCashFlow: cashReceived - expensesTotal - stockOutflow,
    cash, walletBalance, walletPeriod, allTimeEarned, allTimeReceived,
  };
}

export const fmt = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(n || 0);
