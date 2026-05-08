import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useExpenses, fmt } from "@/hooks/useFinance";
import { CategorySelect } from "@/components/CategorySelect";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Plus, Trash2, Pencil, Target } from "lucide-react";
import { toast } from "sonner";

export type Budget = {
  id: string;
  name: string;
  category: string;
  amount: number;
  start_date: string;
  end_date: string;
  recurrence: "none" | "monthly" | "weekly";
  notes: string | null;
};

const today = () => new Date().toISOString().slice(0, 10);
const toISO = (d: Date) => d.toISOString().slice(0, 10);

export const useBudgets = () =>
  useQuery({
    queryKey: ["budgets"],
    queryFn: async (): Promise<Budget[]> => {
      const { data, error } = await supabase.from("budgets" as any).select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as any;
    },
  });

/** Returns the active cycle window for a budget given today's date. */
export function currentCycle(b: Budget, ref = new Date()): { start: string; end: string } {
  const refISO = toISO(new Date(ref.getFullYear(), ref.getMonth(), ref.getDate()));
  if (b.recurrence === "none" || refISO < b.start_date || refISO > b.end_date) {
    return { start: b.start_date, end: b.end_date };
  }
  const [sy, sm, sd] = b.start_date.split("-").map(Number);
  if (b.recurrence === "monthly") {
    let cs = new Date(sy, sm - 1, sd);
    let ce = new Date(sy, sm, sd);
    ce.setDate(ce.getDate() - 1);
    while (toISO(ce) < refISO) {
      cs = new Date(cs.getFullYear(), cs.getMonth() + 1, sd);
      ce = new Date(cs.getFullYear(), cs.getMonth() + 1, sd);
      ce.setDate(ce.getDate() - 1);
    }
    const endClipped = toISO(ce) > b.end_date ? b.end_date : toISO(ce);
    return { start: toISO(cs), end: endClipped };
  }
  // weekly
  const start = new Date(sy, sm - 1, sd);
  const refDate = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate());
  const days = Math.floor((refDate.getTime() - start.getTime()) / 86400000);
  const cycleIdx = Math.floor(days / 7);
  const cs = new Date(start);
  cs.setDate(cs.getDate() + cycleIdx * 7);
  const ce = new Date(cs);
  ce.setDate(ce.getDate() + 6);
  const endClipped = toISO(ce) > b.end_date ? b.end_date : toISO(ce);
  return { start: toISO(cs), end: endClipped };
}

export function computeBudgetProgress(b: Budget, expenses: { date: string; category: string; amount: number }[]) {
  const cycle = currentCycle(b);
  const spent = expenses
    .filter((e) => e.category === b.category && e.date >= cycle.start && e.date <= cycle.end)
    .reduce((a, e) => a + Number(e.amount), 0);
  const remaining = Number(b.amount) - spent;
  const pct = b.amount > 0 ? (spent / Number(b.amount)) * 100 : 0;
  const status: "normal" | "warning" | "critical" | "exceeded" =
    pct >= 100 ? "exceeded" : pct >= 90 ? "critical" : pct >= 70 ? "warning" : "normal";
  return { cycle, spent, remaining, pct, status };
}

const STATUS_TONE: Record<string, { bar: string; badge: string; label: string }> = {
  normal: { bar: "bg-success", badge: "bg-success/15 text-success border-success/30", label: "On track" },
  warning: { bar: "bg-amber-500", badge: "bg-amber-500/15 text-amber-600 border-amber-500/30", label: "Warning" },
  critical: { bar: "bg-orange-500", badge: "bg-orange-500/15 text-orange-600 border-orange-500/30", label: "Critical" },
  exceeded: { bar: "bg-destructive", badge: "bg-destructive/15 text-destructive border-destructive/30", label: "Exceeded" },
};

type FormState = {
  id?: string;
  name: string;
  category: string;
  amount: string;
  start_date: string;
  end_date: string;
  recurrence: "none" | "monthly" | "weekly";
  notes: string;
};
const blankForm = (): FormState => ({
  name: "", category: "", amount: "", start_date: today(), end_date: "", recurrence: "monthly", notes: "",
});

function BudgetForm({ initial, onDone }: { initial?: Budget; onDone: () => void }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [form, setForm] = useState<FormState>(
    initial
      ? { id: initial.id, name: initial.name, category: initial.category, amount: String(initial.amount),
          start_date: initial.start_date, end_date: initial.end_date, recurrence: initial.recurrence, notes: initial.notes ?? "" }
      : blankForm()
  );
  const [busy, setBusy] = useState(false);

  const set = (p: Partial<FormState>) => setForm((f) => ({ ...f, ...p }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!form.name.trim() || !form.category || !Number(form.amount) || !form.start_date || !form.end_date) {
      return toast.error("Fill in all required fields");
    }
    if (form.end_date < form.start_date) return toast.error("End date must be on or after start date");
    setBusy(true);
    try {
      const payload = {
        user_id: user.id, name: form.name.trim(), category: form.category, amount: Number(form.amount),
        start_date: form.start_date, end_date: form.end_date, recurrence: form.recurrence,
        notes: form.notes.trim() || null,
      };
      if (form.id) {
        const { error } = await supabase.from("budgets" as any).update(payload).eq("id", form.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("budgets" as any).insert(payload);
        if (error) throw error;
      }
      qc.invalidateQueries({ queryKey: ["budgets"] });
      toast.success(form.id ? "Budget updated" : "Budget created");
      onDone();
    } catch (err: any) {
      toast.error(err.message ?? "Failed");
    } finally { setBusy(false); }
  };

  return (
    <form onSubmit={submit} className="flex flex-col flex-1 min-h-0">
      <div className="overflow-y-auto flex-1 min-h-0 px-6 py-4 space-y-4">
        <div className="space-y-2">
          <Label>Budget name *</Label>
          <Input value={form.name} onChange={(e) => set({ name: e.target.value })} placeholder="e.g. TikTok Ads" required />
        </div>
        <div className="space-y-2">
          <Label>Linked expense category *</Label>
          <CategorySelect value={form.category} onChange={(v) => set({ category: v })} />
          <p className="text-xs text-muted-foreground">Expenses recorded under this category count toward the budget.</p>
        </div>
        <div className="space-y-2">
          <Label>Budget amount *</Label>
          <Input type="number" step="any" value={form.amount} onChange={(e) => set({ amount: e.target.value })} required />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label>Start date *</Label>
            <Input type="date" value={form.start_date} onChange={(e) => set({ start_date: e.target.value })} required />
          </div>
          <div className="space-y-2">
            <Label>End date *</Label>
            <Input type="date" value={form.end_date} onChange={(e) => set({ end_date: e.target.value })} required />
          </div>
        </div>
        <div className="space-y-2">
          <Label>Recurrence</Label>
          <Select value={form.recurrence} onValueChange={(v) => set({ recurrence: v as any })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="monthly">Repeat monthly</SelectItem>
              <SelectItem value="weekly">Repeat weekly</SelectItem>
              <SelectItem value="none">One-time (custom range)</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">Recurring budgets reset automatically each cycle.</p>
        </div>
        <div className="space-y-2">
          <Label>Notes</Label>
          <Textarea value={form.notes} onChange={(e) => set({ notes: e.target.value })} />
        </div>
      </div>
      <DialogFooter className="px-6 py-4 border-t bg-background shrink-0">
        <Button type="submit" className="w-full" disabled={busy}>
          {busy ? "Saving..." : form.id ? "Save changes" : "Create budget"}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function BudgetCard({ b, expenses, onEdit, onDelete }: {
  b: Budget;
  expenses: { date: string; category: string; amount: number }[];
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  const { cycle, spent, remaining, pct, status } = computeBudgetProgress(b, expenses);
  const tone = STATUS_TONE[status];
  return (
    <Card className="p-5 space-y-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold truncate">{b.name}</h3>
            <Badge variant="outline" className={tone.badge}>{tone.label}</Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {b.category} · {b.recurrence === "none" ? "One-time" : b.recurrence === "monthly" ? "Monthly" : "Weekly"}
          </p>
          <p className="text-[11px] text-muted-foreground mt-1">Cycle: {cycle.start} → {cycle.end}</p>
        </div>
        {(onEdit || onDelete) && (
          <div className="flex gap-1 shrink-0">
            {onEdit && <Button size="icon" variant="ghost" onClick={onEdit}><Pencil className="h-4 w-4" /></Button>}
            {onDelete && <Button size="icon" variant="ghost" onClick={onDelete}><Trash2 className="h-4 w-4 text-destructive" /></Button>}
          </div>
        )}
      </div>
      <div>
        <div className="flex justify-between text-sm mb-1.5">
          <span className="tabular-nums font-medium">{fmt(spent)} <span className="text-muted-foreground font-normal">of {fmt(Number(b.amount))}</span></span>
          <span className="tabular-nums text-muted-foreground">{Math.min(999, Math.round(pct))}%</span>
        </div>
        <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-secondary">
          <div className={`h-full transition-all ${tone.bar}`} style={{ width: `${Math.min(100, pct)}%` }} />
        </div>
        <div className="flex justify-between text-xs mt-2">
          <span className="text-muted-foreground">Remaining</span>
          <span className={`tabular-nums font-medium ${remaining < 0 ? "text-destructive" : ""}`}>{fmt(remaining)}</span>
        </div>
      </div>
    </Card>
  );
}

export default function BudgetsPage() {
  const { data: budgets = [] } = useBudgets();
  const { data: expenses = [] } = useExpenses();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Budget | null>(null);

  const totals = useMemo(() => {
    let amount = 0, spent = 0;
    budgets.forEach((b) => {
      const { spent: s } = computeBudgetProgress(b, expenses);
      amount += Number(b.amount);
      spent += s;
    });
    return { amount, spent, remaining: amount - spent };
  }, [budgets, expenses]);

  const remove = async (id: string) => {
    if (!confirm("Delete this budget?")) return;
    const { error } = await supabase.from("budgets" as any).delete().eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["budgets"] });
    toast.success("Budget deleted");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Budgets</h1>
          <p className="text-sm text-muted-foreground">Set spending limits per category. Expenses auto-deduct from the matching budget.</p>
        </div>
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setEditing(null); }}>
          <DialogTrigger asChild>
            <Button onClick={() => setEditing(null)}><Plus className="h-4 w-4 mr-1" />New budget</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] p-0 gap-0 flex flex-col">
            <DialogHeader className="px-6 py-4 border-b shrink-0">
              <DialogTitle>{editing ? "Edit budget" : "New budget"}</DialogTitle>
            </DialogHeader>
            <BudgetForm initial={editing ?? undefined} onDone={() => { setOpen(false); setEditing(null); }} />
          </DialogContent>
        </Dialog>
      </div>

      {budgets.length > 0 && (
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-3">
          <Card className="p-4">
            <div className="text-xs text-muted-foreground">Total budgeted (current cycles)</div>
            <div className="text-xl font-bold tabular-nums mt-1">{fmt(totals.amount)}</div>
          </Card>
          <Card className="p-4">
            <div className="text-xs text-muted-foreground">Total spent</div>
            <div className="text-xl font-bold tabular-nums mt-1">{fmt(totals.spent)}</div>
          </Card>
          <Card className="p-4">
            <div className="text-xs text-muted-foreground">Remaining</div>
            <div className={`text-xl font-bold tabular-nums mt-1 ${totals.remaining < 0 ? "text-destructive" : ""}`}>{fmt(totals.remaining)}</div>
          </Card>
        </div>
      )}

      {budgets.length === 0 ? (
        <Card className="p-10 text-center">
          <Target className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          <h3 className="font-semibold">No budgets yet</h3>
          <p className="text-sm text-muted-foreground mt-1">Create your first budget to start tracking spending limits.</p>
          <Button className="mt-4" onClick={() => { setEditing(null); setOpen(true); }}>
            <Plus className="h-4 w-4 mr-1" />Create budget
          </Button>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {budgets.map((b) => (
            <BudgetCard
              key={b.id}
              b={b}
              expenses={expenses}
              onEdit={() => { setEditing(b); setOpen(true); }}
              onDelete={() => remove(b.id)}
            />
          ))}
        </div>
      )}

      <Card className="p-4 text-xs text-muted-foreground bg-muted/30">
        Budgets track expenses recorded in the matching category during the current cycle. Recurring budgets reset automatically when a new cycle starts.
      </Card>
    </div>
  );
}
