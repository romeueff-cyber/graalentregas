
-- =====================================================================
-- 1) BOLETOS: restringir para role 'authenticated' e tightenar UPDATE
-- =====================================================================
DROP POLICY IF EXISTS "Authenticated users can view all boletos" ON public.boletos;
DROP POLICY IF EXISTS "Authenticated users can create boletos" ON public.boletos;
DROP POLICY IF EXISTS "Authenticated users can update boletos" ON public.boletos;

CREATE POLICY "Authenticated users can view all boletos"
  ON public.boletos FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can create boletos"
  ON public.boletos FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = created_by_user_id);

CREATE POLICY "Authenticated users can update boletos"
  ON public.boletos FOR UPDATE TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- =====================================================================
-- 2) HYGIENE_CLIENTS
-- =====================================================================
DROP POLICY IF EXISTS "Authenticated users can view all hygiene clients" ON public.hygiene_clients;
DROP POLICY IF EXISTS "Authenticated users can create hygiene clients" ON public.hygiene_clients;
DROP POLICY IF EXISTS "Authenticated users can update hygiene clients" ON public.hygiene_clients;
DROP POLICY IF EXISTS "Authenticated users can delete hygiene clients" ON public.hygiene_clients;

CREATE POLICY "Authenticated users can view all hygiene clients"
  ON public.hygiene_clients FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can create hygiene clients"
  ON public.hygiene_clients FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = created_by_user_id);
CREATE POLICY "Authenticated users can update hygiene clients"
  ON public.hygiene_clients FOR UPDATE TO authenticated
  USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can delete hygiene clients"
  ON public.hygiene_clients FOR DELETE TO authenticated
  USING (auth.uid() IS NOT NULL);

-- =====================================================================
-- 3) HYGIENE_EQUIPMENT
-- =====================================================================
DROP POLICY IF EXISTS "Authenticated users can view all hygiene equipment" ON public.hygiene_equipment;
DROP POLICY IF EXISTS "Authenticated users can create hygiene equipment" ON public.hygiene_equipment;
DROP POLICY IF EXISTS "Authenticated users can update hygiene equipment" ON public.hygiene_equipment;
DROP POLICY IF EXISTS "Authenticated users can delete hygiene equipment" ON public.hygiene_equipment;

CREATE POLICY "Authenticated users can view all hygiene equipment"
  ON public.hygiene_equipment FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can create hygiene equipment"
  ON public.hygiene_equipment FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can update hygiene equipment"
  ON public.hygiene_equipment FOR UPDATE TO authenticated
  USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can delete hygiene equipment"
  ON public.hygiene_equipment FOR DELETE TO authenticated
  USING (auth.uid() IS NOT NULL);

-- =====================================================================
-- 4) HYGIENE_SERVICES
-- =====================================================================
DROP POLICY IF EXISTS "Authenticated users can view all hygiene services" ON public.hygiene_services;
DROP POLICY IF EXISTS "Authenticated users can create hygiene services" ON public.hygiene_services;

CREATE POLICY "Authenticated users can view all hygiene services"
  ON public.hygiene_services FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can create hygiene services"
  ON public.hygiene_services FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = executado_por_user_id);

-- =====================================================================
-- 5) EQUIPMENT_HISTORY
-- =====================================================================
DROP POLICY IF EXISTS "Authenticated users can view all equipment history" ON public.equipment_history;
DROP POLICY IF EXISTS "Authenticated users can create equipment history" ON public.equipment_history;

CREATE POLICY "Authenticated users can view all equipment history"
  ON public.equipment_history FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can create equipment history"
  ON public.equipment_history FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- =====================================================================
-- 6) OPTIMIZED_ROUTES
-- =====================================================================
DROP POLICY IF EXISTS "Authenticated users can view all routes" ON public.optimized_routes;
DROP POLICY IF EXISTS "Authenticated users can create routes" ON public.optimized_routes;
DROP POLICY IF EXISTS "Authenticated users can update routes" ON public.optimized_routes;
DROP POLICY IF EXISTS "Authenticated users can delete routes" ON public.optimized_routes;

CREATE POLICY "Authenticated users can view all routes"
  ON public.optimized_routes FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can create routes"
  ON public.optimized_routes FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = created_by_user_id);
CREATE POLICY "Authenticated users can update routes"
  ON public.optimized_routes FOR UPDATE TO authenticated
  USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can delete routes"
  ON public.optimized_routes FOR DELETE TO authenticated
  USING (auth.uid() IS NOT NULL);

-- =====================================================================
-- 7) ROUTE_STOPS
-- =====================================================================
DROP POLICY IF EXISTS "Authenticated users can view all stops" ON public.route_stops;
DROP POLICY IF EXISTS "Authenticated users can create stops" ON public.route_stops;
DROP POLICY IF EXISTS "Authenticated users can update stops" ON public.route_stops;
DROP POLICY IF EXISTS "Authenticated users can delete stops" ON public.route_stops;

CREATE POLICY "Authenticated users can view all stops"
  ON public.route_stops FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can create stops"
  ON public.route_stops FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can update stops"
  ON public.route_stops FOR UPDATE TO authenticated
  USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can delete stops"
  ON public.route_stops FOR DELETE TO authenticated
  USING (auth.uid() IS NOT NULL);

-- =====================================================================
-- 8) LABEL_TEMPLATES
-- =====================================================================
DROP POLICY IF EXISTS "Authenticated users can view all label templates" ON public.label_templates;
DROP POLICY IF EXISTS "Authenticated users can create label templates" ON public.label_templates;
DROP POLICY IF EXISTS "Authenticated users can update label templates" ON public.label_templates;
DROP POLICY IF EXISTS "Authenticated users can delete label templates" ON public.label_templates;

CREATE POLICY "Authenticated users can view all label templates"
  ON public.label_templates FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can create label templates"
  ON public.label_templates FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = created_by_user_id);
CREATE POLICY "Authenticated users can update label templates"
  ON public.label_templates FOR UPDATE TO authenticated
  USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can delete label templates"
  ON public.label_templates FOR DELETE TO authenticated
  USING (auth.uid() IS NOT NULL);

-- =====================================================================
-- 9) DRIVER_LOCATIONS
-- =====================================================================
DROP POLICY IF EXISTS "Admins can view all locations" ON public.driver_locations;
DROP POLICY IF EXISTS "Users can view their own locations" ON public.driver_locations;
DROP POLICY IF EXISTS "Users can insert their own locations" ON public.driver_locations;

CREATE POLICY "Admins can view all locations"
  ON public.driver_locations FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users can view their own locations"
  ON public.driver_locations FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own locations"
  ON public.driver_locations FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- =====================================================================
-- 10) VISIT_ATTEMPTS
-- =====================================================================
DROP POLICY IF EXISTS "Admins can view all visits" ON public.visit_attempts;
DROP POLICY IF EXISTS "Users can view their own visits" ON public.visit_attempts;
DROP POLICY IF EXISTS "Users can insert their own visits" ON public.visit_attempts;

CREATE POLICY "Admins can view all visits"
  ON public.visit_attempts FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users can view their own visits"
  ON public.visit_attempts FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own visits"
  ON public.visit_attempts FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- =====================================================================
-- 11) SECURITY DEFINER functions: revogar EXECUTE público
-- =====================================================================
REVOKE EXECUTE ON FUNCTION public.confirm_collection(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_delivered_order_numbers() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_admin_or_financeiro(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_user_empresas(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.user_has_empresa(uuid, integer) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.confirm_collection(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_delivered_order_numbers() TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin_or_financeiro(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_empresas(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_has_empresa(uuid, integer) TO authenticated;

-- Trigger-only helpers: keep no public/anon EXECUTE
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_proxima_limpeza() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_equipment_status() FROM PUBLIC, anon, authenticated;
