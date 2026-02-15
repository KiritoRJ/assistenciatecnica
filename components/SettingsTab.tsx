
import React, { useState, useRef } from 'react';
import { Store, Image as ImageIcon, Trash2, Camera, FileText, Type, Palette, MoveHorizontal, MoreVertical, ArrowLeft, Check } from 'lucide-react';
import { AppSettings } from '../types';

interface Props {
  settings: AppSettings;
  setSettings: (settings: AppSettings) => void;
}

const SettingsTab: React.FC<Props> = ({ settings, setSettings }) => {
  const [view, setView] = useState<'main' | 'print'>('main');
  const [showMenu, setShowMenu] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const updateSetting = (key: keyof AppSettings, value: any) => {
    setSettings({ ...settings, [key]: value });
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        updateSetting('logoUrl', reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  if (view === 'print') {
    return (
      <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
        <div className="flex items-center gap-4 mb-2">
          <button 
            onClick={() => setView('main')}
            className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-600 active:scale-90"
          >
            <ArrowLeft size={24} />
          </button>
          <h2 className="text-2xl font-black text-slate-800">Impressão</h2>
        </div>

        <div className="bg-white rounded-[40px] shadow-sm border border-slate-100 overflow-hidden">
          <div className="p-8 space-y-8">
            <div className="space-y-3">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Termos de Garantia</label>
              <textarea 
                value={settings.pdfWarrantyText}
                onChange={(e) => updateSetting('pdfWarrantyText', e.target.value)}
                rows={6}
                className="w-full px-6 py-5 bg-slate-50 border border-slate-200 rounded-3xl focus:ring-4 focus:ring-blue-500/10 outline-none text-sm leading-relaxed font-medium transition-all"
                placeholder="Descreva os termos de garantia aqui..."
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-5">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2 ml-1"><Type size={14} /> Fonte do PDF</label>
                  <select 
                    value={settings.pdfFontFamily}
                    onChange={(e) => updateSetting('pdfFontFamily', e.target.value)}
                    className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-blue-500/10 outline-none font-bold text-slate-700 appearance-none"
                  >
                    <option value="helvetica">Helvetica</option>
                    <option value="courier">Courier</option>
                    <option value="times">Times New Roman</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Tamanho da Letra</label>
                  <input 
                    type="number"
                    value={settings.pdfFontSize}
                    onChange={(e) => updateSetting('pdfFontSize', parseInt(e.target.value) || 8)}
                    className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-blue-500/10 outline-none font-bold"
                  />
                </div>
              </div>

              <div className="space-y-5">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2 ml-1"><MoveHorizontal size={14} /> Largura (mm)</label>
                  <div className="flex gap-2">
                    <input 
                      type="number"
                      value={settings.pdfPaperWidth}
                      onChange={(e) => updateSetting('pdfPaperWidth', parseInt(e.target.value) || 80)}
                      className="flex-1 px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-blue-500/10 outline-none font-bold"
                    />
                    <div className="flex gap-1 bg-slate-100 p-1.5 rounded-2xl self-center">
                      <button onClick={() => updateSetting('pdfPaperWidth', 80)} className={`px-4 py-2 text-[10px] font-black rounded-xl transition-all ${settings.pdfPaperWidth === 80 ? 'bg-white shadow-sm text-blue-600' : 'text-slate-400'}`}>80</button>
                      <button onClick={() => updateSetting('pdfPaperWidth', 58)} className={`px-4 py-2 text-[10px] font-black rounded-xl transition-all ${settings.pdfPaperWidth === 58 ? 'bg-white shadow-sm text-blue-600' : 'text-slate-400'}`}>58</button>
                    </div>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2 ml-1"><Palette size={14} /> Cor Texto</label>
                    <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 p-3 rounded-2xl h-[58px]">
                      <input type="color" value={settings.pdfTextColor} onChange={(e) => updateSetting('pdfTextColor', e.target.value)} className="w-8 h-8 rounded-lg cursor-pointer bg-transparent border-0" />
                      <span className="text-[10px] font-black text-slate-400 uppercase font-mono">{settings.pdfTextColor}</span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2 ml-1"><Palette size={14} /> Cor Fundo</label>
                    <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 p-3 rounded-2xl h-[58px]">
                      <input type="color" value={settings.pdfBgColor} onChange={(e) => updateSetting('pdfBgColor', e.target.value)} className="w-8 h-8 rounded-lg cursor-pointer bg-transparent border-0" />
                      <span className="text-[10px] font-black text-slate-400 uppercase font-mono">{settings.pdfBgColor}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="px-8 py-5 bg-slate-50 border-t border-slate-100 flex items-center justify-center gap-2">
             <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
             <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Alterações salvas automaticamente</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-10">
      <div className="flex items-center justify-between relative">
        <h2 className="text-2xl font-black text-slate-800">Loja</h2>
        
        <div className="relative">
          <button 
            onClick={() => setShowMenu(!showMenu)}
            className="p-3 hover:bg-white border border-transparent hover:border-slate-200 rounded-2xl transition-all text-slate-500 active:scale-95"
          >
            <MoreVertical size={24} />
          </button>
          
          {showMenu && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
              <div className="absolute right-0 mt-2 w-64 bg-white border border-slate-200 rounded-3xl shadow-2xl z-50 py-3 animate-in fade-in zoom-in-95 duration-200 overflow-hidden">
                <button 
                  onClick={() => { setView('print'); setShowMenu(false); }}
                  className="w-full flex items-center gap-3 px-5 py-4 text-sm font-black text-slate-700 hover:bg-slate-50 transition-colors uppercase tracking-tight"
                >
                  <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                    <FileText size={18} />
                  </div>
                  Opções de Impressão
                </button>
                <div className="border-t border-slate-50 my-2" />
                <div className="px-6 py-2">
                  <p className="text-[9px] font-black text-slate-300 uppercase tracking-[0.2em] italic">Versão v3.0 stable</p>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="max-w-md mx-auto w-full space-y-12">
        {/* Identidade Visual - Logo em Círculo acima e Nome abaixo */}
        <div className="flex flex-col items-center gap-10">
          <div className="relative group">
            <div 
              onClick={() => fileInputRef.current?.click()}
              className="w-36 h-36 md:w-48 md:h-48 bg-white rounded-full border-[6px] border-white shadow-[0_20px_50px_rgba(0,0,0,0.1)] flex items-center justify-center overflow-hidden cursor-pointer transition-all active:scale-95 group-hover:shadow-[0_25px_60px_rgba(59,130,246,0.15)] ring-1 ring-slate-100"
            >
              {settings.logoUrl ? (
                <img src={settings.logoUrl} alt="Logo" className="w-full h-full object-contain p-4 transition-transform group-hover:scale-105" />
              ) : (
                <div className="flex flex-col items-center text-slate-300">
                  <ImageIcon size={56} strokeWidth={1.5} />
                  <span className="text-[10px] font-black uppercase mt-2 opacity-50">Sem Logo</span>
                </div>
              )}
              
              <div className="absolute inset-0 bg-slate-900/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white backdrop-blur-[2px]">
                <Camera size={28} />
                <span className="text-[9px] font-black uppercase mt-2 tracking-widest">Alterar Imagem</span>
              </div>
            </div>
            
            {settings.logoUrl && (
              <button 
                onClick={(e) => { e.stopPropagation(); updateSetting('logoUrl', null); }}
                className="absolute top-2 right-2 bg-red-500 text-white p-2.5 rounded-full shadow-lg hover:bg-red-600 transition-all border-4 border-slate-50 active:scale-90"
              >
                <Trash2 size={16} />
              </button>
            )}
            <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleLogoUpload} />
          </div>

          <div className="w-full space-y-3 text-center">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] ml-1">Identificação Comercial</label>
            <input 
              type="text"
              placeholder="Ex: TICCELL ASSISTÊNCIA"
              value={settings.storeName}
              onChange={(e) => updateSetting('storeName', e.target.value)}
              className="w-full px-8 py-6 bg-white border border-slate-200 rounded-[2.5rem] focus:ring-4 focus:ring-blue-500/10 outline-none font-black text-2xl md:text-3xl text-slate-800 text-center shadow-sm placeholder:text-slate-200 transition-all"
            />
          </div>
        </div>

        <div className="bg-gradient-to-br from-blue-50 to-white rounded-[2.5rem] p-8 border border-blue-100 flex items-center gap-5 shadow-sm">
          <div className="w-14 h-14 bg-blue-600 text-white rounded-[1.25rem] flex items-center justify-center shadow-lg shadow-blue-200 shrink-0">
            <Check size={28} />
          </div>
          <div className="flex-1">
            <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-0.5">Sincronização Ativa</p>
            <p className="text-sm text-blue-900 font-bold leading-tight">Configurações salvas localmente com segurança.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsTab;
