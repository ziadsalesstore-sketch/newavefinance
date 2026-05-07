import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { fmt } from "@/hooks/useFinance";
import { MetricCard } from "@/components/MetricCard";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Trash2 } from "lucide-react";
import { DateRangePicker, useDateRange, inDateRange } from "@/components/DateRangePicker";
import { toast } from "sonner";

const today = () => new Date().toISOString().slice(0, 10);

type Withdrawal = { id: string; date: string; amount: number; note: string | null };

export default function WithdrawalsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(today());
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const { data: rows = [] } = useQuery({
    queryKey: ["personal_withdrawals"],
    queryFn: async (): Promise<Withdrawal[]> => {
      const { data, error } = await supabase.from("personal_withdrawals" as any).select("*").order("date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Withdrawal[];
    },
  });

  const { range, setRange } = useDateRange();
  const filteredRows = useMemo(() => rows.filter((r) => inDateRange(r.date, range)), [rows, range]);
  const total = useMemo(() => filteredRows.reduce((a, r) => a + Number(r.amount), 0), [filteredRows]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const amt = Number(amount);
    if (!amt || amt <= 0) return toast.error("Enter a valid amount");
    setBusy(true);
    try {
      const { error } = await supabase.from("personal_withdrawals" as any).insert({
        user_id: user.id, amount: amt, date: date || today(), note: note || null,
      });
      if (error) throw error;
      toast.success("Withdrawal recorded");
      setAmount(""); setNote(""); setDate(today()); setOpen(false);
      ["personal_withdrawals", "transactions"].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
    } catch (err: any) {
      toast.error(err.message ?? "Failed");
    } finally { setBusy(false); }
  };

  const del = async (id: string) => {
    if (!confirm("Delete this withdrawal?")) return;
    const { error } = await supabase.from("personal_withdrawals" as any).delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    ["personal_withdrawals", "transactions"].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
  };

  return (
    <div>
      <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Personal Withdrawals</h1>
          <p className="text-sm text-muted-foreground">Money taken out of the business for personal use</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <DateRangePicker value={range} onChange={setRange} />
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-1" />Record Withdrawal</Button>
            </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New personal withdrawal</DialogTitle></DialogHeader>
            <form onSubmit={submit} className="space-y-4">
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
                <Textarea id="note" value={note} onChange={(e) => setNote(e.target.value)} />
              </div>
              <Button type="submit" className="w-full" disabled={busy}>{busy ? "Saving..." : "Save"}</Button>
            </form>
          </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 mb-4">
        <MetricCard label="Total Withdrawn" value={fmt(total)} />
        <MetricCard label="Number of Withdrawals" value={String(filteredRows.length)} />
      </div>

      <Card className="overflow-hidden">
        {filteredRows.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">No withdrawals in this period.</div>
        ) : filteredRows.map((w) => (
          <div key={w.id} className="flex items-center justify-between p-4 border-b last:border-0 hover:bg-muted/30">
            <div>
              <div className="font-medium text-sm">{w.date}</div>
              {w.note && <div className="text-xs text-muted-foreground">{w.note}</div>}
            </div>
            <div className="flex items-center gap-4">
              <div className="tabular-nums font-semibold text-destructive">-{fmt(Number(w.amount))}</div>
              <Button size="icon" variant="ghost" onClick={() => del(w.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
            </div>
          </div>
        ))}
      </Card>
    </div>
  );
}
