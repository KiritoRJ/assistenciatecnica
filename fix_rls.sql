-- CORREÇÃO DE PERMISSÕES (RLS)
-- Rode este script no SQL Editor do Supabase para corrigir o erro de "violação de política de segurança"

-- 1. Tabela de Funcionários
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Acesso Total Employees" ON public.employees;
CREATE POLICY "Acesso Total Employees" ON public.employees
FOR ALL
USING (true)
WITH CHECK (true);

-- 2. Tabela de Regras de Comissão
ALTER TABLE public.commission_rules ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Acesso Total Commission Rules" ON public.commission_rules;
CREATE POLICY "Acesso Total Commission Rules" ON public.commission_rules
FOR ALL
USING (true)
WITH CHECK (true);

-- 3. Tabela de Metas
ALTER TABLE public.goal_tiers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Acesso Total Goal Tiers" ON public.goal_tiers;
CREATE POLICY "Acesso Total Goal Tiers" ON public.goal_tiers
FOR ALL
USING (true)
WITH CHECK (true);

-- 4. Tabela de Log de Comissões
ALTER TABLE public.commissions_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Acesso Total Commissions Log" ON public.commissions_log;
CREATE POLICY "Acesso Total Commissions Log" ON public.commissions_log
FOR ALL
USING (true)
WITH CHECK (true);
