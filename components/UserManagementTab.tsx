
import React, { useState, useRef } from 'react';
import { UserPlus, Trash2, Shield, Camera, X, User as UserIcon, Check } from 'lucide-react';
import { AppSettings, User } from '../types';

interface Props {
  settings: AppSettings;
  setSettings: (settings: AppSettings) => void;
  currentUser: User;
  onSwitchProfile: (user: User) => void;
}

const UserManagementTab: React.FC<Props> = ({ settings, setSettings, currentUser, onSwitchProfile }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState<'tecnico' | 'vendedor'>('tecnico');
  const [newPhoto, setNewPhoto] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setNewPhoto(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleCreateUser = () => {
    if (!newName) return alert('Nome é obrigatório');
    const newUser: User = {
      id: Math.random().toString(36).substr(2, 9),
      name: newName,
      role: newRole,
      photo: newPhoto
    };
    setSettings({ ...settings, users: [...settings.users, newUser] });
    setIsModalOpen(false);
    setNewName('');
    setNewPhoto(null);
  };

  const handleDeleteUser = (id: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Impede a troca de perfil ao clicar no excluir
    if (id === 'admin_1') return alert('O administrador principal não pode ser excluído.');
    if (confirm('Deseja excluir este perfil?')) {
      setSettings({ ...settings, users: settings.users.filter(u => u.id !== id) });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-slate-800">Gerenciar Perfis</h2>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-blue-100"
        >
          <UserPlus size={18} /> Novo Usuário
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {settings.users.map(user => (
          <div 
            key={user.id} 
            onClick={() => onSwitchProfile(user)}
            className={`p-6 rounded-3xl border transition-all cursor-pointer group relative flex items-center justify-between ${user.id === currentUser.id ? 'bg-blue-50 border-blue-200 ring-2 ring-blue-100 shadow-md' : 'bg-white border-slate-100 shadow-sm hover:border-blue-300'}`}
          >
            <div className="flex items-center gap-4">
              <div className="relative">
                {user.photo ? (
                  <img src={user.photo} className="w-14 h-14 rounded-full object-cover border-2 border-white shadow-md" />
                ) : (
                  <div className="w-14 h-14 bg-slate-50 text-slate-300 rounded-full flex items-center justify-center border-2 border-white shadow-md"><UserIcon size={24} /></div>
                )}
                {user.role === 'admin' && <div className="absolute -bottom-1 -right-1 bg-blue-600 text-white p-1 rounded-full border-2 border-white"><Shield size={10} /></div>}
                {user.id === currentUser.id && <div className="absolute -top-1 -right-1 bg-emerald-500 text-white p-1 rounded-full border-2 border-white"><Check size={10} /></div>}
              </div>
              <div>
                <h3 className={`font-bold ${user.id === currentUser.id ? 'text-blue-800' : 'text-slate-800'}`}>{user.name}</h3>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{user.role}</p>
              </div>
            </div>
            
            {user.id !== currentUser.id && user.id !== 'admin_1' && (
              <button 
                onClick={(e) => handleDeleteUser(user.id, e)} 
                className="p-3 text-slate-300 hover:text-red-500 bg-slate-50 rounded-2xl transition-colors opacity-0 group-hover:opacity-100"
              >
                <Trash2 size={20} />
              </button>
            )}

            {user.id === currentUser.id && (
              <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest bg-blue-100 px-2 py-1 rounded-lg">Atual</span>
            )}
          </div>
        ))}
      </div>

      <p className="text-[10px] text-slate-400 font-bold italic text-center">
        * Clique em um perfil para trocar. Usuários não administradores precisam da senha ADM para efetuar a troca.
      </p>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100] p-6 backdrop-blur-sm">
          <div className="bg-white w-full max-w-sm rounded-[40px] shadow-2xl overflow-hidden animate-in zoom-in-95">
            <div className="p-8 border-b border-slate-50 flex items-center justify-between">
              <h3 className="text-xl font-black text-slate-800">Novo Perfil</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 p-2"><X size={24} /></button>
            </div>
            <div className="p-8 space-y-6">
              <div className="flex flex-col items-center gap-3">
                <div 
                  onClick={() => fileInputRef.current?.click()}
                  className="w-24 h-24 bg-slate-50 rounded-full border-4 border-dashed border-slate-200 flex items-center justify-center overflow-hidden cursor-pointer"
                >
                  {newPhoto ? <img src={newPhoto} className="w-full h-full object-cover" /> : <Camera className="text-slate-300" size={32} />}
                </div>
                <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handlePhotoUpload} />
                <span className="text-[10px] font-black text-slate-400 uppercase">Foto do Perfil</span>
              </div>
              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Nome Completo</label>
                  <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Ex: João Silva" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-bold" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Cargo</label>
                  <div className="flex gap-2">
                    <button onClick={() => setNewRole('tecnico')} className={`flex-1 py-3 rounded-2xl font-bold text-xs ${newRole === 'tecnico' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-400'}`}>TÉCNICO</button>
                    <button onClick={() => setNewRole('vendedor')} className={`flex-1 py-3 rounded-2xl font-bold text-xs ${newRole === 'vendedor' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-400'}`}>VENDEDOR</button>
                  </div>
                </div>
              </div>
              <button 
                onClick={handleCreateUser}
                className="w-full py-4 bg-blue-600 text-white rounded-2xl font-black shadow-xl shadow-blue-200 active:scale-95 transition-all"
              >
                Criar Perfil
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserManagementTab;
