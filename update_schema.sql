-- Atualização da tabela goal_tiers
ALTER TABLE public.goal_tiers ADD COLUMN IF NOT EXISTS employee_id UUID REFERENCES public.employees(id);
ALTER TABLE public.goal_tiers ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE public.goal_tiers ADD COLUMN IF NOT EXISTS bonus_type TEXT CHECK (bonus_type IN ('percent', 'fixed')) DEFAULT 'percent';
ALTER TABLE public.goal_tiers ADD COLUMN IF NOT EXISTS bonus_value NUMERIC(10, 2) DEFAULT 0;
ALTER TABLE public.goal_tiers ADD COLUMN IF NOT EXISTS calculation_base TEXT DEFAULT 'gross_sale';

-- Atualização da tabela commission_rules
ALTER TABLE public.commission_rules ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE public.commission_rules ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE public.commission_rules ADD COLUMN IF NOT EXISTS target_type TEXT;
ALTER TABLE public.commission_rules ADD COLUMN IF NOT EXISTS target_id TEXT;
ALTER TABLE public.commission_rules ADD COLUMN IF NOT EXISTS employee_id UUID REFERENCES public.employees(id);
ALTER TABLE public.commission_rules ADD COLUMN IF NOT EXISTS calculation_base TEXT DEFAULT 'gross_sale';
ALTER TABLE public.commission_rules ADD COLUMN IF NOT EXISTS value NUMERIC(10, 2) DEFAULT 0;
ALTER TABLE public.commission_rules ADD COLUMN IF NOT EXISTS min_amount NUMERIC(10, 2) DEFAULT 0;
ALTER TABLE public.commission_rules ADD COLUMN IF NOT EXISTS priority INTEGER DEFAULT 1;
ALTER TABLE public.commission_rules ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- Atualizar o cache do schema do Supabase (PostgREST)
NOTIFY pgrst, 'reload schema';
