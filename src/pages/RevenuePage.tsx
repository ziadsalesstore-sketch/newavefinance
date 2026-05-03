import { useRevenuePayouts, useSettings, fmt } from "@/hooks/useFinance";
import { PageHeader } from "@/components/PageHeader";
import { EntityForm } from "@/components/EntityForm";
import { DataTable } from "@/components/DataTable";
import { MetricCard } from "@/components/MetricCard";
import { useMemo } from "react";

export default function RevenuePage() {
  const { data: rows = [] } = useRevenuePayouts();
  const { data: settings } = useSettings();
  const showUnits = settings?.sales_tracking_mode === "per_payout";

  const totals = useMemo(() => {
    const earned = rows.reduce((a, r) => a + Number(r.earned_amount), 0);
    const received = rows.reduce((a, r) => a + Number(r.received_amount), 0);
    return { earned, received, wallet: earned - received };
  }, [rows]);

  const fields = [
    { name: "date", label: "Date", type: "date" as const },
    { name: "earned_amount", label: "Earned amount (delivered orders)", type: "number" as const },
    { name: "received_amount", label: "Received amount (cash in hand)", type: "number" as const },
    { name: "status", label: "Status", type: "select" as const, options: [
      { value: "received", label: "Received" }, { value: "pending", label: "Pending" },
    ]},
    ...(showUnits ? [{ name: "units_sold", label: "Units sold", type: "number" as const }] : []),
    { name: "notes", label: "Notes", type: "textarea" as const },
  ];

  return (
    <div>
      <PageHeader title="Revenue Payouts" subtitle={`Sales tracking: ${showUnits ? "Per Payout" : "Periodic Records"}`} dialogTitle="New revenue payout">
        <EntityForm table="revenue_payouts" invalidate={["revenue", "transactions"]} fields={fields} defaults={{ status: "received" }} />
      </PageHeader>

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-3 mb-4">
        <MetricCard label="Total Earned" value={fmt(totals.earned)} />
        <MetricCard label="Total Received" value={fmt(totals.received)} />
        <MetricCard label="Shipping Wallet Balance" value={fmt(totals.wallet)} hint="Held by shipping company" />
      </div>

      <DataTable
        rows={rows}
        table="revenue_payouts"
        invalidate={["revenue", "transactions"]}
        columns={[
          { key: "date", label: "Date" },
          { key: "earned_amount", label: "Earned", className: "text-right tabular-nums", render: (r) => fmt(Number(r.earned_amount)) },
          { key: "received_amount", label: "Received", className: "text-right tabular-nums", render: (r) => fmt(Number(r.received_amount)) },
          { key: "diff", label: "In Wallet", className: "text-right tabular-nums", render: (r) => {
            const d = Number(r.earned_amount) - Number(r.received_amount);
            return <span className={d === 0 ? "" : d > 0 ? "text-warning" : "text-success"}>{fmt(d)}</span>;
          }},
          { key: "status", label: "Status", render: (r) => <span className="capitalize">{r.status}</span> },
          ...(showUnits ? [{ key: "units_sold" as const, label: "Units", className: "text-right tabular-nums" }] : []),
        ]}
      />
    </div>
  );
}
