import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useStockPurchases, useStockPurchaseItems, useProducts, fmt } from "@/hooks/useFinance";
import { PageHeader } from "@/components/PageHeader";
import { MultiItemForm } from "@/components/MultiItemForm";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronRight, Trash2 } from "lucide-react";
import { toast } from "sonner";

export default function StockPage() {
  const { data: rows = [] } = useStockPurchases();
  const { data: items = [] } = useStockPurchaseItems();
  const { data: products = [] } = useProducts();
  const productMap = new Map(products.map((p) => [p.id, p.name]));
  const [openId, setOpenId] = useState<string | null>(null);
  const qc = useQueryClient();

  const del = async (id: string) => {
    if (!confirm("Delete this purchase and all its items?")) return;
    const { error } = await supabase.from("stock_purchases").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    qc.invalidateQueries({ queryKey: ["stock"] });
    qc.invalidateQueries({ queryKey: ["stock_items"] });
    qc.invalidateQueries({ queryKey: ["transactions"] });
  };

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
              <div className="flex items-center justify-between p-4 hover:bg-muted/30">
                <button onClick={() => setOpenId(open ? null : r.id)} className="flex items-center gap-3 flex-1 text-left">
                  {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  <div>
                    <div className="font-medium text-sm">{r.date}</div>
                    <div className="text-xs text-muted-foreground">{r.product_name || `${lines.length} item${lines.length === 1 ? "" : "s"}`}</div>
                  </div>
                </button>
                <div className="flex items-center gap-6 text-sm">
                  <div className="tabular-nums text-muted-foreground">{Number(r.quantity).toLocaleString()} units</div>
                  <div className="tabular-nums font-semibold w-28 text-right">{fmt(Number(r.total_cost))}</div>
                  <Button size="icon" variant="ghost" onClick={() => del(r.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </div>
              </div>
              {open && (
                <div className="bg-muted/20 px-12 py-3 space-y-1">
                  {lines.map((it) => (
                    <div key={it.id} className="flex justify-between text-sm py-1">
                      <span>{productMap.get(it.product_id) ?? "—"}</span>
                      <div className="flex gap-6 tabular-nums">
                        <span className="text-muted-foreground">{Number(it.quantity)} × {fmt(Number(it.total_cost) / Number(it.quantity))}</span>
                        <span className="font-medium w-28 text-right">{fmt(Number(it.total_cost))}</span>
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
    </div>
  );
}
