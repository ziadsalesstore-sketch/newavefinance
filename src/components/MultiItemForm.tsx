import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useProducts, useSettings } from "@/hooks/useFinance";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

type Mode = "stock" | "sales" | "payout";

type Item = { product_id: string; quantity?: string; total_cost?: string; units_sold?: string };

const today = () => new Date().toISOString().slice(0, 10);
const fmt = (n: number) => isFinite(n) ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n) : "—";

export function MultiItemForm({ mode, onDone }: { mode: Mode; onDone?: () => void }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data: products = [] } = useProducts();
  const { data: settings } = useSettings();
  const periodicMode = settings?.sales_tracking_mode === "periodic";
  const hideUnitsOnPayout = mode === "payout" && periodicMode;

  // Parent-level fields
  const [date, setDate] = useState(today());
  const [startDate, setStartDate] = useState(today());
  const [endDate, setEndDate] = useState(today());
  const [periodType, setPeriodType] = useState("monthly");
  const [earned, setEarned] = useState("");
  const [received, setReceived] = useState("");
  const [status, setStatus] = useState("received");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<Item[]>([{ product_id: "" }]);
  const [busy, setBusy] = useState(false);

  const updateItem = (i: number, patch: Partial<Item>) =>
    setItems((arr) => arr.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
  const addItem = () => setItems((arr) => [...arr, { product_id: "" }]);
  const removeItem = (i: number) => setItems((arr) => arr.filter((_, idx) => idx !== i));

  const totalCost = items.reduce((a, it) => a + (Number(it.total_cost) || 0), 0);
  const totalUnits = items.reduce((a, it) => a + (Number(it.units_sold) || Number(it.quantity) || 0), 0);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (products.length === 0) return toast.error("Add a product first");
    const valid = items.filter((it) => it.product_id);
    if (valid.length === 0) return toast.error("Add at least one product line");

    setBusy(true);
    try {
      if (mode === "stock") {
        const { data, error } = await supabase.from("stock_purchases").insert({ user_id: user.id, date, notes: notes || null, total_cost: 0, quantity: 0, product_name: null as any }).select("id").single();
        if (error) throw error;
        const rows = valid.map((it) => ({ user_id: user.id, stock_purchase_id: data.id, product_id: it.product_id, quantity: Number(it.quantity) || 0, total_cost: Number(it.total_cost) || 0 }));
        const { error: e2 } = await supabase.from("stock_purchase_items").insert(rows);
        if (e2) throw e2;
        qc.invalidateQueries({ queryKey: ["stock"] });
        qc.invalidateQueries({ queryKey: ["stock_items"] });
        qc.invalidateQueries({ queryKey: ["transactions"] });
      } else if (mode === "sales") {
        const totalU = valid.reduce((a, it) => a + (Number(it.units_sold) || 0), 0);
        const { data, error } = await supabase.from("sales_records").insert({ user_id: user.id, start_date: startDate, end_date: endDate, period_type: periodType, units_sold: totalU, notes: notes || null }).select("id").single();
        if (error) throw error;
        const rows = valid.map((it) => ({ user_id: user.id, sales_record_id: data.id, product_id: it.product_id, units_sold: Number(it.units_sold) || 0 }));
        const { error: e2 } = await supabase.from("sales_items").insert(rows);
        if (e2) throw e2;
        qc.invalidateQueries({ queryKey: ["sales"] });
        qc.invalidateQueries({ queryKey: ["sales_items"] });
      } else {
        const totalU = valid.reduce((a, it) => a + (Number(it.units_sold) || 0), 0);
        const { data, error } = await supabase.from("revenue_payouts").insert({ user_id: user.id, date, earned_amount: Number(earned) || 0, received_amount: Number(received) || 0, status, units_sold: totalU || null, notes: notes || null }).select("id").single();
        if (error) throw error;
        const rows = valid.map((it) => ({ user_id: user.id, revenue_payout_id: data.id, product_id: it.product_id, units_sold: Number(it.units_sold) || 0 }));
        const { error: e2 } = await supabase.from("revenue_payout_items").insert(rows);
        if (e2) throw e2;
        qc.invalidateQueries({ queryKey: ["revenue"] });
        qc.invalidateQueries({ queryKey: ["revenue_items"] });
        qc.invalidateQueries({ queryKey: ["transactions"] });
      }
      toast.success("Saved");
      onDone?.();
    } catch (err: any) {
      toast.error(err.message ?? "Failed");
    } finally { setBusy(false); }
  };

  return (
    <form onSubmit={submit} className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
      {mode !== "sales" ? (
        <div className="space-y-2"><Label>Date</Label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required /></div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2"><Label>Start date</Label><Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required /></div>
          <div className="space-y-2"><Label>End date</Label><Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} required /></div>
          <div className="space-y-2 col-span-2">
            <Label>Period type</Label>
            <Select value={periodType} onValueChange={setPeriodType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">Daily</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="biweekly">Biweekly</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      {mode === "payout" && (
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2"><Label>Earned amount</Label><Input type="number" step="0.01" value={earned} onChange={(e) => setEarned(e.target.value)} required /></div>
          <div className="space-y-2"><Label>Received amount</Label><Input type="number" step="0.01" value={received} onChange={(e) => setReceived(e.target.value)} required /></div>
          <div className="space-y-2 col-span-2">
            <Label>Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="received">Received</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Products</Label>
          <Button type="button" size="sm" variant="outline" onClick={addItem}><Plus className="h-3 w-3 mr-1" />Add product</Button>
        </div>
        {items.map((it, i) => (
          <Card key={i} className="p-3 space-y-2">
            <div className="flex gap-2">
              <Select value={it.product_id} onValueChange={(v) => updateItem(i, { product_id: v })}>
                <SelectTrigger className="flex-1"><SelectValue placeholder="Select product..." /></SelectTrigger>
                <SelectContent>
                  {products.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
              {items.length > 1 && (
                <Button type="button" size="icon" variant="ghost" onClick={() => removeItem(i)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              )}
            </div>
            {mode === "stock" ? (
              <div className="grid grid-cols-3 gap-2 items-end">
                <div><Label className="text-xs">Quantity</Label><Input type="number" step="any" value={it.quantity ?? ""} onChange={(e) => updateItem(i, { quantity: e.target.value })} required /></div>
                <div><Label className="text-xs">Total cost</Label><Input type="number" step="0.01" value={it.total_cost ?? ""} onChange={(e) => updateItem(i, { total_cost: e.target.value })} required /></div>
                <div className="text-xs text-muted-foreground pb-2">Cost/unit: <span className="font-medium tabular-nums">{Number(it.quantity) > 0 ? fmt(Number(it.total_cost) / Number(it.quantity)) : "—"}</span></div>
              </div>
            ) : (
              <div><Label className="text-xs">Units sold</Label><Input type="number" step="any" value={it.units_sold ?? ""} onChange={(e) => updateItem(i, { units_sold: e.target.value })} required /></div>
            )}
          </Card>
        ))}
        <div className="text-sm text-muted-foreground flex justify-between pt-1">
          {mode === "stock" ? <><span>Total quantity: <span className="tabular-nums">{totalUnits}</span></span><span>Total cost: <span className="font-semibold tabular-nums text-foreground">{fmt(totalCost)}</span></span></> : <span>Total units: <span className="font-semibold tabular-nums text-foreground">{totalUnits}</span></span>}
        </div>
      </div>

      <div className="space-y-2"><Label>Notes</Label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
      <Button type="submit" className="w-full" disabled={busy}>{busy ? "Saving..." : "Save"}</Button>
    </form>
  );
}
