import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

type Props = {
  start: string; end: string;
  onChange: (s: string, e: string) => void;
};

const today = () => new Date().toISOString().slice(0, 10);
const addDays = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
const startOfMonth = () => { const d = new Date(); d.setDate(1); return d.toISOString().slice(0, 10); };

export function DateRange({ start, end, onChange }: Props) {
  const presets: [string, () => [string, string]][] = [
    ["Today", () => [today(), today()]],
    ["7d", () => [addDays(-6), today()]],
    ["14d", () => [addDays(-13), today()]],
    ["MTD", () => [startOfMonth(), today()]],
    ["30d", () => [addDays(-29), today()]],
    ["All", () => ["", ""]],
  ];
  return (
    <div className="flex flex-wrap items-end gap-3 p-4 rounded-xl border bg-card">
      <div className="space-y-1">
        <Label htmlFor="start" className="text-xs">Start</Label>
        <Input id="start" type="date" value={start} onChange={(e) => onChange(e.target.value, end)} className="w-[160px]" />
      </div>
      <div className="space-y-1">
        <Label htmlFor="end" className="text-xs">End</Label>
        <Input id="end" type="date" value={end} onChange={(e) => onChange(start, e.target.value)} className="w-[160px]" />
      </div>
      <div className="flex flex-wrap gap-1.5 ml-auto">
        {presets.map(([label, fn]) => (
          <Button key={label} variant="outline" size="sm" onClick={() => { const [s, e] = fn(); onChange(s, e); }}>{label}</Button>
        ))}
      </div>
    </div>
  );
}
