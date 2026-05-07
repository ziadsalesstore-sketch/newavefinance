import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useExpenses, useMarketingCampaigns, useMarketingCampaignItems, useProducts, useStockPurchaseItems, useOpeningBalanceItems, useRevenueItems, useSalesItems, useSettings, fmt } from "@/hooks/useFinance";
import { EntityForm } from "@/components/EntityForm";
import { DataTable } from "@/components/DataTable";
import { CategorySelect } from "@/components/CategorySelect";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Plus, Trash2, AlertCircle } from "lucide-react";
import { DateRangePicker, useDateRange, inDateRange } from "@/components/DateRangePicker";
import { toast } from "sonner";

const today = () => new Date().toISOString().slice(0, 10);
type Line = { product_id: string; quantity: string };
const INV_INVALIDATE = ["marketing_campaigns", "marketing_campaign_items", "expenses", "transactions"];

function InventoryExpenseForm({ onDone }: { onDone?: () => void }) {
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
  const [category, setCategory] = useState("PR / Giveaway");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<Line[]>([{ product_id: "", quantity: "" }]);
  const [busy, setBusy] = useState(false);

  const stats = useMemo(() => {
    const m = new Map<string, { avg: number; left: number }>();
    const ensure = (pid: string) => { if (!m.has(pid)) m.set(pid, { avg: 0, left: 0 }); return m.get(pid)!; };
    const totals = new Map<string, { units: number; cost: number }>();
    const tot = (pid: string) => { if (!totals.has(pid)) totals.set(pid, { units: 0, cost: 0 }); return totals.get(pid)!; };
    openingItems.forEach((it) => { const t = tot(it.product_id); t.units += Number(it.quantity); t.cost += Number(it.quantity) * Number(it.unit_cost); });
    stockItems.forEach((it) => { const t = tot(it.product_id); t.units += Number(it.quantity); t.cost += Number(it.total_cost); });
    totals.forEach((t, pid) => { const r = ensure(pid); r.avg = t.units > 0 ? t.cost / t.units : 0; r.left = t.units; });
    const periodic = settings?.sales_tracking_mode === "periodic";
    (periodic ? salesItems : revenueItems).forEach((it: any) => { ensure(it.product_id).left -= Number(it.units_sold); });
    campaignItems.forEach((it) => { ensure(it.product_id).left -= Number(it.quantity); });
    return m;
  }, [openingItems, stockItems, revenueItems, salesItems, campaignItems, settings]);

  const update = (i: number, p: Partial<Line>) => setLines((a) => a.map((l, idx) => idx === i ? { ...l, ...p } : l));
  const add = () => setLines((a) => [...a, { product_id: "", quantity: "" }]);
  const remove = (i: number) => setLines((a) => a.filter((_, idx) => idx !== i));

  const total = lines.reduce((a, l) => a + (Number(l.quantity) || 0) * (stats.get(l.product_id)?.avg ?? 0), 0);
  const overflow = lines.find((l) => l.product_id && Number(l.quantity) > 0 && Number(l.quantity) > (stats.get(l.product_id)?.left ?? 0));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const valid = lines.filter((l) => l.product_id && Number(l.quantity) > 0);
    if (valid.length === 0) return toast.error("Add at least one product");
    if (overflow) return toast.error("Quantity exceeds available stock");
    setBusy(true);
    try {
      const { data: c, error: e1 } = await supabase.from("marketing_campaigns" as any)
        .insert({ user_id: user.id, date, extra_cost: 0, notes: `${category}${notes ? " — " + notes : ""}` })
        .select("id").single();
      if (e1) throw e1;
      const cid = (c as any).id;
      const rows = valid.map((l) => ({
        user_id: user.id, campaign_id: cid, product_id: l.product_id,
        quantity: Number(l.quantity), unit_cost: stats.get(l.product_id)?.avg ?? 0,
      }));
      const { error: e2 } = await supabase.from("marketing_campaign_items" as any).insert(rows);
      if (e2) throw e2;
      toast.success("Inventory expense recorded");
      INV_INVALIDATE.forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
      onDone?.();
    } catch (err: any) {
      toast.error(err.message ?? "Failed");
    } finally { setBusy(false); }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <Card className="p-3 text-xs flex gap-2 bg-muted/40">
        <AlertCircle className="h-4 w-4 shrink-0 text-muted-foreground" />
        <span>This expense uses inventory and does not affect cash.</span>
      </Card>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>Date</Label>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        </div>
        <div className="space-y-2">
          <Label>Category</Label>
          <CategorySelect value={category} onChange={setCategory} />
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Products used</Label>
          <Button type="button" size="sm" variant="outline" onClick={add} disabled={products.length === 0}>
            <Plus className="h-3 w-3 mr-1" />Add product
          </Button>
        </div>
        {products.length === 0 && <p className="text-xs text-muted-foreground">Add products on the Products page first.</p>}
        {lines.map((l, i) => {
          const s = stats.get(l.product_id);
          const qty = Number(l.quantity) || 0;
          const lineCost = qty * (s?.avg ?? 0);
          const over = s && qty > s.left;
          return (
            <Card key={i} className="p-3 space-y-2 bg-muted/20">
              <div className="flex gap-2">
                <Select value={l.product_id} onValueChange={(v) => update(i, { product_id: v })}>
                  <SelectTrigger className="flex-1"><SelectValue placeholder="Select product..." /></SelectTrigger>
                  <SelectContent>
                    {products.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Button type="button" size="icon" variant="ghost" onClick={() => remove(i)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
              <div className="grid grid-cols-3 gap-2 items-end">
                <div>
                  <Label className="text-xs">Quantity</Label>
                  <Input type="number" step="any" value={l.quantity} onChange={(e) => update(i, { quantity: e.target.value })} />
                </div>
                <div className="text-xs text-muted-foreground pb-2">
                  Cost/unit: <span className="font-medium tabular-nums">{fmt(s?.avg ?? 0)}</span>
                </div>
                <div className="text-xs pb-2">
                  Total: <span className="font-medium tabular-nums">{fmt(lineCost)}</span>
                  {s && <div className={`text-[10px] ${over ? "text-destructive" : "text-muted-foreground"}`}>In stock: {s.left}{over ? " — insufficient" : ""}</div>}
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      <div className="space-y-2">
        <Label>Notes</Label>
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Recipient, campaign, reason..." />
      </div>

      <Card className="p-3 text-sm bg-muted/30 flex justify-between font-semibold">
        <span>Total expense</span><span className="tabular-nums">{fmt(total)}</span>
      </Card>

      <Button type="submit" className="w-full" disabled={busy || !!overflow}>{busy ? "Saving..." : "Save Inventory Expense"}</Button>
    </form>
  );
}

export default function ExpensesPage() {
  const { data: cashRows = [] } = useExpenses();
  const { data: campaigns = [] } = useMarketingCampaigns();
  const { data: items = [] } = useMarketingCampaignItems();
  const { data: products = [] } = useProducts();
  const productMap = new Map(products.map((p) => [p.id, p.name]));
  const [open, setOpen] = useState(false);
  const { range, setRange } = useDateRange();

  const filteredCash = useMemo(() => cashRows.filter((r) => inDateRange(r.date, range)), [cashRows, range]);

  const inventoryRows = useMemo(() => campaigns.filter((c) => inDateRange(c.date, range)).map((c) => {
    const cItems = items.filter((it) => it.campaign_id === c.id);
    const total = cItems.reduce((a, it) => a + Number(it.quantity) * Number(it.unit_cost), 0);
    const desc = cItems.map((it) => `${productMap.get(it.product_id) ?? "?"} ×${it.quantity}`).join(", ");
    return { id: c.id, date: c.date, category: c.notes?.split(" — ")[0] ?? "Inventory Expense", products: desc, amount: total, notes: c.notes };
  }), [campaigns, items, productMap, range]);

  return (
    <div>
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold">Expenses</h1>
          <p className="text-sm text-muted-foreground">Cash expenses + inventory-based expenses (PR, giveaways, samples)</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-1" />Add Expense</Button></DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>New expense</DialogTitle></DialogHeader>
            <Tabs defaultValue="cash">
              <TabsList className="grid grid-cols-2 w-full">
                <TabsTrigger value="cash">Cash Expense</TabsTrigger>
                <TabsTrigger value="inventory">Inventory Expense</TabsTrigger>
              </TabsList>
              <TabsContent value="cash" className="pt-4">
                <EntityForm
                  table="expenses"
                  invalidate={["expenses", "transactions"]}
                  fields={[
                    { name: "date", label: "Date", type: "date" },
                    { name: "category", label: "Category", type: "custom", render: (v, on) => <CategorySelect value={v ?? ""} onChange={on} /> },
                    { name: "amount", label: "Amount", type: "number" },
                    { name: "notes", label: "Notes", type: "textarea" },
                  ]}
                  onDone={() => setOpen(false)}
                />
              </TabsContent>
              <TabsContent value="inventory" className="pt-4">
                <InventoryExpenseForm onDone={() => setOpen(false)} />
              </TabsContent>
            </Tabs>
          </DialogContent>
        </Dialog>
      </div>

      <h3 className="font-semibold text-sm mb-2">Cash expenses</h3>
      <DataTable
        rows={cashRows}
        table="expenses"
        invalidate={["expenses", "transactions"]}
        columns={[
          { key: "date", label: "Date" },
          { key: "category", label: "Category" },
          { key: "amount", label: "Amount", className: "text-right tabular-nums", render: (r) => fmt(Number(r.amount)) },
          { key: "notes", label: "Notes" },
        ]}
      />

      <h3 className="font-semibold text-sm mb-2 mt-8">Inventory expenses <span className="text-xs text-muted-foreground font-normal">(no cash impact)</span></h3>
      <DataTable
        rows={inventoryRows}
        table="marketing_campaigns"
        invalidate={INV_INVALIDATE}
        columns={[
          { key: "date", label: "Date" },
          { key: "category", label: "Category" },
          { key: "products", label: "Products" },
          { key: "amount", label: "Total Cost", className: "text-right tabular-nums", render: (r: any) => fmt(r.amount) },
        ]}
      />
    </div>
  );
}
