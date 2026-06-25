CREATE TABLE IF NOT EXISTS public.empresa_settings (
  empresa_id INT PRIMARY KEY,
  whatsapp_recipient TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.empresa_settings TO authenticated;
GRANT ALL ON public.empresa_settings TO service_role;

ALTER TABLE public.empresa_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read empresa_settings"
  ON public.empresa_settings FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Admin manage empresa_settings"
  ON public.empresa_settings FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE TRIGGER update_empresa_settings_updated_at
  BEFORE UPDATE ON public.empresa_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.empresa_settings (empresa_id) VALUES (1), (3)
  ON CONFLICT (empresa_id) DO NOTHING;