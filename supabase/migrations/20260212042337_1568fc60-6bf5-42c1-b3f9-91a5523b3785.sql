
-- Table to record visit attempts (successful or failed)
CREATE TABLE public.visit_attempts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  user_name TEXT NOT NULL,
  client_name TEXT NOT NULL,
  order_number TEXT,
  reason TEXT NOT NULL,
  notes TEXT,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  accuracy DOUBLE PRECISION,
  captured_at TIMESTAMP WITH TIME ZONE NOT NULL,
  synced_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Index for querying by date and user
CREATE INDEX idx_visit_attempts_user_date ON public.visit_attempts (user_id, captured_at DESC);

-- Enable RLS
ALTER TABLE public.visit_attempts ENABLE ROW LEVEL SECURITY;

-- Users can view their own visits
CREATE POLICY "Users can view their own visits"
ON public.visit_attempts
FOR SELECT
USING (auth.uid() = user_id);

-- Admins can view all visits
CREATE POLICY "Admins can view all visits"
ON public.visit_attempts
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

-- Users can insert their own visits
CREATE POLICY "Users can insert their own visits"
ON public.visit_attempts
FOR INSERT
WITH CHECK (auth.uid() = user_id);
