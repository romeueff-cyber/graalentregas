
-- Table to store driver GPS locations (foreground tracking)
CREATE TABLE public.driver_locations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  accuracy DOUBLE PRECISION,
  captured_at TIMESTAMP WITH TIME ZONE NOT NULL,
  synced_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Index for querying by user and time range
CREATE INDEX idx_driver_locations_user_time ON public.driver_locations (user_id, captured_at DESC);

-- Enable RLS
ALTER TABLE public.driver_locations ENABLE ROW LEVEL SECURITY;

-- Users can view their own locations
CREATE POLICY "Users can view their own locations"
ON public.driver_locations
FOR SELECT
USING (auth.uid() = user_id);

-- Admins can view all locations
CREATE POLICY "Admins can view all locations"
ON public.driver_locations
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

-- Users can insert their own locations
CREATE POLICY "Users can insert their own locations"
ON public.driver_locations
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Add driver GPS columns to equipments for real location at delivery time
ALTER TABLE public.equipments
ADD COLUMN IF NOT EXISTS driver_latitude DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS driver_longitude DOUBLE PRECISION;

-- Add driver GPS columns to equipment_history for real location at action time
ALTER TABLE public.equipment_history
ADD COLUMN IF NOT EXISTS driver_latitude DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS driver_longitude DOUBLE PRECISION;
