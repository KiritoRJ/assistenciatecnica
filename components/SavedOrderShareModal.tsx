import React, { useState, useEffect } from 'react';
import { 
  X, Check, Copy, ExternalLink, Printer, 
  Smartphone, User, Eye, Send, Image as ImageIcon, Loader2, Download,
  Sparkles, CheckCircle2, QrCode, Wrench, Layers, ShieldCheck
} from 'lucide-react';
import QRCode from 'qrcode';
import { ServiceOrder, AppSettings, DeviceDiagnosticResults } from '../types';
import { formatCurrency, getHardwareTestUrl, getTrackingUrl } from '../utils';
import { generateReceiptCanvasImage, shareReceiptDirectly } from '../utils/receiptGenerator';
import { DiagnosticReportModal } from './DiagnosticReportModal';

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
  const [copiedTestLink, setCopiedTestLink] = useState(false);
  const [isGeneratingPhoto, setIsGeneratingPhoto] = useState(false);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const [photoSentFeedback, setPhotoSentFeedback] = useState<string | null>(null);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string | null>(null);
  const [showDiagnosticReport, setShowDiagnosticReport] = useState(false);

  const getOrderDiagnostics = (): DeviceDiagnosticResults | null => {
    if (!order) return null;
    if (order.diagnosticTests) return order.diagnosticTests;
    if (Array.isArray(order.checklist)) {
      for (const item of order.checklist) {
        if (typeof item === 'string' && item.startsWith('__DIAG_JSON__:')) {
          try {
            return JSON.parse(item.substring(14));
          } catch (e) {}
        }
      }
    }
    try {
      const targetToken = order.trackingToken || order.id;
      const cached = localStorage.getItem(`os_diag_${targetToken}`) || localStorage.getItem(`os_diag_${order.id}`);
      if (cached) return JSON.parse(cached);
    } catch (e) {}
    return null;
  };

  useEffect(() => {
    if (isOpen && order) {
      // Pré-carrega a imagem do comprovante para resposta imediata
      generateReceiptCanvasImage(order, settings)
        .then(res => setPreviewImageUrl(res.dataUrl))
        .catch(err => console.warn('Erro ao pré-carregar imagem:', err));

      // Gera o QR Code para a página externa de testes de hardware do celular
      const targetToken = order.trackingToken || order.id;
      const hardwareTestUrl = getHardwareTestUrl(targetToken, settings);
      QRCode.toDataURL(hardwareTestUrl, {
        width: 280,
        margin: 1,
        color: {
          dark: '#0f172a',
          light: '#ffffff'
        }
      })
        .then(url => setQrCodeDataUrl(url))
        .catch(err => console.error('Erro ao gerar QR Code de testes:', err));
    } else {
      setPreviewImageUrl(null);
      setPhotoSentFeedback(null);
      setCopiedLink(false);
      setCopiedTestLink(false);
      setQrCodeDataUrl(null);
    }
  }, [isOpen, order, settings]);

  if (!isOpen || !order) return null;

  const storeName = settings?.storeName || 'Assistência Técnica';
  const osCode = order.id ? `#${order.id.split('-')[0]}` : '';
  const cleanPhone = (order.phoneNumber || '').replace(/\D/g, '');
  const phoneWithCountry = cleanPhone.length <= 11 && !cleanPhone.startsWith('55') ? `55${cleanPhone}` : cleanPhone;
  const trackingToken = order.trackingToken || order.id;
  const trackingUrl = getTrackingUrl(trackingToken, settings);
  const hardwareTestUrl = getHardwareTestUrl(trackingToken, settings);

  const handleCopyTestLink = () => {
    navigator.clipboard.writeText(hardwareTestUrl);
    setCopiedTestLink(true);
    setTimeout(() => setCopiedTestLink(false), 3000);
  };

  const handleShareTestWhatsApp = () => {
    const text = encodeURIComponent(
      `*${storeName}* - Teste de Hardware do Celular\n\n` +
      `Olá, *${order.customerName}*!\n` +
      `Criamos os testes de funções do seu aparelho (*${order.deviceBrand} ${order.deviceModel}*) referente à O.S. *${osCode}*.\n\n` +
      `Para testar Touch, Microfone, Alto-falante, Wi-Fi, Sensores e Biometria, acesse o link:\n` +
      `${hardwareTestUrl}\n\n` +
      `_Os resultados dos testes serão gravados diretamente na sua Ordem de Serviço._`
    );
    window.open(`https://wa.me/${phoneWithCountry}?text=${text}`, '_blank');
  };

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

          {/* NOVO: TESTES DE FUNÇÕES E HARDWARE DO CELULAR (QR CODE) */}
          <div className="border-2 border-indigo-500/30 bg-indigo-50/50 rounded-2xl p-4 sm:p-5 space-y-3 relative overflow-hidden">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-600/30 shrink-0">
                  <QrCode size={22} />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <h4 className="text-xs sm:text-sm font-black uppercase tracking-wide text-slate-900">
                      Testes de Hardware do Celular
                    </h4>
                    <span className="bg-indigo-600 text-white text-[9px] font-black uppercase px-1.5 py-0.5 rounded-md">
                      QR Code
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 leading-tight mt-0.5">
                    Escaneie para testar Touch, Multi-touch, Microfone, Alto-falante, Auricular, Wi-Fi, Sensor e Biometria.
                  </p>
                </div>
              </div>

              {order.diagnosticTests && (
                <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 shrink-0 flex items-center gap-1">
                  <CheckCircle2 size={12} /> {order.diagnosticTests.summary || 'Testado'}
                </span>
              )}
            </div>

            {(() => {
              const diagResults = getOrderDiagnostics();
              if (!diagResults) return null;
              return (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between gap-2 shadow-xs">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
                    <div>
                      <p className="text-xs font-black text-emerald-950">
                        Hardware Já Testado ({diagResults.summary || 'Aprovado'})
                      </p>
                      <p className="text-[10px] text-emerald-700">
                        Os resultados dos testes já estão gravados no sistema.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowDiagnosticReport(true)}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-[10px] font-black uppercase tracking-wider flex items-center gap-1 shadow-xs cursor-pointer shrink-0 active:scale-95 transition-all"
                  >
                    <ShieldCheck size={13} />
                    <span>Ver Laudo</span>
                  </button>
                </div>
              );
            })()}

            {/* Visual do QR Code Centralizado */}
            <div className="bg-white border border-indigo-100 rounded-2xl p-4 flex flex-col items-center justify-center text-center shadow-sm">
              {qrCodeDataUrl ? (
                <div className="relative group">
                  <div className="p-2 bg-white rounded-xl border border-slate-200 shadow-sm inline-block">
                    <img 
                      src={qrCodeDataUrl} 
                      alt="QR Code de Teste de Hardware"
                      className="w-36 h-36 sm:w-40 sm:h-40 object-contain rounded-lg"
                    />
                  </div>
                  <div className="mt-2 flex items-center justify-center gap-1.5 text-[11px] font-bold text-slate-600">
                    <Smartphone size={13} className="text-indigo-600" />
                    <span>Aponte a câmera do celular para iniciar</span>
                  </div>
                </div>
              ) : (
                <div className="w-36 h-36 bg-slate-100 rounded-xl flex items-center justify-center text-slate-400">
                  <Loader2 size={24} className="animate-spin text-indigo-500" />
                </div>
              )}

              {/* Link Input de Teste */}
              <div className="w-full mt-3 flex items-center gap-1.5 bg-slate-50 border border-indigo-200/80 rounded-xl p-1.5 pl-3">
                <input 
                  type="text" 
                  readOnly 
                  value={hardwareTestUrl}
                  className="w-full text-[11px] text-slate-600 font-mono bg-transparent outline-none select-all"
                />
                <button
                  type="button"
                  onClick={handleCopyTestLink}
                  className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-[10px] font-black uppercase tracking-wider flex items-center gap-1 shrink-0 transition-colors cursor-pointer"
                >
                  {copiedTestLink ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
                  <span>{copiedTestLink ? 'Copiado!' : 'Copiar'}</span>
                </button>
              </div>
            </div>

            {/* Ações Rápidas dos Testes */}
            <div className="flex flex-col sm:flex-row items-stretch gap-2 pt-1">
              <a
                href={hardwareTestUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 bg-indigo-600 hover:bg-indigo-500 active:scale-[0.98] text-white py-3 px-4 rounded-xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-md shadow-indigo-600/30 transition-all text-center"
              >
                <ExternalLink size={15} />
                <span>Abrir Testes no Aparelho</span>
              </a>

              <button
                type="button"
                onClick={handleShareTestWhatsApp}
                className="bg-white hover:bg-slate-100 active:scale-[0.98] border border-indigo-200 text-indigo-700 py-3 px-4 rounded-xl font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all cursor-pointer"
              >
                <Send size={15} />
                <span>Mandar no WhatsApp</span>
              </button>
            </div>
          </div>

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

      {/* MODAL DE LAUDO TÉCNICO DE HARDWARE */}
      <DiagnosticReportModal
        isOpen={showDiagnosticReport}
        onClose={() => setShowDiagnosticReport(false)}
        order={order}
        settings={settings}
      />
    </div>
  );
};
