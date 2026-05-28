import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTransactions, useStockPurchaseItems, useProducts, fmt, type Transaction } from "@/hooks/useFinance";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Pencil, Trash2, Download } from "lucide-react";
import * as XLSX from "xlsx";
import { DateRangePicker, useDateRange, inDateRange } from "@/components/DateRangePicker";
import { toast } from "sonner";

// Maps a transaction's source_table to its column names + which fields are editable.
type SourceConfig = {
  table: string;
  amountCol: string | null; // null = amount derived from child items, can't edit directly
  notesCol: string;
  dateCol: string;
};

const SOURCE_MAP: Record<string, SourceConfig> = {
  expenses: { table: "expenses", amountCol: "amount", notesCol: "notes", dateCol: "date" },
  revenue_payouts: { table: "revenue_payouts", amountCol: "earned_amount", notesCol: "notes", dateCol: "date" },
  revenue_payments: { table: "revenue_payments", amountCol: "amount", notesCol: "note", dateCol: "date" },
  general_received_payments: { table: "general_received_payments", amountCol: "amount", notesCol: "note", dateCol: "date" },
  personal_withdrawals: { table: "personal_withdrawals", amountCol: "amount", notesCol: "note", dateCol: "date" },
  opening_balances: { table: "opening_balances", amountCol: "cash_amount", notesCol: "notes", dateCol: "date" },
  stock_purchases: { table: "stock_purchases", amountCol: null, notesCol: "notes", dateCol: "date" },
  opening_balance_items: { table: "opening_balance_items", amountCol: null, notesCol: "notes", dateCol: "date" },
};

const INVALIDATE_KEYS = ["transactions", "stock", "stock_items", "revenue", "revenue_items", "expenses", "sales", "sales_items", "general_received", "opening_balance", "opening_balance_items"];

export default function TransactionsPage() {
  const { data: rows = [] } = useTransactions();
  const { data: stockItems = [] } = useStockPurchaseItems();
  const { data: products = [] } = useProducts();
  const qc = useQueryClient();
  const [sortBy, setSortBy] = useState<"date_desc" | "date_asc" | "amount_desc" | "amount_asc">("date_desc");
  const { range, setRange } = useDateRange();

  const filteredRows = rows.filter((r) => inDateRange(r.date, range));
  const sortedRows = [...filteredRows].sort((a, b) => {
    switch (sortBy) {
      case "date_asc": return a.date.localeCompare(b.date);
      case "amount_desc": return Number(b.amount) - Number(a.amount);
      case "amount_asc": return Number(a.amount) - Number(b.amount);
      default: return b.date.localeCompare(a.date);
    }
  });
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [date, setDate] = useState("");
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  const invalidateAll = () => INVALIDATE_KEYS.forEach((k) => qc.invalidateQueries({ queryKey: [k] }));

  const openEdit = (t: Transaction) => {
    setEditing(t);
    setDate(t.date);
    setAmount(String(t.amount));
    setNotes(t.notes ?? "");
  };

  const sourceFor = (t: Transaction): SourceConfig | null =>
    t.source_table ? SOURCE_MAP[t.source_table] ?? null : null;

  const remove = async (t: Transaction) => {
    const cfg = sourceFor(t);
    if (!cfg || !t.source_id) {
      // Orphan/manual transaction — delete directly
      if (!confirm("Delete this transaction?")) return;
      const { error } = await supabase.from("transactions").delete().eq("id", t.id);
      if (error) return toast.error(error.message);
      toast.success("Deleted");
      invalidateAll();
      return;
    }
    if (!confirm(`Delete this ${t.type.toLowerCase()} entry? This will remove the underlying record.`)) return;
    const { error } = await supabase.from(cfg.table as any).delete().eq("id", t.source_id);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    invalidateAll();
  };

  const save = async () => {
    if (!editing) return;
    const cfg = sourceFor(editing);
    setBusy(true);
    try {
      if (!cfg || !editing.source_id) {
        // Direct edit on transactions row
        const { error } = await supabase.from("transactions").update({
          date, amount: Number(amount) || 0, notes: notes || null,
        }).eq("id", editing.id);
        if (error) throw error;
      } else {
        const patch: any = { [cfg.dateCol]: date, [cfg.notesCol]: notes || null };
        if (cfg.amountCol) patch[cfg.amountCol] = Number(amount) || 0;
        const { error } = await supabase.from(cfg.table as any).update(patch).eq("id", editing.source_id);
        if (error) throw error;
      }
      toast.success("Updated");
      invalidateAll();
      setEditing(null);
    } catch (err: any) {
      toast.error(err.message ?? "Failed");
    } finally { setBusy(false); }
  };

  const editingCfg = editing ? sourceFor(editing) : null;
  const amountEditable = !editing || !editingCfg || editingCfg.amountCol !== null;

  const exportToExcel = () => {
    const productById = new Map(products.map((p) => [p.id, (p.name ?? "").toLowerCase()]));
    // Group stock items by stock_purchase_id
    const itemsByPurchase = new Map<string, { stickers: number; mavy: number; total: number; stickersCost: number; mavyCost: number }>();
    for (const it of stockItems) {
      const name = productById.get(it.product_id) ?? "";
      const cur = itemsByPurchase.get(it.stock_purchase_id) ?? { stickers: 0, mavy: 0, total: 0, stickersCost: 0, mavyCost: 0 };
      const qty = Number(it.quantity) || 0;
      const cost = Number(it.total_cost) || 0;
      cur.total += qty;
      if (name.includes("sticker")) { cur.stickers += qty; cur.stickersCost += cost; }
      if (name.includes("mavy") || name.includes("tumbler")) { cur.mavy += qty; cur.mavyCost += cost; }
      itemsByPurchase.set(it.stock_purchase_id, cur);
    }
    const data = sortedRows.map((t) => {
      const isStock = t.source_table === "stock_purchases" && t.source_id;
      const agg = isStock ? itemsByPurchase.get(t.source_id!) : undefined;
      return {
        Date: t.date,
        Amount: Number(t.amount),
        Category: t.category ?? "",
        "Quantity Purchased": agg ? agg.total : "",
        Stickers: agg ? agg.stickers : "",
        "Cost Per Unit (Stickers)": agg && agg.stickers > 0 ? Number((agg.stickersCost / agg.stickers).toFixed(2)) : "",
        "Mavy Tumblers": agg ? agg.mavy : "",
        "Cost Per Unit (Mavy Tumblers)": agg && agg.mavy > 0 ? Number((agg.mavyCost / agg.mavy).toFixed(2)) : "",
      };
    });
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Transactions");
    XLSX.writeFile(wb, "transactions.xlsx");
    toast.success("Exported to Excel");
  };

  return (
    <div>
      <div className="mb-6 flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Transactions</h1>
          <p className="text-sm text-muted-foreground">Auto-generated ledger of all financial activity. Edits sync back to the source entry.</p>
        </div>
        <div className="flex items-end gap-3 flex-wrap">
          <DateRangePicker value={range} onChange={setRange} />
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Sort by</Label>
            <Select value={sortBy} onValueChange={(v) => setSortBy(v as any)}>
              <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="date_desc">Date (Newest First)</SelectItem>
                <SelectItem value="date_asc">Date (Oldest First)</SelectItem>
                <SelectItem value="amount_desc">Value (Highest First)</SelectItem>
                <SelectItem value="amount_asc">Value (Lowest First)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button variant="outline" onClick={exportToExcel}>
            <Download className="h-4 w-4 mr-2" />
            Export Excel
          </Button>
        </div>
      </div>
      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Notes</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead className="w-24 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedRows.map((t) => {
              const negative = t.type === "Expense" || t.type === "Stock Purchase" || t.type === "Personal Withdrawal";
              return (
                <TableRow key={t.id}>
                  <TableCell>{t.date}</TableCell>
                  <TableCell>
                    <Badge variant={negative ? "destructive" : "default"} className={!negative ? "bg-success hover:bg-success" : ""}>
                      {t.type}
                    </Badge>
                  </TableCell>
                  <TableCell>{t.category ?? "—"}</TableCell>
                  <TableCell className="max-w-xs truncate text-muted-foreground">{t.notes ?? ""}</TableCell>
                  <TableCell className={`text-right tabular-nums font-medium ${negative ? "text-destructive" : "text-success"}`}>
                    {negative ? "-" : "+"}{fmt(Number(t.amount))}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button size="icon" variant="ghost" onClick={() => openEdit(t)}><Pencil className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => remove(t)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </TableCell>
                </TableRow>
              );
            })}
            {sortedRows.length === 0 && (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No transactions in this period</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit {editing?.type}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><Label>Date</Label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
            <div className="space-y-2">
              <Label>Amount</Label>
              <Input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} disabled={!amountEditable} />
              {!amountEditable && <p className="text-xs text-muted-foreground">Amount is computed from line items. Edit the source entry on its page to change it.</p>}
            </div>
            <div className="space-y-2"><Label>Notes</Label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            <Button onClick={save} disabled={busy}>{busy ? "Saving..." : "Save"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
