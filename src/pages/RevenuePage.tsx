import { useRevenuePayouts, useSettings, fmt } from "@/hooks/useFinance";
import { PageHeader } from "@/components/PageHeader";
import { EntityForm } from "@/components/EntityForm";
import { DataTable } from "@/components/DataTable";

export default function RevenuePage() {
  const { data: rows = [] } = useRevenuePayouts();
  const { data: settings } = useSettings();
  const showUnits = settings?.sales_tracking_mode === "per_payout";

  const fields = [
    { name: "date", label: "Date", type: "date" as const },
    { name: "expected_amount", label: "Expected amount", type: "number" as const },
    { name: "received_amount", label: "Received amount", type: "number" as const },
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
      <DataTable
        rows={rows}
        table="revenue_payouts"
        invalidate={["revenue", "transactions"]}
        columns={[
          { key: "date", label: "Date" },
          { key: "expected_amount", label: "Expected", className: "text-right tabular-nums", render: (r) => fmt(Number(r.expected_amount)) },
          { key: "received_amount", label: "Received", className: "text-right tabular-nums", render: (r) => fmt(Number(r.received_amount)) },
          { key: "diff", label: "Diff", className: "text-right tabular-nums", render: (r) => {
            const d = Number(r.expected_amount) - Number(r.received_amount);
            return <span className={d === 0 ? "" : d > 0 ? "text-destructive" : "text-success"}>{fmt(d)}</span>;
          }},
          { key: "status", label: "Status", render: (r) => <span className="capitalize">{r.status}</span> },
          ...(showUnits ? [{ key: "units_sold" as const, label: "Units", className: "text-right tabular-nums" }] : []),
        ]}
      />
    </div>
  );
}
