import { useSalesRecords, useSettings } from "@/hooks/useFinance";
import { PageHeader } from "@/components/PageHeader";
import { EntityForm } from "@/components/EntityForm";
import { DataTable } from "@/components/DataTable";
import { Card } from "@/components/ui/card";

export default function SalesPage() {
  const { data: rows = [] } = useSalesRecords();
  const { data: settings } = useSettings();
  const periodic = settings?.sales_tracking_mode === "periodic";

  return (
    <div>
      <PageHeader title="Sales Records" subtitle="Units sold over a period" dialogTitle="New sales record">
        <EntityForm
          table="sales_records"
          invalidate={["sales"]}
          defaults={{ period_type: "monthly" }}
          fields={[
            { name: "start_date", label: "Start date", type: "date" },
            { name: "end_date", label: "End date", type: "date" },
            { name: "units_sold", label: "Units sold", type: "number" },
            { name: "period_type", label: "Period type", type: "select", options: [
              { value: "daily", label: "Daily" }, { value: "weekly", label: "Weekly" },
              { value: "biweekly", label: "Biweekly" }, { value: "monthly", label: "Monthly" },
            ]},
            { name: "notes", label: "Notes", type: "textarea" },
          ]}
        />
      </PageHeader>
      {!periodic && (
        <Card className="p-4 mb-4 border-warning/30 bg-warning/5 text-sm">
          Sales tracking mode is currently <strong>Per Revenue Payout</strong>. These records will not be used in calculations until you switch the mode in Settings.
        </Card>
      )}
      <DataTable
        rows={rows}
        table="sales_records"
        invalidate={["sales"]}
        columns={[
          { key: "start_date", label: "Start" },
          { key: "end_date", label: "End" },
          { key: "period_type", label: "Period", render: (r) => <span className="capitalize">{r.period_type}</span> },
          { key: "units_sold", label: "Units", className: "text-right tabular-nums" },
          { key: "notes", label: "Notes" },
        ]}
      />
    </div>
  );
}
