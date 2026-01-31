-- Create table for optimized routes
CREATE TABLE public.optimized_routes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by_user_id UUID NOT NULL,
  route_date DATE NOT NULL,
  period TEXT NOT NULL CHECK (period IN ('manha', 'tarde_noite')),
  driver_index INTEGER NOT NULL,
  driver_label TEXT NOT NULL,
  color TEXT NOT NULL,
  total_distance INTEGER NOT NULL DEFAULT 0, -- meters
  total_duration INTEGER NOT NULL DEFAULT 0, -- seconds
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  total_volume_liters INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled'))
);

-- Create table for route stops
CREATE TABLE public.route_stops (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  route_id UUID NOT NULL REFERENCES public.optimized_routes(id) ON DELETE CASCADE,
  stop_order INTEGER NOT NULL,
  order_number TEXT NOT NULL,
  client_name TEXT NOT NULL,
  address TEXT NOT NULL,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  expected_delivery TEXT, -- HH:MM or null
  volume_liters INTEGER NOT NULL DEFAULT 0,
  estimated_service_time INTEGER NOT NULL DEFAULT 30, -- minutes
  arrival_time TEXT NOT NULL,
  departure_time TEXT NOT NULL,
  distance_from_previous INTEGER NOT NULL DEFAULT 0, -- meters
  duration_from_previous INTEGER NOT NULL DEFAULT 0, -- seconds
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'arrived', 'completed', 'skipped'))
);

-- Create index for route queries
CREATE INDEX idx_optimized_routes_date_period ON public.optimized_routes(route_date, period);
CREATE INDEX idx_route_stops_route_id ON public.route_stops(route_id);

-- Enable RLS
ALTER TABLE public.optimized_routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.route_stops ENABLE ROW LEVEL SECURITY;

-- RLS Policies for optimized_routes
CREATE POLICY "Authenticated users can view all routes"
ON public.optimized_routes FOR SELECT
USING (true);

CREATE POLICY "Authenticated users can create routes"
ON public.optimized_routes FOR INSERT
WITH CHECK (auth.uid() = created_by_user_id);

CREATE POLICY "Authenticated users can update routes"
ON public.optimized_routes FOR UPDATE
USING (true);

CREATE POLICY "Authenticated users can delete routes"
ON public.optimized_routes FOR DELETE
USING (true);

-- RLS Policies for route_stops
CREATE POLICY "Authenticated users can view all stops"
ON public.route_stops FOR SELECT
USING (true);

CREATE POLICY "Authenticated users can create stops"
ON public.route_stops FOR INSERT
WITH CHECK (true);

CREATE POLICY "Authenticated users can update stops"
ON public.route_stops FOR UPDATE
USING (true);

CREATE POLICY "Authenticated users can delete stops"
ON public.route_stops FOR DELETE
USING (true);