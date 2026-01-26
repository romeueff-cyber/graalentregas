-- Update confirm_collection function to allow any authenticated user
CREATE OR REPLACE FUNCTION public.confirm_collection(_equipment_id uuid)
RETURNS equipments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  updated_row public.equipments;
BEGIN
  -- Check if equipment exists
  IF NOT EXISTS (SELECT 1 FROM public.equipments WHERE id = _equipment_id) THEN
    RAISE EXCEPTION 'equipment_not_found';
  END IF;
  
  -- Any authenticated user can confirm collection
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;
  
  UPDATE public.equipments
  SET
    status = 'RECOLHIDO',
    data_real_recolha = now(),
    updated_at = now(),
    sync_status = 'synced'
  WHERE id = _equipment_id
  RETURNING * INTO updated_row;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'equipment_not_found_or_not_permitted';
  END IF;

  RETURN updated_row;
END;
$$;

-- Also update the UPDATE policy to allow any authenticated user
DROP POLICY IF EXISTS "Users can update their own equipments or admins can update any" ON public.equipments;

CREATE POLICY "All authenticated users can update all equipments"
ON public.equipments
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

COMMENT ON POLICY "All authenticated users can update all equipments" ON public.equipments 
IS 'All drivers can update any delivery for operational flexibility.';