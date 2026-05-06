
-- Influencer marketing campaigns: consume inventory, optionally add cash expense
CREATE TABLE public.marketing_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  date date NOT NULL DEFAULT CURRENT_DATE,
  extra_cost numeric NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.marketing_campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mc all own" ON public.marketing_campaigns FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.marketing_campaign_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  campaign_id uuid NOT NULL REFERENCES public.marketing_campaigns(id) ON DELETE CASCADE,
  product_id uuid NOT NULL,
  quantity numeric NOT NULL DEFAULT 0,
  unit_cost numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.marketing_campaign_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mci all own" ON public.marketing_campaign_items FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Trigger: sync transactions for the cash extra_cost portion (acts as a real Expense affecting cash)
CREATE OR REPLACE FUNCTION public.sync_tx_marketing_campaign()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.transactions WHERE source_table='marketing_campaigns' AND source_id = OLD.id;
    RETURN OLD;
  ELSIF TG_OP = 'INSERT' THEN
    IF NEW.extra_cost > 0 THEN
      INSERT INTO public.transactions(user_id, date, type, category, amount, notes, source_table, source_id)
      VALUES (NEW.user_id, NEW.date, 'Expense', 'Influencer Marketing', NEW.extra_cost, COALESCE(NEW.notes,'Campaign extra cost'), 'marketing_campaigns', NEW.id);
    END IF;
    RETURN NEW;
  ELSE
    DELETE FROM public.transactions WHERE source_table='marketing_campaigns' AND source_id = NEW.id;
    IF NEW.extra_cost > 0 THEN
      INSERT INTO public.transactions(user_id, date, type, category, amount, notes, source_table, source_id)
      VALUES (NEW.user_id, NEW.date, 'Expense', 'Influencer Marketing', NEW.extra_cost, COALESCE(NEW.notes,'Campaign extra cost'), 'marketing_campaigns', NEW.id);
    END IF;
    RETURN NEW;
  END IF;
END; $$;
CREATE TRIGGER trg_sync_tx_marketing_campaign
AFTER INSERT OR UPDATE OR DELETE ON public.marketing_campaigns
FOR EACH ROW EXECUTE FUNCTION public.sync_tx_marketing_campaign();

-- Trigger: log inventory consumption as informational transactions (do NOT count toward cash; report layer handles inventory + P&L)
CREATE OR REPLACE FUNCTION public.sync_tx_marketing_item()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE pname text; pdate date;
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.transactions WHERE source_table='marketing_campaign_items' AND source_id = OLD.id;
    RETURN OLD;
  END IF;
  SELECT name INTO pname FROM public.products WHERE id = NEW.product_id;
  SELECT date INTO pdate FROM public.marketing_campaigns WHERE id = NEW.campaign_id;
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.transactions(user_id, date, type, category, amount, notes, source_table, source_id)
    VALUES (NEW.user_id, COALESCE(pdate, CURRENT_DATE), 'Inventory Used', 'Influencer Marketing',
            NEW.quantity * NEW.unit_cost,
            COALESCE(pname,'Item') || ' × ' || NEW.quantity,
            'marketing_campaign_items', NEW.id);
    RETURN NEW;
  ELSE
    UPDATE public.transactions
      SET amount = NEW.quantity * NEW.unit_cost,
          notes = COALESCE(pname,'Item') || ' × ' || NEW.quantity
    WHERE source_table='marketing_campaign_items' AND source_id = NEW.id;
    RETURN NEW;
  END IF;
END; $$;
CREATE TRIGGER trg_sync_tx_marketing_item
AFTER INSERT OR UPDATE OR DELETE ON public.marketing_campaign_items
FOR EACH ROW EXECUTE FUNCTION public.sync_tx_marketing_item();
