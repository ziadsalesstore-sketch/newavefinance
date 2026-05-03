import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSettings } from "@/hooks/useFinance";
import { useAuth } from "@/hooks/useAuth";
import { useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";

export default function SettingsPage() {
  const { user } = useAuth();
  const { data } = useSettings();
  const qc = useQueryClient();
  const [startingCash, setStartingCash] = useState("0");
  const [mode, setMode] = useState<"per_payout" | "periodic">("per_payout");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (data) {
      setStartingCash(String(data.starting_cash));
      setMode(data.sales_tracking_mode);
    }
  }, [data]);

  const save = async () => {
    if (!user) return;
    setBusy(true);
    const { error } = await supabase.from("settings").upsert({
      user_id: user.id, starting_cash: Number(startingCash) || 0, sales_tracking_mode: mode, updated_at: new Date().toISOString(),
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Settings saved");
    qc.invalidateQueries({ queryKey: ["settings"] });
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-sm text-muted-foreground">Configure your financial baseline and sales tracking mode</p>
      </div>

      <Card className="p-6 space-y-4">
        <div className="space-y-2">
          <Label htmlFor="cash">Starting cash</Label>
          <Input id="cash" type="number" value={startingCash} onChange={(e) => setStartingCash(e.target.value)} />
          <p className="text-xs text-muted-foreground">The amount of cash you started this business with.</p>
        </div>
      </Card>

      <Card className="p-6 space-y-4">
        <div>
          <Label className="text-base">Sales tracking mode</Label>
          <p className="text-xs text-muted-foreground mt-1">Pick one source of truth for units sold. Only one mode is active.</p>
        </div>
        <RadioGroup value={mode} onValueChange={(v) => setMode(v as any)} className="space-y-3">
          <label className="flex items-start gap-3 p-3 rounded-lg border cursor-pointer hover:bg-accent">
            <RadioGroupItem value="per_payout" id="m1" className="mt-0.5" />
            <div>
              <div className="font-medium">Per Revenue Payout</div>
              <div className="text-xs text-muted-foreground">Enter units sold on each revenue payout. Best when payouts arrive per sale batch.</div>
            </div>
          </label>
          <label className="flex items-start gap-3 p-3 rounded-lg border cursor-pointer hover:bg-accent">
            <RadioGroupItem value="periodic" id="m2" className="mt-0.5" />
            <div>
              <div className="font-medium">Periodic Sales Records</div>
              <div className="text-xs text-muted-foreground">Log units sold by daily/weekly/biweekly/monthly periods, separately from money.</div>
            </div>
          </label>
        </RadioGroup>
      </Card>

      <Button onClick={save} disabled={busy}>{busy ? "Saving..." : "Save settings"}</Button>
    </div>
  );
}
