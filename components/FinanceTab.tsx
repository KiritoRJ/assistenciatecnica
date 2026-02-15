
import React from 'react';
import { TrendingUp, TrendingDown, DollarSign, ShoppingBag, ClipboardList } from 'lucide-react';
import { ServiceOrder, Sale } from '../types';
import { formatCurrency } from '../utils';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie } from 'recharts';

interface Props {
  orders: ServiceOrder[];
  sales: Sale[];
}

const FinanceTab: React.FC<Props> = ({ orders, sales }) => {
  const deliveredOrders = orders.filter(order => order.status === 'Entregue');
  const totalOSRevenue = deliveredOrders.reduce((acc, curr) => acc + curr.total, 0);
  const totalOSPartsCost = deliveredOrders.reduce((acc, curr) => acc + curr.partsCost, 0);
  const totalOSProfit = deliveredOrders.reduce((acc, curr) => acc + curr.serviceCost, 0);

  const totalSalesRevenue = sales.reduce((acc, curr) => acc + curr.finalPrice, 0);
  const totalSalesCost = sales.reduce((acc, curr) => acc + (curr.costAtSale * curr.quantity), 0);
  const totalSalesProfit = totalSalesRevenue - totalSalesCost;

  const totalNetProfit = totalOSProfit + totalSalesProfit;
  const totalOverallRevenue = totalOSRevenue + totalSalesRevenue;

  const chartData = [
    { name: 'Lucro OS', value: totalOSProfit, color: '#3b82f6' },
    { name: 'Lucro Vendas', value: totalSalesProfit, color: '#10b981' },
    { name: 'Líquido Total', value: totalNetProfit, color: '#8b5cf6' },
  ];

  const sourceData = [
    { name: 'O.S.', value: totalOSRevenue },
    { name: 'Vendas', value: totalSalesRevenue },
  ].filter(d => d.value > 0);

  const COLORS = ['#3b82f6', '#10b981'];

  return (
    <div className="space-y-6 pb-6" style={{ minWidth: 0 }}>
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-black text-slate-800">Financeiro</h2>
        <div className="bg-emerald-50 text-emerald-700 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border border-emerald-100 flex items-center gap-2">
          <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
          Dados em tempo real
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100 flex items-center gap-4">
          <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center shrink-0">
            <ClipboardList size={22} />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] text-slate-400 font-black uppercase tracking-wider">Receita O.S.</p>
            <p className="text-lg font-black text-slate-800 truncate">{formatCurrency(totalOSRevenue)}</p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100 flex items-center gap-4">
          <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center shrink-0">
            <ShoppingBag size={22} />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] text-slate-400 font-black uppercase tracking-wider">Vendas Balcão</p>
            <p className="text-lg font-black text-slate-800 truncate">{formatCurrency(totalSalesRevenue)}</p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100 flex items-center gap-4">
          <div className="w-12 h-12 bg-red-50 text-red-600 rounded-2xl flex items-center justify-center shrink-0">
            <TrendingDown size={22} />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] text-slate-400 font-black uppercase tracking-wider">Total Custos</p>
            <p className="text-lg font-black text-slate-800 truncate">{formatCurrency(totalOSPartsCost + totalSalesCost)}</p>
          </div>
        </div>

        <div className="bg-slate-900 p-5 rounded-3xl shadow-xl shadow-emerald-900/10 flex items-center gap-4 ring-2 ring-emerald-500/20">
          <div className="w-12 h-12 bg-emerald-500 text-white rounded-2xl flex items-center justify-center shrink-0 shadow-lg shadow-emerald-500/30">
            <TrendingUp size={22} />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] text-emerald-400 font-black uppercase tracking-wider">Lucro Líquido</p>
            <p className="text-xl font-black text-white truncate">{formatCurrency(totalNetProfit)}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6" style={{ minWidth: 0 }}>
        <div className="bg-white p-6 rounded-[40px] shadow-sm border border-slate-100 min-h-[400px]" style={{ minWidth: 0 }}>
          <h3 className="text-xs font-black text-slate-800 mb-8 uppercase tracking-[0.2em] border-l-4 border-blue-500 pl-4">Distribuição de Lucro</h3>
          <div className="h-72 w-full" style={{ minWidth: 0 }}>
            <ResponsiveContainer width="100%" height="100%" minHeight={280}>
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" stroke="#cbd5e1" fontSize={10} fontWeight="900" axisLine={false} tickLine={false} />
                <YAxis stroke="#cbd5e1" fontSize={10} axisLine={false} tickLine={false} tickFormatter={(val) => `R$ ${val}`} />
                <Tooltip 
                  formatter={(value: number) => formatCurrency(value)}
                  contentStyle={{ borderRadius: '20px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)', fontWeight: 'bold' }}
                  cursor={{ fill: '#f8fafc' }}
                />
                <Bar dataKey="value" radius={[12, 12, 0, 0]} barSize={45}>
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-6 rounded-[40px] shadow-sm border border-slate-100 min-h-[400px]" style={{ minWidth: 0 }}>
          <h3 className="text-xs font-black text-slate-800 mb-8 uppercase tracking-[0.2em] border-l-4 border-emerald-500 pl-4">Origem do Faturamento</h3>
          <div className="h-72 w-full flex items-center justify-center" style={{ minWidth: 0 }}>
            {sourceData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%" minHeight={280}>
                <PieChart>
                  <Pie
                    data={sourceData}
                    cx="50%"
                    cy="50%"
                    innerRadius={70}
                    outerRadius={100}
                    paddingAngle={10}
                    dataKey="value"
                    stroke="none"
                  >
                    {sourceData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(value: number) => formatCurrency(value)}
                    contentStyle={{ borderRadius: '20px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)', fontWeight: 'bold' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-center">
                <p className="text-slate-300 italic text-sm font-bold uppercase tracking-widest">Sem movimentações</p>
              </div>
            )}
          </div>
          <div className="flex justify-center gap-6 mt-2">
            {sourceData.map((d, i) => (
              <div key={d.name} className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[i] }} />
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{d.name} ({Math.round((d.value/totalOverallRevenue)*100)}%)</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      
      <div className="bg-white p-6 rounded-3xl border border-slate-100 flex items-center gap-4">
        <div className="w-10 h-10 bg-slate-50 text-slate-400 rounded-full flex items-center justify-center shrink-0">
          <DollarSign size={20} />
        </div>
        <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest leading-relaxed">
          Os valores de O.S. são processados apenas quando finalizados como "Entregue". <br/>
          Vendas diretas são contabilizadas instantaneamente após a confirmação.
        </p>
      </div>
    </div>
  );
};

export default FinanceTab;
