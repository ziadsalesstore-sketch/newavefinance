import { useMemo, useState } from "react";
import { useSettings, useStockPurchases, useRevenuePayouts, useExpenses, useSalesRecords, computeReport, fmt } from "@/hooks/useFinance";
import { DateRange } from "@/components/DateRange";
import { Card } from "@/components/ui/card";
import { MetricCard } from "@/components/MetricCard";

export default function ReportsPage() {
  const { data: settings } = useSettings();
  const { data: stock = [] } = useStockPurchases();
  const { data: revenue = [] } = useRevenuePayouts();
  const { data: expenses = [] } = useExpenses();
  const { data: sales = [] } = useSalesRecords();

  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");

  const r = useMemo(
    () => settings ? computeReport({ settings, stock, revenue, expenses, sales, start: start || undefined, end: end || undefined }) : null,
    [settings, stock, revenue, expenses, sales, start, end]
  );
  if (!r) return null;

  const Row = ({ label, value, bold, tone }: { label: string; value: string; bold?: boolean; tone?: "pos" | "neg" }) => (
    <div className={`flex justify-between py-2 border-b last:border-0 ${bold ? "font-bold text-base" : "text-sm"}`}>
      <span>{label}</span>
      <span className={`tabular-nums ${tone === "pos" ? "text-success" : tone === "neg" ? "text-destructive" : ""}`}>{value}</span>
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Reports</h1>
        <p className="text-sm text-muted-foreground">Income statement, cash flow, and margins for any period</p>
      </div>
      <DateRange start={start} end={end} onChange={(s, e) => { setStart(s); setEnd(e); }} />

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Revenue" value={fmt(r.revenue)} />
        <MetricCard label="COGS" value={fmt(r.cogs)} hint={`${r.unitsSold} units × ${fmt(r.avgCostPerUnit)}`} />
        <MetricCard label="Gross Profit" value={fmt(r.grossProfit)} numeric={r.grossProfit} tone="auto" hint={`${r.grossMargin.toFixed(1)}% margin`} />
        <MetricCard label="Net Profit" value={fmt(r.netProfit)} numeric={r.netProfit} tone="auto" hint={`${r.netMargin.toFixed(1)}% margin`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-6">
          <h3 className="font-semibold mb-3">Income Statement</h3>
          <Row label="Revenue" value={fmt(r.revenue)} />
          <Row label="Cost of Goods Sold" value={`(${fmt(r.cogs)})`} />
          <Row label="Gross Profit" value={fmt(r.grossProfit)} bold tone={r.grossProfit >= 0 ? "pos" : "neg"} />
          <Row label="Operating Expenses" value={`(${fmt(r.expenses)})`} />
          <Row label="Net Profit" value={fmt(r.netProfit)} bold tone={r.netProfit >= 0 ? "pos" : "neg"} />
        </Card>

        <Card className="p-6">
          <h3 className="font-semibold mb-3">Cash Flow Summary</h3>
          <Row label="Inflows (Revenue)" value={fmt(r.inflows)} />
          <Row label="Outflows (Expenses + Stock)" value={`(${fmt(r.outflows)})`} />
          <Row label="Net Cash Flow" value={fmt(r.netCashFlow)} bold tone={r.netCashFlow >= 0 ? "pos" : "neg"} />
          <div className="mt-6">
            <h3 className="font-semibold mb-3">Margins</h3>
            <Row label="Gross Margin" value={`${r.grossMargin.toFixed(2)}%`} />
            <Row label="Net Margin" value={`${r.netMargin.toFixed(2)}%`} />
          </div>
        </Card>
      </div>
    </div>
  );
}
