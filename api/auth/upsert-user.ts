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

  const { tenantId, storeName, user } = req.body || {};
  if (!user || !user.name) {
    return res.status(400).json({ success: false, message: 'Dados do usuário inválidos.' });
  }

  try {
    const baseName = user.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, '_');
    const username = (user.username || baseName + '_' + Math.random().toString(36).substr(2, 4)).trim().toLowerCase();
    
    let password = (user.password && user.password.trim() !== '') ? user.password : '123456';
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
    return res.status(200).json({ success: true, username });
  } catch (e: any) {
    console.error('Upsert user error:', e);
    return res.status(500).json({ success: false, message: e.message || 'Erro ao salvar usuário' });
  }
}
