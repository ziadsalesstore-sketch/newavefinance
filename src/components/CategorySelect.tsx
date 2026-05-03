import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem, SelectSeparator } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { toast } from "sonner";

export function CategorySelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);

  const { data: cats = [] } = useQuery({
    queryKey: ["expense_categories"],
    queryFn: async () => {
      const { data, error } = await supabase.from("expense_categories").select("*").order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const createCategory = async () => {
    const trimmed = name.trim();
    if (!trimmed || !user) return;
    setBusy(true);
    try {
      const { data, error } = await supabase
        .from("expense_categories")
        .insert({ user_id: user.id, name: trimmed })
        .select()
        .single();
      if (error) throw error;
      await qc.invalidateQueries({ queryKey: ["expense_categories"] });
      onChange(data.name);
      setName("");
      setCreating(false);
      setOpen(false);
      toast.success("Category created");
    } catch (e: any) {
      toast.error(e.message ?? "Failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Select value={value} onValueChange={onChange} open={open} onOpenChange={(o) => { setOpen(o); if (!o) setCreating(false); }}>
      <SelectTrigger><SelectValue placeholder="Select category..." /></SelectTrigger>
      <SelectContent>
        {cats.map((c: any) => (
          <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
        ))}
        {cats.length > 0 && <SelectSeparator />}
        {creating ? (
          <div className="p-2 flex gap-2" onPointerDown={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
            <Input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Category name"
              onKeyDown={(e) => {
                if (e.key === "Enter") { e.preventDefault(); createCategory(); }
                if (e.key === "Escape") { e.preventDefault(); setCreating(false); setName(""); }
              }}
              className="h-8"
            />
            <Button type="button" size="sm" disabled={busy} onClick={createCategory}>Add</Button>
          </div>
        ) : (
          <button
            type="button"
            className="w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded-sm hover:bg-accent hover:text-accent-foreground"
            onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); setCreating(true); }}
          >
            <Plus className="h-4 w-4" /> Create new category
          </button>
        )}
      </SelectContent>
    </Select>
  );
}
