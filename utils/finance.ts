import { ServiceOrder, Sale, Transaction } from '../types';
import { startOfMonth, endOfMonth, isWithinInterval, parseISO, differenceInDays, getDaysInMonth, subMonths, isSameMonth, startOfDay, endOfDay } from 'date-fns';

// --- Interfaces de Normalização ---

export interface FinancialTransaction {
  id: string;
  type: 'income' | 'expense';
  amount: number;
  cost: number; // Para cálculo de lucro
  date: Date;
  dueDate?: Date; // Data de vencimento
  description: string;
  category: string;
  source: 'os' | 'sale' | 'manual';
  status: 'paid' | 'pending' | 'overdue' | 'cancelled';
  installments?: { current: number; total: number };
  recurrence?: 'monthly' | 'yearly';
}

export interface FinancialSummary {
  revenue: {
    total: number;
    sales: Sale[];
    os: ServiceOrder[];
    manual: Transaction[];
  };
  costs: {
    total: number;
    sales: Sale[];
    os: ServiceOrder[];
  };
  expenses: {
    total: number;
    manual: Transaction[];
  };
  grossProfit: number;
  netProfit: number;
  margin: number;
  ticketAverage: number;
  projectedRevenue: number;
  healthScore: 'good' | 'warning' | 'critical';
  accountsPayable: { total: number; count: number; overdue: number };
  accountsReceivable: { total: number; count: number; overdue: number };
  previousMonthComparison: {
    revenueChange: number;
    profitChange: number;
  };
  topProducts: { name: string; profit: number; quantity: number }[];
  topServices: { name: string; profit: number; quantity: number }[];
}

// --- Hook Principal ---

export const useFinanceCalculations = (
  orders: ServiceOrder[],
  sales: Sale[],
  manualTransactions: Transaction[],
  periodStart: Date = startOfMonth(new Date()),
  periodEnd: Date = endOfMonth(new Date())
) => {

  // 1. Normalização de Dados (Unified Ledger)
  const normalizeData = (): FinancialTransaction[] => {
    const transactions: FinancialTransaction[] = [];

    // OS
    orders.forEach(os => {
      if (!os.isDeleted) {
        const isPaid = os.status === 'Entregue' || os.status === 'Concluído'; // Assumindo concluído como pago ou a receber
        transactions.push({
          id: os.id,
          type: 'income',
          amount: os.total,
          cost: os.partsCost,
          date: parseISO(os.date),
          description: `OS #${os.id} - ${os.deviceModel}`,
          category: 'Serviços',
          source: 'os',
          status: isPaid ? 'paid' : 'pending'
        });
      }
    });

    // Vendas
    sales.forEach(sale => {
      if (!sale.isDeleted) {
        transactions.push({
          id: sale.id,
          type: 'income',
          amount: sale.finalPrice,
          cost: sale.costAtSale,
          date: parseISO(sale.date),
          description: `Venda - ${sale.productName}`,
          category: 'Vendas',
          source: 'sale',
          status: 'paid' // Vendas balcão geralmente são à vista/pagas
        });
      }
    });

    // Manuais
    manualTransactions.forEach(t => {
      if (!t.isDeleted) {
        // Se o status bruto for 'paid', mantemos 'paid'. Caso contrário, verificamos atraso.
        let status: 'paid' | 'pending' | 'overdue' = t.status || 'paid';
        
        if (status !== 'paid') {
          // Auto-detect overdue apenas para pendentes
          if (t.dueDate && new Date(t.dueDate) < new Date()) {
            status = 'overdue';
          } else {
            status = 'pending';
          }
        }

        transactions.push({
          id: t.id,
          type: t.type === 'entrada' ? 'income' : 'expense',
          amount: t.amount,
          cost: 0,
          date: parseISO(t.date),
          dueDate: t.dueDate ? parseISO(t.dueDate) : undefined,
          description: t.description,
          category: t.category || 'Geral',
          source: 'manual',
          status: status,
          installments: t.installments,
          recurrence: t.recurrence
        });
      }
    });

    return transactions;
  };

  const allTransactions = normalizeData();

  // 2. Filtros
  const filterByPeriod = (start: Date, end: Date) => {
    return allTransactions.filter(t => isWithinInterval(t.date, { start: startOfDay(start), end: endOfDay(end) }));
  };

  const currentPeriodTransactions = filterByPeriod(periodStart, periodEnd);
  
  // Dados do Mês Anterior para Comparação
  const prevStart = startOfMonth(subMonths(periodStart, 1));
  const prevEnd = endOfMonth(subMonths(periodStart, 1));
  const prevMonthTransactions = filterByPeriod(prevStart, prevEnd);

  // 3. Cálculos Financeiros (DRE Simplificada)
  const calculateSummary = (transactions: FinancialTransaction[], prevTransactions: FinancialTransaction[]): FinancialSummary => {
    let revenueTotal = 0;
    const revenueSales: Sale[] = [];
    const revenueOS: ServiceOrder[] = [];
    const revenueManual: Transaction[] = [];
    let cmvTotal = 0;
    const cmvSales: Sale[] = [];
    const cmvOS: ServiceOrder[] = [];
    let expensesTotal = 0;
    const expensesManual: Transaction[] = [];
    let countSales = 0;

    // Contas a Pagar/Receber (Considera TODO o histórico, não só o período, pois pendência é acumulativa)
    // Mas para o dashboard, geralmente queremos ver o que vence no mês ou o total geral.
    // Vamos calcular o total geral pendente.
    let payableTotal = 0;
    let payableCount = 0;
    let payableOverdue = 0;
    let receivableTotal = 0;
    let receivableCount = 0;
    let receivableOverdue = 0;

    allTransactions.forEach(t => {
      if (t.status === 'pending' || t.status === 'overdue') {
        // Se tem parcelas, o total pendente desta "conta" é o valor da parcela * parcelas restantes
        const multiplier = t.installments ? (t.installments.total - t.installments.current + 1) : 1;
        const amountPending = t.amount * multiplier;

        if (t.type === 'expense') {
          payableTotal += amountPending;
          payableCount++;
          if (t.status === 'overdue') payableOverdue++;
        } else {
          receivableTotal += amountPending;
          receivableCount++;
          if (t.status === 'overdue') receivableOverdue++;
        }
      }
    });

    // Métricas do Período Atual
    transactions.forEach(t => {
      if (t.type === 'income' && t.status === 'paid') {
        revenueTotal += t.amount;
        cmvTotal += t.cost;
        if (t.source !== 'manual') countSales++;

        // Popula detalhes da receita e custos
        if (t.source === 'sale') {
          const sale = sales.find(s => s.id === t.id);
          if (sale) {
            revenueSales.push(sale);
            if (t.cost > 0) cmvSales.push(sale);
          }
        } else if (t.source === 'os') {
          const os = orders.find(o => o.id === t.id);
          if (os) {
            revenueOS.push(os);
            if (t.cost > 0) cmvOS.push(os);
          }
        } else if (t.source === 'manual') {
          const manual = manualTransactions.find(mt => mt.id === t.id);
          if (manual) revenueManual.push(manual);
        }
      } else if (t.type === 'expense' && t.status === 'paid') {
        expensesTotal += t.amount;
        if (t.source === 'manual') {
          const manual = manualTransactions.find(mt => mt.id === t.id);
          if (manual) expensesManual.push(manual);
        }
      }
    });

    const grossProfit = revenueTotal - cmvTotal;
    const netProfit = grossProfit - expensesTotal;
    const margin = revenueTotal > 0 ? (netProfit / revenueTotal) * 100 : 0;
    const ticketAverage = countSales > 0 ? revenueTotal / countSales : 0;

    // Métricas do Mês Anterior
    let prevRevenue = 0;
    let prevExpenses = 0;
    let prevCmv = 0;
    
    prevTransactions.forEach(t => {
      if (t.type === 'income' && t.status === 'paid') {
        prevRevenue += t.amount;
        prevCmv += t.cost;
      } else if (t.type === 'expense' && t.status === 'paid') {
        prevExpenses += t.amount;
      }
    });
    const prevNetProfit = (prevRevenue - prevCmv) - prevExpenses;

    // Variação %
    const revenueChange = prevRevenue > 0 ? ((revenueTotal - prevRevenue) / prevRevenue) * 100 : 0;
    const profitChange = prevNetProfit !== 0 ? ((netProfit - prevNetProfit) / Math.abs(prevNetProfit)) * 100 : 0;

    // 4. Inteligência: Projeção Linear (Apenas se estivermos vendo o mês atual)
    const isCurrentMonth = isSameMonth(periodStart, new Date());
    const daysInMonth = getDaysInMonth(periodStart);
    const daysPassed = isCurrentMonth ? Math.min(differenceInDays(new Date(), startOfMonth(periodStart)) + 1, daysInMonth) : daysInMonth;
    
    const projectedRevenue = isCurrentMonth && daysPassed > 1 
      ? (revenueTotal / daysPassed) * daysInMonth 
      : revenueTotal;

    // 5. Inteligência: Score de Saúde
    let healthScore: 'good' | 'warning' | 'critical' = 'good';
    if (netProfit < 0 || margin < 5) healthScore = 'critical';
    else if (margin < 20) healthScore = 'warning';

    // 6. Top Produtos e Serviços
    const productMap = new Map<string, { profit: number; qty: number }>();
    const serviceMap = new Map<string, { profit: number; qty: number }>();

    transactions.forEach(t => {
      if (t.type === 'income' && t.status === 'paid') {
        const profit = t.amount - t.cost;
        if (t.source === 'sale') {
           const name = t.description.replace('Venda - ', '');
           const current = productMap.get(name) || { profit: 0, qty: 0 };
           productMap.set(name, { profit: current.profit + profit, qty: current.qty + 1 });
        } else if (t.source === 'os') {
           const name = t.description.split(' - ')[1] || 'Serviço Geral';
           const current = serviceMap.get(name) || { profit: 0, qty: 0 };
           serviceMap.set(name, { profit: current.profit + profit, qty: current.qty + 1 });
        }
      }
    });

    const topProducts = Array.from(productMap.entries())
      .map(([name, data]) => ({ name, profit: data.profit, quantity: data.qty }))
      .sort((a, b) => b.profit - a.profit)
      .slice(0, 5);

    const topServices = Array.from(serviceMap.entries())
      .map(([name, data]) => ({ name, profit: data.profit, quantity: data.qty }))
      .sort((a, b) => b.profit - a.profit)
      .slice(0, 5);

    return {
      revenue: {
        total: revenueTotal,
        sales: revenueSales,
        os: revenueOS,
        manual: revenueManual
      },
      costs: {
        total: cmvTotal,
        sales: cmvSales,
        os: cmvOS
      },
      expenses: {
        total: expensesTotal,
        manual: expensesManual
      },
      grossProfit,
      netProfit,
      margin,
      ticketAverage,
      projectedRevenue,
      healthScore,
      accountsPayable: { total: payableTotal, count: payableCount, overdue: payableOverdue },
      accountsReceivable: { total: receivableTotal, count: receivableCount, overdue: receivableOverdue },
      previousMonthComparison: { revenueChange, profitChange },
      topProducts,
      topServices
    };
  };

  return {
    transactions: currentPeriodTransactions,
    allTransactions,
    summary: calculateSummary(currentPeriodTransactions, prevMonthTransactions)
  };
};
