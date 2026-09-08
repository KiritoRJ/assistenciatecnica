import React, { useState } from 'react';
import { 
  X, MessageSquare, Send, Sparkles, ShieldCheck, Smartphone, 
  Flame, Gift, CheckCircle, Copy, ExternalLink, Wrench, Check
} from 'lucide-react';
import { Customer, ServiceOrder, AppSettings } from '../types';
import { formatCurrency } from '../utils';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  customer: Customer | null;
  order?: ServiceOrder | null;
  settings: AppSettings;
}

export interface BroadcastTemplate {
  id: string;
  title: string;
  category: 'proposta' | 'pos_reparo' | 'preventiva' | 'acessorios' | 'retirada' | 'fidelidade';
  icon: any;
  badge: string;
  badgeColor: string;
  generateText: (data: {
    customerName: string;
    storeName: string;
    storePhone: string;
    device: string;
    defect: string;
    repair: string;
    totalFormatted: string;
    trackingUrl: string;
  }) => string;
}

export const BROADCAST_TEMPLATES: BroadcastTemplate[] = [
  {
    id: 'proposta_premium',
    title: 'Proposta / Orçamento de Alto Valor',
    category: 'proposta',
    icon: ShieldCheck,
    badge: 'Mais Aprovado',
    badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    generateText: ({ customerName, storeName, device, defect, repair, totalFormatted, trackingUrl }) =>
`Olá, *${customerName}*! Tudo bem? 📱

Seu *${device || 'aparelho'}* foi avaliado por nossa equipe técnica especializada na *${storeName}*.

🛠️ *Diagnóstico*: ${defect || 'Avaliação técnica de bancada'}
🔧 *Serviço*: ${repair || 'Troca de componente com calibragem completa'}
💰 *Investimento*: *${totalFormatted}*

🛡️ *Diferenciais Inclusos*:
✅ Peças de alta performance com garantia
✅ Testes rigorosos de todas as funções
✅ Higienização técnica do aparelho

${trackingUrl ? `📲 Acompanhe online: ${trackingUrl}\n` : ''}Podemos iniciar o procedimento para liberar seu aparelho o mais rápido possível?`
  },
  {
    id: 'pos_reparo_protecao',
    title: 'Proteção Pós-Conserto (Capa + Película)',
    category: 'pos_reparo',
    icon: Sparkles,
    badge: 'Venda Casada',
    badgeColor: 'bg-blue-50 text-blue-700 border-blue-200',
    generateText: ({ customerName, storeName, device }) =>
`Olá *${customerName}*! 🚀

O reparo do seu *${device || 'aparelho'}* foi concluído com sucesso e ele está funcionando perfeitamente! 🎉

Para você não ter mais dor de cabeça com quedas ou quebras de tela, separamos o nosso *Combo de Máxima Proteção*:
🛡️ *Película de Alta Resistência* (anti-impacto e anti-risco)
📱 *Capa com Bordas Reforçadas*

Podemos já deixar aplicado no seu aparelho para quando você vier retirar? Assim você já sai 100% protegido!`
  },
  {
    id: 'aparelho_pronto',
    title: 'Aparelho Pronto para Retirada',
    category: 'retirada',
    icon: CheckCircle,
    badge: 'Aviso Rápido',
    badgeColor: 'bg-cyan-50 text-cyan-700 border-cyan-200',
    generateText: ({ customerName, storeName, device, totalFormatted, trackingUrl }) =>
`Olá *${customerName}*! Boas notícias! 🎉

O seu *${device || 'aparelho'}* já está *100% pronto*, testado e higienizado aqui na *${storeName}*!

✨ Todos os testes foram aprovados com sucesso.
${totalFormatted && totalFormatted !== 'R$ 0,00' ? `💳 *Valor final*: ${totalFormatted}\n` : ''}${trackingUrl ? `📲 Ver ordem de serviço: ${trackingUrl}\n` : ''}
Ficamos no aguardo da sua visita para entregá-lo! Nosso horário de atendimento é de segunda a sexta. Qualquer dúvida estamos à disposição.`
  },
  {
    id: 'checkup_preventivo',
    title: 'Check-up Preventivo Gratuito',
    category: 'preventiva',
    icon: Wrench,
    badge: 'Reativação',
    badgeColor: 'bg-purple-50 text-purple-700 border-purple-200',
    generateText: ({ customerName, storeName }) =>
`Olá *${customerName}*! Como está o desempenho do seu smartphone? 📱

Como você é um cliente especial da *${storeName}*, liberamos para você um *Check-up Técnico Gratuito*:
🔍 Teste de integridade e saúde da bateria
🧼 Limpeza profunda dos conectores de carga e microfones
🔊 Desobstrução e teste de alto-falantes

Traga seu aparelho essa semana para realizarmos a avaliação em apenas 5 minutos! Aguardamos você.`
  },
  {
    id: 'chegada_acessorios',
    title: 'Lançamento de Acessórios Turbo',
    category: 'acessorios',
    icon: Flame,
    badge: 'Novidades',
    badgeColor: 'bg-amber-50 text-amber-700 border-amber-200',
    generateText: ({ customerName, storeName }) =>
`Olá *${customerName}*! Tudo bem? ⚡

Acabamos de receber na *${storeName}* um novo lote de *Carregadores Turbo Ultra-Rápidos* e *Cabos Reforçados Anti-Quebra*.

🔋 Carrega até 4x mais rápido sem viciar a bateria
🛡️ Cabo com blindagem reforçada e garantia

Como as unidades costumam esgotar rápido, quer que eu separe uma unidade para você passar e retirar?`
  },
  {
    id: 'aniversario_fidelidade',
    title: 'Fidelidade & Cuidados Especiais',
    category: 'fidelidade',
    icon: Gift,
    badge: 'Relacionamento',
    badgeColor: 'bg-rose-50 text-rose-700 border-rose-200',
    generateText: ({ customerName, storeName }) =>
`Olá *${customerName}*! Passando para agradecer pela confiança na *${storeName}*! 🌟

Queremos que seus aparelhos estejam sempre com o melhor desempenho e segurança.
Quando precisar de qualquer auxílio, revisão, películas ou novos acessórios, pode contar diretamente com nossa equipe.

Tenha um excelente dia!`
  }
];

export const CustomerBroadcastModal: React.FC<Props> = ({
  isOpen,
  onClose,
  customer,
  order,
  settings
}) => {
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('proposta_premium');
  const [customMessage, setCustomMessage] = useState<string>('');
  const [isCopied, setIsCopied] = useState(false);

  // Inicializa o texto baseado no template selecionado
  const activeTemplate = BROADCAST_TEMPLATES.find(t => t.id === selectedTemplateId) || BROADCAST_TEMPLATES[0];

  const storeName = settings.storeName || 'Nossa Loja';
  const storePhone = settings.storePhone || '';
  const customerName = customer?.name || order?.customerName || 'Cliente';
  const device = (order?.deviceBrand ? `${order.deviceBrand} ${order.deviceModel || ''}` : order?.deviceModel) || 'Smartphone';
  const defect = order?.defect || '';
  const repair = order?.repairDetails || '';
  const totalFormatted = order?.total ? formatCurrency(order.total) : '';
  const trackingToken = order?.trackingToken || order?.id || '';
  const trackingUrl = trackingToken ? `${window.location.origin}/?track=${trackingToken}` : '';

  const rawPhone = customer?.phoneNumber || order?.phoneNumber || '';
  const cleanDigits = rawPhone.replace(/\D/g, '');
  const targetPhone = cleanDigits.length >= 10 ? (cleanDigits.startsWith('55') ? cleanDigits : `55${cleanDigits}`) : '';

  // Efeito para recalcular o texto gerado
  React.useEffect(() => {
    if (activeTemplate) {
      const text = activeTemplate.generateText({
        customerName,
        storeName,
        storePhone,
        device,
        defect,
        repair,
        totalFormatted,
        trackingUrl
      });
      setCustomMessage(text);
    }
  }, [selectedTemplateId, customer?.id, order?.id, storeName]);

  if (!isOpen) return null;

  const handleSendWhatsApp = () => {
    if (!targetPhone) {
      alert('Número de telefone do cliente não encontrado ou incompleto.');
      return;
    }
    const encoded = encodeURIComponent(customMessage);
    const url = `https://wa.me/${targetPhone}?text=${encoded}`;
    window.open(url, '_blank');
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(customMessage);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 z-50 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl w-full max-w-2xl max-h-[92vh] flex flex-col shadow-2xl border border-slate-100 overflow-hidden">
        {/* HEADER */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center backdrop-blur-xs">
              <MessageSquare size={20} className="text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-black text-sm sm:text-base uppercase tracking-tight">
                  Divulgador WhatsApp de Alta Conversão
                </h3>
                <span className="text-[9px] font-black bg-emerald-400 text-emerald-950 px-2 py-0.5 rounded-full uppercase">
                  1-Clique
                </span>
              </div>
              <p className="text-[11px] text-blue-100 font-medium">
                Enviando para: <span className="font-bold text-white">{customerName}</span> {rawPhone ? `(${rawPhone})` : ''}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-xl transition-colors"
            title="Fechar"
          >
            <X size={18} />
          </button>
        </div>

        {/* BODY */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4 flex-1">
          {/* SELETOR DE TEMPLATES PRONTOS */}
          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">
              Selecione o Modelo de Mensagem:
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {BROADCAST_TEMPLATES.map(tmpl => {
                const Icon = tmpl.icon;
                const isSelected = selectedTemplateId === tmpl.id;
                return (
                  <button
                    key={tmpl.id}
                    type="button"
                    onClick={() => setSelectedTemplateId(tmpl.id)}
                    className={`p-3 rounded-2xl border text-left transition-all flex flex-col justify-between gap-2 active:scale-98 ${
                      isSelected
                        ? 'border-blue-600 bg-blue-50/50 shadow-sm ring-2 ring-blue-500/20'
                        : 'border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50/50'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1 w-full">
                      <div className={`w-7 h-7 rounded-xl flex items-center justify-center ${isSelected ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                        <Icon size={14} />
                      </div>
                      <span className={`text-[8px] font-black px-1.5 py-0.5 rounded-md border uppercase ${tmpl.badgeColor}`}>
                        {tmpl.badge}
                      </span>
                    </div>
                    <span className={`text-[11px] font-black leading-tight line-clamp-2 ${isSelected ? 'text-blue-900' : 'text-slate-800'}`}>
                      {tmpl.title}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* PREVIEW E EDIÇÃO DA MENSAGEM */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                Mensagem que será enviada (Você pode editar):
              </label>
              <button
                type="button"
                onClick={handleCopy}
                className="text-[10px] font-bold text-slate-500 hover:text-slate-800 inline-flex items-center gap-1 transition-colors"
              >
                {isCopied ? (
                  <>
                    <Check size={12} className="text-emerald-600" />
                    <span className="text-emerald-600">Copiado!</span>
                  </>
                ) : (
                  <>
                    <Copy size={12} />
                    <span>Copiar Texto</span>
                  </>
                )}
              </button>
            </div>
            <textarea
              rows={8}
              value={customMessage}
              onChange={(e) => setCustomMessage(e.target.value)}
              className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs text-slate-800 font-medium focus:outline-none focus:border-blue-500 focus:bg-white transition-all resize-none shadow-inner"
              placeholder="Digite sua mensagem personalizada..."
            />
          </div>

          {/* DICA DE CONVERSÃO */}
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-3 flex items-start gap-2.5">
            <Sparkles size={16} className="text-emerald-600 shrink-0 mt-0.5" />
            <p className="text-[11px] text-emerald-800 font-bold leading-relaxed">
              <strong className="text-emerald-950">Estratégia de Alta Margem:</strong> Estas mensagens valorizam a garantia, agilidade e segurança do serviço, sem que você precise dar descontos que prejudiquem seu lucro!
            </p>
          </div>
        </div>

        {/* FOOTER COM BOTÃO DE DISPARO */}
        <div className="p-4 sm:p-5 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-3 bg-white hover:bg-slate-100 text-slate-700 rounded-2xl font-black text-xs uppercase tracking-wider border border-slate-200 transition-all active:scale-95"
          >
            Cancelar
          </button>

          <button
            type="button"
            onClick={handleSendWhatsApp}
            disabled={!customMessage.trim()}
            className="flex-1 sm:flex-none px-6 py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/25 active:scale-95 transition-all disabled:opacity-50"
          >
            <Send size={16} />
            <span>Abrir no WhatsApp ({customerName.split(' ')[0]})</span>
          </button>
        </div>
      </div>
    </div>
  );
};
