import { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus } from "lucide-react";

export function PageHeader({ title, subtitle, dialogTitle, children, addLabel = "Add" }: {
  title: string; subtitle?: string; dialogTitle: string; children: ReactNode; addLabel?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4 mb-6">
      <div>
        <h1 className="text-2xl font-bold">{title}</h1>
        {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      <Dialog>
        <DialogTrigger asChild>
          <Button><Plus className="h-4 w-4 mr-1" />{addLabel}</Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader><DialogTitle>{dialogTitle}</DialogTitle></DialogHeader>
          {children}
        </DialogContent>
      </Dialog>
    </div>
  );
}
