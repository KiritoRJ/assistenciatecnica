import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || 'https://lawcmqsjhwuhogsukhbf.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || 'sb_publishable_c2wQfanSj96FRWqoCq9KIw_2FhxuRBv';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const comparePassword = async (password: string, hash: string) => {
  if (!hash) return false;
  if (hash.startsWith('$2a$') || hash.startsWith('$2b$')) {
    return await bcrypt.compare(password, hash);
  }
  return password === hash;
};

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ success: false, message: 'Usuário e senha são obrigatórios.' });
  }

  const cleanUser = String(username).trim().toLowerCase();

  try {
    const { data, error } = await supabase
      .from('users')
      .select('*, tenants(*, tenant_limits(*))')
      .eq('username', cleanUser)
      .maybeSingle();

    if (error) {
      console.error('Supabase error on login:', error);
      return res.status(500).json({ success: false, message: 'Erro ao consultar banco de dados: ' + error.message });
    }

    if (!data) {
      return res.status(401).json({ success: false, message: 'Usuário ou senha incorretos.' });
    }

    const isMatch = await comparePassword(String(password).trim(), data.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Usuário ou senha incorretos.' });
    }

    const tenant = data.tenants;
    const limits = tenant?.tenant_limits;
    const expiresAt = tenant?.subscription_expires_at;
    const isExpired = expiresAt ? new Date(expiresAt) < new Date() : false;

    return res.status(200).json({ 
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
    return res.status(500).json({ success: false, message: 'Erro interno ao realizar login: ' + (err?.message || err) });
  }
}
