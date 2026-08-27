-- ==============================================================================
-- SCRIPT DE ATUALIZAÇÃO SEGURA: TABELA DE CLIENTES E ORDENS DE SERVIÇO
-- ==============================================================================
-- Este script funciona tanto se a tabela 'customers' for nova, quanto se ela
-- já existir no seu Supabase com colunas antigas ou diferentes.

-- 1. Garante que a tabela customers exista
CREATE TABLE IF NOT EXISTS public.customers (
    id TEXT PRIMARY KEY
);

-- 2. Adiciona com segurança todas as colunas necessárias (não dá erro se já existirem)
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS tenant_id TEXT;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS phone_number TEXT;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS document TEXT;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS cpf TEXT;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS notes_history JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT false;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now());
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now());

-- 3. Se a tabela já continha uma coluna antiga "phone", sincroniza com "phone_number"
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'customers' AND column_name = 'phone'
    ) THEN
        UPDATE public.customers 
        SET phone_number = phone 
        WHERE (phone_number IS NULL OR phone_number = '') AND (phone IS NOT NULL AND phone <> '');
    END IF;
END $$;

-- 4. Criação segura dos índices de busca e performance
CREATE INDEX IF NOT EXISTS idx_customers_tenant ON public.customers(tenant_id);
CREATE INDEX IF NOT EXISTS idx_customers_phone ON public.customers(phone_number);
CREATE INDEX IF NOT EXISTS idx_customers_document ON public.customers(document);
CREATE INDEX IF NOT EXISTS idx_customers_name ON public.customers(name);
CREATE INDEX IF NOT EXISTS idx_customers_is_deleted ON public.customers(is_deleted);

-- 5. Adiciona o vínculo de cliente nas Ordens de Serviço (service_orders)
ALTER TABLE public.service_orders ADD COLUMN IF NOT EXISTS customer_id TEXT;
CREATE INDEX IF NOT EXISTS idx_service_orders_customer_id ON public.service_orders(customer_id);

-- 6. Habilita RLS (Row Level Security) com política de acesso total
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Acesso Total Customers" ON public.customers;
CREATE POLICY "Acesso Total Customers" ON public.customers
FOR ALL
USING (true)
WITH CHECK (true);

-- 7. Adiciona à publicação Realtime do Supabase (para sincronizar entre dispositivos)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'customers'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.customers;
    END IF;
END $$;

-- 8. Recarrega o cache do PostgREST para o Supabase reconhecer as novas colunas
NOTIFY pgrst, 'reload schema';
