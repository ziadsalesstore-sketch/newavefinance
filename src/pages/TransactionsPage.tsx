import { useTransactions, fmt } from "@/hooks/useFinance";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export default function TransactionsPage() {
  const { data: rows = [] } = useTransactions();
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Transactions</h1>
        <p className="text-sm text-muted-foreground">Auto-generated ledger of all financial activity</p>
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
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((t) => {
              const negative = t.type === "Expense" || t.type === "Stock Purchase";
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
                </TableRow>
              );
            })}
            {rows.length === 0 && (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No transactions yet</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
