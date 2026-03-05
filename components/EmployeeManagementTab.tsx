import React, { useState, useEffect, useMemo } from 'react';
import { User, Plus, Edit2, Trash2, DollarSign, TrendingUp, Award, Shield, Save, X, Search, ChevronRight, Briefcase, Percent, BarChart3, PieChart, Settings, Target, Zap, Filter, CheckCircle2, AlertCircle } from 'lucide-react';
import { OnlineDB } from '../utils/api';
import { Employee, CommissionRule, CommissionLog, GoalTier, Product } from '../types';
import { formatCurrency } from '../utils';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart as RePieChart, Pie, Cell } from 'recharts';

interface Props {
  tenantId: string;
}

const EmployeeManagementTab: React.FC<Props> = ({ tenantId }) => {
  const [activeTab, setActiveTab] = useState<'employees' | 'rules' | 'commissions' | 'dashboard'>('dashboard');
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [rules, setRules] = useState<CommissionRule[]>([]);
  const [goalTiers, setGoalTiers] = useState<GoalTier[]>([]);
  const [logs, setLogs] = useState<CommissionLog[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Modal States
  const [isEmployeeModalOpen, setIsEmployeeModalOpen] = useState(false);
  const [isRuleModalOpen, setIsRuleModalOpen] = useState(false);
  const [isGoalModalOpen, setIsGoalModalOpen] = useState(false);
  
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [editingRule, setEditingRule] = useState<CommissionRule | null>(null);
  const [editingGoal, setEditingGoal] = useState<GoalTier | null>(null);
  
  // Form States
  const [formData, setFormData] = useState<Partial<Employee>>({
    role: 'vendedor',
    status: 'active',
    commissionType: 'sales_percent',
    permissions: { open_os: true, sell: true, view_finance: false, edit_price: false, cancel_sale: false }
  });

  const [ruleFormData, setRuleFormData] = useState<Partial<CommissionRule>>({
    targetType: 'global',
    ruleType: 'percent',
    calculationBase: 'gross_sale',
    value: 0,
    priority: 1,
    isActive: true
  });

  const [goalFormData, setGoalFormData] = useState<Partial<GoalTier>>({
    bonusType: 'fixed',
    calculationBase: 'gross_sale',
    minAmount: 0,
    bonusValue: 0
  });

  useEffect(() => {
    loadData();
  }, [tenantId]);

  const loadData = async () => {
    setIsLoading(true);
    const [emps, rls, lgs, tiers, prods] = await Promise.all([
      OnlineDB.fetchEmployees(tenantId),
      OnlineDB.fetchCommissionRules(tenantId),
      OnlineDB.fetchCommissionLogs(tenantId),
      OnlineDB.fetchGoalTiers(tenantId),
      OnlineDB.fetchProducts(tenantId)
    ]);
    setEmployees(emps.filter(e => e.role !== 'administrador'));
    setRules(rls);
    setLogs(lgs);
    setGoalTiers(tiers);
    setProducts(prods);
    
    // Extract unique categories
    const cats = Array.from(new Set(prods.map(p => (p as any).category).filter(Boolean))) as string[];
    setCategories(cats);
    
    setIsLoading(false);
  };

  const handleSaveRule = async () => {
    if (!ruleFormData.name) return alert('Nome da regra é obrigatório');
    const result = await OnlineDB.upsertCommissionRule(tenantId, ruleFormData);
    if (result.success) {
      setIsRuleModalOpen(false);
      loadData();
    } else {
      alert('Erro ao salvar regra');
    }
  };

  const handleDeleteRule = async (id: string) => {
    if (!confirm('Deseja excluir esta regra?')) return;
    const result = await OnlineDB.deleteCommissionRule(id);
    if (result.success) loadData();
  };

  const handleSaveGoal = async () => {
    if (!goalFormData.name) return alert('Nome da meta é obrigatório');
    const result = await OnlineDB.upsertGoalTier(tenantId, goalFormData);
    if (result.success) {
      setIsGoalModalOpen(false);
      loadData();
    } else {
      alert('Erro ao salvar meta');
    }
  };

  const handleDeleteGoal = async (id: string) => {
    if (!confirm('Deseja excluir esta meta?')) return;
    const result = await OnlineDB.deleteGoalTier(id);
    if (result.success) loadData();
  };

  const openRuleModal = (rule?: CommissionRule) => {
    if (rule) {
      setEditingRule(rule);
      setRuleFormData(rule);
    } else {
      setEditingRule(null);
      setRuleFormData({
        targetType: 'global',
        ruleType: 'percent',
        calculationBase: 'gross_sale',
        value: 0,
        priority: 1,
        isActive: true
      });
    }
    setIsRuleModalOpen(true);
  };

  const openGoalModal = (goal?: GoalTier) => {
    if (goal) {
      setEditingGoal(goal);
      setGoalFormData(goal);
    } else {
      setEditingGoal(null);
      setGoalFormData({
        bonusType: 'fixed',
        calculationBase: 'gross_sale',
        minAmount: 0,
        bonusValue: 0
      });
    }
    setIsGoalModalOpen(true);
  };

  const openEditModal = (emp: Employee) => {
    setEditingEmployee(emp);
    setFormData(emp);
    setIsEmployeeModalOpen(true);
  };

  const dashboardData = useMemo(() => {
    const employeeStats = employees.map(emp => {
      const empLogs = logs.filter(l => l.employeeId === emp.id);
      const totalSales = empLogs.reduce((acc, l) => acc + l.saleAmount, 0);
      const totalCommission = empLogs.reduce((acc, l) => acc + l.commissionAmount, 0);
      return {
        name: emp.name,
        sales: totalSales,
        commission: totalCommission,
        goal: emp.goalMonthly,
        progress: emp.goalMonthly > 0 ? (totalSales / emp.goalMonthly) * 100 : 0
      };
    }).sort((a, b) => b.sales - a.sales);

    const salesByType = [
      { name: 'Vendas', value: logs.filter(l => l.originType === 'sale').reduce((acc, l) => acc + l.commissionAmount, 0) },
      { name: 'Serviços', value: logs.filter(l => l.originType === 'service_order').reduce((acc, l) => acc + l.commissionAmount, 0) },
      { name: 'Bônus', value: logs.filter(l => l.originType === 'bonus').reduce((acc, l) => acc + l.commissionAmount, 0) },
    ].filter(i => i.value > 0);

    return { employeeStats, salesByType };
  }, [employees, logs]);

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042'];

  return (
    <div className="space-y-6 pb-20 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black text-slate-800 tracking-tight">Gestão de Equipe</h2>
          <p className="text-sm text-slate-500 font-medium">Gerencie funcionários, metas e comissões</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex p-1 bg-slate-100 rounded-xl w-fit overflow-x-auto">
        {[
          { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
          { id: 'employees', label: 'Funcionários', icon: User },
          { id: 'rules', label: 'Regras de Comissão', icon: Percent },
          { id: 'commissions', label: 'Relatório de Pagamentos', icon: DollarSign },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest flex items-center gap-2 transition-all whitespace-nowrap ${activeTab === tab.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
          >
            <tab.icon size={14} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {activeTab === 'dashboard' && (
        <div className="space-y-6">
          {/* Top Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
             <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
               <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2"><Award size={14}/> Melhor Vendedor</h3>
               <p className="text-xl font-black text-slate-800 truncate">{dashboardData.employeeStats[0]?.name || 'N/A'}</p>
               <p className="text-xs text-emerald-600 font-bold mt-1">
                 {formatCurrency(dashboardData.employeeStats[0]?.sales || 0)} em vendas
               </p>
             </div>
             <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
               <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2"><TrendingUp size={14}/> Total Comissões</h3>
               <p className="text-xl font-black text-slate-800">
                 {formatCurrency(logs.reduce((acc, l) => acc + l.commissionAmount, 0))}
               </p>
               <p className="text-xs text-slate-400 font-bold mt-1">Neste mês</p>
             </div>
             <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
               <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2"><Briefcase size={14}/> Total Vendas</h3>
               <p className="text-xl font-black text-slate-800">
                 {formatCurrency(logs.reduce((acc, l) => acc + l.saleAmount, 0))}
               </p>
               <p className="text-xs text-slate-400 font-bold mt-1">Geradas pela equipe</p>
             </div>
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Ranking Chart */}
            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm min-h-[300px]">
              <h3 className="font-black text-slate-800 mb-6">Ranking de Vendas</h3>
              <div className="h-[250px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dashboardData.employeeStats} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                    <XAxis type="number" hide />
                    <YAxis dataKey="name" type="category" width={80} tick={{fontSize: 10}} />
                    <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                    <Bar dataKey="sales" fill="#3b82f6" radius={[0, 4, 4, 0]} barSize={20} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Commission Distribution */}
            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm min-h-[300px]">
              <h3 className="font-black text-slate-800 mb-6">Distribuição de Comissões</h3>
              <div className="h-[250px] w-full flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <RePieChart>
                    <Pie
                      data={dashboardData.salesByType}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {dashboardData.salesByType.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                    <Legend />
                  </RePieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Detailed Table */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-100 bg-slate-50/50">
              <h3 className="font-black text-slate-800">Desempenho Detalhado</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 text-slate-500 font-black uppercase tracking-wider text-xs">
                  <tr>
                    <th className="px-6 py-4">Funcionário</th>
                    <th className="px-6 py-4">Vendas Totais</th>
                    <th className="px-6 py-4">Meta</th>
                    <th className="px-6 py-4">Progresso</th>
                    <th className="px-6 py-4 text-right">Comissão</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {dashboardData.employeeStats.map((stat, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4 font-bold text-slate-700 flex items-center gap-2">
                        {idx === 0 && <Award size={16} className="text-yellow-500" />}
                        {stat.name}
                      </td>
                      <td className="px-6 py-4 text-slate-600">{formatCurrency(stat.sales)}</td>
                      <td className="px-6 py-4 text-slate-400">{formatCurrency(stat.goal)}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div className="w-24 bg-slate-200 h-1.5 rounded-full overflow-hidden">
                            <div 
                              className={`h-full rounded-full transition-all duration-1000 ${stat.progress >= 100 ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.3)]' : 'bg-blue-500'}`} 
                              style={{ width: `${Math.min(stat.progress, 100)}%` }}
                            ></div>
                          </div>
                          <div className="flex flex-col">
                            <span className="text-[10px] font-black text-slate-500 leading-none">{stat.progress.toFixed(0)}%</span>
                            {stat.progress >= 100 && (
                              <span className="text-[7px] font-black text-emerald-600 uppercase tracking-tighter mt-0.5">Meta Batida!</span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right font-black text-emerald-600">
                        {formatCurrency(stat.commission)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      {activeTab === 'employees' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {employees.map(emp => (
            <div key={emp.id} className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all group relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => openEditModal(emp)} className="text-slate-300 hover:text-blue-500 transition-colors p-2 bg-slate-50 rounded-full shadow-sm">
                  <Edit2 size={16} />
                </button>
              </div>
              
              <div className="flex items-center gap-4 mb-6">
                <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center text-slate-400 font-black text-xl shadow-inner">
                  {emp.photoUrl ? <img src={emp.photoUrl} className="w-full h-full rounded-2xl object-cover" /> : emp.name.charAt(0)}
                </div>
                <div>
                  <h3 className="font-black text-slate-800 text-lg leading-tight">{emp.name}</h3>
                  <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md mt-1 inline-block ${emp.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                    {emp.role}
                  </span>
                </div>
              </div>
              
              <div className="space-y-3 bg-slate-50/50 p-4 rounded-xl border border-slate-100">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400 font-bold uppercase tracking-wider">Meta Mensal</span>
                  <span className="font-black text-slate-700">{formatCurrency(emp.goalMonthly)}</span>
                </div>
                <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                  <div className="bg-blue-500 h-full rounded-full" style={{ width: '45%' }}></div>
                </div>
                <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-200/50">
                  <span className="text-slate-400 font-bold uppercase tracking-wider">Comissão Padrão</span>
                  <span className="font-black text-emerald-600">{emp.defaultCommissionPercent}%</span>
                </div>
              </div>
            </div>
          ))}
          
          {employees.length === 0 && !isLoading && (
            <div className="col-span-full py-12 text-center opacity-50">
              <User size={48} className="mx-auto mb-4 text-slate-300" />
              <p className="text-sm font-bold text-slate-400">Nenhum funcionário cadastrado</p>
            </div>
          )}
        </div>
      )}

      {activeTab === 'rules' && (
        <div className="space-y-8">
          {/* Header de Regras */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="bg-blue-50 p-6 rounded-2xl border border-blue-100 flex-1 flex items-start gap-4">
              <div className="p-3 bg-white rounded-xl text-blue-500 shadow-sm">
                <Zap size={24} />
              </div>
              <div>
                <h3 className="font-black text-blue-800 text-lg">Módulo de Comissão Inteligente</h3>
                <p className="text-sm text-blue-600/80 font-medium mt-1">
                  Configure regras dinâmicas por categoria, produto ou serviço. O sistema aplicará automaticamente a regra de maior prioridade.
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <button 
                onClick={() => openGoalModal()}
                className="bg-white text-slate-700 px-6 py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest border border-slate-200 hover:bg-slate-50 transition-all flex items-center gap-2 shadow-sm"
              >
                <Target size={16} /> Nova Meta
              </button>
              <button 
                onClick={() => openRuleModal()}
                className="bg-slate-900 text-white px-6 py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-slate-800 transition-all flex items-center gap-2 shadow-xl shadow-slate-900/20"
              >
                <Plus size={16} /> Nova Regra
              </button>
            </div>
          </div>

          {/* Grid de Regras e Metas */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
            {/* Lista de Regras */}
            <div className="xl:col-span-2 space-y-4">
              <div className="flex items-center justify-between px-2">
                <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                  <Filter size={14} /> Regras de Cálculo ({rules.length})
                </h4>
              </div>
              
              <div className="grid grid-cols-1 gap-4">
                {rules.map(rule => (
                  <div key={rule.id} className={`bg-white p-6 rounded-2xl border ${rule.isActive ? 'border-slate-100' : 'border-slate-100 opacity-60'} shadow-sm hover:shadow-md transition-all flex flex-col md:flex-row md:items-center justify-between gap-6 group`}>
                    <div className="flex items-start gap-4">
                      <div className={`p-3 rounded-xl ${rule.targetType === 'global' ? 'bg-blue-50 text-blue-500' : rule.targetType === 'category' ? 'bg-purple-50 text-purple-500' : 'bg-emerald-50 text-emerald-500'}`}>
                        {rule.targetType === 'global' ? <Award size={20} /> : rule.targetType === 'category' ? <PieChart size={20} /> : <Zap size={20} />}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h5 className="font-black text-slate-800 uppercase text-sm tracking-tight">{rule.name}</h5>
                          <span className="text-[9px] font-black bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded uppercase">Prio {rule.priority}</span>
                        </div>
                        <p className="text-xs text-slate-400 font-medium mt-1">{rule.description || 'Sem descrição'}</p>
                        <div className="flex items-center gap-3 mt-3">
                          <span className="text-[10px] font-bold text-slate-500 bg-slate-50 px-2 py-1 rounded-lg flex items-center gap-1">
                            <Filter size={10} /> {rule.targetType === 'global' ? 'Toda a Loja' : rule.targetType === 'category' ? `Categoria: ${rule.targetId}` : rule.targetType === 'product' ? 'Produto Específico' : 'Serviços'}
                          </span>
                          <span className="text-[10px] font-bold text-slate-500 bg-slate-50 px-2 py-1 rounded-lg flex items-center gap-1">
                            <Settings size={10} /> {rule.calculationBase === 'gross_sale' ? 'Sobre Faturamento' : 'Sobre Lucro'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between md:justify-end gap-8 border-t md:border-t-0 pt-4 md:pt-0">
                      <div className="text-right">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Comissão</p>
                        <p className="text-2xl font-black text-emerald-600">
                          {rule.ruleType === 'percent' ? `${rule.value}%` : formatCurrency(rule.value)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={() => openRuleModal(rule)} className="p-2 text-slate-400 hover:text-blue-500 hover:bg-blue-50 rounded-xl transition-all">
                          <Edit2 size={18} />
                        </button>
                        <button onClick={() => handleDeleteRule(rule.id)} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all">
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
                
                {rules.length === 0 && (
                  <div className="bg-slate-50 border-2 border-dashed border-slate-200 p-12 rounded-3xl text-center">
                    <Percent size={48} className="mx-auto mb-4 text-slate-300" />
                    <p className="text-slate-500 font-bold">Nenhuma regra inteligente configurada.</p>
                    <p className="text-xs text-slate-400 mt-1">O sistema usará as comissões padrão dos funcionários.</p>
                  </div>
                )}
              </div>
            </div>

            {/* Metas e Bônus */}
            <div className="space-y-4">
              <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 px-2">
                <Target size={14} /> Metas e Bônus Extras
              </h4>
              
              <div className="space-y-4">
                {goalTiers.map(tier => (
                  <div key={tier.id} className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm relative group">
                    <div className="absolute top-4 right-4 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => openGoalModal(tier)} className="p-1.5 text-slate-400 hover:text-blue-500"><Edit2 size={14}/></button>
                      <button onClick={() => handleDeleteGoal(tier.id)} className="p-1.5 text-slate-400 hover:text-red-500"><Trash2 size={14}/></button>
                    </div>
                    
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 bg-amber-50 text-amber-500 rounded-xl flex items-center justify-center">
                        <Award size={20} />
                      </div>
                      <div>
                        <h5 className="font-black text-slate-800 text-sm">{tier.name}</h5>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Meta de Faturamento</p>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="flex justify-between items-end">
                        <span className="text-xs text-slate-500 font-medium">A partir de</span>
                        <span className="text-lg font-black text-slate-800">{formatCurrency(tier.minAmount)}</span>
                      </div>
                      <div className="h-1 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-amber-400 w-full opacity-50"></div>
                      </div>
                      <div className="flex justify-between items-center pt-2">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Bônus Extra</span>
                        <span className="text-sm font-black text-emerald-600">
                          +{tier.bonusType === 'percent' ? `${tier.bonusValue}%` : formatCurrency(tier.bonusValue)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
                
                <button 
                  onClick={() => openGoalModal()}
                  className="w-full py-8 border-2 border-dashed border-slate-200 rounded-2xl text-slate-400 hover:text-blue-500 hover:border-blue-200 hover:bg-blue-50/30 transition-all flex flex-col items-center justify-center gap-2"
                >
                  <Plus size={24} />
                  <span className="text-xs font-black uppercase tracking-widest">Adicionar Meta de Bônus</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'commissions' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Total Pago (Mês)</h3>
              <p className="text-3xl font-black text-slate-800">{formatCurrency(logs.reduce((acc, curr) => acc + curr.commissionAmount, 0))}</p>
            </div>
            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Vendas Totais</h3>
              <p className="text-3xl font-black text-blue-600">{formatCurrency(logs.reduce((acc, curr) => acc + curr.saleAmount, 0))}</p>
            </div>
            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Lucro Gerado</h3>
              <p className="text-3xl font-black text-emerald-600">{formatCurrency(logs.reduce((acc, curr) => acc + curr.profitAmount, 0))}</p>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-100 bg-slate-50/50">
              <h3 className="font-black text-slate-800">Extrato de Comissões</h3>
            </div>
            <div className="divide-y divide-slate-100">
              {logs.map(log => (
                <div key={log.id} className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${log.originType === 'sale' ? 'bg-blue-50 text-blue-500' : 'bg-purple-50 text-purple-500'}`}>
                      {log.originType === 'sale' ? <DollarSign size={20} /> : <Award size={20} />}
                    </div>
                    <div>
                      <p className="font-bold text-slate-700 text-sm">{log.description}</p>
                      <p className="text-xs text-slate-400 font-medium mt-0.5">
                        {new Date(log.createdAt).toLocaleDateString()} • Venda: {formatCurrency(log.saleAmount)} • Lucro: {formatCurrency(log.profitAmount)}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-black text-emerald-600 text-sm">+{formatCurrency(log.commissionAmount)}</p>
                    <div className="flex items-center gap-2 justify-end mt-1">
                      <span className={`text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-md ${log.status === 'paid' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                        {log.status === 'paid' ? 'PAGO' : 'PENDENTE'}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
              {logs.length === 0 && (
                <div className="p-12 text-center text-slate-400 font-medium">
                  Nenhum registro de comissão encontrado.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal de Regra de Comissão */}
      {isRuleModalOpen && (
        <div className="fixed inset-0 bg-slate-950/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white w-full max-w-xl rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95">
            <div className="p-8 border-b border-slate-50 flex justify-between items-center bg-slate-50/50">
              <div>
                <h3 className="font-black text-slate-800 text-lg uppercase tracking-tight">{editingRule ? 'Editar Regra Inteligente' : 'Nova Regra Inteligente'}</h3>
                <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mt-1">Configure o gatilho de comissão</p>
              </div>
              <button onClick={() => setIsRuleModalOpen(false)} className="p-3 hover:bg-slate-200 rounded-full transition-colors"><X size={20} /></button>
            </div>
            
            <div className="p-8 space-y-6">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Nome da Regra</label>
                <input 
                  value={ruleFormData.name || ''}
                  onChange={e => setRuleFormData({...ruleFormData, name: e.target.value})}
                  className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-4 text-sm font-black uppercase outline-none focus:ring-4 focus:ring-blue-500/10 transition-all"
                  placeholder="EX: COMISSÃO TURBO ACESSÓRIOS"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Aplicar Sobre</label>
                  <select 
                    value={ruleFormData.targetType}
                    onChange={e => setRuleFormData({...ruleFormData, targetType: e.target.value as any, targetId: ''})}
                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-4 text-sm font-black uppercase outline-none focus:ring-4 focus:ring-blue-500/10 transition-all"
                  >
                    <option value="global">Toda a Loja</option>
                    <option value="category">Uma Categoria</option>
                    <option value="product">Um Produto</option>
                    <option value="service">Todos os Serviços</option>
                  </select>
                </div>

                {ruleFormData.targetType === 'category' && (
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Selecionar Categoria</label>
                    <select 
                      value={ruleFormData.targetId}
                      onChange={e => setRuleFormData({...ruleFormData, targetId: e.target.value})}
                      className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-4 text-sm font-black uppercase outline-none focus:ring-4 focus:ring-blue-500/10 transition-all"
                    >
                      <option value="">Selecione...</option>
                      {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                    </select>
                  </div>
                )}

                {ruleFormData.targetType === 'product' && (
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">ID do Produto</label>
                    <input 
                      value={ruleFormData.targetId || ''}
                      onChange={e => setRuleFormData({...ruleFormData, targetId: e.target.value})}
                      className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-4 text-sm font-black uppercase outline-none focus:ring-4 focus:ring-blue-500/10 transition-all"
                      placeholder="ID DO PRODUTO"
                    />
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Base de Cálculo</label>
                  <select 
                    value={ruleFormData.calculationBase}
                    onChange={e => setRuleFormData({...ruleFormData, calculationBase: e.target.value as any})}
                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-4 text-sm font-black uppercase outline-none focus:ring-4 focus:ring-blue-500/10 transition-all"
                  >
                    <option value="gross_sale">Faturamento Bruto</option>
                    <option value="net_profit">Lucro Líquido</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Prioridade (1-10)</label>
                  <input 
                    type="number"
                    value={ruleFormData.priority || 1}
                    onChange={e => setRuleFormData({...ruleFormData, priority: Number(e.target.value)})}
                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-4 text-sm font-black uppercase outline-none focus:ring-4 focus:ring-blue-500/10 transition-all"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Tipo de Valor</label>
                  <select 
                    value={ruleFormData.ruleType}
                    onChange={e => setRuleFormData({...ruleFormData, ruleType: e.target.value as any})}
                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-4 text-sm font-black uppercase outline-none focus:ring-4 focus:ring-blue-500/10 transition-all"
                  >
                    <option value="percent">Porcentagem (%)</option>
                    <option value="fixed">Valor Fixo (R$)</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Valor da Comissão</label>
                  <input 
                    type="number"
                    value={ruleFormData.value || 0}
                    onChange={e => setRuleFormData({...ruleFormData, value: Number(e.target.value)})}
                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-4 text-sm font-black uppercase outline-none focus:ring-4 focus:ring-blue-500/10 transition-all"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3 px-4 py-2 bg-amber-50 rounded-2xl border border-amber-100">
                <input 
                  type="checkbox"
                  id="requiresGoalMet"
                  checked={ruleFormData.requiresGoalMet || false}
                  onChange={e => setRuleFormData({...ruleFormData, requiresGoalMet: e.target.checked})}
                  className="w-5 h-5 rounded-lg border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="requiresGoalMet" className="text-[10px] font-black text-amber-800 uppercase tracking-widest cursor-pointer">
                  Esta regra só se aplica se o funcionário bater a meta mensal
                </label>
              </div>
            </div>

            <div className="p-8 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
              <button onClick={() => setIsRuleModalOpen(false)} className="px-8 py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest text-slate-400 hover:bg-slate-200 transition-all">Cancelar</button>
              <button onClick={handleSaveRule} className="px-8 py-4 bg-slate-900 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl hover:bg-slate-800 transition-all">Salvar Regra</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Meta (GoalTier) */}
      {isGoalModalOpen && (
        <div className="fixed inset-0 bg-slate-950/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95">
            <div className="p-8 border-b border-slate-50 flex justify-between items-center bg-slate-50/50">
              <h3 className="font-black text-slate-800 text-lg uppercase tracking-tight">{editingGoal ? 'Editar Meta de Bônus' : 'Nova Meta de Bônus'}</h3>
              <button onClick={() => setIsGoalModalOpen(false)} className="p-3 hover:bg-slate-200 rounded-full transition-colors"><X size={20} /></button>
            </div>
            
            <div className="p-8 space-y-6">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Nome da Meta</label>
                <input 
                  value={goalFormData.name || ''}
                  onChange={e => setGoalFormData({...goalFormData, name: e.target.value})}
                  className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-4 text-sm font-black uppercase outline-none focus:ring-4 focus:ring-blue-500/10 transition-all"
                  placeholder="EX: META OURO"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Faturamento Mínimo (Gatilho)</label>
                <input 
                  type="number"
                  value={goalFormData.minAmount || 0}
                  onChange={e => setGoalFormData({...goalFormData, minAmount: Number(e.target.value)})}
                  className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-4 text-sm font-black uppercase outline-none focus:ring-4 focus:ring-blue-500/10 transition-all"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Tipo de Bônus</label>
                  <select 
                    value={goalFormData.bonusType}
                    onChange={e => setGoalFormData({...goalFormData, bonusType: e.target.value as any})}
                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-4 text-sm font-black uppercase outline-none focus:ring-4 focus:ring-blue-500/10 transition-all"
                  >
                    <option value="percent">Porcentagem (%)</option>
                    <option value="fixed">Valor Fixo (R$)</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Valor do Bônus</label>
                  <input 
                    type="number"
                    value={goalFormData.bonusValue || 0}
                    onChange={e => setGoalFormData({...goalFormData, bonusValue: Number(e.target.value)})}
                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-4 text-sm font-black uppercase outline-none focus:ring-4 focus:ring-blue-500/10 transition-all"
                  />
                </div>
              </div>
            </div>

            <div className="p-8 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
              <button onClick={() => setIsGoalModalOpen(false)} className="px-8 py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest text-slate-400 hover:bg-slate-200 transition-all">Cancelar</button>
              <button onClick={handleSaveGoal} className="px-8 py-4 bg-slate-900 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl hover:bg-slate-800 transition-all">Salvar Meta</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EmployeeManagementTab;
