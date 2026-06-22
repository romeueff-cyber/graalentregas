
-- Helper: admin ou financeiro
CREATE OR REPLACE FUNCTION public.is_admin_or_financeiro(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role IN ('admin'::public.app_role, 'financeiro'::public.app_role)
  )
$$;

-- 1. clientes_vendedor
CREATE TABLE public.clientes_vendedor (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendedor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nome text NOT NULL,
  nome_fantasia text,
  cpf_cnpj text NOT NULL,
  endereco text NOT NULL,
  telefone text,
  email text,
  latitude numeric,
  longitude numeric,
  observacoes text,
  id_cliente_erp text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.clientes_vendedor TO authenticated;
GRANT ALL ON public.clientes_vendedor TO service_role;

ALTER TABLE public.clientes_vendedor ENABLE ROW LEVEL SECURITY;

CREATE POLICY "clientes_vendedor_select" ON public.clientes_vendedor FOR SELECT TO authenticated
  USING (vendedor_id = auth.uid() OR public.is_admin_or_financeiro(auth.uid()));

CREATE POLICY "clientes_vendedor_insert" ON public.clientes_vendedor FOR INSERT TO authenticated
  WITH CHECK (vendedor_id = auth.uid() AND public.has_role(auth.uid(), 'vendedor'::public.app_role));

CREATE POLICY "clientes_vendedor_update" ON public.clientes_vendedor FOR UPDATE TO authenticated
  USING (vendedor_id = auth.uid() OR public.is_admin_or_financeiro(auth.uid()));

CREATE POLICY "clientes_vendedor_delete" ON public.clientes_vendedor FOR DELETE TO authenticated
  USING (public.is_admin_or_financeiro(auth.uid()));

CREATE TRIGGER trg_clientes_vendedor_updated
  BEFORE UPDATE ON public.clientes_vendedor
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. vendedor_clientes_erp
CREATE TABLE public.vendedor_clientes_erp (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendedor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  id_cliente_erp text NOT NULL UNIQUE,
  nome_cliente text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.vendedor_clientes_erp TO authenticated;
GRANT ALL ON public.vendedor_clientes_erp TO service_role;

ALTER TABLE public.vendedor_clientes_erp ENABLE ROW LEVEL SECURITY;

CREATE POLICY "vc_erp_select" ON public.vendedor_clientes_erp FOR SELECT TO authenticated
  USING (vendedor_id = auth.uid() OR public.is_admin_or_financeiro(auth.uid()));

CREATE POLICY "vc_erp_admin_all" ON public.vendedor_clientes_erp FOR ALL TO authenticated
  USING (public.is_admin_or_financeiro(auth.uid()))
  WITH CHECK (public.is_admin_or_financeiro(auth.uid()));

-- 3. pedidos_venda
CREATE TYPE public.pedido_venda_status AS ENUM (
  'pendente_aprovacao', 'aprovado', 'recusado', 'cancelado', 'entregue'
);

CREATE TABLE public.pedidos_venda (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendedor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  id_cliente_erp text,
  cliente_vendedor_id uuid REFERENCES public.clientes_vendedor(id) ON DELETE RESTRICT,
  nome_cliente text NOT NULL,
  data_entrega date NOT NULL,
  horario_entrega text,
  endereco_entrega text NOT NULL,
  latitude numeric,
  longitude numeric,
  observacoes text,
  status public.pedido_venda_status NOT NULL DEFAULT 'pendente_aprovacao',
  motivo_recusa text,
  aprovado_por uuid REFERENCES auth.users(id),
  aprovado_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT cliente_origem_unica CHECK (
    (id_cliente_erp IS NOT NULL AND cliente_vendedor_id IS NULL) OR
    (id_cliente_erp IS NULL AND cliente_vendedor_id IS NOT NULL)
  )
);

CREATE INDEX idx_pv_vendedor ON public.pedidos_venda(vendedor_id);
CREATE INDEX idx_pv_status ON public.pedidos_venda(status);
CREATE INDEX idx_pv_data ON public.pedidos_venda(data_entrega);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pedidos_venda TO authenticated;
GRANT ALL ON public.pedidos_venda TO service_role;

ALTER TABLE public.pedidos_venda ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pv_select" ON public.pedidos_venda FOR SELECT TO authenticated
  USING (
    vendedor_id = auth.uid()
    OR public.is_admin_or_financeiro(auth.uid())
    OR (public.has_role(auth.uid(), 'entregador'::public.app_role) AND status IN ('aprovado', 'entregue'))
  );

CREATE POLICY "pv_insert" ON public.pedidos_venda FOR INSERT TO authenticated
  WITH CHECK (vendedor_id = auth.uid() AND public.has_role(auth.uid(), 'vendedor'::public.app_role));

CREATE POLICY "pv_update" ON public.pedidos_venda FOR UPDATE TO authenticated
  USING (
    (vendedor_id = auth.uid() AND status = 'pendente_aprovacao')
    OR public.is_admin_or_financeiro(auth.uid())
  );

CREATE POLICY "pv_delete" ON public.pedidos_venda FOR DELETE TO authenticated
  USING (
    (vendedor_id = auth.uid() AND status = 'pendente_aprovacao')
    OR public.is_admin_or_financeiro(auth.uid())
  );

CREATE TRIGGER trg_pv_updated
  BEFORE UPDATE ON public.pedidos_venda
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. pedidos_venda_itens
CREATE TABLE public.pedidos_venda_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id uuid NOT NULL REFERENCES public.pedidos_venda(id) ON DELETE CASCADE,
  produto text NOT NULL,
  quantidade numeric NOT NULL DEFAULT 1,
  observacao text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_pvi_pedido ON public.pedidos_venda_itens(pedido_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pedidos_venda_itens TO authenticated;
GRANT ALL ON public.pedidos_venda_itens TO service_role;

ALTER TABLE public.pedidos_venda_itens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pvi_select" ON public.pedidos_venda_itens FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.pedidos_venda pv WHERE pv.id = pedido_id AND (
        pv.vendedor_id = auth.uid()
        OR public.is_admin_or_financeiro(auth.uid())
        OR (public.has_role(auth.uid(), 'entregador'::public.app_role) AND pv.status IN ('aprovado', 'entregue'))
      )
    )
  );

CREATE POLICY "pvi_all" ON public.pedidos_venda_itens FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.pedidos_venda pv WHERE pv.id = pedido_id AND (
        (pv.vendedor_id = auth.uid() AND pv.status = 'pendente_aprovacao')
        OR public.is_admin_or_financeiro(auth.uid())
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.pedidos_venda pv WHERE pv.id = pedido_id AND (
        (pv.vendedor_id = auth.uid() AND pv.status = 'pendente_aprovacao')
        OR public.is_admin_or_financeiro(auth.uid())
      )
    )
  );
