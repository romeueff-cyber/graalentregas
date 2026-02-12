
-- Add cost configuration fields to settings table
ALTER TABLE public.settings
ADD COLUMN custo_por_km numeric NOT NULL DEFAULT 1.50,
ADD COLUMN custo_por_hora numeric NOT NULL DEFAULT 25.00,
ADD COLUMN custo_fixo_parada numeric NOT NULL DEFAULT 10.00;
