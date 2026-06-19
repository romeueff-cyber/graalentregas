CREATE TABLE public.client_notes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_name TEXT NOT NULL,
  note TEXT NOT NULL,
  follow_up_date DATE,
  resolved BOOLEAN NOT NULL DEFAULT false,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_notes TO authenticated;
GRANT ALL ON public.client_notes TO service_role;

ALTER TABLE public.client_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view all client notes"
  ON public.client_notes FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can create client notes"
  ON public.client_notes FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Authenticated users can update client notes"
  ON public.client_notes FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete client notes"
  ON public.client_notes FOR DELETE
  TO authenticated
  USING (true);

CREATE INDEX idx_client_notes_client_name_lower ON public.client_notes (LOWER(client_name));
CREATE INDEX idx_client_notes_follow_up ON public.client_notes (follow_up_date) WHERE follow_up_date IS NOT NULL AND resolved = false;

CREATE TRIGGER update_client_notes_updated_at
  BEFORE UPDATE ON public.client_notes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();