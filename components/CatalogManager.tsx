import React, { useState } from 'react';
import { ArrowLeft, Plus, Image as ImageIcon, Trash2, Save, Loader2, ExternalLink, Tag, Package, Settings, ChevronDown, ChevronUp, Video } from 'lucide-react';
import { Product, AppSettings } from '../types';
import { OnlineDB } from '../utils/api';

interface CatalogManagerProps {
  products: Product[];
  setProducts: (products: Product[]) => void;
  settings: AppSettings;
  setSettings: (settings: AppSettings) => void;
  tenantId: string;
  onBack: () => void;
}

const CatalogManager: React.FC<CatalogManagerProps> = ({ products, setProducts, settings, setSettings, tenantId, onBack }) => {
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [slugInput, setSlugInput] = useState(settings.catalogSlug || '');
  const [isSavingSlug, setIsSavingSlug] = useState(false);
  const [showSlugConfig, setShowSlugConfig] = useState(false);

  const handleSaveSlug = async () => {
    const formattedSlug = slugInput.toLowerCase().replace(/[^a-z0-9-]/g, '');
    setSlugInput(formattedSlug);
    setIsSavingSlug(true);
    
    if (formattedSlug) {
      const existingTenant = await OnlineDB.getTenantIdBySlug(formattedSlug);
      if (existingTenant && existingTenant !== tenantId) {
        alert("Este link já está sendo usado por outra loja. Escolha outro.");
        setIsSavingSlug(false);
        return;
      }
    }

    const newSettings = { ...settings, catalogSlug: formattedSlug };
    await OnlineDB.syncPush(tenantId, 'settings', newSettings);
    setSettings(newSettings);
    setIsSavingSlug(false);
    alert("Link atualizado com sucesso!");
  };

  const handleSave = async () => {
    if (!editingProduct) return;
    setIsSaving(true);
    
    // Update local state
    const updatedProducts = products.map(p => p.id === editingProduct.id ? editingProduct : p);
    setProducts(updatedProducts);
    
    // Save to DB
    await OnlineDB.upsertProducts(tenantId, [editingProduct]);
    
    setIsSaving(false);
    setEditingProduct(null);
  };

  const handleAddPhoto = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e: any) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
          const base64 = event.target?.result as string;
          setEditingProduct(prev => {
            if (!prev) return prev;
            return {
              ...prev,
              additionalPhotos: [...(prev.additionalPhotos || []), base64]
            };
          });
        };
        reader.readAsDataURL(file);
      }
    };
    input.click();
  };

  const removePhoto = (index: number) => {
    setEditingProduct(prev => {
      if (!prev) return prev;
      const newPhotos = [...(prev.additionalPhotos || [])];
      newPhotos.splice(index, 1);
      return { ...prev, additionalPhotos: newPhotos };
    });
  };

  const catalogUrl = settings.catalogSlug 
    ? `${window.location.origin}/${settings.catalogSlug}`
    : `${window.location.origin}/catalogo/${tenantId}`;

  if (editingProduct) {
    return (
      <div className="space-y-6 animate-in slide-in-from-right-10 duration-500">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <button onClick={() => setEditingProduct(null)} className="p-3 bg-white shadow-sm border border-slate-100 rounded-2xl text-slate-600 active:scale-90 transition-all"><ArrowLeft size={24} /></button>
            <h2 className="text-xl font-black text-slate-800 tracking-tight uppercase">Editar Produto</h2>
          </div>
          <button onClick={handleSave} disabled={isSaving} className="px-6 py-3 bg-blue-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest flex items-center gap-2 active:scale-95 transition-all disabled:opacity-50">
            {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            Salvar
          </button>
        </div>

        <div className="bg-white rounded-[3rem] p-8 space-y-6 shadow-sm border border-slate-100">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-20 h-20 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-center overflow-hidden shrink-0">
              {editingProduct.photo ? <img src={editingProduct.photo} className="w-full h-full object-cover" /> : <ImageIcon size={24} className="text-slate-300" />}
            </div>
            <div>
              <h3 className="font-black text-slate-800 text-lg">{editingProduct.name}</h3>
              <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">Estoque: {editingProduct.quantity}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Preço Normal (R$)</label>
              <input 
                type="number" 
                value={editingProduct.salePrice || ''} 
                onChange={e => setEditingProduct({...editingProduct, salePrice: Number(e.target.value)})}
                className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-3xl outline-none text-sm font-black text-slate-800"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-emerald-500 uppercase tracking-widest ml-4">Preço Promocional (R$)</label>
              <input 
                type="number" 
                value={editingProduct.promotionalPrice || ''} 
                onChange={e => setEditingProduct({...editingProduct, promotionalPrice: Number(e.target.value)})}
                className="w-full px-6 py-4 bg-emerald-50 border border-emerald-100 rounded-3xl outline-none text-sm font-black text-emerald-700 placeholder:text-emerald-200"
                placeholder="Opcional"
              />
            </div>
          </div>

          <label className="flex items-center gap-3 p-4 bg-slate-50 rounded-2xl cursor-pointer hover:bg-slate-100 transition-colors border border-slate-100">
            <input 
              type="checkbox" 
              checked={editingProduct.isPromotion || false}
              onChange={e => setEditingProduct({...editingProduct, isPromotion: e.target.checked})}
              className="w-5 h-5 rounded-lg border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-xs font-black uppercase tracking-tight text-slate-700 flex items-center gap-2">
              <Tag size={16} className="text-blue-500" />
              Destacar como Promoção no Catálogo
            </span>
          </label>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4 flex items-center gap-2">
              <Video size={12} /> Link do Vídeo (YouTube/TikTok)
            </label>
            <input 
              type="text" 
              value={editingProduct.videoUrl || ''} 
              onChange={e => setEditingProduct({...editingProduct, videoUrl: e.target.value})}
              className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-3xl outline-none text-sm font-medium text-slate-600 placeholder:text-slate-300"
              placeholder="https://..."
            />
            <p className="text-[9px] text-slate-400 ml-4">
              Suporta: YouTube (Vídeos e Shorts) e TikTok. Cole o link completo.
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Descrição do Produto</label>
            <textarea 
              value={editingProduct.description || ''} 
              onChange={e => setEditingProduct({...editingProduct, description: e.target.value})}
              rows={4}
              placeholder="Detalhes, especificações, garantia..."
              className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-3xl outline-none text-sm font-medium text-slate-700"
            />
          </div>

          <div className="space-y-4 pt-4 border-t border-slate-100">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Fotos Adicionais</label>
              <button onClick={handleAddPhoto} className="text-[10px] font-black text-blue-600 uppercase tracking-widest flex items-center gap-1 bg-blue-50 px-3 py-1.5 rounded-full hover:bg-blue-100 transition-colors">
                <Plus size={14} /> Adicionar
              </button>
            </div>
            
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-4">
              {editingProduct.additionalPhotos?.map((photo, idx) => (
                <div key={idx} className="relative aspect-square bg-slate-50 rounded-2xl border border-slate-100 overflow-hidden group">
                  <img src={photo} className="w-full h-full object-cover" />
                  <button onClick={() => removePhoto(idx)} className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity shadow-lg">
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
              {(!editingProduct.additionalPhotos || editingProduct.additionalPhotos.length === 0) && (
                <div className="col-span-full py-8 text-center border-2 border-dashed border-slate-200 rounded-3xl">
                  <ImageIcon size={32} className="mx-auto text-slate-300 mb-2" />
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Nenhuma foto adicional</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in slide-in-from-right-10 duration-500">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="p-3 bg-white shadow-sm border border-slate-100 rounded-2xl text-slate-600 active:scale-90 transition-all"><ArrowLeft size={24} /></button>
          <h2 className="text-2xl font-black text-slate-800 tracking-tight uppercase">Catálogo Online</h2>
        </div>
        <a href={catalogUrl} target="_blank" rel="noopener noreferrer" className="px-4 py-3 bg-slate-900 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest flex items-center gap-2 hover:bg-slate-800 transition-colors shadow-lg">
          <ExternalLink size={16} />
          <span className="hidden sm:inline">Ver Catálogo</span>
        </a>
      </div>

      <div className="bg-slate-50 rounded-3xl p-1 mb-6">
        <button 
          onClick={() => setShowSlugConfig(!showSlugConfig)}
          className="w-full py-3 px-4 bg-white rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between text-slate-600 font-black uppercase text-[10px] tracking-widest hover:bg-slate-50 transition-all"
        >
          <span className="flex items-center gap-2">
            <Settings size={14} />
            Configurar Link Personalizado
          </span>
          {showSlugConfig ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>

        {showSlugConfig && (
          <div className="pt-4 px-2 pb-2 space-y-4 animate-in slide-in-from-top-2 fade-in duration-300">
            <div className="bg-blue-50 border border-blue-100 rounded-3xl p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex-1 w-full">
                <h3 className="font-black text-blue-800 uppercase text-sm mb-1">Link do seu Catálogo</h3>
                <p className="text-blue-600/80 text-xs font-medium mb-4">Personalize o link para compartilhar com seus clientes.</p>
                
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full">
                  <div className="flex-1 flex items-center bg-white border border-blue-200 rounded-xl overflow-hidden focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/20 transition-all">
                    <span className="pl-4 pr-1 py-3 text-xs font-mono text-slate-400 bg-slate-50 border-r border-blue-100 shrink-0 max-w-[120px] sm:max-w-[200px] truncate">
                      {window.location.host}/
                    </span>
                    <input 
                      type="text" 
                      value={slugInput}
                      onChange={(e) => setSlugInput(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                      placeholder="nomedaloja"
                      className="w-full px-3 py-3 text-xs font-mono text-slate-700 outline-none min-w-0" 
                    />
                  </div>
                  <button 
                    onClick={handleSaveSlug} 
                    disabled={isSavingSlug || slugInput === settings.catalogSlug}
                    className="px-6 py-3 bg-blue-600 text-white rounded-xl font-black uppercase text-[10px] tracking-widest shrink-0 hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {isSavingSlug ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                    Salvar Link
                  </button>
                </div>
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-3xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-2 w-full">
                <input type="text" readOnly value={catalogUrl} className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs font-mono text-slate-600 w-full outline-none" />
                <button onClick={() => { navigator.clipboard.writeText(catalogUrl); alert('Link copiado!'); }} className="px-6 py-3 bg-slate-800 text-white rounded-xl font-black uppercase text-[10px] tracking-widest shrink-0 hover:bg-slate-900 transition-colors">
                  Copiar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        {products.map(product => (
          <div key={product.id} onClick={() => setEditingProduct(product)} className="bg-white rounded-[2rem] p-4 border border-slate-100 shadow-sm hover:shadow-md transition-all cursor-pointer group flex gap-4 items-center">
            <div className="w-20 h-20 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-center overflow-hidden shrink-0 relative">
              {product.photo ? <img src={product.photo} className="w-full h-full object-cover" /> : <ImageIcon size={24} className="text-slate-300" />}
              {product.isPromotion && (
                <div className="absolute top-0 right-0 bg-red-500 text-white p-1 rounded-bl-lg">
                  <Tag size={12} />
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-black text-slate-800 text-sm truncate mb-1 group-hover:text-blue-600 transition-colors">{product.name}</h3>
              <div className="flex items-baseline gap-2">
                {product.isPromotion && product.promotionalPrice ? (
                  <>
                    <span className="font-black text-emerald-500 text-sm">R$ {product.promotionalPrice.toFixed(2)}</span>
                    <span className="font-bold text-slate-400 text-[10px] line-through">R$ {product.salePrice.toFixed(2)}</span>
                  </>
                ) : (
                  <span className="font-black text-slate-800 text-sm">R$ {product.salePrice.toFixed(2)}</span>
                )}
              </div>
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">Estoque: {product.quantity}</p>
            </div>
          </div>
        ))}
        {products.length === 0 && (
          <div className="col-span-full py-12 text-center bg-white rounded-[3rem] border border-slate-100">
            <Package size={48} className="mx-auto text-slate-200 mb-4" />
            <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight mb-2">Nenhum produto</h3>
            <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">Cadastre produtos na aba Estoque primeiro.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default CatalogManager;
