import { useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { useSettings, useStockPurchases, useRevenuePayouts, useExpenses, useSalesRecords, useStockPurchaseItems, useSalesItems, useRevenueItems, useProducts, useGeneralReceivedPayments, useOpeningBalance, useOpeningBalanceItems, useMarketingCampaignItems, usePersonalWithdrawals, useCashAdjustments, useInventoryAdjustments, computeReport, fmt } from "@/hooks/useFinance";
import { DateRange } from "@/components/DateRange";
import { Card } from "@/components/ui/card";
import { MetricCard } from "@/components/MetricCard";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default function ReportsPage() {
  const { data: settings } = useSettings();
  const { data: stock = [] } = useStockPurchases();
  const { data: revenue = [] } = useRevenuePayouts();
  const { data: expenses = [] } = useExpenses();
  const { data: sales = [] } = useSalesRecords();
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

  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");

  const r = useMemo(
    () => settings ? computeReport({ settings, stock, stockItems, revenue, revenueItems, expenses, sales, salesItems, products, generalReceived, openingBalance, openingItems, marketingItems, withdrawals, cashAdjustments, inventoryAdjustments, start: start || undefined, end: end || undefined }) : null,
    [settings, stock, stockItems, revenue, revenueItems, expenses, sales, salesItems, products, generalReceived, openingBalance, openingItems, marketingItems, withdrawals, cashAdjustments, inventoryAdjustments, start, end]
  );

  const expensesByCategory = useMemo(() => {
    const inRange = (d: string) => (!start || d >= start) && (!end || d <= end);
    const map = new Map<string, number>();
    expenses.filter((e) => inRange(e.date)).forEach((e) => {
      const cat = e.category || "Uncategorized";
      map.set(cat, (map.get(cat) ?? 0) + Number(e.amount));
    });
    return Array.from(map.entries()).map(([category, amount]) => ({ category, amount })).sort((a, b) => b.amount - a.amount);
  }, [expenses, start, end]);

  if (!r) return null;

  const periodLabel = () => {
    if (start && end) return `${start}_to_${end}`;
    if (start) return `from_${start}`;
    if (end) return `until_${end}`;
    return "all_time";
  };

  const exportIncomeStatement = () => {
    const rows: (string | number)[][] = [
      ["Income Statement"],
      ["Period", start || "All time", end || ""],
      [],
      ["Line Item", "Amount"],
      ["Revenue", r.revenue],
      ["Cost of Goods Sold", -r.cogs],
      ["Gross Profit", r.grossProfit],
      [],
      ["Operating Expenses by Category", ""],
      ...expensesByCategory.map((c) => [c.category, c.amount]),
      ...(r.marketingInventoryCost > 0 ? [["Marketing (Inventory Used)", r.marketingInventoryCost] as (string | number)[]] : []),
      ["Total Operating Expenses", -r.expenses],
      [],
      ["Net Profit", r.netProfit],
      ["Gross Margin %", Number(r.grossMargin.toFixed(2))],
      ["Net Margin %", Number(r.netMargin.toFixed(2))],
    ];
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws["!cols"] = [{ wch: 36 }, { wch: 16 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Income Statement");
    XLSX.writeFile(wb, `Income_Statement_${periodLabel()}.xlsx`);
  };

  const exportCashFlow = () => {
    const rows: (string | number)[][] = [
      ["Cash Flow Statement"],
      ["Period", start || "All time", end || ""],
      [],
      ["Line Item", "Amount"],
      ["Inflows (Cash Received)", r.inflows],
      ["Outflows (Expenses + Stock)", -r.outflows],
      ["Net Cash Flow", r.netCashFlow],
      ["Shipping Wallet Balance (all-time)", r.walletBalance],
      [],
      ["Margins", ""],
      ["Gross Margin %", Number(r.grossMargin.toFixed(2))],
      ["Net Margin %", Number(r.netMargin.toFixed(2))],
    ];
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws["!cols"] = [{ wch: 36 }, { wch: 16 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Cash Flow");
    XLSX.writeFile(wb, `Cash_Flow_Statement_${periodLabel()}.xlsx`);
  };

  const exportProductBreakdown = () => {
    const header = ["Product", "Units Purchased", "Avg Cost", "Units Sold", "COGS", "Inventory Left"];
    const rows: (string | number)[][] = [
      ["Per-Product Breakdown"],
      ["Period", start || "All time", end || ""],
      [],
      header,
      ...r.breakdown.map((p) => [
        p.productName,
        p.unitsPurchased,
        Number(p.avgCost.toFixed(2)),
        p.unitsSold,
        Number(p.cogs.toFixed(2)),
        p.unitsPurchased - p.unitsSold - (p.unitsUsed ?? 0) + (p.invIncrease ?? 0) - (p.invDecrease ?? 0),
      ]),
    ];
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws["!cols"] = [{ wch: 28 }, { wch: 16 }, { wch: 12 }, { wch: 12 }, { wch: 14 }, { wch: 14 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Products");
    XLSX.writeFile(wb, `Product_Breakdown_${periodLabel()}.xlsx`);
  };

  const exportAll = () => {
    const wb = XLSX.utils.book_new();

    const isRows: (string | number)[][] = [
      ["Income Statement"],
      ["Period", start || "All time", end || ""],
      [],
      ["Line Item", "Amount"],
      ["Revenue", r.revenue],
      ["Cost of Goods Sold", -r.cogs],
      ["Gross Profit", r.grossProfit],
      [],
      ["Operating Expenses by Category", ""],
      ...expensesByCategory.map((c) => [c.category, c.amount]),
      ...(r.marketingInventoryCost > 0 ? [["Marketing (Inventory Used)", r.marketingInventoryCost] as (string | number)[]] : []),
      ["Total Operating Expenses", -r.expenses],
      [],
      ["Net Profit", r.netProfit],
    ];
    const isWs = XLSX.utils.aoa_to_sheet(isRows);
    isWs["!cols"] = [{ wch: 36 }, { wch: 16 }];
    XLSX.utils.book_append_sheet(wb, isWs, "Income Statement");

    const cfRows: (string | number)[][] = [
      ["Cash Flow Statement"],
      ["Period", start || "All time", end || ""],
      [],
      ["Line Item", "Amount"],
      ["Inflows (Cash Received)", r.inflows],
      ["Outflows (Expenses + Stock)", -r.outflows],
      ["Net Cash Flow", r.netCashFlow],
      ["Shipping Wallet Balance (all-time)", r.walletBalance],
    ];
    const cfWs = XLSX.utils.aoa_to_sheet(cfRows);
    cfWs["!cols"] = [{ wch: 36 }, { wch: 16 }];
    XLSX.utils.book_append_sheet(wb, cfWs, "Cash Flow");

    const pbRows: (string | number)[][] = [
      ["Product", "Units Purchased", "Avg Cost", "Units Sold", "COGS", "Inventory Left"],
      ...r.breakdown.map((p) => [
        p.productName, p.unitsPurchased, Number(p.avgCost.toFixed(2)),
        p.unitsSold, Number(p.cogs.toFixed(2)),
        p.unitsPurchased - p.unitsSold - (p.unitsUsed ?? 0) + (p.invIncrease ?? 0) - (p.invDecrease ?? 0),
      ]),
    ];
    const pbWs = XLSX.utils.aoa_to_sheet(pbRows);
    pbWs["!cols"] = [{ wch: 28 }, { wch: 16 }, { wch: 12 }, { wch: 12 }, { wch: 14 }, { wch: 14 }];
    XLSX.utils.book_append_sheet(wb, pbWs, "Products");

    XLSX.writeFile(wb, `Reports_${periodLabel()}.xlsx`);
  };

  const Row = ({ label, value, bold, tone, indent }: { label: string; value: string; bold?: boolean; tone?: "pos" | "neg"; indent?: boolean }) => (
    <div className={`flex justify-between py-2 border-b last:border-0 ${bold ? "font-bold text-base" : "text-sm"} ${indent ? "pl-4 text-muted-foreground" : ""}`}>
      <span>{label}</span>
      <span className={`tabular-nums ${tone === "pos" ? "text-success" : tone === "neg" ? "text-destructive" : ""}`}>{value}</span>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Reports</h1>
          <p className="text-sm text-muted-foreground">Income statement, cash flow, and per-product breakdowns</p>
        </div>
        <Button onClick={exportAll} variant="default" size="sm">
          <Download className="h-4 w-4 mr-2" /> Export All to Excel
        </Button>
      </div>
      <DateRange start={start} end={end} onChange={(s, e) => { setStart(s); setEnd(e); }} />

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Revenue (Earned)" value={fmt(r.revenue)} />
        <MetricCard label="Cash Received" value={fmt(r.cashReceived)} hint={`Wallet: ${fmt(r.walletPeriod)}`} />
        <MetricCard label="COGS" value={fmt(r.cogs)} hint={`${r.unitsSold} units sold`} />
        <MetricCard label="Net Profit" value={fmt(r.netProfit)} numeric={r.netProfit} tone="auto" hint={`${r.netMargin.toFixed(1)}% margin`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold">Income Statement</h3>
            <Button onClick={exportIncomeStatement} variant="outline" size="sm">
              <Download className="h-4 w-4 mr-2" /> Export
            </Button>
          </div>
          <Row label="Revenue" value={fmt(r.revenue)} />
          <Row label="Cost of Goods Sold" value={`(${fmt(r.cogs)})`} />
          <Row label="Gross Profit" value={fmt(r.grossProfit)} bold tone={r.grossProfit >= 0 ? "pos" : "neg"} />
          <div className="pt-3 pb-1 text-sm font-semibold">Operating Expenses</div>
          {expensesByCategory.length === 0 && r.marketingInventoryCost === 0 ? (
            <div className="pl-4 py-2 text-sm text-muted-foreground">No expenses in this period.</div>
          ) : (
            <>
              {expensesByCategory.map((c) => (
                <Row key={c.category} label={c.category} value={`(${fmt(c.amount)})`} indent />
              ))}
              {r.marketingInventoryCost > 0 && (
                <Row label="Marketing (Inventory Used)" value={`(${fmt(r.marketingInventoryCost)})`} indent />
              )}
            </>
          )}
          <Row label="Total Operating Expenses" value={`(${fmt(r.expenses)})`} bold />
          <Row label="Net Profit" value={fmt(r.netProfit)} bold tone={r.netProfit >= 0 ? "pos" : "neg"} />
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold">Cash Flow Summary</h3>
            <Button onClick={exportCashFlow} variant="outline" size="sm">
              <Download className="h-4 w-4 mr-2" /> Export
            </Button>
          </div>
          <Row label="Inflows (Cash Received)" value={fmt(r.inflows)} />
          <Row label="Outflows (Expenses + Stock)" value={`(${fmt(r.outflows)})`} />
          <Row label="Net Cash Flow" value={fmt(r.netCashFlow)} bold tone={r.netCashFlow >= 0 ? "pos" : "neg"} />
          <Row label="Shipping Wallet Balance (all-time)" value={fmt(r.walletBalance)} />
          <div className="mt-6">
            <h3 className="font-semibold mb-3">Margins</h3>
            <Row label="Gross Margin" value={`${r.grossMargin.toFixed(2)}%`} />
            <Row label="Net Margin" value={`${r.netMargin.toFixed(2)}%`} />
          </div>
        </Card>
      </div>

      <Card className="p-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold">Per-Product Breakdown</h3>
          <Button onClick={exportProductBreakdown} variant="outline" size="sm" disabled={r.breakdown.length === 0}>
            <Download className="h-4 w-4 mr-2" /> Export
          </Button>
        </div>
        {r.breakdown.length === 0 ? (
          <p className="text-sm text-muted-foreground">No product activity in this period.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead className="text-right">Units Purchased</TableHead>
                <TableHead className="text-right">Avg Cost</TableHead>
                <TableHead className="text-right">Units Sold</TableHead>
                <TableHead className="text-right">COGS</TableHead>
                <TableHead className="text-right">Inventory Left</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {r.breakdown.map((p) => {
                const left = p.unitsPurchased - p.unitsSold - (p.unitsUsed ?? 0) + (p.invIncrease ?? 0) - (p.invDecrease ?? 0);
                return (
                  <TableRow key={p.productId}>
                    <TableCell className="font-medium">{p.productName}</TableCell>
                    <TableCell className="text-right tabular-nums">{p.unitsPurchased}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmt(p.avgCost)}</TableCell>
                    <TableCell className="text-right tabular-nums">{p.unitsSold}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmt(p.cogs)}</TableCell>
                    <TableCell className={`text-right tabular-nums ${left < 0 ? "text-destructive" : ""}`}>{left}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
