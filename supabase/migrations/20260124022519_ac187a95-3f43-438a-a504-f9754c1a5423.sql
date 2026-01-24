-- Fix 1: Restrict user_roles visibility to own role + admin access
DROP POLICY IF EXISTS "Roles are viewable by authenticated users" ON public.user_roles;

-- Users can view their own role
CREATE POLICY "Users can view their own role"
ON public.user_roles FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Admins can view all roles
CREATE POLICY "Admins can view all roles"
ON public.user_roles FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Fix 2: Add token_created_at column for token expiration validation
ALTER TABLE public.equipments 
ADD COLUMN IF NOT EXISTS token_created_at timestamp with time zone DEFAULT now();

-- Create index for expired token cleanup queries
CREATE INDEX IF NOT EXISTS idx_equipments_token_created 
  ON public.equipments(token_created_at) 
  WHERE token_used_at IS NULL;

-- Fix 3: Update confirm_collection function with proper authorization check
CREATE OR REPLACE FUNCTION public.confirm_collection(_equipment_id uuid)
RETURNS public.equipments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  updated_row public.equipments;
  equipment_creator uuid;
BEGIN
  -- Get the equipment's creator
  SELECT created_by_user_id INTO equipment_creator
  FROM public.equipments
  WHERE id = _equipment_id;
  
  IF equipment_creator IS NULL THEN
    RAISE EXCEPTION 'equipment_not_found';
  END IF;
  
  -- Authorization: only creator or admin can confirm collection
  IF auth.uid() != equipment_creator AND NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'not_authorized_to_confirm_collection';
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