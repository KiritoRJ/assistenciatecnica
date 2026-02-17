
import React, { useState, useEffect } from 'react';
import { Users, Plus, Store, ShieldCheck, LogOut, Key, Trash2, CheckCircle2, Globe, Server, Shield, Loader2, AlertCircle, X } from 'lucide-react';
import { OnlineDB } from '../utils/api';

interface Props {
  onLogout: () => void;
}

const SuperAdminDashboard: React.FC<Props> = ({ onLogout }) => {
  const [tenants, setTenants] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [formData, setFormData] = useState({ storeName: '', username: '', password: '' });
  const [tenantToDelete, setTenantToDelete] = useState<{ id: string, name: string } | null>(null);

  useEffect(() => {
    loadTenants();
  }, []);

  const loadTenants = async () => {
    setIsLoading(true);
    try {
      const data = await OnlineDB.getTenants();
      setTenants(data || []);
    } catch (e) {
      console.error("Erro ao carregar lojas", e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateTenant = async () => {
    setErrorMsg(null);
    if (!formData.storeName || !formData.username || !formData.password) {
      return alert('Preencha todos os campos.');
    }
    
    setIsSaving(true);
    try {
      const tenantId = 'LOJA_' + Math.random().toString(36).substr(2, 5).toUpperCase();
      
      const result = await OnlineDB.createTenant({
        id: tenantId,
        storeName: formData.storeName,
        adminUsername: formData.username,
        adminPasswordPlain: formData.password,
        createdAt: new Date().toISOString()
      });

      if (result.success) {
        setFormData({ storeName: '', username: '', password: '' });
        await loadTenants();
      } else {
        setErrorMsg(result.message);
      }
    } catch (e) {
      setErrorMsg("Erro na comunicação com o Supabase.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteTenant = async () => {
    if (!tenantToDelete) return;
    setIsDeleting(true);
    setErrorMsg(null);

    try {
      const result = await OnlineDB.deleteTenant(tenantToDelete.id);
      if (result.success) {
        setTenantToDelete(null);
        await loadTenants();
      } else {
        setErrorMsg(result.message || "Erro ao excluir loja.");
        setTenantToDelete(null);
      }
    } catch (e: any) {
      setErrorMsg("Erro fatal ao tentar excluir.");
      setTenantToDelete(null);
    } finally {
      setIsDeleting(false);
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
            <h1 className="text-3xl font-black uppercase tracking-tighter text-white">Wandev Global</h1>
            <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest flex items-center gap-2">
               <Server size={12} /> Cloud Supabase Ativa
            </p>
          </div>
        </div>
        <button onClick={onLogout} className="px-6 py-4 bg-white/5 border border-white/10 rounded-2xl text-slate-400 hover:text-white hover:bg-white/10 transition-all flex items-center gap-2 font-black text-[10px] uppercase tracking-widest">
          Sair <LogOut size={16} />
        </button>
      </header>

      <main className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-10">
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between bg-white/5 p-6 rounded-3xl border border-white/10">
            <div>
               <h2 className="text-sm font-black uppercase tracking-[0.2em] text-slate-400">Empresas Cadastradas</h2>
            </div>
            {isLoading ? <Loader2 className="animate-spin text-blue-500" /> : <Globe className="text-blue-500 animate-pulse" size={32} />}
          </div>

          {errorMsg && (
            <div className="bg-red-500/10 border border-red-500/20 p-5 rounded-3xl flex items-center gap-3 text-red-500 text-xs font-bold uppercase animate-in slide-in-from-top-2">
              <AlertCircle size={18} />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="grid gap-4">
            {tenants.map(t => (
              <div key={t.id} className="bg-white/5 border border-white/5 p-6 rounded-[2rem] flex items-center justify-between group hover:border-blue-500/30 transition-all">
                <div className="flex items-center gap-5">
                  <div className="w-14 h-14 bg-slate-900 rounded-2xl flex items-center justify-center text-blue-500 border border-white/5">
                    <Store size={24} />
                  </div>
                  <div>
                    <h3 className="font-black text-slate-100 uppercase text-sm">{t.store_name}</h3>
                    <div className="flex items-center gap-3 mt-1 text-[9px] font-black text-slate-500 uppercase">
                       <span>ID: {t.id}</span>
                       <span>•</span>
                       <span>{new Date(t.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="px-4 py-1.5 bg-emerald-500/10 text-emerald-500 rounded-full text-[8px] font-black uppercase tracking-widest border border-emerald-500/20">Online</div>
                  <button 
                    onClick={() => setTenantToDelete({ id: t.id, name: t.store_name })}
                    className="p-3 bg-red-500/10 text-red-500 rounded-xl hover:bg-red-500 hover:text-white transition-all active:scale-90"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            ))}
            {!isLoading && tenants.length === 0 && (
               <div className="text-center py-20 bg-white/5 rounded-[2rem] border-2 border-dashed border-white/10">
                  <p className="text-slate-600 font-black uppercase text-xs">Nenhuma empresa encontrada</p>
               </div>
            )}
          </div>
        </div>

        <div className="bg-blue-600 rounded-[3rem] p-10 space-y-8 shadow-2xl h-fit sticky top-10 border border-white/20">
          <div className="w-16 h-16 bg-white/20 rounded-3xl flex items-center justify-center mb-2 shadow-inner">
            <Plus size={32} />
          </div>
          <h2 className="text-2xl font-black tracking-tighter">Cadastrar Loja</h2>
          
          <div className="space-y-5">
            <div className="space-y-2">
              <label className="text-[9px] font-black uppercase tracking-widest text-blue-200 ml-4">Nome da Loja</label>
              <input 
                value={formData.storeName} 
                onChange={e => setFormData({...formData, storeName: e.target.value})}
                placeholder="Ex: Assistência do João" 
                className="w-full bg-white/10 border border-white/10 rounded-2xl p-5 font-bold outline-none uppercase text-sm" 
              />
            </div>
            <div className="space-y-2">
              <label className="text-[9px] font-black uppercase tracking-widest text-blue-200 ml-4">Usuário para Login</label>
              <input 
                value={formData.username} 
                onChange={e => setFormData({...formData, username: e.target.value})}
                placeholder="Ex: joao_adm" 
                className="w-full bg-white/10 border border-white/10 rounded-2xl p-5 font-bold outline-none text-sm" 
              />
            </div>
            <div className="space-y-2">
              <label className="text-[9px] font-black uppercase tracking-widest text-blue-200 ml-4">Senha</label>
              <input 
                type="text"
                value={formData.password} 
                onChange={e => setFormData({...formData, password: e.target.value})}
                placeholder="Ex: 123456" 
                className="w-full bg-white/10 border border-white/10 rounded-2xl p-5 font-bold outline-none text-sm" 
              />
            </div>
          </div>
          <button 
            onClick={handleCreateTenant} 
            disabled={isSaving}
            className="w-full bg-white text-blue-600 py-6 rounded-[2rem] font-black uppercase text-xs tracking-[0.2em] shadow-2xl active:scale-95 transition-all mt-4 disabled:opacity-50 flex items-center justify-center gap-3"
          >
            {isSaving ? <Loader2 className="animate-spin" size={18} /> : 'Autorizar Acesso'}
          </button>
        </div>
      </main>

      {/* Modal de Confirmação de Exclusão */}
      {tenantToDelete && (
        <div className="fixed inset-0 bg-slate-950/80 z-[100] flex items-center justify-center p-6 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-sm rounded-[3rem] overflow-hidden shadow-2xl animate-in zoom-in-95 border border-slate-100">
            <div className="p-8 text-center space-y-6">
              <div className="w-20 h-20 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-2">
                <Trash2 size={40} />
              </div>
              <div className="space-y-2">
                <h3 className="font-black text-slate-800 uppercase text-lg">Excluir Loja?</h3>
                <p className="text-slate-400 text-sm font-bold uppercase leading-tight px-4">
                  Deseja realmente apagar a loja <span className="text-red-600 font-black">"{tenantToDelete.name}"</span>?
                </p>
                <p className="text-[10px] text-red-400 font-black uppercase tracking-widest animate-pulse mt-4">
                  Isso apagará todos os usuários, OS e estoque vinculados!
                </p>
              </div>
              
              <div className="flex flex-col gap-3 pt-4">
                <button 
                  onClick={handleDeleteTenant} 
                  disabled={isDeleting}
                  className="w-full py-5 bg-red-600 text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl shadow-red-500/20 active:scale-95 disabled:opacity-50 flex items-center justify-center gap-3"
                >
                  {isDeleting ? <Loader2 className="animate-spin" size={18} /> : 'Confirmar Exclusão'}
                </button>
                <button 
                  onClick={() => setTenantToDelete(null)} 
                  disabled={isDeleting}
                  className="w-full py-5 bg-slate-100 text-slate-500 rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-slate-200 transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SuperAdminDashboard;
