import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || 'https://lawcmqsjhwuhogsukhbf.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || 'sb_publishable_c2wQfanSj96FRWqoCq9KIw_2FhxuRBv';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const hashPassword = async (password: string) => {
  const salt = await bcrypt.genSalt(10);
  return await bcrypt.hash(password, salt);
};

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  const { id, storeName, adminUsername, adminPasswordPlain, logoUrl, phoneNumber } = req.body || {};

  if (!id || !storeName || !adminUsername || !adminPasswordPlain) {
    return res.status(400).json({ success: false, message: 'Campos obrigatórios ausentes.' });
  }

  try {
    const hashedPassword = await hashPassword(String(adminPasswordPlain).trim());
    
    const trialDays = 7;
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + trialDays);

    const trialLimits = { maxUsers: 1000, maxOS: 1000, maxProducts: 1000 };

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
        username: String(adminUsername).toLowerCase().trim(),
        password: hashedPassword,
        name: storeName,
        role: 'admin',
        tenant_id: id,
        store_name: storeName,
        photo: logoUrl
      }]);
    if (uError) throw uError;

    return res.status(200).json({ success: true });
  } catch (e: any) {
    console.error('Register tenant error:', e);
    return res.status(500).json({ success: false, message: e.message || 'Erro ao registrar loja' });
  }
}
