
import React, { useState, useEffect, useRef } from 'react';
import { Plus, Search, Trash2, Camera, X, PackageOpen, TrendingUp, PiggyBank, Edit3, Loader2, AlertTriangle, ScanBarcode, AlertCircle } from 'lucide-react';
import { Product } from '../types';
import { formatCurrency, parseCurrencyString } from '../utils';
import { Html5QrcodeScanner, Html5Qrcode } from 'html5-qrcode';

interface Props {
  products: Product[];
  setProducts: (products: Product[]) => void;
  onDeleteProduct: (id: string) => void;
}

const StockTab: React.FC<Props> = ({ products, setProducts, onDeleteProduct }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isCompressing, setIsCompressing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [productToDelete, setProductToDelete] = useState<string | null>(null);
  
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
        resolve(canvas.toDataURL('image/jpeg', 0.6));
      };
    });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
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

  const startScanner = async () => {
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
            setFormData(prev => ({ ...prev, barcode: decodedText }));
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
        <button onClick={() => { resetForm(); setIsModalOpen(true); }} className="bg-slate-900 text-white p-2.5 rounded-2xl shadow-lg active:scale-95"><Plus size={20} /></button>
      </div>

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

      {/* BARRA DE PESQUISA */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
        <input type="text" placeholder="Buscar por nome ou código..." className="w-full pl-11 pr-4 py-3.5 bg-white border-none rounded-2xl shadow-sm text-sm font-medium focus:ring-2 focus:ring-slate-900 outline-none" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
      </div>

      {/* --- GRID DE PRODUTOS: MODIFICADO PARA PC (Miniaturas Menores e Mais Colunas) --- */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-3">
        {filtered.length > 0 ? filtered.map(product => (
          <div key={product.id} className="bg-white border border-slate-50 rounded-[2rem] overflow-hidden shadow-sm flex flex-col group animate-in fade-in duration-300">
            {/* Altura da imagem reduzida de h-32 para h-28/h-24 no PC para visual mais compacto */}
            <div className="h-28 md:h-24 bg-slate-50 relative">
              {product.photo ? <img src={product.photo} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-slate-200"><PackageOpen size={24} /></div>}
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
            </div>
            <div className="p-2">
              <h3 className="font-bold text-slate-800 text-[9px] uppercase truncate mb-0.5">{product.name}</h3>
              <div className="flex items-center justify-between">
                <p className="font-black text-blue-600 text-[10px]">{formatCurrency(product.salePrice)}</p>
                {product.barcode && <ScanBarcode size={10} className="text-slate-300" />}
              </div>
            </div>
          </div>
        )) : (
          <div className="col-span-full text-center py-20 bg-white rounded-[2.5rem] border-2 border-dashed border-slate-100">
             <p className="text-slate-300 font-black uppercase text-[10px] tracking-widest">Nenhum item em estoque</p>
          </div>
        )}
      </div>

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
                  <input type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
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
                     <button onClick={startScanner} className="p-4 bg-blue-600 text-white rounded-2xl shadow-lg active:scale-90"><ScanBarcode size={20} /></button>
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
