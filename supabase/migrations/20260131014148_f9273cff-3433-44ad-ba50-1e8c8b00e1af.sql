-- Add reconciliation fields to boletos table
ALTER TABLE public.boletos
ADD COLUMN IF NOT EXISTS reconciled boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS reconciled_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS reconciled_by_user_id uuid;

-- Add index for faster filtering of unreconciled paid boletos
CREATE INDEX IF NOT EXISTS idx_boletos_reconciliation 
ON public.boletos (status, reconciled) 
WHERE status = 'PAID' AND reconciled = false;

-- Add comment for documentation
COMMENT ON COLUMN public.boletos.reconciled IS 'Indicates if the boleto payment has been reconciled in the ERP system';
COMMENT ON COLUMN public.boletos.reconciled_at IS 'Timestamp when the boleto was marked as reconciled';
COMMENT ON COLUMN public.boletos.reconciled_by_user_id IS 'User who marked the boleto as reconciled';