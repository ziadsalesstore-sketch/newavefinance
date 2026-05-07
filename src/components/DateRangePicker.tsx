import { useMemo, useState } from "react";
import { format } from "date-fns";
import { Calendar as CalendarIcon, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { DateRange as DRType } from "react-day-picker";

export type DateRangeValue = { start: string; end: string; preset: string };

const toISO = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};
const fromISO = (s: string) => {
  if (!s) return undefined;
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
};

export const PRESETS = [
  "Today", "Yesterday", "Last 7 Days", "Last 30 Days",
  "This Month", "Last Month", "All Time", "Custom Range",
] as const;
export type PresetName = typeof PRESETS[number];

export function rangeFromPreset(preset: PresetName): { start: string; end: string } {
  const now = new Date();
  const t = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const add = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
  switch (preset) {
    case "Today": return { start: toISO(t), end: toISO(t) };
    case "Yesterday": { const y = add(t, -1); return { start: toISO(y), end: toISO(y) }; }
    case "Last 7 Days": return { start: toISO(add(t, -6)), end: toISO(t) };
    case "Last 30 Days": return { start: toISO(add(t, -29)), end: toISO(t) };
    case "This Month": {
      const s = new Date(t.getFullYear(), t.getMonth(), 1);
      return { start: toISO(s), end: toISO(t) };
    }
    case "Last Month": {
      const s = new Date(t.getFullYear(), t.getMonth() - 1, 1);
      const e = new Date(t.getFullYear(), t.getMonth(), 0);
      return { start: toISO(s), end: toISO(e) };
    }
    case "All Time": return { start: "", end: "" };
    case "Custom Range": return { start: toISO(t), end: toISO(t) };
  }
}

export const DEFAULT_RANGE: DateRangeValue = { ...rangeFromPreset("Today"), preset: "Today" };

function formatLabel(v: DateRangeValue) {
  if (v.preset !== "Custom Range") return v.preset;
  if (!v.start && !v.end) return "All Time";
  const s = fromISO(v.start);
  const e = fromISO(v.end);
  if (s && e && v.start === v.end) return format(s, "MMM d, yyyy");
  if (s && e) return `${format(s, "MMM d, yyyy")} – ${format(e, "MMM d, yyyy")}`;
  return "Custom Range";
}

export function DateRangePicker({ value, onChange, className }: {
  value: DateRangeValue;
  onChange: (v: DateRangeValue) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<DRType | undefined>(undefined);

  const selected: DRType | undefined = useMemo(() => {
    if (!value.start && !value.end) return undefined;
    return { from: fromISO(value.start), to: fromISO(value.end) || fromISO(value.start) };
  }, [value]);

  const applyPreset = (p: PresetName) => {
    if (p === "Custom Range") {
      setDraft(selected ?? { from: new Date(), to: new Date() });
      return;
    }
    const r = rangeFromPreset(p);
    onChange({ ...r, preset: p });
    setOpen(false);
  };

  const applyCustom = () => {
    if (!draft?.from) return;
    const start = toISO(draft.from);
    const end = toISO(draft.to ?? draft.from);
    onChange({ start, end, preset: "Custom Range" });
    setDraft(undefined);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (!o) setDraft(undefined); }}>
      <PopoverTrigger asChild>
        <Button variant="outline" className={cn("justify-between gap-2 min-w-[220px]", className)}>
          <span className="flex items-center gap-2 truncate">
            <CalendarIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="truncate">{formatLabel(value)}</span>
          </span>
          <ChevronDown className="h-4 w-4 opacity-60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-auto p-0 max-w-[calc(100vw-2rem)] max-h-[calc(100vh-6rem)] overflow-auto"
        align="end"
      >
        <div className="flex flex-col sm:flex-row">
          <div className="flex sm:flex-col gap-1 p-2 sm:border-r overflow-x-auto sm:overflow-visible sm:min-w-[160px] bg-muted/30">
            {PRESETS.map((p) => {
              const active = (draft && p === "Custom Range") || (!draft && value.preset === p);
              return (
                <Button
                  key={p}
                  variant={active ? "secondary" : "ghost"}
                  size="sm"
                  className="justify-start whitespace-nowrap"
                  onClick={() => applyPreset(p)}
                >
                  {p}
                </Button>
              );
            })}
          </div>
          {draft !== undefined && (
            <div className="p-2">
              <Calendar
                mode="range"
                selected={draft}
                onSelect={setDraft}
                numberOfMonths={1}
                defaultMonth={draft?.from}
                className={cn("p-3 pointer-events-auto")}
              />
              <div className="flex justify-end gap-2 p-2">
                <Button size="sm" variant="ghost" onClick={() => { setDraft(undefined); setOpen(false); }}>Cancel</Button>
                <Button size="sm" onClick={applyCustom} disabled={!draft?.from}>Apply</Button>
              </div>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function useDateRange(initial: DateRangeValue = DEFAULT_RANGE) {
  const [range, setRange] = useState<DateRangeValue>(initial);
  return { range, setRange };
}

export const inDateRange = (date: string | undefined | null, v: DateRangeValue) =>
  !!date && (!v.start || date >= v.start) && (!v.end || date <= v.end);
