
import React, { useState } from 'react';
import { CreditCard, Check, ShieldCheck, Clock, Calendar, Smartphone, LogOut, Loader2 } from 'lucide-react';
import { OnlineDB } from '../utils/api';

interface SubscriptionViewProps {
  tenantId: string;
  storeName: string;
  expiresAt: string;
  customMonthlyPrice?: number;
  customQuarterlyPrice?: number;
  customYearlyPrice?: number;
  onLogout: () => void;
  onSuccess: (newExpiresAt: string) => void;
  onClose?: () => void;
}

const SubscriptionView: React.FC<SubscriptionViewProps> = ({ 
  tenantId, storeName, expiresAt, onLogout, onSuccess, onClose,
  customMonthlyPrice, customQuarterlyPrice, customYearlyPrice
}) => {
  const [loading, setLoading] = useState<string | null>(null);
  const [globalPlans, setGlobalPlans] = React.useState<any>({});
  const [selectedPlan, setSelectedPlan] = useState<any>(null);

  React.useEffect(() => {
    OnlineDB.getGlobalSettings().then(setGlobalPlans);
  }, []);

  const getPrice = (id: string) => {
    if (id === 'monthly') return customMonthlyPrice || globalPlans.monthly?.price || 0;
    if (id === 'quarterly') return customQuarterlyPrice || globalPlans.quarterly?.price || 0;
    if (id === 'yearly') return customYearlyPrice || globalPlans.yearly?.price || 0;
    return 0;
  };

  const plans = [
    {
      id: 'monthly',
      name: 'PLANO START - MENSAL',
      price: `R$ ${getPrice('monthly').toFixed(2).replace('.', ',')}`,
      period: 'por mês',
      description: 'Ideal para pequenas lojas e assistências iniciantes',
      target: 'Indicado para: 1 a 2 funcionários',
      features: [
        'Cadastro de produtos (200)',
        'Cadastro de ordem de serviços (200)',
        'Vendas com baixa automatica do estoque',
        'Frente de loja (PDV)',
        'Ordem de Serviço com fotos',
        '2 usuários (1 admin + 1 funcionário)',
        'Acesso via celular e computador',
        'Sistema 100% em nuvem'
      ],
      months: 1
    },
    {
      id: 'quarterly',
      name: 'PLANO PRO - TRIMESTRAL',
      price: `R$ ${getPrice('quarterly').toFixed(2).replace('.', ',')}`,
      period: 'por 3 meses',
      description: 'Ideal para lojas estruturadas que querem crescer',
      discount: 'Plano mais vendido',
      target: 'Indicado para: 3 a 5 funcionários',
      features: [
      '✔ Tudo do Start +', 
      'Cadastro de produtos (500)', 
      'Cadastro de ordem de serviço (500)',
      'Controle de estoque',
      'Frente de loja (PDV)',
      'Ordem de Serviço registros com fotos',
      '5 usuários (1 admin + 4 funcionário)',
      'Acesso via celular e computador',
      'Sistema 100% em nuvem',
      'Relatórios financeiros de até 6 meses',
      'Relatórios de vendas, ordem de serviços canceladas',
      'Acesso via celulares ou computadores',
     
      ],
      months: 3,
      popular: true
    },
    {
      id: 'yearly',
      name: 'Plano Premium - Anual',
      price: `R$ ${getPrice('yearly').toFixed(2).replace('.', ',')}`,
      period: 'por ano',
      description: 'Ideal para lojas grandes que precisam de soluções',
      discount: 'Melhor custo-benefício',
      target: 'Indicado para: 6 a 10 funcionários',
      features: [
        '✔ Tudo do Pro +',
        'Desconto exclusivo', 
        'Garantia de preço por 1 ano',
        'Suporte garantido',
        'Pedido de novas funções',
        'Cadastro de clientes',
        'Acesso antecipado a novas atualizaçãoes',
        
        
        
        
        
        
        
        
        
        ],
      months: 12
    }
  ];



  const [error, setError] = useState<string | null>(null);

  const handleSubscription = async (plan: any) => {
    setLoading(plan.id);
    setError(null);
    try {
      const response = await fetch('/api/create-preference', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: `Assinatura ${plan.name}`,
          unit_price: getPrice(plan.id),
          quantity: 1,
          tenantId,
          planType: plan.id,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao criar preferência de pagamento.');
      }

      if (data.init_point) {
        // Redirecionamento direto
        window.location.href = data.init_point;
      } else {
        throw new Error('Link de pagamento não recebido.');
      }

    } catch (err: any) {
      console.error('Error creating preference:', err);
      setError(err.message || 'Ocorreu um erro inesperado. Tente novamente.');
      alert(`Erro: ${err.message || 'Não foi possível iniciar o pagamento.'}`);
    } finally {
      setLoading(null);
    }
  };



  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return dateStr;
      return new Intl.DateTimeFormat('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        timeZone: 'UTC'
      }).format(date);
    } catch (e) {
      return dateStr;
    }
  };





  return (
    <div className="min-h-screen bg-[#0f172a] text-white flex flex-col items-center justify-center p-6 font-sans">
      <div className="max-w-4xl w-full">
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-blue-600 rounded-3xl mb-6 shadow-2xl shadow-blue-500/20">
            <Smartphone size={40} />
          </div>
          <h1 className="text-4xl font-black uppercase tracking-tighter mb-2">
            {onClose ? 'Planos e Assinaturas' : 'Assinatura Expirada'}
          </h1>
          <p className="text-slate-400 font-medium">
            {onClose ? 'Escolha o melhor plano para sua loja ' : 'Sua loja '}
            <span className="text-white font-bold">{storeName}</span>
            {!onClose && ' precisa de uma assinatura ativa.'}
          </p>
          {!onClose && (
            <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-red-500/10 border border-red-500/20 rounded-full text-red-400 text-xs font-bold uppercase tracking-widest">
              <Clock size={14} />
              Expirou em: {formatDate(expiresAt)}
            </div>
          )}
        </div>

        <div className="grid md:grid-cols-2 gap-6 mb-12">
          {plans.map((plan) => (
            <div 
              key={plan.id}
              className={`relative bg-slate-900/50 border-2 rounded-[2.5rem] p-8 transition-all duration-500 ${plan.popular ? 'border-blue-600 shadow-2xl shadow-blue-600/10' : 'border-slate-800'}`}
            >
              {plan.popular && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-blue-600 text-white text-[10px] font-black uppercase tracking-[0.2em] px-6 py-2 rounded-full shadow-xl">
                  Mais Popular
                </div>
              )}

              <div className="mb-8">
                <h3 className="text-xl font-black uppercase tracking-tight mb-1">{plan.name}</h3>
                {plan.description && <p className="text-slate-400 text-xs font-bold mb-2 leading-tight">{plan.description}</p>}
                {plan.target && <p className="text-blue-400 text-[10px] font-black uppercase mb-4 tracking-widest">{plan.target}</p>}
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl font-black tracking-tighter">{plan.price}</span>
                  <span className="text-slate-500 text-sm font-bold">{plan.period}</span>
                </div>
                {plan.discount && (
                  <span className="inline-block mt-2 text-emerald-400 text-[10px] font-black uppercase tracking-widest bg-emerald-400/10 px-3 py-1 rounded-full">
                    {plan.discount}
                  </span>
                )}
              </div>

              <ul className="space-y-4 mb-10">
                {plan.features.map((feature, i) => (
                  <li key={`${plan.id}-${i}`} className="flex items-center gap-3 text-slate-300 text-sm font-medium">
                    <div className="flex-shrink-0 w-5 h-5 bg-emerald-500/20 rounded-full flex items-center justify-center">
                      <Check size={12} className="text-emerald-400" />
                    </div>
                    {feature}
                  </li>
                ))}
              </ul>

              <button
                onClick={() => handleSubscription(plan)}
                disabled={loading !== null}
                className={`w-full py-5 rounded-3xl font-black uppercase text-xs tracking-[0.2em] transition-all flex items-center justify-center gap-3 ${plan.popular ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-xl shadow-blue-600/20' : 'bg-white hover:bg-slate-100 text-slate-900'}`}
              >
                {loading === plan.id ? (
                  <Loader2 className="animate-spin" size={20} />
                ) : (
                  <>
                    <CreditCard size={18} />
                    Assinar Agora
                  </>
                )}
              </button>
            </div>
          ))}
        </div>

        <div className="flex flex-col items-center gap-6">
          <p className="text-xs text-slate-500 mt-4 text-center">Você será redirecionado para a página de pagamentos segura do Mercado Pago.<br/>Se a página não atualizar automaticamente após o pagamento, por favor, deslogue e logue novamente.</p>
          <div className="flex items-center gap-8 opacity-40 grayscale">
            <img src="https://logodownload.org/wp-content/uploads/2019/06/mercado-pago-logo.png" alt="Mercado Pago" className="h-6 object-contain" />
          </div>

          <div className="flex items-center gap-4">
            {onClose && (
              <button 
                onClick={onClose}
                className="flex items-center gap-2 text-slate-500 hover:text-white text-xs font-black uppercase tracking-[0.2em] transition-colors"
              >
                Voltar
              </button>
            )}
            <button 
              onClick={onLogout}
              className="flex items-center gap-2 text-slate-500 hover:text-white text-xs font-black uppercase tracking-[0.2em] transition-colors"
            >
              <LogOut size={16} />
              Sair da Conta
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SubscriptionView;
