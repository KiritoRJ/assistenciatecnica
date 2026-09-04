import React, { useState, useEffect, useRef } from 'react';
import { 
  Loader2, 
  Smartphone, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  Wrench, 
  PackageCheck, 
  Calendar, 
  MessageCircle, 
  ShieldCheck, 
  ChevronRight, 
  RotateCw,
  Sparkles,
  Image as ImageIcon,
  Radio,
  BellRing,
  CheckCircle,
  X,
  Gamepad2
} from 'lucide-react';
import { supabase } from '../utils/api';
import { SnakeGameModal } from './SnakeGameModal';

interface Props {
  token: string;
}

interface TrackingData {
  id: string;
  customerName: string;
  phoneNumber?: string;
  deviceBrand: string;
  deviceModel: string;
  defect: string;
  repairDetails?: string;
  status: string;
  publicNotes?: string;
  createdAt: string;
  entryDate?: string;
  exitDate?: string;
  total?: number;
  photos?: string[];
  finishedPhotos?: string[];
  store?: {
    name: string;
    phone?: string;
    logo?: string;
  };
}

const STAGES = [
  { key: 'Recebido', label: 'Recebido', desc: 'Aparelho recebido na assistência e aguardando fila técnica.', icon: Clock },
  { key: 'Em Análise', label: 'Em Análise', desc: 'Técnico realizando testes e diagnóstico do defeito.', icon: Smartphone },
  { key: 'Aguardando Peça', label: 'Aguardando Peça', desc: 'Peça necessária solicitada junto ao fornecedor.', icon: Wrench },
  { key: 'Aprovado', label: 'Aprovado', desc: 'Orçamento aprovado e serviço programado.', icon: CheckCircle2 },
  { key: 'Em Manutenção', label: 'Em Manutenção', desc: 'Serviço em execução na bancada técnica.', icon: Wrench },
  { key: 'Concluído', label: 'Concluído', desc: 'Serviço finalizado com sucesso e testes de qualidade aprovados.', icon: Sparkles },
  { key: 'Entregue', label: 'Entregue', desc: 'Aparelho retirado pelo cliente com garantia ativada.', icon: PackageCheck },
];

const getStatusIndex = (status: string) => {
  const norm = (status || '').toLowerCase().trim();
  if (norm.includes('entreg')) return 6;
  if (norm.includes('conclu') || norm.includes('pronto')) return 5;
  if (norm.includes('repar') || norm.includes('manuten')) return 4;
  if (norm.includes('aprov')) return 3;
  if (norm.includes('peça') || norm.includes('peca') || norm.includes('aguard')) return 2;
  if (norm.includes('análise') || norm.includes('analise')) return 1;
  return 0; // Recebido / Pendente
};

const getStatusBadgeColor = (status: string) => {
  const norm = (status || '').toLowerCase();
  if (norm.includes('entregue')) return 'bg-emerald-600 text-white border-emerald-400 shadow-emerald-500/20';
  if (norm.includes('conclu') || norm.includes('pronto')) return 'bg-emerald-600 text-white border-emerald-400 shadow-emerald-500/20';
  if (norm.includes('reparo') || norm.includes('manuten')) return 'bg-blue-600 text-white border-blue-400 shadow-blue-500/20';
  if (norm.includes('aprov')) return 'bg-cyan-600 text-white border-cyan-400 shadow-cyan-500/20';
  if (norm.includes('peça') || norm.includes('peca') || norm.includes('aguard')) return 'bg-amber-500 text-white border-amber-400 shadow-amber-500/20';
  if (norm.includes('análise') || norm.includes('analise')) return 'bg-purple-600 text-white border-purple-400 shadow-purple-500/20';
  if (norm.includes('cancel')) return 'bg-red-500 text-white border-red-400 shadow-red-500/20';
  return 'bg-slate-700 text-white border-slate-500 shadow-slate-500/20';
};

const PublicTrackingPage: React.FC<Props> = ({ token }) => {
  const [order, setOrder] = useState<TrackingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);
  const [statusUpdateToast, setStatusUpdateToast] = useState<{ prev: string; current: string } | null>(null);
  const [isRealtimeConnected, setIsRealtimeConnected] = useState(true);
  const [lastSyncTime, setLastSyncTime] = useState<Date>(new Date());
  const [highlightPulse, setHighlightPulse] = useState(false);
  const [isSnakeGameOpen, setIsSnakeGameOpen] = useState(false);

  const orderRef = useRef<TrackingData | null>(null);
  orderRef.current = order;

  const fetchDirectFromSupabase = async (cleanToken: string): Promise<TrackingData> => {
    // 1. Try finding by tracking_token first
    let { data: orderData, error: orderErr } = await supabase
      .from('service_orders')
      .select('id, tenant_id, customer_name, phone_number, device_brand, device_model, defect, repair_details, status, public_notes, created_at, entry_date, exit_date, total, photos, finished_photos, is_tracking_enabled')
      .eq('tracking_token', cleanToken)
      .maybeSingle();

    // 2. Fallback: if not found, try finding by OS ID directly
    if (!orderData) {
      const { data: fallbackOrder, error: fallbackError } = await supabase
        .from('service_orders')
        .select('id, tenant_id, customer_name, phone_number, device_brand, device_model, defect, repair_details, status, public_notes, created_at, entry_date, exit_date, total, photos, finished_photos, is_tracking_enabled')
        .eq('id', cleanToken)
        .maybeSingle();

      if (fallbackOrder) {
        orderData = fallbackOrder;
      } else if (fallbackError) {
        throw fallbackError;
      }
    }

    if (orderErr) throw orderErr;
    if (!orderData) {
      throw new Error('Ordem de Serviço não encontrada. Verifique se o link está correto ou se a O.S. já foi salva no sistema.');
    }

    if (orderData.is_tracking_enabled === false) {
      throw new Error('O acompanhamento online para esta Ordem de Serviço foi desativado pela loja.');
    }

    let storeInfo: { name: string; phone?: string; logo?: string } = {
      name: 'Assistência Técnica'
    };

    if (orderData.tenant_id) {
      try {
        const [tenantRes, settingsRes] = await Promise.all([
          supabase.from('tenants').select('name, username').eq('id', orderData.tenant_id).maybeSingle(),
          supabase.from('cloud_data').select('data_json').eq('tenant_id', orderData.tenant_id).eq('store_key', 'settings').maybeSingle()
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
      } catch (e) {
        console.warn('Could not load store info:', e);
      }
    }

    return {
      id: orderData.id,
      customerName: orderData.customer_name,
      phoneNumber: orderData.phone_number,
      deviceBrand: orderData.device_brand,
      deviceModel: orderData.device_model,
      defect: orderData.defect,
      repairDetails: orderData.repair_details,
      status: orderData.status || 'Pendente',
      publicNotes: orderData.public_notes,
      createdAt: orderData.created_at,
      entryDate: orderData.entry_date,
      exitDate: orderData.exit_date,
      total: orderData.total,
      photos: orderData.photos || [],
      finishedPhotos: orderData.finished_photos || [],
      store: storeInfo
    };
  };

  const fetchTracking = async (showLoading = true, silent = false) => {
    if (showLoading) setLoading(true);
    if (!silent) setError(null);
    const cleanToken = (token || '').trim();

    try {
      let data: TrackingData | null = null;

      // 1. Tenta buscar via API
      try {
        const res = await fetch(`/api/os-tracking/${encodeURIComponent(cleanToken)}`);
        const contentType = res.headers.get('content-type') || '';
        
        // Verifica se a resposta é realmente JSON válido e não a página HTML do SPA
        if (res.ok && contentType.includes('application/json')) {
          data = await res.json();
        } else if (res.status === 404 && contentType.includes('application/json')) {
          const errJson = await res.json().catch(() => null);
          throw new Error(errJson?.error || 'Ordem de Serviço não encontrada.');
        } else if (res.status === 403 && contentType.includes('application/json')) {
          const errJson = await res.json().catch(() => null);
          throw new Error(errJson?.error || 'O acompanhamento online para esta O.S. está desativado.');
        }
      } catch (apiErr: any) {
        if (apiErr.message?.includes('não encontrada') || apiErr.message?.includes('desativado')) {
          throw apiErr;
        }
        console.warn('API fetch failed, falling back to direct Supabase query:', apiErr);
      }

      // 2. Se a API retornou HTML (ex: Vercel SPA rewrite) ou falhou na rota, busca direto no Supabase
      if (!data) {
        data = await fetchDirectFromSupabase(cleanToken);
      }
      
      // Checa se o status mudou em tempo real
      if (orderRef.current && orderRef.current.status !== data.status) {
        const prevStatus = orderRef.current.status;
        setStatusUpdateToast({ prev: prevStatus, current: data.status });
        setHighlightPulse(true);
        setTimeout(() => setHighlightPulse(false), 3000);
      }

      setOrder(data);
      setLastSyncTime(new Date());
    } catch (err: any) {
      if (!silent) {
        setError(err.message || 'Erro de conexão ao carregar acompanhamento.');
      }
    } finally {
      if (showLoading) setLoading(false);
      setIsRefreshing(false);
    }
  };

  // Carga inicial
  useEffect(() => {
    fetchTracking(true);
  }, [token]);

  // Conexão em Tempo Real com o Supabase Realtime Channel
  useEffect(() => {
    const cleanToken = (token || '').trim();
    if (!cleanToken) return;

    // Escuta alterações na tabela service_orders
    const channel = supabase
      .channel(`public_tracking_${cleanToken}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'service_orders'
        },
        (payload) => {
          const newRow = payload.new as any;
          if (!newRow) return;

          // Verifica se o evento se refere a esta O.S.
          const isMatching = 
            (newRow.tracking_token && newRow.tracking_token === cleanToken) ||
            (newRow.id && newRow.id === cleanToken) ||
            (orderRef.current?.id && newRow.id === orderRef.current.id);

          if (isMatching) {
            console.log('[Realtime] Atualização detectada no status da O.S.:', newRow.status);
            // Atualiza de imediato os campos básicos
            if (newRow.status && orderRef.current && orderRef.current.status !== newRow.status) {
              setStatusUpdateToast({ prev: orderRef.current.status, current: newRow.status });
              setHighlightPulse(true);
              setTimeout(() => setHighlightPulse(false), 3000);
            }
            
            // Revalida todos os dados completos da O.S.
            fetchTracking(false, true);
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setIsRealtimeConnected(true);
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          setIsRealtimeConnected(false);
        }
      });

    // Fallback de polling contínuo a cada 3.5 segundos enquanto a aba estiver visível
    const pollInterval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        fetchTracking(false, true);
      }
    }, 3500);

    // Atualiza imediatamente quando a janela/aba ganhar foco
    const handleFocus = () => {
      fetchTracking(false, true);
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleFocus);
    window.addEventListener('online', handleFocus);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(pollInterval);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleFocus);
      window.removeEventListener('online', handleFocus);
    };
  }, [token]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchTracking(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-6 text-white text-center">
        <div className="w-16 h-16 bg-blue-600/20 border border-blue-500/30 rounded-3xl flex items-center justify-center mb-4">
          <Loader2 className="animate-spin text-blue-400" size={32} />
        </div>
        <h2 className="text-lg font-black uppercase tracking-wider">Localizando Ordem de Serviço</h2>
        <p className="text-xs text-slate-400 mt-1">Conectando canal em tempo real...</p>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-6 text-center text-white">
        <div className="w-20 h-20 bg-orange-500/10 border border-orange-500/30 rounded-3xl flex items-center justify-center mb-6">
          <AlertTriangle className="text-orange-500" size={40} />
        </div>
        <h2 className="text-2xl font-black tracking-tight mb-2">Ordem de Serviço Não Encontrada</h2>
        <p className="text-sm text-slate-400 max-w-sm mb-8 leading-relaxed">
          {error || 'Não encontramos nenhum registro com este código de acompanhamento.'}
        </p>
        <button 
          onClick={() => fetchTracking(true)} 
          className="bg-blue-600 hover:bg-blue-500 text-white font-black text-xs uppercase tracking-widest px-6 py-3.5 rounded-2xl shadow-lg shadow-blue-600/30 transition-all flex items-center gap-2"
        >
          <RotateCw size={16} /> Tentar Novamente
        </button>
      </div>
    );
  }

  const storeName = order.store?.name || 'TICCELL Assistência Técnica';
  const storePhone = order.store?.phone ? order.store.phone.replace(/\D/g, '') : '';
  const cleanPhone = storePhone.length <= 11 && !storePhone.startsWith('55') ? `55${storePhone}` : storePhone;
  const currentStageIndex = getStatusIndex(order.status);
  const formattedOsNumber = order.id ? order.id.split('-')[0] : '';
  
  const displayDate = order.entryDate || (order.createdAt ? new Date(order.createdAt).toLocaleDateString('pt-BR') : '-');

  const waMessage = encodeURIComponent(
    `Olá, ${storeName}! 👋\nEstou acompanhando minha O.S. #${formattedOsNumber} (${order.deviceBrand} ${order.deviceModel}) e gostaria de tirar uma dúvida sobre o andamento.`
  );
  const waUrl = cleanPhone ? `https://wa.me/${cleanPhone}?text=${waMessage}` : null;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans pb-28 selection:bg-blue-500 selection:text-white">
      {/* TOAST DE ATUALIZAÇÃO EM TEMPO REAL (GLOBAL) */}
      {statusUpdateToast && (
        <div className="fixed top-4 left-4 right-4 z-[9999] max-w-md mx-auto animate-in slide-in-from-top-4 duration-300">
          <div className="bg-emerald-600 text-white p-4 rounded-2xl shadow-2xl shadow-emerald-950/90 border-2 border-emerald-300 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-700/90 flex items-center justify-center shrink-0 animate-bounce">
                <BellRing size={20} className="text-white" />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-wider text-emerald-200">Status Atualizado em Tempo Real</p>
                <p className="text-xs font-bold leading-tight mt-0.5">
                  A O.S. agora está em: <span className="underline font-black text-emerald-100">{statusUpdateToast.current}</span>
                </p>
              </div>
            </div>
            <button 
              onClick={() => setStatusUpdateToast(null)} 
              className="p-1.5 hover:bg-emerald-700/60 rounded-xl text-emerald-100 hover:text-white transition-colors"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      {/* HEADER FIXO SUPERIOR */}
      <header className="sticky top-0 z-30 bg-slate-900/85 backdrop-blur-xl border-b border-slate-800/80 px-4 py-3 sm:px-8">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            {order.store?.logo ? (
              <img src={order.store.logo} alt={storeName} className="w-9 h-9 rounded-xl object-contain bg-white/10 p-1 border border-white/10" />
            ) : (
              <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center font-black text-white text-sm shadow-md shadow-blue-600/30">
                <Smartphone size={18} />
              </div>
            )}
            <div>
              <h1 className="text-xs sm:text-sm font-black uppercase tracking-tight text-white line-clamp-1">{storeName}</h1>
              <div className="flex items-center gap-1.5">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <p className="text-[9px] font-bold uppercase tracking-wider text-emerald-400">
                  {isRealtimeConnected ? 'Ao Vivo • Tempo Real' : 'Sincronizando'}
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button 
              onClick={() => setIsSnakeGameOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 text-[10px] font-black uppercase tracking-wider transition-all active:scale-95 shadow-sm"
              title="Jogar jogo da cobrinha"
            >
              <Gamepad2 size={13} className="animate-bounce" />
              <span>Jogar</span>
            </button>

            <button 
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-bold uppercase tracking-wider transition-all active:scale-95 disabled:opacity-50"
              title="Checar atualizações agora"
            >
              <RotateCw size={12} className={isRefreshing ? 'animate-spin text-blue-400' : ''} />
              <span className="hidden sm:inline">Checar Agora</span>
            </button>
          </div>
        </div>
      </header>

      {/* CONTEÚDO PRINCIPAL */}
      <main className="max-w-2xl mx-auto px-4 pt-5 space-y-4 sm:space-y-6">
        
        {/* BANNER DE INFORMAÇÃO TEMPO REAL */}
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl px-3.5 py-2 flex items-center justify-between gap-2 text-[11px] text-slate-400">
          <div className="flex items-center gap-2">
            <Radio size={14} className="text-emerald-400 animate-pulse shrink-0" />
            <span>Página atualizada automaticamente assim que o técnico salva uma alteração.</span>
          </div>
        </div>

        {/* CARD PRINCIPAL DE IDENTIFICAÇÃO */}
        <div className={`bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800 rounded-3xl p-5 sm:p-7 border border-slate-800 shadow-2xl relative overflow-hidden transition-all duration-500 ${
          highlightPulse ? 'ring-4 ring-emerald-500/50 shadow-emerald-500/20' : ''
        }`}>
          <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20"></div>

          <div className="flex items-start justify-between gap-4 mb-5">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Ordem de Serviço</span>
                <span className="w-1 h-1 rounded-full bg-slate-600"></span>
                <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1">
                  <Calendar size={11} className="text-blue-400" /> {displayDate}
                </span>
              </div>
              <h2 className="text-3xl font-black text-white tracking-tight">#{formattedOsNumber}</h2>
              {order.customerName && (
                <p className="text-xs font-bold text-slate-300 mt-0.5">Cliente: <span className="text-white">{order.customerName}</span></p>
              )}
            </div>

            <span className={`px-3.5 py-1.5 rounded-2xl text-[11px] font-black uppercase tracking-wider shadow-lg border shrink-0 transition-transform duration-300 ${
              highlightPulse ? 'scale-110' : ''
            } ${getStatusBadgeColor(order.status)}`}>
              {order.status}
            </span>
          </div>

          {/* DETALHES DO APARELHO */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-4 border-t border-slate-800/80">
            <div className="bg-slate-950/60 rounded-2xl p-3.5 border border-slate-800/60">
              <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 block mb-1">Aparelho / Modelo</span>
              <p className="text-sm font-black text-white flex items-center gap-1.5">
                <Smartphone size={15} className="text-blue-400 shrink-0" />
                {order.deviceBrand} {order.deviceModel}
              </p>
            </div>

            <div className="bg-slate-950/60 rounded-2xl p-3.5 border border-slate-800/60">
              <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 block mb-1">Serviço / Defeito</span>
              <p className="text-xs font-bold text-slate-200 line-clamp-2">
                {order.defect || 'Manutenção geral'}
              </p>
            </div>
          </div>
        </div>

        {/* MENSAGEM / OBSERVAÇÃO DA LOJA (SE HOUVER) */}
        {order.publicNotes && (
          <div className="bg-gradient-to-r from-blue-950/40 via-blue-900/20 to-slate-900 rounded-3xl p-5 border border-blue-500/30 shadow-lg animate-in fade-in">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-6 h-6 rounded-lg bg-blue-500/20 flex items-center justify-center text-blue-400">
                <MessageCircle size={14} />
              </div>
              <h3 className="text-xs font-black uppercase tracking-wider text-blue-300">Nota da Assistência</h3>
            </div>
            <p className="text-xs sm:text-sm text-slate-200 font-medium leading-relaxed bg-slate-950/50 p-3.5 rounded-2xl border border-blue-500/20">
              {order.publicNotes}
            </p>
          </div>
        )}

        {/* TIMELINE DE STATUS */}
        <div className="bg-slate-900 rounded-3xl p-5 sm:p-6 border border-slate-800 shadow-xl space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-300 flex items-center gap-2">
              <Clock size={14} className="text-blue-400" /> Etapas do Atendimento
            </h3>
            <span className="text-[10px] font-bold text-blue-400 bg-blue-950/80 px-2.5 py-1 rounded-full border border-blue-800/50">
              Etapa {currentStageIndex + 1} de {STAGES.length}
            </span>
          </div>

          <div className="space-y-3 relative before:absolute before:inset-0 before:left-5 before:top-4 before:bottom-4 before:w-0.5 before:bg-slate-800">
            {STAGES.map((stage, idx) => {
              const isPast = idx < currentStageIndex;
              const isCurrent = idx === currentStageIndex;
              const Icon = stage.icon;

              return (
                <div 
                  key={stage.key}
                  className={`relative flex items-start gap-4 p-3 rounded-2xl transition-all duration-300 ${
                    isCurrent 
                      ? 'bg-blue-600/15 border border-blue-500/50 shadow-lg shadow-blue-500/10' 
                      : isPast 
                      ? 'opacity-85' 
                      : 'opacity-40'
                  }`}
                >
                  <div className={`relative z-10 w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border transition-all duration-300 ${
                    isCurrent
                      ? 'bg-blue-600 text-white border-blue-400 shadow-lg shadow-blue-600/40 scale-105'
                      : isPast
                      ? 'bg-emerald-600 text-white border-emerald-500'
                      : 'bg-slate-800 text-slate-500 border-slate-700'
                  }`}>
                    {isPast ? <CheckCircle2 size={16} /> : <Icon size={16} />}
                  </div>

                  <div className="min-w-0 flex-1 pt-0.5">
                    <div className="flex items-center justify-between gap-2">
                      <h4 className={`text-xs font-black uppercase tracking-wider ${
                        isCurrent ? 'text-blue-300' : isPast ? 'text-slate-200' : 'text-slate-500'
                      }`}>
                        {stage.label}
                      </h4>
                      {isCurrent && (
                        <span className="text-[8px] font-black uppercase tracking-widest bg-blue-500 text-white px-2 py-0.5 rounded-full animate-pulse">
                          Em Andamento
                        </span>
                      )}
                    </div>
                    <p className={`text-[11px] mt-0.5 leading-snug ${
                      isCurrent ? 'text-slate-200 font-medium' : 'text-slate-400'
                    }`}>
                      {stage.desc}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* FOTOS DO APARELHO (SE HOUVER) */}
        {((order.photos && order.photos.length > 0) || (order.finishedPhotos && order.finishedPhotos.length > 0)) && (
          <div className="bg-slate-900 rounded-3xl p-5 sm:p-6 border border-slate-800 shadow-xl space-y-4">
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-300 flex items-center gap-2">
              <ImageIcon size={14} className="text-blue-400" /> Registro Fotográfico
            </h3>

            {order.photos && order.photos.length > 0 && (
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2">Entrada</span>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {order.photos.map((photo, i) => (
                    <div 
                      key={`photo-in-${i}`}
                      onClick={() => setSelectedPhoto(photo)}
                      className="aspect-square rounded-xl overflow-hidden bg-slate-950 border border-slate-800 cursor-pointer hover:opacity-80 transition-opacity"
                    >
                      <img src={photo} alt={`Foto ${i + 1}`} className="w-full h-full object-cover" />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {order.finishedPhotos && order.finishedPhotos.length > 0 && (
              <div>
                <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest block mb-2">Serviço Concluído</span>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {order.finishedPhotos.map((photo, i) => (
                    <div 
                      key={`photo-out-${i}`}
                      onClick={() => setSelectedPhoto(photo)}
                      className="aspect-square rounded-xl overflow-hidden bg-slate-950 border border-emerald-500/30 cursor-pointer hover:opacity-80 transition-opacity"
                    >
                      <img src={photo} alt={`Foto final ${i + 1}`} className="w-full h-full object-cover" />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* BANNER INTERATIVO PARA FAZER O CHECKLIST DE FUNÇÕES */}
        <div 
          onClick={() => {
            window.location.href = `/checklist/${token}`;
          }}
          className="bg-gradient-to-r from-indigo-950/60 via-purple-950/40 to-slate-900 rounded-3xl p-4 sm:p-5 border border-indigo-500/40 shadow-xl cursor-pointer hover:border-indigo-500/70 hover:bg-indigo-950/70 transition-all flex items-center justify-between gap-3 group"
        >
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-300 shrink-0 group-hover:scale-105 transition-transform">
              <CheckCircle size={22} className="text-indigo-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-black uppercase tracking-wider text-white">Checklist de Funções do Celular</span>
                <span className="text-[9px] font-black uppercase tracking-widest bg-indigo-500/30 text-indigo-300 border border-indigo-500/30 px-2 py-0.5 rounded-full">Interativo</span>
              </div>
              <p className="text-[11px] text-slate-300 mt-0.5">Teste o touch, câmeras, som e sensores do aparelho e emita um laudo técnico oficial.</p>
            </div>
          </div>
          <button 
            type="button"
            className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs uppercase tracking-wider shadow-md shadow-indigo-600/30 flex items-center gap-1.5 shrink-0"
          >
            Testar <ChevronRight size={14} />
          </button>
        </div>

        {/* BANNER INTERATIVO PARA JOGAR ENQUANTO ESPERA */}
        <div 
          onClick={() => setIsSnakeGameOpen(true)}
          className="bg-gradient-to-r from-emerald-950/40 via-emerald-900/20 to-slate-900 rounded-3xl p-4 sm:p-5 border border-emerald-500/30 shadow-lg cursor-pointer hover:border-emerald-500/50 hover:bg-emerald-950/50 transition-all flex items-center justify-between gap-3 group"
        >
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0 group-hover:scale-105 transition-transform">
              <Gamepad2 size={22} className="animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-black uppercase tracking-wider text-white">Passar o tempo</span>
                <span className="text-[9px] font-black uppercase tracking-widest bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full">Mini-game</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">Jogue o clássico <strong>Jogo da Cobrinha</strong> enquanto atualizamos sua O.S.</p>
            </div>
          </div>
          <button 
            type="button"
            className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs uppercase tracking-wider shadow-md shadow-emerald-600/30 flex items-center gap-1.5 shrink-0"
          >
            Jogar <ChevronRight size={14} />
          </button>
        </div>

        {/* INFORMAÇÕES DE GARANTIA E SEGURANÇA */}
        <div className="bg-slate-900/60 rounded-3xl p-4 sm:p-5 border border-slate-800/80 flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
            <ShieldCheck size={22} />
          </div>
          <div className="text-[11px] text-slate-400 leading-relaxed">
            <span className="font-bold text-slate-200 block text-xs">Garantia Assegurada</span>
            Serviços executados possuem garantia de 90 dias conforme a legislação vigente e termos da loja.
          </div>
        </div>

      </main>

      {/* BARRA FIXA INFERIOR COM BOTÃO WHATSAPP E JOGUINHO */}
      <footer className="fixed bottom-0 left-0 right-0 p-3 sm:p-4 bg-slate-900/90 backdrop-blur-xl border-t border-slate-800 z-40">
        <div className="max-w-2xl mx-auto flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => setIsSnakeGameOpen(true)}
            className="bg-slate-800 hover:bg-slate-700 active:scale-95 text-emerald-400 border border-emerald-500/30 p-3.5 rounded-2xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all shrink-0"
            title="Jogar jogo da cobrinha"
          >
            <Gamepad2 size={18} />
            <span className="hidden sm:inline">Jogar</span>
          </button>

          {waUrl ? (
            <a 
              href={waUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 bg-emerald-500 hover:bg-emerald-400 active:scale-[0.98] text-white py-3.5 px-5 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-emerald-500/25 flex items-center justify-center gap-2 transition-all"
            >
              <MessageCircle size={18} /> Falar com a Assistência
            </a>
          ) : (
            <div className="flex-1 text-center text-xs text-slate-400 py-2">
              Dúvidas? Entre em contato diretamente com a loja.
            </div>
          )}
        </div>
      </footer>

      {/* MODAL DO JOGO DA COBRINHA */}
      <SnakeGameModal 
        isOpen={isSnakeGameOpen} 
        onClose={() => setIsSnakeGameOpen(false)}
        currentStatus={order?.status}
        statusUpdateToast={statusUpdateToast}
        onDismissToast={() => setStatusUpdateToast(null)}
      />

      {/* MODAL DE VISUALIZAÇÃO DE FOTO AMPLIADA */}
      {selectedPhoto && (
        <div 
          onClick={() => setSelectedPhoto(null)}
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in"
        >
          <div className="max-w-3xl max-h-[90vh] relative">
            <img src={selectedPhoto} alt="Foto ampliada" className="max-w-full max-h-[85vh] rounded-2xl object-contain shadow-2xl" />
            <button 
              onClick={() => setSelectedPhoto(null)}
              className="absolute top-2 right-2 bg-slate-900/80 text-white w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default PublicTrackingPage;
