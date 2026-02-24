
-- Add boleto configuration columns to settings
ALTER TABLE public.settings
  ADD COLUMN IF NOT EXISTS boleto_multa_tipo text NOT NULL DEFAULT 'PERCENTUAL',
  ADD COLUMN IF NOT EXISTS boleto_multa_valor numeric NOT NULL DEFAULT 2.00,
  ADD COLUMN IF NOT EXISTS boleto_multa_ativo boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS boleto_juros_taxa numeric NOT NULL DEFAULT 1.00,
  ADD COLUMN IF NOT EXISTS boleto_juros_ativo boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS boleto_desconto_tipo text NOT NULL DEFAULT 'FIXED',
  ADD COLUMN IF NOT EXISTS boleto_desconto_valor numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS boleto_desconto_ativo boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS boleto_producao boolean NOT NULL DEFAULT false;
