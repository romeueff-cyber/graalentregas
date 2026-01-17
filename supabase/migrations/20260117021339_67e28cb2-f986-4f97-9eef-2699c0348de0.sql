-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Allow public confirmation by token" ON public.equipments;