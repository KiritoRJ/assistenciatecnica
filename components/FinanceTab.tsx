
import React, { useState, useMemo, useEffect } from 'react';
import { TrendingUp, TrendingDown, DollarSign, ShoppingBag, ClipboardList, Target, Zap, ArrowUpRight, History, BarChart3, PieChart as PieIcon, Search, Trash2, AlertCircle, Loader2, Lock, KeyRound, X, Plus, Minus, Wallet, FileText, User as UserIcon, Printer } from 'lucide-react';
import { ServiceOrder, Sale, Product, Transaction, AppSettings, User } from '../types';
import { formatCurrency, formatDate } from '../utils';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie } from 'recharts';
import { OnlineDB } from '../utils/api';
import { jsPDF } from 'jspdf';

interface Props {
  orders: ServiceOrder[];
  sales: Sale[];
  products: Product[];
  transactions: Transaction[];
  setTransactions: (transactions: Transaction[]) => Promise<void>;
  onDeleteTransaction: (id: string) => Promise<void>;
  onDeleteSale: (sale: Sale) => Promise<void>;
  tenantId: string;
  settings: AppSettings;
}

const FinanceTab: React.FC<Props> = ({ orders, sales, products, transactions, setTransactions, onDeleteTransaction, onDeleteSale, tenantId, settings }) => {
  const [saleSearch, setSaleSearch] = useState('');
  const [isCancelling, setIsCancelling] = useState<string | null>(null);
  
  // Estados para Modal de Senha
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [verifyingPassword, setVerifyingPassword] = useState(false);
  const [authError, setAuthError] = useState(false);
  const [selectedSaleToCancel, setSelectedSaleToCancel] = useState<Sale | null>(null);

  // Estados para Confirmação de Exclusão Manual
  const [transactionToDelete, setTransactionToDelete] = useState<string | null>(null);

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

  // Estados para Relatório
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [selectedReportUser, setSelectedReportUser] = useState<string>('all');
  const [selectedPeriod, setSelectedPeriod] = useState<'dia' | 'semana' | 'mes' | '3meses'>('dia');
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);

  // Limpeza automática ao carregar (Remove dados com mais de 3 meses)
  useEffect(() => {
    if (tenantId) {
      OnlineDB.cleanupOldData(tenantId);
    }
  }, [tenantId]);

  // Filtros para o Dashboard (Apenas não deletados)
  const activeOrders = useMemo(() => orders.filter(o => !o.isDeleted), [orders]);
  const activeSales = useMemo(() => sales.filter(s => !s.isDeleted), [sales]);
  const activeTransactions = useMemo(() => transactions.filter(t => !t.isDeleted), [transactions]);

  const deliveredOrders = activeOrders.filter(order => order.status === 'Entregue');
  
  // Cálculos de O.S.
  const totalOSRevenue = deliveredOrders.reduce((acc, curr) => acc + curr.total, 0);
  const totalOSPartsCost = deliveredOrders.reduce((acc, curr) => acc + curr.partsCost, 0);
  const totalOSProfit = deliveredOrders.reduce((acc, curr) => acc + curr.serviceCost, 0);

  // Cálculos de Vendas
  const totalSalesRevenue = activeSales.reduce((acc, curr) => acc + curr.finalPrice, 0);
  const totalSalesCost = activeSales.reduce((acc, curr) => acc + (curr.costAtSale * curr.quantity), 0);
  const totalSalesProfit = totalSalesRevenue - totalSalesCost;

  // Cálculos de Transações Manuais
  const manualIncomes = activeTransactions.filter(t => t.type === 'entrada').reduce((acc, curr) => acc + curr.amount, 0);
  const manualExpenses = activeTransactions.filter(t => t.type === 'saida').reduce((acc, curr) => acc + curr.amount, 0);

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
  const filteredSales = activeSales.filter(s => 
    (s.transactionId && s.transactionId.toLowerCase().includes(saleSearch.toLowerCase())) ||
    (s.productName && s.productName.toLowerCase().includes(saleSearch.toLowerCase()))
  );

  const handleGenerateReport = async () => {
    setIsGeneratingReport(true);
    try {
      const doc = new jsPDF({
        unit: 'mm',
        format: [58, 600] // Formato térmico 58mm (aumentado para caber mais dados)
      });

      const margin = 2;
      let y = 10;
      const pageWidth = 58;

      const userFilter = selectedReportUser === 'all' ? null : selectedReportUser;

      // Cálculo de datas para o filtro
      const now = new Date();
      const filterDate = new Date();
      if (selectedPeriod === 'dia') filterDate.setHours(0, 0, 0, 0);
      else if (selectedPeriod === 'semana') filterDate.setDate(now.getDate() - 7);
      else if (selectedPeriod === 'mes') filterDate.setMonth(now.getMonth() - 1);
      else if (selectedPeriod === '3meses') filterDate.setMonth(now.getMonth() - 3);

      const isWithinPeriod = (dateStr: string) => {
        const d = new Date(dateStr);
        return d >= filterDate;
      };

      // 1. Identificação do Perfil (Primeiro Item)
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.text('PERFIL:', margin, y);
      doc.setFont('helvetica', 'normal');
      doc.text(selectedReportUser.toUpperCase(), margin + 12, y);
      y += 6;

      // Header da Loja
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text(settings.storeName.toUpperCase(), pageWidth / 2, y, { align: 'center' });
      y += 5;
      doc.setFontSize(7);
      doc.setFont('helvetica', 'normal');
      doc.text('RELATORIO FINANCEIRO DETALHADO', pageWidth / 2, y, { align: 'center' });
      y += 4;
      doc.text(`PERIODO: ${selectedPeriod === 'dia' ? 'HOJE' : selectedPeriod === 'semana' ? 'ULTIMOS 7 DIAS' : selectedPeriod === 'mes' ? 'ULTIMOS 30 DIAS' : 'ULTIMOS 90 DIAS'}`, pageWidth / 2, y, { align: 'center' });
      y += 4;
      doc.text(`GERADO EM: ${new Date().toLocaleString('pt-BR')}`, pageWidth / 2, y, { align: 'center' });
      y += 6;
      doc.line(margin, y - 1, pageWidth - margin, y - 1);
      y += 4;
      
      // Filtros de dados para o relatório (INCLUINDO DELETADOS)
      const reportSales = sales.filter(s => (!userFilter || s.sellerName === userFilter) && isWithinPeriod(s.date));
      const reportOrders = orders.filter(o => isWithinPeriod(o.date)); 
      const reportTransactions = transactions.filter(t => isWithinPeriod(t.date));

      // Seção de Lançamentos Manuais
      const selectedUserObj = settings.users.find(u => u.name === selectedReportUser);
      const showManualTransactions = selectedReportUser === 'all' || (selectedUserObj && selectedUserObj.role === 'admin');

      if (showManualTransactions) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7);
        doc.text('LANCAMENTOS MANUAIS', margin, y);
        y += 4;
        doc.line(margin, y - 1, pageWidth - margin, y - 1);
        y += 2;
        doc.setFontSize(6);

        if (reportTransactions.length === 0) {
          doc.text('NENHUM LANCAMENTO', margin, y);
          y += 4;
        }

        reportTransactions.forEach(t => {
          const status = t.isDeleted ? '[CANCELADO]' : '[ATIVO]';
          const typeLabel = t.type === 'entrada' ? '(+) ENTRADA' : '(-) SAIDA';
          const dateStr = new Date(t.date).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
          
          doc.setFont('helvetica', 'bold');
          doc.text(`${dateStr} ${status}`, margin, y);
          y += 3;
          doc.setFont('helvetica', 'normal');
          doc.text(`${typeLabel}: ${t.description.substring(0, 20)}`, margin, y);
          doc.text(`${formatCurrency(t.amount)}`, pageWidth - margin, y, { align: 'right' });
          y += 4;
          if (y > 580) { doc.addPage(); y = 10; }
        });

        y += 4;
      }
      // Seção de Vendas
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.text('VENDAS (LOJA)', margin, y);
      y += 4;
      doc.line(margin, y - 1, pageWidth - margin, y - 1);
      y += 2;
      doc.setFontSize(6);

      if (reportSales.length === 0) {
        doc.text('NENHUMA VENDA ENCONTRADA', margin, y);
        y += 4;
      }

      reportSales.forEach(s => {
        const status = s.isDeleted ? '[CANCELADA]' : '[OK]';
        const dateStr = new Date(s.date).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
        doc.setFont('helvetica', 'bold');
        doc.text(`${dateStr} ${status}`, margin, y);
        y += 3;
        doc.setFont('helvetica', 'normal');
        doc.text(`${s.productName.substring(0, 28)}`, margin, y);
        doc.text(`${formatCurrency(s.finalPrice)}`, pageWidth - margin, y, { align: 'right' });
        y += 4;
        if (y > 580) { doc.addPage(); y = 10; }
      });

      y += 4;
      // Seção de O.S.
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.text('ORDENS DE SERVICO', margin, y);
      y += 4;
      doc.line(margin, y - 1, pageWidth - margin, y - 1);
      y += 2;
      doc.setFontSize(6);

      reportOrders.forEach(o => {
        const status = o.isDeleted ? '[CANCELADA]' : `[${o.status.toUpperCase()}]`;
        const entryStr = new Date(o.date).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
        
        doc.setFont('helvetica', 'bold');
        doc.text(`${entryStr} ${status}`, margin, y);
        y += 3;
        doc.setFont('helvetica', 'normal');
        doc.text(`ID: ${o.id.substring(0, 8)} - ${o.customerName.substring(0, 15)}`, margin, y);
        y += 3;
        doc.text(`APARELHO: ${o.deviceModel.substring(0, 25)}`, margin, y);
        y += 3;
        if (o.exitDate) {
          doc.setFontSize(5);
          doc.text(`SAIDA: ${o.exitDate}`, margin, y);
          y += 3;
          doc.setFontSize(6);
        }
        doc.text(`PECAS: ${formatCurrency(o.partsCost)}`, margin, y);
        doc.text(`TOTAL: ${formatCurrency(o.total)}`, pageWidth - margin, y, { align: 'right' });
        y += 5;
        if (y > 580) { doc.addPage(); y = 10; }
      });

      y += 4;
      // Totais do Relatório
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.text('RESUMO FINANCEIRO', pageWidth / 2, y, { align: 'center' });
      y += 5;
      
      const totalSales = reportSales.filter(s => !s.isDeleted).reduce((a, b) => a + b.finalPrice, 0);
      const totalSalesCost = reportSales.filter(s => !s.isDeleted).reduce((a, b) => a + (b.costAtSale * b.quantity), 0);
      
      const totalOS = reportOrders.filter(o => !o.isDeleted && o.status === 'Entregue').reduce((a, b) => a + b.total, 0);
      const totalOSCost = reportOrders.filter(o => !o.isDeleted && o.status === 'Entregue').reduce((a, b) => a + b.partsCost, 0);
      
      const totalManualIn = reportTransactions.filter(t => !t.isDeleted && t.type === 'entrada').reduce((a, b) => a + b.amount, 0);
      const totalManualOut = reportTransactions.filter(t => !t.isDeleted && t.type === 'saida').reduce((a, b) => a + b.amount, 0);

      const totalRevenue = totalSales + totalOS + totalManualIn;
      const totalCosts = totalSalesCost + totalOSCost + totalManualOut;
      const netProfit = totalRevenue - totalCosts;

      doc.setFontSize(7);
      doc.setFont('helvetica', 'normal');
      doc.text('VENDAS OK:', margin, y);
      doc.text(formatCurrency(totalSales), pageWidth - margin, y, { align: 'right' });
      y += 4;
      doc.text('O.S. ENTREGUES:', margin, y);
      doc.text(formatCurrency(totalOS), pageWidth - margin, y, { align: 'right' });
      y += 4;
      doc.text('ENTRADAS MANUAIS:', margin, y);
      doc.text(formatCurrency(totalManualIn), pageWidth - margin, y, { align: 'right' });
      y += 4;
      doc.line(margin, y - 1, pageWidth - margin, y - 1);
      y += 4;
      doc.setFont('helvetica', 'bold');
      doc.text('TOTAL RECEITA:', margin, y);
      doc.text(formatCurrency(totalRevenue), pageWidth - margin, y, { align: 'right' });
      y += 5;
      doc.setFont('helvetica', 'normal');
      doc.text('CUSTOS TOTAIS:', margin, y);
      doc.text(formatCurrency(totalCosts), pageWidth - margin, y, { align: 'right' });
      y += 5;
      doc.setFont('helvetica', 'bold');
      doc.text('LUCRO LIQUIDO:', margin, y);
      doc.text(formatCurrency(netProfit), pageWidth - margin, y, { align: 'right' });
      y += 8;
      
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6);
      const canceledSalesCount = reportSales.filter(s => s.isDeleted).length;
      const canceledOSCount = reportOrders.filter(o => o.isDeleted).length;
      doc.text(`CANCELAMENTOS: ${canceledSalesCount} VENDAS / ${canceledOSCount} O.S.`, pageWidth / 2, y, { align: 'center' });
      
      y += 10;
      doc.text('--------------------------', pageWidth / 2, y, { align: 'center' });
      y += 4;
      doc.text('FIM DO RELATORIO', pageWidth / 2, y, { align: 'center' });

      doc.save(`Relatorio_${selectedReportUser}_${new Date().getTime()}.pdf`);
      setIsReportModalOpen(false);
    } catch (e) {
      console.error(e);
      alert('Erro ao gerar PDF');
    } finally {
      setIsGeneratingReport(false);
    }
  };

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
          <button onClick={() => setIsReportModalOpen(true)} className="bg-blue-600 text-white px-3 py-1.5 rounded-lg text-[8px] font-black uppercase tracking-widest flex items-center gap-1.5 shadow-lg active:scale-95 transition-all">
            <FileText size={12} />
            Relatório
          </button>
          <button onClick={() => setIsTransactionModalOpen(true)} className="bg-slate-900 text-white px-3 py-1.5 rounded-lg text-[8px] font-black uppercase tracking-widest flex items-center gap-1.5 shadow-lg active:scale-95 transition-all">
            <Plus size={12} />
            Lançamento
          </button>
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
          {activeTransactions.length > 0 ? activeTransactions.map((t) => (
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
                <button 
                  onClick={() => setTransactionToDelete(t.id)} 
                  className="p-2 text-slate-300 hover:text-red-500 bg-slate-50 rounded-xl active:scale-90"
                >
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



      {/* MODAL DE RELATÓRIO COMPLETO */}
      {isReportModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 z-[200] flex items-center justify-center p-6 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white w-full max-w-sm rounded-[2.5rem] overflow-hidden shadow-2xl animate-in zoom-in-95">
            <div className="p-6 border-b border-slate-50 flex justify-between items-center">
              <h3 className="font-black text-slate-800 text-sm uppercase tracking-widest">Relatório Completo</h3>
              <button onClick={() => setIsReportModalOpen(false)} className="p-2 text-slate-400 bg-slate-50 rounded-full"><X size={16} /></button>
            </div>
            <div className="p-6 space-y-6">
              <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto">
                <Printer size={32} />
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Filtrar por Perfil</label>
                <div className="flex items-center gap-3 bg-slate-50 border border-slate-100 rounded-2xl px-4 py-4">
                  <UserIcon size={16} className="text-slate-300" />
                  <select 
                    value={selectedReportUser} 
                    onChange={e => setSelectedReportUser(e.target.value)}
                    className="bg-transparent w-full outline-none font-bold text-xs uppercase"
                  >
                    <option value="all">TODOS OS PERFIS</option>
                    {settings.users.map(u => (
                      <option key={u.id} value={u.name}>{u.name.toUpperCase()}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Período do Relatório</label>
                <div className="grid grid-cols-2 gap-2">
                  {(['dia', 'semana', 'mes', '3meses'] as const).map(p => (
                    <button 
                      key={p}
                      onClick={() => setSelectedPeriod(p)}
                      className={`py-3 rounded-xl text-[8px] font-black uppercase border transition-all ${selectedPeriod === p ? 'bg-blue-600 border-blue-600 text-white shadow-lg' : 'bg-white border-slate-100 text-slate-400'}`}
                    >
                      {p === 'dia' ? 'Hoje' : p === 'semana' ? '7 Dias' : p === 'mes' ? '30 Dias' : '90 Dias'}
                    </button>
                  ))}
                </div>
              </div>

              <p className="text-[9px] text-slate-400 font-bold text-center uppercase leading-relaxed">
                Este relatório inclui vendas concluídas, canceladas,<br/>
                O.S. abertas, fechadas e lançamentos manuais.<br/>
                <span className="text-blue-600">Otimizado para impressora térmica 58mm.</span>
              </p>
            </div>
            <div className="p-6 bg-slate-50 border-t border-slate-100 flex gap-3">
              <button onClick={() => setIsReportModalOpen(false)} className="flex-1 py-4 font-black text-slate-400 uppercase text-[9px] tracking-widest">Sair</button>
              <button onClick={handleGenerateReport} disabled={isGeneratingReport} className="flex-[2] py-4 bg-blue-600 text-white rounded-2xl font-black uppercase text-[9px] tracking-widest shadow-xl active:scale-95 transition-all flex items-center justify-center gap-2">
                {isGeneratingReport ? <Loader2 className="animate-spin" size={16} /> : <><Printer size={16} /> Gerar PDF</>}
              </button>
            </div>
          </div>
        </div>
      )}

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

      {/* MODAL DE CONFIRMAÇÃO DE EXCLUSÃO MANUAL */}
      {transactionToDelete && (
        <div className="fixed inset-0 bg-slate-950/80 z-[300] flex items-center justify-center p-6 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white w-full max-w-xs rounded-[2rem] overflow-hidden shadow-2xl animate-in zoom-in-95">
            <div className="p-8 text-center space-y-4">
              <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-2">
                <AlertCircle size={32} />
              </div>
              <h3 className="font-black text-slate-800 uppercase text-sm">Cancelar Lançamento?</h3>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest leading-relaxed">
                Esta ação irá remover o registro do financeiro atual.
              </p>
              <div className="flex gap-2 pt-2">
                <button 
                  onClick={() => setTransactionToDelete(null)} 
                  className="flex-1 py-4 bg-slate-100 text-slate-500 rounded-xl font-black text-[9px] uppercase tracking-widest"
                >
                  Voltar
                </button>
                <button 
                  onClick={() => { 
                    onDeleteTransaction(transactionToDelete); 
                    setTransactionToDelete(null); 
                  }} 
                  className="flex-1 py-4 bg-red-600 text-white rounded-xl font-black text-[9px] uppercase tracking-widest shadow-lg shadow-red-500/20"
                >
                  Confirmar
                </button>
              </div>
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

    </div>
  );
};

export default FinanceTab;
