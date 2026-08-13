import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || 'https://lawcmqsjhwuhogsukhbf.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || 'sb_publishable_c2wQfanSj96FRWqoCq9KIw_2FhxuRBv';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const hashPassword = async (password: string) => {
  const salt = await bcrypt.genSalt(10);
  return await bcrypt.hash(password, salt);
};

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

  const { oldPassword, newPassword } = req.body || {};

  try {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('role', 'super')
      .maybeSingle();

    if (error) throw error;
    if (!data) return res.status(404).json({ success: false, message: 'Super Admin não encontrado.' });

    const isMatch = await comparePassword(String(oldPassword).trim(), data.password);
    if (!isMatch) return res.status(401).json({ success: false, message: 'Senha atual incorreta.' });

    const hashedNewPassword = await hashPassword(String(newPassword).trim());

    const { error: updateError } = await supabase
      .from('users')
      .update({ password: hashedNewPassword })
      .eq('id', data.id);

    if (updateError) throw updateError;

    return res.status(200).json({ success: true, message: 'Senha do Super Admin alterada com sucesso!' });
  } catch (err: any) {
    console.error('Change super password error:', err);
    return res.status(500).json({ success: false, message: 'Erro ao alterar senha do Super Admin.' });
  }
}
