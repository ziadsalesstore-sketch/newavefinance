import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useRevenuePayouts, useRevenueItems, useRevenuePayments, useSettings, useProducts, fmt } from "@/hooks/useFinance";
import { PageHeader } from "@/components/PageHeader";
import { MultiItemForm } from "@/components/MultiItemForm";
import { MetricCard } from "@/components/MetricCard";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ChevronDown, ChevronRight, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

const today = () => new Date().toISOString().slice(0, 10);

function AddPaymentDialog({ payoutId, pending }: { payoutId: string; pending: number }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(today());
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const amt = Number(amount);
    if (!amt || amt <= 0) return toast.error("Enter a valid amount");
    setBusy(true);
    const { error } = await supabase.from("revenue_payments" as any).insert({
      user_id: user.id, revenue_payout_id: payoutId, amount: amt, date, note: note || null,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Payment added");
    setOpen(false);
    setAmount(""); setNote(""); setDate(today());
    qc.invalidateQueries({ queryKey: ["revenue"] });
    qc.invalidateQueries({ queryKey: ["revenue_payments"] });
    qc.invalidateQueries({ queryKey: ["transactions"] });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline"><Plus className="h-3 w-3" />Add Payment</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Add payment</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="text-xs text-muted-foreground">Pending: <span className="font-medium tabular-nums">{fmt(pending)}</span></div>
          <div className="space-y-2"><Label>Amount</Label><Input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required autoFocus /></div>
          <div className="space-y-2"><Label>Date</Label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required /></div>
          <div className="space-y-2"><Label>Note (optional)</Label><Input value={note} onChange={(e) => setNote(e.target.value)} /></div>
          <Button type="submit" className="w-full" disabled={busy}>{busy ? "Saving..." : "Add payment"}</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function RevenuePage() {
  const { data: rows = [] } = useRevenuePayouts();
  const { data: items = [] } = useRevenueItems();
  const { data: payments = [] } = useRevenuePayments();
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
    if (!confirm("Delete this payout? All linked payments will also be removed.")) return;
    const { error } = await supabase.from("revenue_payouts").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    qc.invalidateQueries({ queryKey: ["revenue"] });
    qc.invalidateQueries({ queryKey: ["revenue_items"] });
    qc.invalidateQueries({ queryKey: ["revenue_payments"] });
    qc.invalidateQueries({ queryKey: ["transactions"] });
  };

  const delPayment = async (id: string) => {
    if (!confirm("Delete this payment?")) return;
    const { error } = await supabase.from("revenue_payments" as any).delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Payment removed");
    qc.invalidateQueries({ queryKey: ["revenue"] });
    qc.invalidateQueries({ queryKey: ["revenue_payments"] });
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
        <MetricCard label="Pending (Wallet)" value={fmt(totals.wallet)} hint="Earned − Received" />
      </div>

      <Card className="overflow-hidden">
        {rows.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">No payouts yet.</div>
        ) : rows.map((r) => {
          const lines = items.filter((it) => it.revenue_payout_id === r.id);
          const pays = payments.filter((p) => p.revenue_payout_id === r.id);
          const open = openId === r.id;
          const pending = Number(r.earned_amount) - Number(r.received_amount);
          return (
            <div key={r.id} className="border-b last:border-0">
              <div className="flex items-center justify-between p-4 hover:bg-muted/30">
                <button onClick={() => setOpenId(open ? null : r.id)} className="flex items-center gap-3 flex-1 text-left">
                  {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  <div>
                    <div className="font-medium text-sm">{r.date}</div>
                    <div className="text-xs text-muted-foreground">
                      {pays.length} payment{pays.length === 1 ? "" : "s"}
                      {showUnits && lines.length > 0 ? ` · ${lines.length} product${lines.length === 1 ? "" : "s"}` : ""}
                    </div>
                  </div>
                </button>
                <div className="flex items-center gap-6 text-sm">
                  <div className="tabular-nums">Earned: <span className="font-semibold">{fmt(Number(r.earned_amount))}</span></div>
                  <div className="tabular-nums">Received: <span className="font-semibold">{fmt(Number(r.received_amount))}</span></div>
                  <div className={`tabular-nums w-28 text-right ${pending === 0 ? "" : pending > 0 ? "text-warning" : "text-success"}`}>
                    Pending: {fmt(pending)}
                  </div>
                  <Button size="icon" variant="ghost" onClick={() => del(r.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </div>
              </div>
              {open && (
                <div className="bg-muted/20 px-12 py-4 space-y-4">
                  {showUnits && lines.length > 0 && (
                    <div>
                      <div className="text-xs font-medium text-muted-foreground mb-1">Products</div>
                      {lines.map((it) => (
                        <div key={it.id} className="flex justify-between text-sm py-1">
                          <span>{productMap.get(it.product_id) ?? "—"}</span>
                          <span className="tabular-nums font-medium">{Number(it.units_sold)} units</span>
                        </div>
                      ))}
                    </div>
                  )}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-xs font-medium text-muted-foreground">Payments</div>
                      <AddPaymentDialog payoutId={r.id} pending={pending} />
                    </div>
                    {pays.length === 0 ? (
                      <div className="text-xs text-muted-foreground">No payments recorded yet.</div>
                    ) : (
                      <div className="space-y-1">
                        {pays.map((p) => (
                          <div key={p.id} className="flex items-center justify-between text-sm py-1 border-b last:border-0">
                            <div className="flex gap-3">
                              <span className="text-muted-foreground tabular-nums">{p.date}</span>
                              {p.note && <span className="text-muted-foreground">{p.note}</span>}
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="tabular-nums font-medium text-success">+{fmt(Number(p.amount))}</span>
                              <Button size="icon" variant="ghost" onClick={() => delPayment(p.id)}>
                                <Trash2 className="h-3.5 w-3.5 text-destructive" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  {r.notes && <div className="text-xs text-muted-foreground">{r.notes}</div>}
                </div>
              )}
            </div>
          );
        })}
      </Card>
    </div>
  );
}
