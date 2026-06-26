
ALTER TABLE public.pedidos_venda
  ADD COLUMN IF NOT EXISTS numero_pedido INT,
  ADD COLUMN IF NOT EXISTS documento_cliente TEXT;

CREATE SEQUENCE IF NOT EXISTS public.pedidos_venda_numero_seq START 1;

-- Backfill existing rows
UPDATE public.pedidos_venda
SET numero_pedido = nextval('public.pedidos_venda_numero_seq')
WHERE numero_pedido IS NULL;

ALTER TABLE public.pedidos_venda
  ALTER COLUMN numero_pedido SET DEFAULT nextval('public.pedidos_venda_numero_seq');

ALTER SEQUENCE public.pedidos_venda_numero_seq OWNED BY public.pedidos_venda.numero_pedido;

CREATE UNIQUE INDEX IF NOT EXISTS idx_pedidos_venda_numero ON public.pedidos_venda(numero_pedido);
