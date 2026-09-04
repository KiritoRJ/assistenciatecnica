import React, { useState, useEffect } from 'react';
import { 
  X, Check, Copy, ExternalLink, Printer, 
  Smartphone, User, Eye, Send, Image as ImageIcon, Loader2, Download,
  Sparkles, CheckCircle2, ClipboardCheck
} from 'lucide-react';
import { ServiceOrder, AppSettings } from '../types';
import { formatCurrency } from '../utils';
import { generateReceiptCanvasImage, shareReceiptDirectly } from '../utils/receiptGenerator';
import { generateChecklistShareLink } from '../utils/checklistHelper';

interface SavedOrderShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: ServiceOrder | null;
  isNew?: boolean;
  settings: AppSettings;
  onPrint?: (order: ServiceOrder) => void;
}

export const SavedOrderShareModal: React.FC<SavedOrderShareModalProps> = ({
  isOpen,
  onClose,
  order,
  isNew = false,
  settings,
  onPrint
}) => {
  const [copiedLink, setCopiedLink] = useState(false);
  const [isGeneratingPhoto, setIsGeneratingPhoto] = useState(false);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const [photoSentFeedback, setPhotoSentFeedback] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && order) {
      // Pré-carrega a imagem do comprovante para resposta imediata
      generateReceiptCanvasImage(order, settings)
        .then(res => setPreviewImageUrl(res.dataUrl))
        .catch(err => console.warn('Erro ao pré-carregar imagem:', err));
    } else {
      setPreviewImageUrl(null);
      setPhotoSentFeedback(null);
      setCopiedLink(false);
    }
  }, [isOpen, order, settings]);

  if (!isOpen || !order) return null;

  const storeName = settings?.storeName || 'Assistência Técnica';
  const osCode = order.id ? `#${order.id.split('-')[0]}` : '';
  const cleanPhone = (order.phoneNumber || '').replace(/\D/g, '');
  const phoneWithCountry = cleanPhone.length <= 11 && !cleanPhone.startsWith('55') ? `55${cleanPhone}` : cleanPhone;
  const trackingToken = order.trackingToken || order.id;
  const trackingUrl = `${window.location.origin}/acompanhamento/${trackingToken}`;

  // Envia o arquivo de imagem do comprovante direto para o WhatsApp / Compartilhamento nativo
  const handleShareReceiptPhoto = async () => {
    setIsGeneratingPhoto(true);
    setPhotoSentFeedback(null);
    try {
      const res = await shareReceiptDirectly(order, settings);
      if (res.method === 'native-share' || res.method === 'android-bridge') {
        setPhotoSentFeedback('Comprovante enviado com sucesso!');
      } else if (res.method === 'copied-whatsapp') {
        setPhotoSentFeedback('Foto copiada e baixada! Cole (Ctrl+V) no WhatsApp.');
      } else {
        setPhotoSentFeedback('Foto baixada e conversa do WhatsApp aberta!');
      }
      setTimeout(() => setPhotoSentFeedback(null), 5000);
    } catch (err) {
      console.error('Erro ao compartilhar foto do comprovante:', err);
      alert('Não foi possível gerar a foto do comprovante.');
    } finally {
      setIsGeneratingPhoto(false);
    }
  };

  // Baixar imagem do comprovante direto
  const handleDownloadPhoto = async () => {
    setIsGeneratingPhoto(true);
    try {
      const res = await generateReceiptCanvasImage(order, settings);
      const a = document.createElement('a');
      a.href = res.dataUrl;
      a.download = `OS_${order.id}.jpg`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (e) {
      console.error('Erro ao baixar:', e);
    } finally {
      setIsGeneratingPhoto(false);
    }
  };

  const [copiedChecklistLink, setCopiedChecklistLink] = useState(false);
  const checklistUrl = order ? generateChecklistShareLink(order, '') : '';

  // Envio do convite de checklist no WhatsApp
  const handleShareChecklistWhatsApp = () => {
    const text = `Olá, *${order.customerName || 'Cliente'}*! 😊\n\nAqui é da *${storeName}*.\n\nPara garantir total transparência e segurança na sua O.S. *${osCode}*, preparamos um *teste interativo rápido* para você conferir as funções do seu *${order.deviceBrand} ${order.deviceModel}* no próprio aparelho:\n\n👉 *Acesse o link para testar:* \n${checklistUrl}\n\nLeva menos de 2 minutos e gera um laudo oficial!`;
    const encodedText = encodeURIComponent(text);
    const targetUrl = phoneWithCountry 
      ? `https://wa.me/${phoneWithCountry}?text=${encodedText}` 
      : `https://wa.me/?text=${encodedText}`;
    window.open(targetUrl, '_blank');
  };

  const handleCopyChecklistLink = async () => {
    try {
      await navigator.clipboard.writeText(checklistUrl);
      setCopiedChecklistLink(true);
      setTimeout(() => setCopiedChecklistLink(false), 2500);
    } catch {
      prompt('Copie o link do checklist:', checklistUrl);
    }
  };

  // Envio do link de acompanhamento no WhatsApp
  const handleShareTrackingWhatsApp = () => {
    const text = `Olá, *${order.customerName || 'Cliente'}*! 👋\n\nAqui está o seu link exclusivo para acompanhar o status da sua O.S. *${osCode}* em tempo real:\n\n🔗 ${trackingUrl}\n\n*${storeName}*`;
    const encodedText = encodeURIComponent(text);
    const targetUrl = phoneWithCountry 
      ? `https://wa.me/${phoneWithCountry}?text=${encodedText}` 
      : `https://wa.me/?text=${encodedText}`;
    window.open(targetUrl, '_blank');
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(trackingUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    } catch {
      prompt('Copie o link de acompanhamento:', trackingUrl);
    }
  };

  return (
    <div 
      className="fixed inset-0 z-[9999] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200 overflow-y-auto"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-3xl w-full max-w-lg shadow-2xl border border-slate-100 overflow-hidden flex flex-col my-auto relative animate-in zoom-in-95 duration-200"
        onClick={e => e.stopPropagation()}
      >
        {/* CABEÇALHO */}
        <div className="bg-gradient-to-r from-emerald-600 to-teal-700 p-5 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center text-white shrink-0 border border-white/20 shadow-inner">
              <Check size={24} className="stroke-[3]" />
            </div>
            <div>
              <h3 className="font-black text-base sm:text-lg leading-tight text-white">
                {isNew ? 'Ordem de Serviço Criada!' : 'Ordem de Serviço Salva!'}
              </h3>
              <p className="text-emerald-100 text-xs mt-0.5">
                O.S. <strong className="text-white font-mono">{osCode}</strong> salva com sucesso.
              </p>
            </div>
          </div>
          <button 
            type="button"
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-full text-white/80 hover:text-white transition-colors cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-5 sm:p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          {/* RESUMO RÁPIDO DO APARELHO / CLIENTE */}
          <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3.5 flex flex-col gap-2">
            <div className="flex items-center justify-between flex-wrap gap-2 border-b border-slate-200/60 pb-2">
              <div className="flex items-center gap-2">
                <User size={14} className="text-slate-500" />
                <span className="font-black text-slate-800 text-xs uppercase tracking-tight">
                  {order.customerName || 'Cliente não informado'}
                </span>
              </div>
              <span className="text-[10px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                {order.status || 'Recebido'}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs text-slate-600">
              <div>
                <span className="text-[10px] font-bold uppercase text-slate-400 block">Aparelho</span>
                <span className="font-bold text-slate-800">{order.deviceBrand} {order.deviceModel}</span>
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase text-slate-400 block">Total</span>
                <span className="font-black text-emerald-600">{formatCurrency(order.total || 0)}</span>
              </div>
            </div>
          </div>

          {/* FEEDBACK DE ENVIO */}
          {photoSentFeedback && (
            <div className="p-3 bg-emerald-100 border border-emerald-300 text-emerald-900 rounded-xl text-xs font-bold flex items-center gap-2 animate-in fade-in">
              <CheckCircle2 size={16} className="text-emerald-700 shrink-0" />
              <span>{photoSentFeedback}</span>
            </div>
          )}

          {/* OPÇÃO 1: ENVIAR FOTO DO COMPROVANTE (IMAGEM DIRETO) */}
          <div className="border-2 border-emerald-500/30 bg-emerald-50/50 rounded-2xl p-4 sm:p-5 space-y-3 relative overflow-hidden">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-md shadow-emerald-600/30 shrink-0">
                  <ImageIcon size={20} />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <h4 className="text-xs sm:text-sm font-black uppercase tracking-wide text-slate-900">
                      Enviar Foto do Comprovante
                    </h4>
                    <span className="bg-emerald-600 text-white text-[9px] font-black uppercase px-1.5 py-0.5 rounded-md">
                      Direto
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 leading-tight mt-0.5">
                    Envia o cupom em foto oficial com dados do serviço, laudo, valores e termo de garantia.
                  </p>
                </div>
              </div>
            </div>

            {/* BOTÃO PRINCIPAL DE ENVIO DE FOTO NO WHATSAPP */}
            <div className="flex flex-col sm:flex-row items-stretch gap-2 pt-1">
              <button
                type="button"
                onClick={handleShareReceiptPhoto}
                disabled={isGeneratingPhoto}
                className="flex-1 bg-emerald-600 hover:bg-emerald-500 active:scale-[0.98] disabled:opacity-50 text-white py-3.5 px-4 rounded-xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/30 transition-all cursor-pointer"
              >
                {isGeneratingPhoto ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>Gerando Foto...</span>
                  </>
                ) : (
                  <>
                    <Send size={16} />
                    <span>Enviar Foto no WhatsApp</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleDownloadPhoto}
                disabled={isGeneratingPhoto}
                className="bg-white hover:bg-slate-100 active:scale-[0.98] disabled:opacity-50 border border-slate-300 text-slate-700 py-3.5 px-4 rounded-xl font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                title="Baixar imagem no dispositivo"
              >
                <Download size={16} />
                <span className="hidden sm:inline">Baixar Foto</span>
              </button>
            </div>
          </div>

          {/* OPÇÃO 2: COMPARTILHAR LINK DE ACOMPANHAMENTO ONLINE */}
          <div className="border border-blue-200 bg-blue-50/40 rounded-2xl p-4 space-y-3 transition-all">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-600/30 shrink-0">
                  <Eye size={18} />
                </div>
                <div>
                  <h4 className="text-xs font-black uppercase tracking-wide text-slate-900">
                    Enviar Link de Acompanhamento
                  </h4>
                  <p className="text-[11px] text-slate-500 leading-tight mt-0.5">
                    Permite ao cliente acompanhar fotos, laudo e status ao vivo e jogar o mini-game.
                  </p>
                </div>
              </div>
            </div>

            {/* Input com Link */}
            <div className="flex items-center gap-1.5 bg-white border border-blue-200 rounded-xl p-1.5 pl-3">
              <input 
                type="text" 
                readOnly 
                value={trackingUrl}
                className="w-full text-[11px] text-slate-600 font-mono bg-transparent outline-none select-all"
              />
              <button
                type="button"
                onClick={handleCopyLink}
                className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-[10px] font-black uppercase tracking-wider flex items-center gap-1 shrink-0 transition-colors cursor-pointer"
              >
                {copiedLink ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
                <span>{copiedLink ? 'Copiado!' : 'Copiar'}</span>
              </button>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch gap-2 pt-0.5">
              <button
                type="button"
                onClick={handleShareTrackingWhatsApp}
                className="flex-1 bg-blue-600 hover:bg-blue-500 active:scale-[0.98] text-white py-3 px-4 rounded-xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-md shadow-blue-600/30 transition-all cursor-pointer"
              >
                <Send size={15} />
                <span>Enviar Link no WhatsApp</span>
              </button>

              <a
                href={trackingUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-white hover:bg-slate-100 active:scale-[0.98] border border-slate-300 text-slate-700 py-3 px-3.5 rounded-xl font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all text-center"
                title="Abrir página pública em nova aba"
              >
                <ExternalLink size={15} />
                <span>Abrir Página</span>
              </a>
            </div>
          </div>

          {/* OPÇÃO 3: ENVIAR LINK DE CHECKLIST INTERATIVO */}
          <div className="border border-purple-200 bg-purple-50/40 rounded-2xl p-4 space-y-3 transition-all">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-purple-600 text-white flex items-center justify-center shadow-md shadow-purple-600/30 shrink-0">
                  <ClipboardCheck size={18} />
                </div>
                <div>
                  <h4 className="text-xs font-black uppercase tracking-wide text-slate-900">
                    Enviar Checklist Interativo para o Cliente
                  </h4>
                  <p className="text-[11px] text-slate-500 leading-tight mt-0.5">
                    O cliente testa tela, câmeras, áudio, microfone e sensores no celular dele e gera laudo com assinatura.
                  </p>
                </div>
              </div>
            </div>

            {/* Input com Link do Checklist */}
            <div className="flex items-center gap-1.5 bg-white border border-purple-200 rounded-xl p-1.5 pl-3">
              <input 
                type="text" 
                readOnly 
                value={checklistUrl}
                className="w-full text-[11px] text-slate-600 font-mono bg-transparent outline-none select-all"
              />
              <button
                type="button"
                onClick={handleCopyChecklistLink}
                className="px-3 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 rounded-lg text-[10px] font-black uppercase tracking-wider flex items-center gap-1 shrink-0 transition-colors cursor-pointer"
              >
                {copiedChecklistLink ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
                <span>{copiedChecklistLink ? 'Copiado!' : 'Copiar'}</span>
              </button>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch gap-2 pt-0.5">
              <button
                type="button"
                onClick={handleShareChecklistWhatsApp}
                className="flex-1 bg-purple-600 hover:bg-purple-500 active:scale-[0.98] text-white py-3 px-4 rounded-xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-md shadow-purple-600/30 transition-all cursor-pointer"
              >
                <Send size={15} />
                <span>Enviar Convite de Teste no WhatsApp</span>
              </button>

              <a
                href={checklistUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-white hover:bg-slate-100 active:scale-[0.98] border border-slate-300 text-slate-700 py-3 px-3.5 rounded-xl font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all text-center"
                title="Abrir checklist interativo em nova aba"
              >
                <ExternalLink size={15} />
                <span>Testar</span>
              </a>
            </div>
          </div>
        </div>

        {/* RODAPÉ */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-3">
          {onPrint ? (
            <button
              type="button"
              onClick={() => {
                onPrint(order);
              }}
              className="px-4 py-2.5 rounded-xl border border-slate-300 hover:bg-white text-slate-700 font-bold text-xs uppercase tracking-wider flex items-center gap-2 transition-colors active:scale-95 cursor-pointer"
            >
              <Printer size={15} />
              <span>Imprimir Via</span>
            </button>
          ) : <div />}

          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-black text-xs uppercase tracking-wider shadow transition-colors active:scale-95 cursor-pointer"
          >
            Concluir
          </button>
        </div>
      </div>
    </div>
  );
};
