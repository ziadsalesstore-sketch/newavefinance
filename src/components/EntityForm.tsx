import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { toast } from "sonner";

const today = () => new Date().toISOString().slice(0, 10);

type FieldDef =
  | { name: string; label: string; type: "date" | "number" | "text" }
  | { name: string; label: string; type: "textarea" }
  | { name: string; label: string; type: "select"; options: { value: string; label: string }[] };

export function EntityForm({
  table, fields, invalidate, defaults, onDone,
}: {
  table: string;
  fields: FieldDef[];
  invalidate: string[];
  defaults?: Record<string, any>;
  onDone?: () => void;
}) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const init: Record<string, any> = { date: today(), ...defaults };
  fields.forEach((f) => { if (!(f.name in init)) init[f.name] = ""; });
  const [form, setForm] = useState(init);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setBusy(true);
    try {
      const payload: any = { user_id: user.id };
      fields.forEach((f) => {
        const v = form[f.name];
        if (f.type === "number") payload[f.name] = v === "" ? null : Number(v);
        else payload[f.name] = v === "" ? null : v;
      });
      const { error } = await supabase.from(table as any).insert(payload);
      if (error) throw error;
      toast.success("Saved");
      invalidate.forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
      onDone?.();
    } catch (err: any) {
      toast.error(err.message ?? "Failed");
    } finally { setBusy(false); }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      {fields.map((f) => (
        <div key={f.name} className="space-y-2">
          <Label htmlFor={f.name}>{f.label}</Label>
          {f.type === "textarea" ? (
            <Textarea id={f.name} value={form[f.name] ?? ""} onChange={(e) => setForm({ ...form, [f.name]: e.target.value })} />
          ) : f.type === "select" ? (
            <Select value={form[f.name] ?? ""} onValueChange={(v) => setForm({ ...form, [f.name]: v })}>
              <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
              <SelectContent>
                {f.options.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
          ) : (
            <Input id={f.name} type={f.type} value={form[f.name] ?? ""} onChange={(e) => setForm({ ...form, [f.name]: e.target.value })} required={f.type !== "text" || f.name === "product_name" || f.name === "category"} />
          )}
        </div>
      ))}
      <Button type="submit" className="w-full" disabled={busy}>{busy ? "Saving..." : "Save"}</Button>
    </form>
  );
}
