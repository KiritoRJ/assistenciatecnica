
import React, { useState, useRef } from 'react';
import { Plus, Search, Trash2, Printer, ChevronRight, ClipboardList, Camera, X, MessageCircle, Share2 } from 'lucide-react';
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
    const currentPhotos = formData[field] || [];
    if (currentPhotos.length + files.length > 5) {
      alert('O limite máximo é de 5 fotos por seção.');
      return;
    }
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
    if (!formData.customerName || !formData.deviceModel || !formData.deviceBrand) {
      alert('Por favor, preencha o nome do cliente, marca e modelo do aparelho.');
      return;
    }
    if ((formData.photos?.length || 0) < 2) {
      alert('É necessário anexar no mínimo 2 fotos de entrada do aparelho.');
      return;
    }
    if (formData.status === 'Concluído' && (formData.finishedPhotos?.length || 0) < 2) {
      alert('Para marcar como "Concluído", você deve anexar no mínimo 2 fotos do aparelho pronto.');
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
    if (confirm('Deseja realmente excluir esta ordem de serviço?')) {
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

    // Estimativa de altura
    const inputRows = Math.ceil((order.photos?.length || 0) / 2);
    const finishedRows = Math.ceil((order.finishedPhotos?.length || 0) / 2);
    const estimatedHeight = 250 + (inputRows * 30) + (finishedRows * 30);

    const doc = new jsPDF({
      orientation: 'p',
      unit: 'mm',
      format: [width, estimatedHeight]
    });

    // Background color
    doc.setFillColor(bgColor);
    doc.rect(0, 0, width, estimatedHeight, 'F');

    // Text color and font
    doc.setTextColor(textColor);
    doc.setFont(fontFamily, 'normal');

    let y = 10;

    // Header
    doc.setFontSize(baseFontSize + 4);
    doc.setFont(fontFamily, 'bold');
    doc.text(settings.storeName.toUpperCase(), centerX, y, { align: 'center' });
    y += (baseFontSize * 0.8);
    
    doc.setFontSize(baseFontSize);
    doc.setFont(fontFamily, 'normal');
    doc.text(`ORDEM DE SERVIÇO #${order.id.toUpperCase()}`, centerX, y, { align: 'center' });
    y += (baseFontSize * 0.5);
    doc.text(`Data: ${formatDate(order.date)}`, centerX, y, { align: 'center' });
    y += (baseFontSize * 0.7);

    doc.setDrawColor(textColor);
    doc.line(margin, y, width - margin, y);
    y += (baseFontSize * 0.7);

    // Info Blocks
    const drawBlock = (title: string, lines: string[]) => {
      doc.setFont(fontFamily, 'bold');
      doc.text(title, margin, y);
      y += (baseFontSize * 0.5);
      doc.setFont(fontFamily, 'normal');
      lines.forEach(line => {
        const splitText = doc.splitTextToSize(line, width - 2 * margin);
        doc.text(splitText, margin, y);
        y += (splitText.length * (baseFontSize * 0.45));
      });
      y += (baseFontSize * 0.2);
    };

    drawBlock('CLIENTE', [
      `Nome: ${order.customerName}`,
      `Telefone: ${order.phoneNumber}`,
      `Endereço: ${order.address}`
    ]);

    drawBlock('APARELHO', [
      `Marca: ${order.deviceBrand}`,
      `Modelo: ${order.deviceModel}`,
      `Defeito: ${order.defect}`
    ]);

    drawBlock('REPARO EFETUADO', [order.repairDetails || 'Nenhum detalhe adicional.']);

    doc.line(margin, y, width - margin, y);
    y += (baseFontSize * 0.7);

    // Photos Entry
    if (order.photos && order.photos.length > 0) {
      doc.setFontSize(baseFontSize - 1);
      doc.setFont(fontFamily, 'bold');
      doc.text('FOTOS DE ENTRADA', centerX, y, { align: 'center' });
      y += (baseFontSize * 0.5);
      
      const thumbWidth = (width - 2 * margin - 4) / 2;
      const thumbHeight = 25;
      order.photos.forEach((photo, index) => {
        const col = index % 2;
        const xPos = margin + (col * (thumbWidth + 4));
        try { doc.addImage(photo, 'JPEG', xPos, y, thumbWidth, thumbHeight); } catch (e) {}
        if (col === 1 || index === order.photos.length - 1) y += thumbHeight + 2;
      });
      y += 3;
    }

    // Photos Exit
    if (order.finishedPhotos && order.finishedPhotos.length > 0) {
      doc.setFontSize(baseFontSize - 1);
      doc.setFont(fontFamily, 'bold');
      doc.text('FOTOS DO SERVIÇO CONCLUÍDO', centerX, y, { align: 'center' });
      y += (baseFontSize * 0.5);
      
      const thumbWidth = (width - 2 * margin - 4) / 2;
      const thumbHeight = 25;
      order.finishedPhotos.forEach((photo, index) => {
        const col = index % 2;
        const xPos = margin + (col * (thumbWidth + 4));
        try { doc.addImage(photo, 'JPEG', xPos, y, thumbWidth, thumbHeight); } catch (e) {}
        if (col === 1 || index === order.finishedPhotos.length - 1) y += thumbHeight + 2;
      });
      y += 3;
    }

    doc.line(margin, y, width - margin, y);
    y += (baseFontSize * 0.7);

    // Totals
    doc.setFontSize(baseFontSize + 2);
    doc.setFont(fontFamily, 'bold');
    doc.text(`TOTAL: ${formatCurrency(order.total)}`, centerX, y, { align: 'center' });
    y += (baseFontSize * 1.2);

    doc.line(margin, y, width - margin, y);
    y += (baseFontSize * 0.7);

    // Warranty
    doc.setFontSize(baseFontSize - 1);
    doc.setFont(fontFamily, 'bold');
    doc.text('TERMOS DE GARANTIA', centerX, y, { align: 'center' });
    y += (baseFontSize * 0.5);
    doc.setFont(fontFamily, 'normal');
    
    const warrantyText = settings.pdfWarrantyText || "";
    const splitWarranty = doc.splitTextToSize(warrantyText, width - 2 * margin);
    doc.text(splitWarranty, margin, y);

    return doc;
  };

  const sharePDF = async (order: ServiceOrder) => {
    try {
      const doc = getDoc(order);
      const pdfBlob = doc.output('blob');
      const fileName = `OS_${order.customerName}_${order.id}.pdf`.replace(/\s+/g, '_');
      const file = new File([pdfBlob], fileName, { type: 'application/pdf' });

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: `O.S. ${order.customerName}`,
          text: `Segue a Ordem de Serviço de ${settings.storeName}`,
        });
      } else {
        // Fallback para dispositivos que não suportam compartilhamento de arquivos
        const whatsappNumber = order.phoneNumber.replace(/\D/g, '');
        if (whatsappNumber) {
          window.open(`https://wa.me/55${whatsappNumber}?text=Olá! Segue o link para baixar sua Ordem de Serviço.`, '_blank');
        } else {
          alert('Compartilhamento de arquivos não disponível no seu navegador. O PDF será baixado automaticamente.');
          doc.save(fileName);
        }
      }
    } catch (error) {
      console.error('Erro ao compartilhar:', error);
      alert('Não foi possível compartilhar o arquivo.');
    }
  };

  const filteredOrders = orders.filter(o => 
    o.customerName.toLowerCase().includes(searchTerm.toLowerCase()) || 
    o.deviceModel.toLowerCase().includes(searchTerm.toLowerCase()) ||
    o.deviceBrand.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h2 className="text-2xl font-bold text-slate-800">Ordens de Serviço</h2>
        <button onClick={() => setIsModalOpen(true)} className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-all shadow-md active:scale-95"><Plus size={20} />Nova O.S.</button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
        <input type="text" placeholder="Buscar por cliente, marca ou aparelho..." className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
      </div>

      <div className="grid gap-4">
        {filteredOrders.length > 0 ? (
          filteredOrders.map(order => (
            <div key={order.id} className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-3">
                <div className="flex gap-4">
                  {order.photos?.[0] && <img src={order.photos[0]} className="w-16 h-16 object-cover rounded-lg border border-slate-100" />}
                  <div>
                    <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${order.status === 'Concluído' ? 'bg-green-100 text-green-700' : order.status === 'Entregue' ? 'bg-blue-100 text-blue-700' : 'bg-yellow-100 text-yellow-700'}`}>{order.status}</span>
                    <h3 className="text-lg font-bold text-slate-800 mt-1">{order.customerName}</h3>
                    <p className="text-sm text-slate-500">{order.deviceBrand} {order.deviceModel}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm text-slate-400">{formatDate(order.date)}</p>
                  <p className="text-lg font-bold text-blue-600">{formatCurrency(order.total)}</p>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row items-center justify-between pt-3 border-t border-slate-50 gap-2">
                <div className="flex gap-2 w-full sm:w-auto">
                  <button onClick={() => handleEdit(order)} className="p-2 text-slate-500 hover:text-blue-600 bg-slate-50 rounded-lg"><ChevronRight size={20} /></button>
                  <button onClick={() => handleDelete(order.id)} className="p-2 text-slate-500 hover:text-red-600 bg-slate-50 rounded-lg"><Trash2 size={20} /></button>
                </div>
                <div className="flex gap-2 w-full sm:w-auto overflow-x-auto">
                  <button onClick={() => sharePDF(order)} className="flex-1 sm:flex-none flex items-center justify-center gap-2 text-xs font-bold text-green-600 bg-green-50 hover:bg-green-100 px-4 py-3 rounded-lg transition-all border border-green-100 shadow-sm active:scale-95"><MessageCircle size={18} /> Enviar para WhatsApp</button>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="text-center py-12 bg-white rounded-xl border border-dashed border-slate-300">
            <ClipboardList className="mx-auto text-slate-300 mb-2" size={48} />
            <p className="text-slate-500">Nenhuma ordem de serviço encontrada.</p>
          </div>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white z-10">
              <h3 className="text-xl font-bold text-slate-800">{editingOrder ? 'Editar Ordem de Serviço' : 'Nova Ordem de Serviço'}</h3>
              <button onClick={closeModal} className="text-slate-400 hover:text-slate-600 p-2">&times;</button>
            </div>
            
            <div className="p-6 space-y-6">
              <section className="space-y-4">
                <h4 className="text-sm font-bold text-slate-400 uppercase tracking-wider">Informações do Cliente</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <input name="customerName" value={formData.customerName} onChange={handleInputChange} className="w-full px-3 py-2 border rounded-lg" placeholder="Nome do Cliente" />
                  <input name="phoneNumber" value={formData.phoneNumber} onChange={handleInputChange} className="w-full px-3 py-2 border rounded-lg" placeholder="Telefone" />
                  <input name="address" value={formData.address} onChange={handleInputChange} className="w-full px-3 py-2 border rounded-lg md:col-span-2" placeholder="Endereço" />
                </div>
              </section>

              <section className="space-y-4 pt-4 border-t border-slate-50">
                <h4 className="text-sm font-bold text-slate-400 uppercase tracking-wider">Detalhes do Aparelho</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <input name="deviceBrand" value={formData.deviceBrand} onChange={handleInputChange} className="w-full px-3 py-2 border rounded-lg" placeholder="Marca" />
                  <input name="deviceModel" value={formData.deviceModel} onChange={handleInputChange} className="w-full px-3 py-2 border rounded-lg" placeholder="Modelo" />
                  <select name="status" value={formData.status} onChange={handleInputChange} className="w-full px-3 py-2 border rounded-lg md:col-span-2"><option value="Pendente">Pendente</option><option value="Concluído">Concluído</option><option value="Entregue">Entregue</option></select>
                  <textarea name="defect" value={formData.defect} onChange={handleInputChange} rows={2} className="w-full px-3 py-2 border rounded-lg md:col-span-2" placeholder="Defeito Reclamado" />
                  <textarea name="repairDetails" value={formData.repairDetails} onChange={handleInputChange} rows={2} className="w-full px-3 py-2 border rounded-lg md:col-span-2" placeholder="Reparo Efetuado" />
                </div>
              </section>

              <section className="space-y-4 pt-4 border-t border-slate-50">
                <div className="flex items-center justify-between"><h4 className="text-sm font-bold text-slate-400 uppercase tracking-wider">Fotos de Entrada (Mín 2)</h4><button onClick={() => fileInputRef.current?.click()} className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded-md">Anexar</button><input type="file" ref={fileInputRef} className="hidden" accept="image/*" multiple onChange={(e) => handlePhotoUpload(e, 'photos')} /></div>
                <div className="grid grid-cols-5 gap-2">{formData.photos?.map((photo, index) => (<div key={index} className="relative aspect-square"><img src={photo} className="w-full h-full object-cover rounded-lg" /><button onClick={() => removePhoto(index, 'photos')} className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5"><X size={12} /></button></div>))}</div>
              </section>

              {(formData.status === 'Concluído' || formData.status === 'Entregue') && (
                <section className="space-y-4 pt-4 border-t border-green-100 bg-green-50/30 p-4 rounded-xl">
                  <div className="flex items-center justify-between"><h4 className="text-sm font-bold text-green-700 uppercase tracking-wider">Fotos do Aparelho Pronto (Mín 2)</h4><button onClick={() => finishedFileInputRef.current?.click()} className="text-xs font-bold text-green-700 bg-green-100 px-2 py-1 rounded-md">Anexar Pronto</button><input type="file" ref={finishedFileInputRef} className="hidden" accept="image/*" multiple onChange={(e) => handlePhotoUpload(e, 'finishedPhotos')} /></div>
                  <div className="grid grid-cols-5 gap-2">{formData.finishedPhotos?.map((photo, index) => (<div key={index} className="relative aspect-square"><img src={photo} className="w-full h-full object-cover rounded-lg" /><button onClick={() => removePhoto(index, 'finishedPhotos')} className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5"><X size={12} /></button></div>))}</div>
                </section>
              )}

              <section className="space-y-4 pt-4 border-t border-slate-50">
                <h4 className="text-sm font-bold text-slate-400 uppercase tracking-wider">Financeiro</h4>
                <div className="grid grid-cols-2 gap-4">
                  <input name="partsCost" value={formatCurrency(formData.partsCost || 0).replace('R$', '').trim()} onChange={handleInputChange} className="px-3 py-2 border rounded-lg text-right" placeholder="Valor da Peça" />
                  <input name="serviceCost" value={formatCurrency(formData.serviceCost || 0).replace('R$', '').trim()} onChange={handleInputChange} className="px-3 py-2 border rounded-lg text-right" placeholder="Valor do Serviço" />
                  <div className="col-span-2 flex items-center justify-between bg-blue-50 p-4 rounded-xl font-bold"><span>TOTAL:</span><span className="text-2xl text-blue-600">{formatCurrency((formData.partsCost || 0) + (formData.serviceCost || 0))}</span></div>
                </div>
              </section>
            </div>

            <div className="p-6 border-t bg-slate-50 flex gap-3 sticky bottom-0 z-10">
              <button onClick={closeModal} className="flex-1 py-2 border rounded-lg font-medium text-slate-600 bg-white">Cancelar</button>
              <button onClick={handleSave} className="flex-1 py-2 bg-blue-600 text-white rounded-lg font-bold shadow-lg shadow-blue-200">Salvar O.S.</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ServiceOrderTab;
