-- Create a secure backend function to confirm collection (bypasses row-level restrictions safely)
CREATE OR REPLACE FUNCTION public.confirm_collection(_equipment_id uuid)
RETURNS public.equipments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  updated_row public.equipments;
BEGIN
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

-- Lock down who can call it
REVOKE ALL ON FUNCTION public.confirm_collection(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.confirm_collection(uuid) TO authenticated;