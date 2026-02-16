
import React, { useState } from 'react';
import { Plus, Search, Trash2, ChevronRight, Camera, X, Eye, Loader2, Image as ImageIcon, Smartphone } from 'lucide-react';
import { ServiceOrder, AppSettings } from '../types';
import { formatCurrency, parseCurrencyString, formatDate } from '../utils';

interface Props {
  orders: ServiceOrder[];
  setOrders: (orders: ServiceOrder[]) => void;
  settings: AppSettings;
}

const ServiceOrderTab: React.FC<Props> = ({ orders, setOrders, settings }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingOrder, setEditingOrder] = useState<ServiceOrder | null>(null);
  const [isCompressing, setIsCompressing] = useState(false);
  const [isGeneratingReceipt, setIsGeneratingReceipt] = useState(false);

  const [formData, setFormData] = useState<Partial<ServiceOrder>>({
    customerName: '', phoneNumber: '', address: '', deviceBrand: '', deviceModel: '',
    defect: '', repairDetails: '', partsCost: 0, serviceCost: 0, status: 'Pendente',
    photos: [], finishedPhotos: []
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    if (name === 'partsCost' || name === 'serviceCost') {
      const numericValue = parseCurrencyString(value);
      setFormData(prev => {
        const updated = { ...prev, [name]: numericValue };
        const total = (updated.partsCost || 0) + (updated.serviceCost || 0);
        return { ...updated, total };
      });
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  /**
   * Compacta a imagem para resoluções menores e qualidade inferior para economizar espaço no DB local.
   */
  const compressImage = (base64Str: string): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.src = base64Str;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_DIM = 600; // Reduzido de 800 para 600 para maior economia
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
        // Reduzido para 0.5 de qualidade (JPEG agressivo)
        resolve(canvas.toDataURL('image/jpeg', 0.5));
      };
    });
  };

  const triggerUpload = (field: 'photos' | 'finishedPhotos') => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.multiple = true;
    input.onchange = async (e: any) => {
      const files = e.target.files;
      if (!files || files.length === 0) return;
      setIsCompressing(true);
      const newPhotos: string[] = [];
      for (let i = 0; i < files.length; i++) {
        const reader = new FileReader();
        const compressed = await new Promise<string>((resolve) => {
          reader.onloadend = async () => resolve(await compressImage(reader.result as string));
          reader.readAsDataURL(files[i]);
        });
        newPhotos.push(compressed);
      }
      setFormData(prev => ({ ...prev, [field]: [...(prev[field] || []), ...newPhotos] }));
      setIsCompressing(false);
    };
    input.click();
  };

  const handleSave = () => {
    if (!formData.customerName || !formData.deviceModel) return alert('Campos obrigatórios faltando.');
    setIsSaving(true);
    setTimeout(() => {
      let newOrdersList: ServiceOrder[];
      if (editingOrder) {
        newOrdersList = orders.map(o => o.id === editingOrder.id ? { ...o, ...formData } as ServiceOrder : o);
      } else {
        const newOrder: ServiceOrder = {
          ...formData, id: Math.random().toString(36).substr(2, 6).toUpperCase(),
          date: new Date().toISOString(), total: (formData.partsCost || 0) + (formData.serviceCost || 0),
        } as ServiceOrder;
        newOrdersList = [newOrder, ...orders];
      }
      setOrders(newOrdersList);
      setIsModalOpen(false);
      resetForm();
      setIsSaving(false);
    }, 150);
  };

  const resetForm = () => {
    setEditingOrder(null);
    setFormData({ customerName: '', phoneNumber: '', deviceBrand: '', deviceModel: '', defect: '', status: 'Pendente', photos: [] });
  };

  const generateReceiptImage = async (order: ServiceOrder) => {
    setIsGeneratingReceipt(true);
    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const scale = 2;
      const width = 450 * scale;
      const photosCount = order.photos?.length || 0;
      const photoRows = Math.ceil(photosCount / 2);
      const photosHeight = photosCount > 0 ? (photoRows * 160 + 50) : 0;
      const dynamicHeight = (450 + photosHeight) * scale;

      canvas.width = width; canvas.height = dynamicHeight;
      ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, 0, width, dynamicHeight);

      const drawText = (text: string, y: number, sz: number, b: boolean = false, al: 'center' | 'left' = 'center', col: string = '#000') => {
        ctx.fillStyle = col; ctx.font = `${b ? '900' : '500'} ${sz * scale}px Arial`; ctx.textAlign = al;
        ctx.fillText(text.toUpperCase(), al === 'center' ? width / 2 : 25 * scale, y * scale);
      };

      drawText(settings.storeName, 40, 18, true);
      drawText(`ORDEM DE SERVIÇO #${order.id}`, 62, 11, true, 'center', '#475569');
      
      let cy = 95;
      drawText(`Cliente: ${order.customerName}`, cy, 12, true, 'left');
      cy += 18; drawText(`Equipamento: ${order.deviceBrand} ${order.deviceModel}`, cy, 11, false, 'left');
      cy += 18; drawText(`Status: ${order.status}`, cy, 10, true, 'left', '#2563eb');
      
      cy += 35; ctx.strokeStyle = '#f1f5f9'; ctx.strokeRect(20 * scale, cy * scale, width - 40 * scale, 60 * scale);
      drawText('Total do Serviço', cy + 25, 10, true, 'center', '#64748b');
      drawText(formatCurrency(order.total), cy + 48, 22, true, 'center', '#000');

      if (photosCount > 0) {
        cy += 100; drawText('EVIDÊNCIAS FOTOGRÁFICAS', cy, 9, true, 'center', '#64748b');
        cy += 15;
        const pw = 190 * scale; const ph = 145 * scale;
        for (let i = 0; i < order.photos.length; i++) {
          try {
            const img = await new Promise<HTMLImageElement>((res) => {
              const el = new Image(); el.onload = () => res(el); el.src = order.photos[i];
            });
            const col = i % 2; const row = Math.floor(i / 2);
            const x = (25 * scale) + (col * (pw + 10 * scale));
            const y = (cy * scale) + (row * (ph + 10 * scale));
            ctx.drawImage(img, x, y, pw, ph);
          } catch (e) {}
        }
      }

      const jpeg = canvas.toDataURL('image/jpeg', 0.8).split(',')[1];
      if ((window as any).AndroidBridge) (window as any).AndroidBridge.shareFile(jpeg, `OS_${order.id}.jpg`, 'image/jpeg');
      else { const a = document.createElement('a'); a.href = `data:image/jpeg;base64,${jpeg}`; a.download = `OS_${order.id}.jpg`; a.click(); }
    } finally { setIsGeneratingReceipt(false); }
  };

  const filtered = orders.filter(o => o.customerName.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div className="space-y-4 pb-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-black text-slate-800 tracking-tight">ORDENS DE SERVIÇO</h2>
        <button onClick={() => { resetForm(); setIsModalOpen(true); }} className="bg-blue-600 text-white p-2.5 rounded-2xl shadow-lg active:scale-95"><Plus size={20} /></button>
      </div>

      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
        <input type="text" placeholder="Pesquisar cliente ou modelo..." className="w-full pl-11 pr-4 py-3.5 bg-white border-none rounded-2xl shadow-sm text-sm font-medium focus:ring-2 focus:ring-blue-500" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
      </div>

      <div className="grid gap-3">
        {filtered.length > 0 ? filtered.map(order => (
          <div key={order.id} className="bg-white p-4 rounded-3xl shadow-sm border border-slate-50 flex items-center justify-between active:bg-slate-50 transition-colors">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center text-blue-600">
                <Smartphone size={24} />
              </div>
              <div className="min-w-0">
                <h3 className="font-bold text-slate-800 text-sm truncate uppercase">{order.customerName}</h3>
                <p className="text-[10px] text-slate-400 font-bold uppercase truncate">{order.deviceBrand} {order.deviceModel}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => { setEditingOrder(order); setFormData(order); setIsModalOpen(true); }} className="p-2.5 text-slate-400 bg-slate-50 rounded-xl"><ChevronRight size={18} /></button>
              <button onClick={() => generateReceiptImage(order)} disabled={isGeneratingReceipt} className="p-2.5 bg-blue-600 text-white rounded-xl shadow-md disabled:bg-blue-300">
                {isGeneratingReceipt ? <Loader2 className="animate-spin" size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>
        )) : (
          <div className="text-center py-20 bg-white rounded-[2.5rem] border-2 border-dashed border-slate-100">
            <p className="text-slate-300 font-black uppercase text-xs tracking-widest">Nenhuma O.S. encontrada</p>
          </div>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 z-50 flex flex-col justify-end md:justify-center p-2 backdrop-blur-sm">
          <div className="bg-white w-full max-w-md mx-auto rounded-[2.5rem] overflow-hidden shadow-2xl animate-in slide-in-from-bottom-10">
            <div className="p-6 border-b border-slate-50 flex justify-between items-center sticky top-0 bg-white">
              <h3 className="font-black text-slate-800 text-lg uppercase tracking-tight">{editingOrder ? 'Editar O.S.' : 'Nova O.S.'}</h3>
              <button onClick={() => setIsModalOpen(false)} className="p-2 text-slate-400 bg-slate-50 rounded-full"><X size={20} /></button>
            </div>
            
            <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto pb-10">
              <div className="grid grid-cols-1 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Cliente</label>
                  <input name="customerName" value={formData.customerName} onChange={handleInputChange} placeholder="Nome Completo" className="w-full p-4 bg-slate-50 rounded-2xl outline-none font-bold text-sm" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <input name="deviceBrand" value={formData.deviceBrand} onChange={handleInputChange} placeholder="Marca" className="w-full p-4 bg-slate-50 rounded-2xl outline-none font-bold text-sm" />
                  <input name="deviceModel" value={formData.deviceModel} onChange={handleInputChange} placeholder="Modelo" className="w-full p-4 bg-slate-50 rounded-2xl outline-none font-bold text-sm" />
                </div>
                <textarea name="defect" value={formData.defect} onChange={handleInputChange} placeholder="Defeito Relatado" className="w-full p-4 bg-slate-50 rounded-2xl outline-none font-bold text-sm h-24 resize-none" />
                
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Fotos do Aparelho (Evidências)</label>
                  {isCompressing && <p className="text-[10px] text-blue-500 font-bold animate-pulse">Otimizando imagens...</p>}
                  <div className="grid grid-cols-4 gap-2">
                    <button 
                      type="button" 
                      onClick={() => triggerUpload('photos')}
                      className="aspect-square bg-blue-50 border-2 border-dashed border-blue-100 rounded-2xl flex flex-col items-center justify-center text-blue-500 active:scale-90 transition-all"
                    >
                      <Camera size={24} />
                      <span className="text-[7px] font-black uppercase mt-1">Capturar</span>
                    </button>
                    {formData.photos?.map((p, i) => (
                      <div key={i} className="relative aspect-square rounded-2xl overflow-hidden border border-slate-100 group">
                        <img src={p} className="w-full h-full object-cover" />
                        <button onClick={() => setFormData(f => ({ ...f, photos: f.photos?.filter((_, idx) => idx !== i) }))} className="absolute top-1 right-1 bg-red-500 text-white p-1 rounded-lg shadow-lg"><X size={10} /></button>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-2">
                   <div className="p-4 bg-slate-50 rounded-2xl">
                      <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Peça</p>
                      <input name="partsCost" value={formatCurrency(formData.partsCost || 0).replace('R$', '').trim()} onChange={handleInputChange} className="w-full bg-transparent font-black text-slate-800 outline-none" />
                   </div>
                   <div className="p-4 bg-blue-50 rounded-2xl">
                      <p className="text-[9px] font-black text-blue-400 uppercase mb-1">Mão de Obra</p>
                      <input name="serviceCost" value={formatCurrency(formData.serviceCost || 0).replace('R$', '').trim()} onChange={handleInputChange} className="w-full bg-transparent font-black text-blue-600 outline-none" />
                   </div>
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-slate-50 bg-slate-50 flex gap-3">
              <button onClick={() => setIsModalOpen(false)} className="flex-1 py-4 font-black text-slate-400 uppercase text-[10px] tracking-widest">Cancelar</button>
              <button onClick={handleSave} disabled={isSaving || isCompressing} className="flex-[2] py-4 bg-blue-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl shadow-blue-500/20 active:scale-95">
                {isSaving ? <Loader2 className="animate-spin" size={20} /> : 'Salvar Ordem'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ServiceOrderTab;
