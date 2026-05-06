import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useMarketingCampaigns, useMarketingCampaignItems, useProducts, useStockPurchaseItems, useOpeningBalanceItems, useRevenueItems, useSalesItems, useSettings, fmt } from "@/hooks/useFinance";
import { PageHeader } from "@/components/PageHeader";
import { DataTable } from "@/components/DataTable";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

const today = () => new Date().toISOString().slice(0, 10);
type Line = { product_id: string; quantity: string };

const INVALIDATE = ["marketing_campaigns", "marketing_campaign_items", "expenses", "transactions"];

function CampaignForm({ onDone }: { onDone?: () => void }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data: products = [] } = useProducts();
  const { data: stockItems = [] } = useStockPurchaseItems();
  const { data: openingItems = [] } = useOpeningBalanceItems();
  const { data: revenueItems = [] } = useRevenueItems();
  const { data: salesItems = [] } = useSalesItems();
  const { data: campaignItems = [] } = useMarketingCampaignItems();
  const { data: settings } = useSettings();

  const [date, setDate] = useState(today());
  const [extraCost, setExtraCost] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<Line[]>([{ product_id: "", quantity: "" }]);
  const [busy, setBusy] = useState(false);

  // Per-product avg cost & inventory left
  const stats = useMemo(() => {
    const m = new Map<string, { avg: number; left: number }>();
    const ensure = (pid: string) => { if (!m.has(pid)) m.set(pid, { avg: 0, left: 0 }); return m.get(pid)!; };
    const totals = new Map<string, { units: number; cost: number }>();
    const tot = (pid: string) => { if (!totals.has(pid)) totals.set(pid, { units: 0, cost: 0 }); return totals.get(pid)!; };
    openingItems.forEach((it) => { const t = tot(it.product_id); t.units += Number(it.quantity); t.cost += Number(it.quantity) * Number(it.unit_cost); });
    stockItems.forEach((it) => { const t = tot(it.product_id); t.units += Number(it.quantity); t.cost += Number(it.total_cost); });
    totals.forEach((t, pid) => { const r = ensure(pid); r.avg = t.units > 0 ? t.cost / t.units : 0; r.left = t.units; });
    const periodic = settings?.sales_tracking_mode === "periodic";
    const sold = periodic ? salesItems : revenueItems;
    sold.forEach((it: any) => { ensure(it.product_id).left -= Number(it.units_sold); });
    campaignItems.forEach((it) => { ensure(it.product_id).left -= Number(it.quantity); });
    return m;
  }, [openingItems, stockItems, revenueItems, salesItems, campaignItems, settings]);

  const updateLine = (i: number, patch: Partial<Line>) => setLines((a) => a.map((l, idx) => idx === i ? { ...l, ...patch } : l));
  const addLine = () => setLines((a) => [...a, { product_id: "", quantity: "" }]);
  const removeLine = (i: number) => setLines((a) => a.filter((_, idx) => idx !== i));

  const inventoryCost = lines.reduce((a, l) => a + (Number(l.quantity) || 0) * (stats.get(l.product_id)?.avg ?? 0), 0);
  const cashCost = Number(extraCost) || 0;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const valid = lines.filter((l) => l.product_id && Number(l.quantity) > 0);
    if (valid.length === 0) { toast.error("Add at least one product"); return; }
    setBusy(true);
    try {
      const { data: c, error: e1 } = await supabase.from("marketing_campaigns" as any)
        .insert({ user_id: user.id, date, extra_cost: cashCost, notes: notes || null })
        .select("id").single();
      if (e1) throw e1;
      const cid = (c as any).id;

      const rows = valid.map((l) => ({
        user_id: user.id,
        campaign_id: cid,
        product_id: l.product_id,
        quantity: Number(l.quantity),
        unit_cost: stats.get(l.product_id)?.avg ?? 0,
      }));
      const { error: e2 } = await supabase.from("marketing_campaign_items" as any).insert(rows);
      if (e2) throw e2;

      // Optional cash expense via the Expenses table (so it reduces cash & shows in Influencer Marketing category)
      if (cashCost > 0) {
        const { error: e3 } = await supabase.from("expenses").insert({
          user_id: user.id, date, amount: cashCost, category: "Influencer Marketing",
          notes: notes ? `Campaign: ${notes}` : "Campaign extra cost (shipping/fee)",
        });
        if (e3) throw e3;
      }

      toast.success("Campaign recorded");
      INVALIDATE.forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
      onDone?.();
    } catch (err: any) {
      toast.error(err.message ?? "Failed");
    } finally { setBusy(false); }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>Date</Label>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        </div>
        <div className="space-y-2">
          <Label>Extra cash cost (optional)</Label>
          <Input type="number" step="0.01" placeholder="Shipping or campaign fee" value={extraCost} onChange={(e) => setExtraCost(e.target.value)} />
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Products given</Label>
          <Button type="button" size="sm" variant="outline" onClick={addLine} disabled={products.length === 0}>
            <Plus className="h-3 w-3 mr-1" />Add product
          </Button>
        </div>
        {products.length === 0 && <p className="text-xs text-muted-foreground">Add products on the Products page first.</p>}
        {lines.map((l, i) => {
          const s = stats.get(l.product_id);
          const lineCost = (Number(l.quantity) || 0) * (s?.avg ?? 0);
          return (
            <Card key={i} className="p-3 space-y-2 bg-muted/20">
              <div className="flex gap-2">
                <Select value={l.product_id} onValueChange={(v) => updateLine(i, { product_id: v })}>
                  <SelectTrigger className="flex-1"><SelectValue placeholder="Select product..." /></SelectTrigger>
                  <SelectContent>
                    {products.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Button type="button" size="icon" variant="ghost" onClick={() => removeLine(i)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
              <div className="grid grid-cols-3 gap-2 items-end">
                <div>
                  <Label className="text-xs">Quantity</Label>
                  <Input type="number" step="any" value={l.quantity} onChange={(e) => updateLine(i, { quantity: e.target.value })} />
                </div>
                <div className="text-xs text-muted-foreground pb-2">
                  Avg cost: <span className="font-medium tabular-nums">{fmt(s?.avg ?? 0)}</span>
                </div>
                <div className="text-xs pb-2">
                  Line: <span className="font-medium tabular-nums">{fmt(lineCost)}</span>
                  {s && <div className="text-[10px] text-muted-foreground">In stock: {s.left}</div>}
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      <div className="space-y-2">
        <Label>Notes</Label>
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Influencer name, campaign details..." />
      </div>

      <Card className="p-3 text-sm space-y-1 bg-muted/30">
        <div className="flex justify-between"><span>Inventory cost (no cash impact)</span><span className="tabular-nums">{fmt(inventoryCost)}</span></div>
        <div className="flex justify-between"><span>Cash cost (extra)</span><span className="tabular-nums">{fmt(cashCost)}</span></div>
        <div className="flex justify-between font-semibold border-t pt-1"><span>Total campaign cost</span><span className="tabular-nums">{fmt(inventoryCost + cashCost)}</span></div>
      </Card>

      <Button type="submit" className="w-full" disabled={busy}>{busy ? "Saving..." : "Save Campaign"}</Button>
    </form>
  );
}

export default function MarketingPage() {
  const { data: campaigns = [] } = useMarketingCampaigns();
  const { data: items = [] } = useMarketingCampaignItems();
  const { data: products = [] } = useProducts();
  const productMap = new Map(products.map((p) => [p.id, p.name]));

  const rows = campaigns.map((c) => {
    const cItems = items.filter((it) => it.campaign_id === c.id);
    const inv = cItems.reduce((a, it) => a + Number(it.quantity) * Number(it.unit_cost), 0);
    const desc = cItems.map((it) => `${productMap.get(it.product_id) ?? "?"} ×${it.quantity}`).join(", ");
    return { ...c, _items: desc, _inventory: inv, _total: inv + Number(c.extra_cost) };
  });

  return (
    <div>
      <PageHeader title="Influencer Marketing" subtitle="Send products to influencers — reduces inventory, optional cash cost" dialogTitle="New campaign" addLabel="New Campaign">
        <CampaignForm />
      </PageHeader>
      <DataTable
        rows={rows}
        table="marketing_campaigns"
        invalidate={INVALIDATE}
        columns={[
          { key: "date", label: "Date" },
          { key: "_items", label: "Products" },
          { key: "_inventory", label: "Inventory Cost", className: "text-right tabular-nums", render: (r: any) => fmt(r._inventory) },
          { key: "extra_cost", label: "Cash Cost", className: "text-right tabular-nums", render: (r: any) => fmt(Number(r.extra_cost)) },
          { key: "_total", label: "Total", className: "text-right tabular-nums font-semibold", render: (r: any) => fmt(r._total) },
          { key: "notes", label: "Notes" },
        ]}
      />
    </div>
  );
}
