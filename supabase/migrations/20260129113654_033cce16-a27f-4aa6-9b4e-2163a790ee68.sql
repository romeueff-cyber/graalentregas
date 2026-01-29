-- Create enum for equipment types
CREATE TYPE public.hygiene_equipment_type AS ENUM ('chopeira', 'kegotater');

-- Create enum for service types
CREATE TYPE public.hygiene_service_type AS ENUM ('limpeza', 'troca');

-- Create hygiene_clients table
CREATE TABLE public.hygiene_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome_cliente TEXT NOT NULL,
  telefone_cliente TEXT,
  endereco TEXT NOT NULL,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  intervalo_limpeza_dias INTEGER NOT NULL DEFAULT 30,
  observacoes TEXT,
  created_by_user_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create hygiene_equipment table
CREATE TABLE public.hygiene_equipment (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.hygiene_clients(id) ON DELETE CASCADE,
  tipo_equipamento public.hygiene_equipment_type NOT NULL,
  numero_serie TEXT NOT NULL,
  ultima_limpeza DATE,
  proxima_limpeza DATE,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create hygiene_services table
CREATE TABLE public.hygiene_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  equipment_id UUID NOT NULL REFERENCES public.hygiene_equipment(id) ON DELETE CASCADE,
  tipo_servico public.hygiene_service_type NOT NULL,
  data_servico TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  foto_url TEXT,
  observacoes TEXT,
  motivo_troca TEXT,
  novo_numero_serie TEXT,
  executado_por_user_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.hygiene_clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hygiene_equipment ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hygiene_services ENABLE ROW LEVEL SECURITY;

-- RLS policies for hygiene_clients (all authenticated users can view and manage)
CREATE POLICY "All authenticated users can view hygiene clients"
ON public.hygiene_clients FOR SELECT
USING (true);

CREATE POLICY "Authenticated users can create hygiene clients"
ON public.hygiene_clients FOR INSERT
WITH CHECK (auth.uid() = created_by_user_id);

CREATE POLICY "All authenticated users can update hygiene clients"
ON public.hygiene_clients FOR UPDATE
USING (true) WITH CHECK (true);

CREATE POLICY "All authenticated users can delete hygiene clients"
ON public.hygiene_clients FOR DELETE
USING (true);

-- RLS policies for hygiene_equipment
CREATE POLICY "All authenticated users can view hygiene equipment"
ON public.hygiene_equipment FOR SELECT
USING (true);

CREATE POLICY "All authenticated users can create hygiene equipment"
ON public.hygiene_equipment FOR INSERT
WITH CHECK (true);

CREATE POLICY "All authenticated users can update hygiene equipment"
ON public.hygiene_equipment FOR UPDATE
USING (true) WITH CHECK (true);

CREATE POLICY "All authenticated users can delete hygiene equipment"
ON public.hygiene_equipment FOR DELETE
USING (true);

-- RLS policies for hygiene_services
CREATE POLICY "All authenticated users can view hygiene services"
ON public.hygiene_services FOR SELECT
USING (true);

CREATE POLICY "Authenticated users can create hygiene services"
ON public.hygiene_services FOR INSERT
WITH CHECK (auth.uid() = executado_por_user_id);

-- Create function to update proxima_limpeza after service
CREATE OR REPLACE FUNCTION public.update_proxima_limpeza()
RETURNS TRIGGER AS $$
DECLARE
  client_interval INTEGER;
BEGIN
  -- Get the cleaning interval from the client
  SELECT hc.intervalo_limpeza_dias INTO client_interval
  FROM public.hygiene_clients hc
  JOIN public.hygiene_equipment he ON he.client_id = hc.id
  WHERE he.id = NEW.equipment_id;

  -- Update the equipment's last and next cleaning dates
  UPDATE public.hygiene_equipment
  SET 
    ultima_limpeza = NEW.data_servico::date,
    proxima_limpeza = (NEW.data_servico::date + (client_interval || ' days')::interval)::date,
    numero_serie = COALESCE(NEW.novo_numero_serie, numero_serie),
    updated_at = now()
  WHERE id = NEW.equipment_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger for updating dates after service
CREATE TRIGGER trigger_update_proxima_limpeza
AFTER INSERT ON public.hygiene_services
FOR EACH ROW
EXECUTE FUNCTION public.update_proxima_limpeza();

-- Create trigger for updated_at on hygiene_clients
CREATE TRIGGER update_hygiene_clients_updated_at
BEFORE UPDATE ON public.hygiene_clients
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create trigger for updated_at on hygiene_equipment
CREATE TRIGGER update_hygiene_equipment_updated_at
BEFORE UPDATE ON public.hygiene_equipment
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();