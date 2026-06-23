
DROP POLICY IF EXISTS pv_insert ON public.pedidos_venda;
CREATE POLICY pv_insert ON public.pedidos_venda
  FOR INSERT TO authenticated
  WITH CHECK (vendedor_id = auth.uid());

DROP POLICY IF EXISTS clientes_vendedor_insert ON public.clientes_vendedor;
CREATE POLICY clientes_vendedor_insert ON public.clientes_vendedor
  FOR INSERT TO authenticated
  WITH CHECK (vendedor_id IS NULL OR vendedor_id = auth.uid() OR is_admin_or_financeiro(auth.uid()));
