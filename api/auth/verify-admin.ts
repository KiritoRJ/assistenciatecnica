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

  const { tenantId, password } = req.body || {};

  try {
    const { data, error } = await supabase
      .from('users')
      .select('password')
      .eq('tenant_id', tenantId)
      .eq('role', 'admin')
      .maybeSingle();

    if (error) throw error;
    if (!data) return res.status(401).json({ success: false, message: 'Senha de administrador incorreta.' });

    const isMatch = await comparePassword(String(password).trim(), data.password);
    if (!isMatch) return res.status(401).json({ success: false, message: 'Senha de administrador incorreta.' });

    return res.status(200).json({ success: true });
  } catch (err: any) {
    console.error('Verify admin error:', err);
    return res.status(500).json({ success: false, message: 'Erro ao verificar senha.' });
  }
}
