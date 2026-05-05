import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useRevenuePayouts, useRevenueItems, useSettings, useProducts, fmt } from "@/hooks/useFinance";
import { PageHeader } from "@/components/PageHeader";
import { MultiItemForm } from "@/components/MultiItemForm";
import { MetricCard } from "@/components/MetricCard";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronRight, Trash2 } from "lucide-react";
import { toast } from "sonner";

export default function RevenuePage() {
  const { data: rows = [] } = useRevenuePayouts();
  const { data: items = [] } = useRevenueItems();
  const { data: products = [] } = useProducts();
  const { data: settings } = useSettings();
  const showUnits = settings?.sales_tracking_mode === "per_payout";
  const productMap = new Map(products.map((p) => [p.id, p.name]));
  const [openId, setOpenId] = useState<string | null>(null);
  const qc = useQueryClient();

  const totals = useMemo(() => {
    const earned = rows.reduce((a, r) => a + Number(r.earned_amount), 0);
    const received = rows.reduce((a, r) => a + Number(r.received_amount), 0);
    return { earned, received, wallet: earned - received };
  }, [rows]);

  const del = async (id: string) => {
    if (!confirm("Delete this payout?")) return;
    const { error } = await supabase.from("revenue_payouts").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    qc.invalidateQueries({ queryKey: ["revenue"] });
    qc.invalidateQueries({ queryKey: ["revenue_items"] });
    qc.invalidateQueries({ queryKey: ["transactions"] });
  };

  return (
    <div>
      <PageHeader title="Revenue Payouts" subtitle={`Sales tracking: ${showUnits ? "Per Payout (multi-product)" : "Periodic Records"}`} dialogTitle="New revenue payout">
        <MultiItemForm mode="payout" />
      </PageHeader>

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-3 mb-4">
        <MetricCard label="Total Earned" value={fmt(totals.earned)} />
        <MetricCard label="Total Received" value={fmt(totals.received)} />
        <MetricCard label="Shipping Wallet Balance" value={fmt(totals.wallet)} hint="Held by shipping company" />
      </div>

      <Card className="overflow-hidden">
        {rows.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">No payouts yet.</div>
        ) : rows.map((r) => {
          const lines = items.filter((it) => it.revenue_payout_id === r.id);
          const open = openId === r.id;
          const wallet = Number(r.earned_amount) - Number(r.received_amount);
          return (
            <div key={r.id} className="border-b last:border-0">
              <div className="flex items-center justify-between p-4 hover:bg-muted/30">
                <button onClick={() => setOpenId(open ? null : r.id)} className="flex items-center gap-3 flex-1 text-left">
                  {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  <div>
                    <div className="font-medium text-sm">{r.date}</div>
                    <div className="text-xs text-muted-foreground capitalize">{r.status}{showUnits && lines.length > 0 ? ` · ${lines.length} product${lines.length === 1 ? "" : "s"}` : ""}</div>
                  </div>
                </button>
                <div className="flex items-center gap-6 text-sm">
                  <div className="tabular-nums">Earned: <span className="font-semibold">{fmt(Number(r.earned_amount))}</span></div>
                  <div className="tabular-nums">Received: <span className="font-semibold">{fmt(Number(r.received_amount))}</span></div>
                  <div className={`tabular-nums w-28 text-right ${wallet === 0 ? "" : wallet > 0 ? "text-warning" : "text-success"}`}>{fmt(wallet)}</div>
                  <Button size="icon" variant="ghost" onClick={() => del(r.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </div>
              </div>
              {open && (
                <div className="bg-muted/20 px-12 py-3 space-y-1">
                  {showUnits && lines.length > 0 ? lines.map((it) => (
                    <div key={it.id} className="flex justify-between text-sm py-1">
                      <span>{productMap.get(it.product_id) ?? "—"}</span>
                      <span className="tabular-nums font-medium">{Number(it.units_sold)} units</span>
                    </div>
                  )) : <div className="text-xs text-muted-foreground">No product breakdown.</div>}
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
