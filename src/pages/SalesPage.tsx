import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSalesRecords, useSalesItems, useSettings, useProducts } from "@/hooks/useFinance";
import { PageHeader } from "@/components/PageHeader";
import { MultiItemForm } from "@/components/MultiItemForm";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronRight, Trash2 } from "lucide-react";
import { DateRangePicker, useDateRange, inDateRange } from "@/components/DateRangePicker";
import { toast } from "sonner";

export default function SalesPage() {
  const { data: rows = [] } = useSalesRecords();
  const { data: items = [] } = useSalesItems();
  const { data: products = [] } = useProducts();
  const { data: settings } = useSettings();
  const periodic = settings?.sales_tracking_mode === "periodic";
  const productMap = new Map(products.map((p) => [p.id, p.name]));
  const [openId, setOpenId] = useState<string | null>(null);
  const qc = useQueryClient();
  const { range, setRange } = useDateRange();
  const filteredRows = useMemo(() => rows.filter((r) => inDateRange(r.end_date, range) || inDateRange(r.start_date, range)), [rows, range]);

  const del = async (id: string) => {
    if (!confirm("Delete this sales record?")) return;
    const { error } = await supabase.from("sales_records").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    qc.invalidateQueries({ queryKey: ["sales"] });
    qc.invalidateQueries({ queryKey: ["sales_items"] });
  };

  return (
    <div>
      <PageHeader title="Sales Records" subtitle="Multi-product units sold over a period" dialogTitle="New sales record">
        <MultiItemForm mode="sales" />
      </PageHeader>

      <div className="mb-4 flex justify-end"><DateRangePicker value={range} onChange={setRange} /></div>

      {!periodic && (
        <Card className="p-4 mb-4 border-warning/30 bg-warning/5 text-sm">
          Sales tracking mode is currently <strong>Per Revenue Payout</strong>. These records won't be used in COGS until you switch the mode in Settings.
        </Card>
      )}

      <Card className="overflow-hidden">
        {filteredRows.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">No sales records in this period.</div>
        ) : filteredRows.map((r) => {
          const lines = items.filter((it) => it.sales_record_id === r.id);
          const open = openId === r.id;
          return (
            <div key={r.id} className="border-b last:border-0">
              <div className="flex items-center justify-between p-4 hover:bg-muted/30">
                <button onClick={() => setOpenId(open ? null : r.id)} className="flex items-center gap-3 flex-1 text-left">
                  {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  <div>
                    <div className="font-medium text-sm">{r.start_date} → {r.end_date}</div>
                    <div className="text-xs text-muted-foreground capitalize">{r.period_type} · {lines.length} product{lines.length === 1 ? "" : "s"}</div>
                  </div>
                </button>
                <div className="flex items-center gap-6 text-sm">
                  <div className="tabular-nums font-semibold w-28 text-right">{Number(r.units_sold).toLocaleString()} units</div>
                  <Button size="icon" variant="ghost" onClick={() => del(r.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </div>
              </div>
              {open && (
                <div className="bg-muted/20 px-12 py-3 space-y-1">
                  {lines.map((it) => (
                    <div key={it.id} className="flex justify-between text-sm py-1">
                      <span>{productMap.get(it.product_id) ?? "—"}</span>
                      <span className="tabular-nums font-medium">{Number(it.units_sold)} units</span>
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
