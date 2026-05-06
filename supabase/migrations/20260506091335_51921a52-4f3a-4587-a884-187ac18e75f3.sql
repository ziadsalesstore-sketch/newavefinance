-- Opening Balance tables
CREATE TABLE public.opening_balances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  cash_amount numeric NOT NULL DEFAULT 0,
  date date NOT NULL DEFAULT CURRENT_DATE,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.opening_balances ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ob all own" ON public.opening_balances FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.opening_balance_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  opening_balance_id uuid NOT NULL REFERENCES public.opening_balances(id) ON DELETE CASCADE,
  product_id uuid NOT NULL,
  quantity numeric NOT NULL DEFAULT 0,
  unit_cost numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.opening_balance_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "obi all own" ON public.opening_balance_items FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Sync cash row into transactions
CREATE OR REPLACE FUNCTION public.sync_tx_opening_balance()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.transactions WHERE source_table='opening_balances' AND source_id = OLD.id;
    RETURN OLD;
  ELSIF TG_OP = 'INSERT' THEN
    INSERT INTO public.transactions(user_id, date, type, category, amount, notes, source_table, source_id)
    VALUES (NEW.user_id, NEW.date, 'Opening Balance', 'Cash', NEW.cash_amount, 'Initial cash', 'opening_balances', NEW.id);
    RETURN NEW;
  ELSE
    UPDATE public.transactions SET date=NEW.date, amount=NEW.cash_amount
    WHERE source_table='opening_balances' AND source_id = NEW.id;
    RETURN NEW;
  END IF;
END; $$;

CREATE TRIGGER trg_sync_tx_opening_balance
AFTER INSERT OR UPDATE OR DELETE ON public.opening_balances
FOR EACH ROW EXECUTE FUNCTION public.sync_tx_opening_balance();

-- Sync inventory items into transactions (informational, do NOT affect cash)
CREATE OR REPLACE FUNCTION public.sync_tx_opening_balance_item()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE pname text; pdate date;
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.transactions WHERE source_table='opening_balance_items' AND source_id = OLD.id;
    RETURN OLD;
  END IF;
  SELECT name INTO pname FROM public.products WHERE id = NEW.product_id;
  SELECT date INTO pdate FROM public.opening_balances WHERE id = NEW.opening_balance_id;
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.transactions(user_id, date, type, category, amount, notes, source_table, source_id)
    VALUES (NEW.user_id, COALESCE(pdate, CURRENT_DATE), 'Opening Balance', 'Inventory',
            NEW.quantity * NEW.unit_cost,
            COALESCE(pname, 'Item') || ' × ' || NEW.quantity,
            'opening_balance_items', NEW.id);
    RETURN NEW;
  ELSE
    UPDATE public.transactions
      SET amount = NEW.quantity * NEW.unit_cost,
          notes = COALESCE(pname, 'Item') || ' × ' || NEW.quantity
    WHERE source_table='opening_balance_items' AND source_id = NEW.id;
    RETURN NEW;
  END IF;
END; $$;

CREATE TRIGGER trg_sync_tx_opening_balance_item
AFTER INSERT OR UPDATE OR DELETE ON public.opening_balance_items
FOR EACH ROW EXECUTE FUNCTION public.sync_tx_opening_balance_item();

-- Migrate any existing starting_cash from settings into opening_balances, then zero it out
INSERT INTO public.opening_balances (user_id, cash_amount, date)
SELECT user_id, starting_cash, CURRENT_DATE
FROM public.settings
WHERE starting_cash IS NOT NULL AND starting_cash <> 0
ON CONFLICT (user_id) DO NOTHING;

UPDATE public.settings SET starting_cash = 0 WHERE starting_cash <> 0;
