
CREATE TABLE public.cash_adjustments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  date date NOT NULL DEFAULT CURRENT_DATE,
  type text NOT NULL CHECK (type IN ('shortage','surplus')),
  amount numeric NOT NULL DEFAULT 0,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.cash_adjustments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ca all own" ON public.cash_adjustments
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.sync_tx_cash_adjustment()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE label text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.transactions WHERE source_table='cash_adjustments' AND source_id = OLD.id;
    RETURN OLD;
  END IF;
  label := CASE WHEN NEW.type = 'shortage' THEN 'Cash Adjustment – Shortage' ELSE 'Cash Adjustment – Surplus' END;
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.transactions(user_id, date, type, category, amount, notes, source_table, source_id)
    VALUES (NEW.user_id, NEW.date, label, 'Cash Adjustment', NEW.amount, NEW.note, 'cash_adjustments', NEW.id);
    RETURN NEW;
  ELSE
    UPDATE public.transactions
      SET date = NEW.date,
          type = label,
          amount = NEW.amount,
          notes = NEW.note
    WHERE source_table='cash_adjustments' AND source_id = NEW.id;
    RETURN NEW;
  END IF;
END; $$;

CREATE TRIGGER trg_sync_tx_cash_adjustment
AFTER INSERT OR UPDATE OR DELETE ON public.cash_adjustments
FOR EACH ROW EXECUTE FUNCTION public.sync_tx_cash_adjustment();
