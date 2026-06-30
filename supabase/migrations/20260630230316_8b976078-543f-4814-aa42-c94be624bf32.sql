
CREATE TABLE public.pre_vendas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token TEXT NOT NULL UNIQUE,
  vendedor_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  vendedor_nome TEXT,
  id_empresa INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pendente',
  expires_at TIMESTAMPTZ NOT NULL,
  submitted_at TIMESTAMPTZ,
  converted_at TIMESTAMPTZ,
  cliente_vendedor_id UUID REFERENCES public.clientes_vendedor(id) ON DELETE SET NULL,
  nome TEXT,
  cpf_cnpj TEXT,
  telefone TEXT,
  email TEXT,
  endereco_cadastro TEXT,
  endereco_cadastro_lat NUMERIC,
  endereco_cadastro_lng NUMERIC,
  endereco_entrega TEXT,
  endereco_entrega_lat NUMERIC,
  endereco_entrega_lng NUMERIC,
  usar_mesmo_endereco BOOLEAN DEFAULT TRUE,
  horario_entrega TEXT,
  tolerancia_min INTEGER DEFAULT 30,
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pre_vendas TO authenticated;
GRANT ALL ON public.pre_vendas TO service_role;

ALTER TABLE public.pre_vendas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "vendedor reads own pre_vendas"
  ON public.pre_vendas FOR SELECT TO authenticated
  USING (vendedor_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "vendedor creates own pre_vendas"
  ON public.pre_vendas FOR INSERT TO authenticated
  WITH CHECK (vendedor_id = auth.uid());

CREATE POLICY "vendedor updates own pre_vendas"
  ON public.pre_vendas FOR UPDATE TO authenticated
  USING (vendedor_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "vendedor deletes own pre_vendas"
  ON public.pre_vendas FOR DELETE TO authenticated
  USING (vendedor_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE TRIGGER trg_pre_vendas_updated_at
  BEFORE UPDATE ON public.pre_vendas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_pre_vendas_vendedor ON public.pre_vendas(vendedor_id);
CREATE INDEX idx_pre_vendas_token ON public.pre_vendas(token);
CREATE INDEX idx_pre_vendas_status ON public.pre_vendas(status);
