import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type Settings = { user_id: string; starting_cash: number; sales_tracking_mode: "per_payout" | "periodic"; };
export type Product = { id: string; name: string; sku: string | null; category: string | null; };
export type StockPurchase = { id: string; date: string; product_name: string | null; quantity: number; total_cost: number; notes: string | null; };
export type StockPurchaseItem = { id: string; stock_purchase_id: string; product_id: string; quantity: number; total_cost: number; date?: string };
export type RevenuePayout = { id: string; date: string; earned_amount: number; received_amount: number; status: string; units_sold: number | null; notes: string | null; };
export type RevenuePayoutItem = { id: string; revenue_payout_id: string; product_id: string; units_sold: number; date?: string };
export type Expense = { id: string; date: string; category: string; amount: number; notes: string | null; };
export type SalesRecord = { id: string; start_date: string; end_date: string; units_sold: number; period_type: string; notes: string | null; };
export type SalesItem = { id: string; sales_record_id: string; product_id: string; units_sold: number; end_date?: string };
export type Transaction = { id: string; date: string; type: string; category: string | null; amount: number; notes: string | null; source_table: string | null; source_id: string | null; };
export type GeneralReceivedPayment = { id: string; date: string; amount: number; note: string | null; };
export type OpeningBalance = { id: string; date: string; cash_amount: number; notes: string | null; };
export type OpeningBalanceItem = { id: string; opening_balance_id: string; product_id: string; quantity: number; unit_cost: number; };
export type MarketingCampaign = { id: string; date: string; extra_cost: number; notes: string | null; };
export type MarketingCampaignItem = { id: string; campaign_id: string; product_id: string; quantity: number; unit_cost: number; date?: string };

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
export const useGeneralReceivedPayments = () => useQuery({ queryKey: ["general_received"], queryFn: fetchAll<GeneralReceivedPayment>("general_received_payments") });

export const useOpeningBalance = () => useQuery({
  queryKey: ["opening_balance"],
  queryFn: async (): Promise<OpeningBalance | null> => {
    const { data, error } = await supabase.from("opening_balances" as any).select("*").maybeSingle();
    if (error) throw error;
    return (data as any) ?? null;
  },
});

export const useOpeningBalanceItems = () => useQuery({
  queryKey: ["opening_balance_items"],
  queryFn: fetchAll<OpeningBalanceItem>("opening_balance_items", "created_at"),
});

export const usePersonalWithdrawals = () => useQuery({
  queryKey: ["personal_withdrawals"],
  queryFn: async (): Promise<{ id: string; date: string; amount: number; note: string | null }[]> => {
    const { data, error } = await supabase.from("personal_withdrawals" as any).select("*").order("date", { ascending: false });
    if (error) throw error;
    return (data ?? []) as any;
  },
});

export const useMarketingCampaigns = () => useQuery({
  queryKey: ["marketing_campaigns"],
  queryFn: fetchAll<MarketingCampaign>("marketing_campaigns"),
});

export const useMarketingCampaignItems = () => useQuery({
  queryKey: ["marketing_campaign_items"],
  queryFn: async (): Promise<MarketingCampaignItem[]> => {
    const { data, error } = await supabase.from("marketing_campaign_items" as any).select("*, marketing_campaigns(date)");
    if (error) throw error;
    return (data ?? []).map((r: any) => ({ ...r, date: r.marketing_campaigns?.date })) as MarketingCampaignItem[];
  },
});

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
  generalReceived?: GeneralReceivedPayment[];
  openingBalance?: OpeningBalance | null;
  openingItems?: OpeningBalanceItem[];
  marketingItems?: MarketingCampaignItem[];
  withdrawals?: { date: string; amount: number }[];
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
  unitsUsed: number;
  cogs: number;
};

export function computeReport({ settings, stock, stockItems, revenue, revenueItems, expenses, sales, salesItems, products, generalReceived = [], openingBalance = null, openingItems = [], marketingItems = [], withdrawals = [], start, end }: ReportInputs) {
  const productMap = new Map(products.map((p) => [p.id, p]));

  const perProduct = new Map<string, ProductBreakdown>();
  const ensure = (pid: string): ProductBreakdown => {
    let row = perProduct.get(pid);
    if (!row) {
      row = { productId: pid, productName: productMap.get(pid)?.name ?? "Unknown", unitsPurchased: 0, totalCost: 0, avgCost: 0, unitsSold: 0, unitsUsed: 0, cogs: 0 };
      perProduct.set(pid, row);
    }
    return row;
  };

  openingItems.forEach((it) => {
    const row = ensure(it.product_id);
    row.unitsPurchased += Number(it.quantity);
    row.totalCost += Number(it.quantity) * Number(it.unit_cost);
  });

  stockItems.forEach((it) => {
    if (end && it.date && it.date > end) return;
    const row = ensure(it.product_id);
    row.unitsPurchased += Number(it.quantity);
    row.totalCost += Number(it.total_cost);
  });
  perProduct.forEach((row) => { row.avgCost = row.unitsPurchased > 0 ? row.totalCost / row.unitsPurchased : 0; });

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

  // Marketing inventory consumption — reduces inventory, counts as an expense (not cash)
  let marketingInventoryCost = 0;
  marketingItems.forEach((it) => {
    if (!inRange(it.date, start, end)) return;
    const row = ensure(it.product_id);
    row.unitsUsed += Number(it.quantity);
    marketingInventoryCost += Number(it.quantity) * Number(it.unit_cost);
  });

  // Per-product COGS (includes both sold and used-in-marketing units)
  let cogs = 0;
  perProduct.forEach((row) => { row.cogs = (row.unitsSold + row.unitsUsed) * row.avgCost; cogs += row.cogs; });
  const breakdown = Array.from(perProduct.values()).sort((a, b) => b.cogs - a.cogs);

  const unitsSold = breakdown.reduce((a, r) => a + r.unitsSold, 0);
  const totalUnitsPurchased = breakdown.reduce((a, r) => a + r.unitsPurchased, 0);
  const totalPurchaseCost = breakdown.reduce((a, r) => a + r.totalCost, 0);
  const avgCostPerUnit = totalUnitsPurchased > 0 ? totalPurchaseCost / totalUnitsPurchased : 0;

  const periodRev = revenue.filter((r) => inRange(r.date, start, end));
  const periodGeneral = generalReceived.filter((g) => inRange(g.date, start, end));
  const revenueTotal = periodRev.reduce((a, r) => a + Number(r.earned_amount), 0);
  const cashReceived = periodRev.reduce((a, r) => a + Number(r.received_amount), 0)
    + periodGeneral.reduce((a, g) => a + Number(g.amount), 0);
  const expensesTotal = expenses.filter((e) => inRange(e.date, start, end)).reduce((a, e) => a + Number(e.amount), 0);
  const stockOutflow = stock.filter((s) => inRange(s.date, start, end)).reduce((a, s) => a + Number(s.total_cost), 0);

  // Marketing inventory cost is a P&L expense but does NOT touch cash (already paid via stock)
  const expensesForPnl = expensesTotal + marketingInventoryCost;

  const grossProfit = revenueTotal - cogs;
  const netProfit = grossProfit - expensesForPnl;
  const grossMargin = revenueTotal > 0 ? (grossProfit / revenueTotal) * 100 : 0;
  const netMargin = revenueTotal > 0 ? (netProfit / revenueTotal) * 100 : 0;

  const walletPeriod = revenueTotal - cashReceived;

  const allTimeEarned = revenue.reduce((a, r) => a + Number(r.earned_amount), 0);
  const allTimeReceived = revenue.reduce((a, r) => a + Number(r.received_amount), 0)
    + generalReceived.reduce((a, g) => a + Number(g.amount), 0);
  const allTimeExpenses = expenses.reduce((a, e) => a + Number(e.amount), 0);
  const allTimeStock = stock.reduce((a, s) => a + Number(s.total_cost), 0);
  const allTimeWithdrawals = withdrawals.reduce((a, w) => a + Number(w.amount), 0);
  const openingCash = Number(openingBalance?.cash_amount ?? 0);
  const cash = openingCash + Number(settings?.starting_cash ?? 0) + allTimeReceived - allTimeExpenses - allTimeStock - allTimeWithdrawals;
  const walletBalance = allTimeEarned - allTimeReceived;

  return {
    revenue: revenueTotal, cashReceived, expenses: expensesForPnl, cogs, grossProfit, netProfit,
    grossMargin, netMargin, unitsSold, avgCostPerUnit, totalPurchaseCost, totalUnitsPurchased,
    marketingInventoryCost,
    inflows: cashReceived, outflows: expensesTotal + stockOutflow, netCashFlow: cashReceived - expensesTotal - stockOutflow,
    cash, walletBalance, walletPeriod, allTimeEarned, allTimeReceived,
    breakdown,
  };
}

export const fmt = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(n || 0);
