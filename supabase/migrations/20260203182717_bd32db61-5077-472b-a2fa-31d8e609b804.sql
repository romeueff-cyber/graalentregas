-- =====================================================
-- ATUALIZAR RLS PARA PERMITIR TODOS OS USUÁRIOS AUTENTICADOS
-- =====================================================

-- 1. BOLETOS - Permitir todos os usuários autenticados
DROP POLICY IF EXISTS "Admins can view all boletos" ON public.boletos;
DROP POLICY IF EXISTS "Admins can create boletos" ON public.boletos;
DROP POLICY IF EXISTS "Admins can update boletos" ON public.boletos;

CREATE POLICY "Authenticated users can view all boletos" 
ON public.boletos 
FOR SELECT 
USING (true);

CREATE POLICY "Authenticated users can create boletos" 
ON public.boletos 
FOR INSERT 
WITH CHECK (auth.uid() = created_by_user_id);

CREATE POLICY "Authenticated users can update boletos" 
ON public.boletos 
FOR UPDATE 
USING (true);

-- 2. HYGIENE_CLIENTS - Permitir todos os usuários autenticados
DROP POLICY IF EXISTS "Admins can view all hygiene clients" ON public.hygiene_clients;
DROP POLICY IF EXISTS "Admins can create hygiene clients" ON public.hygiene_clients;
DROP POLICY IF EXISTS "Admins can update hygiene clients" ON public.hygiene_clients;
DROP POLICY IF EXISTS "Admins can delete hygiene clients" ON public.hygiene_clients;

CREATE POLICY "Authenticated users can view all hygiene clients" 
ON public.hygiene_clients 
FOR SELECT 
USING (true);

CREATE POLICY "Authenticated users can create hygiene clients" 
ON public.hygiene_clients 
FOR INSERT 
WITH CHECK (auth.uid() = created_by_user_id);

CREATE POLICY "Authenticated users can update hygiene clients" 
ON public.hygiene_clients 
FOR UPDATE 
USING (true);

CREATE POLICY "Authenticated users can delete hygiene clients" 
ON public.hygiene_clients 
FOR DELETE 
USING (true);

-- 3. HYGIENE_EQUIPMENT - Permitir todos os usuários autenticados
DROP POLICY IF EXISTS "Admins can view all hygiene equipment" ON public.hygiene_equipment;
DROP POLICY IF EXISTS "Admins can create hygiene equipment" ON public.hygiene_equipment;
DROP POLICY IF EXISTS "Admins can update hygiene equipment" ON public.hygiene_equipment;
DROP POLICY IF EXISTS "Admins can delete hygiene equipment" ON public.hygiene_equipment;

CREATE POLICY "Authenticated users can view all hygiene equipment" 
ON public.hygiene_equipment 
FOR SELECT 
USING (true);

CREATE POLICY "Authenticated users can create hygiene equipment" 
ON public.hygiene_equipment 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Authenticated users can update hygiene equipment" 
ON public.hygiene_equipment 
FOR UPDATE 
USING (true);

CREATE POLICY "Authenticated users can delete hygiene equipment" 
ON public.hygiene_equipment 
FOR DELETE 
USING (true);

-- 4. HYGIENE_SERVICES - Permitir todos os usuários autenticados
DROP POLICY IF EXISTS "Admins can view all hygiene services" ON public.hygiene_services;
DROP POLICY IF EXISTS "Admins can create hygiene services" ON public.hygiene_services;

CREATE POLICY "Authenticated users can view all hygiene services" 
ON public.hygiene_services 
FOR SELECT 
USING (true);

CREATE POLICY "Authenticated users can create hygiene services" 
ON public.hygiene_services 
FOR INSERT 
WITH CHECK (auth.uid() = executado_por_user_id);