CREATE TABLE public.general_received_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  date date NOT NULL DEFAULT CURRENT_DATE,
  amount numeric NOT NULL DEFAULT 0,
  note text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
ALTER TABLE public.general_received_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "grp all own" ON public.general_received_payments FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.sync_tx_general_received()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.transactions WHERE source_table='general_received_payments' AND source_id = OLD.id;
    RETURN OLD;
  ELSIF TG_OP = 'INSERT' THEN
    INSERT INTO public.transactions(user_id, date, type, category, amount, notes, source_table, source_id)
    VALUES (NEW.user_id, NEW.date, 'Cash Inflow', 'Cash', NEW.amount, NEW.note, 'general_received_payments', NEW.id);
    RETURN NEW;
  ELSE
    UPDATE public.transactions SET date=NEW.date, amount=NEW.amount, notes=NEW.note
    WHERE source_table='general_received_payments' AND source_id = NEW.id;
    RETURN NEW;
  END IF;
END; $$;

CREATE TRIGGER grp_sync_tx
AFTER INSERT OR UPDATE OR DELETE ON public.general_received_payments
FOR EACH ROW EXECUTE FUNCTION public.sync_tx_general_received();