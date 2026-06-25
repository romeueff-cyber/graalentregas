
-- 1. Tabela user_companies (acesso de usuário a empresas)
CREATE TABLE public.user_companies (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  empresa_id INT NOT NULL CHECK (empresa_id IN (1, 3)),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, empresa_id)
);

GRANT SELECT ON public.user_companies TO authenticated;
GRANT ALL ON public.user_companies TO service_role;

ALTER TABLE public.user_companies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own companies"
  ON public.user_companies FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins manage companies"
  ON public.user_companies FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- 2. Funções de checagem
CREATE OR REPLACE FUNCTION public.get_user_empresas(_user_id UUID)
RETURNS INT[]
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE(ARRAY_AGG(empresa_id ORDER BY empresa_id), ARRAY[]::INT[])
  FROM public.user_companies WHERE user_id = _user_id;
$$;

CREATE OR REPLACE FUNCTION public.user_has_empresa(_user_id UUID, _empresa_id INT)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.has_role(_user_id, 'admin'::public.app_role)
    OR EXISTS (
      SELECT 1 FROM public.user_companies
      WHERE user_id = _user_id AND empresa_id = _empresa_id
    );
$$;

-- 3. Adicionar id_empresa nas tabelas que recebem dados do ERP
ALTER TABLE public.clientes_vendedor ADD COLUMN IF NOT EXISTS id_empresa INT NOT NULL DEFAULT 1;
ALTER TABLE public.pedidos_venda     ADD COLUMN IF NOT EXISTS id_empresa INT NOT NULL DEFAULT 1;
ALTER TABLE public.boletos           ADD COLUMN IF NOT EXISTS id_empresa INT NOT NULL DEFAULT 1;
ALTER TABLE public.equipments        ADD COLUMN IF NOT EXISTS id_empresa INT NOT NULL DEFAULT 1;

CREATE INDEX IF NOT EXISTS idx_clientes_vendedor_empresa ON public.clientes_vendedor(id_empresa);
CREATE INDEX IF NOT EXISTS idx_pedidos_venda_empresa     ON public.pedidos_venda(id_empresa);
CREATE INDEX IF NOT EXISTS idx_boletos_empresa           ON public.boletos(id_empresa);
CREATE INDEX IF NOT EXISTS idx_equipments_empresa        ON public.equipments(id_empresa);

-- 4. Backfill: dar acesso à empresa 1 para todos os usuários existentes
INSERT INTO public.user_companies (user_id, empresa_id)
SELECT id, 1 FROM auth.users
ON CONFLICT DO NOTHING;
