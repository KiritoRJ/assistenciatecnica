
import React, { useState, useEffect } from 'react';
import { Users, Plus, Store, ShieldCheck, LogOut, Key, Trash2, CheckCircle2 } from 'lucide-react';
import { getAllTenants, saveTenant } from '../utils/db';
import { Tenant } from '../types';

interface Props {
  onLogout: () => void;
}

const SuperAdminDashboard: React.FC<Props> = ({ onLogout }) => {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({ storeName: '', username: '', password: '' });

  useEffect(() => {
    loadTenants();
  }, []);

  const loadTenants = async () => {
    const data = await getAllTenants();
    setTenants(data);
  };

  const handleCreateTenant = async () => {
    if (!formData.storeName || !formData.username || !formData.password) return alert('Preencha tudo');
    
    // Simulação de Hash simples (em app real usaria SubtleCrypto)
    const newTenant: Tenant = {
      id: Math.random().toString(36).substr(2, 9),
      storeName: formData.storeName,
      adminUsername: formData.username,
      adminPasswordHash: btoa(formData.password), // Base64 para simular armazenamento não legível
      createdAt: new Date().toISOString()
    };

    await saveTenant(newTenant);
    setIsModalOpen(false);
    setFormData({ storeName: '', username: '', password: '' });
    loadTenants();
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white p-6">
      <header className="max-w-5xl mx-auto flex items-center justify-between mb-12">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/20">
            <ShieldCheck size={28} />
          </div>
          <div>
            <h1 className="text-2xl font-black uppercase tracking-tighter">Super Admin</h1>
            <p className="text-[10px] font-bold text-blue-400 uppercase tracking-widest">Painel de Controle Wandev</p>
          </div>
        </div>
        <button onClick={onLogout} className="p-3 bg-slate-900 rounded-2xl text-slate-400 hover:text-white transition-colors">
          <LogOut size={24} />
        </button>
      </header>

      <main className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-black uppercase tracking-[0.2em] text-slate-500">Adms de Lojas Cadastrados</h2>
            <span className="bg-slate-900 px-3 py-1 rounded-full text-[10px] font-black text-blue-400">{tenants.length} ATIVOS</span>
          </div>

          <div className="grid gap-3">
            {tenants.map(t => (
              <div key={t.id} className="bg-slate-900/50 border border-slate-800 p-5 rounded-3xl flex items-center justify-between group hover:border-blue-500/50 transition-all">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-slate-800 rounded-xl flex items-center justify-center text-blue-500">
                    <Store size={20} />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-100">{t.storeName}</h3>
                    <p className="text-[10px] font-medium text-slate-500 uppercase">Usuário: {t.adminUsername}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="px-3 py-1 bg-emerald-500/10 text-emerald-500 rounded-full text-[8px] font-black uppercase">Online</div>
                  <button className="p-2 text-slate-600 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"><Trash2 size={16}/></button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-blue-600 rounded-[2.5rem] p-8 space-y-6 shadow-2xl shadow-blue-500/10 h-fit sticky top-6">
          <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center mb-2">
            <Plus size={28} />
          </div>
          <h2 className="text-xl font-black">Cadastrar Novo ADM de Empresa</h2>
          <div className="space-y-4">
            <div className="space-y-1">
              <label className="text-[9px] font-black uppercase tracking-widest text-blue-100">Nome da Empresa</label>
              <input 
                value={formData.storeName} 
                onChange={e => setFormData({...formData, storeName: e.target.value})}
                placeholder="Ex: TICCELL ASSISTÊNCIA" 
                className="w-full bg-white/10 border-none rounded-2xl p-4 font-bold placeholder:text-blue-300 outline-none focus:ring-2 focus:ring-white/50" 
              />
            </div>
            <div className="space-y-1">
              <label className="text-[9px] font-black uppercase tracking-widest text-blue-100">Usuário do ADM</label>
              <input 
                value={formData.username} 
                onChange={e => setFormData({...formData, username: e.target.value})}
                placeholder="Nome de login" 
                className="w-full bg-white/10 border-none rounded-2xl p-4 font-bold placeholder:text-blue-300 outline-none" 
              />
            </div>
            <div className="space-y-1">
              <label className="text-[9px] font-black uppercase tracking-widest text-blue-100">Senha Padrão</label>
              <input 
                type="password"
                value={formData.password} 
                onChange={e => setFormData({...formData, password: e.target.value})}
                placeholder="Senha de acesso" 
                className="w-full bg-white/10 border-none rounded-2xl p-4 font-bold placeholder:text-blue-300 outline-none" 
              />
            </div>
          </div>
          <button onClick={handleCreateTenant} className="w-full bg-white text-blue-600 py-5 rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl active:scale-95 transition-all">Criar Conta</button>
        </div>
      </main>
    </div>
  );
};

export default SuperAdminDashboard;
