-- Tabela de Funcionários
CREATE TABLE IF NOT EXISTS public.employees (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    role TEXT CHECK (role IN ('tecnico', 'vendedor', 'atendente', 'gerente', 'administrador')),
    status TEXT CHECK (status IN ('active', 'inactive')) DEFAULT 'active',
    admission_date DATE DEFAULT CURRENT_DATE,
    photo_url TEXT,
    salary_base NUMERIC(10, 2) DEFAULT 0,
    commission_type TEXT CHECK (commission_type IN ('sales_percent', 'profit_percent', 'service_percent', 'fixed_product', 'mixed')) DEFAULT 'sales_percent',
    default_commission_percent NUMERIC(5, 2) DEFAULT 0,
    service_commission_percent NUMERIC(5, 2) DEFAULT 0,
    goal_monthly NUMERIC(10, 2) DEFAULT 0,
    permissions JSONB DEFAULT '{"open_os": true, "sell": true, "view_finance": false, "edit_price": false, "cancel_sale": false}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Tabela de Regras de Comissão por Categoria
CREATE TABLE IF NOT EXISTS public.commission_rules (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    category_name TEXT NOT NULL,
    commission_percent NUMERIC(5, 2) DEFAULT 0,
    fixed_value NUMERIC(10, 2) DEFAULT 0,
    rule_type TEXT CHECK (rule_type IN ('percent', 'fixed')) DEFAULT 'percent',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Tabela de Metas e Bônus
CREATE TABLE IF NOT EXISTS public.goal_tiers (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    min_amount NUMERIC(10, 2) NOT NULL,
    bonus_percent NUMERIC(5, 2) DEFAULT 0,
    bonus_fixed NUMERIC(10, 2) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Tabela de Log de Comissões
CREATE TABLE IF NOT EXISTS public.commissions_log (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    employee_id UUID REFERENCES public.employees(id),
    origin_type TEXT CHECK (origin_type IN ('sale', 'service_order', 'bonus')),
    origin_id TEXT NOT NULL,
    description TEXT NOT NULL,
    sale_amount NUMERIC(10, 2) DEFAULT 0,
    profit_amount NUMERIC(10, 2) DEFAULT 0,
    commission_amount NUMERIC(10, 2) DEFAULT 0,
    status TEXT CHECK (status IN ('pending', 'paid', 'cancelled')) DEFAULT 'pending',
    payment_date TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_employees_tenant ON public.employees(tenant_id);
CREATE INDEX IF NOT EXISTS idx_commission_rules_tenant ON public.commission_rules(tenant_id);
CREATE INDEX IF NOT EXISTS idx_commissions_log_tenant ON public.commissions_log(tenant_id);
CREATE INDEX IF NOT EXISTS idx_commissions_log_employee ON public.commissions_log(employee_id);

-- Habilitar RLS (Row Level Security)
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commission_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.goal_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commissions_log ENABLE ROW LEVEL SECURITY;

-- Políticas de Acesso (Exemplo genérico, ajustar conforme necessidade de auth)
CREATE POLICY "Acesso total para tenant" ON public.employees FOR ALL USING (tenant_id = current_setting('app.current_tenant', true));
CREATE POLICY "Acesso total para tenant" ON public.commission_rules FOR ALL USING (tenant_id = current_setting('app.current_tenant', true));
CREATE POLICY "Acesso total para tenant" ON public.goal_tiers FOR ALL USING (tenant_id = current_setting('app.current_tenant', true));
CREATE POLICY "Acesso total para tenant" ON public.commissions_log FOR ALL USING (tenant_id = current_setting('app.current_tenant', true));

-- Políticas simplificadas para desenvolvimento (se não estiver usando app.current_tenant)
-- CREATE POLICY "Enable all access for all users" ON public.employees FOR ALL USING (true);
-- CREATE POLICY "Enable all access for all users" ON public.commission_rules FOR ALL USING (true);
-- CREATE POLICY "Enable all access for all users" ON public.goal_tiers FOR ALL USING (true);
-- CREATE POLICY "Enable all access for all users" ON public.commissions_log FOR ALL USING (true);
