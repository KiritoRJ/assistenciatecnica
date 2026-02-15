
import React, { useState, useRef } from 'react';
import { ShieldCheck, UserPlus, Camera, CheckCircle2, Store, Lock, ArrowRight } from 'lucide-react';
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

  const fileInputRef = useRef<HTMLInputElement>(null);
  const user2InputRef = useRef<HTMLInputElement>(null);

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>, target: 'admin' | 'user2') => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (target === 'admin') setAdminPhoto(reader.result as string);
        else setUser2Photo(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleFinalize = () => {
    const admin: User = {
      id: 'admin_1',
      name: adminName,
      role: 'admin',
      password: adminPass,
      photo: adminPhoto
    };

    const users = [admin];
    if (user2Name) {
      users.push({
        id: 'user_2',
        name: user2Name,
        role: user2Role,
        photo: user2Photo
      });
    }

    const initialSettings: AppSettings = {
      storeName: storeName || 'Minha Assistência',
      logoUrl: null,
      users: users,
      isConfigured: true,
      pdfWarrantyText: "Concede-se garantia pelo prazo de 90 (noventa) dias...",
      pdfFontSize: 8,
      pdfFontFamily: 'helvetica',
      pdfPaperWidth: 80,
      pdfTextColor: '#000000',
      pdfBgColor: '#FFFFFF'
    };

    setShowGratitude(true);
    setTimeout(() => {
      onComplete(initialSettings);
    }, 3000);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      {!showGratitude ? (
        <div className="w-full max-w-md bg-white rounded-[40px] shadow-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-10 duration-700">
          <div className="bg-blue-600 p-8 text-white text-center">
            <h2 className="text-2xl font-black mb-1">Boas-vindas!</h2>
            <p className="text-blue-100 font-bold uppercase tracking-widest text-[10px]">Configuração Inicial do Sistema</p>
            
            <div className="flex justify-center gap-2 mt-6">
              <div className={`w-10 h-1.5 rounded-full ${step >= 1 ? 'bg-white' : 'bg-blue-800'}`} />
              <div className={`w-10 h-1.5 rounded-full ${step >= 2 ? 'bg-white' : 'bg-blue-800'}`} />
            </div>
          </div>

          <div className="p-8">
            {step === 1 ? (
              <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
                <div className="flex items-center gap-3 text-blue-600 mb-4">
                  <ShieldCheck size={32} />
                  <h3 className="text-xl font-bold">Passo 1: Perfil ADM</h3>
                </div>
                
                <div className="flex flex-col items-center gap-3">
                  <div 
                    onClick={() => fileInputRef.current?.click()}
                    className="w-24 h-24 bg-slate-100 rounded-full border-4 border-dashed border-slate-200 flex items-center justify-center overflow-hidden cursor-pointer hover:border-blue-300 transition-colors"
                  >
                    {adminPhoto ? <img src={adminPhoto} className="w-full h-full object-cover" /> : <Camera className="text-slate-300" size={32} />}
                  </div>
                  <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={(e) => handlePhotoUpload(e, 'admin')} />
                  <span className="text-[10px] font-black text-slate-400 uppercase">Foto do Administrador</span>
                </div>

                <div className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Nome da Sua Loja</label>
                    <div className="flex items-center gap-2 px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl">
                      <Store size={18} className="text-slate-400" />
                      <input value={storeName} onChange={(e) => setStoreName(e.target.value)} placeholder="Ex: SmartFix Pro" className="bg-transparent w-full outline-none font-bold" />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Seu Nome (ADM)</label>
                    <input value={adminName} onChange={(e) => setAdminName(e.target.value)} placeholder="Digite seu nome completo" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-bold" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Senha do Financeiro</label>
                    <div className="flex items-center gap-2 px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl">
                      <Lock size={18} className="text-slate-400" />
                      <input type="password" value={adminPass} onChange={(e) => setAdminPass(e.target.value)} placeholder="Crie uma senha forte" className="bg-transparent w-full outline-none font-bold" />
                    </div>
                  </div>
                </div>

                <button 
                  disabled={!adminName || !adminPass || !storeName}
                  onClick={() => setStep(2)}
                  className="w-full py-4 bg-blue-600 text-white rounded-2xl font-black shadow-xl shadow-blue-200 active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  Continuar <ArrowRight size={20} />
                </button>
              </div>
            ) : (
              <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
                <div className="flex items-center gap-3 text-blue-600 mb-4">
                  <UserPlus size={32} />
                  <h3 className="text-xl font-bold">Passo 2: Primeiro Usuário</h3>
                </div>

                <div className="flex flex-col items-center gap-3">
                  <div 
                    onClick={() => user2InputRef.current?.click()}
                    className="w-24 h-24 bg-slate-100 rounded-full border-4 border-dashed border-slate-200 flex items-center justify-center overflow-hidden cursor-pointer hover:border-blue-300 transition-colors"
                  >
                    {user2Photo ? <img src={user2Photo} className="w-full h-full object-cover" /> : <Camera className="text-slate-300" size={32} />}
                  </div>
                  <input type="file" ref={user2InputRef} className="hidden" accept="image/*" onChange={(e) => handlePhotoUpload(e, 'user2')} />
                  <span className="text-[10px] font-black text-slate-400 uppercase">Foto do Usuário (Opcional)</span>
                </div>

                <div className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Nome do Funcionário</label>
                    <input value={user2Name} onChange={(e) => setUser2Name(e.target.value)} placeholder="Nome do vendedor ou técnico" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-bold" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Cargo / Função</label>
                    <div className="flex gap-2">
                      <button onClick={() => setUser2Role('tecnico')} className={`flex-1 py-3 rounded-2xl font-bold text-xs ${user2Role === 'tecnico' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-400'}`}>TÉCNICO</button>
                      <button onClick={() => setUser2Role('vendedor')} className={`flex-1 py-3 rounded-2xl font-bold text-xs ${user2Role === 'vendedor' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-400'}`}>VENDEDOR</button>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-3">
                  <button 
                    onClick={handleFinalize}
                    className="w-full py-4 bg-blue-600 text-white rounded-2xl font-black shadow-xl shadow-blue-200 active:scale-95 transition-all"
                  >
                    Finalizar Configuração
                  </button>
                  <button onClick={handleFinalize} className="text-xs font-bold text-slate-400 uppercase tracking-widest">Pular por enquanto</button>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="text-center animate-in zoom-in-95 duration-500">
          <div className="w-24 h-24 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-xl shadow-emerald-100">
            <CheckCircle2 size={56} />
          </div>
          <h2 className="text-3xl font-black text-slate-800 mb-2">Tudo pronto!</h2>
          <p className="text-slate-500 font-medium">Muito obrigado por escolher nosso sistema.<br/>Desejamos sucesso em seu negócio!</p>
          <div className="mt-8 flex justify-center">
            <div className="w-12 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
          </div>
        </div>
      )}
    </div>
  );
};

export default SetupWizard;
