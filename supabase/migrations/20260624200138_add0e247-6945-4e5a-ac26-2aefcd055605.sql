
DO $$ BEGIN
  CREATE TYPE public.cliente_vendedor_origem AS ENUM ('erp', 'app', 'app_sincronizado');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.clientes_vendedor
  ADD COLUMN IF NOT EXISTS origem public.cliente_vendedor_origem NOT NULL DEFAULT 'app';

-- Marca como 'erp' os registros que já têm vínculo ERP
UPDATE public.clientes_vendedor
SET origem = 'erp'
WHERE id_cliente_erp IS NOT NULL AND origem = 'app';

-- Garante unicidade do vínculo (vendedor + cliente_erp)
CREATE UNIQUE INDEX IF NOT EXISTS clientes_vendedor_vendedor_erp_uniq
  ON public.clientes_vendedor (vendedor_id, id_cliente_erp)
  WHERE id_cliente_erp IS NOT NULL;
