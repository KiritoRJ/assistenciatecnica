import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://lawcmqsjhwuhogsukhbf.supabase.co';
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_c2wQfanSj96FRWqoCq9KIw_2FhxuRBv';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

export default async function handler(req: any, res: any) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Support both query param (?token=xxx) or extracted from url
  let token = req.query?.token;
  if (!token && req.url) {
    const parts = req.url.split('?')[0].split('/');
    token = parts[parts.length - 1];
  }

  const cleanToken = (typeof token === 'string' ? token : Array.isArray(token) ? token[0] : '').trim();

  if (!cleanToken) {
    return res.status(400).json({ error: 'Token da O.S. não informado.' });
  }

  try {
    // 1. Try finding by tracking_token first
    let { data: order, error } = await supabase
      .from('service_orders')
      .select('id, tenant_id, customer_name, phone_number, device_brand, device_model, defect, repair_details, status, public_notes, created_at, entry_date, exit_date, total, photos, finished_photos, is_tracking_enabled')
      .eq('tracking_token', cleanToken)
      .maybeSingle();

    // 2. Fallback: if not found, try finding by OS ID directly
    if (!order) {
      const { data: fallbackOrder, error: fallbackError } = await supabase
        .from('service_orders')
        .select('id, tenant_id, customer_name, phone_number, device_brand, device_model, defect, repair_details, status, public_notes, created_at, entry_date, exit_date, total, photos, finished_photos, is_tracking_enabled')
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
      return res.status(404).json({ error: 'Ordem de serviço não encontrada.' });
    }

    if (order.is_tracking_enabled === false) {
      return res.status(403).json({ error: 'O acompanhamento online para esta O.S. está temporariamente desativado.' });
    }

    // Fetch store / tenant information
    let storeInfo: { name: string; phone?: string; logo?: string } = {
      name: 'Assistência Técnica'
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

    return res.status(200).json({
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
      store: storeInfo
    });
  } catch (err: any) {
    console.error('Error in /api/os-tracking:', err);
    return res.status(500).json({ error: 'Erro ao buscar dados do acompanhamento' });
  }
}
