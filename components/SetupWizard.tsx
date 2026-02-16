
import React, { useState } from 'react';
import { ShieldCheck, UserPlus, Camera, CheckCircle2, Store, Lock, ArrowRight, User as UserIcon } from 'lucide-react';
import { AppSettings, User } from '../types';

interface Props {
  onComplete: (settings: AppSettings) => void;
}

const SetupWizard: React.FC<Props> = ({ onComplete }) => {
  const [step, setStep] = useState(1);
  const [storeName, setStoreName] = useState('');
  const [adminName, setAdminName] = useState('');
  const [adminPass, setAdminPass] = useState('');
  const [adminPhoto, setAdminPhoto] = useState<string | null>(null);
  const [user2Name, setUser2Name] = useState('');
  const [user2Role, setUser2Role] = useState<'vendedor' | 'tecnico'>('tecnico');
  const [user2Photo, setUser2Photo] = useState<string | null>(null);
  const [showGratitude, setShowGratitude] = useState(false);

  const triggerUpload = (target: 'admin' | 'user2') => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e: any) => {
      const file = e.target.files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64 = reader.result as string;
          if (target === 'admin') setAdminPhoto(base64);
          else setUser2Photo(base64);
        };
        reader.readAsDataURL(file);
      }
    };
    input.click();
  };

  const handleFinalize = () => {
    const admin: User = { id: 'admin_1', name: adminName, role: 'admin', password: adminPass, photo: adminPhoto };
    const users = [admin];
    if (user2Name) { users.push({ id: 'user_2', name: user2Name, role: user2Role, photo: user2Photo }); }
    const initialSettings: AppSettings = {
      storeName: storeName || 'Minha Assistência', logoUrl: null, users: users, isConfigured: true,
      pdfWarrantyText: "Concede-se garantia pelo prazo de 90 (noventa) dias...",
      pdfFontSize: 8, pdfFontFamily: 'helvetica', pdfPaperWidth: 80, pdfTextColor: '#000000', pdfBgColor: '#FFFFFF'
    };
    setShowGratitude(true);
    setTimeout(() => { onComplete(initialSettings); }, 2500);
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      {!showGratitude ? (
        <div className="w-full max-w-md bg-white rounded-[2.5rem] shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-500">
          <div className="bg-blue-600 p-8 text-white text-center relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-2xl" />
            <h2 className="text-2xl font-black mb-1">Bem-vindo!</h2>
            <p className="text-blue-100 font-bold uppercase tracking-widest text-[9px] opacity-80">Configuração do Sistema</p>
            <div className="flex justify-center gap-1.5 mt-6">
              <div className={`h-1.5 rounded-full transition-all duration-300 ${step === 1 ? 'w-8 bg-white' : 'w-4 bg-blue-800'}`} />
              <div className={`h-1.5 rounded-full transition-all duration-300 ${step === 2 ? 'w-8 bg-white' : 'w-4 bg-blue-800'}`} />
            </div>
          </div>

          <div className="p-8">
            {step === 1 ? (
              <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                <div className="flex flex-col items-center gap-4">
                  <div className="relative group">
                    <button 
                      onClick={() => triggerUpload('admin')}
                      className="w-28 h-28 bg-slate-50 rounded-full border-4 border-slate-100 flex items-center justify-center overflow-hidden transition-all active:scale-90 shadow-inner"
                    >
                      {adminPhoto ? (
                        <img src={adminPhoto} className="w-full h-full object-cover" />
                      ) : (
                        <UserIcon className="text-slate-200" size={40} />
                      )}
                    </button>
                    <div className="absolute bottom-1 right-1 bg-blue-600 text-white p-2 rounded-full border-4 border-white shadow-lg pointer-events-none">
                      <Camera size={14} />
                    </div>
                  </div>
                  <div className="text-center">
                    <h3 className="text-lg font-black text-slate-800">Perfil do Administrador</h3>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Toque para adicionar foto</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Nome Comercial</label>
                    <div className="flex items-center gap-3 px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus-within:ring-2 focus-within:ring-blue-500/20 transition-all">
                      <Store size={18} className="text-slate-300" />
                      <input value={storeName} onChange={(e) => setStoreName(e.target.value)} placeholder="Sua Loja" className="bg-transparent w-full outline-none font-bold text-slate-800" />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Nome do Gestor</label>
                    <input value={adminName} onChange={(e) => setAdminName(e.target.value)} placeholder="Seu Nome" className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none font-bold text-slate-800 focus:ring-2 focus:ring-blue-500/20" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Senha de Segurança</label>
                    <div className="flex items-center gap-3 px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus-within:ring-2 focus-within:ring-blue-500/20">
                      <Lock size={18} className="text-slate-300" />
                      <input type="password" value={adminPass} onChange={(e) => setAdminPass(e.target.value)} placeholder="••••••" className="bg-transparent w-full outline-none font-bold" />
                    </div>
                  </div>
                </div>

                <button 
                  disabled={!adminName || !adminPass || !storeName}
                  onClick={() => setStep(2)}
                  className="w-full py-5 bg-blue-600 text-white rounded-2xl font-black shadow-xl shadow-blue-500/20 active:scale-95 transition-all disabled:opacity-40 flex items-center justify-center gap-2 text-xs uppercase tracking-widest"
                >
                  Próximo <ArrowRight size={18} />
                </button>
              </div>
            ) : (
              <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                <div className="flex flex-col items-center gap-4">
                  <div className="relative">
                    <button 
                      onClick={() => triggerUpload('user2')}
                      className="w-28 h-28 bg-slate-50 rounded-full border-4 border-slate-100 flex items-center justify-center overflow-hidden transition-all active:scale-90 shadow-inner"
                    >
                      {user2Photo ? (
                        <img src={user2Photo} className="w-full h-full object-cover" />
                      ) : (
                        <UserPlus className="text-slate-200" size={40} />
                      )}
                    </button>
                    <div className="absolute bottom-1 right-1 bg-emerald-500 text-white p-2 rounded-full border-4 border-white shadow-lg pointer-events-none">
                      <Camera size={14} />
                    </div>
                  </div>
                  <div className="text-center">
                    <h3 className="text-lg font-black text-slate-800">Primeiro Colaborador</h3>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Toque para adicionar foto</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Nome do Funcionário</label>
                    <input value={user2Name} onChange={(e) => setUser2Name(e.target.value)} placeholder="Ex: João Vendedor" className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none font-bold focus:ring-2 focus:ring-emerald-500/20" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Função</label>
                    <div className="flex gap-2">
                      <button onClick={() => setUser2Role('tecnico')} className={`flex-1 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all ${user2Role === 'tecnico' ? 'bg-blue-600 text-white shadow-lg' : 'bg-slate-100 text-slate-400'}`}>TÉCNICO</button>
                      <button onClick={() => setUser2Role('vendedor')} className={`flex-1 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all ${user2Role === 'vendedor' ? 'bg-blue-600 text-white shadow-lg' : 'bg-slate-100 text-slate-400'}`}>VENDEDOR</button>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-3">
                  <button onClick={handleFinalize} className="w-full py-5 bg-slate-900 text-white rounded-2xl font-black shadow-xl shadow-slate-950/20 active:scale-95 transition-all text-xs uppercase tracking-widest">Finalizar Agora</button>
                  <button onClick={handleFinalize} className="text-[10px] font-black text-slate-300 hover:text-slate-500 transition-colors uppercase tracking-widest text-center">Pular Cadastro por Enquanto</button>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="text-center animate-in zoom-in-95 duration-500">
          <div className="w-24 h-24 bg-emerald-500 text-white rounded-full flex items-center justify-center mx-auto mb-6 shadow-[0_0_50px_rgba(16,185,129,0.3)] animate-bounce">
            <CheckCircle2 size={48} />
          </div>
          <h2 className="text-3xl font-black text-white mb-2">Sucesso Total!</h2>
          <p className="text-slate-400 font-medium">Iniciando sua jornada profissional...</p>
        </div>
      )}
    </div>
  );
};

export default SetupWizard;
