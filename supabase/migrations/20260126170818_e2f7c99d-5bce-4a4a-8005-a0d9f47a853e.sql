-- Create a view that exposes ONLY order numbers (no PII) for delivery status checks
-- This allows all authenticated users to see if an order was delivered without exposing customer data

CREATE OR REPLACE VIEW public.delivered_orders
WITH (security_invoker = off) AS
SELECT DISTINCT pedido_dia
FROM public.equipments;

-- Grant SELECT access to authenticated users
GRANT SELECT ON public.delivered_orders TO authenticated;

-- Add a comment explaining the purpose
COMMENT ON VIEW public.delivered_orders IS 'Public view of delivered order numbers only (no PII). Used to check if an ERP order has been delivered by any driver.';