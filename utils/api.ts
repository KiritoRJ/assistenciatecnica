
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = (typeof process !== 'undefined' && process.env?.VITE_SUPABASE_URL) || (import.meta as any).env?.VITE_SUPABASE_URL || 'https://lawcmqsjhwuhogsukhbf.supabase.co';
const SUPABASE_KEY = (typeof process !== 'undefined' && process.env?.VITE_SUPABASE_ANON_KEY) || (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || 'sb_publishable_c2wQfanSj96FRWqoCq9KIw_2FhxuRBv';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

export class OnlineDB {
  // Busca configurações globais do sistema
  static async getGlobalSettings() {
    try {
      const { data, error } = await supabase
        .from('cloud_data')
        .select('data_json')
        .eq('tenant_id', 'SYSTEM')
        .eq('store_key', 'global_plans')
        .maybeSingle();
      
      if (error) throw error;
      
      const defaultSettings = {
        monthly: { price: 49.90, maxUsers: 2, maxOS: 999, maxProducts: 999 },
        quarterly: { price: 129.90, maxUsers: 999, maxOS: 999, maxProducts: 999 },
        yearly: { price: 499.00, maxUsers: 999, maxOS: 999, maxProducts: 999 },
        trial: { maxUsers: 1000, maxOS: 1000, maxProducts: 1000 },
        supportPhone: '5511999999999'
      };

      if (!data?.data_json) return defaultSettings;

      // Compatibilidade com formato antigo (apenas preços)
      const json = data.data_json;
      if (typeof json.monthly === 'number') {
        return {
          ...defaultSettings,
          monthly: { ...defaultSettings.monthly, price: json.monthly },
          quarterly: { ...defaultSettings.quarterly, price: json.quarterly },
          yearly: { ...defaultSettings.yearly, price: json.yearly }
        };
      }

      return { ...defaultSettings, ...json };
    } catch (e) {
      return {
        monthly: { price: 49.90, maxUsers: 2, maxOS: 999, maxProducts: 999 },
        quarterly: { price: 129.90, maxUsers: 999, maxOS: 999, maxProducts: 999 },
        yearly: { price: 499.00, maxUsers: 999, maxOS: 999, maxProducts: 999 },
        trial: { maxUsers: 1000, maxOS: 1000, maxProducts: 1000 },
        supportPhone: '5511999999999'
      };
    }
  }

  // Atualiza configurações globais do sistema
  static async updateGlobalSettings(plans: any) {
    try {
      const { error } = await supabase
        .from('cloud_data')
        .upsert({
          tenant_id: 'SYSTEM',
          store_key: 'global_plans',
          data_json: plans,
          updated_at: new Date().toISOString()
        }, { onConflict: 'tenant_id,store_key' });
      
      if (error) throw error;
      return { success: true };
    } catch (e: any) {
      return { success: false, message: e.message };
    }
  }

  // Atualiza preços customizados de uma loja
  static async updateTenantCustomPrices(tenantId: string, prices: { monthly?: number, quarterly?: number, yearly?: number }) {
    try {
      const { error } = await supabase
        .from('tenants')
        .update({
          custom_monthly_price: prices.monthly,
          custom_quarterly_price: prices.quarterly,
          custom_yearly_price: prices.yearly
        })
        .eq('id', tenantId);
      
      if (error) throw error;
      return { success: true };
    } catch (e: any) {
      return { success: false, message: e.message };
    }
  }

  // Atualiza permissões de recursos e limite de usuários de uma loja
  static async updateTenantFeatures(tenantId: string, features: any, maxUsers: number, maxOS: number, maxProducts: number, printerSize?: 58 | 80, retentionMonths?: number) {
    try {
      const { error: tenantError } = await supabase
        .from('tenants')
        .update({
          enabled_features: features,
          max_users: maxUsers,
          printer_size: printerSize,
          retention_months: retentionMonths
        })
        .eq('id', tenantId);
      if (tenantError) throw tenantError;

      const { error: limitsError } = await supabase
        .from('tenant_limits')
        .upsert({ 
          tenant_id: tenantId, 
          max_os: maxOS, 
          max_products: maxProducts 
        }, { onConflict: 'tenant_id' });
      if (limitsError) throw limitsError;

      return { success: true };
    } catch (e: any) {
      return { success: false, message: e.message };
    }
  }

  // Realiza o login do usuário via API do servidor (seguro)
  static async login(username: string, passwordPlain: string) {
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password: passwordPlain })
      });
      return await response.json();
    } catch (err) {
      return { success: false, message: "Erro ao conectar com o servidor." };
    }
  }

  // Verifica limite de usuários e registra sessão
  static async checkAndRegisterSession(tenantId: string, maxUsers: number, deviceId: string, userName: string) {
    try {
      // 1. Limpa sessões inativas (mais de 5 minutos sem heartbeat)
      const fiveMinsAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      await supabase.from('active_sessions').delete().eq('tenant_id', tenantId).lt('last_seen', fiveMinsAgo);

      // 2. Conta as sessões ativas para esta loja
      const { count, error: countError } = await supabase
        .from('active_sessions')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenantId);

      if (countError) throw countError;

      // 3. Verifica se este dispositivo já tem uma sessão
      const { data: existing } = await supabase
        .from('active_sessions')
        .select('id')
        .eq('tenant_id', tenantId)
        .eq('device_id', deviceId)
        .maybeSingle();

      // Se não tem sessão e o limite foi atingido, bloqueia o login
      if (!existing && count !== null && count >= maxUsers) {
        return { success: false, message: `Limite de telas atingido. O plano atual permite apenas ${maxUsers} acesso(s) simultâneo(s).` };
      }

      // 4. Registra ou atualiza a sessão
      const { error: upsertError } = await supabase
        .from('active_sessions')
        .upsert({
          tenant_id: tenantId,
          device_id: deviceId,
          user_name: userName,
          last_seen: new Date().toISOString()
        }, { onConflict: 'tenant_id, device_id' });

      if (upsertError) throw upsertError;

      return { success: true };
    } catch (e: any) {
      console.error("Erro ao registrar sessão:", e);
      return { success: false, message: e.message };
    }
  }

  // Atualiza o "sinal de vida" da sessão
  static async heartbeatSession(tenantId: string, deviceId: string, maxUsers: number) {
    try {
      // Limpa sessões inativas primeiro
      const fiveMinsAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      await supabase.from('active_sessions').delete().eq('tenant_id', tenantId).lt('last_seen', fiveMinsAgo);

      // Verifica se a nossa sessão ainda existe
      const { data: existing } = await supabase
        .from('active_sessions')
        .select('id')
        .eq('tenant_id', tenantId)
        .eq('device_id', deviceId)
        .maybeSingle();

      if (!existing) {
         // Perdemos a sessão (ficamos offline muito tempo). Verifica se ainda tem vaga.
         const { count } = await supabase
          .from('active_sessions')
          .select('*', { count: 'exact', head: true })
          .eq('tenant_id', tenantId);

         if (count !== null && count >= maxUsers) {
           return { success: false, kicked: true }; // Força o logout
         }
      }

      // Atualiza o last_seen
      await supabase
        .from('active_sessions')
        .upsert({
          tenant_id: tenantId,
          device_id: deviceId,
          last_seen: new Date().toISOString()
        }, { onConflict: 'tenant_id, device_id' });

      return { success: true };
    } catch (e) {
       // Ignora erros de rede durante o heartbeat para não deslogar à toa
       return { success: true };
    }
  }

  // Remove a sessão explicitamente (Logout)
  static async removeSession(tenantId: string, deviceId: string) {
    try {
      await supabase.from('active_sessions').delete().eq('tenant_id', tenantId).eq('device_id', deviceId);
    } catch (e) {
      console.error("Erro ao remover sessão:", e);
    }
  }

  // Altera a senha do administrador via API do servidor (seguro)
  static async changePassword(tenantId: string, oldPassword: string, newPassword: string) {
    try {
      const response = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId, oldPassword, newPassword })
      });
      return await response.json();
    } catch (err) {
      return { success: false, message: "Erro ao conectar com o servidor." };
    }
  }

  // Altera a senha do Super Admin via API do servidor (seguro)
  static async changeSuperPassword(oldPassword: string, newPassword: string) {
    try {
      const response = await fetch('/api/auth/change-super-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ oldPassword, newPassword })
      });
      return await response.json();
    } catch (err) {
      return { success: false, message: "Erro ao conectar com o servidor." };
    }
  }

  // Verifica a senha do administrador via API do servidor (seguro)
  static async verifyAdminPassword(tenantId: string, passwordPlain: string) {
    try {
      const response = await fetch('/api/auth/verify-admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId, password: passwordPlain })
      });
      return await response.json();
    } catch (err) {
      return { success: false, message: "Erro ao conectar com o servidor." };
    }
  }

  // Busca todos os usuários vinculados a uma loja
  static async fetchUsers(tenantId: string) {
    if (!tenantId) return [];
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('tenant_id', tenantId)
        .neq('role', 'deleted')
        .order('role', { ascending: true });
      
      if (error) throw error;
      return (data || []).map(u => ({
        id: u.id,
        name: u.name,
        username: u.username,
        role: u.role,
        photo: u.photo,
        password: u.password,
        specialty: u.specialty
      }));
    } catch (e) {
      return [];
    }
  }

  // Cria uma nova loja e seu usuário administrador via API do servidor (seguro)
  static async createTenant(tenantData: { 
    id: string; 
    storeName: string; 
    adminUsername: string; 
    adminPasswordPlain: string; 
    logoUrl: string | null; 
    phoneNumber: string; 
  }) {
    try {
      const response = await fetch('/api/auth/register-tenant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tenantData)
      });
      return await response.json();
    } catch (e) {
      return { success: false, message: "Erro ao conectar com o servidor." };
    }
  }

  // Atualiza a assinatura de uma loja para uma data específica
  static async setSubscriptionDate(tenantId: string, date: string, status: 'trial' | 'active' | 'expired' = 'active', planType?: 'monthly' | 'quarterly' | 'yearly') {
    try {
      const updateData: any = {
        subscription_status: status,
        subscription_expires_at: date,
        last_plan_type: planType
      };

      // Se o plano for definido manualmente, também aplica os limites padrão do plano
      if (planType) {
        const globalSettings = await this.getGlobalSettings();
        const planLimits = globalSettings[planType];
        
        if (planLimits) {
          updateData.max_users = planLimits.maxUsers;
          updateData.enabled_features = {
            osTab: true,
            stockTab: true,
            salesTab: true,
            financeTab: true,
            profiles: true,
            xmlExportImport: true,
            hideFinancialReports: false
          };

          const { error: limitsError } = await supabase
            .from('tenant_limits')
            .upsert({ 
              tenant_id: tenantId, 
              max_os: planLimits.maxOS, 
              max_products: planLimits.maxProducts 
            }, { onConflict: 'tenant_id' });
          if (limitsError) throw limitsError;
        }
      }

      const { error } = await supabase
        .from('tenants')
        .update(updateData)
        .eq('id', tenantId);
      
      if (error) throw error;
      return { success: true };
    } catch (e: any) {
      return { success: false, message: e.message };
    }
  }

  // Atualiza a assinatura de uma loja
  static async updateSubscription(tenantId: string, months: number, planType: 'monthly' | 'quarterly' | 'yearly') {
    try {
      const expiresAt = new Date();
      expiresAt.setMonth(expiresAt.getMonth() + months);

      const globalSettings = await this.getGlobalSettings();
      const planLimits = globalSettings[planType];

      const updateData: any = {
        subscription_status: 'active',
        subscription_expires_at: expiresAt.toISOString(),
        last_plan_type: planType
      };

      if (planLimits) {
        updateData.max_users = planLimits.maxUsers;
        updateData.enabled_features = {
          osTab: true,
          stockTab: true,
          salesTab: true,
          financeTab: true,
          profiles: true,
          xmlExportImport: true,
          hideFinancialReports: false
        };
        const { error: limitsError } = await supabase
          .from('tenant_limits')
          .upsert({ 
            tenant_id: tenantId, 
            max_os: planLimits.maxOS, 
            max_products: planLimits.maxProducts 
          }, { onConflict: 'tenant_id' });
        if (limitsError) throw limitsError;
      }

      const { error } = await supabase
        .from('tenants')
        .update(updateData)
        .eq('id', tenantId);
      
      if (error) throw error;
      return { success: true, expiresAt: expiresAt.toISOString() };
    } catch (e: any) {
      return { success: false, message: e.message };
    }
  }

  // Remove uma loja do sistema
  static async deleteTenant(tenantId: string) {
    try {
      const { error } = await supabase
        .from('tenants')
        .delete()
        .eq('id', tenantId);
      
      if (error) throw error;
      return { success: true };
    } catch (e: any) {
      return { success: false, message: e.message };
    }
  }

  // Salva ou atualiza dados de um usuário via API do servidor (seguro)
  static async upsertUser(tenantId: string, storeName: string, user: any) {
    try {
      const response = await fetch('/api/auth/upsert-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId, storeName, user })
      });
      return await response.json();
    } catch (e) {
      return { success: false, message: "Erro ao conectar com o servidor." };
    }
  }

  // Lista todas as lojas cadastradas
  static async getTenants() {
    try {
      const { data, error } = await supabase
        .from('tenants')
        .select('*, tenant_limits(*)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    } catch (e) {
      return [];
    }
  }

  // Busca uma loja pelo ID
  static async getTenantById(tenantId: string) {
    try {
      const { data, error } = await supabase
        .from('tenants')
        .select('*, tenant_limits(*), users(*)')
        .eq('id', tenantId)
        .maybeSingle();
      
      if (error) throw error;
      return data || null;
    } catch (e) {
      console.error("Erro ao buscar loja por ID:", e);
      return null;
    }
  }

  // Remove uma O.S. pelo ID (Soft Delete)
  static async deleteOS(osId: string) {
    try {
      const { error } = await supabase
        .from('service_orders')
        .update({ is_deleted: true })
        .eq('id', osId);
      if (error) console.error("Erro ao deletar OS:", error);
      return { success: !error };
    } catch (e) { return { success: false }; }
  }

  // Busca as Ordens de Serviço e mapeia as novas colunas entry_date e exit_date
  static async fetchOrders(tenantId: string) {
    if (!tenantId) return [];
    try {
      const { data, error } = await supabase
        .from('service_orders')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      return (data || []).map(d => ({
        id: d.id,
        customerName: d.customer_name,
        phoneNumber: d.phone_number,
        address: d.address,
        deviceBrand: d.device_brand,
        deviceModel: d.device_model,
        defect: d.defect,
        repairDetails: d.repair_details || '', 
        partsCost: Number(d.parts_cost || 0),
        serviceCost: Number(d.service_cost || 0),
        total: Number(d.total || 0),
        status: d.status,
        photos: d.photos || [],
        finishedPhotos: d.finished_photos || [], 
        date: d.created_at,
        // MAPEAMENTO DAS NOVAS DATAS DO SQL PARA O APP
        entryDate: d.entry_date || '',
        exitDate: d.exit_date || '',
        isDeleted: d.is_deleted || false,
        signature: d.signature || '',
        checklist: d.checklist || []
      }));
    } catch (e) { 
      console.error("Erro ao buscar ordens do Supabase:", e);
      return []; 
    }
  }

  // Busca catálogo público (apenas produtos em estoque e configurações da loja)
  static async getTenantIdBySlug(slug: string) {
    try {
      const { data, error } = await supabase
        .from('cloud_data')
        .select('tenant_id')
        .eq('store_key', 'settings')
        .eq('data_json->>catalogSlug', slug)
        .maybeSingle();
        
      if (error) throw error;
      return data?.tenant_id || null;
    } catch (e) {
      console.error("Erro ao buscar loja pelo link:", e);
      return null;
    }
  }

  static async getPublicCatalog(tenantId: string) {
    try {
      const [productsData, settingsData] = await Promise.all([
        supabase.from('products').select('*').eq('tenant_id', tenantId).gt('quantity', 0).order('id', { ascending: false }),
        supabase.from('cloud_data').select('data_json').eq('tenant_id', tenantId).eq('store_key', 'settings').maybeSingle()
      ]);

      const products = (productsData.data || []).map(d => {
        // Extract videoUrl from additional_photos if present (legacy support or workaround)
        let videoUrl = d.video_url || null;
        let additionalPhotos = d.additional_photos || [];
        
        // Check for video in additionalPhotos
        const videoEntryIndex = additionalPhotos.findIndex((p: string) => p.startsWith('VIDEO:'));
        if (videoEntryIndex !== -1) {
          videoUrl = additionalPhotos[videoEntryIndex].replace('VIDEO:', '');
          additionalPhotos = additionalPhotos.filter((_: string, i: number) => i !== videoEntryIndex);
        }

        return {
          id: d.id,
          name: d.name,
          category: d.description?.startsWith('[CAT:') ? d.description.split(']')[0].replace('[CAT:', '') : undefined,
          barcode: d.barcode,
          photo: d.photo,
          costPrice: Number(d.cost_price || 0),
          salePrice: Number(d.sale_price || 0),
          quantity: Number(d.quantity || 0),
          description: d.description?.startsWith('[CAT:') ? d.description.split(']').slice(1).join(']').trim() : d.description,
          additionalPhotos: additionalPhotos,
          promotionalPrice: Number(d.promotional_price || 0),
          isPromotion: d.is_promotion || false,
          videoUrl: videoUrl
        };
      });

      const settings = settingsData.data?.data_json || null;

      return { products, settings };
    } catch (e) {
      console.error("Erro ao buscar catálogo público:", e);
      return null;
    }
  }

  // Busca produtos em estoque
  static async fetchProducts(tenantId: string) {
    if (!tenantId) return [];
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('id', { ascending: false });
      
      if (error) throw error;
      
      return (data || []).map(d => {
        // Extract videoUrl from additional_photos if present
        let videoUrl = d.video_url || null;
        let additionalPhotos = d.additional_photos || [];
        
        const videoEntryIndex = additionalPhotos.findIndex((p: string) => p.startsWith('VIDEO:'));
        if (videoEntryIndex !== -1) {
          videoUrl = additionalPhotos[videoEntryIndex].replace('VIDEO:', '');
          additionalPhotos = additionalPhotos.filter((_: string, i: number) => i !== videoEntryIndex);
        }

        return {
          id: d.id,
          name: d.name,
          category: d.description?.startsWith('[CAT:') ? d.description.split(']')[0].replace('[CAT:', '') : undefined,
          barcode: d.barcode,
          photo: d.photo,
          costPrice: Number(d.cost_price || 0),
          salePrice: Number(d.sale_price || 0),
          quantity: Number(d.quantity || 0),
          description: d.description?.startsWith('[CAT:') ? d.description.split(']').slice(1).join(']').trim() : d.description,
          additionalPhotos: additionalPhotos,
          promotionalPrice: Number(d.promotional_price || 0),
          isPromotion: d.is_promotion || false,
          videoUrl: videoUrl
        };
      });
    } catch (e) { 
      console.error("Erro ao buscar produtos do Supabase:", e);
      return []; 
    }
  }

  // Busca histórico de vendas
  static async fetchSales(tenantId: string) {
    if (!tenantId) return [];
    try {
      const { data, error } = await supabase
        .from('sales')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('date', { ascending: false });
      
      if (error) throw error;
      
      return (data || []).map(d => ({
        id: d.id,
        productId: d.product_id,
        productName: d.product_name?.startsWith('[CAT:') ? d.product_name.split(']').slice(1).join(']').trim() : d.product_name,
        category: d.product_name?.startsWith('[CAT:') ? d.product_name.split(']')[0].replace('[CAT:', '') : undefined,
        date: d.date,
        quantity: d.quantity,
        originalPrice: Number(d.original_price || 0),
        discount: Number(d.discount || 0),
        finalPrice: Number(d.final_price || 0),
        costAtSale: Number(d.cost_at_sale || 0),
        costPerUnitAtSale: Number(d.cost_per_unit_at_sale || (d.quantity > 0 ? (d.cost_at_sale || 0) / d.quantity : 0)),
        salePricePerUnitAtSale: Number(d.sale_price_per_unit_at_sale || d.original_price || 0),
        paymentMethod: d.payment_method,
        sellerName: d.seller_name,
        sellerId: d.seller_id,
        transactionId: d.transaction_id,
        isDeleted: d.is_deleted || false
      }));
    } catch (e) {
      console.error("Erro ao buscar vendas do Supabase:", e);
      return [];
    }
  }

  // Busca transações manuais (entradas e saídas)
  static async fetchTransactions(tenantId: string) {
    if (!tenantId) return [];
    try {
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('date', { ascending: false });
      
      if (error) throw error;
      
      return (data || []).map(d => ({
        id: d.id,
        type: d.type,
        description: d.description,
        amount: Number(d.amount || 0),
        date: d.date,
        category: d.category,
        paymentMethod: d.payment_method,
        isDeleted: d.is_deleted || false,
        status: d.status || 'paid',
        dueDate: d.due_date,
        installments: d.installments,
        recurrence: d.recurrence
      }));
    } catch (e) {
      console.error("Erro ao buscar transações do Supabase:", e);
      return [];
    }
  }

  // Salva Ordens de Serviço no Banco de Dados
  static async upsertOrders(tenantId: string, orders: any[]) {
    if (!tenantId || !orders.length) return { success: true };
    try {
      const payload = orders.map(os => ({
        id: os.id,
        tenant_id: tenantId,
        customer_name: os.customerName,
        phone_number: os.phoneNumber,
        address: os.address,
        device_brand: os.deviceBrand,
        device_model: os.deviceModel,
        defect: os.defect,
        repair_details: os.repairDetails, 
        parts_cost: os.partsCost,
        service_cost: os.serviceCost,
        total: os.total,
        status: os.status,
        photos: os.photos,
        finished_photos: os.finishedPhotos || [], 
        created_at: os.date || new Date().toISOString(),
        // ENVIO DAS NOVAS DATAS PARA O SQL
        entry_date: os.entryDate,
        exit_date: os.exitDate,
        is_deleted: os.isDeleted || false,
        signature: os.signature || '',
        checklist: os.checklist || []
      }));
      const { error } = await supabase.from('service_orders').upsert(payload, { onConflict: 'id' });
      if (error) throw error;
      return { success: true };
    } catch (e) { 
      console.error("Erro ao salvar ordens no Supabase:", e);
      return { success: false }; 
    }
  }

  // Salva produtos no Banco de Dados
  static async upsertProducts(tenantId: string, products: any[]) {
    if (!tenantId || !products.length) return { success: true };
    try {
      const payload = products.map(p => {
        // Workaround: Store videoUrl in additional_photos if column doesn't exist or for backup
        let additionalPhotos = p.additionalPhotos || [];
        // Remove old video entries
        additionalPhotos = additionalPhotos.filter((photo: string) => !photo.startsWith('VIDEO:'));
        
        if (p.videoUrl) {
          additionalPhotos.push(`VIDEO:${p.videoUrl}`);
        }

        return {
          id: p.id,
          tenant_id: tenantId,
          name: p.name,
          barcode: p.barcode,
          photo: p.photo,
          cost_price: p.costPrice,
          sale_price: p.salePrice,
          quantity: p.quantity,
          description: p.category ? `[CAT:${p.category}] ${p.description || ''}` : p.description,
          additional_photos: additionalPhotos,
          promotional_price: p.promotionalPrice || 0,
          is_promotion: p.isPromotion || false
        };
      });
      const { error } = await supabase.from('products').upsert(payload, { onConflict: 'id' });
      if (error) throw error;
      return { success: true };
    } catch (e) { 
      console.error("Erro ao salvar produtos no Supabase:", e);
      return { success: false }; 
    }
  }

  // Salva vendas no Banco de Dados
  static async upsertSales(tenantId: string, sales: any[]) {
    if (!tenantId || !sales.length) return { success: true };
    try {
      const payload = sales.map(s => ({
        id: s.id,
        tenant_id: tenantId,
        product_id: s.productId,
        product_name: s.category ? `[CAT:${s.category}] ${s.productName}` : s.productName,
        date: s.date,
        quantity: s.quantity,
        original_price: s.originalPrice,
        discount: s.discount,
        final_price: s.finalPrice,
        cost_at_sale: s.costAtSale,
        payment_method: s.paymentMethod,
        seller_name: s.sellerName,
        seller_id: s.sellerId,
        transaction_id: s.transactionId,
        is_deleted: s.isDeleted || false
      }));
      const { error } = await supabase.from('sales').upsert(payload, { onConflict: 'id' });
      if (error) throw error;
      return { success: true };
    } catch (e) {
      console.error("Erro ao salvar vendas no Supabase:", e);
      return { success: false };
    }
  }

  // Salva transações no Banco de Dados
  static async upsertTransactions(tenantId: string, transactions: any[]) {
    if (!tenantId || !transactions.length) return { success: true };
    try {
      const payload = transactions.map(t => ({
        id: t.id,
        tenant_id: tenantId,
        type: t.type,
        description: t.description,
        amount: t.amount,
        date: t.date,
        category: t.category,
        payment_method: t.paymentMethod,
        is_deleted: t.isDeleted || false,
        status: t.status,
        due_date: t.dueDate,
        installments: t.installments,
        recurrence: t.recurrence
      }));
      const { error } = await supabase.from('transactions').upsert(payload, { onConflict: 'id' });
      if (error) throw error;
      return { success: true };
    } catch (e) {
      console.error("Erro ao salvar transações no Supabase:", e);
      return { success: false };
    }
  }

  // Sincroniza configurações globais
  static async syncPush(tenantId: string, storeKey: string, data: any) {
    if (!tenantId) return { success: false };
    try {
      let finalData = data;
      if (storeKey === 'settings') {
        const { users, ...cleanSettings } = data;
        finalData = cleanSettings;
      }

      const { error } = await supabase
        .from('cloud_data')
        .upsert({ 
          tenant_id: tenantId, 
          store_key: storeKey, 
          data_json: finalData, 
          updated_at: new Date().toISOString() 
        }, { onConflict: 'tenant_id,store_key' });
      return { success: !error };
    } catch (e) { return { success: false }; }
  }

  // Recupera configurações sincronizadas
  static async syncPull(tenantId: string, storeKey: string) {
    if (!tenantId) return null;
    try {
      const { data, error } = await supabase
        .from('cloud_data')
        .select('data_json')
        .eq('tenant_id', tenantId)
        .eq('store_key', storeKey)
        .maybeSingle();
      return data ? data.data_json : null;
    } catch (e) { return null; }
  }

  // Remove um produto
  static async deleteProduct(id: string) {
    try {
      const { error, status } = await supabase.from('products').delete().eq('id', id);
      return { success: !error };
    } catch (e) { return { success: false }; }
  }

  // Cancela uma venda e remove do banco (Soft Delete)
  static async deleteSale(id: string) {
    try {
      const { error, status } = await supabase
        .from('sales')
        .update({ is_deleted: true })
        .eq('id', id);
      if (error) return { success: false, message: error.message };
      return { success: status >= 200 && status < 300 };
    } catch (e: any) {
      return { success: false, message: e.message };
    }
  }

  // Remove uma transação (Soft Delete)
  static async deleteTransaction(id: string) {
    try {
      const { error, status } = await supabase
        .from('transactions')
        .update({ is_deleted: true })
        .eq('id', id);
      if (error) return { success: false, message: error.message };
      return { success: status >= 200 && status < 300 };
    } catch (e: any) {
      return { success: false, message: e.message };
    }
  }

  // Remove um usuário colaborador
  static async deleteRemoteUser(id: string) {
    try {
      // Soft delete: apenas marca como deletado para preservar histórico de vendas/comissões
      await supabase
        .from('employees')
        .update({ status: 'deleted' })
        .eq('user_id', id);

      const { error } = await supabase
        .from('users')
        .update({ role: 'deleted' })
        .eq('id', id);

      if (error) throw error;
      return { success: true };
    } catch (e: any) {
      console.error("Erro Soft Delete User:", e);
      return { success: false, message: e.message };
    }
  }

  // Limpeza de dados antigos (baseado no tempo de retenção da loja)
  static async cleanupOldData(tenantId: string, retentionMonths: number = 6) {
    if (!tenantId) return { success: false };
    try {
      const limitDate = new Date();
      limitDate.setMonth(limitDate.getMonth() - retentionMonths);
      const dateLimitStr = limitDate.toISOString();

      // Deleta OS marcadas como excluídas há mais de X meses
      await supabase
        .from('service_orders')
        .delete()
        .eq('tenant_id', tenantId)
        .eq('is_deleted', true)
        .lt('updated_at', dateLimitStr);

      // Deleta vendas marcadas como excluídas há mais de X meses
      await supabase
        .from('sales')
        .delete()
        .eq('tenant_id', tenantId)
        .eq('is_deleted', true)
        .lt('updated_at', dateLimitStr);

      // Deleta transações marcadas como excluídas há mais de X meses
      await supabase
        .from('transactions')
        .delete()
        .eq('tenant_id', tenantId)
        .eq('is_deleted', true)
        .lt('updated_at', dateLimitStr);

      return { success: true };
    } catch (e) { return { success: false }; }
  }

  // --- GESTÃO DE FUNCIONÁRIOS E COMISSÕES ---

  // Busca funcionários (integrado com usuários)
  static async fetchEmployees(tenantId: string) {
    if (!tenantId) return [];
    try {
      // 1. Busca usuários do sistema (auth/perfis) - ignora deletados
      const { data: users, error: usersError } = await supabase
        .from('users')
        .select('*')
        .eq('tenant_id', tenantId)
        .neq('role', 'deleted');

      if (usersError) throw usersError;

      // 2. Busca dados estendidos de funcionários (RH/Comissões) - ignora deletados
      const { data: employees, error: empError } = await supabase
        .from('employees')
        .select('*')
        .eq('tenant_id', tenantId)
        .neq('status', 'deleted');

      if (empError) throw empError;

      // 3. Mescla os dados. Se um usuário não tiver registro em employees, cria um objeto temporário
      const mergedList = (users || []).map(u => {
        const emp = employees?.find(e => e.user_id === u.id || e.email === u.username); // Tenta vincular por ID ou email/username
        
        // Se não existir registro em employees, vamos criar um "virtual" para exibição
        // O ideal seria criar no banco, mas vamos deixar o usuário salvar para persistir
        return {
          id: emp?.id || u.id, // Usa ID do employee se existir, senão do user (mas cuidado ao salvar)
          tenantId: tenantId,
          userId: u.id, // Referência ao usuário original
          name: u.name, // Nome vem do usuário (fonte da verdade)
          email: u.username,
          phone: emp?.phone,
          role: emp?.role || (u.role === 'admin' ? 'administrador' : (u.specialty === 'Técnico' ? 'tecnico' : 'vendedor')),
          status: emp?.status || 'active',
          admissionDate: emp?.admission_date || new Date().toISOString().split('T')[0],
          photoUrl: u.photo || emp?.photo_url,
          salaryBase: Number(emp?.salary_base || 0),
          commissionType: emp?.commission_type || 'sales_percent',
          defaultCommissionPercent: Number(emp?.default_commission_percent || 0),
          serviceCommissionPercent: Number(emp?.service_commission_percent || 0),
          goalMonthly: Number(emp?.goal_monthly || 0),
          permissions: emp?.permissions || { open_os: true, sell: true, view_finance: false, edit_price: false, cancel_sale: false }
        };
      });

      return mergedList.sort((a, b) => a.name.localeCompare(b.name));
    } catch (e) {
      console.error("Erro ao buscar funcionários:", e);
      return [];
    }
  }

  // Salva/Atualiza funcionário
  static async upsertEmployee(tenantId: string, employee: any) {
    try {
      // Prepara payload para tabela employees
      const payload: any = {
        tenant_id: tenantId,
        user_id: employee.userId, // Importante vincular
        name: employee.name,
        email: employee.email,
        phone: employee.phone,
        cpf: employee.cpf,
        rg: employee.rg,
        birth_date: employee.birthDate,
        address: employee.address, // Supabase JSONB
        pix_key: employee.pixKey,
        pix_key_type: employee.pixKeyType,
        role: employee.role,
        status: employee.status,
        admission_date: employee.admissionDate,
        photo_url: employee.photoUrl,
        salary_base: employee.salaryBase,
        commission_type: employee.commissionType,
        default_commission_percent: employee.defaultCommissionPercent,
        service_commission_percent: employee.serviceCommissionPercent,
        goal_monthly: employee.goalMonthly,
        permissions: employee.permissions
      };

      if (employee.id && employee.id.length > 10) { // Verifica se é um ID válido (UUID ou longo)
         // Se o ID for igual ao userId, significa que é um registro novo virtual, então deixamos o banco gerar o ID do employee
         if (employee.id !== employee.userId) {
            payload.id = employee.id;
         }
      } else if (employee.id) {
         // Se tiver ID curto, usa ele mesmo
         payload.id = employee.id;
      }

      const { data, error } = await supabase
        .from('employees')
        .upsert(payload) // Se tiver ID, atualiza. Se não, cria.
        .select()
        .single();

      if (error) throw error;
      return { success: true, data };
    } catch (e: any) {
      return { success: false, message: e.message };
    }
  }

  // Busca Regras de Comissão
  static async fetchCommissionRules(tenantId: string) {
    try {
      const { data, error } = await supabase.from('commission_rules').select('*').eq('tenant_id', tenantId).order('priority', { ascending: false });
      if (error) throw error;
      return (data || []).map(d => ({
        id: d.id,
        tenantId: d.tenant_id,
        name: d.name,
        description: d.description,
        targetType: d.target_type,
        targetId: d.target_id,
        employeeId: d.employee_id,
        ruleType: d.rule_type,
        calculationBase: d.calculation_base,
        value: Number(d.value || 0),
        minAmount: Number(d.min_amount || 0),
        priority: Number(d.priority || 0),
        isActive: d.is_active,
        requiresGoalMet: d.requires_goal_met
      }));
    } catch (e) { return []; }
  }

  // Salva Regra de Comissão
  static async upsertCommissionRule(tenantId: string, rule: any) {
    try {
      const payload: any = {
        tenant_id: tenantId,
        name: rule.name,
        description: rule.description,
        target_type: rule.targetType,
        target_id: rule.targetId || null,
        employee_id: rule.employeeId || null,
        rule_type: rule.ruleType,
        calculation_base: rule.calculationBase || 'gross_sale',
        value: rule.value,
        min_amount: rule.minAmount || 0,
        priority: rule.priority,
        is_active: rule.isActive,
        requires_goal_met: rule.requiresGoalMet || false
      };
      
      if (rule.id) {
        payload.id = rule.id;
      }
      
      const { error } = await supabase.from('commission_rules').upsert(payload);
      if (error) throw error;
      return { success: true };
    } catch (e: any) { 
      console.error("Error upserting commission rule:", e);
      return { success: false, message: e.message }; 
    }
  }

  // Busca Metas (GoalTiers)
  static async fetchGoalTiers(tenantId: string) {
    try {
      const { data, error } = await supabase.from('goal_tiers').select('*').eq('tenant_id', tenantId).order('min_amount', { ascending: true });
      if (error) throw error;
      return (data || []).map(d => ({
        id: d.id,
        tenantId: d.tenant_id,
        employeeId: d.employee_id,
        name: d.name,
        minAmount: Number(d.min_amount || 0),
        bonusType: d.bonus_type,
        bonusValue: Number(d.bonus_value || 0),
        calculationBase: d.calculation_base
      }));
    } catch (e) { return []; }
  }

  // Salva Meta
  static async upsertGoalTier(tenantId: string, tier: any) {
    try {
      const payload: any = {
        tenant_id: tenantId,
        employee_id: tier.employeeId || null,
        name: tier.name,
        min_amount: tier.minAmount || 0,
        bonus_type: tier.bonusType,
        bonus_value: tier.bonusValue || 0,
        calculation_base: tier.calculationBase || 'gross_sale'
      };
      if (tier.id) payload.id = tier.id;
      const { error } = await supabase.from('goal_tiers').upsert(payload);
      if (error) throw error;
      return { success: true };
    } catch (e: any) { 
      console.error("Error upserting goal tier:", e);
      return { success: false, message: e.message }; 
    }
  }

  // Deleta Meta
  static async deleteGoalTier(tierId: string) {
    try {
      await supabase.from('goal_tiers').delete().eq('id', tierId);
      return { success: true };
    } catch (e) { return { success: false }; }
  }

  // Deleta Regra de Comissão
  static async deleteCommissionRule(ruleId: string) {
    try {
      await supabase.from('commission_rules').delete().eq('id', ruleId);
      return { success: true };
    } catch (e) { return { success: false }; }
  }

  // Busca Log de Comissões
  static async fetchCommissionLogs(tenantId: string, startDate?: Date, endDate?: Date) {
    try {
      let query = supabase.from('commissions_log').select('*').eq('tenant_id', tenantId).order('created_at', { ascending: false });
      
      if (startDate) query = query.gte('created_at', startDate.toISOString());
      if (endDate) query = query.lte('created_at', endDate.toISOString());

      const { data, error } = await query;
      if (error) throw error;

      return (data || []).map(d => ({
        id: d.id,
        employeeId: d.employee_id,
        originType: d.origin_type,
        originId: d.origin_id,
        description: d.description,
        saleAmount: Number(d.sale_amount || 0),
        profitAmount: Number(d.profit_amount || 0),
        commissionAmount: Number(d.commission_amount || 0),
        status: d.status,
        paymentDate: d.payment_date,
        createdAt: d.created_at
      }));
    } catch (e) { return []; }
  }

  // Registra Comissão (Chamado ao finalizar venda/OS)
  static async logCommission(tenantId: string, log: any) {
    try {
      const { error } = await supabase.from('commissions_log').insert({
        tenant_id: tenantId,
        employee_id: log.employeeId,
        origin_type: log.originType,
        origin_id: log.originId,
        description: log.description,
        sale_amount: log.saleAmount,
        profit_amount: log.profitAmount,
        commission_amount: log.commissionAmount,
        status: log.status || 'pending',
        created_at: new Date().toISOString()
      });
      if (error) throw error;
      return { success: true };
    } catch (e) { return { success: false }; }
  }

  // Cancela Comissão
  static async cancelCommission(originId: string, originType: 'sale' | 'service_order') {
    try {
      const { error } = await supabase
        .from('commissions_log')
        .update({ status: 'cancelled' })
        .eq('origin_id', originId)
        .eq('origin_type', originType);
      if (error) throw error;
      return { success: true };
    } catch (e) { return { success: false }; }
  }

  // Calcula e registra comissão automaticamente usando regras inteligentes
  static async calculateAndLogCommission(tenantId: string, item: any, type: 'sale' | 'service_order', userId: string) {
    try {
      // 1. Busca o funcionário vinculado ao usuário
      const { data: employee } = await supabase
        .from('employees')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('user_id', userId)
        .maybeSingle();

      if (!employee) return { success: false, message: 'Funcionário não encontrado para este usuário.' };

      // 2. Busca todas as regras ativas para este tenant
      const rules = await this.fetchCommissionRules(tenantId);
      const activeRules = rules.filter(r => r.isActive);

      // 2.1 Calcula vendas do mês para verificar se bateu a meta (se houver regras que dependam disso)
      let monthlySales = 0;
      const hasGoalDependentRules = activeRules.some(r => r.requiresGoalMet);
      if (hasGoalDependentRules || employee.goal_monthly > 0) {
        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);
        
        const { data: monthlyLogs } = await supabase
          .from('commissions_log')
          .select('sale_amount')
          .eq('employee_id', employee.id)
          .neq('status', 'cancelled')
          .gte('created_at', startOfMonth.toISOString());
        
        monthlySales = (monthlyLogs || []).reduce((acc, curr) => acc + curr.sale_amount, 0);
      }

      let saleAmount = 0;
      let profitAmount = 0;
      let description = '';

      if (type === 'sale') {
        saleAmount = item.finalPrice;
        const cost = item.costAtSale || 0;
        profitAmount = saleAmount - cost;
        description = `Venda: ${item.productName}`;
      } else {
        saleAmount = item.total;
        profitAmount = item.total - (item.partsCost || 0);
        description = `OS #${item.id} - ${item.deviceModel}`;
      }

      const isGoalMet = (monthlySales + saleAmount) >= (employee.goal_monthly || 0);

      let commissionAmount = 0;

      // 3. Tenta encontrar a regra mais específica (maior prioridade)
      // Ordem de prioridade: Produto/Serviço específico > Categoria > Global
      const applicableRules = activeRules.filter(rule => {
        // Filtra por funcionário se a regra for específica
        if (rule.employeeId && rule.employeeId !== employee.id) return false;
        
        // Filtra por valor mínimo da venda
        if (rule.minAmount && saleAmount < rule.minAmount) return false;

        // Filtra por meta batida
        if (rule.requiresGoalMet && !isGoalMet) return false;

        // Filtra por tipo de alvo
        if (type === 'sale') {
          if (rule.targetType === 'product' && rule.targetId === item.productId) return true;
          if (rule.targetType === 'category' && rule.targetId === item.category) return true;
          if (rule.targetType === 'global') return true;
        } else {
          if (rule.targetType === 'service') return true;
          if (rule.targetType === 'global') return true;
        }
        return false;
      }).sort((a, b) => b.priority - a.priority);

      if (applicableRules.length > 0) {
        const rule = applicableRules[0];
        const base = rule.calculationBase === 'net_profit' ? profitAmount : saleAmount;
        
        if (rule.ruleType === 'percent') {
          commissionAmount = base * (rule.value / 100);
        } else {
          commissionAmount = rule.value;
        }
      } else {
        // Fallback para comissão padrão do funcionário
        const base = employee.commission_type === 'profit_percent' ? profitAmount : saleAmount;
        const percent = type === 'sale' ? employee.default_commission_percent : (employee.service_commission_percent || employee.default_commission_percent);
        commissionAmount = base * (Number(percent) / 100);
      }

      // 4. Registra no log
      if (commissionAmount > 0) {
        await this.logCommission(tenantId, {
          employeeId: employee.id,
          originType: type,
          originId: item.id,
          description,
          saleAmount,
          profitAmount,
          commissionAmount,
          status: 'pending'
        });
      }

      // 5. Verifica Metas de Bônus (GoalTiers)
      const tiers = await this.fetchGoalTiers(tenantId);
      const applicableTiers = tiers.filter(t => {
        if (t.employeeId && t.employeeId !== employee.id) return false;
        const totalWithCurrent = monthlySales + saleAmount;
        const totalWithoutCurrent = monthlySales;
        // Verifica se esta venda fez o funcionário ultrapassar o limite da meta
        return totalWithCurrent >= t.minAmount && totalWithoutCurrent < t.minAmount;
      });

      for (const tier of applicableTiers) {
        let bonusAmount = 0;
        const base = tier.calculationBase === 'net_profit' ? profitAmount : saleAmount;
        
        if (tier.bonusType === 'percent') {
          bonusAmount = base * (tier.bonusValue / 100);
        } else {
          bonusAmount = tier.bonusValue;
        }

        if (bonusAmount > 0) {
          await this.logCommission(tenantId, {
            employeeId: employee.id,
            originType: 'bonus',
            originId: `${item.id}_bonus_${tier.id}`,
            description: `Bônus Atingido: ${tier.name}`,
            saleAmount: 0,
            profitAmount: 0,
            commissionAmount: bonusAmount,
            status: 'pending'
          });
        }
      }

      return { success: true };
    } catch (e: any) {
      console.error("Erro ao calcular comissão:", e);
      return { success: false, message: e.message };
    }
  }


}
