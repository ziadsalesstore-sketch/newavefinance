import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useRevenuePayouts, useRevenueItems, useSettings, useProducts, useGeneralReceivedPayments, fmt } from "@/hooks/useFinance";
import { MultiItemForm } from "@/components/MultiItemForm";
import { RecordReceivedPaymentForm } from "@/components/RecordReceivedPaymentForm";
import { MetricCard } from "@/components/MetricCard";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ChevronDown, ChevronRight, Plus, Trash2, Banknote } from "lucide-react";
import { DateRangePicker, useDateRange, inDateRange } from "@/components/DateRangePicker";
import { toast } from "sonner";

export default function RevenuePage() {
  const { data: rows = [] } = useRevenuePayouts();
  const { data: items = [] } = useRevenueItems();
  const { data: products = [] } = useProducts();
  const { data: settings } = useSettings();
  const { data: generalReceived = [] } = useGeneralReceivedPayments();
  const showUnits = settings?.sales_tracking_mode === "per_payout";
  const productMap = new Map(products.map((p) => [p.id, p.name]));
  const [openId, setOpenId] = useState<string | null>(null);
  const [payoutOpen, setPayoutOpen] = useState(false);
  const [receivedOpen, setReceivedOpen] = useState(false);
  const qc = useQueryClient();

  const { range, setRange } = useDateRange();
  const filteredRows = useMemo(() => rows.filter((r) => inDateRange(r.date, range)), [rows, range]);
  const filteredGeneral = useMemo(() => generalReceived.filter((g) => inDateRange(g.date, range)), [generalReceived, range]);

  const totals = useMemo(() => {
    const earned = filteredRows.reduce((a, r) => a + Number(r.earned_amount), 0);
    const linkedReceived = filteredRows.reduce((a, r) => a + Number(r.received_amount), 0);
    const generalTotal = filteredGeneral.reduce((a, g) => a + Number(g.amount), 0);
    const received = linkedReceived + generalTotal;
    return { earned, received, wallet: earned - received };
  }, [filteredRows, filteredGeneral]);

  const del = async (id: string) => {
    if (!confirm("Delete this payout?")) return;
    const { error } = await supabase.from("revenue_payouts").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    ["revenue", "revenue_items", "transactions"].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
  };

  const delGeneral = async (id: string) => {
    if (!confirm("Delete this received payment?")) return;
    const { error } = await supabase.from("general_received_payments" as any).delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    ["general_received", "transactions"].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
  };

  return (
    <div>
      <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Revenue Payouts</h1>
          <p className="text-sm text-muted-foreground">Sales tracking: {showUnits ? "Per Payout (multi-product)" : "Periodic Records"}</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={receivedOpen} onOpenChange={setReceivedOpen}>
            <DialogTrigger asChild>
              <Button variant="outline"><Banknote className="h-4 w-4 mr-1" />Record Received Payment</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Record received payment</DialogTitle></DialogHeader>
              <RecordReceivedPaymentForm onDone={() => setReceivedOpen(false)} />
            </DialogContent>
          </Dialog>
          <Dialog open={payoutOpen} onOpenChange={setPayoutOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-1" />Add</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>New revenue payout</DialogTitle></DialogHeader>
              <MultiItemForm mode="payout" />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-3 mb-4">
        <MetricCard label="Total Earned" value={fmt(totals.earned)} />
        <MetricCard label="Total Received" value={fmt(totals.received)} hint="Includes standalone received payments" />
        <MetricCard label="Shipping Wallet Balance" value={fmt(totals.wallet)} hint="Held by shipping company" />
      </div>

      <Card className="overflow-hidden mb-6">
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

      <div>
        <h2 className="text-lg font-semibold mb-2">Standalone Received Payments</h2>
        <p className="text-xs text-muted-foreground mb-3">Payments received later (e.g. courier payouts). These reduce pending balance without creating new revenue.</p>
        <Card className="overflow-hidden">
          {generalReceived.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">No standalone payments yet.</div>
          ) : generalReceived.map((g) => (
            <div key={g.id} className="flex items-center justify-between p-4 border-b last:border-0 hover:bg-muted/30">
              <div>
                <div className="font-medium text-sm">{g.date}</div>
                {g.note && <div className="text-xs text-muted-foreground">{g.note}</div>}
              </div>
              <div className="flex items-center gap-4">
                <div className="tabular-nums font-semibold text-success">{fmt(Number(g.amount))}</div>
                <Button size="icon" variant="ghost" onClick={() => delGeneral(g.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
              </div>
            </div>
          ))}
        </Card>
      </div>
    </div>
  );
}
