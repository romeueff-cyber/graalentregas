-- Add geo-filter settings to the settings table
ALTER TABLE public.settings 
ADD COLUMN IF NOT EXISTS centro_latitude double precision DEFAULT -26.4841,
ADD COLUMN IF NOT EXISTS centro_longitude double precision DEFAULT -49.0747,
ADD COLUMN IF NOT EXISTS raio_km integer DEFAULT 50,
ADD COLUMN IF NOT EXISTS filtro_geografico_ativo boolean DEFAULT false;

-- Add comment for documentation
COMMENT ON COLUMN public.settings.centro_latitude IS 'Latitude do ponto central para filtro geográfico';
COMMENT ON COLUMN public.settings.centro_longitude IS 'Longitude do ponto central para filtro geográfico';
COMMENT ON COLUMN public.settings.raio_km IS 'Raio em km para filtrar pedidos e equipamentos';
COMMENT ON COLUMN public.settings.filtro_geografico_ativo IS 'Se o filtro geográfico está ativado';