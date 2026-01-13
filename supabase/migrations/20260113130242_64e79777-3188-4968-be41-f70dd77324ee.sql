-- Fix function search path for update_updated_at_column
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Drop overly permissive policy for equipments update
DROP POLICY IF EXISTS "Authenticated users can update equipments" ON public.equipments;

-- Create more restrictive policy - users can update equipment they created or admins can update any
CREATE POLICY "Users can update their own equipments or admins can update any"
ON public.equipments FOR UPDATE
TO authenticated
USING (
  created_by_user_id = auth.uid() OR public.has_role(auth.uid(), 'admin')
);