import React, { useState } from 'react';
import { 
  X, CheckCircle2, XCircle, AlertCircle, Share2, Printer, 
  MessageCircle, Play, Copy, Check, Smartphone, Award,
  Clock, ShieldCheck, UserCheck, ChevronDown, ChevronUp, FileText
} from 'lucide-react';
import { ServiceOrder, AppSettings, InteractiveChecklistResult } from '../types';
import { formatWhatsAppChecklistReport, generateChecklistShareLink } from '../utils/checklistHelper';
import { InteractiveChecklistRunner } from './InteractiveChecklistRunner';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  order: ServiceOrder;
  settings: AppSettings;
  tenantId: string;
  checklistResult?: InteractiveChecklistResult | null;
  onUpdateChecklist?: (result: InteractiveChecklistResult) => void;
}

export const InteractiveChecklistModal: React.FC<Props> = ({
  isOpen,
  onClose,
  order,
  settings,
  tenantId,
  checklistResult: propChecklistResult,
  onUpdateChecklist
}) => {
  const [isRunningBenchTest, setIsRunningBenchTest] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedWhatsAppText, setCopiedWhatsAppText] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'details'>('overview');

  if (!isOpen) return null;

  const checklist = propChecklistResult || order.interactiveChecklist || null;
  const shareLink = generateChecklistShareLink(order, tenantId);

  // Manipulador para copiar link do cliente
  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareLink);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    } catch {
      prompt('Copie o link do checklist do cliente:', shareLink);
    }
  };

  // Enviar convite de teste para o WhatsApp do cliente
  const handleSendInviteWhatsApp = () => {
    const customerPhone = (order.phoneNumber || '').replace(/\D/g, '');
    const storeName = settings?.storeName || 'Assistência Técnica';
    const cleanPhone = customerPhone.length <= 11 && !customerPhone.startsWith('55') ? `55${customerPhone}` : customerPhone;

    const message = `Olá *${order.customerName}*! Tudo bem? 😊\n\nAqui é da *${storeName}*.\n\nPara garantir total transparência e segurança na sua Ordem de Serviço *#${order.id.split('-')[0]}*, preparamos um *teste interativo rápido* para você conferir as funções do seu *${order.deviceBrand} ${order.deviceModel}* diretamente pelo seu celular:\n\n👉 *Acesse o link para testar:* \n${shareLink}\n\nLeva menos de 2 minutos e gera um laudo oficial com assinatura digital. Qualquer dúvida estamos à disposição!`;

    const url = cleanPhone
      ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`
      : `https://wa.me/?text=${encodeURIComponent(message)}`;

    window.open(url, '_blank');
  };

  // Enviar laudo pronto formatado para o WhatsApp
  const handleSendReportWhatsApp = () => {
    if (!checklist) return;
    const text = formatWhatsAppChecklistReport(checklist, settings);
    const customerPhone = (order.phoneNumber || '').replace(/\D/g, '');
    const cleanPhone = customerPhone.length <= 11 && !customerPhone.startsWith('55') ? `55${customerPhone}` : customerPhone;

    const url = cleanPhone
      ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`
      : `https://wa.me/?text=${encodeURIComponent(text)}`;

    window.open(url, '_blank');
  };

  // Copiar laudo formatado para área de transferência
  const handleCopyReportText = async () => {
    if (!checklist) return;
    const text = formatWhatsAppChecklistReport(checklist, settings);
    try {
      await navigator.clipboard.writeText(text);
      setCopiedWhatsAppText(true);
      setTimeout(() => setCopiedWhatsAppText(false), 2500);
    } catch {
      prompt('Copie o Laudo Técnico:', text);
    }
  };

  // Impressão do Laudo Técnico
  const handlePrintReport = () => {
    window.print();
  };

  // Se o técnico estiver executando o teste na bancada
  if (isRunningBenchTest) {
    return (
      <div className="fixed inset-0 z-[150] bg-slate-950">
        <InteractiveChecklistRunner
          orderData={order}
          settings={settings}
          tenantId={tenantId}
          isBenchMode={true}
          onClose={() => setIsRunningBenchTest(false)}
          onSaveResult={async (newResult) => {
            if (onUpdateChecklist) onUpdateChecklist(newResult);
            setIsRunningBenchTest(false);
          }}
        />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-slate-950/80 z-[100] flex items-center justify-center p-3 sm:p-4 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white w-full max-w-2xl rounded-[2.5rem] overflow-hidden shadow-2xl flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50 shrink-0">
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
              checklist ? 'bg-emerald-100 text-emerald-600' : 'bg-blue-100 text-blue-600'
            }`}>
              <ShieldCheck size={26} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-black text-slate-800 text-lg uppercase tracking-tight">
                  Checklist & Laudo Interativo
                </h3>
                <span className="text-[10px] font-mono font-bold bg-slate-200 text-slate-700 px-2 py-0.5 rounded-md">
                  #{order.id.split('-')[0]}
                </span>
              </div>
              <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">
                {order.customerName} • {order.deviceBrand} {order.deviceModel}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 bg-white border border-slate-200 rounded-full transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* Card de Status do Checklist */}
          {checklist ? (
            <div className="bg-gradient-to-br from-slate-900 to-slate-950 text-white rounded-3xl p-6 shadow-xl relative overflow-hidden">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="space-y-1 text-center sm:text-left">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-black uppercase tracking-wider">
                    <CheckCircle2 size={13} />
                    <span>Laudo Concluído</span>
                  </div>
                  <h4 className="text-xl font-black tracking-tight">
                    {checklist.completedBy === 'cliente' ? 'Realizado pelo Cliente' : 'Realizado na Bancada'}
                  </h4>
                  <p className="text-xs text-slate-400 font-medium">
                    Concluído em: {new Date(checklist.completedAt).toLocaleString('pt-BR')}
                  </p>
                </div>

                {/* Gauge de Pontuação */}
                <div className="bg-white/5 border border-white/10 rounded-2xl p-4 text-center shrink-0 min-w-[140px]">
                  <span className="text-3xl font-black text-emerald-400 font-mono">
                    {checklist.scorePercent}%
                  </span>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-0.5">
                    Saúde do Aparelho
                  </p>
                  <p className="text-[11px] text-slate-300 font-bold mt-1">
                    {checklist.passedCount} de {checklist.totalTests} Aprovados
                  </p>
                </div>
              </div>

              {/* Estatísticas Rápidas */}
              <div className="grid grid-cols-3 gap-2 mt-5 pt-4 border-t border-white/10 text-center">
                <div>
                  <span className="text-sm font-black text-emerald-400 font-mono">{checklist.passedCount}</span>
                  <p className="text-[9px] uppercase font-bold text-slate-400">Aprovados</p>
                </div>
                <div>
                  <span className="text-sm font-black text-red-400 font-mono">{checklist.failedCount}</span>
                  <p className="text-[9px] uppercase font-bold text-slate-400">Com Defeito</p>
                </div>
                <div>
                  <span className="text-sm font-black text-amber-400 font-mono">{checklist.skippedCount}</span>
                  <p className="text-[9px] uppercase font-bold text-slate-400">Dispensados</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-blue-50 border border-blue-100 rounded-3xl p-6 text-center space-y-3">
              <div className="w-14 h-14 rounded-2xl bg-blue-100 text-blue-600 flex items-center justify-center mx-auto">
                <Clock size={28} />
              </div>
              <div>
                <h4 className="font-black text-slate-800 text-base uppercase">Nenhum Laudo Realizado Ainda</h4>
                <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
                  Envie o link interativo para o cliente testar no próprio aparelho ou realize o diagnóstico agora mesmo na sua bancada.
                </p>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                <button
                  onClick={handleSendInviteWhatsApp}
                  className="px-5 py-3 bg-green-600 hover:bg-green-500 text-white rounded-2xl font-black text-xs uppercase tracking-wider flex items-center gap-2 shadow-md shadow-green-600/20 active:scale-95 transition-all"
                >
                  <MessageCircle size={16} />
                  <span>Enviar Convite no WhatsApp</span>
                </button>
                <button
                  onClick={() => setIsRunningBenchTest(true)}
                  className="px-5 py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl font-black text-xs uppercase tracking-wider flex items-center gap-2 active:scale-95 transition-all"
                >
                  <Play size={15} />
                  <span>Testar na Bancada Agora</span>
                </button>
              </div>
            </div>
          )}

          {/* Link de Compartilhamento Direto */}
          <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                Link Exclusivo do Cliente para Auto-Diagnóstico
              </p>
              <p className="text-xs font-mono font-bold text-slate-600 truncate mt-0.5 select-all">
                {shareLink}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={handleCopyLink}
                className="px-3.5 py-2.5 bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 rounded-xl font-bold text-xs uppercase flex items-center gap-1.5 transition-colors"
              >
                {copiedLink ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                <span>{copiedLink ? 'Copiado!' : 'Copiar'}</span>
              </button>
              <button
                onClick={handleSendInviteWhatsApp}
                className="p-2.5 bg-green-600 hover:bg-green-500 text-white rounded-xl transition-colors"
                title="Abrir no WhatsApp"
              >
                <MessageCircle size={16} />
              </button>
            </div>
          </div>

          {/* Detalhes dos Itens Testados (se houver laudo) */}
          {checklist && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-black text-slate-700 uppercase tracking-wider">
                  Detalhamento das Funções ({checklist.tests.length})
                </h4>
                <div className="flex gap-2 text-[10px] font-bold">
                  <span className="text-emerald-600">✓ {checklist.passedCount} OK</span>
                  <span className="text-red-500">✗ {checklist.failedCount} Falha</span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {checklist.tests.map((t) => (
                  <div
                    key={t.id}
                    className={`p-3 rounded-2xl border flex items-start justify-between gap-2.5 transition-all ${
                      t.status === 'passed' 
                        ? 'bg-emerald-50/40 border-emerald-100' 
                        : t.status === 'failed'
                        ? 'bg-red-50/70 border-red-200'
                        : 'bg-slate-50 border-slate-100'
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-800 truncate">{t.title}</p>
                      {t.notes ? (
                        <p className="text-[10px] text-red-600 font-medium italic mt-0.5">
                          Defeito: {t.notes}
                        </p>
                      ) : (
                        <p className="text-[10px] text-slate-400 truncate mt-0.5">{t.description}</p>
                      )}
                    </div>
                    <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md shrink-0 ${
                      t.status === 'passed' 
                        ? 'bg-emerald-100 text-emerald-800' 
                        : t.status === 'failed'
                        ? 'bg-red-500 text-white'
                        : 'bg-slate-200 text-slate-600'
                    }`}>
                      {t.status === 'passed' ? 'Aprovado' : t.status === 'failed' ? 'Defeito' : 'Dispensado'}
                    </span>
                  </div>
                ))}
              </div>

              {/* Observações do Cliente & Assinatura */}
              {(checklist.customerNotes || checklist.customerSignature) && (
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-3 mt-4">
                  {checklist.customerNotes && (
                    <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        Observação Informada pelo Cliente
                      </p>
                      <p className="text-xs text-slate-700 italic mt-0.5">
                        "{checklist.customerNotes}"
                      </p>
                    </div>
                  )}

                  {checklist.customerSignature && (
                    <div className="pt-2 border-t border-slate-200">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
                        Assinatura Digital Registrada
                      </p>
                      <div className="bg-white rounded-xl border border-slate-200 p-2 max-w-[200px] h-16 flex items-center justify-center">
                        <img src={checklist.customerSignature} className="max-h-full max-w-full object-contain" />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 sm:p-6 border-t border-slate-100 bg-slate-50 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsRunningBenchTest(true)}
              className="px-4 py-3 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-2xl font-bold text-xs uppercase flex items-center gap-1.5 transition-colors"
            >
              <Play size={14} />
              <span>{checklist ? 'Refazer na Bancada' : 'Fazer Teste Agora'}</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            {checklist && (
              <>
                <button
                  onClick={handleCopyReportText}
                  className="px-4 py-3 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-2xl font-black text-xs uppercase flex items-center gap-1.5 transition-colors"
                >
                  {copiedWhatsAppText ? <Check size={14} className="text-emerald-700" /> : <Copy size={14} />}
                  <span>{copiedWhatsAppText ? 'Copiado!' : 'Copiar Texto'}</span>
                </button>
                <button
                  onClick={handleSendReportWhatsApp}
                  className="px-5 py-3 bg-green-600 hover:bg-green-500 text-white rounded-2xl font-black text-xs uppercase flex items-center gap-2 shadow-md shadow-green-600/20 active:scale-95 transition-all"
                >
                  <MessageCircle size={16} />
                  <span>Enviar Laudo no WhatsApp</span>
                </button>
              </>
            )}
            <button
              onClick={onClose}
              className="px-5 py-3 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase"
            >
              Fechar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InteractiveChecklistModal;
