-- 1. Cria a tabela de fornecedores
CREATE TABLE IF NOT EXISTS public.suppliers (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    name TEXT NOT NULL,
    phone TEXT,
    email TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Adiciona colunas para vincular fornecedor e tempo de garantia nas Ordens de Serviço (tabela service_orders)
ALTER TABLE public.service_orders ADD COLUMN IF NOT EXISTS part_supplier_id TEXT;
ALTER TABLE public.service_orders ADD COLUMN IF NOT EXISTS part_supplier_warranty TEXT;

-- 3. Habilita RLS (Row Level Security) para a tabela de fornecedores
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;

-- 4. Cria a política de segurança de acesso total (igual às outras tabelas do sistema)
DROP POLICY IF EXISTS "Acesso total de fornecedores por tenant" ON public.suppliers;
DROP POLICY IF EXISTS "Acesso Total Suppliers" ON public.suppliers;
CREATE POLICY "Acesso Total Suppliers" ON public.suppliers
FOR ALL
USING (true)
WITH CHECK (true);

-- 5. Atualiza o cache do schema do Supabase (PostgREST)
NOTIFY pgrst, 'reload schema';
