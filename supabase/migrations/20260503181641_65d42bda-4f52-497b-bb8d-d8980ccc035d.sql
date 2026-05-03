
-- Rename expected_amount to earned_amount on revenue_payouts
ALTER TABLE public.revenue_payouts RENAME COLUMN expected_amount TO earned_amount;

-- Update revenue sync trigger to record TWO transactions: Revenue (earned) + Cash Inflow (received)
CREATE OR REPLACE FUNCTION public.sync_tx_revenue()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.transactions WHERE source_table='revenue_payouts' AND source_id = OLD.id;
    RETURN OLD;
  ELSIF TG_OP = 'INSERT' THEN
    -- Revenue (earned) transaction
    INSERT INTO public.transactions(user_id, date, type, category, amount, notes, source_table, source_id)
    VALUES (NEW.user_id, NEW.date, 'Revenue', 'Sales Revenue', NEW.earned_amount, NEW.notes, 'revenue_payouts', NEW.id);
    -- Cash inflow transaction (only if received > 0)
    IF COALESCE(NEW.received_amount,0) > 0 THEN
      INSERT INTO public.transactions(user_id, date, type, category, amount, notes, source_table, source_id)
      VALUES (NEW.user_id, NEW.date, 'Cash Inflow', 'Cash', NEW.received_amount, NEW.notes, 'revenue_payouts', NEW.id);
    END IF;
    RETURN NEW;
  ELSE
    -- Re-sync: delete and re-insert to keep things simple and consistent
    DELETE FROM public.transactions WHERE source_table='revenue_payouts' AND source_id = NEW.id;
    INSERT INTO public.transactions(user_id, date, type, category, amount, notes, source_table, source_id)
    VALUES (NEW.user_id, NEW.date, 'Revenue', 'Sales Revenue', NEW.earned_amount, NEW.notes, 'revenue_payouts', NEW.id);
    IF COALESCE(NEW.received_amount,0) > 0 THEN
      INSERT INTO public.transactions(user_id, date, type, category, amount, notes, source_table, source_id)
      VALUES (NEW.user_id, NEW.date, 'Cash Inflow', 'Cash', NEW.received_amount, NEW.notes, 'revenue_payouts', NEW.id);
    END IF;
    RETURN NEW;
  END IF;
END;
$function$;

-- Backfill: rebuild transactions for existing revenue_payouts so they reflect the new dual-transaction model
DELETE FROM public.transactions WHERE source_table = 'revenue_payouts';
INSERT INTO public.transactions(user_id, date, type, category, amount, notes, source_table, source_id)
SELECT user_id, date, 'Revenue', 'Sales Revenue', earned_amount, notes, 'revenue_payouts', id
FROM public.revenue_payouts;
INSERT INTO public.transactions(user_id, date, type, category, amount, notes, source_table, source_id)
SELECT user_id, date, 'Cash Inflow', 'Cash', received_amount, notes, 'revenue_payouts', id
FROM public.revenue_payouts WHERE COALESCE(received_amount,0) > 0;
