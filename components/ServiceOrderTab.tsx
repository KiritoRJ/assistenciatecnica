
import React, { useState, useRef } from 'react';
import { Plus, Search, Trash2, Printer, ChevronRight, ClipboardList, Camera, X, MessageCircle, Share2, FileText, Download, CheckCircle } from 'lucide-react';
import { ServiceOrder, AppSettings } from '../types';
import { formatCurrency, parseCurrencyString, formatDate } from '../utils';
import { jsPDF } from 'jspdf';

interface Props {
  orders: ServiceOrder[];
  setOrders: (orders: ServiceOrder[]) => void;
  settings: AppSettings;
}

const ServiceOrderTab: React.FC<Props> = ({ orders, setOrders, settings }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingOrder, setEditingOrder] = useState<ServiceOrder | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const finishedFileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState<Partial<ServiceOrder>>({
    customerName: '',
    phoneNumber: '',
    address: '',
    deviceBrand: '',
    deviceModel: '',
    defect: '',
    repairDetails: '',
    partsCost: 0,
    serviceCost: 0,
    status: 'Pendente',
    photos: [],
    finishedPhotos: []
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    if (name === 'partsCost' || name === 'serviceCost') {
      const numericValue = parseCurrencyString(value);
      setFormData(prev => {
        const updated = { ...prev, [name]: numericValue };
        return { ...updated, total: (updated.partsCost || 0) + (updated.serviceCost || 0) };
      });
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>, field: 'photos' | 'finishedPhotos') => {
    const files = e.target.files;
    if (!files) return;
    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData(prev => ({ ...prev, [field]: [...(prev[field] || []), reader.result as string] }));
      };
      reader.readAsDataURL(file);
    });
  };

  const removePhoto = (index: number, field: 'photos' | 'finishedPhotos') => {
    setFormData(prev => ({ ...prev, [field]: (prev[field] || []).filter((_, i) => i !== index) }));
  };

  const handleSave = () => {
    if (!formData.customerName || !formData.deviceModel) {
      alert('Preencha os dados obrigatórios.');
      return;
    }
    if (editingOrder) {
      setOrders(orders.map(o => o.id === editingOrder.id ? { ...o, ...formData } as ServiceOrder : o));
    } else {
      const newOrder: ServiceOrder = {
        ...formData,
        id: Math.random().toString(36).substr(2, 9),
        date: new Date().toISOString(),
        total: (formData.partsCost || 0) + (formData.serviceCost || 0),
      } as ServiceOrder;
      setOrders([newOrder, ...orders]);
    }
    closeModal();
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingOrder(null);
    setFormData({ customerName: '', phoneNumber: '', address: '', deviceBrand: '', deviceModel: '', defect: '', repairDetails: '', partsCost: 0, serviceCost: 0, status: 'Pendente', photos: [], finishedPhotos: [] });
  };

  const handleEdit = (order: ServiceOrder) => {
    setEditingOrder(order);
    setFormData(order);
    setIsModalOpen(true);
  };

  const handleDelete = (id: string) => {
    if (confirm('Deseja realmente excluir?')) {
      setOrders(orders.filter(o => o.id !== id));
    }
  };

  const getDoc = (order: ServiceOrder) => {
    const baseFontSize = settings.pdfFontSize || 8;
    const fontFamily = settings.pdfFontFamily || 'helvetica';
    const width = settings.pdfPaperWidth || 80;
    const margin = 5;
    const centerX = width / 2;
    const textColor = settings.pdfTextColor || '#000000';
    const bgColor = settings.pdfBgColor || '#FFFFFF';

    const tempDoc = new jsPDF();
    const textWidth = width - 2 * margin;
    const estimateLines = (text: string) => tempDoc.splitTextToSize(text || "", textWidth).length;

    let estimatedHeight = 50;
    estimatedHeight += 30; // Cliente
    estimatedHeight += 30; // Aparelho
    estimatedHeight += estimateLines(order.repairDetails) * (baseFontSize * 0.6) + 15;
    
    // Altura para fotos de entrada
    if (order.photos && order.photos.length > 0) {
      estimatedHeight += Math.ceil(order.photos.length / 2) * 35 + 10;
    }
    
    // Altura para fotos de saída
    if (order.finishedPhotos && order.finishedPhotos.length > 0) {
      estimatedHeight += Math.ceil(order.finishedPhotos.length / 2) * 35 + 10;
    }

    estimatedHeight += 20; // Totais
    estimatedHeight += estimateLines(settings.pdfWarrantyText) * (baseFontSize * 0.5) + 30;

    const doc = new jsPDF({
      orientation: 'p',
      unit: 'mm',
      format: [width, estimatedHeight]
    });

    doc.setFillColor(bgColor);
    doc.rect(0, 0, width, estimatedHeight, 'F');
    doc.setTextColor(textColor);
    doc.setFont(fontFamily, 'normal');

    let y = 10;
    doc.setFontSize(baseFontSize + 4);
    doc.setFont(fontFamily, 'bold');
    doc.text(settings.storeName.toUpperCase(), centerX, y, { align: 'center' });
    y += 8;
    
    doc.setFontSize(baseFontSize);
    doc.setFont(fontFamily, 'normal');
    doc.text(`ORDEM DE SERVIÇO #${order.id.toUpperCase()}`, centerX, y, { align: 'center' });
    y += 5;
    doc.text(`Data: ${formatDate(order.date)}`, centerX, y, { align: 'center' });
    y += 7;

    doc.line(margin, y, width - margin, y);
    y += 7;

    const drawCenteredBlock = (title: string, lines: string[]) => {
      doc.setFont(fontFamily, 'bold');
      doc.text(title, centerX, y, { align: 'center' });
      y += 5;
      doc.setFont(fontFamily, 'normal');
      lines.forEach(line => {
        const splitText = doc.splitTextToSize(line, textWidth);
        doc.text(splitText, centerX, y, { align: 'center' });
        y += (splitText.length * (baseFontSize * 0.5));
      });
      y += 4;
    };

    drawCenteredBlock('DADOS DO CLIENTE', [
      `Nome: ${order.customerName}`,
      `Telefone: ${order.phoneNumber}`,
      `Endereço: ${order.address}`
    ]);

    drawCenteredBlock('DADOS DO APARELHO', [
      `Marca: ${order.deviceBrand}`,
      `Modelo: ${order.deviceModel}`,
      `Defeito: ${order.defect}`
    ]);

    drawCenteredBlock('REPARO EXECUTADO', [order.repairDetails || 'Em análise']);

    doc.line(margin, y, width - margin, y);
    y += 8;

    // Fotos de Entrada
    if (order.photos && order.photos.length > 0) {
      doc.setFont(fontFamily, 'bold');
      doc.text('FOTOS DE ENTRADA', centerX, y, { align: 'center' });
      y += 5;
      const thumbWidth = (width - 2 * margin - 5) / 2;
      const thumbHeight = 30;
      order.photos.forEach((photo, index) => {
        const col = index % 2;
        const xPos = margin + (col * (thumbWidth + 5));
        try { doc.addImage(photo, 'JPEG', xPos, y, thumbWidth, thumbHeight); } catch(e){}
        if (col === 1 || index === order.photos.length - 1) y += thumbHeight + 2;
      });
      y += 5;
    }

    // Fotos de Saída
    if (order.finishedPhotos && order.finishedPhotos.length > 0) {
      doc.setFont(fontFamily, 'bold');
      doc.text('FOTOS DE SAÍDA (PRONTO)', centerX, y, { align: 'center' });
      y += 5;
      const thumbWidth = (width - 2 * margin - 5) / 2;
      const thumbHeight = 30;
      order.finishedPhotos.forEach((photo, index) => {
        const col = index % 2;
        const xPos = margin + (col * (thumbWidth + 5));
        try { doc.addImage(photo, 'JPEG', xPos, y, thumbWidth, thumbHeight); } catch(e){}
        if (col === 1 || index === order.finishedPhotos.length - 1) y += thumbHeight + 2;
      });
      y += 5;
    }

    doc.setFontSize(baseFontSize + 2);
    doc.setFont(fontFamily, 'bold');
    doc.text(`VALOR TOTAL: ${formatCurrency(order.total)}`, centerX, y, { align: 'center' });
    y += 10;

    doc.setFontSize(baseFontSize - 1);
    doc.text('TERMOS DE GARANTIA', centerX, y, { align: 'center' });
    y += 5;
    doc.setFont(fontFamily, 'normal');
    const warranty = doc.splitTextToSize(settings.pdfWarrantyText, textWidth);
    doc.text(warranty, centerX, y, { align: 'center' });

    return doc;
  };

  const handleDownloadPDF = (order: ServiceOrder) => {
    try {
      const doc = getDoc(order);
      const fileName = `OS_${order.id}.pdf`;
      doc.save(fileName);
    } catch (error) {
      console.error('Erro ao baixar PDF:', error);
      alert('Houve um erro ao gerar o PDF.');
    }
  };

  const sharePDF = async (order: ServiceOrder) => {
    try {
      const doc = getDoc(order);
      const pdfBlob = doc.output('blob');
      const fileName = `OS_${order.id}.pdf`;
      const file = new File([pdfBlob], fileName, { type: 'application/pdf' });

      if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: `O.S. ${order.customerName}`,
          text: `Segue Ordem de Serviço da ${settings.storeName}`,
        });
      } else {
        doc.save(fileName);
        alert('PDF baixado com sucesso!');
      }
    } catch (error) {
      console.error('Erro ao compartilhar:', error);
      alert('Não foi possível compartilhar.');
    }
  };

  const filteredOrders = orders.filter(o => 
    o.customerName.toLowerCase().includes(searchTerm.toLowerCase()) || 
    o.deviceModel.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-slate-800">Ordens de Serviço</h2>
        <button onClick={() => setIsModalOpen(true)} className="bg-blue-600 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 shadow-md active:scale-95"><Plus size={20} /> Nova O.S.</button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
        <input type="text" placeholder="Buscar..." className="w-full pl-10 pr-4 py-2 border rounded-xl" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
      </div>

      <div className="grid gap-4">
        {filteredOrders.map(order => (
          <div key={order.id} className="bg-white border rounded-2xl p-4 shadow-sm space-y-3">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="font-bold text-slate-800">{order.customerName}</h3>
                <p className="text-xs text-slate-500">{order.deviceBrand} {order.deviceModel}</p>
                <p className="text-[10px] text-slate-400">{formatDate(order.date)}</p>
              </div>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${order.status === 'Concluído' ? 'bg-green-100 text-green-700' : order.status === 'Entregue' ? 'bg-blue-100 text-blue-700' : 'bg-yellow-100 text-yellow-700'}`}>{order.status}</span>
            </div>
            
            <div className="flex gap-2">
              <button onClick={() => handleEdit(order)} className="flex-1 bg-slate-50 text-slate-600 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1"><ChevronRight size={16} /> Detalhes</button>
              <button onClick={() => handleDownloadPDF(order)} className="flex-1 bg-blue-50 text-blue-600 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1"><Download size={16} /> PDF</button>
              <button onClick={() => sharePDF(order)} className="flex-1 bg-green-50 text-green-600 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1"><MessageCircle size={16} /> WhatsApp</button>
              <button onClick={() => handleDelete(order.id)} className="p-2 text-red-500 bg-red-50 rounded-xl"><Trash2 size={16} /></button>
            </div>
          </div>
        ))}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b flex justify-between items-center">
              <h3 className="font-bold text-lg">Ordem de Serviço</h3>
              <button onClick={closeModal} className="p-2"><X /></button>
            </div>
            <div className="p-6 space-y-4">
              <input name="customerName" value={formData.customerName} onChange={handleInputChange} className="w-full p-2 border rounded-xl" placeholder="Cliente" />
              <input name="phoneNumber" value={formData.phoneNumber} onChange={handleInputChange} className="w-full p-2 border rounded-xl" placeholder="Telefone" />
              <div className="grid grid-cols-2 gap-2">
                <input name="deviceBrand" value={formData.deviceBrand} onChange={handleInputChange} className="w-full p-2 border rounded-xl" placeholder="Marca" />
                <input name="deviceModel" value={formData.deviceModel} onChange={handleInputChange} className="w-full p-2 border rounded-xl" placeholder="Modelo" />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase ml-1">Status do Serviço</label>
                <select name="status" value={formData.status} onChange={handleInputChange} className="w-full p-2 border rounded-xl">
                  <option value="Pendente">Pendente</option>
                  <option value="Concluído">Concluído</option>
                  <option value="Entregue">Entregue</option>
                </select>
              </div>

              <textarea name="defect" value={formData.defect} onChange={handleInputChange} className="w-full p-2 border rounded-xl" placeholder="Defeito" rows={2} />
              <textarea name="repairDetails" value={formData.repairDetails} onChange={handleInputChange} className="w-full p-2 border rounded-xl" placeholder="Reparo" rows={2} />
              
              <div className="grid grid-cols-2 gap-2">
                <div>
                   <label className="text-[10px] font-bold uppercase ml-1">Custo Peça</label>
                   <input name="partsCost" value={formatCurrency(formData.partsCost || 0).replace('R$', '')} onChange={handleInputChange} className="w-full p-2 border rounded-xl" />
                </div>
                <div>
                   <label className="text-[10px] font-bold uppercase ml-1">Serviço</label>
                   <input name="serviceCost" value={formatCurrency(formData.serviceCost || 0).replace('R$', '')} onChange={handleInputChange} className="w-full p-2 border rounded-xl" />
                </div>
              </div>

              <div className="bg-blue-50 p-4 rounded-2xl flex justify-between items-center font-bold text-blue-700">
                <span>TOTAL:</span>
                <span className="text-xl">{formatCurrency((formData.partsCost || 0) + (formData.serviceCost || 0))}</span>
              </div>

              {/* Seção de Fotos de Entrada */}
              <div className="space-y-2">
                <p className="text-xs font-black uppercase text-slate-400">Fotos de Entrada</p>
                <div className="grid grid-cols-4 gap-2">
                  <button onClick={() => fileInputRef.current?.click()} className="aspect-square border-2 border-dashed rounded-xl flex items-center justify-center text-slate-300">
                    <Camera size={24} />
                  </button>
                  <input type="file" ref={fileInputRef} hidden multiple accept="image/*" onChange={(e) => handlePhotoUpload(e, 'photos')} />
                  {formData.photos?.map((p, i) => (
                    <div key={i} className="relative aspect-square rounded-xl overflow-hidden border">
                      <img src={p} className="w-full h-full object-cover" />
                      <button onClick={() => removePhoto(i, 'photos')} className="absolute top-0 right-0 bg-red-500 text-white p-0.5"><X size={10} /></button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Seção de Fotos de Saída (Pronto) - Condicional */}
              {(formData.status === 'Concluído' || formData.status === 'Entregue') && (
                <div className="space-y-2 p-3 bg-green-50 rounded-2xl border border-green-100 animate-in fade-in slide-in-from-top-2">
                  <p className="text-xs font-black uppercase text-green-600 flex items-center gap-1">
                    <CheckCircle size={14} /> Fotos do Aparelho Pronto
                  </p>
                  <div className="grid grid-cols-4 gap-2">
                    <button onClick={() => finishedFileInputRef.current?.click()} className="aspect-square border-2 border-dashed border-green-200 rounded-xl flex items-center justify-center text-green-300">
                      <Camera size={24} />
                    </button>
                    <input type="file" ref={finishedFileInputRef} hidden multiple accept="image/*" onChange={(e) => handlePhotoUpload(e, 'finishedPhotos')} />
                    {formData.finishedPhotos?.map((p, i) => (
                      <div key={i} className="relative aspect-square rounded-xl overflow-hidden border border-green-200">
                        <img src={p} className="w-full h-full object-cover" />
                        <button onClick={() => removePhoto(i, 'finishedPhotos')} className="absolute top-0 right-0 bg-red-500 text-white p-0.5"><X size={10} /></button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            </div>
            <div className="p-6 border-t bg-slate-50 flex gap-2">
              <button onClick={closeModal} className="flex-1 bg-white border py-3 rounded-2xl font-bold">Cancelar</button>
              <button onClick={handleSave} className="flex-1 bg-blue-600 text-white py-3 rounded-2xl font-bold shadow-lg shadow-blue-200">Salvar O.S.</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ServiceOrderTab;
