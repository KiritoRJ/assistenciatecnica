
import React, { useState, useEffect, useRef } from 'react';
import { Plus, Search, Trash2, Camera, X, PackageOpen, TrendingUp, PiggyBank, Edit3, Loader2, AlertTriangle, ScanBarcode, AlertCircle, LayoutGrid, Grid, List, Maximize2, Rows } from 'lucide-react';
import { Product, AppSettings } from '../types';
import { formatCurrency, parseCurrencyString, playBeepSound } from '../utils';
import { Html5QrcodeScanner, Html5Qrcode } from 'html5-qrcode';

interface Props {
  products: Product[];
  setProducts: (products: Product[]) => void;
  onDeleteProduct: (id: string) => void;
  settings: AppSettings;
  onUpdateSettings: (settings: AppSettings) => Promise<void>;
  maxProducts?: number;
}

const StockTab: React.FC<Props> = ({ products, setProducts, onDeleteProduct, settings, onUpdateSettings, maxProducts }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isCompressing, setIsCompressing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [productToDelete, setProductToDelete] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [layoutMode, setLayoutMode] = useState<'small' | 'medium' | 'list'>(settings.stockLayout || 'small');
  
  const productCount = products.length;
  const limitReached = maxProducts !== undefined && productCount >= maxProducts;
  
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);

  const [formData, setFormData] = useState<Partial<Product>>({
    name: '', costPrice: 0, salePrice: 0, quantity: 0, photo: null, barcode: ''
  });

  // Função para comprimir imagem antes de salvar no banco
  const compressImage = (base64Str: string): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.src = base64Str;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_DIM = 600; 
        let width = img.width;
        let height = img.height;
        if (width > height) {
          if (width > MAX_DIM) { height *= MAX_DIM / width; width = MAX_DIM; }
        } else {
          if (height > MAX_DIM) { width *= MAX_DIM / height; height = MAX_DIM; }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/webp', 0.7));
      };
    });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validação: Apenas imagens
      if (!file.type.startsWith('image/')) {
        alert(`O arquivo "${file.name}" não é uma imagem e foi ignorado.`);
        e.target.value = '';
        return;
      }

      setIsCompressing(true);
      const reader = new FileReader();
      reader.onloadend = async () => {
        const compressed = await compressImage(reader.result as string);
        setFormData(prev => ({ ...prev, photo: compressed }));
        setIsCompressing(false);
        e.target.value = ''; 
      };
      reader.readAsDataURL(file);
    }
  };

  const startScanner = async (mode: 'form' | 'search' = 'form') => {
    setIsScannerOpen(true);
    setTimeout(async () => {
      try {
        const html5QrCode = new Html5Qrcode("scanner-region");
        scannerRef.current = html5QrCode;
        
        await html5QrCode.start(
          { facingMode: "environment" },
          {
            fps: 20,
            qrbox: { width: 280, height: 180 },
            aspectRatio: 1.777778
          },
          (decodedText) => {
            playBeepSound();
            if (mode === 'form') {
              setFormData(prev => ({ ...prev, barcode: decodedText }));
            } else {
              setSearchTerm(decodedText);
            }
            stopScanner();
          },
          () => {}
        );

        // Tentar forçar o foco contínuo se o navegador suportar
        try {
          // Em versões mais antigas do html5-qrcode, getRunningTrack pode não existir
          // Vamos tentar pegar diretamente do elemento de vídeo
          const videoElement = document.querySelector("#scanner-region video") as HTMLVideoElement;
          const stream = videoElement?.srcObject as MediaStream;
          const track = stream?.getVideoTracks()[0];
          
          if (track) {
            const capabilities = track.getCapabilities() as any;
            const constraints: any = {};
            
            if (capabilities.focusMode && capabilities.focusMode.includes('continuous')) {
              constraints.focusMode = 'continuous';
            }
            
            // Tentar aplicar 2x de zoom se disponível
            if (capabilities.zoom) {
              const maxZoom = capabilities.zoom.max || 1;
              constraints.zoom = Math.min(2, maxZoom);
            }
            
            if (Object.keys(constraints).length > 0) {
              await track.applyConstraints({ advanced: [constraints] } as any);
            }
          }
        } catch (focusErr) {
          console.warn("Não foi possível ajustar o foco automaticamente:", focusErr);
        }
      } catch (err) {
        console.error("Erro ao iniciar scanner:", err);
        alert("Não foi possível acessar a câmera.");
        setIsScannerOpen(false);
      }
    }, 300);
  };

  const stopScanner = async () => {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop();
      } catch (e) {}
      scannerRef.current = null;
    }
    setIsScannerOpen(false);
  };

  useEffect(() => {
    return () => {
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {});
      }
    };
  }, []);

  const handleSave = async () => {
    if (limitReached && !editingProduct) {
      alert(`Limite de ${maxProducts} produtos atingido. Para cadastrar mais, atualize seu plano.`);
      return;
    }

    if (!formData.name) return alert('Nome é obrigatório.');
    setIsSaving(true);
    
    try {
      let newList: Product[];
      if (editingProduct) {
        newList = products.map(p => p.id === editingProduct.id ? { ...p, ...formData } as Product : p);
      } else {
        const newProd = { 
          ...formData, 
          id: 'PROD_' + Math.random().toString(36).substr(2, 6).toUpperCase(),
          quantity: formData.quantity || 0,
          costPrice: formData.costPrice || 0,
          salePrice: formData.salePrice || 0,
          barcode: formData.barcode || ''
        } as Product;
        newList = [newProd, ...products];
      }
      
      await setProducts(newList);
      setIsModalOpen(false);
      resetForm();
    } catch (err) {
      alert("Erro ao salvar produto.");
    } finally {
      setIsSaving(false);
    }
  };

  const resetForm = () => {
    setEditingProduct(null);
    setFormData({ name: '', costPrice: 0, salePrice: 0, quantity: 0, photo: null, barcode: '' });
  };

  const filtered = products.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (p.barcode && p.barcode.includes(searchTerm))
  );

  const paginatedProducts = filtered.slice(0, settings.itemsPerPage * currentPage);

  const loadMore = () => {
    setCurrentPage(prev => prev + 1);
  };

  const toggleLayout = () => {
    const modes: ('small' | 'medium' | 'list')[] = ['small', 'medium', 'list'];
    const nextIndex = (modes.indexOf(layoutMode) + 1) % modes.length;
    const newMode = modes[nextIndex];
    setLayoutMode(newMode);
    onUpdateSettings({ ...settings, stockLayout: newMode });
  };

  const confirmDelete = () => {
    if (productToDelete) {
      onDeleteProduct(productToDelete);
      setProductToDelete(null);
    }
  };

  return (
    <div className="space-y-4 pb-4">
      {/* CABEÇALHO */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-black text-slate-800 tracking-tight uppercase">Estoque Pro</h2>
        <button onClick={() => { resetForm(); setIsModalOpen(true); }} disabled={limitReached} className="bg-slate-900 text-white p-2.5 rounded-2xl shadow-lg active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"><Plus size={20} /></button>
      </div>

      {limitReached && (
        <div className="bg-amber-50 border border-amber-200 p-3 rounded-2xl text-amber-700 text-xs font-bold flex items-center gap-3">
          <AlertTriangle size={16} />
          <span>Você atingiu o limite de {maxProducts} produtos. Para cadastrar mais, atualize seu plano.</span>
        </div>
      )}

      {/* CARDS DE RESUMO FINANCEIRO */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white p-4 rounded-3xl border border-slate-50 shadow-sm flex items-center gap-3">
           <div className="w-10 h-10 bg-orange-50 text-orange-500 rounded-xl flex items-center justify-center shrink-0"><PiggyBank size={20}/></div>
           <div className="min-w-0"><p className="text-[8px] font-black text-slate-400 uppercase tracking-widest truncate">Custo Total</p><p className="font-black text-slate-800 text-xs truncate">{formatCurrency(products.reduce((a,p)=>a+(p.costPrice*p.quantity),0))}</p></div>
        </div>
        <div className="bg-white p-4 rounded-3xl border border-slate-50 shadow-sm flex items-center gap-3">
           <div className="w-10 h-10 bg-emerald-50 text-emerald-500 rounded-xl flex items-center justify-center shrink-0"><TrendingUp size={20}/></div>
           <div className="min-w-0"><p className="text-[8px] font-black text-slate-400 uppercase tracking-widest truncate">Retorno Previsto</p><p className="font-black text-emerald-600 text-xs truncate">{formatCurrency(products.reduce((a,p)=>a+(p.salePrice*p.quantity),0))}</p></div>
        </div>
      </div>

      {/* BARRA DE PESQUISA E LAYOUT */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
          <input type="text" placeholder="Buscar..." className="w-full pl-11 pr-4 py-3.5 bg-white border-none rounded-2xl shadow-sm text-sm font-medium focus:ring-2 focus:ring-slate-900 outline-none" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
        </div>
        <button onClick={() => startScanner('search')} className="p-3.5 bg-white text-slate-600 rounded-2xl shadow-sm active:scale-95 shrink-0">
          <ScanBarcode size={20} />
        </button>
        <button onClick={toggleLayout} className="p-3.5 bg-white text-slate-400 hover:text-slate-600 transition-colors rounded-2xl shadow-sm active:scale-95 shrink-0">
           {layoutMode === 'small' && <Grid size={20} />}
           {layoutMode === 'medium' && <LayoutGrid size={20} />}
           {layoutMode === 'list' && <Rows size={20} />}
        </button>
      </div>

      {/* --- GRID DE PRODUTOS --- */}
      <div className={`grid gap-3 ${
        layoutMode === 'small' ? 'grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10' :
        layoutMode === 'medium' ? 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8' :
        'grid-cols-1'
      }`}>
        {paginatedProducts.length > 0 ? paginatedProducts.map(product => (
          <div key={product.id} className={`bg-white border border-slate-50 rounded-[2rem] overflow-hidden shadow-sm flex group animate-in fade-in duration-300 ${layoutMode === 'list' ? 'flex-row items-center p-2 gap-3' : 'flex-col'}`}>
            {/* Imagem */}
            <div className={`bg-slate-50 relative shrink-0 ${
              layoutMode === 'list' ? 'w-14 h-14 rounded-2xl' : 
              layoutMode === 'small' ? 'h-20' : 
              'h-28 md:h-24'
            }`}>
              {product.photo ? <img src={product.photo} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-slate-200"><PackageOpen size={layoutMode === 'small' || layoutMode === 'list' ? 16 : 24} /></div>}
              
              {layoutMode !== 'list' && (
                <>
                  <div className="absolute top-2 right-2 flex flex-col gap-1 z-10">
                    <button 
                      onClick={(e) => { e.stopPropagation(); setEditingProduct(product); setFormData(product); setIsModalOpen(true); }} 
                      className="p-1.5 bg-white/90 rounded-lg text-slate-600 shadow-sm active:scale-90 transition-all"
                    >
                      <Edit3 size={12} />
                    </button>
                    <button 
                      onClick={(e) => { e.stopPropagation(); setProductToDelete(product.id); }} 
                      className="p-1.5 bg-white/90 rounded-lg text-red-500 shadow-sm active:scale-90 transition-all"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                  <div className={`absolute bottom-2 left-2 px-1.5 py-0.5 rounded-md text-[7px] font-black uppercase tracking-widest ${product.quantity <= 2 ? 'bg-red-500 text-white' : 'bg-slate-900 text-white'}`}>Qtd: {product.quantity}</div>
                </>
              )}
            </div>

            {/* Conteúdo */}
            <div className={`${layoutMode === 'list' ? 'flex-1 flex items-center justify-between pr-2 min-w-0' : 'p-2'}`}>
              <div className="min-w-0 flex-1 mr-2">
                <h3 className={`font-bold text-slate-800 uppercase truncate mb-0.5 ${layoutMode === 'small' ? 'text-[8px]' : 'text-[9px] sm:text-[10px]'}`}>{product.name}</h3>
                {layoutMode === 'list' && (
                   <div className="flex items-center gap-2 mt-0.5">
                      <span className={`px-2 py-0.5 rounded-md text-[8px] font-black uppercase tracking-widest ${product.quantity <= 2 ? 'bg-red-100 text-red-600' : 'bg-slate-100 text-slate-600'}`}>Estoque: {product.quantity}</span>
                   </div>
                )}
                {layoutMode !== 'list' && (
                  <div className="flex items-center justify-between">
                    <p className="font-black text-blue-600 text-[10px]">{formatCurrency(product.salePrice)}</p>
                    {product.barcode && <ScanBarcode size={10} className="text-slate-300" />}
                  </div>
                )}
              </div>

              {layoutMode === 'list' && (
                <div className="flex items-center gap-3 shrink-0">
                   <p className="font-black text-blue-600 text-xs sm:text-sm">{formatCurrency(product.salePrice)}</p>
                   <div className="flex gap-1.5">
                      <button 
                        onClick={(e) => { e.stopPropagation(); setEditingProduct(product); setFormData(product); setIsModalOpen(true); }} 
                        className="p-2 bg-slate-100 rounded-xl text-slate-600 active:scale-90 transition-all hover:bg-slate-200"
                      >
                        <Edit3 size={14} />
                      </button>
                      <button 
                        onClick={(e) => { e.stopPropagation(); setProductToDelete(product.id); }} 
                        className="p-2 bg-red-50 rounded-xl text-red-500 active:scale-90 transition-all hover:bg-red-100"
                      >
                        <Trash2 size={14} />
                      </button>
                   </div>
                </div>
              )}
            </div>
          </div>
        )) : (
          <div className="col-span-full text-center py-20 bg-white rounded-[2.5rem] border-2 border-dashed border-slate-100">
             <p className="text-slate-300 font-black uppercase text-[10px] tracking-widest">Nenhum item em estoque</p>
          </div>
        )}
      </div>

      {filtered.length > paginatedProducts.length && (
        <button 
          onClick={loadMore}
          className="w-full py-4 bg-slate-100 text-slate-500 rounded-2xl font-black uppercase text-xs tracking-widest mt-4 active:scale-95 transition-transform">
          Carregar Mais
        </button>
      )}

      {/* MODAL DE EXCLUSÃO */}
      {productToDelete && (
        <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-6 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-xs rounded-[2rem] overflow-hidden shadow-2xl animate-in zoom-in-95">
            <div className="p-6 text-center space-y-4">
              <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-2">
                <AlertTriangle size={32} />
              </div>
              <h3 className="font-black text-slate-800 uppercase text-sm">Excluir Produto?</h3>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest leading-relaxed">Este item será removido permanentemente.</p>
              <div className="flex gap-2 pt-2">
                <button onClick={() => setProductToDelete(null)} className="flex-1 py-3 bg-slate-100 text-slate-500 rounded-xl font-black text-[9px] uppercase tracking-widest">Sair</button>
                <button onClick={confirmDelete} className="flex-1 py-3 bg-red-600 text-white rounded-xl font-black text-[9px] uppercase tracking-widest shadow-lg">Remover</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE CADASTRO / EDIÇÃO */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 z-50 flex flex-col justify-end p-2 backdrop-blur-sm">
          <div className="bg-white w-full max-w-md mx-auto rounded-[2.5rem] overflow-hidden shadow-2xl animate-in slide-in-from-bottom-10">
            <div className="p-6 border-b border-slate-50 flex justify-between items-center bg-white">
              <h3 className="font-black text-slate-800 text-lg uppercase tracking-tight">{editingProduct ? 'Editar Item' : 'Novo Item'}</h3>
              <button onClick={() => setIsModalOpen(false)} className="p-2 text-slate-400 bg-slate-50 rounded-full"><X size={20} /></button>
            </div>
            
            <div className="p-6 space-y-6 max-h-[60vh] overflow-y-auto">
              <div className="flex flex-col items-center gap-3">
                <label className="relative active:scale-95 transition-all cursor-pointer">
                  <div className="w-24 h-24 bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200 flex items-center justify-center overflow-hidden">
                    {isCompressing ? <Loader2 className="animate-spin text-blue-500" /> : formData.photo ? <img src={formData.photo} className="w-full h-full object-cover" /> : <PackageOpen className="text-slate-200" size={32} />}
                  </div>
                  <div className="absolute -bottom-2 -right-2 bg-blue-600 text-white p-2 rounded-full border-4 border-white shadow-lg"><Camera size={14} /></div>
                  <input type="file" accept="*/*" className="hidden" onChange={handleFileChange} />
                </label>
                <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Toque para foto</p>
              </div>

              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Descrição do Produto</label>
                  <input value={formData.name} onChange={(e)=>setFormData(f=>({...f,name:e.target.value}))} placeholder="Nome do item" className="w-full p-4 bg-slate-50 rounded-2xl outline-none font-bold text-sm" />
                </div>
                {/* Outros campos de formulário permanecem iguais */}
                <div className="space-y-1">
                   <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Código de Barras</label>
                   <div className="flex gap-2">
                     <input value={formData.barcode} onChange={(e)=>setFormData(f=>({...f,barcode:e.target.value}))} placeholder="Código" className="flex-1 p-4 bg-slate-50 rounded-2xl outline-none font-black text-xs text-blue-600" />
                     <button onClick={() => startScanner('form')} className="p-4 bg-blue-600 text-white rounded-2xl shadow-lg active:scale-90"><ScanBarcode size={20} /></button>
                   </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                   <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100">
                      <p className="text-[8px] font-black text-slate-400 uppercase mb-1">Custo Unitário</p>
                      <input value={formatCurrency(formData.costPrice||0).replace('R$','').trim()} onChange={(e)=>setFormData(f=>({...f,costPrice:parseCurrencyString(e.target.value)}))} className="w-full bg-transparent font-black text-slate-800 outline-none text-xs" />
                   </div>
                   <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100">
                      <p className="text-[8px] font-black text-slate-400 uppercase mb-1">Venda Unitária</p>
                      <input value={formatCurrency(formData.salePrice||0).replace('R$','').trim()} onChange={(e)=>setFormData(f=>({...f,salePrice:parseCurrencyString(e.target.value)}))} className="w-full bg-transparent font-black text-blue-600 outline-none text-xs" />
                   </div>
                </div>
                <div className="space-y-1">
                   <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Quantidade</label>
                   <input type="number" value={formData.quantity} onChange={(e)=>setFormData(f=>({...f,quantity:parseInt(e.target.value)||0}))} className="w-full p-4 bg-slate-50 rounded-2xl outline-none font-black text-sm" />
                </div>
              </div>
            </div>

            <div className="p-6 bg-slate-50 border-t border-slate-100 flex gap-3">
              <button onClick={() => setIsModalOpen(false)} className="flex-1 py-4 font-black text-slate-400 uppercase text-[10px] tracking-widest">Sair</button>
              <button onClick={handleSave} disabled={isSaving || isCompressing} className="flex-[2] py-4 bg-slate-900 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl active:scale-95">
                {isSaving ? <Loader2 className="animate-spin" /> : 'Confirmar no SQL'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL SCANNER */}
      {isScannerOpen && (
        <div className="fixed inset-0 bg-slate-950 z-[200] flex flex-col animate-in fade-in">
           <div className="p-6 flex items-center justify-between border-b border-white/10">
              <h3 className="font-black text-white uppercase text-xs tracking-widest">Scanner de Código</h3>
              <button onClick={stopScanner} className="p-2 bg-white/10 text-white rounded-full"><X size={20} /></button>
           </div>
           <div className="flex-1 relative flex items-center justify-center">
              <div id="scanner-region" className="w-full h-full max-h-[60vh]"></div>
              <div className="absolute bottom-10 left-0 right-0 text-center px-6 pointer-events-none">
                <p className="text-white/60 text-[10px] font-bold uppercase tracking-widest bg-black/40 py-2 px-4 rounded-full inline-block">Aproxime o código lentamente para focar</p>
              </div>
           </div>
        </div>
      )}

      {/* MODAL DE CONFIRMAÇÃO DE EXCLUSÃO */}
      {productToDelete && (
        <div className="fixed inset-0 bg-slate-950/80 z-[300] flex items-center justify-center p-6 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white w-full max-w-xs rounded-[2rem] overflow-hidden shadow-2xl animate-in zoom-in-95">
            <div className="p-8 text-center space-y-4">
              <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-2">
                <AlertCircle size={32} />
              </div>
              <h3 className="font-black text-slate-800 uppercase text-sm">Excluir Produto?</h3>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest leading-relaxed">
                Esta ação irá remover o item do estoque permanentemente.
              </p>
              <div className="flex gap-2 pt-2">
                <button 
                  onClick={() => setProductToDelete(null)} 
                  className="flex-1 py-4 bg-slate-100 text-slate-500 rounded-xl font-black text-[9px] uppercase tracking-widest"
                >
                  Voltar
                </button>
                <button 
                  onClick={confirmDelete} 
                  className="flex-1 py-4 bg-red-600 text-white rounded-xl font-black text-[9px] uppercase tracking-widest shadow-lg shadow-red-500/20"
                >
                  Confirmar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StockTab;
