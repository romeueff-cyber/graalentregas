-- Fix security issue: Restrict boletos table access to admins only
-- Drop existing overly permissive policies
DROP POLICY IF EXISTS "Authenticated users can view all boletos" ON public.boletos;
DROP POLICY IF EXISTS "Authenticated users can create boletos" ON public.boletos;
DROP POLICY IF EXISTS "Authenticated users can update boletos" ON public.boletos;

-- Create admin-only policies for boletos
CREATE POLICY "Admins can view all boletos"
ON public.boletos FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can create boletos"
ON public.boletos FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin') AND auth.uid() = created_by_user_id);

CREATE POLICY "Admins can update boletos"
ON public.boletos FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Fix security issue: Restrict hygiene_clients table access to admins only
-- Drop existing overly permissive policies
DROP POLICY IF EXISTS "All authenticated users can view hygiene clients" ON public.hygiene_clients;
DROP POLICY IF EXISTS "All authenticated users can update hygiene clients" ON public.hygiene_clients;
DROP POLICY IF EXISTS "All authenticated users can delete hygiene clients" ON public.hygiene_clients;
DROP POLICY IF EXISTS "Authenticated users can create hygiene clients" ON public.hygiene_clients;

-- Create admin-only policies for hygiene_clients
CREATE POLICY "Admins can view all hygiene clients"
ON public.hygiene_clients FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can create hygiene clients"
ON public.hygiene_clients FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin') AND auth.uid() = created_by_user_id);

CREATE POLICY "Admins can update hygiene clients"
ON public.hygiene_clients FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete hygiene clients"
ON public.hygiene_clients FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Also restrict hygiene_equipment and hygiene_services to admins (related tables)
DROP POLICY IF EXISTS "All authenticated users can view hygiene equipment" ON public.hygiene_equipment;
DROP POLICY IF EXISTS "All authenticated users can create hygiene equipment" ON public.hygiene_equipment;
DROP POLICY IF EXISTS "All authenticated users can update hygiene equipment" ON public.hygiene_equipment;
DROP POLICY IF EXISTS "All authenticated users can delete hygiene equipment" ON public.hygiene_equipment;

CREATE POLICY "Admins can view all hygiene equipment"
ON public.hygiene_equipment FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can create hygiene equipment"
ON public.hygiene_equipment FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update hygiene equipment"
ON public.hygiene_equipment FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete hygiene equipment"
ON public.hygiene_equipment FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "All authenticated users can view hygiene services" ON public.hygiene_services;
DROP POLICY IF EXISTS "Authenticated users can create hygiene services" ON public.hygiene_services;

CREATE POLICY "Admins can view all hygiene services"
ON public.hygiene_services FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can create hygiene services"
ON public.hygiene_services FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin') AND auth.uid() = executado_por_user_id);