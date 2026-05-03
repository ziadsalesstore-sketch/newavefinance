import { ReactNode } from "react";
import { cn } from "@/lib/utils";

type Props = {
  label: string;
  value: ReactNode;
  icon?: ReactNode;
  tone?: "default" | "positive" | "negative" | "auto";
  numeric?: number;
  hint?: string;
};

export function MetricCard({ label, value, icon, tone = "default", numeric, hint }: Props) {
  const t = tone === "auto" ? (numeric != null && numeric < 0 ? "negative" : "positive") : tone;
  return (
    <div className="metric-card">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs uppercase tracking-wide text-muted-foreground font-medium">{label}</span>
        {icon && <div className="text-muted-foreground">{icon}</div>}
      </div>
      <div className={cn(
        "text-2xl font-bold tabular-nums",
        t === "positive" && "text-success",
        t === "negative" && "text-destructive",
      )}>{value}</div>
      {hint && <div className="text-xs text-muted-foreground mt-1">{hint}</div>}
    </div>
  );
}
