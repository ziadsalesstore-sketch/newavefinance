
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_tx_stock() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_tx_revenue() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_tx_expense() FROM PUBLIC, anon, authenticated;
