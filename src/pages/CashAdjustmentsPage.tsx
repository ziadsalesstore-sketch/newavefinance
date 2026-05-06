import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  fmt,
  computeReport,
  useSettings,
  useStockPurchases,
  useStockPurchaseItems,
  useRevenuePayouts,
  useRevenueItems,
  useExpenses,
  useSalesRecords,
  useSalesItems,
  useProducts,
  useGeneralReceivedPayments,
  useOpeningBalance,
  useOpeningBalanceItems,
  useMarketingCampaignItems,
  usePersonalWithdrawals,
} from "@/hooks/useFinance";
import { MetricCard } from "@/components/MetricCard";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Trash2, ArrowDownCircle, ArrowUpCircle } from "lucide-react";
import { toast } from "sonner";

const today = () => new Date().toISOString().slice(0, 10);

type Adj = { id: string; date: string; type: "shortage" | "surplus"; amount: number; note: string | null };

export default function CashAdjustmentsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<"shortage" | "surplus">("shortage");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(today());
  const [note, setNote] = useState("");
  const [actualCash, setActualCash] = useState("");
  const [busy, setBusy] = useState(false);

  const { data: rows = [] } = useQuery({
    queryKey: ["cash_adjustments"],
    queryFn: async (): Promise<Adj[]> => {
      const { data, error } = await supabase.from("cash_adjustments" as any).select("*").order("date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Adj[];
    },
  });

  const { data: settings } = useSettings();
  const { data: stock = [] } = useStockPurchases();
  const { data: stockItems = [] } = useStockPurchaseItems();
  const { data: revenue = [] } = useRevenuePayouts();
  const { data: revenueItems = [] } = useRevenueItems();
  const { data: expenses = [] } = useExpenses();
  const { data: sales = [] } = useSalesRecords();
  const { data: salesItems = [] } = useSalesItems();
  const { data: products = [] } = useProducts();
  const { data: generalReceived = [] } = useGeneralReceivedPayments();
  const { data: openingBalance = null } = useOpeningBalance();
  const { data: openingItems = [] } = useOpeningBalanceItems();
  const { data: marketingItems = [] } = useMarketingCampaignItems();
  const { data: withdrawals = [] } = usePersonalWithdrawals();

  const adjustmentsNet = useMemo(
    () => rows.reduce((a, r) => a + (r.type === "surplus" ? Number(r.amount) : -Number(r.amount)), 0),
    [rows]
  );

  const systemCash = useMemo(() => {
    if (!settings) return 0;
    const r = computeReport({
      settings, stock, stockItems, revenue, revenueItems, expenses, sales, salesItems, products,
      generalReceived, openingBalance, openingItems, marketingItems, withdrawals,
      cashAdjustments: rows,
    });
    return r.cash;
  }, [settings, stock, stockItems, revenue, revenueItems, expenses, sales, salesItems, products, generalReceived, openingBalance, openingItems, marketingItems, withdrawals, rows]);

  const totals = useMemo(() => {
    const shortage = rows.filter((r) => r.type === "shortage").reduce((a, r) => a + Number(r.amount), 0);
    const surplus = rows.filter((r) => r.type === "surplus").reduce((a, r) => a + Number(r.amount), 0);
    return { shortage, surplus };
  }, [rows]);

  const diff = actualCash === "" ? null : Number(actualCash) - systemCash;

  const useDifference = () => {
    if (diff === null || diff === 0) return;
    setType(diff > 0 ? "surplus" : "shortage");
    setAmount(String(Math.abs(diff)));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const amt = Number(amount);
    if (!amt || amt <= 0) return toast.error("Enter a valid amount");
    setBusy(true);
    try {
      const { error } = await supabase.from("cash_adjustments" as any).insert({
        user_id: user.id, type, amount: amt, date: date || today(), note: note || null,
      });
      if (error) throw error;
      toast.success("Adjustment recorded");
      setAmount(""); setNote(""); setActualCash(""); setDate(today()); setOpen(false);
      ["cash_adjustments", "transactions"].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
    } catch (err: any) {
      toast.error(err.message ?? "Failed");
    } finally { setBusy(false); }
  };

  const del = async (id: string) => {
    if (!confirm("Delete this adjustment?")) return;
    const { error } = await supabase.from("cash_adjustments" as any).delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    ["cash_adjustments", "transactions"].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
  };

  return (
    <div>
      <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Cash Adjustments</h1>
          <p className="text-sm text-muted-foreground">Record cash shortages or surpluses to keep your books accurate</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-1" />New Adjustment</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New cash adjustment</DialogTitle></DialogHeader>
            <form onSubmit={submit} className="space-y-4">
              <div className="rounded-lg border bg-muted/30 p-3 space-y-3">
                <div className="text-xs font-medium text-muted-foreground">Reconciliation helper</div>
                <div className="flex items-center justify-between text-sm">
                  <span>System cash balance</span>
                  <span className="tabular-nums font-semibold">{fmt(systemCash)}</span>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="actual">Actual cash on hand</Label>
                  <Input id="actual" type="number" step="0.01" value={actualCash} onChange={(e) => setActualCash(e.target.value)} placeholder="Enter counted cash" />
                </div>
                {diff !== null && (
                  <div className="flex items-center justify-between text-sm">
                    <span>Difference (Actual − System)</span>
                    <span className={`tabular-nums font-semibold ${diff < 0 ? "text-destructive" : diff > 0 ? "text-emerald-600" : ""}`}>{fmt(diff)}</span>
                  </div>
                )}
                {diff !== null && diff !== 0 && (
                  <Button type="button" variant="secondary" size="sm" className="w-full" onClick={useDifference}>
                    Use this difference
                  </Button>
                )}
              </div>

              <div className="space-y-2">
                <Label>Adjustment type</Label>
                <Select value={type} onValueChange={(v) => setType(v as any)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="shortage">Cash Shortage (money missing)</SelectItem>
                    <SelectItem value="surplus">Cash Surplus (extra money found)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="amount">Amount</Label>
                <Input id="amount" type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="date">Date</Label>
                <Input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="note">Note (optional)</Label>
                <Textarea id="note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. End of month reconciliation" />
              </div>
              <Button type="submit" className="w-full" disabled={busy}>{busy ? "Saving..." : "Save"}</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-3 mb-4">
        <MetricCard label="System Cash Balance" value={fmt(systemCash)} />
        <MetricCard label="Total Shortages" value={fmt(totals.shortage)} />
        <MetricCard label="Total Surpluses" value={fmt(totals.surplus)} />
      </div>

      <Card className="overflow-hidden">
        {rows.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">No cash adjustments yet.</div>
        ) : rows.map((r) => {
          const isShort = r.type === "shortage";
          return (
            <div key={r.id} className="flex items-center justify-between p-4 border-b last:border-0 hover:bg-muted/30">
              <div className="flex items-center gap-3">
                {isShort ? <ArrowDownCircle className="h-5 w-5 text-destructive" /> : <ArrowUpCircle className="h-5 w-5 text-emerald-600" />}
                <div>
                  <div className="font-medium text-sm">{isShort ? "Cash Shortage" : "Cash Surplus"} · {r.date}</div>
                  {r.note && <div className="text-xs text-muted-foreground">{r.note}</div>}
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className={`tabular-nums font-semibold ${isShort ? "text-destructive" : "text-emerald-600"}`}>
                  {isShort ? "-" : "+"}{fmt(Number(r.amount))}
                </div>
                <Button size="icon" variant="ghost" onClick={() => del(r.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
              </div>
            </div>
          );
        })}
      </Card>
    </div>
  );
}
