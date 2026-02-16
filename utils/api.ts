
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://lawcmqsjhwuhogsukhbf.supabase.co';
const SUPABASE_KEY = 'sb_publishable_c2wQfanSj96FRWqoCq9KIw_2FhxuRBv';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

export class OnlineDB {
  /**
   * Login com prioridade para o desenvolvedor (wandev)
   */
  static async login(username: string, passwordPlain: string) {
    const cleanUser = username.trim().toLowerCase();
    const cleanPass = passwordPlain.trim();

    if (cleanUser === 'wandev' && (cleanPass === '123' || cleanPass === 'wan123')) {
      return { success: true, type: 'super' };
    }

    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('username', cleanUser)
        .eq('password', cleanPass)
        .maybeSingle();

      if (error) {
        console.error("Erro Supabase Login:", error);
        return { success: false, message: "Erro no banco: " + error.message };
      }

      if (!data) {
        return { success: false, message: "Usuário ou senha inválidos no sistema." };
      }

      return { 
        success: true, 
        type: data.role || 'admin', 
        tenant: { 
          id: data.tenant_id, 
          username: data.username 
        } 
      };
    } catch (err) {
      return { success: false, message: "Falha na conexão com o Supabase." };
    }
  }

  static async syncPull(tenantId: string, storeKey: string) {
    if (!tenantId) return null;
    try {
      const { data, error } = await supabase
        .from('cloud_data')
        .select('data_json')
        .eq('tenant_id', tenantId)
        .eq('store_key', storeKey)
        .maybeSingle();
      
      if (error) return null;
      return data ? data.data_json : null;
    } catch (e) {
      return null;
    }
  }

  static async syncPush(tenantId: string, storeKey: string, data: any) {
    if (!tenantId) return { success: false };
    try {
      const { error } = await supabase
        .from('cloud_data')
        .upsert({ 
          tenant_id: tenantId, 
          store_key: storeKey, 
          data_json: data, 
          updated_at: new Date().toISOString() 
        }, { onConflict: 'tenant_id,store_key' });
      
      return { success: !error, error };
    } catch (e) {
      return { success: false, error: e };
    }
  }

  static async getTenants() {
    try {
      const { data, error } = await supabase
        .from('tenants')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data || [];
    } catch (e) {
      console.error("Erro ao listar lojas:", e);
      return [];
    }
  }

  /**
   * CRIAÇÃO DE EMPRESA E USUÁRIO (Multi-tabela)
   */
  static async createTenant(tenantData: any) {
    try {
      console.log("Iniciando criação de tenant no Supabase:", tenantData);

      // 1. Criar o Tenant (A Loja)
      const { error: tError } = await supabase
        .from('tenants')
        .insert([{
          id: tenantData.id,
          store_name: tenantData.storeName,
          created_at: new Date().toISOString()
        }]);

      if (tError) {
        console.error("Erro ao inserir na tabela 'tenants':", tError);
        return { success: false, message: `Erro na tabela 'tenants': ${tError.message}. Verifique se a coluna 'store_name' existe.` };
      }

      // 2. Criar o Usuário vinculado a esse Tenant
      const { error: uError } = await supabase
        .from('users')
        .insert([{
          username: tenantData.adminUsername.toLowerCase().trim(),
          password: tenantData.adminPasswordPlain, // Salvando senha em texto conforme solicitado
          role: 'admin',
          tenant_id: tenantData.id,
          store_name: tenantData.storeName
        }]);

      if (uError) {
        console.error("Erro ao inserir na tabela 'users':", uError);
        // Tenta remover o tenant criado para não deixar lixo, se possível
        await supabase.from('tenants').delete().eq('id', tenantData.id);
        return { success: false, message: `Erro na tabela 'users': ${uError.message}. Verifique se as colunas 'username', 'password' e 'tenant_id' existem.` };
      }

      return { success: true };
    } catch (e: any) {
      console.error("Falha inesperada na criação:", e);
      return { success: false, message: "Erro inesperado: " + (e.message || "Erro de rede") };
    }
  }
}
