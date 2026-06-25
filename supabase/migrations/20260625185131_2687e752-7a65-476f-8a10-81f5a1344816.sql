DROP POLICY IF EXISTS clientes_vendedor_select ON public.clientes_vendedor;
DROP POLICY IF EXISTS clientes_vendedor_insert ON public.clientes_vendedor;
DROP POLICY IF EXISTS clientes_vendedor_update ON public.clientes_vendedor;
DROP POLICY IF EXISTS clientes_vendedor_delete ON public.clientes_vendedor;

CREATE POLICY clientes_vendedor_select ON public.clientes_vendedor
  FOR SELECT TO authenticated
  USING (
    public.user_has_empresa(auth.uid(), id_empresa)
    AND (
      vendedor_id IS NULL
      OR vendedor_id = auth.uid()
      OR public.is_admin_or_financeiro(auth.uid())
    )
  );

CREATE POLICY clientes_vendedor_insert ON public.clientes_vendedor
  FOR INSERT TO authenticated
  WITH CHECK (
    public.user_has_empresa(auth.uid(), id_empresa)
    AND (
      vendedor_id IS NULL
      OR vendedor_id = auth.uid()
      OR public.is_admin_or_financeiro(auth.uid())
    )
  );

CREATE POLICY clientes_vendedor_update ON public.clientes_vendedor
  FOR UPDATE TO authenticated
  USING (
    public.user_has_empresa(auth.uid(), id_empresa)
    AND (
      vendedor_id = auth.uid()
      OR public.is_admin_or_financeiro(auth.uid())
    )
  )
  WITH CHECK (
    public.user_has_empresa(auth.uid(), id_empresa)
    AND (
      vendedor_id = auth.uid()
      OR public.is_admin_or_financeiro(auth.uid())
    )
  );

CREATE POLICY clientes_vendedor_delete ON public.clientes_vendedor
  FOR DELETE TO authenticated
  USING (
    public.user_has_empresa(auth.uid(), id_empresa)
    AND public.is_admin_or_financeiro(auth.uid())
  );

DROP POLICY IF EXISTS pv_select ON public.pedidos_venda;
DROP POLICY IF EXISTS pv_insert ON public.pedidos_venda;
DROP POLICY IF EXISTS pv_update ON public.pedidos_venda;
DROP POLICY IF EXISTS pv_delete ON public.pedidos_venda;

CREATE POLICY pv_select ON public.pedidos_venda
  FOR SELECT TO authenticated
  USING (
    public.user_has_empresa(auth.uid(), id_empresa)
    AND (
      vendedor_id = auth.uid()
      OR public.is_admin_or_financeiro(auth.uid())
      OR (public.has_role(auth.uid(), 'entregador'::public.app_role) AND status IN ('aprovado', 'entregue'))
    )
  );

CREATE POLICY pv_insert ON public.pedidos_venda
  FOR INSERT TO authenticated
  WITH CHECK (
    vendedor_id = auth.uid()
    AND public.user_has_empresa(auth.uid(), id_empresa)
  );

CREATE POLICY pv_update ON public.pedidos_venda
  FOR UPDATE TO authenticated
  USING (
    public.user_has_empresa(auth.uid(), id_empresa)
    AND (
      (vendedor_id = auth.uid() AND status = 'pendente_aprovacao')
      OR public.is_admin_or_financeiro(auth.uid())
    )
  )
  WITH CHECK (
    public.user_has_empresa(auth.uid(), id_empresa)
    AND (
      (vendedor_id = auth.uid() AND status = 'pendente_aprovacao')
      OR public.is_admin_or_financeiro(auth.uid())
    )
  );

CREATE POLICY pv_delete ON public.pedidos_venda
  FOR DELETE TO authenticated
  USING (
    public.user_has_empresa(auth.uid(), id_empresa)
    AND (
      (vendedor_id = auth.uid() AND status = 'pendente_aprovacao')
      OR public.is_admin_or_financeiro(auth.uid())
    )
  );

DROP POLICY IF EXISTS pvi_select ON public.pedidos_venda_itens;
DROP POLICY IF EXISTS pvi_all ON public.pedidos_venda_itens;

CREATE POLICY pvi_select ON public.pedidos_venda_itens
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.pedidos_venda pv
      WHERE pv.id = pedido_id
        AND public.user_has_empresa(auth.uid(), pv.id_empresa)
        AND (
          pv.vendedor_id = auth.uid()
          OR public.is_admin_or_financeiro(auth.uid())
          OR (public.has_role(auth.uid(), 'entregador'::public.app_role) AND pv.status IN ('aprovado', 'entregue'))
        )
    )
  );

CREATE POLICY pvi_all ON public.pedidos_venda_itens
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.pedidos_venda pv
      WHERE pv.id = pedido_id
        AND public.user_has_empresa(auth.uid(), pv.id_empresa)
        AND (
          (pv.vendedor_id = auth.uid() AND pv.status = 'pendente_aprovacao')
          OR public.is_admin_or_financeiro(auth.uid())
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.pedidos_venda pv
      WHERE pv.id = pedido_id
        AND public.user_has_empresa(auth.uid(), pv.id_empresa)
        AND (
          (pv.vendedor_id = auth.uid() AND pv.status = 'pendente_aprovacao')
          OR public.is_admin_or_financeiro(auth.uid())
        )
    )
  );