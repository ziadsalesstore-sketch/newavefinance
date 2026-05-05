import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type Settings = { user_id: string; starting_cash: number; sales_tracking_mode: "per_payout" | "periodic"; };
export type Product = { id: string; name: string; sku: string | null; category: string | null; };
export type StockPurchase = { id: string; date: string; product_name: string | null; quantity: number; total_cost: number; notes: string | null; };
export type StockPurchaseItem = { id: string; stock_purchase_id: string; product_id: string; quantity: number; total_cost: number; date?: string };
export type RevenuePayout = { id: string; date: string; earned_amount: number; received_amount: number; status: string; units_sold: number | null; notes: string | null; };
export type RevenuePayoutItem = { id: string; revenue_payout_id: string; product_id: string; units_sold: number; date?: string };
export type RevenuePayment = { id: string; revenue_payout_id: string; amount: number; date: string; note: string | null; };
export type Expense = { id: string; date: string; category: string; amount: number; notes: string | null; };
export type SalesRecord = { id: string; start_date: string; end_date: string; units_sold: number; period_type: string; notes: string | null; };
export type SalesItem = { id: string; sales_record_id: string; product_id: string; units_sold: number; end_date?: string };
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

export const useProducts = () => useQuery({ queryKey: ["products"], queryFn: fetchAll<Product>("products", "name") });
export const useStockPurchases = () => useQuery({ queryKey: ["stock"], queryFn: fetchAll<StockPurchase>("stock_purchases") });
export const useRevenuePayouts = () => useQuery({ queryKey: ["revenue"], queryFn: fetchAll<RevenuePayout>("revenue_payouts") });
export const useExpenses = () => useQuery({ queryKey: ["expenses"], queryFn: fetchAll<Expense>("expenses") });
export const useSalesRecords = () => useQuery({ queryKey: ["sales"], queryFn: fetchAll<SalesRecord>("sales_records", "end_date") });
export const useTransactions = () => useQuery({ queryKey: ["transactions"], queryFn: fetchAll<Transaction>("transactions") });

export const useStockPurchaseItems = () => useQuery({
  queryKey: ["stock_items"],
  queryFn: async (): Promise<StockPurchaseItem[]> => {
    const { data, error } = await supabase.from("stock_purchase_items" as any).select("*, stock_purchases(date)");
    if (error) throw error;
    return (data ?? []).map((r: any) => ({ ...r, date: r.stock_purchases?.date })) as StockPurchaseItem[];
  },
});

export const useSalesItems = () => useQuery({
  queryKey: ["sales_items"],
  queryFn: async (): Promise<SalesItem[]> => {
    const { data, error } = await supabase.from("sales_items" as any).select("*, sales_records(end_date)");
    if (error) throw error;
    return (data ?? []).map((r: any) => ({ ...r, end_date: r.sales_records?.end_date })) as SalesItem[];
  },
});

export const useRevenueItems = () => useQuery({
  queryKey: ["revenue_items"],
  queryFn: async (): Promise<RevenuePayoutItem[]> => {
    const { data, error } = await supabase.from("revenue_payout_items" as any).select("*, revenue_payouts(date)");
    if (error) throw error;
    return (data ?? []).map((r: any) => ({ ...r, date: r.revenue_payouts?.date })) as RevenuePayoutItem[];
  },
});

export const useRevenuePayments = () => useQuery({
  queryKey: ["revenue_payments"],
  queryFn: async (): Promise<RevenuePayment[]> => {
    const { data, error } = await supabase.from("revenue_payments" as any).select("*").order("date", { ascending: false });
    if (error) throw error;
    return (data ?? []) as RevenuePayment[];
  },
});

export const inRange = (d: string | undefined, start?: string, end?: string) =>
  !!d && (!start || d >= start) && (!end || d <= end);

export type ReportInputs = {
  settings: Settings;
  stock: StockPurchase[];
  stockItems: StockPurchaseItem[];
  revenue: RevenuePayout[];
  revenueItems: RevenuePayoutItem[];
  expenses: Expense[];
  sales: SalesRecord[];
  salesItems: SalesItem[];
  products: Product[];
  start?: string;
  end?: string;
};

export type ProductBreakdown = {
  productId: string;
  productName: string;
  unitsPurchased: number;
  totalCost: number;
  avgCost: number;
  unitsSold: number;
  cogs: number;
};

export function computeReport({ settings, stock, stockItems, revenue, revenueItems, expenses, sales, salesItems, products, start, end }: ReportInputs) {
  const productMap = new Map(products.map((p) => [p.id, p]));

  // Per-product purchase aggregates (up to end date) — fall back to all if no end
  const perProduct = new Map<string, ProductBreakdown>();
  const ensure = (pid: string): ProductBreakdown => {
    let row = perProduct.get(pid);
    if (!row) {
      row = { productId: pid, productName: productMap.get(pid)?.name ?? "Unknown", unitsPurchased: 0, totalCost: 0, avgCost: 0, unitsSold: 0, cogs: 0 };
      perProduct.set(pid, row);
    }
    return row;
  };

  stockItems.forEach((it) => {
    if (end && it.date && it.date > end) return;
    const row = ensure(it.product_id);
    row.unitsPurchased += Number(it.quantity);
    row.totalCost += Number(it.total_cost);
  });
  perProduct.forEach((row) => { row.avgCost = row.unitsPurchased > 0 ? row.totalCost / row.unitsPurchased : 0; });

  // Per-product units sold based on mode
  const periodic = settings?.sales_tracking_mode === "periodic";
  if (periodic) {
    salesItems.forEach((it) => {
      if (!inRange(it.end_date, start, end)) return;
      ensure(it.product_id).unitsSold += Number(it.units_sold);
    });
  } else {
    revenueItems.forEach((it) => {
      if (!inRange(it.date, start, end)) return;
      ensure(it.product_id).unitsSold += Number(it.units_sold);
    });
  }

  // Per-product COGS
  let cogs = 0;
  perProduct.forEach((row) => { row.cogs = row.unitsSold * row.avgCost; cogs += row.cogs; });
  const breakdown = Array.from(perProduct.values()).sort((a, b) => b.cogs - a.cogs);

  const unitsSold = breakdown.reduce((a, r) => a + r.unitsSold, 0);
  const totalUnitsPurchased = breakdown.reduce((a, r) => a + r.unitsPurchased, 0);
  const totalPurchaseCost = breakdown.reduce((a, r) => a + r.totalCost, 0);
  const avgCostPerUnit = totalUnitsPurchased > 0 ? totalPurchaseCost / totalUnitsPurchased : 0;

  const periodRev = revenue.filter((r) => inRange(r.date, start, end));
  const revenueTotal = periodRev.reduce((a, r) => a + Number(r.earned_amount), 0);
  const cashReceived = periodRev.reduce((a, r) => a + Number(r.received_amount), 0);
  const expensesTotal = expenses.filter((e) => inRange(e.date, start, end)).reduce((a, e) => a + Number(e.amount), 0);
  const stockOutflow = stock.filter((s) => inRange(s.date, start, end)).reduce((a, s) => a + Number(s.total_cost), 0);

  const grossProfit = revenueTotal - cogs;
  const netProfit = grossProfit - expensesTotal;
  const grossMargin = revenueTotal > 0 ? (grossProfit / revenueTotal) * 100 : 0;
  const netMargin = revenueTotal > 0 ? (netProfit / revenueTotal) * 100 : 0;

  const walletPeriod = revenueTotal - cashReceived;

  const allTimeEarned = revenue.reduce((a, r) => a + Number(r.earned_amount), 0);
  const allTimeReceived = revenue.reduce((a, r) => a + Number(r.received_amount), 0);
  const allTimeExpenses = expenses.reduce((a, e) => a + Number(e.amount), 0);
  const allTimeStock = stock.reduce((a, s) => a + Number(s.total_cost), 0);
  const cash = Number(settings?.starting_cash ?? 0) + allTimeReceived - allTimeExpenses - allTimeStock;
  const walletBalance = allTimeEarned - allTimeReceived;

  return {
    revenue: revenueTotal, cashReceived, expenses: expensesTotal, cogs, grossProfit, netProfit,
    grossMargin, netMargin, unitsSold, avgCostPerUnit, totalPurchaseCost, totalUnitsPurchased,
    inflows: cashReceived, outflows: expensesTotal + stockOutflow, netCashFlow: cashReceived - expensesTotal - stockOutflow,
    cash, walletBalance, walletPeriod, allTimeEarned, allTimeReceived,
    breakdown,
  };
}

export const fmt = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(n || 0);
