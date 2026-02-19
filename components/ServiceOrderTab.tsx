
import React, { useState, useEffect } from 'react';
import { Plus, Search, Trash2, Camera, X, Eye, Loader2, Smartphone, AlertTriangle, Calculator, CheckCircle, Image as ImageIcon, Calendar } from 'lucide-react';
import { ServiceOrder, AppSettings } from '../types';
import { formatCurrency, parseCurrencyString, formatDate } from '../utils';

interface Props {
  orders: ServiceOrder[];
  setOrders: (orders: ServiceOrder[]) => void;
  settings: AppSettings;
  onDeleteOrder: (id: string) => void;
}

const ServiceOrderTab: React.FC<Props> = ({ orders, setOrders, settings, onDeleteOrder }) => {
  // --- ESTADOS DE CONTROLE DE INTERFACE ---
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingOrder, setEditingOrder] = useState<ServiceOrder | null>(null);
  const [isCompressing, setIsCompressing] = useState(false);
  const [isGeneratingReceipt, setIsGeneratingReceipt] = useState(false);
  const [orderToDelete, setOrderToDelete] = useState<string | null>(null);

  // --- ESTADO DO FORMULÁRIO (DADOS DA O.S.) ---
  const [formData, setFormData] = useState<Partial<ServiceOrder>>({
    customerName: '', phoneNumber: '', address: '', deviceBrand: '', deviceModel: '',
    defect: '', repairDetails: '', partsCost: 0, serviceCost: 0, status: 'Pendente',
    photos: [], finishedPhotos: [], entryDate: '', exitDate: ''
  });

  // Manipula mudanças nos campos de texto e select
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    // Formatação de moeda em tempo real
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

  // --- PROCESSAMENTO DE IMAGENS ---
  // Redimensiona e converte para WebP para otimizar o banco de dados SQL
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
        resolve(canvas.toDataURL('image/webp', 0.7));
      };
    });
  };

  // Gerencia a seleção de arquivos de imagem
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

  // --- PERSISTÊNCIA ---
  // Salva ou atualiza a O.S. na lista e sincroniza com o banco remoto
  const handleSave = () => {
    if (!formData.customerName || !formData.deviceModel) return alert('Campos obrigatórios faltando.');
    setIsSaving(true);
    
    let newOrdersList: ServiceOrder[];
    if (editingOrder) {
      newOrdersList = orders.map(o => o.id === editingOrder.id ? { ...o, ...formData } as ServiceOrder : o);
    } else {
      const newOrder: ServiceOrder = {
        ...formData, 
        id: 'OS' + Math.random().toString(36).substr(2, 5).toUpperCase(),
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

  // Limpa o formulário para uma nova entrada
  const resetForm = () => {
    const today = new Date().toLocaleDateString('pt-BR');
    setEditingOrder(null);
    setFormData({ 
      customerName: '', phoneNumber: '', address: '', deviceBrand: '', deviceModel: '', 
      defect: '', status: 'Pendente', photos: [], finishedPhotos: [], 
      partsCost: 0, serviceCost: 0, total: 0, 
      entryDate: today, 
      exitDate: '' 
    });
  };

  // --- GERADOR DE CUPOM TÉRMICO (CANVAS) ---
  const generateReceiptImage = async (order: ServiceOrder) => {
    setIsGeneratingReceipt(true);
    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const scale = 2;
      const width = 380 * scale; 
      let dynamicHeight = 7500 * scale; // Altura inicial grande para corte posterior
      canvas.width = width;
      canvas.height = dynamicHeight;

      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, width, dynamicHeight);

      // Função para quebra de texto por largura (maxWidth)
      const wrapText = (text: string, x: number, y: number, maxWidth: number, lineHeight: number, bold: boolean = false, color: string = '#000', align: 'left' | 'center' = 'left') => {
        ctx.font = `${bold ? '900' : '500'} ${9 * scale}px "Inter", sans-serif`;
        ctx.fillStyle = color;
        ctx.textAlign = align;
        
        const words = (text || '').split(' ');
        let line = '';
        let currentY = y;
        let posX = align === 'center' ? width / 2 : x;

        for (let n = 0; n < words.length; n++) {
          let testLine = line + words[n] + ' ';
          let metrics = ctx.measureText(testLine);
          let testWidth = metrics.width;
          if (testWidth > maxWidth && n > 0) {
            ctx.fillText(line, posX, currentY);
            line = words[n] + ' ';
            currentY += lineHeight;
          } else {
            line = testLine;
          }
        }
        ctx.fillText(line, posX, currentY);
        return currentY + lineHeight;
      };

      // Função para quebra de texto inteligente (32 caracteres sem cortar palavras)
      const wrapTextByChars = (text: string, x: number, y: number, charLimit: number, lineHeight: number, color: string = '#444') => {
        ctx.font = `500 ${9 * scale}px "Inter", sans-serif`;
        ctx.fillStyle = color;
        ctx.textAlign = 'left';
        
        const words = (text || '').split(' ');
        let currentLine = '';
        let currentY = y;

        words.forEach((word, index) => {
          const testLine = currentLine === '' ? word : `${currentLine} ${word}`;
          if (testLine.length > charLimit && index > 0) {
            ctx.fillText(currentLine, x, currentY);
            currentLine = word;
            currentY += lineHeight;
          } else {
            currentLine = testLine;
          }
        });
        
        if (currentLine) {
          ctx.fillText(currentLine, x, currentY);
          currentY += lineHeight;
        }
        return currentY;
      };

      // Desenha linhas tracejadas separadoras
      const drawSeparator = (y: number) => {
        ctx.strokeStyle = '#DDD';
        ctx.lineWidth = 1 * scale;
        ctx.setLineDash([4 * scale, 2 * scale]);
        ctx.beginPath();
        ctx.moveTo(20 * scale, y);
        ctx.lineTo(width - 20 * scale, y);
        ctx.stroke();
        ctx.setLineDash([]);
        return y + 15 * scale;
      };

      let currentY = 50 * scale;

      // 1. Cabeçalho
      ctx.font = `900 ${16 * scale}px "Inter", sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillStyle = '#000';
      ctx.fillText(settings.storeName.toUpperCase(), width / 2, currentY);
      currentY += 25 * scale;

      ctx.font = `700 ${10 * scale}px "Inter", sans-serif`;
      ctx.fillText(`ORDEM DE SERVIÇO: #${order.id}`, width / 2, currentY);
      currentY += 16 * scale;
      ctx.font = `500 ${9 * scale}px "Inter", sans-serif`;
      ctx.fillText(`REGISTRO: ${formatDate(order.date)}`, width / 2, currentY);
      currentY += 25 * scale;

      currentY = drawSeparator(currentY);

      // 2. Dados do Cliente
      ctx.font = `900 ${10 * scale}px "Inter", sans-serif`;
      ctx.textAlign = 'left';
      ctx.fillText("DADOS DO CLIENTE", 25 * scale, currentY);
      currentY += 18 * scale;
      currentY = wrapText(`Nome: ${order.customerName}`, 25 * scale, currentY, width - 50 * scale, 14 * scale);
      currentY = wrapText(`Telefone: ${order.phoneNumber}`, 25 * scale, currentY, width - 50 * scale, 14 * scale);
      currentY = wrapText(`Endereço: ${order.address || 'Não informado'}`, 25 * scale, currentY, width - 50 * scale, 14 * scale);
      currentY += 10 * scale;
      currentY = drawSeparator(currentY);

      // 3. Dados do Aparelho
      ctx.font = `900 ${10 * scale}px "Inter", sans-serif`;
      ctx.fillText("DADOS DO APARELHO", 25 * scale, currentY);
      currentY += 18 * scale;
      currentY = wrapText(`Marca: ${order.deviceBrand}`, 25 * scale, currentY, width - 50 * scale, 14 * scale);
      currentY = wrapText(`Modelo: ${order.deviceModel}`, 25 * scale, currentY, width - 50 * scale, 14 * scale);
      currentY += 14 * scale;
      
      ctx.font = `700 ${9 * scale}px "Inter", sans-serif`;
      ctx.fillText(`DATA DE ENTRADA: ${order.entryDate || '-'}`, 25 * scale, currentY);
      currentY += 14 * scale;
      if (order.status === 'Concluído' || order.status === 'Entregue') {
        ctx.fillText(`DATA DE SAÍDA: ${order.exitDate || '-'}`, 25 * scale, currentY);
        currentY += 14 * scale;
      }
      
      currentY += 8 * scale;
      ctx.font = `900 ${9 * scale}px "Inter", sans-serif`;
      ctx.fillText("Defeito informado:", 25 * scale, currentY);
      currentY += 14 * scale;
      // -- numero de caracteres por quebra de linha 60
      currentY = wrapTextByChars(order.defect, 25 * scale, currentY, 60, 12 * scale);
      currentY += 10 * scale;
      currentY = drawSeparator(currentY);

      // 4. Reparo Efetuado
      ctx.font = `900 ${10 * scale}px "Inter", sans-serif`;
      ctx.fillText("REPARO EFETUADO", 25 * scale, currentY);
      currentY += 18 * scale;
      // -- numero de caracteres por quebra de linha 60
      currentY = wrapTextByChars(order.repairDetails || 'Serviço em andamento.', 25 * scale, currentY, 60, 12 * scale);
      currentY += 10 * scale;
      currentY = drawSeparator(currentY);

      // --- RESTAURAÇÃO: MINIATURAS DAS FOTOS DE ENTRADA ---
      ctx.font = `900 ${10 * scale}px "Inter", sans-serif`;
      ctx.fillText("FOTOS DE ENTRADA", 25 * scale, currentY);
      currentY += 20 * scale;
      if (order.photos && order.photos.length > 0) {
        const thumbSize = 100 * scale;
        const gap = 10 * scale;
        for (let i = 0; i < order.photos.length; i++) {
          const img = new Image();
          img.src = order.photos[i];
          await new Promise(r => img.onload = r);
          ctx.drawImage(img, 25 * scale + (i % 3 * (thumbSize + gap)), currentY + (Math.floor(i/3) * (thumbSize + gap)), thumbSize, thumbSize);
        }
        currentY += (Math.ceil(order.photos.length / 3) * (thumbSize + gap)) + 15 * scale;
      } else {
        ctx.font = `500 ${8 * scale}px "Inter", sans-serif`;
        ctx.fillText("Nenhuma foto anexada.", 25 * scale, currentY);
        currentY += 15 * scale;
      }

      // --- RESTAURAÇÃO: MINIATURAS DAS FOTOS DE CONCLUSÃO ---
      if (order.status === 'Concluído' || order.status === 'Entregue') {
        currentY = drawSeparator(currentY);
        ctx.font = `900 ${10 * scale}px "Inter", sans-serif`;
        ctx.fillText("FOTOS DO SERVIÇO PRONTO", 25 * scale, currentY);
        currentY += 20 * scale;
        if (order.finishedPhotos && order.finishedPhotos.length > 0) {
          const thumbSize = 100 * scale;
          const gap = 10 * scale;
          for (let i = 0; i < order.finishedPhotos.length; i++) {
            const img = new Image();
            img.src = order.finishedPhotos[i];
            await new Promise(r => img.onload = r);
            ctx.drawImage(img, 25 * scale + (i % 3 * (thumbSize + gap)), currentY + (Math.floor(i/3) * (thumbSize + gap)), thumbSize, thumbSize);
          }
          currentY += (Math.ceil(order.finishedPhotos.length / 3) * (thumbSize + gap)) + 15 * scale;
        } else {
          ctx.font = `500 ${8 * scale}px "Inter", sans-serif`;
          ctx.fillText("Nenhuma foto de saída.", 25 * scale, currentY);
          currentY += 15 * scale;
        }
      }

      // 5. Totalizador
      currentY = drawSeparator(currentY);
      currentY += 10 * scale;
      ctx.font = `900 ${12 * scale}px "Inter", sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText("TOTAL DO SERVIÇO", width / 2, currentY);
      currentY += 22 * scale;
      ctx.font = `900 ${22 * scale}px "Inter", sans-serif`;
      ctx.fillText(formatCurrency(order.total), width / 2, currentY);
      currentY += 40 * scale;
      currentY = drawSeparator(currentY);

      // 6. Garantia e Rodapé
      ctx.font = `900 ${10 * scale}px "Inter", sans-serif`;
      ctx.textAlign = 'left';
      ctx.fillText("GARANTIA", 25 * scale, currentY);
      currentY += 18 * scale;
      const cleanWarranty = settings.pdfWarrantyText.replace(/\[\/?(B|C|J|COLOR.*?|U)\]/g, '');
      currentY = wrapText(cleanWarranty, 25 * scale, currentY, width - 50 * scale, 12 * scale, false, '#666');

      currentY += 50 * scale;
      ctx.font = `900 ${10 * scale}px "Inter", sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText("OBRIGADO PELA PREFERÊNCIA!", width / 2, currentY);

      // Processamento final da imagem do cupom
      const finalCanvas = document.createElement('canvas');
      finalCanvas.width = width;
      finalCanvas.height = currentY + 100 * scale;
      const finalCtx = finalCanvas.getContext('2d');
      if (finalCtx) {
        finalCtx.drawImage(canvas, 0, 0);
        const jpeg = finalCanvas.toDataURL('image/jpeg', 0.9);
        const fileName = `OS_${order.id}.jpg`;
        if ((window as any).AndroidBridge) {
          (window as any).AndroidBridge.shareFile(jpeg.split(',')[1], fileName, 'image/jpeg');
        } else {
          const a = document.createElement('a'); a.href = jpeg; a.download = fileName; a.click();
        }
      }
    } catch (err) {
      console.error("Erro cupom:", err);
      alert("Erro ao gerar imagem.");
    } finally {
      setIsGeneratingReceipt(false);
    }
  };

  const filtered = orders.filter(o => o.customerName.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div className="space-y-4 pb-4">
      {/* CABEÇALHO DA TAB */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-black text-slate-800 tracking-tight text-custom-primary uppercase">ORDENS DE SERVIÇO</h2>
        <button onClick={() => { resetForm(); setIsModalOpen(true); }} className="bg-slate-900 text-white p-2.5 rounded-2xl shadow-lg active:scale-95"><Plus size={20} /></button>
      </div>

      {/* BUSCA */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
        <input type="text" placeholder="Pesquisar..." className="w-full pl-11 pr-4 py-3.5 bg-white border-none rounded-2xl shadow-sm text-sm font-medium focus:ring-2 focus:ring-slate-900 outline-none" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
      </div>

      {/* LISTA DE ORDENS */}
      <div className="grid gap-3">
        {filtered.length > 0 ? filtered.map(order => (
          <div key={order.id} className="bg-white p-4 rounded-3xl shadow-sm border border-slate-50 flex items-center justify-between group animate-in fade-in">
            <div className="flex items-center gap-4 flex-1 min-w-0 cursor-pointer" onClick={() => { setEditingOrder(order); setFormData(order); setIsModalOpen(true); }}>
              <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center text-custom-primary overflow-hidden border border-slate-100 shrink-0">
                {order.photos && order.photos.length > 0 ? (
                  <img src={order.photos[0]} className="w-full h-full object-cover" />
                ) : (
                  <Smartphone size={24} />
                )}
              </div>
              <div className="min-w-0">
                <h3 className="font-bold text-slate-800 text-sm truncate uppercase">{order.customerName}</h3>
                <p className="text-[10px] text-slate-400 font-bold uppercase truncate">{order.deviceBrand} {order.deviceModel}</p>
                <div className="flex items-center gap-2 mt-1">
                   <span className={`text-[8px] font-black px-2 py-0.5 rounded-full ${order.status === 'Entregue' ? 'bg-emerald-50 text-emerald-500' : 'bg-blue-50 text-blue-500'} uppercase`}>{order.status}</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={(e) => { e.stopPropagation(); generateReceiptImage(order); }} disabled={isGeneratingReceipt} className="p-2.5 bg-blue-600 text-white rounded-xl shadow-md active:scale-90 disabled:opacity-50">
                {isGeneratingReceipt ? <Loader2 className="animate-spin" size={18} /> : <Eye size={18} />}
              </button>
              <button onClick={(e) => { e.stopPropagation(); setOrderToDelete(order.id); }} className="p-2.5 bg-red-50 text-red-500 rounded-xl hover:bg-red-500 hover:text-white transition-all active:scale-90">
                <Trash2 size={18} />
              </button>
            </div>
          </div>
        )) : (
          <div className="text-center py-20 bg-white rounded-[2.5rem] border-2 border-dashed border-slate-100">
            <p className="text-slate-300 font-black uppercase text-xs">Nenhuma O.S. encontrada</p>
          </div>
        )}
      </div>

      {/* MODAL DE EDIÇÃO / CRIAÇÃO */}
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
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Cliente</label>
                  <input name="customerName" value={formData.customerName} onChange={handleInputChange} placeholder="Nome" className="w-full p-4 bg-slate-50 rounded-2xl outline-none font-bold text-sm" />
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Telefone</label>
                    <input name="phoneNumber" value={formData.phoneNumber} onChange={handleInputChange} placeholder="(00) 00000-0000" className="w-full p-4 bg-slate-50 rounded-2xl outline-none font-bold text-sm" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Endereço</label>
                    <input name="address" value={formData.address} onChange={handleInputChange} placeholder="Endereço" className="w-full p-4 bg-slate-50 rounded-2xl outline-none font-bold text-sm" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Marca</label>
                    <input name="deviceBrand" value={formData.deviceBrand} onChange={handleInputChange} placeholder="Marca" className="w-full p-4 bg-slate-50 rounded-2xl outline-none font-bold text-sm" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Modelo</label>
                    <input name="deviceModel" value={formData.deviceModel} onChange={handleInputChange} placeholder="Modelo" className="w-full p-4 bg-slate-50 rounded-2xl outline-none font-bold text-sm" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5"><Calendar size={12}/> Entrada</label>
                    <input name="entryDate" value={formData.entryDate} onChange={handleInputChange} placeholder="DD/MM/AAAA" className="w-full p-4 bg-slate-50 rounded-2xl outline-none font-bold text-sm" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5"><Calendar size={12}/> Saída</label>
                    <input name="exitDate" value={formData.exitDate} onChange={handleInputChange} placeholder="DD/MM/AAAA" className={`w-full p-4 bg-slate-50 rounded-2xl outline-none font-bold text-sm ${!(formData.status === 'Concluído' || formData.status === 'Entregue') ? 'opacity-50' : ''}`} />
                  </div>
                </div>
                
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</label>
                  <select name="status" value={formData.status} onChange={handleInputChange} className="w-full p-4 bg-slate-50 rounded-2xl outline-none font-bold text-sm appearance-none border-none">
                    <option value="Pendente">Pendente</option>
                    <option value="Concluído">Concluído</option>
                    <option value="Entregue">Entregue</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Defeito</label>
                  <textarea name="defect" value={formData.defect} onChange={handleInputChange} placeholder="Defeito..." className="w-full p-4 bg-slate-50 rounded-2xl outline-none font-bold text-sm h-20 resize-none" />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Reparo</label>
                  <textarea name="repairDetails" value={formData.repairDetails} onChange={handleInputChange} placeholder="Reparo..." className="w-full p-4 bg-slate-50 rounded-2xl outline-none font-bold text-sm h-20 resize-none" />
                </div>
                
                {/* FOTOS DE ENTRADA */}
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5"><Camera size={12}/> Fotos de Entrada</label>
                  <div className="grid grid-cols-4 gap-2">
                    <label className="aspect-square bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl flex items-center justify-center text-slate-400 cursor-pointer active:scale-95 transition-all">
                      {isCompressing ? <Loader2 className="animate-spin" size={18} /> : <Plus size={24} />}
                      <input type="file" accept="image/*" className="hidden" onChange={(e) => handleFileChange(e, 'photos')} />
                    </label>
                    {formData.photos?.map((p, i) => (
                      <div key={i} className="relative aspect-square rounded-2xl overflow-hidden border border-slate-100 shadow-sm">
                        <img src={p} className="w-full h-full object-cover" />
                        <button onClick={() => setFormData(f => ({ ...f, photos: f.photos?.filter((_, idx) => idx !== i) }))} className="absolute top-1 right-1 bg-red-500 text-white p-1 rounded-lg"><X size={10} /></button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* RESTAURAÇÃO: CAMPO DE FOTOS DE SAÍDA (VISÍVEL SE CONCLUÍDO/ENTREGUE) */}
                {(formData.status === 'Concluído' || formData.status === 'Entregue') && (
                  <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
                    <label className="text-[10px] font-black text-emerald-600 uppercase tracking-widest flex items-center gap-1.5"><CheckCircle size={12}/> Fotos do Serviço Pronto</label>
                    <div className="grid grid-cols-4 gap-2">
                      <label className="aspect-square bg-emerald-50 border-2 border-dashed border-emerald-100 rounded-2xl flex items-center justify-center text-emerald-400 cursor-pointer active:scale-95 transition-all">
                        {isCompressing ? <Loader2 className="animate-spin" size={18} /> : <Plus size={24} />}
                        <input type="file" accept="image/*" className="hidden" onChange={(e) => handleFileChange(e, 'finishedPhotos')} />
                      </label>
                      {formData.finishedPhotos?.map((p, i) => (
                        <div key={i} className="relative aspect-square rounded-2xl overflow-hidden border border-emerald-100 shadow-sm">
                          <img src={p} className="w-full h-full object-cover" />
                          <button onClick={() => setFormData(f => ({ ...f, finishedPhotos: f.finishedPhotos?.filter((_, idx) => idx !== i) }))} className="absolute top-1 right-1 bg-red-500 text-white p-1 rounded-lg"><X size={10} /></button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* FINANCEIRO DA O.S. */}
                <div className="space-y-3 pt-2">
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Valor da Peça</label>
                      <div className="p-4 bg-slate-50 rounded-2xl flex items-center gap-2 border border-slate-100">
                        <span className="text-[10px] font-black text-slate-400">R$</span>
                        <input name="partsCost" value={formatCurrency(formData.partsCost || 0).replace('R$', '').trim()} onChange={handleInputChange} className="w-full bg-transparent font-bold text-sm outline-none" placeholder="0,00" />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Valor do Serviço</label>
                      <div className="p-4 bg-slate-50 rounded-2xl flex items-center gap-2 border border-slate-100">
                        <span className="text-[10px] font-black text-slate-400">R$</span>
                        <input name="serviceCost" value={formatCurrency(formData.serviceCost || 0).replace('R$', '').trim()} onChange={handleInputChange} className="w-full bg-transparent font-bold text-sm outline-none" placeholder="0,00" />
                      </div>
                    </div>
                  </div>

                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5"><Calculator size={12}/> Total Geral</label>
                  <div className="p-5 bg-blue-600 rounded-[1.5rem] shadow-xl flex items-center justify-between border border-blue-500">
                    <input name="total" value={formatCurrency(formData.total || 0).replace('R$', '').trim()} onChange={handleInputChange} className="w-full bg-transparent font-black text-white outline-none text-2xl" placeholder="0,00" />
                  </div>
                </div>
              </div>
            </div>

            {/* BOTÕES DE AÇÃO DO MODAL */}
            <div className="p-6 border-t border-slate-50 bg-slate-50 flex gap-3">
              <button onClick={() => setIsModalOpen(false)} className="flex-1 py-4 font-black text-slate-400 uppercase text-[10px]">Sair</button>
              <button onClick={handleSave} disabled={isSaving} className="flex-[2] py-4 bg-blue-600 text-white rounded-2xl font-black uppercase text-[10px] shadow-xl active:scale-95">
                {isSaving ? <Loader2 className="animate-spin" size={20} /> : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE CONFIRMAÇÃO DE EXCLUSÃO */}
      {orderToDelete && (
        <div className="fixed inset-0 bg-slate-950/80 z-[100] flex items-center justify-center p-6 backdrop-blur-sm">
          <div className="bg-white w-full max-w-xs rounded-[2rem] overflow-hidden shadow-2xl">
            <div className="p-8 text-center space-y-4">
              <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-2"><AlertTriangle size={32} /></div>
              <h3 className="font-black text-slate-800 uppercase text-sm">Excluir?</h3>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Essa ação é permanente.</p>
              <div className="flex gap-2 pt-2">
                <button onClick={() => setOrderToDelete(null)} className="flex-1 py-4 bg-slate-100 text-slate-500 rounded-xl font-black text-[9px]">Sair</button>
                <button onClick={() => { onDeleteOrder(orderToDelete); setOrderToDelete(null); }} className="flex-1 py-4 bg-red-600 text-white rounded-xl font-black text-[9px] shadow-lg">Remover</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ServiceOrderTab;
