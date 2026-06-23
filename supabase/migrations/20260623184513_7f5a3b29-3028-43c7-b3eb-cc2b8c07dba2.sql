ALTER TABLE public.clientes_vendedor ALTER COLUMN vendedor_id DROP NOT NULL;

DROP POLICY IF EXISTS clientes_vendedor_select ON public.clientes_vendedor;
DROP POLICY IF EXISTS clientes_vendedor_update ON public.clientes_vendedor;

CREATE POLICY clientes_vendedor_select ON public.clientes_vendedor
  FOR SELECT TO authenticated
  USING (
    vendedor_id IS NULL
    OR vendedor_id = auth.uid()
    OR public.is_admin_or_financeiro(auth.uid())
  );

CREATE POLICY clientes_vendedor_update ON public.clientes_vendedor
  FOR UPDATE TO authenticated
  USING (
    vendedor_id = auth.uid()
    OR public.is_admin_or_financeiro(auth.uid())
  );