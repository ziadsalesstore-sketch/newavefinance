import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useOpeningBalance, useOpeningBalanceItems, useProducts, fmt } from "@/hooks/useFinance";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Plus, Trash2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

const today = () => new Date().toISOString().slice(0, 10);

type Item = { id?: string; product_id: string; quantity: string; unit_cost: string };

export default function OpeningBalancePage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data: ob } = useOpeningBalance();
  const { data: existingItems = [] } = useOpeningBalanceItems();
  const { data: products = [] } = useProducts();

  const [date, setDate] = useState(today());
  const [cash, setCash] = useState("0");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<Item[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (ob) {
      setDate(ob.date);
      setCash(String(ob.cash_amount));
      setNotes(ob.notes ?? "");
    }
  }, [ob]);

  useEffect(() => {
    if (ob && existingItems.length > 0) {
      setItems(existingItems
        .filter((it) => it.opening_balance_id === ob.id)
        .map((it) => ({ id: it.id, product_id: it.product_id, quantity: String(it.quantity), unit_cost: String(it.unit_cost) }))
      );
    }
  }, [ob, existingItems]);

  const addItem = () => setItems((a) => [...a, { product_id: "", quantity: "", unit_cost: "" }]);
  const updateItem = (i: number, patch: Partial<Item>) => setItems((a) => a.map((it, idx) => idx === i ? { ...it, ...patch } : it));
  const removeItem = (i: number) => setItems((a) => a.filter((_, idx) => idx !== i));

  const totalInventoryValue = items.reduce((a, it) => a + (Number(it.quantity) || 0) * (Number(it.unit_cost) || 0), 0);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setBusy(true);
    try {
      // Upsert opening balance (one per user)
      const obPayload: any = { user_id: user.id, cash_amount: Number(cash) || 0, date, notes: notes || null, updated_at: new Date().toISOString() };
      if (ob?.id) obPayload.id = ob.id;

      const { data: obRow, error: e1 } = await supabase
        .from("opening_balances" as any)
        .upsert(obPayload, { onConflict: "user_id" })
        .select("id")
        .single();
      if (e1) throw e1;

      const obId = (obRow as any).id;

      // Replace items: delete all existing, insert fresh
      const { error: eDel } = await supabase.from("opening_balance_items" as any).delete().eq("opening_balance_id", obId);
      if (eDel) throw eDel;

      const valid = items.filter((it) => it.product_id && Number(it.quantity) > 0);
      if (valid.length > 0) {
        const rows = valid.map((it) => ({
          user_id: user.id,
          opening_balance_id: obId,
          product_id: it.product_id,
          quantity: Number(it.quantity),
          unit_cost: Number(it.unit_cost) || 0,
        }));
        const { error: eIns } = await supabase.from("opening_balance_items" as any).insert(rows);
        if (eIns) throw eIns;
      }

      toast.success("Opening balance saved");
      ["opening_balance", "opening_balance_items", "transactions"].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
    } catch (err: any) {
      toast.error(err.message ?? "Failed to save");
    } finally { setBusy(false); }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold">Opening Balance</h1>
        <p className="text-sm text-muted-foreground">Record your starting cash and initial inventory. These create entries in Transactions labeled "Opening Balance".</p>
      </div>

      <Card className="p-4 border-warning/30 bg-warning/5 flex gap-3 text-sm">
        <AlertTriangle className="h-5 w-5 text-warning shrink-0" />
        <div>This should typically be set once when starting. Editing it later may affect reports.</div>
      </Card>

      <form onSubmit={save} className="space-y-6">
        <Card className="p-6 space-y-4">
          <h3 className="font-semibold">Initial Cash</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Date</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>Starting cash amount</Label>
              <Input type="number" step="0.01" value={cash} onChange={(e) => setCash(e.target.value)} required />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Notes (optional)</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </Card>

        <Card className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Initial Inventory</h3>
            <Button type="button" size="sm" variant="outline" onClick={addItem} disabled={products.length === 0}>
              <Plus className="h-3 w-3 mr-1" />Add item
            </Button>
          </div>
          {products.length === 0 && (
            <p className="text-sm text-muted-foreground">Add products on the <strong>Products</strong> page first.</p>
          )}
          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground">No starting inventory.</p>
          ) : items.map((it, i) => (
            <Card key={i} className="p-3 space-y-2 bg-muted/20">
              <div className="flex gap-2">
                <Select value={it.product_id} onValueChange={(v) => updateItem(i, { product_id: v })}>
                  <SelectTrigger className="flex-1"><SelectValue placeholder="Select product..." /></SelectTrigger>
                  <SelectContent>
                    {products.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Button type="button" size="icon" variant="ghost" onClick={() => removeItem(i)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
              <div className="grid grid-cols-3 gap-2 items-end">
                <div><Label className="text-xs">Quantity</Label><Input type="number" step="any" value={it.quantity} onChange={(e) => updateItem(i, { quantity: e.target.value })} required /></div>
                <div><Label className="text-xs">Cost per unit</Label><Input type="number" step="0.01" value={it.unit_cost} onChange={(e) => updateItem(i, { unit_cost: e.target.value })} required /></div>
                <div className="text-xs text-muted-foreground pb-2">Line total: <span className="font-medium tabular-nums">{fmt((Number(it.quantity) || 0) * (Number(it.unit_cost) || 0))}</span></div>
              </div>
            </Card>
          ))}
          {items.length > 0 && (
            <div className="text-sm flex justify-end pt-1">
              <span>Total inventory value: <span className="font-semibold tabular-nums">{fmt(totalInventoryValue)}</span></span>
            </div>
          )}
        </Card>

        <Button type="submit" disabled={busy}>{busy ? "Saving..." : ob ? "Update Opening Balance" : "Save Opening Balance"}</Button>
      </form>
    </div>
  );
}
