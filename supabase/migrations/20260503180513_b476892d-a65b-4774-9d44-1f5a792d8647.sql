
-- Profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  display_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own profile select" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "own profile update" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "own profile insert" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Settings (one row per user)
CREATE TABLE public.settings (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  starting_cash NUMERIC NOT NULL DEFAULT 0,
  sales_tracking_mode TEXT NOT NULL DEFAULT 'per_payout',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "settings all own" ON public.settings FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Transactions
CREATE TABLE public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  type TEXT NOT NULL,
  category TEXT,
  amount NUMERIC NOT NULL DEFAULT 0,
  notes TEXT,
  source_table TEXT,
  source_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tx all own" ON public.transactions FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX ON public.transactions(user_id, date);

-- Stock purchases
CREATE TABLE public.stock_purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  product_name TEXT NOT NULL,
  quantity NUMERIC NOT NULL CHECK (quantity > 0),
  total_cost NUMERIC NOT NULL CHECK (total_cost >= 0),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.stock_purchases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "stock all own" ON public.stock_purchases FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Revenue payouts
CREATE TABLE public.revenue_payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  expected_amount NUMERIC NOT NULL DEFAULT 0,
  received_amount NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'received',
  units_sold NUMERIC,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.revenue_payouts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rev all own" ON public.revenue_payouts FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Expenses
CREATE TABLE public.expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  category TEXT NOT NULL,
  amount NUMERIC NOT NULL CHECK (amount >= 0),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "exp all own" ON public.expenses FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Sales records
CREATE TABLE public.sales_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  units_sold NUMERIC NOT NULL DEFAULT 0,
  period_type TEXT NOT NULL DEFAULT 'monthly',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.sales_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sales all own" ON public.sales_records FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- New user trigger: create profile + settings
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email) VALUES (NEW.id, NEW.email);
  INSERT INTO public.settings (user_id) VALUES (NEW.id);
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Auto transactions from stock_purchases
CREATE OR REPLACE FUNCTION public.sync_tx_stock()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.transactions WHERE source_table='stock_purchases' AND source_id = OLD.id;
    RETURN OLD;
  ELSIF TG_OP = 'INSERT' THEN
    INSERT INTO public.transactions(user_id, date, type, category, amount, notes, source_table, source_id)
    VALUES (NEW.user_id, NEW.date, 'Stock Purchase', 'Inventory', NEW.total_cost, NEW.product_name, 'stock_purchases', NEW.id);
    RETURN NEW;
  ELSE
    UPDATE public.transactions
    SET date=NEW.date, amount=NEW.total_cost, notes=NEW.product_name
    WHERE source_table='stock_purchases' AND source_id = NEW.id;
    RETURN NEW;
  END IF;
END;
$$;
CREATE TRIGGER trg_tx_stock
AFTER INSERT OR UPDATE OR DELETE ON public.stock_purchases
FOR EACH ROW EXECUTE FUNCTION public.sync_tx_stock();

-- Auto transactions from revenue_payouts
CREATE OR REPLACE FUNCTION public.sync_tx_revenue()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.transactions WHERE source_table='revenue_payouts' AND source_id = OLD.id;
    RETURN OLD;
  ELSIF TG_OP = 'INSERT' THEN
    INSERT INTO public.transactions(user_id, date, type, category, amount, notes, source_table, source_id)
    VALUES (NEW.user_id, NEW.date, 'Revenue', 'Sales', NEW.received_amount, NEW.notes, 'revenue_payouts', NEW.id);
    RETURN NEW;
  ELSE
    UPDATE public.transactions
    SET date=NEW.date, amount=NEW.received_amount, notes=NEW.notes
    WHERE source_table='revenue_payouts' AND source_id = NEW.id;
    RETURN NEW;
  END IF;
END;
$$;
CREATE TRIGGER trg_tx_revenue
AFTER INSERT OR UPDATE OR DELETE ON public.revenue_payouts
FOR EACH ROW EXECUTE FUNCTION public.sync_tx_revenue();

-- Auto transactions from expenses
CREATE OR REPLACE FUNCTION public.sync_tx_expense()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.transactions WHERE source_table='expenses' AND source_id = OLD.id;
    RETURN OLD;
  ELSIF TG_OP = 'INSERT' THEN
    INSERT INTO public.transactions(user_id, date, type, category, amount, notes, source_table, source_id)
    VALUES (NEW.user_id, NEW.date, 'Expense', NEW.category, NEW.amount, NEW.notes, 'expenses', NEW.id);
    RETURN NEW;
  ELSE
    UPDATE public.transactions
    SET date=NEW.date, category=NEW.category, amount=NEW.amount, notes=NEW.notes
    WHERE source_table='expenses' AND source_id = NEW.id;
    RETURN NEW;
  END IF;
END;
$$;
CREATE TRIGGER trg_tx_expense
AFTER INSERT OR UPDATE OR DELETE ON public.expenses
FOR EACH ROW EXECUTE FUNCTION public.sync_tx_expense();
