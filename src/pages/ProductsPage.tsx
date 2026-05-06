import { useProducts } from "@/hooks/useFinance";
import { PageHeader } from "@/components/PageHeader";
import { EntityForm } from "@/components/EntityForm";
import { DataTable } from "@/components/DataTable";

export default function ProductsPage() {
  const { data: rows = [] } = useProducts();
  return (
    <div>
      <PageHeader title="Products" subtitle="Catalog of items you buy and sell" dialogTitle="New product">
        <EntityForm
          table="products"
          invalidate={["products"]}
          fields={[
            { name: "name", label: "Product name", type: "text" },
            { name: "sku", label: "SKU (optional)", type: "text" },
            { name: "category", label: "Category (optional)", type: "text" },
          ]}
        />
      </PageHeader>
      <DataTable
        rows={rows}
        table="products"
        invalidate={["products"]}
        columns={[
          { key: "name", label: "Name" },
          { key: "sku", label: "SKU" },
          { key: "category", label: "Category" },
        ]}
      />
    </div>
  );
}
