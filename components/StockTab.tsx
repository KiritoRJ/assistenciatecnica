
import React, { useState } from 'react';
import { Plus, Search, Trash2, Camera, X, PackageOpen, TrendingUp, PiggyBank, Edit3, Loader2 } from 'lucide-react';
import { Product } from '../types';
import { formatCurrency, parseCurrencyString } from '../utils';

interface Props {
  products: Product[];
  setProducts: (products: Product[]) => void;
}

const StockTab: React.FC<Props> = ({ products, setProducts }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isCompressing, setIsCompressing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  const [formData, setFormData] = useState<Partial<Product>>({
    name: '', costPrice: 0, salePrice: 0, quantity: 0, photo: null
  });

  const triggerUpload = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e: any) => {
      const file = e.target.files?.[0];
      if (file) {
        setIsCompressing(true);
        const reader = new FileReader();
        reader.onloadend = () => {
          setFormData(prev => ({ ...prev, photo: reader.result as string }));
          setIsCompressing(false);
        };
        reader.readAsDataURL(file);
      }
    };
    input.click();
  };

  const handleSave = () => {
    if (!formData.name) return alert('Nome é obrigatório.');
    setIsSaving(true);
    setTimeout(() => {
      let newList: Product[];
      if (editingProduct) newList = products.map(p => p.id === editingProduct.id ? { ...p, ...formData } as Product : p);
      else newList = [{ ...formData, id: Math.random().toString(36).substr(2, 6).toUpperCase() } as Product, ...products];
      setProducts(newList);
      setIsModalOpen(false);
      resetForm();
      setIsSaving(false);
    }, 150);
  };

  const resetForm = () => {
    setEditingProduct(null);
    setFormData({ name: '', costPrice: 0, salePrice: 0, quantity: 0, photo: null });
  };

  const filtered = products.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div className="space-y-4 pb-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-black text-slate-800 tracking-tight">ESTOQUE</h2>
        <button onClick={() => { resetForm(); setIsModalOpen(true); }} className="bg-slate-900 text-white p-2.5 rounded-2xl shadow-lg active:scale-95"><Plus size={20} /></button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white p-4 rounded-3xl border border-slate-50 shadow-sm flex items-center gap-3">
           <div className="w-10 h-10 bg-orange-50 text-orange-500 rounded-xl flex items-center justify-center shrink-0"><PiggyBank size={20}/></div>
           <div className="min-w-0"><p className="text-[8px] font-black text-slate-400 uppercase tracking-widest truncate">Custo</p><p className="font-black text-slate-800 text-xs truncate">{formatCurrency(products.reduce((a,p)=>a+(p.costPrice*p.quantity),0))}</p></div>
        </div>
        <div className="bg-white p-4 rounded-3xl border border-slate-50 shadow-sm flex items-center gap-3">
           <div className="w-10 h-10 bg-emerald-50 text-emerald-500 rounded-xl flex items-center justify-center shrink-0"><TrendingUp size={20}/></div>
           <div className="min-w-0"><p className="text-[8px] font-black text-slate-400 uppercase tracking-widest truncate">Retorno</p><p className="font-black text-emerald-600 text-xs truncate">{formatCurrency(products.reduce((a,p)=>a+(p.salePrice*p.quantity),0))}</p></div>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
        <input type="text" placeholder="Buscar produto..." className="w-full pl-11 pr-4 py-3.5 bg-white border-none rounded-2xl shadow-sm text-sm font-medium focus:ring-2 focus:ring-slate-900" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        {filtered.map(product => (
          <div key={product.id} className="bg-white border border-slate-50 rounded-[2rem] overflow-hidden shadow-sm flex flex-col group animate-in fade-in duration-300">
            <div className="h-32 bg-slate-50 relative">
              {product.photo ? <img src={product.photo} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-slate-200"><PackageOpen size={32} /></div>}
              <div className="absolute top-2 right-2 flex flex-col gap-1">
                <button onClick={() => { setEditingProduct(product); setFormData(product); setIsModalOpen(true); }} className="p-2 bg-white/90 rounded-xl text-slate-600 shadow-sm"><Edit3 size={14} /></button>
                <button onClick={() => confirm('Remover?') && setProducts(products.filter(p=>p.id!==product.id))} className="p-2 bg-white/90 rounded-xl text-red-500 shadow-sm"><Trash2 size={14} /></button>
              </div>
              <div className="absolute bottom-2 left-2 px-2 py-0.5 bg-slate-900 text-white rounded-lg text-[8px] font-black uppercase tracking-widest">Qtd: {product.quantity}</div>
            </div>
            <div className="p-3">
              <h3 className="font-bold text-slate-800 text-[10px] uppercase truncate mb-1">{product.name}</h3>
              <p className="font-black text-blue-600 text-xs">{formatCurrency(product.salePrice)}</p>
            </div>
          </div>
        ))}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 z-50 flex flex-col justify-end p-2 backdrop-blur-sm">
          <div className="bg-white w-full max-w-md mx-auto rounded-[2.5rem] overflow-hidden shadow-2xl animate-in slide-in-from-bottom-10">
            <div className="p-6 border-b border-slate-50 flex justify-between items-center bg-white">
              <h3 className="font-black text-slate-800 text-lg uppercase tracking-tight">{editingProduct ? 'Editar Item' : 'Novo Item'}</h3>
              <button onClick={() => setIsModalOpen(false)} className="p-2 text-slate-400 bg-slate-50 rounded-full"><X size={20} /></button>
            </div>
            
            <div className="p-6 space-y-6">
              <div className="flex flex-col items-center gap-3">
                <button onClick={triggerUpload} className="relative active:scale-95 transition-all">
                  <div className="w-24 h-24 bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200 flex items-center justify-center overflow-hidden">
                    {isCompressing ? <Loader2 className="animate-spin text-blue-500" /> : formData.photo ? <img src={formData.photo} className="w-full h-full object-cover" /> : <PackageOpen className="text-slate-200" size={32} />}
                  </div>
                  <div className="absolute -bottom-2 -right-2 bg-blue-600 text-white p-2 rounded-full border-4 border-white shadow-lg"><Camera size={14} /></div>
                </button>
                <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Toque para foto</p>
              </div>

              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Descrição do Produto</label>
                  <input value={formData.name} onChange={(e)=>setFormData(f=>({...f,name:e.target.value}))} placeholder="Ex: Tela iPhone 11 Incell" className="w-full p-4 bg-slate-50 rounded-2xl outline-none font-bold uppercase text-sm" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                   <div className="p-3 bg-slate-50 rounded-2xl">
                      <p className="text-[8px] font-black text-slate-400 uppercase mb-1">Custo Un.</p>
                      <input value={formatCurrency(formData.costPrice||0).replace('R$','').trim()} onChange={(e)=>setFormData(f=>({...f,costPrice:parseCurrencyString(e.target.value)}))} className="w-full bg-transparent font-black text-slate-800 outline-none text-xs" />
                   </div>
                   <div className="p-3 bg-slate-50 rounded-2xl">
                      <p className="text-[8px] font-black text-slate-400 uppercase mb-1">Venda Un.</p>
                      <input value={formatCurrency(formData.salePrice||0).replace('R$','').trim()} onChange={(e)=>setFormData(f=>({...f,salePrice:parseCurrencyString(e.target.value)}))} className="w-full bg-transparent font-black text-blue-600 outline-none text-xs" />
                   </div>
                </div>
                <div className="space-y-1">
                   <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Quantidade em Estoque</label>
                   <input type="number" value={formData.quantity} onChange={(e)=>setFormData(f=>({...f,quantity:parseInt(e.target.value)||0}))} className="w-full p-4 bg-slate-50 rounded-2xl outline-none font-black text-sm" />
                </div>
              </div>
            </div>

            <div className="p-6 bg-slate-50 flex gap-3">
              <button onClick={() => setIsModalOpen(false)} className="flex-1 py-4 font-black text-slate-400 uppercase text-[10px] tracking-widest">Sair</button>
              <button onClick={handleSave} disabled={isSaving || isCompressing} className="flex-[2] py-4 bg-slate-900 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl active:scale-95">
                {isSaving ? <Loader2 className="animate-spin" /> : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StockTab;
