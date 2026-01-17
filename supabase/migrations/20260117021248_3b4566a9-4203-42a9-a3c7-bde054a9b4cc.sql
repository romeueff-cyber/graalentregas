-- Add phone number and confirmation token fields to equipments table
ALTER TABLE public.equipments 
ADD COLUMN IF NOT EXISTS telefone_cliente text,
ADD COLUMN IF NOT EXISTS confirmation_token uuid DEFAULT gen_random_uuid(),
ADD COLUMN IF NOT EXISTS token_used_at timestamp with time zone;

-- Create index for fast token lookup
CREATE INDEX IF NOT EXISTS idx_equipments_confirmation_token ON public.equipments(confirmation_token);

-- Create RLS policy for public confirmation (allows updating via token without auth)
CREATE POLICY "Allow public confirmation by token"
ON public.equipments
FOR UPDATE
USING (true)
WITH CHECK (
  confirmation_token IS NOT NULL 
  AND token_used_at IS NULL
);