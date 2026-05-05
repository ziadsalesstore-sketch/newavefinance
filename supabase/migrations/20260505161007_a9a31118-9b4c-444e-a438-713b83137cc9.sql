CREATE TABLE public.personal_withdrawals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  date date NOT NULL DEFAULT CURRENT_DATE,
  amount numeric NOT NULL DEFAULT 0,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.personal_withdrawals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pw all own" ON public.personal_withdrawals
FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.sync_tx_personal_withdrawal()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.transactions WHERE source_table='personal_withdrawals' AND source_id = OLD.id;
    RETURN OLD;
  ELSIF TG_OP = 'INSERT' THEN
    INSERT INTO public.transactions(user_id, date, type, category, amount, notes, source_table, source_id)
    VALUES (NEW.user_id, NEW.date, 'Personal Withdrawal', 'Owner', NEW.amount, NEW.note, 'personal_withdrawals', NEW.id);
    RETURN NEW;
  ELSE
    UPDATE public.transactions SET date=NEW.date, amount=NEW.amount, notes=NEW.note
    WHERE source_table='personal_withdrawals' AND source_id = NEW.id;
    RETURN NEW;
  END IF;
END; $$;

CREATE TRIGGER trg_sync_tx_personal_withdrawal
AFTER INSERT OR UPDATE OR DELETE ON public.personal_withdrawals
FOR EACH ROW EXECUTE FUNCTION public.sync_tx_personal_withdrawal();