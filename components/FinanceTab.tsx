
import React, { useState } from 'react';
import { TrendingUp, TrendingDown, DollarSign, ShoppingBag, ClipboardList, Target, Zap, ArrowUpRight, History, BarChart3, PieChart as PieIcon, Search, Trash2, AlertCircle, Loader2, Lock, KeyRound, X, Plus, Minus, Wallet } from 'lucide-react';
import { ServiceOrder, Sale, Product, Transaction } from '../types';
import { formatCurrency, formatDate } from '../utils';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie } from 'recharts';
import { OnlineDB } from '../utils/api';

interface Props {
  orders: ServiceOrder[];
  sales: Sale[];
  products: Product[];
  transactions: Transaction[];
  setTransactions: (transactions: Transaction[]) => Promise<void>;
  onDeleteTransaction: (id: string) => Promise<void>;
  onDeleteSale: (sale: Sale) => Promise<void>;
  tenantId: string;
}

const FinanceTab: React.FC<Props> = ({ orders, sales, products, transactions, setTransactions, onDeleteTransaction, onDeleteSale, tenantId }) => {
  const [saleSearch, setSaleSearch] = useState('');
  const [isCancelling, setIsCancelling] = useState<string | null>(null);
  
  // Estados para Modal de Senha
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [verifyingPassword, setVerifyingPassword] = useState(false);
  const [authError, setAuthError] = useState(false);
  const [selectedSaleToCancel, setSelectedSaleToCancel] = useState<Sale | null>(null);

  // Estados para Nova Transação
  const [isTransactionModalOpen, setIsTransactionModalOpen] = useState(false);
  const [isSavingTransaction, setIsSavingTransaction] = useState(false);
  const [newTransaction, setNewTransaction] = useState<Partial<Transaction>>({
    type: 'entrada',
    description: '',
    amount: 0,
    category: 'Geral',
    paymentMethod: 'Dinheiro'
  });

  const deliveredOrders = orders.filter(order => order.status === 'Entregue');
  
  // Cálculos de O.S.
  const totalOSRevenue = deliveredOrders.reduce((acc, curr) => acc + curr.total, 0);
  const totalOSPartsCost = deliveredOrders.reduce((acc, curr) => acc + curr.partsCost, 0);
  const totalOSProfit = deliveredOrders.reduce((acc, curr) => acc + curr.serviceCost, 0);

  // Cálculos de Vendas
  const totalSalesRevenue = sales.reduce((acc, curr) => acc + curr.finalPrice, 0);
  const totalSalesCost = sales.reduce((acc, curr) => acc + (curr.costAtSale * curr.quantity), 0);
  const totalSalesProfit = totalSalesRevenue - totalSalesCost;

  // Cálculos de Transações Manuais
  const manualIncomes = transactions.filter(t => t.type === 'entrada').reduce((acc, curr) => acc + curr.amount, 0);
  const manualExpenses = transactions.filter(t => t.type === 'saida').reduce((acc, curr) => acc + curr.amount, 0);

  const totalRevenue = totalOSRevenue + totalSalesRevenue + manualIncomes;
  const totalCosts = totalOSPartsCost + totalSalesCost + manualExpenses;
  const totalNetProfit = totalRevenue - totalCosts;

  // Dados para Gráficos
  const chartData = [
    { name: 'O.S.', value: totalOSProfit, color: '#3b82f6' },
    { name: 'VENDAS', value: totalSalesProfit, color: '#10b981' },
    { name: 'MANUAL', value: manualIncomes - manualExpenses, color: '#f59e0b' },
  ];

  const sourceData = [
    { name: 'O.S.', value: totalOSRevenue },
    { name: 'LOJA', value: totalSalesRevenue },
    { name: 'MANUAL', value: manualIncomes },
  ].filter(d => d.value > 0);

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b'];

  // Busca de vendas
  const filteredSales = sales.filter(s => 
    (s.transactionId && s.transactionId.toLowerCase().includes(saleSearch.toLowerCase())) ||
    (s.productName && s.productName.toLowerCase().includes(saleSearch.toLowerCase()))
  );

  const handleSaveTransaction = async () => {
    if (!newTransaction.description || !newTransaction.amount) return alert('Preencha todos os campos.');
    setIsSavingTransaction(true);
    try {
      const transaction: Transaction = {
        id: 'TRX_' + Math.random().toString(36).substr(2, 6).toUpperCase(),
        type: newTransaction.type as 'entrada' | 'saida',
        description: newTransaction.description,
        amount: Number(newTransaction.amount),
        date: new Date().toISOString(),
        category: newTransaction.category,
        paymentMethod: newTransaction.paymentMethod
      };
      await setTransactions([transaction, ...transactions]);
      setIsTransactionModalOpen(false);
      setNewTransaction({ type: 'entrada', description: '', amount: 0, category: 'Geral', paymentMethod: 'Dinheiro' });
    } catch (e) {
      alert('Erro ao salvar transação.');
    } finally {
      setIsSavingTransaction(false);
    }
  };

  const initiateCancelSale = (sale: Sale) => {
    setSelectedSaleToCancel(sale);
    setIsAuthModalOpen(true);
    setPasswordInput('');
    setAuthError(false);
  };

  const confirmCancellation = async () => {
    if (!selectedSaleToCancel || !passwordInput) return;
    setVerifyingPassword(true);
    setAuthError(false);

    try {
      const authResult = await OnlineDB.verifyAdminPassword(tenantId, passwordInput);
      if (authResult.success) {
        setIsCancelling(selectedSaleToCancel.id);
        setIsAuthModalOpen(false);
        try {
          await onDeleteSale(selectedSaleToCancel);
        } catch (e: any) {
          alert(`ERRO AO CANCELAR: ${e.message}`);
        } finally {
          setIsCancelling(null);
          setSelectedSaleToCancel(null);
        }
      } else {
        setAuthError(true);
        setTimeout(() => setAuthError(false), 2000);
      }
    } catch (err) {
      alert("Falha de rede ao verificar autorização.");
    } finally {
      setVerifyingPassword(false);
    }
  };

  return (
    <div className="space-y-3 pb-8 w-full max-w-full animate-in fade-in duration-500 overflow-x-hidden">
      {/* Header Compacto */}
      <div className="flex items-center justify-between px-1">
        <div>
          <h2 className="text-lg font-black text-slate-800 tracking-tighter leading-none uppercase">Financeiro</h2>
          <p className="text-[8px] text-slate-400 font-bold uppercase tracking-widest mt-1">Dashboard de Performance</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setIsTransactionModalOpen(true)} className="bg-slate-900 text-white px-3 py-1.5 rounded-lg text-[8px] font-black uppercase tracking-widest flex items-center gap-1.5 shadow-lg active:scale-95 transition-all">
            <Plus size={12} />
            Lançamento
          </button>
          <div className="bg-emerald-500 text-white px-2.5 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest flex items-center gap-1.5 shadow-lg shadow-emerald-500/20">
            <Zap size={10} fill="currentColor" />
            SQL Ativo
          </div>
        </div>
      </div>

      {/* Cards Principais */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        {[
          { label: 'Receita Total', val: totalRevenue, icon: Wallet, color: 'text-blue-500', bg: 'bg-blue-50' },
          { label: 'Entradas Manuais', val: manualIncomes, icon: TrendingUp, color: 'text-emerald-500', bg: 'bg-emerald-50' },
          { label: 'Saídas / Custos', val: totalCosts, icon: TrendingDown, color: 'text-red-500', bg: 'bg-red-50' },
          { label: 'Lucro Líquido', val: totalNetProfit, icon: Target, color: 'text-white', bg: 'bg-slate-900', dark: true },
        ].map((card, idx) => (
          <div key={idx} className={`${card.dark ? 'bg-slate-900 border-slate-800 shadow-xl shadow-slate-900/10' : 'bg-white border-slate-100 shadow-sm'} p-3 rounded-2xl border flex items-center gap-3`}>
            <div className={`w-8 h-8 ${card.dark ? 'bg-emerald-500' : card.bg} ${card.dark ? 'text-white' : card.color} rounded-xl flex items-center justify-center shrink-0`}>
              <card.icon size={16} />
            </div>
            <div className="min-w-0">
              <p className={`text-[7px] ${card.dark ? 'text-slate-500' : 'text-slate-400'} font-black uppercase tracking-widest mb-0.5 truncate`}>{card.label}</p>
              <p className={`text-xs font-black ${card.dark ? 'text-white' : 'text-slate-800'} truncate`}>{formatCurrency(card.val)}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Seção de Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className="bg-white p-4 rounded-3xl border border-slate-50 shadow-sm flex flex-col min-w-0">
          <div className="flex items-center gap-2 mb-3">
            <BarChart3 size={12} className="text-blue-500" />
            <h3 className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Lucratividade</h3>
          </div>
          <div className="w-full min-h-[180px] h-[180px] relative">
            <ResponsiveContainer width="100%" height="100%" debounce={50}>
              <BarChart data={chartData} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" fontSize={8} fontWeight="900" axisLine={false} tickLine={false} tick={{fill: '#94a3b8'}} />
                <YAxis fontSize={8} axisLine={false} tickLine={false} tick={{fill: '#94a3b8'}} />
                <Tooltip 
                  cursor={{fill: '#f8fafc'}}
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontSize: '10px', fontWeight: 'bold' }}
                />
                <Bar dataKey="value" radius={[4, 4, 0, 0]} barSize={25}>
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-4 rounded-3xl border border-slate-50 shadow-sm flex flex-col min-w-0">
          <div className="flex items-center gap-2 mb-3">
            <PieIcon size={12} className="text-emerald-500" />
            <h3 className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Origem de Receita</h3>
          </div>
          <div className="w-full min-h-[180px] h-[180px] relative">
            {sourceData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%" debounce={50}>
                <PieChart>
                  <Pie
                    data={sourceData}
                    cx="50%" cy="50%"
                    innerRadius={45}
                    outerRadius={65}
                    paddingAngle={5}
                    dataKey="value"
                    stroke="none"
                  >
                    {sourceData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontSize: '10px', fontWeight: 'bold' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center opacity-20">
                <p className="text-[8px] font-black uppercase">Sem Dados</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* LANÇAMENTOS MANUAIS */}
      <div className="bg-white rounded-[2rem] border border-slate-50 shadow-sm overflow-hidden flex flex-col">
        <div className="p-4 border-b border-slate-50 flex items-center justify-between bg-slate-50/20">
          <div className="flex items-center gap-2">
            <DollarSign size={14} className="text-slate-400" />
            <h3 className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Lançamentos Manuais</h3>
          </div>
        </div>
        <div className="divide-y divide-slate-50 max-h-[300px] overflow-y-auto">
          {transactions.length > 0 ? transactions.map((t) => (
            <div key={t.id} className="p-3 flex items-center justify-between hover:bg-slate-50/30 transition-colors">
              <div className="flex items-center gap-3 min-w-0">
                <div className={`w-8 h-8 ${t.type === 'entrada' ? 'bg-emerald-50 text-emerald-500' : 'bg-red-50 text-red-500'} rounded-lg flex items-center justify-center shrink-0`}>
                  {t.type === 'entrada' ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                </div>
                <div className="min-w-0">
                  <h4 className="text-[10px] font-black text-slate-700 uppercase truncate leading-tight">{t.description}</h4>
                  <div className="flex items-center gap-1.5">
                    <span className={`text-[7px] font-black uppercase tracking-tighter ${t.type === 'entrada' ? 'text-emerald-500' : 'text-red-500'}`}>{t.type}</span>
                    <span className="text-[7px] text-slate-300">•</span>
                    <span className="text-[7px] font-bold text-slate-400">{formatDate(t.date)}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <p className={`text-[10px] font-black ${t.type === 'entrada' ? 'text-emerald-600' : 'text-red-600'}`}>{t.type === 'entrada' ? '+' : '-'}{formatCurrency(t.amount)}</p>
                  <span className="text-[7px] font-black text-slate-400 uppercase">{t.paymentMethod}</span>
                </div>
                <button onClick={() => onDeleteTransaction(t.id)} className="p-2 text-slate-300 hover:text-red-500 bg-slate-50 rounded-xl active:scale-90">
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          )) : (
            <div className="p-10 text-center opacity-20">
              <p className="text-[9px] font-black uppercase tracking-[0.2em]">Nenhum lançamento manual</p>
            </div>
          )}
        </div>
      </div>

      {/* HISTÓRICO DE VENDAS */}
      <div className="bg-white rounded-[2rem] border border-slate-50 shadow-sm overflow-hidden flex flex-col">
        <div className="p-4 border-b border-slate-50 flex items-center justify-between bg-slate-50/20">
          <div className="flex items-center gap-2">
            <History size={14} className="text-slate-400" />
            <h3 className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Histórico de Vendas</h3>
          </div>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-300" size={12} />
            <input 
              type="text" 
              placeholder="BUSCAR ID OU ITEM..." 
              className="pl-8 pr-4 py-1.5 bg-white border border-slate-100 rounded-lg text-[8px] font-black uppercase outline-none focus:border-blue-500 w-40"
              value={saleSearch}
              onChange={e => setSaleSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="divide-y divide-slate-50 max-h-[400px] overflow-y-auto">
          {filteredSales.length > 0 ? filteredSales.map((sale, idx) => (
            <div key={sale.id} className="p-3 flex items-center justify-between hover:bg-slate-50/30 transition-colors">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 bg-emerald-50 text-emerald-500 rounded-lg flex items-center justify-center shrink-0">
                  <ShoppingBag size={16} />
                </div>
                <div className="min-w-0">
                  <h4 className="text-[10px] font-black text-slate-700 uppercase truncate leading-tight">{sale.productName}</h4>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[7px] font-black text-blue-500 uppercase tracking-tighter">ID: {sale.transactionId || 'N/A'}</span>
                    <span className="text-[7px] text-slate-300">•</span>
                    <span className="text-[7px] font-bold text-slate-400">{formatDate(sale.date)}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <p className="text-[10px] font-black text-slate-800">{formatCurrency(sale.finalPrice)}</p>
                  <span className="text-[7px] font-black text-slate-400 uppercase">{sale.paymentMethod}</span>
                </div>
                <button 
                  onClick={() => initiateCancelSale(sale)}
                  disabled={isCancelling === sale.id}
                  className="p-2 text-slate-300 hover:text-red-500 bg-slate-50 rounded-xl active:scale-90 disabled:opacity-50"
                >
                  {isCancelling === sale.id ? <Loader2 className="animate-spin" size={14} /> : <Trash2 size={14} />}
                </button>
              </div>
            </div>
          )) : (
            <div className="p-10 text-center opacity-20">
              <p className="text-[9px] font-black uppercase tracking-[0.2em]">Nenhuma venda encontrada</p>
            </div>
          )}
        </div>
      </div>

      {/* MODAL DE LANÇAMENTO MANUAL */}
      {isTransactionModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 z-[200] flex items-center justify-center p-6 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white w-full max-w-sm rounded-[2.5rem] overflow-hidden shadow-2xl animate-in zoom-in-95">
            <div className="p-6 border-b border-slate-50 flex justify-between items-center">
              <h3 className="font-black text-slate-800 text-sm uppercase tracking-widest">Novo Lançamento</h3>
              <button onClick={() => setIsTransactionModalOpen(false)} className="p-2 text-slate-400 bg-slate-50 rounded-full"><X size={16} /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => setNewTransaction({...newTransaction, type: 'entrada'})} className={`py-4 rounded-2xl text-[9px] font-black uppercase border transition-all flex items-center justify-center gap-2 ${newTransaction.type === 'entrada' ? 'bg-emerald-600 border-emerald-600 text-white shadow-lg' : 'bg-white border-slate-100 text-slate-400'}`}>
                  <TrendingUp size={14} /> Entrada
                </button>
                <button onClick={() => setNewTransaction({...newTransaction, type: 'saida'})} className={`py-4 rounded-2xl text-[9px] font-black uppercase border transition-all flex items-center justify-center gap-2 ${newTransaction.type === 'saida' ? 'bg-red-600 border-red-600 text-white shadow-lg' : 'bg-white border-slate-100 text-slate-400'}`}>
                  <TrendingDown size={14} /> Saída
                </button>
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Descrição</label>
                <input value={newTransaction.description} onChange={e => setNewTransaction({...newTransaction, description: e.target.value})} placeholder="Ex: Aluguel, Venda Avulsa..." className="w-full p-4 bg-slate-50 rounded-2xl outline-none font-bold text-xs uppercase" />
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Valor (R$)</label>
                <input type="number" value={newTransaction.amount || ''} onChange={e => setNewTransaction({...newTransaction, amount: Number(e.target.value)})} placeholder="0.00" className="w-full p-4 bg-slate-50 rounded-2xl outline-none font-black text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Categoria</label>
                  <select value={newTransaction.category} onChange={e => setNewTransaction({...newTransaction, category: e.target.value})} className="w-full p-4 bg-slate-50 rounded-2xl outline-none font-bold text-[10px] uppercase">
                    <option>Geral</option>
                    <option>Aluguel</option>
                    <option>Energia</option>
                    <option>Internet</option>
                    <option>Peças</option>
                    <option>Salários</option>
                    <option>Outros</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Pagamento</label>
                  <select value={newTransaction.paymentMethod} onChange={e => setNewTransaction({...newTransaction, paymentMethod: e.target.value})} className="w-full p-4 bg-slate-50 rounded-2xl outline-none font-bold text-[10px] uppercase">
                    <option>Dinheiro</option>
                    <option>Cartão</option>
                    <option>PIX</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="p-6 bg-slate-50 border-t border-slate-100 flex gap-3">
              <button onClick={() => setIsTransactionModalOpen(false)} className="flex-1 py-4 font-black text-slate-400 uppercase text-[9px] tracking-widest">Sair</button>
              <button onClick={handleSaveTransaction} disabled={isSavingTransaction} className="flex-[2] py-4 bg-slate-900 text-white rounded-2xl font-black uppercase text-[9px] tracking-widest shadow-xl active:scale-95 transition-all flex items-center justify-center">
                {isSavingTransaction ? <Loader2 className="animate-spin" size={16} /> : 'Confirmar Lançamento'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE AUTENTICAÇÃO PARA CANCELAMENTO */}
      {isAuthModalOpen && (
        <div className="fixed inset-0 bg-slate-950/90 z-[200] flex items-center justify-center p-6 backdrop-blur-xl animate-in fade-in">
           <div className="bg-white w-full max-w-xs rounded-[3rem] p-10 shadow-2xl animate-in zoom-in-95 border border-slate-100">
              <div className="w-20 h-20 bg-red-50 text-red-600 rounded-[2.5rem] flex items-center justify-center mx-auto mb-8 shadow-inner">
                 <Lock size={36} />
              </div>
              <h3 className="text-center font-black text-slate-800 uppercase text-sm mb-1">Autorização Requerida</h3>
              <p className="text-center text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-10 leading-tight">
                Insira a senha do administrador<br/>para cancelar esta venda
              </p>
              
              <div className={`flex items-center gap-3 bg-slate-50 border rounded-2xl px-5 py-5 mb-4 transition-all ${authError ? 'border-red-500 bg-red-50 ring-4 ring-red-100' : 'border-slate-100 focus-within:border-blue-500'}`}>
                 <KeyRound size={20} className={authError ? 'text-red-500' : 'text-slate-300'} />
                 <input 
                   type="password" 
                   autoFocus
                   value={passwordInput}
                   onChange={(e) => setPasswordInput(e.target.value)}
                   onKeyDown={(e) => e.key === 'Enter' && confirmCancellation()}
                   placeholder="SENHA DO ADM"
                   className="bg-transparent w-full outline-none font-black text-sm uppercase placeholder:text-slate-200"
                 />
              </div>
              
              {authError && <p className="text-center text-[9px] font-black text-red-500 uppercase mb-4 animate-bounce">Senha Incorreta!</p>}

              <div className="flex flex-col gap-2">
                 <button onClick={confirmCancellation} disabled={verifyingPassword} className="w-full py-5 bg-red-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl shadow-red-500/20 active:scale-95 transition-all flex items-center justify-center disabled:opacity-50">
                   {verifyingPassword ? <Loader2 size={18} className="animate-spin" /> : 'AUTORIZAR CANCELAMENTO'}
                 </button>
                 <button onClick={() => { setIsAuthModalOpen(false); setPasswordInput(''); setSelectedSaleToCancel(null); }} className="w-full py-4 text-slate-400 font-black uppercase text-[10px] tracking-widest">VOLTAR</button>
              </div>
           </div>
        </div>
      )}

      {/* Nota Informativa */}
      <div className="bg-slate-100/50 p-3 rounded-2xl border border-slate-200/50 flex items-center gap-3">
        <div className="w-7 h-7 bg-white shadow-sm text-slate-400 rounded-lg flex items-center justify-center shrink-0">
          <DollarSign size={14} />
        </div>
        <p className="text-[8px] text-slate-500 font-bold uppercase tracking-widest leading-normal">
          O cancelamento de venda <span className="text-red-600">reverte o estoque</span> automaticamente.<br/>
          As O.S. canceladas não são mostradas aqui por questões fiscais.
        </p>
      </div>
    </div>
  );
};

export default FinanceTab;
