-- Fix: Use security_invoker = on (safer) and bypass RLS via a function instead
-- Drop the view and recreate with proper security

DROP VIEW IF EXISTS public.delivered_orders;

-- Create a security definer FUNCTION (not view) to get delivered order numbers
-- This is the recommended pattern for bypassing RLS safely
CREATE OR REPLACE FUNCTION public.get_delivered_order_numbers()
RETURNS TABLE(pedido_dia text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT e.pedido_dia
  FROM public.equipments e;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.get_delivered_order_numbers() TO authenticated;

-- Add comment
COMMENT ON FUNCTION public.get_delivered_order_numbers() IS 'Returns distinct order numbers that have been delivered. No PII exposed. Bypasses RLS to allow all drivers to see delivery status.';