
import React, { useState } from 'react';
import { Plus, Search, Trash2, ChevronRight, Camera, X, Eye, Loader2, Image as ImageIcon, Smartphone, AlertTriangle, Calculator, CheckCircle } from 'lucide-react';
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

  const compressImage = (base64Str: string): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.src = base64Str;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_DIM = 800;
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
    
    let newOrdersList: ServiceOrder[];
    if (editingOrder) {
      newOrdersList = orders.map(o => o.id === editingOrder.id ? { ...o, ...formData } as ServiceOrder : o);
    } else {
      const newOrder: ServiceOrder = {
        ...formData, 
        id: 'OS_' + Math.random().toString(36).substr(2, 6).toUpperCase(),
        date: new Date().toISOString(), 
        total: (formData.partsCost || 0) + (formData.serviceCost || 0),
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

  const loadImage = (src: string): Promise<HTMLImageElement> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => resolve(img);
      img.src = src;
    });
  };

  const generateReceiptImage = async (order: ServiceOrder) => {
    setIsGeneratingReceipt(true);
    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      
      const scale = 2;
      const width = (settings.pdfPaperWidth || 80) * 4.75 * scale; 
      const thermalFont = (sz: number, bold: boolean = false) => `${bold ? '900' : '400'} ${sz * scale}px "Courier New", Courier, monospace`;
      
      // Labels dinâmicas com fallbacks
      const lblProtocol = settings.receiptLabelProtocol || 'PROTOCOLO';
      const lblDate = settings.receiptLabelDate || 'DATA';
      const lblClientSection = settings.receiptLabelClientSection || 'DADOS DO CLIENTE';
      const lblClientName = settings.receiptLabelClientName || 'NOME';
      const lblClientPhone = settings.receiptLabelClientPhone || 'FONE';
      const lblServiceSection = settings.receiptLabelServiceSection || 'INFORMAÇÕES DO SERVIÇO';
      const lblDevice = settings.receiptLabelDevice || 'APARELHO';
      const lblDefect = settings.receiptLabelDefect || 'DEFEITO';
      const lblRepair = settings.receiptLabelRepair || 'REPARO';
      const lblTotal = settings.receiptLabelTotal || 'TOTAL GERAL';
      const lblEntry = settings.receiptLabelEntryPhotos || 'FOTOS DE ENTRADA';
      const lblExit = settings.receiptLabelExitPhotos || 'FOTOS DE SAÍDA';

      const thumbSize = 65 * scale;
      const thumbGap = 8 * scale;
      const imagesPerRow = 5;
      const entryCount = order.photos?.length || 0;
      const finishedCount = order.finishedPhotos?.length || 0;
      const entryRows = Math.ceil(entryCount / imagesPerRow);
      const finishedRows = Math.ceil(finishedCount / imagesPerRow);
      
      // Estimativa dinâmica de altura baseada no conteúdo
      const dynamicHeightEstimate = (2000 + (entryRows + finishedRows) * 100) * scale;
      canvas.width = width;
      canvas.height = dynamicHeightEstimate;
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, width, dynamicHeightEstimate);

      const drawText = (text: string, y: number, sz: number, b: boolean = false, al: 'center' | 'left' | 'right' = 'center', col: string = settings.pdfTextColor || '#000') => {
        ctx.fillStyle = col;
        ctx.font = thermalFont(sz, b);
        ctx.textAlign = al;
        let x = al === 'center' ? width / 2 : (al === 'left' ? 20 * scale : width - 20 * scale);
        ctx.fillText((text || '').toUpperCase(), x, y);
      };

      const drawDashedLine = (y: number) => {
        ctx.strokeStyle = settings.pdfTextColor || '#000';
        ctx.lineWidth = 1 * scale;
        ctx.setLineDash([5 * scale, 3 * scale]);
        ctx.beginPath();
        ctx.moveTo(15 * scale, y);
        ctx.lineTo(width - 15 * scale, y);
        ctx.stroke();
        ctx.setLineDash([]);
      };

      const drawWrappedText = (text: string, y: number, sz: number, maxWidth: number, al: 'left' | 'center' = 'left', b: boolean = false) => {
        const words = (text || '').split(' ');
        let line = '';
        const lineHeight = (sz + 2) * scale;
        let linesCount = 0;
        ctx.font = thermalFont(sz, b);
        ctx.textAlign = al;
        let startX = al === 'center' ? width / 2 : 20 * scale;

        for (let n = 0; n < words.length; n++) {
          const testLine = line + words[n] + ' ';
          const metrics = ctx.measureText(testLine);
          if (metrics.width > maxWidth && n > 0) {
            ctx.fillText(line.toUpperCase(), startX, y + linesCount * lineHeight);
            line = words[n] + ' ';
            linesCount++;
          } else {
            line = testLine;
          }
        }
        ctx.fillText(line.toUpperCase(), startX, y + linesCount * lineHeight);
        return (linesCount + 1) * lineHeight;
      };

      let currentY = 40 * scale;

      // Cabeçalho da Loja
      drawText(settings.storeName, currentY, 18, true);
      currentY += 25 * scale;
      if(settings.receiptHeaderSubtitle) {
        drawText(settings.receiptHeaderSubtitle, currentY, 9, false);
        currentY += 25 * scale;
      }
      
      drawDashedLine(currentY);
      currentY += 25 * scale;
      
      drawText(`${lblProtocol}: #${order.id}`, currentY, 12, true);
      currentY += 18 * scale;
      drawText(`${lblDate}: ${new Date(order.date).toLocaleDateString()} ${new Date(order.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`, currentY, 9);
      currentY += 18 * scale;
      drawText(`STATUS: ${order.status}`, currentY, 10, true);
      currentY += 25 * scale;
      
      drawDashedLine(currentY);
      currentY += 25 * scale;

      // Seção Cliente
      drawText(lblClientSection, currentY, 10, true, 'left');
      currentY += 18 * scale;
      currentY += drawWrappedText(`${lblClientName}: ${order.customerName}`, currentY, 9, width - 40 * scale, 'left', false);
      if(order.phoneNumber) {
        drawText(`${lblClientPhone}: ${order.phoneNumber}`, currentY, 9, false, 'left');
        currentY += 15 * scale;
      }
      if(order.address) {
        currentY += drawWrappedText(`END: ${order.address}`, currentY, 9, width - 40 * scale, 'left', false);
      }

      currentY += 10 * scale;
      drawDashedLine(currentY);
      currentY += 25 * scale;

      // Seção Serviço
      drawText(lblServiceSection, currentY, 10, true, 'left');
      currentY += 18 * scale;
      currentY += drawWrappedText(`${lblDevice}: ${order.deviceBrand} ${order.deviceModel}`, currentY, 10, width - 40 * scale, 'left', false);
      currentY += drawWrappedText(`${lblDefect}: ${order.defect}`, currentY, 9, width - 40 * scale, 'left', false);
      if(order.repairDetails) {
        currentY += drawWrappedText(`${lblRepair}: ${order.repairDetails}`, currentY, 9, width - 40 * scale, 'left', false);
      }
      
      currentY += 15 * scale;
      drawDashedLine(currentY);
      currentY += 25 * scale;

      // Total com destaque
      ctx.fillStyle = '#F1F5F9';
      ctx.fillRect(15 * scale, currentY - 20 * scale, width - 30 * scale, 50 * scale);
      drawText(lblTotal, currentY + 12 * scale, 11, true, 'left', '#1E293B');
      drawText(formatCurrency(order.total), currentY + 12 * scale, 16, true, 'right', '#1E293B');
      currentY += 60 * scale;

      drawDashedLine(currentY);
      currentY += 30 * scale;

      // Galeria de Fotos de Entrada
      if (entryCount > 0) {
        drawText(lblEntry, currentY, 8, true, 'left', '#64748B');
        currentY += 15 * scale;
        for (let i = 0; i < entryCount; i++) {
          const img = await loadImage(order.photos[i]);
          const row = Math.floor(i / imagesPerRow);
          const col = i % imagesPerRow;
          const x = (20 + col * (65 + 8)) * scale;
          const yPos = currentY + (row * (65 + 8)) * scale;
          ctx.drawImage(img, x, yPos, thumbSize, thumbSize);
        }
        currentY += entryRows * (65 + 8) * scale + 25 * scale;
      }

      // Galeria de Fotos de Saída (se houver)
      if (finishedCount > 0) {
        drawText(lblExit, currentY, 8, true, 'left', '#059669');
        currentY += 15 * scale;
        for (let i = 0; i < finishedCount; i++) {
          const img = await loadImage(order.finishedPhotos![i]);
          const row = Math.floor(i / imagesPerRow);
          const col = i % imagesPerRow;
          const x = (20 + col * (65 + 8)) * scale;
          const yPos = currentY + (row * (65 + 8)) * scale;
          ctx.drawImage(img, x, yPos, thumbSize, thumbSize);
        }
        currentY += finishedRows * (65 + 8) * scale + 25 * scale;
      }

      // Rodapé e Termos
      drawDashedLine(currentY);
      currentY += 25 * scale;
      if(settings.pdfWarrantyText) {
        currentY += drawWrappedText(settings.pdfWarrantyText, currentY, 8, width - 40 * scale, 'center', true);
        currentY += 25 * scale;
      }
      drawText("SISTEMA ASSISTÊNCIA PRO", currentY, 7, false, 'center', '#94A3B8');

      // Corte final do canvas
      const finalCanvas = document.createElement('canvas');
      finalCanvas.width = width;
      finalCanvas.height = currentY + 50 * scale;
      const finalCtx = finalCanvas.getContext('2d');
      if (finalCtx) {
        finalCtx.drawImage(canvas, 0, 0);
        const jpeg = finalCanvas.toDataURL('image/jpeg', 0.85).split(',')[1];
        if ((window as any).AndroidBridge) {
          (window as any).AndroidBridge.shareFile(jpeg, `RECIBO_OS_${order.id}.jpg`, 'image/jpeg');
        } else {
          const a = document.createElement('a');
          a.href = `data:image/jpeg;base64,${jpeg}`;
          a.download = `RECIBO_OS_${order.id}.jpg`;
          a.click();
        }
      }
    } catch (err) {
      console.error("Erro ao gerar cupom:", err);
      alert("Falha ao processar o cupom fiscal com fotos.");
    } finally {
      setIsGeneratingReceipt(false);
    }
  };

  const filtered = orders.filter(o => o.customerName.toLowerCase().includes(searchTerm.toLowerCase()));

  const confirmDelete = () => {
    if (orderToDelete) {
      onDeleteOrder(orderToDelete);
      setOrderToDelete(null);
    }
  };

  return (
    <div className="space-y-4 pb-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-black text-slate-800 tracking-tight text-custom-primary">ORDENS DE SERVIÇO</h2>
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
              <button 
                onClick={(e) => { e.stopPropagation(); generateReceiptImage(order); }} 
                disabled={isGeneratingReceipt}
                title="Visualizar Cupom"
                className="p-2.5 bg-blue-600 text-white rounded-xl shadow-md active:scale-90 disabled:opacity-50"
              >
                {isGeneratingReceipt ? <Loader2 className="animate-spin" size={18} /> : <Eye size={18} />}
              </button>
              <button 
                onClick={(e) => { e.stopPropagation(); setOrderToDelete(order.id); }} 
                className="p-2.5 bg-red-50 text-red-500 rounded-xl hover:bg-red-500 hover:text-white transition-all active:scale-90"
              >
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

      {orderToDelete && (
        <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-6 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-xs rounded-[2rem] overflow-hidden shadow-2xl animate-in zoom-in-95">
            <div className="p-6 text-center space-y-4">
              <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-2">
                <AlertTriangle size={32} />
              </div>
              <h3 className="font-black text-slate-800 uppercase text-sm">Excluir Ordem?</h3>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest leading-relaxed">
                Esta ação removerá a O.S. permanentemente do Banco de Dados SQL Cloud.
              </p>
              <div className="flex gap-2 pt-2">
                <button onClick={() => setOrderToDelete(null)} className="flex-1 py-3 bg-slate-100 text-slate-500 rounded-xl font-black text-[9px] uppercase tracking-widest">Cancelar</button>
                <button onClick={confirmDelete} className="flex-1 py-3 bg-red-600 text-white rounded-xl font-black text-[9px] uppercase tracking-widest shadow-lg shadow-red-500/20">Confirmar</button>
              </div>
            </div>
          </div>
        </div>
      )}

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
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Endereço</label>
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
                    <button type="button" onClick={() => triggerUpload('photos')} className="aspect-square bg-blue-50 border-2 border-dashed border-blue-100 rounded-2xl flex flex-col items-center justify-center text-blue-500 active:scale-90 transition-all">
                      <Camera size={24} />
                      <span className="text-[7px] font-black uppercase mt-1">Fotos</span>
                    </button>
                    {formData.photos?.map((p, i) => (
                      <div key={i} className="relative aspect-square rounded-2xl overflow-hidden border border-slate-100">
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
                      <button type="button" onClick={() => triggerUpload('finishedPhotos')} className="aspect-square bg-emerald-100 border-2 border-dashed border-emerald-200 rounded-2xl flex flex-col items-center justify-center text-emerald-600 active:scale-90 transition-all">
                        <Camera size={24} />
                        <span className="text-[7px] font-black uppercase mt-1">Anexar</span>
                      </button>
                      {formData.finishedPhotos?.map((p, i) => (
                        <div key={i} className="relative aspect-square rounded-2xl overflow-hidden border border-emerald-100">
                          <img src={p} className="w-full h-full object-cover" />
                          <button onClick={() => setFormData(f => ({ ...f, finishedPhotos: f.finishedPhotos?.filter((_, idx) => idx !== i) }))} className="absolute top-1 right-1 bg-red-500 text-white p-1 rounded-lg"><X size={10} /></button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="space-y-3 pt-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-1.5">
                    <Calculator size={12} /> Valores do Reparo
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                      <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Valor da Peça</p>
                      <input 
                        name="partsCost" 
                        value={formatCurrency(formData.partsCost || 0).replace('R$', '').trim()} 
                        onChange={handleInputChange} 
                        className="w-full bg-transparent font-black text-slate-800 outline-none text-base"
                        placeholder="0,00"
                      />
                    </div>
                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                      <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Valor do Serviço</p>
                      <input 
                        name="serviceCost" 
                        value={formatCurrency(formData.serviceCost || 0).replace('R$', '').trim()} 
                        onChange={handleInputChange} 
                        className="w-full bg-transparent font-black text-blue-600 outline-none text-base"
                        placeholder="0,00"
                      />
                    </div>
                  </div>
                  <div className="p-5 bg-blue-600 rounded-[1.5rem] shadow-xl shadow-blue-500/20 flex items-center justify-between border border-blue-500">
                    <div>
                      <p className="text-[9px] font-black text-blue-100 uppercase tracking-widest mb-0.5">Valor Total do Reparo</p>
                      <p className="text-2xl font-black text-white leading-none">{formatCurrency(formData.total || 0)}</p>
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
                {isSaving ? <Loader2 className="animate-spin" size={20} /> : 'Salvar SQL Cloud'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ServiceOrderTab;
