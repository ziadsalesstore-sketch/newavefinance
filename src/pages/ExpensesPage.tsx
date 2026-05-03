import { useExpenses, fmt } from "@/hooks/useFinance";
import { PageHeader } from "@/components/PageHeader";
import { EntityForm } from "@/components/EntityForm";
import { DataTable } from "@/components/DataTable";
import { CategorySelect } from "@/components/CategorySelect";

export default function ExpensesPage() {
  const { data: rows = [] } = useExpenses();
  return (
    <div>
      <PageHeader title="Expenses" subtitle="Operating costs (excludes inventory)" dialogTitle="New expense">
        <EntityForm
          table="expenses"
          invalidate={["expenses", "transactions"]}
          fields={[
            { name: "date", label: "Date", type: "date" },
            {
              name: "category",
              label: "Category",
              type: "custom",
              render: (value, onChange) => <CategorySelect value={value ?? ""} onChange={onChange} />,
            },
            { name: "amount", label: "Amount", type: "number" },
            { name: "notes", label: "Notes", type: "textarea" },
          ]}
        />
      </PageHeader>
      <DataTable
        rows={rows}
        table="expenses"
        invalidate={["expenses", "transactions"]}
        columns={[
          { key: "date", label: "Date" },
          { key: "category", label: "Category" },
          { key: "amount", label: "Amount", className: "text-right tabular-nums", render: (r) => fmt(Number(r.amount)) },
          { key: "notes", label: "Notes" },
        ]}
      />
    </div>
  );
}
