import { useStockPurchases, fmt } from "@/hooks/useFinance";
import { PageHeader } from "@/components/PageHeader";
import { EntityForm } from "@/components/EntityForm";
import { DataTable } from "@/components/DataTable";

export default function StockPage() {
  const { data: rows = [] } = useStockPurchases();
  return (
    <div>
      <PageHeader title="Stock Purchases" subtitle="Inventory bought — feeds COGS automatically" dialogTitle="New stock purchase">
        <EntityForm
          table="stock_purchases"
          invalidate={["stock", "transactions"]}
          fields={[
            { name: "date", label: "Date", type: "date" },
            { name: "product_name", label: "Product name", type: "text" },
            { name: "quantity", label: "Quantity", type: "number" },
            { name: "total_cost", label: "Total cost", type: "number" },
            { name: "notes", label: "Notes", type: "textarea" },
          ]}
        />
      </PageHeader>
      <DataTable
        rows={rows}
        table="stock_purchases"
        invalidate={["stock", "transactions"]}
        columns={[
          { key: "date", label: "Date" },
          { key: "product_name", label: "Product" },
          { key: "quantity", label: "Qty", className: "text-right tabular-nums", render: (r) => Number(r.quantity).toLocaleString() },
          { key: "total_cost", label: "Total", className: "text-right tabular-nums", render: (r) => fmt(Number(r.total_cost)) },
          { key: "cost_per_unit", label: "Cost/Unit", className: "text-right tabular-nums", render: (r) => fmt(Number(r.total_cost) / Number(r.quantity)) },
          { key: "notes", label: "Notes" },
        ]}
      />
    </div>
  );
}
