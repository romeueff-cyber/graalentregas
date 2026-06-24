
ALTER TABLE public.pedidos_venda_itens
  ADD COLUMN IF NOT EXISTS tipo TEXT NOT NULL DEFAULT 'produto',
  ADD COLUMN IF NOT EXISTS id_produto_erp TEXT,
  ADD COLUMN IF NOT EXISTS id_tipo_equipamento_erp TEXT,
  ADD COLUMN IF NOT EXISTS preco_unitario NUMERIC,
  ADD COLUMN IF NOT EXISTS desconto NUMERIC;

ALTER TABLE public.pedidos_venda_itens
  DROP CONSTRAINT IF EXISTS pedidos_venda_itens_tipo_check;
ALTER TABLE public.pedidos_venda_itens
  ADD CONSTRAINT pedidos_venda_itens_tipo_check CHECK (tipo IN ('produto','equipamento'));
