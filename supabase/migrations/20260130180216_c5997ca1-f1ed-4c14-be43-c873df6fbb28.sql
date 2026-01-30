-- Create table to store generated boletos
CREATE TABLE public.boletos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_number TEXT NOT NULL,
  cora_invoice_id TEXT NOT NULL UNIQUE,
  customer_name TEXT NOT NULL,
  customer_document TEXT NOT NULL,
  customer_email TEXT,
  total_amount INTEGER NOT NULL, -- Amount in cents
  due_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING',
  digitable_line TEXT,
  barcode TEXT,
  pdf_url TEXT,
  pix_emv TEXT,
  pix_qr_code_url TEXT,
  created_by_user_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.boletos ENABLE ROW LEVEL SECURITY;

-- Create policies for authenticated users
CREATE POLICY "Authenticated users can view all boletos" 
ON public.boletos 
FOR SELECT 
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can create boletos" 
ON public.boletos 
FOR INSERT 
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update boletos" 
ON public.boletos 
FOR UPDATE 
TO authenticated
USING (true);

-- Create index for faster lookups by order number
CREATE INDEX idx_boletos_order_number ON public.boletos(order_number);
CREATE INDEX idx_boletos_status ON public.boletos(status);
CREATE INDEX idx_boletos_due_date ON public.boletos(due_date);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_boletos_updated_at
BEFORE UPDATE ON public.boletos
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();