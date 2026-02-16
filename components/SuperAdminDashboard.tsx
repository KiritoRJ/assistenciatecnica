
import React, { useState, useEffect } from 'react';
import { Users, Plus, Store, ShieldCheck, LogOut, Key, Trash2, CheckCircle2, Globe, Server, Shield } from 'lucide-react';
import { getAllTenants, saveTenant } from '../utils/db';
import { Tenant } from '../types';

interface Props {
  onLogout: () => void;
}

const SuperAdminDashboard: React.FC<Props> = ({ onLogout }) => {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [formData, setFormData] = useState({ storeName: '', username: '', password: '' });

  useEffect(() => {
    loadTenants();
  }, []);

  const loadTenants = async () => {
    // Busca do banco online (simulado no localStorage central 'cloud_tenants')
    const cloudTenants = JSON.parse(localStorage.getItem('cloud_tenants') || '[]');
    setTenants(cloudTenants);
  };

  const handleCreateTenant = async () => {
    if (!formData.storeName || !formData.username || !formData.password) return alert('Preencha todos os campos.');
    
    const newTenant: Tenant = {
      id: Math.random().toString(36).substr(2, 9),
      storeName: formData.storeName,
      adminUsername: formData.username,
      adminPasswordHash: btoa(formData.password),
      createdAt: new Date().toISOString()
    };

    // Salva no "Servidor Online"
    const currentCloud = JSON.parse(localStorage.getItem('cloud_tenants') || '[]');
    const updatedCloud = [...currentCloud, newTenant];
    localStorage.setItem('cloud_tenants', JSON.stringify(updatedCloud));

    setFormData({ storeName: '', username: '', password: '' });
    loadTenants();
    alert('Nova empresa cadastrada com sucesso no banco online!');
  };

  const handleDelete = (username: string) => {
    if (confirm('Deseja realmente remover esta empresa do sistema central? Todos os dados serão inacessíveis.')) {
      const currentCloud = JSON.parse(localStorage.getItem('cloud_tenants') || '[]');
      const updatedCloud = currentCloud.filter((t: any) => t.adminUsername !== username);
      localStorage.setItem('cloud_tenants', JSON.stringify(updatedCloud));
      loadTenants();
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white p-8 font-sans">
      <header className="max-w-6xl mx-auto flex items-center justify-between mb-16">
        <div className="flex items-center gap-6">
          <div className="w-16 h-16 bg-blue-600 rounded-[2rem] flex items-center justify-center shadow-2xl shadow-blue-500/20 border border-white/10">
            <ShieldCheck size={32} />
          </div>
          <div>
            <h1 className="text-3xl font-black uppercase tracking-tighter">Wandev Dashboard</h1>
            <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest flex items-center gap-2">
               <Server size={12} /> Gestão de Servidor e Tenancy
            </p>
          </div>
        </div>
        <button onClick={onLogout} className="px-6 py-4 bg-white/5 border border-white/10 rounded-2xl text-slate-400 hover:text-white hover:bg-white/10 transition-all flex items-center gap-2 font-black text-[10px] uppercase tracking-widest">
          Desconectar <LogOut size={16} />
        </button>
      </header>

      <main className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-10">
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between bg-white/5 p-6 rounded-3xl border border-white/10">
            <div>
               <h2 className="text-sm font-black uppercase tracking-[0.2em] text-slate-400">Empresas Conectadas</h2>
               <p className="text-[9px] text-slate-500 font-bold uppercase mt-1">Status do banco de dados em tempo real</p>
            </div>
            <div className="flex items-center gap-3">
               <div className="text-right">
                  <p className="text-2xl font-black text-white">{tenants.length}</p>
                  <p className="text-[8px] font-black text-blue-500 uppercase">Total Ativas</p>
               </div>
               <Globe className="text-blue-500 animate-pulse" size={32} />
            </div>
          </div>

          <div className="grid gap-4">
            {tenants.map(t => (
              <div key={t.id} className="bg-white/5 border border-white/5 p-6 rounded-[2rem] flex items-center justify-between group hover:border-blue-500/30 hover:bg-white/[0.07] transition-all">
                <div className="flex items-center gap-5">
                  <div className="w-14 h-14 bg-slate-900 rounded-2xl flex items-center justify-center text-blue-500 border border-white/5">
                    <Store size={24} />
                  </div>
                  <div>
                    <h3 className="font-black text-slate-100 uppercase text-sm tracking-tight">{t.storeName}</h3>
                    <div className="flex items-center gap-3 mt-1">
                       <span className="text-[9px] font-black text-slate-500 uppercase flex items-center gap-1"><Users size={10}/> {t.adminUsername}</span>
                       <span className="text-[9px] font-black text-slate-500 uppercase flex items-center gap-1"><Shield size={10}/> ID: {t.id}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="px-4 py-1.5 bg-emerald-500/10 text-emerald-500 rounded-full text-[8px] font-black uppercase tracking-widest border border-emerald-500/20">Online</div>
                  <button onClick={() => handleDelete(t.adminUsername)} className="p-3 text-slate-600 hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-all"><Trash2 size={18}/></button>
                </div>
              </div>
            ))}
            {tenants.length === 0 && (
               <div className="text-center py-20 bg-white/5 rounded-[2rem] border-2 border-dashed border-white/10">
                  <p className="text-slate-600 font-black uppercase text-xs tracking-[0.3em]">Nenhuma empresa cadastrada</p>
               </div>
            )}
          </div>
        </div>

        <div className="bg-gradient-to-b from-blue-600 to-indigo-700 rounded-[3rem] p-10 space-y-8 shadow-2xl shadow-blue-500/20 h-fit sticky top-10 border border-white/20">
          <div className="w-16 h-16 bg-white/20 rounded-3xl flex items-center justify-center mb-2 shadow-inner">
            <Plus size={32} />
          </div>
          <div>
             <h2 className="text-2xl font-black tracking-tighter">Nova Empresa</h2>
             <p className="text-blue-100/60 text-[10px] font-bold uppercase tracking-widest mt-1">Isolamento total de dados</p>
          </div>
          
          <div className="space-y-5">
            <div className="space-y-2">
              <label className="text-[9px] font-black uppercase tracking-widest text-blue-200 ml-4">Nome da Loja</label>
              <input 
                value={formData.storeName} 
                onChange={e => setFormData({...formData, storeName: e.target.value})}
                placeholder="Ex: TICCELL PRO" 
                className="w-full bg-white/10 border border-white/10 rounded-2xl p-5 font-bold placeholder:text-blue-200/40 outline-none focus:ring-4 focus:ring-white/20 transition-all" 
              />
            </div>
            <div className="space-y-2">
              <label className="text-[9px] font-black uppercase tracking-widest text-blue-200 ml-4">Usuário do ADM</label>
              <input 
                value={formData.username} 
                onChange={e => setFormData({...formData, username: e.target.value})}
                placeholder="login_admin" 
                className="w-full bg-white/10 border border-white/10 rounded-2xl p-5 font-bold placeholder:text-blue-200/40 outline-none focus:ring-4 focus:ring-white/20 transition-all" 
              />
            </div>
            <div className="space-y-2">
              <label className="text-[9px] font-black uppercase tracking-widest text-blue-200 ml-4">Senha Inicial</label>
              <input 
                type="password"
                value={formData.password} 
                onChange={e => setFormData({...formData, password: e.target.value})}
                placeholder="••••••" 
                className="w-full bg-white/10 border border-white/10 rounded-2xl p-5 font-bold placeholder:text-blue-200/40 outline-none focus:ring-4 focus:ring-white/20 transition-all" 
              />
            </div>
          </div>
          <button onClick={handleCreateTenant} className="w-full bg-white text-blue-600 py-6 rounded-[2rem] font-black uppercase text-xs tracking-[0.2em] shadow-2xl active:scale-95 transition-all mt-4">Autorizar Acesso</button>
        </div>
      </main>
    </div>
  );
};

export default SuperAdminDashboard;
