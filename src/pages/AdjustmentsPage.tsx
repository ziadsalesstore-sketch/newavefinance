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
  useInventoryAdjustments,
} from "@/hooks/useFinance";
import { MetricCard } from "@/components/MetricCard";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Plus, Trash2, ArrowDownCircle, ArrowUpCircle, Package } from "lucide-react";
import { toast } from "sonner";

const today = () => new Date().toISOString().slice(0, 10);

type CashAdj = { id: string; date: string; type: "shortage" | "surplus"; amount: number; note: string | null };
type InvAdj = { id: string; date: string; product_id: string; type: "increase" | "decrease"; quantity: number; unit_cost: number; note: string | null };

export default function AdjustmentsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();

  // shared dialog state
  const [open, setOpen] = useState(false);
  const [adjKind, setAdjKind] = useState<"cash" | "inventory">("cash");
  const [busy, setBusy] = useState(false);

  // cash form
  const [cashType, setCashType] = useState<"shortage" | "surplus">("shortage");
  const [cashAmount, setCashAmount] = useState("");
  const [cashDate, setCashDate] = useState(today());
  const [cashNote, setCashNote] = useState("");
  const [actualCash, setActualCash] = useState("");

  // inventory form
  const [invProductId, setInvProductId] = useState("");
  const [invType, setInvType] = useState<"increase" | "decrease">("decrease");
  const [invQty, setInvQty] = useState("");
  const [invDate, setInvDate] = useState(today());
  const [invNote, setInvNote] = useState("");

  const { data: cashRows = [] } = useQuery({
    queryKey: ["cash_adjustments"],
    queryFn: async (): Promise<CashAdj[]> => {
      const { data, error } = await supabase.from("cash_adjustments" as any).select("*").order("date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as CashAdj[];
    },
  });

  const { data: invRows = [] } = useInventoryAdjustments();

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

  const report = useMemo(() => {
    if (!settings) return null;
    return computeReport({
      settings, stock, stockItems, revenue, revenueItems, expenses, sales, salesItems, products,
      generalReceived, openingBalance, openingItems, marketingItems, withdrawals,
      cashAdjustments: cashRows, inventoryAdjustments: invRows,
    });
  }, [settings, stock, stockItems, revenue, revenueItems, expenses, sales, salesItems, products, generalReceived, openingBalance, openingItems, marketingItems, withdrawals, cashRows, invRows]);

  const systemCash = report?.cash ?? 0;

  const cashTotals = useMemo(() => {
    const shortage = cashRows.filter((r) => r.type === "shortage").reduce((a, r) => a + Number(r.amount), 0);
    const surplus = cashRows.filter((r) => r.type === "surplus").reduce((a, r) => a + Number(r.amount), 0);
    return { shortage, surplus };
  }, [cashRows]);

  const invTotals = useMemo(() => {
    const productMap = new Map(report?.breakdown.map((b) => [b.productId, b]) ?? []);
    let lossValue = 0, gainValue = 0;
    invRows.forEach((r) => {
      const cost = Number(r.unit_cost);
      if (r.type === "decrease") lossValue += Number(r.quantity) * cost;
      else gainValue += Number(r.quantity) * cost;
    });
    return { lossValue, gainValue, productMap };
  }, [invRows, report]);

  const productOnHand = (pid: string) => {
    const p = report?.breakdown.find((b) => b.productId === pid);
    if (!p) return 0;
    return p.unitsPurchased - p.unitsSold - (p.unitsUsed ?? 0) + ((p as any).invIncrease ?? 0) - ((p as any).invDecrease ?? 0);
  };

  const productAvgCost = (pid: string) => {
    const p = report?.breakdown.find((b) => b.productId === pid);
    return p?.avgCost ?? 0;
  };

  const diff = actualCash === "" ? null : Number(actualCash) - systemCash;
  const useDifference = () => {
    if (diff === null || diff === 0) return;
    setCashType(diff > 0 ? "surplus" : "shortage");
    setCashAmount(String(Math.abs(diff)));
  };

  const resetForms = () => {
    setCashAmount(""); setCashNote(""); setActualCash(""); setCashDate(today());
    setInvProductId(""); setInvQty(""); setInvNote(""); setInvDate(today()); setInvType("decrease");
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setBusy(true);
    try {
      if (adjKind === "cash") {
        const amt = Number(cashAmount);
        if (!amt || amt <= 0) throw new Error("Enter a valid amount");
        const { error } = await supabase.from("cash_adjustments" as any).insert({
          user_id: user.id, type: cashType, amount: amt, date: cashDate || today(), note: cashNote || null,
        });
        if (error) throw error;
      } else {
        if (!invProductId) throw new Error("Select a product");
        const qty = Number(invQty);
        if (!qty || qty <= 0) throw new Error("Enter a valid quantity");
        const onHand = productOnHand(invProductId);
        if (invType === "decrease" && qty > onHand) {
          throw new Error(`Cannot decrease more than available (${onHand} on hand)`);
        }
        const unitCost = productAvgCost(invProductId);
        const { error } = await supabase.from("inventory_adjustments" as any).insert({
          user_id: user.id, product_id: invProductId, type: invType, quantity: qty,
          unit_cost: unitCost, date: invDate || today(), note: invNote || null,
        });
        if (error) throw error;
      }
      toast.success("Adjustment recorded");
      resetForms();
      setOpen(false);
      ["cash_adjustments", "inventory_adjustments", "transactions"].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
    } catch (err: any) {
      toast.error(err.message ?? "Failed");
    } finally { setBusy(false); }
  };

  const delCash = async (id: string) => {
    if (!confirm("Delete this adjustment?")) return;
    const { error } = await supabase.from("cash_adjustments" as any).delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    ["cash_adjustments", "transactions"].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
  };

  const delInv = async (id: string) => {
    if (!confirm("Delete this adjustment?")) return;
    const { error } = await supabase.from("inventory_adjustments" as any).delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    ["inventory_adjustments", "transactions"].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
  };

  const productName = (pid: string) => products.find((p) => p.id === pid)?.name ?? "Unknown";

  return (
    <div>
      <div className="flex items-start justify-between gap-4 mb-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Adjustments</h1>
          <p className="text-sm text-muted-foreground">Correct cash and inventory differences to keep your books accurate</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-1" />New Adjustment</Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] p-0 gap-0 flex flex-col">
            <DialogHeader className="px-6 pt-6 pb-4 border-b shrink-0"><DialogTitle>New adjustment</DialogTitle></DialogHeader>
            <form onSubmit={submit} className="flex flex-col flex-1 min-h-0">
              <div className="space-y-4 px-6 py-4 overflow-y-auto flex-1 min-h-0">
              <div className="space-y-2">
                <Label>Adjustment type</Label>
                <Select value={adjKind} onValueChange={(v) => setAdjKind(v as any)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Cash Adjustment</SelectItem>
                    <SelectItem value="inventory">Inventory Adjustment</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {adjKind === "cash" ? (
                <>
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
                    <Label>Cash adjustment type</Label>
                    <Select value={cashType} onValueChange={(v) => setCashType(v as any)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="shortage">Cash Shortage (money missing)</SelectItem>
                        <SelectItem value="surplus">Cash Surplus (extra money found)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="amount">Amount</Label>
                    <Input id="amount" type="number" step="0.01" value={cashAmount} onChange={(e) => setCashAmount(e.target.value)} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cdate">Date</Label>
                    <Input id="cdate" type="date" value={cashDate} onChange={(e) => setCashDate(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cnote">Note (optional)</Label>
                    <Textarea id="cnote" value={cashNote} onChange={(e) => setCashNote(e.target.value)} placeholder="e.g. End of month reconciliation" />
                  </div>
                </>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label>Product</Label>
                    <Select value={invProductId} onValueChange={setInvProductId}>
                      <SelectTrigger><SelectValue placeholder="Select product" /></SelectTrigger>
                      <SelectContent>
                        {products.map((p) => (
                          <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {invProductId && (
                      <div className="text-xs text-muted-foreground">
                        On hand: <span className="font-semibold tabular-nums">{productOnHand(invProductId)}</span> · Cost/unit: <span className="font-semibold tabular-nums">{fmt(productAvgCost(invProductId))}</span>
                      </div>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label>Inventory adjustment type</Label>
                    <Select value={invType} onValueChange={(v) => setInvType(v as any)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="decrease">Decrease (lost / damaged / missing)</SelectItem>
                        <SelectItem value="increase">Increase (extra stock / correction)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="qty">Quantity</Label>
                    <Input id="qty" type="number" step="1" min="1" value={invQty} onChange={(e) => setInvQty(e.target.value)} required />
                    {invProductId && invQty && (
                      <div className="text-xs text-muted-foreground">
                        Value: <span className="font-semibold tabular-nums">{fmt(Number(invQty) * productAvgCost(invProductId))}</span>
                      </div>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="idate">Date</Label>
                    <Input id="idate" type="date" value={invDate} onChange={(e) => setInvDate(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="inote">Note (optional)</Label>
                    <Textarea id="inote" value={invNote} onChange={(e) => setInvNote(e.target.value)} placeholder="e.g. Damaged during shipping" />
                  </div>
                </>
              )}

                <div className="rounded-md bg-muted/40 border px-3 py-2 text-xs text-muted-foreground">
                  Adjustments are used to correct differences, not to record normal transactions.
                </div>
              </div>

              <div className="px-6 py-4 border-t shrink-0 bg-background">
                <Button type="submit" className="w-full" disabled={busy}>{busy ? "Saving..." : "Save"}</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 grid-cols-2 sm:grid-cols-4 mb-4">
        <MetricCard label="System Cash Balance" value={fmt(systemCash)} />
        <MetricCard label="Cash Shortages" value={fmt(cashTotals.shortage)} />
        <MetricCard label="Cash Surpluses" value={fmt(cashTotals.surplus)} />
        <MetricCard label="Net Inventory Loss" value={fmt(invTotals.lossValue - invTotals.gainValue)} />
      </div>

      <Tabs defaultValue="cash">
        <TabsList>
          <TabsTrigger value="cash">Cash</TabsTrigger>
          <TabsTrigger value="inventory">Inventory</TabsTrigger>
        </TabsList>

        <TabsContent value="cash">
          <Card className="overflow-hidden">
            {cashRows.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">No cash adjustments yet.</div>
            ) : cashRows.map((r) => {
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
                    <Button size="icon" variant="ghost" onClick={() => delCash(r.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </div>
                </div>
              );
            })}
          </Card>
        </TabsContent>

        <TabsContent value="inventory">
          <Card className="overflow-hidden">
            {invRows.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">No inventory adjustments yet.</div>
            ) : invRows.map((r) => {
              const isDec = r.type === "decrease";
              const value = Number(r.quantity) * Number(r.unit_cost);
              return (
                <div key={r.id} className="flex items-center justify-between p-4 border-b last:border-0 hover:bg-muted/30">
                  <div className="flex items-center gap-3">
                    <Package className={`h-5 w-5 ${isDec ? "text-destructive" : "text-emerald-600"}`} />
                    <div>
                      <div className="font-medium text-sm">
                        {isDec ? "Inventory Decrease" : "Inventory Increase"} · {productName(r.product_id)} × {Number(r.quantity)} · {r.date}
                      </div>
                      {r.note && <div className="text-xs text-muted-foreground">{r.note}</div>}
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className={`tabular-nums font-semibold ${isDec ? "text-destructive" : "text-emerald-600"}`}>
                      {isDec ? "-" : "+"}{fmt(value)}
                    </div>
                    <Button size="icon" variant="ghost" onClick={() => delInv(r.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </div>
                </div>
              );
            })}
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
