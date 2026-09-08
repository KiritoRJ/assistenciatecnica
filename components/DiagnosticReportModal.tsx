import React, { useState, useEffect } from 'react';
import { 
  X, CheckCircle2, XCircle, AlertTriangle, Smartphone, 
  Share2, Copy, Check, Send, Printer, Calendar, Clock,
  Mic, Volume2, PhoneCall, Wifi, Eye, Fingerprint, 
  ExternalLink, QrCode, ShieldCheck, Sparkles, Layers, Zap, Loader2
} from 'lucide-react';
import { ServiceOrder, AppSettings, DeviceDiagnosticResults } from '../types';
import { formatDateTime } from '../utils';
import { supabase } from '../utils/api';

interface DiagnosticReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: ServiceOrder | null;
  settings: AppSettings;
  onOpenTestQR?: () => void;
}

export const DiagnosticReportModal: React.FC<DiagnosticReportModalProps> = ({
  isOpen,
  onClose,
  order,
  settings,
  onOpenTestQR
}) => {
  const [copied, setCopied] = useState(false);
  const [liveDiagnostics, setLiveDiagnostics] = useState<DeviceDiagnosticResults | null>(null);
  const [isLiveSyncing, setIsLiveSyncing] = useState(false);

  // Helper para extrair diagnóstico da O.S.
  const extractDiagnosticsFromOrder = (targetOrder: ServiceOrder | null): DeviceDiagnosticResults | null => {
    if (!targetOrder) return null;
    if (targetOrder.diagnosticTests) return targetOrder.diagnosticTests;

    if (Array.isArray(targetOrder.checklist)) {
      for (const item of targetOrder.checklist) {
        if (typeof item === 'string' && item.startsWith('__DIAG_JSON__:')) {
          try {
            return JSON.parse(item.substring(14));
          } catch (e) {}
        }
      }
    }

    try {
      const targetToken = targetOrder.trackingToken || targetOrder.id;
      const cached = localStorage.getItem(`os_diag_${targetToken}`) || localStorage.getItem(`os_diag_${targetOrder.id}`);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch (e) {}

    return null;
  };

  // Sincroniza estado inicial ao abrir ou mudar de O.S.
  useEffect(() => {
    if (isOpen && order) {
      setLiveDiagnostics(extractDiagnosticsFromOrder(order));
    }
  }, [isOpen, order]);

  // Listener em tempo real (BroadcastChannel + LocalStorage + Polling ativo enquanto modal está aberto)
  useEffect(() => {
    if (!isOpen || !order) return;

    const targetToken = order.trackingToken || order.id;

    // 1. BroadcastChannel para comunicação instantânea entre abas (0ms)
    let bc: BroadcastChannel | null = null;
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      bc = new BroadcastChannel('os_hardware_test_sync');
      bc.onmessage = (event) => {
        const { token, diagnosticResults } = event.data || {};
        if ((token === targetToken || token === order.id) && diagnosticResults) {
          setLiveDiagnostics(diagnosticResults);
        }
      };
    }

    // 2. Storage event
    const handleStorage = (e: StorageEvent) => {
      if (e.key === `os_diag_${targetToken}` || e.key === `os_diag_${order.id}`) {
        if (e.newValue) {
          try {
            setLiveDiagnostics(JSON.parse(e.newValue));
          } catch (err) {}
        }
      }
    };
    window.addEventListener('storage', handleStorage);

    // 3. Polling em tempo real contra o servidor a cada 2 segundos (para aparelhos externos)
    const fetchLiveDiagnostics = async () => {
      try {
        setIsLiveSyncing(true);
        let foundDiagnostics: DeviceDiagnosticResults | null = null;

        // Tenta API primeiro
        try {
          const resp = await fetch(`/api/device-test/${encodeURIComponent(targetToken)}`);
          const contentType = resp.headers.get('content-type') || '';
          if (resp.ok && contentType.includes('application/json')) {
            const data = await resp.json();
            if (data.success && data.order?.diagnosticTests) {
              foundDiagnostics = data.order.diagnosticTests;
            }
          }
        } catch (apiErr) {}

        // Se a API não respondeu com JSON, busca no Supabase
        if (!foundDiagnostics) {
          const { data: orderData } = await supabase
            .from('service_orders')
            .select('checklist')
            .or(`tracking_token.eq.${targetToken},id.eq.${targetToken}`)
            .maybeSingle();

          if (orderData && Array.isArray(orderData.checklist)) {
            for (const item of orderData.checklist) {
              if (typeof item === 'string' && item.startsWith('__DIAG_JSON__:')) {
                try {
                  foundDiagnostics = JSON.parse(item.substring(14));
                } catch (e) {}
              }
            }
          }
        }

        if (foundDiagnostics) {
          setLiveDiagnostics(foundDiagnostics);
        }
      } catch (e) {
        // Silencioso em caso de oscilação momentânea
      } finally {
        setIsLiveSyncing(false);
      }
    };

    const interval = setInterval(fetchLiveDiagnostics, 2000);

    return () => {
      if (bc) bc.close();
      window.removeEventListener('storage', handleStorage);
      clearInterval(interval);
    };
  }, [isOpen, order]);

  if (!isOpen || !order) return null;

  const diagnostics = liveDiagnostics || extractDiagnosticsFromOrder(order);

  const storeName = settings?.storeName || 'Assistência Técnica';
  const osCode = order.id ? `#${order.id.split('-')[0]}` : '';
  const cleanPhone = (order.phoneNumber || '').replace(/\D/g, '');
  const phoneWithCountry = cleanPhone.length <= 11 && !cleanPhone.startsWith('55') ? `55${cleanPhone}` : cleanPhone;
  const trackingToken = order.trackingToken || order.id;
  const hardwareTestUrl = `${window.location.origin}/teste-hardware/${trackingToken}`;

  // Monta texto formatado do laudo para copiar ou mandar no WhatsApp
  const generateReportText = () => {
    let text = `*${storeName}* - LAUDO DE TESTES DE HARDWARE\n`;
    text += `O.S.: *${osCode}*\n`;
    text += `Cliente: *${order.customerName}*\n`;
    text += `Aparelho: *${order.deviceBrand} ${order.deviceModel}*\n`;
    if (diagnostics?.testedAt) {
      text += `Data do Teste: ${formatDateTime(diagnostics.testedAt)}\n`;
    }
    text += `Resultado Geral: *${diagnostics?.summary || (diagnostics?.overallStatus === 'passed' ? 'Todos os testes Aprovados' : 'Testes Concluídos')}*\n\n`;
    text += `*ITENS TESTADOS:*\n`;

    if (diagnostics?.tests) {
      const t = diagnostics.tests;
      const getIcon = (status: string) => status === 'passed' ? '✅' : status === 'failed' ? '❌' : '⚪';
      const getStatusName = (status: string) => status === 'passed' ? 'Aprovado' : status === 'failed' ? 'Reprovado' : 'Não Testado';

      if (t.touch) text += `${getIcon(t.touch.status)} Touch Screen: ${getStatusName(t.touch.status)}${t.touch.details ? ` (${t.touch.details})` : ''}\n`;
      if (t.multitouch) text += `${getIcon(t.multitouch.status)} Multi-touch: ${getStatusName(t.multitouch.status)}${t.multitouch.details ? ` (${t.multitouch.details})` : ''}\n`;
      if (t.mic) text += `${getIcon(t.mic.status)} Microfone: ${getStatusName(t.mic.status)}\n`;
      if (t.speaker) text += `${getIcon(t.speaker.status)} Alto-falante: ${getStatusName(t.speaker.status)}\n`;
      if (t.earpiece) text += `${getIcon(t.earpiece.status)} Fone Auricular: ${getStatusName(t.earpiece.status)}\n`;
      if (t.wifi) text += `${getIcon(t.wifi.status)} Wi-Fi / Rede: ${getStatusName(t.wifi.status)}${t.wifi.details ? ` (${t.wifi.details})` : ''}\n`;
      if (t.proximity) text += `${getIcon(t.proximity.status)} Sensor de Proximidade: ${getStatusName(t.proximity.status)}\n`;
      if (t.biometrics) text += `${getIcon(t.biometrics.status)} Biometria: ${getStatusName(t.biometrics.status)}${t.biometrics.details ? ` (${t.biometrics.details})` : ''}\n`;
    }

    if (diagnostics?.technicianNotes) {
      text += `\n*Observações do Técnico:*\n${diagnostics.technicianNotes}\n`;
    }

    text += `\n_Laudo emitido por ${storeName}._`;
    return text;
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(generateReportText());
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  const handleSendWhatsApp = () => {
    const text = encodeURIComponent(generateReportText());
    window.open(`https://wa.me/${phoneWithCountry}?text=${text}`, '_blank');
  };

  // Ícones correspondentes
  const getTestIcon = (id: string) => {
    switch (id) {
      case 'touch': return <Smartphone size={18} className="text-blue-500" />;
      case 'multitouch': return <Layers size={18} className="text-indigo-500" />;
      case 'mic': return <Mic size={18} className="text-rose-500" />;
      case 'speaker': return <Volume2 size={18} className="text-amber-500" />;
      case 'earpiece': return <PhoneCall size={18} className="text-teal-500" />;
      case 'wifi': return <Wifi size={18} className="text-cyan-500" />;
      case 'proximity': return <Eye size={18} className="text-purple-500" />;
      case 'biometrics': return <Fingerprint size={18} className="text-emerald-500" />;
      default: return <ShieldCheck size={18} className="text-slate-500" />;
    }
  };

  const testsList = diagnostics?.tests ? Object.values(diagnostics.tests) : [];

  return (
    <div className="fixed inset-0 bg-slate-950/80 z-[120] flex items-center justify-center p-3 sm:p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden border border-slate-100 flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-200">
        
        {/* CABEÇALHO DO LAUDO */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-5 sm:p-6 relative flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-indigo-600/30 border border-indigo-400/30 flex items-center justify-center text-indigo-300 shadow-inner shrink-0">
              <ShieldCheck size={26} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-black text-sm sm:text-base uppercase tracking-tight text-white flex items-center gap-1.5">
                  Laudo de Testes
                  <span className="flex items-center gap-1 text-[9px] font-black tracking-normal px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                    Tempo Real
                  </span>
                </h3>
                <span className="bg-indigo-500 text-white text-[9px] font-black uppercase px-2 py-0.5 rounded-full">
                  O.S. {osCode}
                </span>
              </div>
              <p className="text-slate-300 text-xs mt-0.5">
                {order.deviceBrand} {order.deviceModel} • {order.customerName}
              </p>
            </div>
          </div>

          <button 
            type="button"
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-full text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* CORPO DO LAUDO */}
        <div className="p-5 sm:p-6 space-y-4 overflow-y-auto flex-1">
          {diagnostics ? (
            <>
              {/* RESUMO GERAL */}
              <div className={`p-4 rounded-2xl border flex items-center justify-between gap-3 ${
                diagnostics.overallStatus === 'passed' 
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-950' 
                  : diagnostics.overallStatus === 'partial'
                  ? 'bg-amber-50 border-amber-200 text-amber-950'
                  : 'bg-rose-50 border-rose-200 text-rose-950'
              }`}>
                <div className="flex items-center gap-3">
                  {diagnostics.overallStatus === 'passed' ? (
                    <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                      <CheckCircle2 size={22} />
                    </div>
                  ) : diagnostics.overallStatus === 'partial' ? (
                    <div className="w-10 h-10 rounded-xl bg-amber-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                      <AlertTriangle size={22} />
                    </div>
                  ) : (
                    <div className="w-10 h-10 rounded-xl bg-rose-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                      <XCircle size={22} />
                    </div>
                  )}
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-wider block opacity-70">
                      Resultado Geral
                    </span>
                    <h4 className="font-black text-sm uppercase tracking-tight">
                      {diagnostics.summary || (diagnostics.overallStatus === 'passed' ? 'Todos os testes Aprovados' : 'Testes Concluídos')}
                    </h4>
                  </div>
                </div>

                {diagnostics.testedAt && (
                  <div className="text-right text-[10px] font-bold opacity-75 shrink-0">
                    <div className="flex items-center gap-1 justify-end">
                      <Calendar size={11} />
                      <span>{formatDateTime(diagnostics.testedAt)}</span>
                    </div>
                    <span>Gravado na O.S.</span>
                  </div>
                )}
              </div>

              {/* LISTA DOS 8 TESTES DE HARDWARE */}
              <div className="space-y-2">
                <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-1">
                  Detalhamento das Funções Testadas
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {testsList.map((test) => {
                    const isPassed = test.status === 'passed';
                    const isFailed = test.status === 'failed';

                    return (
                      <div 
                        key={test.id} 
                        className={`p-3 rounded-2xl border flex items-center justify-between gap-2.5 transition-all ${
                          isPassed 
                            ? 'bg-slate-50 border-slate-200/80' 
                            : isFailed 
                            ? 'bg-rose-50/70 border-rose-200' 
                            : 'bg-slate-50/50 border-slate-100 opacity-60'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="p-2 bg-white rounded-xl shadow-xs border border-slate-100 shrink-0">
                            {getTestIcon(test.id)}
                          </div>
                          <div className="min-w-0">
                            <span className="font-black text-xs text-slate-800 uppercase block truncate">
                              {test.name}
                            </span>
                            {test.details && (
                              <span className="text-[10px] text-slate-500 font-medium block truncate">
                                {test.details}
                              </span>
                            )}
                          </div>
                        </div>

                        <span className={`text-[9px] font-black uppercase px-2.5 py-1 rounded-full shrink-0 flex items-center gap-1 ${
                          isPassed 
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' 
                            : isFailed 
                            ? 'bg-rose-100 text-rose-800 border border-rose-200' 
                            : 'bg-slate-100 text-slate-600'
                        }`}>
                          {isPassed && <Check size={10} />}
                          {isFailed && <X size={10} />}
                          {isPassed ? 'Aprovado' : isFailed ? 'Reprovado' : 'Pendente'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* OBSERVAÇÕES DO TÉCNICO SE HOUVER */}
              {diagnostics.technicianNotes && (
                <div className="bg-amber-50/60 border border-amber-200/80 rounded-2xl p-3.5 space-y-1">
                  <span className="text-[10px] font-black uppercase tracking-wider text-amber-800 block">
                    Observações do Técnico
                  </span>
                  <p className="text-xs text-slate-700 font-medium leading-relaxed">
                    {diagnostics.technicianNotes}
                  </p>
                </div>
              )}
            </>
          ) : (
            /* CASO NENHUM TESTE TENHA SIDO FEITO AINDA */
            <div className="text-center py-8 px-4 bg-slate-50 border-2 border-dashed border-slate-200 rounded-3xl space-y-3">
              <div className="w-14 h-14 rounded-2xl bg-indigo-100 text-indigo-600 flex items-center justify-center mx-auto shadow-inner">
                <QrCode size={28} />
              </div>
              <div className="max-w-xs mx-auto">
                <h4 className="font-black text-sm uppercase tracking-tight text-slate-800">
                  Nenhum teste de hardware gravado
                </h4>
                <p className="text-xs text-slate-500 mt-1">
                  Escaneie o QR Code com a câmera do celular do cliente para testar Touch, Microfone, Alto-falante, Wi-Fi e Biometria.
                </p>
              </div>

              <div className="pt-2">
                <a
                  href={hardwareTestUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs uppercase px-5 py-3 rounded-xl shadow-md transition-all active:scale-95"
                >
                  <ExternalLink size={15} />
                  <span>Abrir Testes de Hardware Agora</span>
                </a>
              </div>
            </div>
          )}
        </div>

        {/* RODAPÉ COM AÇÕES: COMPARTILHAR / COPIAR / REFAZER */}
        <div className="p-4 sm:p-5 bg-slate-50 border-t border-slate-100 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 shrink-0">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopy}
              className="flex-1 sm:flex-initial bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 py-2.5 px-3.5 rounded-xl font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all active:scale-95 cursor-pointer shadow-xs"
            >
              {copied ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
              <span>{copied ? 'Copiado!' : 'Copiar Laudo'}</span>
            </button>

            {onOpenTestQR && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenTestQR();
                }}
                className="flex-1 sm:flex-initial bg-white hover:bg-slate-100 border border-indigo-200 text-indigo-700 py-2.5 px-3.5 rounded-xl font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all active:scale-95 cursor-pointer shadow-xs"
              >
                <QrCode size={14} />
                <span>QR Code</span>
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={handleSendWhatsApp}
            className="bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white py-3 px-5 rounded-xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-md shadow-emerald-600/20 transition-all cursor-pointer"
          >
            <Send size={15} />
            <span>Enviar Laudo no WhatsApp</span>
          </button>
        </div>

      </div>
    </div>
  );
};
