
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://lawcmqsjhwuhogsukhbf.supabase.co';
const SUPABASE_KEY = 'sb_publishable_c2wQfanSj96FRWqoCq9KIw_2FhxuRBv';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

export class OnlineDB {
  /**
   * Login Principal
   */
  static async login(username: string, passwordPlain: string) {
    const cleanUser = username.trim().toLowerCase();
    const cleanPass = passwordPlain.trim();

    // Bypass Local para Desenvolvedor (Wandev)
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

      if (error) throw error;

      if (!data) {
        return { success: false, message: "Usuário ou senha inválidos." };
      }

      return { 
        success: true, 
        type: data.role || 'admin', 
        tenant: { 
          id: data.tenant_id, 
          username: data.username 
        } 
      };
    } catch (err: any) {
      console.error("Erro Login:", err);
      return { success: false, message: "Erro de conexão: " + err.message };
    }
  }

  /**
   * Criação de nova Empresa e Usuário Admin no Supabase
   */
  static async createTenant(tenantData: any) {
    try {
      console.log("Tentando criar empresa no Supabase...", tenantData);

      // 1. Inserir na tabela 'tenants'
      const { error: tError } = await supabase
        .from('tenants')
        .insert([{
          id: tenantData.id,
          store_name: tenantData.storeName,
          created_at: new Date().toISOString()
        }]);

      if (tError) {
        console.error("Erro Tenants:", tError);
        return { success: false, message: `Erro ao criar loja: ${tError.message}. Verifique se a tabela 'tenants' tem a coluna 'store_name'.` };
      }

      // 2. Inserir na tabela 'users' o administrador da nova loja
      const { error: uError } = await supabase
        .from('users')
        .insert([{
          username: tenantData.adminUsername.toLowerCase().trim(),
          password: tenantData.adminPasswordPlain,
          role: 'admin',
          tenant_id: tenantData.id,
          store_name: tenantData.storeName
        }]);

      if (uError) {
        console.error("Erro Users:", uError);
        // Rollback manual (opcional)
        await supabase.from('tenants').delete().eq('id', tenantData.id);
        return { success: false, message: `Erro ao criar usuário: ${uError.message}. Verifique se a tabela 'users' tem as colunas 'username', 'password' e 'tenant_id'.` };
      }

      return { success: true };
    } catch (e: any) {
      console.error("Erro Crítico:", e);
      return { success: false, message: "Falha de comunicação: " + e.message };
    }
  }

  /**
   * Listar todas as lojas para o Painel Wandev
   */
  static async getTenants() {
    try {
      const { data, error } = await supabase
        .from('tenants')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data || [];
    } catch (e) {
      console.error("Erro getTenants:", e);
      return [];
    }
  }

  /**
   * Sincronização Push (Upload)
   */
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

  /**
   * Sincronização Pull (Download)
   */
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
}
