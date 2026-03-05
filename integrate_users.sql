-- ATUALIZAÇÃO DE INTEGRAÇÃO (USERS <-> EMPLOYEES)

-- 1. Adicionar coluna user_id em employees para vincular com a tabela de usuários
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS user_id TEXT;
CREATE INDEX IF NOT EXISTS idx_employees_user_id ON public.employees(user_id);

-- 2. Adicionar colunas de rastreamento em vendas e OS
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS seller_id TEXT;
ALTER TABLE public.service_orders ADD COLUMN IF NOT EXISTS technician_id TEXT;
ALTER TABLE public.service_orders ADD COLUMN IF NOT EXISTS seller_id TEXT;

-- 3. Trigger para criar Employee automaticamente quando um User for criado
-- (Assumindo que a tabela de usuários se chama 'users' e tem colunas id, name, role, tenant_id)

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.employees (
    id, -- Usa o mesmo ID se for UUID, senão gera novo e vincula pelo user_id
    tenant_id,
    user_id,
    name,
    role,
    status,
    admission_date,
    photo_url
  )
  VALUES (
    uuid_generate_v4(), -- Gera um ID novo para a tabela employees
    NEW.tenant_id,
    NEW.id, -- Vincula ao ID da tabela users
    NEW.name,
    CASE 
      WHEN NEW.role = 'admin' THEN 'administrador'
      WHEN NEW.specialty = 'Técnico' THEN 'tecnico'
      WHEN NEW.specialty = 'Vendedor' THEN 'vendedor'
      ELSE 'atendente'
    END,
    'active',
    CURRENT_DATE,
    NEW.photo
  )
  ON CONFLICT DO NOTHING; -- Evita erro se já existir
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Remove trigger se existir para recriar
DROP TRIGGER IF EXISTS on_user_created ON public.users;

-- Cria a trigger
CREATE TRIGGER on_user_created
  AFTER INSERT ON public.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 4. Trigger para atualizar Employee quando User for atualizado
CREATE OR REPLACE FUNCTION public.handle_update_user()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.employees
  SET 
    name = NEW.name,
    photo_url = NEW.photo,
    role = CASE 
      WHEN NEW.role = 'admin' THEN 'administrador'
      WHEN NEW.specialty = 'Técnico' THEN 'tecnico'
      WHEN NEW.specialty = 'Vendedor' THEN 'vendedor'
      ELSE role -- Mantém o atual se não mapear
    END
  WHERE user_id = NEW.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_user_updated ON public.users;

CREATE TRIGGER on_user_updated
  AFTER UPDATE ON public.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_update_user();
