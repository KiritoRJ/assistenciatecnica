import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://lawcmqsjhwuhogsukhbf.supabase.co';
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_c2wQfanSj96FRWqoCq9KIw_2FhxuRBv';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

export default async function handler(req: any, res: any) {
  // Configuração CORS permissiva para permitir acesso de qualquer servidor ou domínio
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Extrair idOrToken de query (?idOrToken=xxx ou ?token=xxx) ou do final da URL
  let idOrToken = req.query?.idOrToken || req.query?.token || req.query?.id;
  if (!idOrToken && req.url) {
    const parts = req.url.split('?')[0].split('/');
    idOrToken = parts[parts.length - 1];
  }

  const cleanParam = (typeof idOrToken === 'string' ? idOrToken : Array.isArray(idOrToken) ? idOrToken[0] : '').trim();

  if (!cleanParam) {
    return res.status(400).json({ success: false, error: 'Identificador ou token da O.S. não informado.' });
  }

  // --- GET: BUSCAR DADOS DA O.S. PARA O TESTE ---
  if (req.method === 'GET') {
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
      if (!order) {
        return res.status(404).json({ success: false, error: 'Ordem de Serviço não encontrada.' });
      }

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

      return res.status(200).json({
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
      console.error('Error in GET /api/device-test:', err);
      return res.status(500).json({ success: false, error: 'Erro ao buscar dados do teste de hardware.' });
    }
  }

  // --- POST: SALVAR RESULTADOS DOS TESTES DE HARDWARE NA O.S. ---
  if (req.method === 'POST') {
    let body = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch (e) {
        body = {};
      }
    }

    const { diagnosticResults } = body || {};

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
      if (!order) {
        return res.status(404).json({ success: false, error: 'Ordem de Serviço não encontrada.' });
      }

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

      return res.status(200).json({
        success: true,
        message: 'Resultados dos testes de hardware salvos com sucesso na O.S.!',
        orderId: order.id,
        updatedChecklist: updatedChecklist.filter(i => !i.startsWith('__DIAG_JSON__:')),
        diagnosticResults
      });
    } catch (err: any) {
      console.error('Error in POST /api/device-test:', err);
      return res.status(500).json({ success: false, error: 'Erro ao salvar resultados dos testes na O.S.' });
    }
  }

  return res.status(405).json({ error: 'Method Not Allowed' });
}
