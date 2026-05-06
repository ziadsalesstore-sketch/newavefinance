import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Check, ChevronDown, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export function CategorySelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);

  const { data: cats = [] } = useQuery({
    queryKey: ["expense_categories"],
    queryFn: async () => {
      const { data, error } = await supabase.from("expense_categories").select("*").order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return cats;
    return cats.filter((c: any) => c.name.toLowerCase().includes(q));
  }, [cats, search]);

  const exactMatch = useMemo(
    () => cats.some((c: any) => c.name.toLowerCase() === search.trim().toLowerCase()),
    [cats, search]
  );

  const createCategory = async () => {
    const trimmed = search.trim();
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
      setSearch("");
      setOpen(false);
      toast.success("Category created");
    } catch (e: any) {
      toast.error(e.message ?? "Failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (!o) setSearch(""); }}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal"
        >
          <span className={cn(!value && "text-muted-foreground")}>
            {value || "Select category..."}
          </span>
          <ChevronDown className="h-4 w-4 opacity-50 shrink-0" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="p-0 w-[--radix-popover-trigger-width] max-w-[calc(100vw-2rem)]"
        align="start"
        side="bottom"
        sideOffset={4}
        avoidCollisions={false}
      >
        <div className="p-2 border-b">
          <Input
            autoFocus
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search or create..."
            className="h-9"
            onKeyDown={(e) => {
              if (e.key === "Enter" && search.trim() && !exactMatch) {
                e.preventDefault();
                createCategory();
              }
            }}
          />
        </div>
        <div className="max-h-[180px] overflow-y-auto py-1">
          {filtered.length === 0 ? (
            <div className="px-3 py-4 text-center text-sm text-muted-foreground">
              No categories found
            </div>
          ) : (
            filtered.map((c: any) => (
              <button
                key={c.id}
                type="button"
                onClick={() => { onChange(c.name); setOpen(false); setSearch(""); }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground text-left"
              >
                <Check className={cn("h-4 w-4", value === c.name ? "opacity-100" : "opacity-0")} />
                <span className="truncate">{c.name}</span>
              </button>
            ))
          )}
        </div>
        <div className="border-t p-1 sticky bottom-0 bg-popover">
          <button
            type="button"
            disabled={busy || !search.trim() || exactMatch}
            onClick={createCategory}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-sm hover:bg-accent hover:text-accent-foreground disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent"
          >
            <Plus className="h-4 w-4" />
            {search.trim()
              ? exactMatch ? "Category already exists" : `Create "${search.trim()}"`
              : "Type a name above to create a new category"}
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
