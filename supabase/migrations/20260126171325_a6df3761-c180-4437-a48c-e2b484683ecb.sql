-- Drop old restrictive SELECT policy
DROP POLICY IF EXISTS "Users can view their own equipments or admins can view all" ON public.equipments;

-- Create new policy: ALL authenticated users can view ALL equipments
CREATE POLICY "All authenticated users can view all equipments"
ON public.equipments
FOR SELECT
TO authenticated
USING (true);

-- Add comment explaining the change
COMMENT ON POLICY "All authenticated users can view all equipments" ON public.equipments 
IS 'All drivers can see all deliveries and their statuses for operational visibility.';