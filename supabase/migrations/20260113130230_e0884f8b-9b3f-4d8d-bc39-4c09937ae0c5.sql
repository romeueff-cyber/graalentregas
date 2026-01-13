-- Create enum for user roles
CREATE TYPE public.app_role AS ENUM ('admin', 'entregador');

-- Create enum for equipment status
CREATE TYPE public.equipment_status AS ENUM ('ENTREGUE', 'LIBERADO_PARA_RECOLHA', 'RECOLHIDO');

-- Create enum for collection period
CREATE TYPE public.collection_period AS ENUM ('MANHA', 'TARDE', 'NOITE');

-- Create enum for sync status
CREATE TYPE public.sync_status AS ENUM ('synced', 'pending');

-- Create profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create user_roles table (separate from profiles for security)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL DEFAULT 'entregador',
  UNIQUE(user_id, role)
);

-- Create equipments table
CREATE TABLE public.equipments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome_cliente TEXT NOT NULL,
  pedido_dia TEXT NOT NULL,
  periodo_recolha collection_period NOT NULL,
  observacoes TEXT,
  foto_local_path TEXT,
  foto_url TEXT,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  data_entrega TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  data_prevista_recolha DATE NOT NULL,
  data_real_recolha TIMESTAMP WITH TIME ZONE,
  status equipment_status NOT NULL DEFAULT 'ENTREGUE',
  created_by_user_id UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  sync_status sync_status NOT NULL DEFAULT 'synced'
);

-- Create settings table
CREATE TABLE public.settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dias_exibir_recolhido INTEGER NOT NULL DEFAULT 7,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default settings
INSERT INTO public.settings (dias_exibir_recolhido) VALUES (7);

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.equipments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

-- Security definer function to check user role
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- RLS policies for profiles
CREATE POLICY "Profiles are viewable by authenticated users"
ON public.profiles FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Users can update their own profile"
ON public.profiles FOR UPDATE
TO authenticated
USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile"
ON public.profiles FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id);

-- RLS policies for user_roles
CREATE POLICY "Roles are viewable by authenticated users"
ON public.user_roles FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Only admins can insert roles"
ON public.user_roles FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Only admins can update roles"
ON public.user_roles FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Only admins can delete roles"
ON public.user_roles FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- RLS policies for equipments (all authenticated users can view/create/edit)
CREATE POLICY "Equipments are viewable by authenticated users"
ON public.equipments FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can create equipments"
ON public.equipments FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = created_by_user_id);

CREATE POLICY "Authenticated users can update equipments"
ON public.equipments FOR UPDATE
TO authenticated
USING (true);

-- RLS policies for settings
CREATE POLICY "Settings are viewable by authenticated users"
ON public.settings FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Only admins can update settings"
ON public.settings FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Function to automatically update equipment status based on date
CREATE OR REPLACE FUNCTION public.update_equipment_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- If status is already RECOLHIDO, don't change it
  IF NEW.status = 'RECOLHIDO' THEN
    RETURN NEW;
  END IF;
  
  -- Update status based on data_prevista_recolha
  IF NEW.data_prevista_recolha <= CURRENT_DATE THEN
    NEW.status := 'LIBERADO_PARA_RECOLHA';
  ELSE
    NEW.status := 'ENTREGUE';
  END IF;
  
  RETURN NEW;
END;
$$;

-- Trigger to update status on insert/update
CREATE TRIGGER equipment_status_trigger
BEFORE INSERT OR UPDATE ON public.equipments
FOR EACH ROW
EXECUTE FUNCTION public.update_equipment_status();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Trigger for updated_at
CREATE TRIGGER update_equipments_updated_at
BEFORE UPDATE ON public.equipments
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Function to handle new user creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'name', NEW.email), NEW.email);
  RETURN NEW;
END;
$$;

-- Trigger on auth.users for profile creation
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user();