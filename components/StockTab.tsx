
import React, { useState, useRef } from 'react';
import { Plus, Search, Trash2, Camera, X, PackageOpen, AlertTriangle, TrendingUp, PiggyBank, Edit3 } from 'lucide-react';
import { Product } from '../types';
import { formatCurrency, parseCurrencyString } from '../utils';

interface Props {
  products: Product[];
  setProducts: (products: Product[]) => void;
}

const StockTab: React.FC<Props> = ({ products, setProducts }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState<Partial<Product>>({
    name: '',
    costPrice: 0,
    salePrice: 0,
    quantity: 0,
    photo: null
  });

  // Cálculos de Resumo do Estoque
  const totalStockInvestment = products.reduce((acc, p) => acc + (p.costPrice * p.quantity), 0);
  const totalPotentialProfit = products.reduce((acc, p) => acc + ((p.salePrice - p.costPrice) * p.quantity), 0);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    if (name === 'costPrice' || name === 'salePrice') {
      setFormData(prev => ({ ...prev, [name]: parseCurrencyString(value) }));
    } else if (name === 'quantity') {
      setFormData(prev => ({ ...prev, [name]: parseInt(value) || 0 }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData(prev => ({ ...prev, photo: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = () => {
    if (!formData.name) return alert('O nome do produto é obrigatório.');

    if (editingProduct) {
      setProducts(products.map(p => p.id === editingProduct.id ? { ...p, ...formData } as Product : p));
    } else {
      const newProduct: Product = {
        ...formData,
        id: Math.random().toString(36).substr(2, 9),
      } as Product;
      setProducts([newProduct, ...products]);
    }
    closeModal();
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingProduct(null);
    setFormData({ name: '', costPrice: 0, salePrice: 0, quantity: 0, photo: null });
  };

  const handleEdit = (product: Product) => {
    setEditingProduct(product);
    setFormData(product);
    setIsModalOpen(true);
  };

  const handleDelete = (id: string) => {
    if (confirm('Excluir este produto do estoque?')) {
      setProducts(products.filter(p => p.id !== id));
    }
  };

  const filtered = products.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <h2 className="text-xl font-bold text-slate-800">Estoque</h2>
        <button onClick={() => setIsModalOpen(true)} className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-bold shadow-md active:scale-95 transition-all text-sm">
          <Plus size={18} /> Novo Produto
        </button>
      </div>

      {/* Resumo Financeiro do Estoque Compacto */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white p-3 rounded-xl shadow-sm border border-slate-100 flex items-center gap-3">
          <div className="w-8 h-8 bg-orange-50 text-orange-600 rounded-lg flex items-center justify-center shrink-0">
            <PiggyBank size={18} />
          </div>
          <div className="min-w-0">
            <p className="text-[9px] text-slate-400 font-black uppercase tracking-tighter truncate">Investimento</p>
            <p className="text-sm font-black text-slate-800 truncate">{formatCurrency(totalStockInvestment)}</p>
          </div>
        </div>

        <div className="bg-white p-3 rounded-xl shadow-sm border border-slate-100 flex items-center gap-3">
          <div className="w-8 h-8 bg-emerald-50 text-emerald-600 rounded-lg flex items-center justify-center shrink-0">
            <TrendingUp size={18} />
          </div>
          <div className="min-w-0">
            <p className="text-[9px] text-slate-400 font-black uppercase tracking-tighter truncate">Lucro Potencial</p>
            <p className="text-sm font-black text-emerald-600 truncate">{formatCurrency(totalPotentialProfit)}</p>
          </div>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
        <input 
          type="text" placeholder="Buscar no estoque..." 
          className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none shadow-sm text-sm"
          value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* Grade de Produtos - Revertida para 2 colunas mobile para melhor legibilidade */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
        {filtered.length > 0 ? (
          filtered.map(product => (
            <div key={product.id} className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all flex flex-col">
              <div className="h-28 bg-slate-50 relative group">
                {product.photo ? (
                  <img src={product.photo} className="w-full h-full object-cover transition-transform group-hover:scale-110" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-slate-200">
                    <PackageOpen size={32} />
                  </div>
                )}
                
                <div className="absolute top-1 right-1 flex flex-col gap-1">
                  <button onClick={() => handleEdit(product)} className="bg-white/90 p-1.5 rounded-lg text-slate-600 hover:text-blue-600 shadow-sm transition-colors">
                    <Edit3 size={14} />
                  </button>
                  <button onClick={() => handleDelete(product.id)} className="bg-white/90 p-1.5 rounded-lg text-slate-400 hover:text-red-600 shadow-sm transition-colors">
                    <Trash2 size={14} />
                  </button>
                </div>

                {product.quantity <= 3 && (
                  <div className="absolute bottom-1 left-1 bg-red-500 text-white p-1 rounded-md shadow-sm animate-pulse">
                    <AlertTriangle size={12} />
                  </div>
                )}
              </div>
              
              <div className="p-2 flex flex-col flex-1">
                <h3 className="font-bold text-slate-800 text-[11px] line-clamp-1 mb-1">{product.name}</h3>
                
                <div className="mt-auto flex flex-col">
                  <span className="text-[9px] text-slate-400 font-bold uppercase tracking-tighter">Qtd: {product.quantity}</span>
                  <span className="text-xs font-black text-blue-600 truncate">{formatCurrency(product.salePrice)}</span>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="col-span-full text-center py-12 bg-white rounded-3xl border border-dashed border-slate-200">
            <PackageOpen className="mx-auto text-slate-200 mb-2" size={40} />
            <p className="text-slate-400 text-xs font-medium">Estoque vazio.</p>
          </div>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom-4 duration-300">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-xl font-bold text-slate-800">{editingProduct ? 'Editar Produto' : 'Novo Produto'}</h3>
              <button onClick={closeModal} className="text-slate-400 hover:text-slate-600 transition-colors">
                <X size={24} />
              </button>
            </div>
            
            <div className="p-6 space-y-5">
              <div className="flex flex-col items-center gap-3">
                <div className="w-24 h-24 bg-slate-50 rounded-2xl flex items-center justify-center overflow-hidden border-2 border-dashed border-slate-200 relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                  {formData.photo ? (
                    <img src={formData.photo} className="w-full h-full object-cover" />
                  ) : (
                    <Camera size={32} className="text-slate-300" />
                  )}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <Edit3 className="text-white" size={20} />
                  </div>
                </div>
                <button onClick={() => fileInputRef.current?.click()} className="text-[10px] font-black text-blue-600 uppercase tracking-widest">Alterar Imagem</button>
                <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handlePhotoUpload} />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-black text-slate-500 uppercase tracking-widest ml-1">Descrição do Produto</label>
                <input name="name" value={formData.name} onChange={handleInputChange} className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Ex: Tela iPhone 11 Original" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-black text-slate-500 uppercase tracking-widest ml-1">Preço Custo</label>
                  <input name="costPrice" value={formatCurrency(formData.costPrice || 0).replace('R$', '').trim()} onChange={handleInputChange} className="w-full px-4 py-3 border border-slate-200 rounded-xl text-right font-mono outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-black text-slate-500 uppercase tracking-widest ml-1">Preço Venda</label>
                  <input name="salePrice" value={formatCurrency(formData.salePrice || 0).replace('R$', '').trim()} onChange={handleInputChange} className="w-full px-4 py-3 border border-slate-200 rounded-xl text-right font-mono text-blue-600 font-bold outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-black text-slate-500 uppercase tracking-widest ml-1">Quantidade</label>
                <input type="number" name="quantity" value={formData.quantity} onChange={handleInputChange} className="w-full px-4 py-3 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>

            <div className="p-6 bg-slate-50 flex gap-3 border-t border-slate-100">
              <button onClick={closeModal} className="flex-1 py-3 font-bold text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors">Cancelar</button>
              <button onClick={handleSave} className="flex-1 py-3 font-bold text-white bg-blue-600 rounded-xl shadow-lg shadow-blue-200 hover:bg-blue-700 active:scale-95 transition-all">Salvar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StockTab;
