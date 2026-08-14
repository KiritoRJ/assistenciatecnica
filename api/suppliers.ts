import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || 'https://lawcmqsjhwuhogsukhbf.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || 'sb_publishable_c2wQfanSj96FRWqoCq9KIw_2FhxuRBv';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

export default async function handler(req: any, res: any) {
  if (req.method === 'GET') {
    const tenantId = req.query.tenantId;
    if (!tenantId) {
      return res.status(400).json({ error: 'tenantId is required' });
    }
    try {
      const { data, error } = await supabase
        .from('suppliers')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return res.status(200).json(data || []);
    } catch (e: any) {
      console.error('Error fetching suppliers:', e);
      return res.status(500).json({ error: e.message || 'Error fetching suppliers' });
    }
  }

  if (req.method === 'POST') {
    const { tenantId, supplier } = req.body || {};
    if (!tenantId || !supplier) {
      return res.status(400).json({ success: false, message: 'tenantId e dados do fornecedor são obrigatórios' });
    }
    try {
      const payload: any = {
        id: supplier.id || undefined,
        tenant_id: tenantId,
        name: supplier.name,
        phone: supplier.phone || '',
        email: supplier.email || ''
      };

      const { data, error } = await supabase
        .from('suppliers')
        .upsert(payload)
        .select()
        .single();

      if (error) throw error;
      return res.status(200).json({ success: true, data });
    } catch (e: any) {
      console.error('Error saving supplier:', e);
      return res.status(500).json({ success: false, message: e.message });
    }
  }

  if (req.method === 'DELETE') {
    const id = req.query.id || req.body?.id;
    if (!id) {
      return res.status(400).json({ success: false, message: 'id is required' });
    }
    try {
      const { error } = await supabase
        .from('suppliers')
        .delete()
        .eq('id', id);
      if (error) throw error;
      return res.status(200).json({ success: true });
    } catch (e: any) {
      console.error('Error deleting supplier:', e);
      return res.status(500).json({ success: false, message: e.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
