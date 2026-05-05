import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

const today = () => new Date().toISOString().slice(0, 10);

export function RecordReceivedPaymentForm({ onDone }: { onDone?: () => void }) {
  const { user } = useAuth();
  const qc = useQueryClient();
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
    try {
      const { error } = await supabase.from("general_received_payments" as any).insert({
        user_id: user.id, amount: amt, date: date || today(), note: note || null,
      });
      if (error) throw error;
      toast.success("Payment recorded");
      ["general_received", "transactions"].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
      onDone?.();
    } catch (err: any) {
      toast.error(err.message ?? "Failed");
    } finally { setBusy(false); }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="amount">Amount received</Label>
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
  );
}
