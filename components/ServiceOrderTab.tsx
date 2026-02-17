
import React, { useState } from 'react';
import { Plus, Search, Trash2, Camera, X, Eye, Loader2, Smartphone, AlertTriangle, Calculator, CheckCircle } from 'lucide-react';
import { ServiceOrder, AppSettings } from '../types';
import { formatCurrency, parseCurrencyString, formatDate } from '../utils';

interface Props {
  orders: ServiceOrder[];
  setOrders: (orders: ServiceOrder[]) => void;
  settings: AppSettings;
  onDeleteOrder: (id: string) => void;
}

const ServiceOrderTab: React.FC<Props> = ({ orders, setOrders, settings, onDeleteOrder }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingOrder, setEditingOrder] = useState<ServiceOrder | null>(null);
  const [isCompressing, setIsCompressing] = useState(false);
  const [isGeneratingReceipt, setIsGeneratingReceipt] = useState(false);
  const [orderToDelete, setOrderToDelete] = useState<string | null>(null);

  const [formData, setFormData] = useState<Partial<ServiceOrder>>({
    customerName: '', phoneNumber: '', address: '', deviceBrand: '', deviceModel: '',
    defect: '', repairDetails: '', partsCost: 0, serviceCost: 0, status: 'Pendente',
    photos: [], finishedPhotos: []
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    if (name === 'partsCost' || name === 'serviceCost' || name === 'total') {
      const numericValue = parseCurrencyString(value);
      setFormData(prev => {
        const updated = { ...prev, [name]: numericValue };
        if (name === 'total') return { ...updated, total: numericValue };
        const total = (updated.partsCost || 0) + (updated.serviceCost || 0);
        return { ...updated, total };
      });
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const compressImage = (base64Str: string, size: number = 800): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.src = base64Str;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        if (width > height) {
          if (width > size) { height *= size / width; width = size; }
        } else {
          if (height > size) { width *= size / height; height = size; }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.6));
      };
    });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>, field: 'photos' | 'finishedPhotos') => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsCompressing(true);
    const reader = new FileReader();
    reader.onloadend = async () => {
      try {
        const compressed = await compressImage(reader.result as string);
        setFormData(prev => ({ ...prev, [field]: [...(prev[field] || []), compressed] }));
      } catch (err) {
        console.error("Erro ao processar imagem", err);
      } finally {
        setIsCompressing(false);
        e.target.value = '';
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSave = () => {
    if (!formData.customerName || !formData.deviceModel) return alert('Campos obrigatórios faltando.');
    setIsSaving(true);
    
    let newOrdersList: ServiceOrder[];
    if (editingOrder) {
      newOrdersList = orders.map(o => o.id === editingOrder.id ? { ...o, ...formData } as ServiceOrder : o);
    } else {
      const newOrder: ServiceOrder = {
        ...formData, 
        id: 'OS_' + Math.random().toString(36).substr(2, 6).toUpperCase(),
        date: new Date().toISOString(), 
        total: formData.total || (formData.partsCost || 0) + (formData.serviceCost || 0),
      } as ServiceOrder;
      newOrdersList = [newOrder, ...orders];
    }
    
    setOrders(newOrdersList);
    setIsModalOpen(false);
    resetForm();
    setIsSaving(false);
  };

  const resetForm = () => {
    setEditingOrder(null);
    setFormData({ customerName: '', phoneNumber: '', address: '', deviceBrand: '', deviceModel: '', defect: '', status: 'Pendente', photos: [], finishedPhotos: [], partsCost: 0, serviceCost: 0, total: 0 });
  };

  const generateReceiptImage = async (order: ServiceOrder) => {
    setIsGeneratingReceipt(true);
    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const scale = 2;
      const width = 400 * scale; 
      
      // Cálculo de altura dinâmica inicial base
      let dynamicHeight = 850 * scale; 
      if (order.photos?.length) dynamicHeight += 120 * scale;
      if (order.finishedPhotos?.length) dynamicHeight += 120 * scale;
      if (settings.pdfWarrantyText) dynamicHeight += 200 * scale;

      canvas.width = width;
      canvas.height = dynamicHeight;
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, width, dynamicHeight);

      const drawText = (text: string, y: number, sz: number, b: boolean = false, al: 'center' | 'left' | 'right' = 'center', col: string = '#000000') => {
        ctx.fillStyle = col;
        ctx.font = `${b ? '900' : '500'} ${sz * scale}px "Inter", sans-serif`;
        ctx.textAlign = al;
        let x = al === 'center' ? width / 2 : (al === 'left' ? 25 * scale : width - 25 * scale);
        ctx.fillText((text || '').toUpperCase(), x, y);
      };

      const drawDashedLine = (y: number) => {
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 1 * scale;
        ctx.beginPath();
        ctx.moveTo(25 * scale, y);
        ctx.lineTo(width - 25 * scale, y);
        ctx.stroke();
      };

      let currentY = 60 * scale;

      // --- HEADER DA LOJA ---
      drawText(settings.storeName, currentY, 20, true, 'center');
      currentY += 25 * scale;
      
      if (settings.storeAddress) {
        drawText(settings.storeAddress, currentY, 7.5, false, 'center');
        currentY += 16 * scale;
      }
      if (settings.storePhone) {
        drawText(`FONE: ${settings.storePhone}`, currentY, 7.5, false, 'center');
        currentY += 16 * scale;
      }
      
      currentY += 20 * scale;
      drawText("COMPROVANTE DE ORDEM DE SERVIÇO", currentY, 9, true, 'center');
      currentY += 30 * scale;
      drawDashedLine(currentY);
      currentY += 45 * scale;

      // --- INFO PROTOCOLO ---
      drawText("PROTOCOL:", currentY, 8.5, true, 'left');
      drawText(`#${order.id}`, currentY, 11, true, 'right');
      currentY += 22 * scale;
      drawText("DATA:", currentY, 8.5, true, 'left');
      drawText(formatDate(order.date), currentY, 9, false, 'right');
      currentY += 22 * scale;
      drawText("STATUS:", currentY, 8.5, true, 'left');
      drawText(order.status, currentY, 9, true, 'right');
      currentY += 40 * scale;

      // --- SEÇÃO CLIENTE ---
      drawText("DADOS DO CLIENTE", currentY, 7.5, true, 'left');
      currentY += 22 * scale;
      drawText(order.customerName, currentY, 13, true, 'left');
      currentY += 18 * scale;
      drawText(`TELEFONE: ${order.phoneNumber}`, currentY, 9, false, 'left');
      currentY += 16 * scale;
      if (order.address) {
        drawText(`ENDEREÇO: ${order.address}`, currentY, 8.5, false, 'left');
        currentY += 16 * scale;
      }
      currentY += 35 * scale;

      // --- SEÇÃO EQUIPAMENTO ---
      drawText("EQUIPAMENTO", currentY, 7.5, true, 'left');
      currentY += 22 * scale;
      drawText(`${order.deviceBrand} ${order.deviceModel}`, currentY, 12, true, 'left');
      currentY += 40 * scale;

      // --- DEFEITO E REPARO ---
      drawText("DEFEITO RELATADO", currentY, 7.5, true, 'left');
      currentY += 22 * scale;
      ctx.font = `${500} ${9 * scale}px "Inter", sans-serif`;
      const defectLines = order.defect.match(/.{1,45}/g) || [];
      defectLines.forEach(line => {
        ctx.fillText(line.toUpperCase(), 25 * scale, currentY);
        currentY += 16 * scale;
      });
      currentY += 25 * scale;

      if (order.repairDetails) {
        drawText("SERVIÇO REALIZADO", currentY, 7.5, true, 'left');
        currentY += 22 * scale;
        const repairLines = order.repairDetails.match(/.{1,45}/g) || [];
        repairLines.forEach(line => {
          ctx.fillText(line.toUpperCase(), 25 * scale, currentY);
          currentY += 16 * scale;
        });
        currentY += 30 * scale;
      }

      // --- FOTOS DE ENTRADA ---
      if (order.photos && order.photos.length > 0) {
        drawText("FOTOS DE ENTRADA", currentY, 7.5, true, 'left');
        currentY += 18 * scale;
        for (let i = 0; i < Math.min(order.photos.length, 4); i++) {
           const img = new Image();
           img.src = order.photos[i];
           await new Promise(r => img.onload = r);
           ctx.drawImage(img, (25 + (i * 90)) * scale, currentY, 80 * scale, 80 * scale);
        }
        currentY += 105 * scale;
      }

      // --- FOTOS DE SAÍDA (APARELHO PRONTO) ---
      if (order.finishedPhotos && order.finishedPhotos.length > 0) {
        drawText("FOTOS DO APARELHO PRONTO", currentY, 7.5, true, 'left');
        currentY += 18 * scale;
        for (let i = 0; i < Math.min(order.finishedPhotos.length, 4); i++) {
           const img = new Image();
           img.src = order.finishedPhotos[i];
           await new Promise(r => img.onload = r);
           ctx.drawImage(img, (25 + (i * 90)) * scale, currentY, 80 * scale, 80 * scale);
        }
        currentY += 105 * scale;
      }

      // --- VALOR TOTAL ---
      drawDashedLine(currentY);
      currentY += 50 * scale;

      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 1 * scale;
      ctx.strokeRect(25 * scale, currentY - 30 * scale, width - 50 * scale, 55 * scale);
      
      drawText("VALOR TOTAL DO SERVIÇO", currentY, 10, true, 'left');
      drawText(formatCurrency(order.total), currentY, 15, true, 'right');
      currentY += 80 * scale;

      // --- TERMO DE GARANTIA ---
      if (settings.pdfWarrantyText) {
        drawText("TERMO DE GARANTIA", currentY, 8, true, 'left');
        currentY += 24 * scale;
        ctx.font = `${500} ${7.5 * scale}px "Inter", sans-serif`;
        const warrantyLines = settings.pdfWarrantyText.match(/.{1,60}/g) || [];
        warrantyLines.forEach(line => {
          ctx.fillText(line.toUpperCase(), 25 * scale, currentY);
          currentY += 13 * scale;
        });
        currentY += 50 * scale;
      }

      // --- FOOTER ---
      drawText("OBRIGADO PELA PREFERÊNCIA!", currentY, 9, true, 'center');
      currentY += 20 * scale;
      drawText("SISTEMA ASSISTÊNCIA PRO CLOUD", currentY, 6.5, false, 'center');

      // --- EXPORTAÇÃO FINAL ---
      const finalCanvas = document.createElement('canvas');
      finalCanvas.width = width;
      finalCanvas.height = currentY + 60 * scale;
      const finalCtx = finalCanvas.getContext('2d');
      if (finalCtx) {
        finalCtx.drawImage(canvas, 0, 0);
        const jpeg = finalCanvas.toDataURL('image/jpeg', 0.9);
        
        const fileName = `OS_${order.id}_${order.customerName.replace(/\s+/g, '_')}.jpg`;
        
        if ((window as any).AndroidBridge) {
          const base64 = jpeg.split(',')[1];
          (window as any).AndroidBridge.shareFile(base64, fileName, 'image/jpeg');
        } else {
          const a = document.createElement('a');
          a.href = jpeg;
          a.download = fileName;
          a.click();
        }
      }
    } catch (err) {
      console.error("Erro ao gerar cupom O.S.:", err);
      alert("Falha ao processar o recibo.");
    } finally {
      setIsGeneratingReceipt(false);
    }
  };

  const filtered = orders.filter(o => o.customerName.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div className="space-y-4 pb-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-black text-slate-800 tracking-tight text-custom-primary uppercase">ORDENS DE SERVIÇO</h2>
        <button onClick={() => { resetForm(); setIsModalOpen(true); }} className="bg-slate-900 text-white p-2.5 rounded-2xl shadow-lg active:scale-95"><Plus size={20} /></button>
      </div>

      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
        <input type="text" placeholder="Pesquisar cliente ou modelo..." className="w-full pl-11 pr-4 py-3.5 bg-white border-none rounded-2xl shadow-sm text-sm font-medium focus:ring-2 focus:ring-slate-900 outline-none" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
      </div>

      <div className="grid gap-3">
        {filtered.length > 0 ? filtered.map(order => (
          <div key={order.id} className="bg-white p-4 rounded-3xl shadow-sm border border-slate-50 flex items-center justify-between group animate-in fade-in">
            <div className="flex items-center gap-4 flex-1 min-w-0 cursor-pointer" onClick={() => { setEditingOrder(order); setFormData(order); setIsModalOpen(true); }}>
              <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center text-custom-primary">
                <Smartphone size={24} />
              </div>
              <div className="min-w-0">
                <h3 className="font-bold text-slate-800 text-sm truncate uppercase">{order.customerName}</h3>
                <p className="text-[10px] text-slate-400 font-bold uppercase truncate">{order.deviceBrand} {order.deviceModel}</p>
                <span className={`text-[8px] font-black px-2 py-0.5 rounded-full ${order.status === 'Entregue' ? 'bg-emerald-50 text-emerald-500' : 'bg-blue-50 text-blue-500'} uppercase mt-1 inline-block`}>{order.status}</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={(e) => { e.stopPropagation(); generateReceiptImage(order); }} disabled={isGeneratingReceipt} title="Ver/Baixar Cupom" className="p-2.5 bg-blue-600 text-white rounded-xl shadow-md active:scale-90 disabled:opacity-50">
                {isGeneratingReceipt ? <Loader2 className="animate-spin" size={18} /> : <Eye size={18} />}
              </button>
              <button onClick={(e) => { e.stopPropagation(); setOrderToDelete(order.id); }} title="Excluir O.S." className="p-2.5 bg-red-50 text-red-500 rounded-xl hover:bg-red-500 hover:text-white transition-all active:scale-90">
                <Trash2 size={18} />
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
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Telefone</label>
                    <input name="phoneNumber" value={formData.phoneNumber} onChange={handleInputChange} placeholder="(00) 00000-0000" className="w-full p-4 bg-slate-50 rounded-2xl outline-none font-bold text-sm" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Endereço do Cliente</label>
                    <input name="address" value={formData.address} onChange={handleInputChange} placeholder="Cidade/Rua" className="w-full p-4 bg-slate-50 rounded-2xl outline-none font-bold text-sm" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Marca</label>
                    <input name="deviceBrand" value={formData.deviceBrand} onChange={handleInputChange} placeholder="Marca" className="w-full p-4 bg-slate-50 rounded-2xl outline-none font-bold text-sm" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Modelo</label>
                    <input name="deviceModel" value={formData.deviceModel} onChange={handleInputChange} placeholder="Modelo" className="w-full p-4 bg-slate-50 rounded-2xl outline-none font-bold text-sm" />
                  </div>
                </div>
                
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Status do Serviço</label>
                  <select name="status" value={formData.status} onChange={handleInputChange} className="w-full p-4 bg-slate-50 rounded-2xl outline-none font-bold text-sm appearance-none">
                    <option value="Pendente">Pendente</option>
                    <option value="Concluído">Concluído</option>
                    <option value="Entregue">Entregue</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Defeito Relatado</label>
                  <textarea name="defect" value={formData.defect} onChange={handleInputChange} placeholder="Descreva o problema..." className="w-full p-4 bg-slate-50 rounded-2xl outline-none font-bold text-sm h-24 resize-none" />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Detalhes do Reparo</label>
                  <textarea name="repairDetails" value={formData.repairDetails} onChange={handleInputChange} placeholder="O que foi feito?" className="w-full p-4 bg-slate-50 rounded-2xl outline-none font-bold text-sm h-24 resize-none" />
                </div>
                
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Fotos de Entrada (Aparelho)</label>
                  <div className="grid grid-cols-4 gap-2">
                    <label htmlFor="photos-input-entry" className="aspect-square bg-blue-50 border-2 border-dashed border-blue-100 rounded-2xl flex flex-col items-center justify-center text-blue-500 active:scale-95 transition-all cursor-pointer">
                      {isCompressing ? <Loader2 className="animate-spin" size={24} /> : <Camera size={24} />}
                      <span className="text-[7px] font-black uppercase mt-1">Anexar</span>
                    </label>
                    <input id="photos-input-entry" type="file" accept="image/*" className="sr-only" onChange={(e) => handleFileChange(e, 'photos')} />
                    {formData.photos?.map((p, i) => (
                      <div key={i} className="relative aspect-square rounded-2xl overflow-hidden border border-slate-100 shadow-sm">
                        <img src={p} className="w-full h-full object-cover" />
                        <button onClick={() => setFormData(f => ({ ...f, photos: f.photos?.filter((_, idx) => idx !== i) }))} className="absolute top-1 right-1 bg-red-500 text-white p-1 rounded-lg"><X size={10} /></button>
                      </div>
                    ))}
                  </div>
                </div>

                {formData.status === 'Entregue' && (
                  <div className="space-y-2 p-4 bg-emerald-50/30 rounded-3xl border border-emerald-100/50 animate-in fade-in slide-in-from-top-2 duration-300">
                    <label className="text-[10px] font-black text-emerald-600 uppercase tracking-widest ml-1 flex items-center gap-1.5">
                      <CheckCircle size={12} /> Fotos do Aparelho Pronto (Entrega)
                    </label>
                    <div className="grid grid-cols-4 gap-2">
                      <label htmlFor="photos-input-exit" className="aspect-square bg-emerald-100 border-2 border-dashed border-emerald-200 rounded-2xl flex flex-col items-center justify-center text-emerald-600 active:scale-95 transition-all cursor-pointer">
                        <Camera size={24} />
                        <span className="text-[7px] font-black uppercase mt-1">Anexar</span>
                      </label>
                      <input id="photos-input-exit" type="file" accept="image/*" className="sr-only" onChange={(e) => handleFileChange(e, 'finishedPhotos')} />
                      {formData.finishedPhotos?.map((p, i) => (
                        <div key={i} className="relative aspect-square rounded-2xl overflow-hidden border border-emerald-100 shadow-sm">
                          <img src={p} className="w-full h-full object-cover" />
                          <button onClick={() => setFormData(f => ({ ...f, finishedPhotos: f.finishedPhotos?.filter((_, idx) => idx !== i) }))} className="absolute top-1 right-1 bg-red-500 text-white p-1 rounded-lg"><X size={10} /></button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="space-y-3 pt-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-1.5">
                    <Calculator size={12} /> Gestão de Valores (Uso Interno)
                  </label>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100">
                      <p className="text-[8px] font-black text-slate-400 uppercase mb-1">Custo da Peça</p>
                      <input 
                        name="partsCost" 
                        value={formatCurrency(formData.partsCost || 0).replace('R$', '').trim()} 
                        onChange={handleInputChange} 
                        className="w-full bg-transparent font-black text-slate-800 outline-none text-xs"
                        placeholder="0,00"
                      />
                    </div>
                    <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100">
                      <p className="text-[8px] font-black text-slate-400 uppercase mb-1">Mão de Obra</p>
                      <input 
                        name="serviceCost" 
                        value={formatCurrency(formData.serviceCost || 0).replace('R$', '').trim()} 
                        onChange={handleInputChange} 
                        className="w-full bg-transparent font-black text-slate-800 outline-none text-xs"
                        placeholder="0,00"
                      />
                    </div>
                  </div>

                  <div className="p-5 bg-blue-600 rounded-[1.5rem] shadow-xl shadow-blue-500/20 flex items-center justify-between border border-blue-500">
                    <div className="w-full">
                      <p className="text-[9px] font-black text-blue-100 uppercase tracking-widest mb-0.5">Valor Final para o Cliente</p>
                      <input 
                        name="total" 
                        value={formatCurrency(formData.total || 0).replace('R$', '').trim()} 
                        onChange={handleInputChange} 
                        className="w-full bg-transparent font-black text-white outline-none text-2xl"
                        placeholder="0,00"
                        readOnly={false}
                      />
                    </div>
                    <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center text-white">
                      <Calculator size={20} />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-slate-50 bg-slate-50 flex gap-3">
              <button onClick={() => setIsModalOpen(false)} className="flex-1 py-4 font-black text-slate-400 uppercase text-[10px] tracking-widest">Cancelar</button>
              <button onClick={handleSave} disabled={isSaving} className="flex-[2] py-4 bg-blue-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl active:scale-95">
                {isSaving ? <Loader2 className="animate-spin" size={20} /> : 'Salvar no Banco SQL'}
              </button>
            </div>
          </div>
        </div>
      )}

      {orderToDelete && (
        <div className="fixed inset-0 bg-slate-950/80 z-[100] flex items-center justify-center p-6 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-xs rounded-[2rem] overflow-hidden shadow-2xl animate-in zoom-in-95">
            <div className="p-8 text-center space-y-4">
              <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-2">
                <AlertTriangle size={32} />
              </div>
              <h3 className="font-black text-slate-800 uppercase text-sm">Excluir O.S.?</h3>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest leading-relaxed px-2">
                Essa ação removerá o registro permanentemente do SQL.
              </p>
              <div className="flex gap-2 pt-2">
                <button onClick={() => setOrderToDelete(null)} className="flex-1 py-4 bg-slate-100 text-slate-500 rounded-xl font-black text-[9px] uppercase tracking-widest">Sair</button>
                <button onClick={() => { onDeleteOrder(orderToDelete); setOrderToDelete(null); }} className="flex-1 py-4 bg-red-600 text-white rounded-xl font-black text-[9px] uppercase tracking-widest shadow-lg shadow-red-500/20">Remover</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ServiceOrderTab;
