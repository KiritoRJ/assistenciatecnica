
import React, { useState } from 'react';
import { Store, Image as ImageIcon, Camera, FileText, Type, Palette, MoveHorizontal, MoreVertical, ArrowLeft, Check, Layout, Pipette, X, AlertCircle, Users, Shield, UserPlus, Trash2, User as UserIcon, Loader2, Lock } from 'lucide-react';
import { AppSettings, User } from '../types';
import { OnlineDB } from '../utils/api';

interface Props {
  settings: AppSettings;
  setSettings: (settings: AppSettings) => void;
  isCloudConnected?: boolean;
  currentUser: User;
  onSwitchProfile: (user: User) => void;
  tenantId?: string; // TenantId passado do App.tsx
}

const SettingsTab: React.FC<Props> = ({ settings, setSettings, isCloudConnected = true, currentUser, onSwitchProfile, tenantId }) => {
  const isAdmin = currentUser.role === 'admin';
  const [view, setView] = useState<'main' | 'print' | 'theme' | 'users'>(isAdmin ? 'main' : 'users');
  const [showMenu, setShowMenu] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  // User Management Local State
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [newUserName, setNewUserName] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserRole, setNewUserRole] = useState<'tecnico' | 'vendedor'>('tecnico');
  const [newUserPhoto, setNewUserPhoto] = useState<string | null>(null);

  const triggerSaveFeedback = (msg: string = "Sincronizado!") => {
    setIsSaving(true);
    setSaveMessage(msg);
    setTimeout(() => {
      setIsSaving(false);
      setSaveMessage(null);
    }, 2000);
  };

  const updateSetting = async (key: keyof AppSettings, value: any) => {
    if (!isAdmin && key !== 'users') return;
    const updated = { ...settings, [key]: value };
    setSettings(updated);
    triggerSaveFeedback();
  };

  const triggerUpload = () => {
    if (!isAdmin) return;
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e: any) => {
      const file = e.target.files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onloadend = () => updateSetting('logoUrl', reader.result as string);
        reader.readAsDataURL(file);
      }
    };
    input.click();
  };

  const triggerUserPhotoUpload = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e: any) => {
      const file = e.target.files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onloadend = () => setNewUserPhoto(reader.result as string);
        reader.readAsDataURL(file);
      }
    };
    input.click();
  };

  const handleCreateUser = async () => {
    if (!newUserName || !newUserPassword) return alert('Nome e Senha são obrigatórios.');
    
    setIsSaving(true);
    const userId = 'USR_' + Math.random().toString(36).substr(2, 6).toUpperCase();
    
    // Objeto do novo usuário
    const newUser: User = {
      id: userId,
      name: newUserName,
      role: newUserRole,
      password: newUserPassword,
      photo: newUserPhoto
    };

    try {
      // 1. Salvar no Supabase (Tabela users)
      if (tenantId) {
        const res = await OnlineDB.upsertUser(tenantId, settings.storeName, newUser);
        if (!res.success) throw new Error(res.message);
        
        // Se salvou com sucesso no SQL, informa o login gerado
        triggerSaveFeedback(`Acesso SQL Criado! Login: ${res.username}`);
      }

      // 2. Atualizar lista local de perfis
      const updatedUsers = [...settings.users, newUser];
      const updatedSettings = { ...settings, users: updatedUsers };
      setSettings(updatedSettings);

      setIsUserModalOpen(false);
      setNewUserName('');
      setNewUserPassword('');
      setNewUserPhoto(null);
    } catch (e: any) {
      alert("Erro ao criar usuário na nuvem: " + e.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteUser = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isAdmin) return;
    if (id === 'adm_1') return alert('O administrador master não pode ser excluído.');
    
    if (confirm('Deseja excluir este perfil permanentemente da nuvem?')) {
      setIsSaving(true);
      const res = await OnlineDB.deleteRemoteUser(id);
      if (res.success) {
        const updatedUsers = settings.users.filter(u => u.id !== id);
        updateSetting('users', updatedUsers);
        triggerSaveFeedback("Perfil Removido!");
      } else {
        alert("Erro ao remover usuário do SQL.");
      }
      setIsSaving(false);
    }
  };

  if (view === 'users') {
    return (
      <div className="space-y-6 animate-in slide-in-from-right-10 duration-500">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            {isAdmin && <button onClick={() => setView('main')} className="p-3 bg-white shadow-sm border border-slate-100 rounded-2xl text-slate-600 active:scale-90 transition-all"><ArrowLeft size={24} /></button>}
            <h2 className="text-2xl font-black text-slate-800 tracking-tight uppercase">Alternar Perfil</h2>
          </div>
          {isAdmin && (
            <button onClick={() => setIsUserModalOpen(true)} className="p-3 bg-slate-900 text-white rounded-2xl shadow-lg active:scale-90">
              <UserPlus size={24} />
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {settings.users.map(user => (
            <div key={user.id} onClick={() => onSwitchProfile(user)} className={`p-6 rounded-[2.5rem] border transition-all cursor-pointer group relative flex items-center justify-between ${user.id === currentUser.id ? 'bg-white border-blue-500 shadow-xl ring-4 ring-blue-50' : 'bg-white/50 border-slate-100 shadow-sm hover:border-blue-200'}`}>
              <div className="flex items-center gap-4">
                <div className="relative">
                  {user.photo ? (
                    <img src={user.photo} className="w-16 h-16 rounded-3xl object-cover border-2 border-white shadow-md" />
                  ) : (
                    <div className="w-16 h-16 bg-slate-50 text-slate-200 rounded-3xl flex items-center justify-center border-2 border-white shadow-md"><UserIcon size={32} /></div>
                  )}
                  {user.role === 'admin' && <div className="absolute -bottom-1 -right-1 bg-blue-600 text-white p-1 rounded-lg border-2 border-white"><Shield size={12} /></div>}
                </div>
                <div>
                  <h3 className={`font-black uppercase text-xs ${user.id === currentUser.id ? 'text-blue-600' : 'text-slate-800'}`}>{user.name}</h3>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{user.role}</p>
                </div>
              </div>
              {isAdmin && user.id !== currentUser.id && user.id !== 'adm_1' && (
                <button onClick={(e) => handleDeleteUser(user.id, e)} className="p-3 text-red-400 hover:text-red-600 bg-red-50 rounded-2xl transition-colors">
                  <Trash2 size={20} />
                </button>
              )}
              {user.id === currentUser.id && (
                <span className="text-[8px] font-black text-white bg-blue-600 px-3 py-1 rounded-full uppercase tracking-widest shadow-lg shadow-blue-500/30">Ativo</span>
              )}
            </div>
          ))}
        </div>

        {!isAdmin && (
          <div className="p-8 bg-blue-50 rounded-[2.5rem] border border-blue-100 text-center space-y-3">
             <Shield size={32} className="text-blue-500 mx-auto" />
             <p className="text-[10px] font-black text-blue-800 uppercase tracking-widest">Painel de Colaborador</p>
             <p className="text-[9px] text-blue-400 font-bold uppercase leading-relaxed">Configurações globais e financeiro<br/>são acessíveis apenas para Administradores.</p>
          </div>
        )}

        {isUserModalOpen && isAdmin && (
          <div className="fixed inset-0 bg-slate-950/80 z-[100] flex flex-col justify-end md:justify-center p-4 backdrop-blur-md">
            <div className="bg-white w-full max-w-sm mx-auto rounded-[3rem] shadow-2xl overflow-hidden animate-in slide-in-from-bottom-10">
              <div className="p-8 border-b border-slate-50 flex items-center justify-between">
                <h3 className="text-xl font-black text-slate-800 uppercase tracking-tighter">Novo Acesso SQL</h3>
                <button onClick={() => setIsUserModalOpen(false)} className="text-slate-400 p-2 bg-slate-50 rounded-full"><X size={20} /></button>
              </div>
              <div className="p-8 space-y-6 max-h-[75vh] overflow-y-auto pb-12">
                <div className="flex flex-col items-center gap-3">
                  <button onClick={triggerUserPhotoUpload} className="relative active:scale-95 transition-transform group">
                    <div className="w-24 h-24 bg-slate-50 rounded-[2rem] border-4 border-dashed border-slate-200 flex items-center justify-center overflow-hidden">
                      {newUserPhoto ? <img src={newUserPhoto} className="w-full h-full object-cover" /> : <Camera className="text-slate-200" size={32} />}
                    </div>
                  </button>
                </div>
                <div className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Nome Completo</label>
                    <input value={newUserName} onChange={(e) => setNewUserName(e.target.value)} placeholder="NOME DO COLABORADOR" className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none font-black uppercase text-xs" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Senha de Login</label>
                    <div className="flex items-center gap-2 bg-slate-50 border border-slate-100 rounded-2xl px-5">
                      <Lock size={14} className="text-slate-300" />
                      <input type="text" value={newUserPassword} onChange={(e) => setNewUserPassword(e.target.value)} placeholder="DEFINIR SENHA" className="w-full py-4 bg-transparent outline-none font-black text-xs" />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Função</label>
                    <div className="flex gap-2">
                      <button onClick={() => setNewUserRole('tecnico')} className={`flex-1 py-4 rounded-2xl font-black text-[9px] tracking-widest uppercase transition-all ${newUserRole === 'tecnico' ? 'bg-blue-600 text-white shadow-lg' : 'bg-slate-50 text-slate-400'}`}>TÉCNICO</button>
                      <button onClick={() => setNewUserRole('vendedor')} className={`flex-1 py-4 rounded-2xl font-black text-[9px] tracking-widest uppercase transition-all ${newUserRole === 'vendedor' ? 'bg-blue-600 text-white shadow-lg' : 'bg-slate-50 text-slate-400'}`}>VENDEDOR</button>
                    </div>
                  </div>
                </div>
                <button onClick={handleCreateUser} disabled={!newUserName || !newUserPassword || isSaving} className="w-full py-5 bg-slate-900 text-white rounded-[1.5rem] font-black uppercase text-[10px] tracking-widest disabled:opacity-30 flex items-center justify-center gap-3">
                  {isSaving ? <Loader2 className="animate-spin" size={18} /> : 'Salvar no SQL Cloud'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (!isAdmin) return null;

  if (view === 'theme') {
    return (
      <div className="space-y-6 animate-in slide-in-from-right-10 duration-500">
        <div className="flex items-center gap-4 mb-8">
          <button onClick={() => setView('main')} className="p-3 bg-white shadow-sm border border-slate-100 rounded-2xl text-slate-600 active:scale-90 transition-all"><ArrowLeft size={24} /></button>
          <h2 className="text-2xl font-black text-slate-800 tracking-tight">CORES DO APP</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[
            { label: 'Cor Primária', key: 'themePrimary', icon: Palette },
            { label: 'Cor do Menu Lateral', key: 'themeSidebar', icon: Layout },
            { label: 'Cor de Fundo App', key: 'themeBg', icon: Pipette },
            { label: 'Cor Abas Mobile', key: 'themeBottomTab', icon: MoveHorizontal },
          ].map((item) => (
            <div key={item.key} className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-slate-50 text-slate-400 rounded-xl"><item.icon size={20} /></div>
                <p className="font-black text-slate-800 text-xs uppercase tracking-widest">{item.label}</p>
              </div>
              <input 
                type="color" 
                value={(settings as any)[item.key] || '#000000'} 
                onChange={(e) => updateSetting(item.key as any, e.target.value)}
                className="w-full h-12 rounded-xl cursor-pointer bg-transparent border-0"
              />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (view === 'print') {
    return (
      <div className="space-y-6 animate-in slide-in-from-right-10 duration-500">
        <div className="flex items-center gap-4 mb-8">
          <button onClick={() => setView('main')} className="p-3 bg-white shadow-sm border border-slate-100 rounded-2xl text-slate-600 active:scale-90 transition-all"><ArrowLeft size={24} /></button>
          <h2 className="text-2xl font-black text-slate-800 tracking-tight">CONFIGURAR CUPOM</h2>
        </div>
        <div className="bg-white rounded-[3rem] p-8 space-y-8 shadow-sm border border-slate-100">
          <div className="space-y-3">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Texto de Garantia</label>
            <textarea value={settings.pdfWarrantyText} onChange={(e) => updateSetting('pdfWarrantyText', e.target.value)} rows={3} className="w-full px-6 py-5 bg-slate-50 border border-slate-100 rounded-3xl outline-none text-sm font-medium" />
          </div>
          <button onClick={() => setView('main')} className="w-full py-5 bg-slate-900 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest">Salvar Cupom</button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500 relative">
      {saveMessage && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[100] animate-in slide-in-from-top-4 fade-in">
           <div className="bg-emerald-500 text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-3 border border-white/20">
              {isSaving ? <Loader2 className="animate-spin" size={16} /> : <Check size={16} />}
              <span className="text-[10px] font-black uppercase tracking-widest">{saveMessage}</span>
           </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-black text-slate-800 tracking-tight">AJUSTES GLOBAIS</h2>
        <div className="relative">
          <button onClick={() => setShowMenu(!showMenu)} className="p-4 bg-white border border-slate-100 rounded-2xl text-slate-400 active:scale-90"><MoreVertical size={24} /></button>
          {showMenu && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
              <div className="absolute right-0 mt-3 w-72 bg-white border border-slate-100 rounded-[2rem] shadow-2xl z-50 py-4">
                <button onClick={() => { setView('theme'); setShowMenu(false); }} className="w-full flex items-center gap-4 px-6 py-4 text-[10px] font-black text-slate-600 hover:bg-slate-50 transition-colors uppercase tracking-widest text-left">
                  <Palette size={18} /> Cores do Sistema
                </button>
                <button onClick={() => { setView('print'); setShowMenu(false); }} className="w-full flex items-center gap-4 px-6 py-4 text-[10px] font-black text-slate-600 hover:bg-slate-50 transition-colors uppercase tracking-widest text-left">
                  <FileText size={18} /> Layout Cupom
                </button>
                <button onClick={() => { setView('users'); setShowMenu(false); }} className="w-full flex items-center gap-4 px-6 py-4 text-[10px] font-black text-slate-600 hover:bg-slate-50 transition-colors uppercase tracking-widest text-left">
                  <Users size={18} /> Gerir Colaboradores
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="max-w-2xl mx-auto space-y-12 py-10">
        <div className="flex flex-col items-center gap-6">
          <button onClick={triggerUpload} className="relative group">
            <div className="w-44 h-44 bg-white rounded-[3rem] border-[8px] border-white shadow-2xl flex items-center justify-center overflow-hidden ring-1 ring-slate-100">
              {settings.logoUrl ? <img src={settings.logoUrl} className="w-full h-full object-cover" /> : <ImageIcon size={64} className="text-slate-200" />}
            </div>
            <div className="absolute -bottom-3 -right-3 bg-blue-600 text-white p-4 rounded-3xl border-4 border-white shadow-xl group-hover:scale-110 transition-all"><Camera size={20} /></div>
          </button>
          <div className="w-full text-center space-y-4">
             <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Nome da Assistência</label>
             <input type="text" value={settings.storeName} onChange={(e) => updateSetting('storeName', e.target.value)} className="w-full px-8 py-6 bg-white border-none rounded-[2.5rem] font-black text-3xl text-slate-800 text-center shadow-sm outline-none" />
          </div>
        </div>

        <div className={`p-8 rounded-[2.5rem] border flex items-center gap-5 transition-colors duration-300 ${isCloudConnected ? 'bg-emerald-50/50 border-emerald-100' : 'bg-red-50/50 border-red-100'}`}>
            <div className={`w-14 h-14 text-white rounded-2xl flex items-center justify-center shadow-lg shrink-0 ${isCloudConnected ? 'bg-emerald-500' : 'bg-red-500'}`}>
              {isCloudConnected ? <Check size={28} /> : <AlertCircle size={28} />}
            </div>
            <div>
              <p className={`text-xs font-bold ${isCloudConnected ? 'text-emerald-800' : 'text-red-800'}`}>
                {isCloudConnected ? 'Sincronizado na Nuvem' : 'Operando em Banco Local (Offline)'}
              </p>
              <p className="text-[8px] text-slate-400 uppercase tracking-widest mt-1 font-black">Infraestrutura SQL Pro</p>
            </div>
         </div>
      </div>
    </div>
  );
};

export default SettingsTab;
