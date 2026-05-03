import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";

export function DataTable<T extends { id: string }>({
  rows, columns, table, invalidate,
}: {
  rows: T[];
  columns: { key: keyof T | string; label: string; render?: (row: T) => React.ReactNode; className?: string }[];
  table: string;
  invalidate: string[];
}) {
  const qc = useQueryClient();
  const del = async (id: string) => {
    if (!confirm("Delete this entry?")) return;
    const { error } = await supabase.from(table as any).delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    invalidate.forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
  };

  if (rows.length === 0) {
    return <Card className="p-8 text-center text-sm text-muted-foreground">No entries yet.</Card>;
  }
  return (
    <Card className="overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            {columns.map((c) => <TableHead key={String(c.key)} className={c.className}>{c.label}</TableHead>)}
            <TableHead className="w-[60px]" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.id}>
              {columns.map((c) => (
                <TableCell key={String(c.key)} className={c.className}>
                  {c.render ? c.render(r) : (r as any)[c.key]}
                </TableCell>
              ))}
              <TableCell>
                <Button size="icon" variant="ghost" onClick={() => del(r.id)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}
