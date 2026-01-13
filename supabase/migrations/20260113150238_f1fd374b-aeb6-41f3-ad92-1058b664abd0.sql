-- Add new period option DIA_TODO to collection_period enum
ALTER TYPE collection_period ADD VALUE IF NOT EXISTS 'DIA_TODO' BEFORE 'MANHA';

-- Add new period option CLIENTE_IRA_AVISAR for when client will notify
ALTER TYPE collection_period ADD VALUE IF NOT EXISTS 'CLIENTE_IRA_AVISAR' AFTER 'NOITE';

-- Add column to track if client will notify (cliente irá avisar)
ALTER TABLE public.equipments 
ADD COLUMN IF NOT EXISTS cliente_ira_avisar BOOLEAN NOT NULL DEFAULT false;