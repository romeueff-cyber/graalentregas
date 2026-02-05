-- Create equipment history table
CREATE TABLE public.equipment_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  user_id UUID NOT NULL,
  user_name TEXT NOT NULL,
  patrimony TEXT NOT NULL,
  client_name TEXT NOT NULL,
  client_id TEXT,
  action_type TEXT NOT NULL,
  order_number TEXT,
  notes TEXT
);

-- Enable RLS
ALTER TABLE public.equipment_history ENABLE ROW LEVEL SECURITY;

-- Policies: all authenticated users can view and create
CREATE POLICY "Authenticated users can view all equipment history"
ON public.equipment_history
FOR SELECT
USING (true);

CREATE POLICY "Authenticated users can create equipment history"
ON public.equipment_history
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Index for common queries
CREATE INDEX idx_equipment_history_created_at ON public.equipment_history(created_at DESC);
CREATE INDEX idx_equipment_history_patrimony ON public.equipment_history(patrimony);
CREATE INDEX idx_equipment_history_client_name ON public.equipment_history(client_name);