ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS starting_qty numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS starting_unit_cost numeric NOT NULL DEFAULT 0;