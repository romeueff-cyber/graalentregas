
-- Create label_templates table for storing label configurations
CREATE TABLE public.label_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('lote_validade', 'lote_validade_2', 'patrimonio')),
  width_mm NUMERIC(6,2) NOT NULL DEFAULT 50,
  height_mm NUMERIC(6,2) NOT NULL DEFAULT 30,
  columns INTEGER NOT NULL DEFAULT 1,
  gap_horizontal_mm NUMERIC(6,2) NOT NULL DEFAULT 2,
  gap_vertical_mm NUMERIC(6,2) NOT NULL DEFAULT 2,
  elements JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_by_user_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.label_templates ENABLE ROW LEVEL SECURITY;

-- Policies: all authenticated users can CRUD
CREATE POLICY "Authenticated users can view all label templates"
ON public.label_templates FOR SELECT USING (true);

CREATE POLICY "Authenticated users can create label templates"
ON public.label_templates FOR INSERT WITH CHECK (auth.uid() = created_by_user_id);

CREATE POLICY "Authenticated users can update label templates"
ON public.label_templates FOR UPDATE USING (true);

CREATE POLICY "Authenticated users can delete label templates"
ON public.label_templates FOR DELETE USING (true);

-- Trigger for updated_at
CREATE TRIGGER update_label_templates_updated_at
BEFORE UPDATE ON public.label_templates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
