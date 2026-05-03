
-- 1. Products table
CREATE TABLE public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  sku text,
  category text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "products all own" ON public.products FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 2. Stock purchase items
CREATE TABLE public.stock_purchase_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  stock_purchase_id uuid NOT NULL REFERENCES public.stock_purchases(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  quantity numeric NOT NULL,
  total_cost numeric NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.stock_purchase_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "spi all own" ON public.stock_purchase_items FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_spi_purchase ON public.stock_purchase_items(stock_purchase_id);
CREATE INDEX idx_spi_product ON public.stock_purchase_items(product_id);

-- 3. Sales items
CREATE TABLE public.sales_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  sales_record_id uuid NOT NULL REFERENCES public.sales_records(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  units_sold numeric NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.sales_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "si all own" ON public.sales_items FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_si_record ON public.sales_items(sales_record_id);
CREATE INDEX idx_si_product ON public.sales_items(product_id);

-- 4. Revenue payout items
CREATE TABLE public.revenue_payout_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  revenue_payout_id uuid NOT NULL REFERENCES public.revenue_payouts(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  units_sold numeric NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.revenue_payout_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rpi all own" ON public.revenue_payout_items FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_rpi_payout ON public.revenue_payout_items(revenue_payout_id);
CREATE INDEX idx_rpi_product ON public.revenue_payout_items(product_id);

-- 5. Make legacy stock_purchases fields nullable (parent now aggregates from items)
ALTER TABLE public.stock_purchases ALTER COLUMN product_name DROP NOT NULL;
ALTER TABLE public.stock_purchases ALTER COLUMN quantity DROP NOT NULL;
ALTER TABLE public.stock_purchases ALTER COLUMN total_cost DROP NOT NULL;
ALTER TABLE public.stock_purchases ALTER COLUMN total_cost SET DEFAULT 0;
ALTER TABLE public.stock_purchases ALTER COLUMN quantity SET DEFAULT 0;

-- 6. Trigger: recompute stock_purchases.total_cost & quantity when items change
CREATE OR REPLACE FUNCTION public.recompute_stock_purchase_totals()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  pid uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    pid := OLD.stock_purchase_id;
  ELSE
    pid := NEW.stock_purchase_id;
  END IF;
  UPDATE public.stock_purchases sp
  SET total_cost = COALESCE((SELECT SUM(total_cost) FROM public.stock_purchase_items WHERE stock_purchase_id = pid), 0),
      quantity   = COALESCE((SELECT SUM(quantity)   FROM public.stock_purchase_items WHERE stock_purchase_id = pid), 0),
      product_name = (SELECT string_agg(p.name, ', ') FROM public.stock_purchase_items spi JOIN public.products p ON p.id = spi.product_id WHERE spi.stock_purchase_id = pid)
  WHERE sp.id = pid;
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER trg_spi_recompute
AFTER INSERT OR UPDATE OR DELETE ON public.stock_purchase_items
FOR EACH ROW EXECUTE FUNCTION public.recompute_stock_purchase_totals();
