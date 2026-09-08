import express from 'express';
import { createServer as createViteServer } from 'vite';
import { MercadoPagoConfig, Preference, Payment } from 'mercadopago';
import dotenv from 'dotenv';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import { OnlineDB, supabase } from './utils/api';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const app = express();
const PORT = parseInt(process.env.PORT || "3000", 10);

// Helper to hash password
const hashPassword = async (password: string) => {
  const salt = await bcrypt.genSalt(10);
  return await bcrypt.hash(password, salt);
};

// Helper to compare password
const comparePassword = async (password: string, hash: string) => {
  // If it's a bcrypt hash, it starts with $2a$ or $2b$
  if (hash.startsWith('$2a$') || hash.startsWith('$2b$')) {
    return await bcrypt.compare(password, hash);
  }
  // Fallback for plain text passwords (legacy)
  return password === hash;
};

const getMPClient = () => {
  const token = process.env.MERCADO_PAGO_ACCESS_TOKEN || process.env.MP_ACCESS_TOKEN;
  if (!token) {
    throw new Error('MERCADO_PAGO_ACCESS_TOKEN ou MP_ACCESS_TOKEN não definida nas variáveis de ambiente.');
  }
  return new MercadoPagoConfig({ accessToken: token });
};

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());

// Explicit route for legacy iPad 1 Safari 5.1 / iOS 5.1.1
app.get('/ipad', (req, res) => {
  res.sendFile(path.join(__dirname, 'legacy-ipad1.html'));
});

// Auth Routes
app.get('/api/resolve-tiktok', async (req, res) => {
  const { url } = req.query;
  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'URL is required' });
  }

  try {
    const response = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });

    const finalUrl = response.url;
    const match = finalUrl.match(/\/video\/(\d+)/);
    const videoId = match ? match[1] : null;

    res.json({ finalUrl, videoId });
  } catch (err) {
    console.error('Error resolving TikTok URL:', err);
    res.status(500).json({ error: 'Failed to resolve URL' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  const cleanUser = username.trim().toLowerCase();

  try {
    const { data, error } = await supabase
      .from('users')
      .select('*, tenants(*, tenant_limits(*))')
      .eq('username', cleanUser)
      .maybeSingle();

    if (error) throw error;
    if (!data) return res.status(401).json({ success: false, message: "Usuário ou senha incorretos." });

    const isMatch = await comparePassword(password.trim(), data.password);
    if (!isMatch) return res.status(401).json({ success: false, message: "Usuário ou senha incorretos." });

    const tenant = data.tenants;
    const limits = tenant?.tenant_limits;
    const expiresAt = tenant?.subscription_expires_at;
    const isExpired = expiresAt ? new Date(expiresAt) < new Date() : false;

    res.json({ 
      success: true, 
      type: data.role || 'admin', 
      tenant: data.tenant_id ? { 
        id: data.tenant_id, 
        username: data.username,
        name: data.name || data.username,
        role: data.role,
        subscriptionStatus: isExpired ? 'expired' : (tenant?.subscription_status || 'trial'),
        subscriptionExpiresAt: expiresAt,
        customMonthlyPrice: tenant?.custom_monthly_price,
        customQuarterlyPrice: tenant?.custom_quarterly_price,
        customYearlyPrice: tenant?.custom_yearly_price,
        lastPlanType: tenant?.last_plan_type,
        enabledFeatures: tenant?.enabled_features || {
          osTab: true,
          stockTab: true,
          salesTab: true,
          financeTab: true,
          profiles: true,
          xmlExportImport: true,
          hideFinancialReports: false
        },
        maxUsers: tenant?.max_users || 999,
        maxOS: limits?.max_os || 999,
        maxProducts: limits?.max_products || 999,
        printerSize: tenant?.printer_size || 58,
        retentionMonths: tenant?.retention_months || 6
      } : null 
    });
  } catch (err: any) {
    console.error('Login error:', err);
    res.status(500).json({ success: false, message: "Erro ao realizar login." });
  }
});

app.post('/api/auth/register-tenant', async (req, res) => {
  const { id, storeName, adminUsername, adminPasswordPlain, logoUrl, phoneNumber } = req.body;
  
  try {
    const hashedPassword = await hashPassword(adminPasswordPlain.trim());
    
    const trialDays = 7;
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + trialDays);

    const globalSettings = await OnlineDB.getGlobalSettings();
    const trialLimits = globalSettings.trial || { maxUsers: 1000, maxOS: 1000, maxProducts: 1000 };

    const { error: tError } = await supabase
      .from('tenants')
      .insert([{
        id: id,
        store_name: storeName,
        logo_url: logoUrl,
        created_at: new Date().toISOString(),
        subscription_status: 'trial',
        subscription_expires_at: expiresAt.toISOString(),
        phone_number: phoneNumber,
        enabled_features: {
          osTab: true,
          stockTab: true,
          salesTab: true,
          financeTab: true,
          profiles: true,
          xmlExportImport: true,
          hideFinancialReports: false
        },
        max_users: trialLimits.maxUsers
      }]);
    if (tError) throw tError;

    const { error: limitsError } = await supabase
      .from('tenant_limits')
      .insert([{
        tenant_id: id,
        max_os: trialLimits.maxOS,
        max_products: trialLimits.maxProducts
      }]);
    if (limitsError) throw limitsError;

    const { error: uError } = await supabase
      .from('users')
      .insert([{
        id: 'USR_ADM_' + Math.random().toString(36).substr(2, 5).toUpperCase(),
        username: adminUsername.toLowerCase().trim(),
        password: hashedPassword,
        name: storeName,
        role: 'admin',
        tenant_id: id,
        store_name: storeName,
        photo: logoUrl
      }]);
    if (uError) throw uError;

    res.json({ success: true });
  } catch (e: any) {
    console.error('Register tenant error:', e);
    res.status(500).json({ success: false, message: e.message });
  }
});

app.post('/api/auth/upsert-user', async (req, res) => {
  const { tenantId, storeName, user } = req.body;
  
  try {
    const baseName = user.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, '_');
    const username = (user.username || baseName + '_' + Math.random().toString(36).substr(2, 4)).trim().toLowerCase();
    
    let password = (user.password && user.password.trim() !== '') ? user.password : '123456';
    console.log('Upsert user:', { username, password, userPassword: user.password });
    // Only hash if it's not already hashed (though in upsert it's usually plain text from the form)
    if (!password.startsWith('$2a$') && !password.startsWith('$2b$')) {
      password = await hashPassword(password.trim());
    }

    const payload: any = {
      id: user.id,
      username: username,
      name: user.name,
      role: user.role,
      tenant_id: tenantId,
      store_name: storeName,
      photo: user.photo,
      password: password,
      specialty: user.specialty
    };

    const { error } = await supabase
      .from('users')
      .upsert(payload, { onConflict: 'id' });

    if (error) throw error;
    res.json({ success: true, username });
  } catch (e: any) {
    console.error('Upsert user error:', e);
    res.status(500).json({ success: false, message: e.message });
  }
});

app.post('/api/auth/verify-admin', async (req, res) => {
  const { tenantId, password } = req.body;
  
  try {
    const { data, error } = await supabase
      .from('users')
      .select('password')
      .eq('tenant_id', tenantId)
      .eq('role', 'admin')
      .maybeSingle();
    
    if (error) throw error;
    if (!data) return res.status(401).json({ success: false, message: "Senha de administrador incorreta." });
    
    const isMatch = await comparePassword(password.trim(), data.password);
    if (!isMatch) return res.status(401).json({ success: false, message: "Senha de administrador incorreta." });
    
    res.json({ success: true });
  } catch (err: any) {
    console.error('Verify admin error:', err);
    res.status(500).json({ success: false, message: "Erro ao verificar senha." });
  }
});

app.post('/api/auth/change-password', async (req, res) => {
  const { tenantId, oldPassword, newPassword } = req.body;
  
  try {
    // 1. Get the current admin user
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('role', 'admin')
      .maybeSingle();
    
    if (error) throw error;
    if (!data) return res.status(404).json({ success: false, message: "Usuário administrador não encontrado." });
    
    // 2. Verify old password
    const isMatch = await comparePassword(oldPassword.trim(), data.password);
    if (!isMatch) return res.status(401).json({ success: false, message: "Senha atual incorreta." });
    
    // 3. Hash new password
    const hashedNewPassword = await hashPassword(newPassword.trim());
    
    // 4. Update password
    const { error: updateError } = await supabase
      .from('users')
      .update({ password: hashedNewPassword })
      .eq('id', data.id);
    
    if (updateError) throw updateError;
    
    res.json({ success: true, message: "Senha alterada com sucesso!" });
  } catch (err: any) {
    console.error('Change password error:', err);
    res.status(500).json({ success: false, message: "Erro ao alterar senha." });
  }
});

app.post('/api/auth/change-super-password', async (req, res) => {
  const { oldPassword, newPassword } = req.body;
  
  try {
    // 1. Get the super admin user (role = 'super')
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('role', 'super')
      .maybeSingle();
    
    if (error) throw error;
    if (!data) return res.status(404).json({ success: false, message: "Super Admin não encontrado." });
    
    // 2. Verify old password
    const isMatch = await comparePassword(oldPassword.trim(), data.password);
    if (!isMatch) return res.status(401).json({ success: false, message: "Senha atual incorreta." });
    
    // 3. Hash new password
    const hashedNewPassword = await hashPassword(newPassword.trim());
    
    // 4. Update password
    const { error: updateError } = await supabase
      .from('users')
      .update({ password: hashedNewPassword })
      .eq('id', data.id);
    
    if (updateError) throw updateError;
    
    res.json({ success: true, message: "Senha do Super Admin alterada com sucesso!" });
  } catch (err: any) {
    console.error('Change super password error:', err);
    res.status(500).json({ success: false, message: "Erro ao alterar senha do Super Admin." });
  }
});

// Tracking API
app.get('/api/os-tracking/:token', async (req, res) => {
  const { token } = req.params;
  const cleanToken = (token || '').trim();
  console.log('Fetching tracking for token:', cleanToken);

  try {
    // 1. Try finding by tracking_token first
    let { data: order, error } = await supabase
      .from('service_orders')
      .select('id, tenant_id, customer_name, phone_number, device_brand, device_model, defect, repair_details, status, public_notes, created_at, entry_date, exit_date, total, photos, finished_photos, is_tracking_enabled, checklist')
      .eq('tracking_token', cleanToken)
      .maybeSingle();

    // 2. Fallback: if not found, try finding by OS ID directly
    if (!order) {
      const { data: fallbackOrder, error: fallbackError } = await supabase
        .from('service_orders')
        .select('id, tenant_id, customer_name, phone_number, device_brand, device_model, defect, repair_details, status, public_notes, created_at, entry_date, exit_date, total, photos, finished_photos, is_tracking_enabled, checklist')
        .eq('id', cleanToken)
        .maybeSingle();

      if (fallbackError) {
        console.error('Supabase fallback error:', fallbackError);
      } else if (fallbackOrder) {
        order = fallbackOrder;
      }
    }

    if (error) {
      console.error('Supabase error:', error);
      throw error;
    }

    if (!order) {
      console.log('No order found for token:', cleanToken);
      return res.status(404).json({ error: 'Ordem de serviço não encontrada.' });
    }

    if (order.is_tracking_enabled === false) {
      return res.status(403).json({ error: 'O acompanhamento online para esta O.S. está temporariamente desativado.' });
    }

    // Extract diagnostic tests if stored in checklist
    let diagData: any = null;
    if (Array.isArray(order.checklist)) {
      for (const item of order.checklist) {
        if (typeof item === 'string' && item.startsWith('__DIAG_JSON__:')) {
          try {
            diagData = JSON.parse(item.substring(14));
          } catch (e) {}
        }
      }
    }

    // Fetch store / tenant information
    let storeInfo: { name: string; phone?: string; logo?: string } = {
      name: 'TICCELL Assistência Técnica'
    };

    if (order.tenant_id) {
      const [tenantRes, settingsRes] = await Promise.all([
        supabase.from('tenants').select('name, username').eq('id', order.tenant_id).maybeSingle(),
        supabase.from('cloud_data').select('data_json').eq('tenant_id', order.tenant_id).eq('store_key', 'settings').maybeSingle()
      ]);

      if (tenantRes.data) {
        storeInfo.name = tenantRes.data.name || tenantRes.data.username || storeInfo.name;
      }
      if (settingsRes.data?.data_json) {
        const s = settingsRes.data.data_json;
        if (s.storeName) storeInfo.name = s.storeName;
        if (s.phoneNumber) storeInfo.phone = s.phoneNumber;
        if (s.logo) storeInfo.logo = s.logo;
      }
    }

    res.json({
      id: order.id,
      customerName: order.customer_name,
      phoneNumber: order.phone_number,
      deviceBrand: order.device_brand,
      deviceModel: order.device_model,
      defect: order.defect,
      repairDetails: order.repair_details,
      status: order.status || 'Pendente',
      publicNotes: order.public_notes,
      createdAt: order.created_at,
      entryDate: order.entry_date,
      exitDate: order.exit_date,
      total: order.total,
      photos: order.photos || [],
      finishedPhotos: order.finished_photos || [],
      diagnosticTests: diagData,
      store: storeInfo
    });
  } catch (err: any) {
    console.error('Error fetching OS tracking:', err);
    res.status(500).json({ error: 'Erro ao buscar dados do acompanhamento' });
  }
});

// Endpoint para buscar dados e testes de hardware da O.S. (via QR Code / link externo)
app.options('/api/device-test/:idOrToken', (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  return res.status(200).end();
});

app.get('/api/device-test/:idOrToken', async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  const { idOrToken } = req.params;
  const cleanParam = decodeURIComponent(idOrToken || '').trim().replace(/^#/, '');

  try {
    let { data: order, error } = await supabase
      .from('service_orders')
      .select('id, tenant_id, customer_name, phone_number, device_brand, device_model, defect, repair_details, status, checklist, public_notes, created_at, entry_date, tracking_token')
      .eq('tracking_token', cleanParam)
      .maybeSingle();

    if (!order) {
      const { data: fallbackOrder, error: fallbackError } = await supabase
        .from('service_orders')
        .select('id, tenant_id, customer_name, phone_number, device_brand, device_model, defect, repair_details, status, checklist, public_notes, created_at, entry_date, tracking_token')
        .eq('id', cleanParam)
        .maybeSingle();

      if (fallbackError) console.error('Error in fallback order query:', fallbackError);
      if (fallbackOrder) order = fallbackOrder;
    }

    if (error) throw error;
    if (!order) return res.status(404).json({ success: false, error: 'Ordem de Serviço não encontrada.' });

    // Extrair diagnósticos existentes se houver
    let existingDiagnostics = null;
    let cleanChecklist: string[] = [];
    if (Array.isArray(order.checklist)) {
      for (const item of order.checklist) {
        if (typeof item === 'string' && item.startsWith('__DIAG_JSON__:')) {
          try {
            existingDiagnostics = JSON.parse(item.substring(14));
          } catch (e) {}
        } else {
          cleanChecklist.push(item);
        }
      }
    }

    let storeName = 'Assistência Técnica';
    if (order.tenant_id) {
      try {
        const { data: tenant } = await supabase.from('tenants').select('name, username').eq('id', order.tenant_id).maybeSingle();
        if (tenant) storeName = tenant.name || tenant.username || storeName;
      } catch (e) {}
    }

    res.json({
      success: true,
      order: {
        id: order.id,
        tenantId: order.tenant_id,
        customerName: order.customer_name,
        phoneNumber: order.phone_number,
        deviceBrand: order.device_brand,
        deviceModel: order.device_model,
        defect: order.defect,
        status: order.status,
        entryDate: order.entry_date,
        createdAt: order.created_at,
        checklist: cleanChecklist,
        diagnosticTests: existingDiagnostics,
        storeName
      }
    });
  } catch (err: any) {
    console.error('Error fetching device test data:', err);
    res.status(500).json({ success: false, error: 'Erro ao buscar dados do teste de hardware.' });
  }
});

// Endpoint para salvar resultados dos testes de hardware diretamente na O.S. do cliente
app.post('/api/device-test/:idOrToken', async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  const { idOrToken } = req.params;
  const { diagnosticResults } = req.body;
  const cleanParam = decodeURIComponent(idOrToken || '').trim().replace(/^#/, '');

  if (!diagnosticResults || !diagnosticResults.tests) {
    return res.status(400).json({ success: false, error: 'Resultados dos testes são obrigatórios.' });
  }

  try {
    let { data: order, error } = await supabase
      .from('service_orders')
      .select('id, tenant_id, customer_name, checklist')
      .eq('tracking_token', cleanParam)
      .maybeSingle();

    if (!order) {
      const { data: fallbackOrder } = await supabase
        .from('service_orders')
        .select('id, tenant_id, customer_name, checklist')
        .eq('id', cleanParam)
        .maybeSingle();
      if (fallbackOrder) order = fallbackOrder;
    }

    if (error) throw error;
    if (!order) return res.status(404).json({ success: false, error: 'Ordem de Serviço não encontrada.' });

    // Manter checklist anterior do usuário, removendo apenas entradas antigas de diagnóstico
    let currentChecklist: string[] = Array.isArray(order.checklist) ? [...order.checklist] : [];
    currentChecklist = currentChecklist.filter(item => {
      if (typeof item !== 'string') return false;
      if (item.startsWith('__DIAG_JSON__:')) return false;
      if (item.startsWith('🔍 [TESTE]')) return false;
      if (item.startsWith('📱 Touch:') || item.startsWith('✌️ Multi-touch:') || item.startsWith('🎤 Microfone:')) return false;
      if (item.startsWith('🔊 Alto-falante:') || item.startsWith('📞 Fone Auricular:') || item.startsWith('📶 Wi-Fi:')) return false;
      if (item.startsWith('👁️ Sensor de Presença:') || item.startsWith('🔐 Biometria:')) return false;
      return true;
    });

    const tests = diagnosticResults.tests;
    const testChecklistItems: string[] = [];

    const getStatusLabel = (s: string) => s === 'passed' ? 'Aprovado' : s === 'failed' ? 'Reprovado' : 'Não Testado';

    if (tests.touch) {
      testChecklistItems.push(`📱 Touch: ${getStatusLabel(tests.touch.status)} (${tests.touch.details || '100% grade'})`);
    }
    if (tests.multitouch) {
      testChecklistItems.push(`✌️ Multi-touch: ${getStatusLabel(tests.multitouch.status)} (${tests.multitouch.details || 'Múltiplos toques'})`);
    }
    if (tests.mic) {
      testChecklistItems.push(`🎤 Microfone: ${getStatusLabel(tests.mic.status)}`);
    }
    if (tests.speaker) {
      testChecklistItems.push(`🔊 Alto-falante: ${getStatusLabel(tests.speaker.status)}`);
    }
    if (tests.earpiece) {
      testChecklistItems.push(`📞 Fone Auricular: ${getStatusLabel(tests.earpiece.status)}`);
    }
    if (tests.wifi) {
      testChecklistItems.push(`📶 Wi-Fi / Rede: ${getStatusLabel(tests.wifi.status)} (${tests.wifi.details || 'Conectado'})`);
    }
    if (tests.proximity) {
      testChecklistItems.push(`👁️ Sensor de Presença: ${getStatusLabel(tests.proximity.status)}`);
    }
    if (tests.biometrics) {
      testChecklistItems.push(`🔐 Biometria: ${getStatusLabel(tests.biometrics.status)} (${tests.biometrics.details || 'Sensor biométrico'})`);
    }

    // Montar checklist atualizado
    const updatedChecklist = [
      ...currentChecklist,
      ...testChecklistItems,
      `__DIAG_JSON__:${JSON.stringify(diagnosticResults)}`
    ];

    const { error: updateError } = await supabase
      .from('service_orders')
      .update({ checklist: updatedChecklist })
      .eq('id', order.id);

    if (updateError) throw updateError;

    res.json({
      success: true,
      message: 'Resultados dos testes de hardware salvos com sucesso na O.S.!',
      orderId: order.id,
      updatedChecklist: updatedChecklist.filter(i => !i.startsWith('__DIAG_JSON__:')),
      diagnosticResults
    });
  } catch (err: any) {
    console.error('Error saving device test results:', err);
    res.status(500).json({ success: false, error: 'Erro ao salvar resultados dos testes na O.S.' });
  }
});

app.post('/api/suppliers', async (req, res) => {
  const { tenantId, supplier } = req.body;
  if (!tenantId) {
    return res.status(400).json({ error: 'tenantId is required' });
  }

  try {
    const result = await OnlineDB.upsertSupplier(tenantId, supplier);
    res.json(result);
  } catch (err: any) {
    console.error('Error saving supplier:', err);
    res.status(500).json({ success: false, message: err.message || 'Error saving supplier' });
  }
});

app.delete('/api/suppliers/:id', async (req, res) => {
  const { id } = req.params;
  if (!id) {
    return res.status(400).json({ error: 'id is required' });
  }

  try {
    const result = await OnlineDB.deleteSupplier(id);
    res.json(result);
  } catch (err: any) {
    console.error('Error deleting supplier:', err);
    res.status(500).json({ success: false, message: err.message || 'Error deleting supplier' });
  }
});

app.post('/api/create-preference', async (req, res) => {
  try {
    const { title, unit_price, quantity, tenantId, planType } = req.body;

    const token = process.env.MERCADO_PAGO_ACCESS_TOKEN || process.env.MP_ACCESS_TOKEN;
    if (!token) {
      return res.status(500).json({ 
        error: 'Token do Mercado Pago não configurado.',
        details: 'Certifique-se de que MERCADO_PAGO_ACCESS_TOKEN ou MP_ACCESS_TOKEN está definida no Vercel/Ambiente.'
      });
    }

    const origin = req.get('origin') || (req.get('referer') ? new URL(req.get('referer') as string).origin : null);
    const host = req.get('host');
    const protocol = host?.includes('localhost') ? 'http' : 'https';
    const fallbackUrl = `${protocol}://${host}`;
    const baseUrl = origin || fallbackUrl;

    const preference = {
      items: [
        {
          id: planType,
          title: title,
          unit_price: Number(unit_price),
          quantity: Number(quantity),
        },
      ],
      back_urls: {
        success: `${baseUrl}/`,
        failure: `${baseUrl}/`,
        pending: `${baseUrl}/`
      },
      auto_return: 'approved' as 'approved',
      external_reference: `${tenantId}|${planType}`
    };

    const client = getMPClient();
    const preferenceClient = new Preference(client);
    console.log('Creating preference for:', { tenantId, planType, unit_price });
    
    const response = await preferenceClient.create({ body: preference });
    console.log('Preference created successfully:', response.id);
    
    res.json({ id: response.id, init_point: response.init_point });

  } catch (error: any) {
    console.error('Error creating Mercado Pago preference:', error);
    const errorMessage = error.message || 'Failed to create payment preference.';
    res.status(500).json({ error: errorMessage, details: error });
  }
});

app.post(['/api/webhook', '/api/webhook/'], async (req, res) => {
  try {
    const payment = req.body;

    if (payment?.type === 'payment' || payment?.action === 'payment.updated') {
      const client = getMPClient();
      const paymentClient = new Payment(client);
      const paymentId = payment?.data?.id || payment?.id;
      
      if (paymentId) {
        const data = await paymentClient.get({ id: paymentId });
        const externalReference = data.external_reference;
        const status = data.status;

        if (externalReference && status === 'approved') {
          const [tenantId, planType] = externalReference.split('|');
          const plans = {
            monthly: 1,
            quarterly: 3,
            yearly: 12
          }

          const months = plans[planType as keyof typeof plans];

          if (months) {
            const expiresAt = new Date();
            expiresAt.setMonth(expiresAt.getMonth() + months);

            // Update tenant subscription in your database
            await OnlineDB.updateSubscription(tenantId, months, planType as any);
            console.log(`Subscription updated successfully for tenant ${tenantId}`);
          }
        } else {
          console.log(`Payment ${paymentId} status is ${status}, not updating subscription.`);
        }
      }
    }
    res.status(200).send('OK');
  } catch (error) {
    console.error('Error processing webhook:', error);
    // Always return 200 to MercadoPago to acknowledge receipt, even if processing fails
    res.status(200).send('OK');
  }
});

async function startServer() {
  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    // Serve a basic service worker in dev to prevent MIME type errors if the plugin fails
    app.get('/sw.js', (req, res) => {
      res.setHeader('Content-Type', 'application/javascript');
      res.setHeader('Service-Worker-Allowed', '/');
      res.send(`
        self.addEventListener('install', (event) => {
          self.skipWaiting();
          console.log('Dev SW installed');
        });
        self.addEventListener('activate', (event) => {
          event.waitUntil(self.clients.claim());
          console.log('Dev SW activated');
        });
        self.addEventListener('fetch', (event) => {
          // Pass through requests in dev
        });
      `);
    });

    const vite = await createViteServer({
      server: { 
        middlewareMode: true,
        proxy: {}
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Production: Serve static files from dist
    const distPath = path.join(__dirname, 'dist');
    console.log('Production mode: Serving static files from', distPath);

    // Serve service worker and manifest explicitly to ensure correct MIME types and no caching issues
    // Defined BEFORE express.static to ensure headers are applied
    app.get('/sw.js', (req, res) => {
      res.setHeader('Content-Type', 'application/javascript');
      res.setHeader('Service-Worker-Allowed', '/');
      
      const swPath = path.join(distPath, 'sw.js');
      if (fs.existsSync(swPath)) {
        res.sendFile(swPath, (err) => {
          if (err) {
            console.error('Error serving sw.js:', err);
            res.status(404).end();
          }
        });
      } else {
        // Fallback to a no-op service worker if the file is missing in dist
        res.send(`
          self.addEventListener('install', (event) => {
            self.skipWaiting();
          });
          self.addEventListener('activate', (event) => {
            event.waitUntil(self.clients.claim());
          });
          self.addEventListener('fetch', (event) => {
            // No-op fetch handler
          });
        `);
      }
    });

    app.get('/manifest.webmanifest', (req, res) => {
      console.log('Serving manifest.webmanifest');
      res.setHeader('Content-Type', 'application/manifest+json');
      res.sendFile(path.join(distPath, 'manifest.webmanifest'), (err) => {
        if (err) {
          console.error('Error serving manifest.webmanifest:', err);
          res.status(404).end();
        }
      });
    });

    app.use(express.static(distPath));

    // SPA fallback for production
    app.get(/(.*)/, (req, res) => {
      if (req.path.startsWith('/api')) {
        return res.status(404).json({ error: 'API route not found' });
      }
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
