
DROP POLICY IF EXISTS "Authenticated users can update client notes" ON public.client_notes;
DROP POLICY IF EXISTS "Authenticated users can delete client notes" ON public.client_notes;
CREATE POLICY "Authenticated users can update client notes"
  ON public.client_notes FOR UPDATE TO authenticated
  USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can delete client notes"
  ON public.client_notes FOR DELETE TO authenticated
  USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "All authenticated users can update all equipments" ON public.equipments;
DROP POLICY IF EXISTS "All authenticated users can delete equipments" ON public.equipments;
CREATE POLICY "All authenticated users can update all equipments"
  ON public.equipments FOR UPDATE TO authenticated
  USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "All authenticated users can delete equipments"
  ON public.equipments FOR DELETE TO authenticated
  USING (auth.uid() IS NOT NULL);
