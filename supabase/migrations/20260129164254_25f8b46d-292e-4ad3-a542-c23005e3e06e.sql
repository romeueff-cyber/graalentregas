-- 1. Rename kegotater to geladeira in the enum
ALTER TYPE public.hygiene_equipment_type RENAME VALUE 'kegotater' TO 'geladeira';

-- 2. Add balcao to the enum
ALTER TYPE public.hygiene_equipment_type ADD VALUE 'balcao';

-- 3. Add modelo_chopeira column for chopeira specifications
ALTER TABLE public.hygiene_equipment 
ADD COLUMN modelo_chopeira text;

-- 4. Add check constraint for modelo_chopeira (only required when tipo is chopeira)
ALTER TABLE public.hygiene_equipment 
ADD CONSTRAINT chopeira_modelo_check 
CHECK (
  tipo_equipamento != 'chopeira' OR 
  modelo_chopeira IN ('30L_1VIA', '50L_1VIA', '50L_2VIAS', '90L_1VIA', '90L_2VIAS', '90L_3VIAS')
);