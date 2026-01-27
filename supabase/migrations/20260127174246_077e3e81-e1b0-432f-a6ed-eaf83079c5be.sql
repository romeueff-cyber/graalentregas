-- Add DELETE policy for equipments table
-- Allow all authenticated users to delete equipments (same pattern as UPDATE)
CREATE POLICY "All authenticated users can delete equipments"
ON public.equipments
FOR DELETE
TO authenticated
USING (true);