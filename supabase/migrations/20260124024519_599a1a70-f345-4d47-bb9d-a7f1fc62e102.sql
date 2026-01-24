-- Fix: Restrict equipment visibility - users see only their own, admins see all
-- This prevents customer PII (nome_cliente, telefone_cliente) from being exposed to all employees

-- Drop the overly permissive SELECT policy
DROP POLICY IF EXISTS "Equipments are viewable by authenticated users" ON public.equipments;

-- Create new restrictive SELECT policy: users see their own equipment, admins see all
CREATE POLICY "Users can view their own equipments or admins can view all"
ON public.equipments
FOR SELECT
TO authenticated
USING (
  created_by_user_id = auth.uid() 
  OR public.has_role(auth.uid(), 'admin')
);