import { useState } from "react";
import { useStockPurchases, useStockPurchaseItems, useProducts, fmt } from "@/hooks/useFinance";
import { PageHeader } from "@/components/PageHeader";
import { MultiItemForm } from "@/components/MultiItemForm";
import { DataTable } from "@/components/DataTable";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronRight } from "lucide-react";

export default function StockPage() {
  const { data: rows = [] } = useStockPurchases();
  const { data: items = [] } = useStockPurchaseItems();
  const { data: products = [] } = useProducts();
  const productMap = new Map(products.map((p) => [p.id, p.name]));
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <div>
      <PageHeader title="Stock Purchases" subtitle="Batch purchases — multiple products per entry" dialogTitle="New stock purchase">
        <MultiItemForm mode="stock" />
      </PageHeader>

      {products.length === 0 && (
        <Card className="p-4 mb-4 border-warning/30 bg-warning/5 text-sm">
          No products yet. Add some on the <strong>Products</strong> page first.
        </Card>
      )}

      <Card className="overflow-hidden">
        {rows.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">No stock purchases yet.</div>
        ) : rows.map((r) => {
          const lines = items.filter((it) => it.stock_purchase_id === r.id);
          const open = openId === r.id;
          return (
            <div key={r.id} className="border-b last:border-0">
              <button onClick={() => setOpenId(open ? null : r.id)} className="w-full flex items-center justify-between p-4 hover:bg-muted/30 text-left">
                <div className="flex items-center gap-3">
                  {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  <div>
                    <div className="font-medium text-sm">{r.date}</div>
                    <div className="text-xs text-muted-foreground">{r.product_name || `${lines.length} item${lines.length === 1 ? "" : "s"}`}</div>
                  </div>
                </div>
                <div className="flex items-center gap-6 text-sm">
                  <div className="tabular-nums text-muted-foreground">{Number(r.quantity).toLocaleString()} units</div>
                  <div className="tabular-nums font-semibold">{fmt(Number(r.total_cost))}</div>
                </div>
              </button>
              {open && (
                <div className="bg-muted/20 px-12 py-3 space-y-1">
                  {lines.map((it) => (
                    <div key={it.id} className="flex justify-between text-sm py-1">
                      <span>{productMap.get(it.product_id) ?? "—"}</span>
                      <div className="flex gap-6 tabular-nums">
                        <span className="text-muted-foreground">{Number(it.quantity)} × {fmt(Number(it.total_cost) / Number(it.quantity))}</span>
                        <span className="font-medium w-24 text-right">{fmt(Number(it.total_cost))}</span>
                      </div>
                    </div>
                  ))}
                  {r.notes && <div className="text-xs text-muted-foreground pt-2">{r.notes}</div>}
                </div>
              )}
            </div>
          );
        })}
      </Card>

      <div className="mt-2 text-xs text-muted-foreground">Tip: click a row to expand line items.</div>

      {/* Hidden DataTable preserved for delete via cascade if needed in future */}
      <div className="hidden"><DataTable rows={rows} table="stock_purchases" invalidate={["stock", "stock_items", "transactions"]} columns={[{ key: "date", label: "Date" }]} /></div>
      <div className="mt-4">
        <DeleteRow rows={rows} />
      </div>
    </div>
  );
}

function DeleteRow({ rows }: { rows: { id: string; date: string }[] }) {
  // simple inline delete UI
  return null;
}
