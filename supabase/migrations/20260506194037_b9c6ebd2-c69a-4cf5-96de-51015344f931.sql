
CREATE TABLE public.inventory_adjustments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  date date NOT NULL DEFAULT CURRENT_DATE,
  product_id uuid NOT NULL,
  type text NOT NULL CHECK (type IN ('increase','decrease')),
  quantity numeric NOT NULL DEFAULT 0,
  unit_cost numeric NOT NULL DEFAULT 0,
  note text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.inventory_adjustments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ia all own" ON public.inventory_adjustments
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.sync_tx_inventory_adjustment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE label text; pname text; total numeric;
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.transactions WHERE source_table='inventory_adjustments' AND source_id = OLD.id;
    RETURN OLD;
  END IF;
  SELECT name INTO pname FROM public.products WHERE id = NEW.product_id;
  label := CASE WHEN NEW.type = 'decrease' THEN 'Inventory Adjustment – Decrease' ELSE 'Inventory Adjustment – Increase' END;
  total := NEW.quantity * NEW.unit_cost;
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.transactions(user_id, date, type, category, amount, notes, source_table, source_id)
    VALUES (NEW.user_id, NEW.date, label, 'Inventory Adjustment', total,
            COALESCE(pname,'Item') || ' × ' || NEW.quantity || COALESCE(' — ' || NEW.note, ''),
            'inventory_adjustments', NEW.id);
    RETURN NEW;
  ELSE
    UPDATE public.transactions
      SET date = NEW.date, type = label, amount = total,
          notes = COALESCE(pname,'Item') || ' × ' || NEW.quantity || COALESCE(' — ' || NEW.note, '')
    WHERE source_table='inventory_adjustments' AND source_id = NEW.id;
    RETURN NEW;
  END IF;
END; $$;

CREATE TRIGGER trg_sync_tx_inventory_adjustment
AFTER INSERT OR UPDATE OR DELETE ON public.inventory_adjustments
FOR EACH ROW EXECUTE FUNCTION public.sync_tx_inventory_adjustment();
