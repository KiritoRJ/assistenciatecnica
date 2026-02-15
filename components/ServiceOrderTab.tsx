
import React, { useState, useRef } from 'react';
import { Plus, Search, Trash2, ChevronRight, Camera, X, Eye } from 'lucide-react';
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

  const generatePDF = (order: ServiceOrder) => {
    const doc = new jsPDF({
      orientation: 'p',
      unit: 'mm',
      format: [80, 150] // Formato bobina 80mm
    });

    doc.setFontSize(10);
    doc.text(settings.storeName.toUpperCase(), 40, 10, { align: 'center' });
    doc.text(`ORDEM DE SERVIÇO #${order.id}`, 40, 15, { align: 'center' });
    doc.line(5, 18, 75, 18);
    
    doc.setFontSize(8);
    doc.text(`Cliente: ${order.customerName}`, 5, 25);
    doc.text(`Aparelho: ${order.deviceBrand} ${order.deviceModel}`, 5, 30);
    doc.text(`Status: ${order.status}`, 5, 35);
    
    doc.text(`Defeito: ${order.defect}`, 5, 45);
    doc.text(`Reparo: ${order.repairDetails || 'Em análise'}`, 5, 50);
    
    doc.setFontSize(10);
    doc.text(`TOTAL: ${formatCurrency(order.total)}`, 40, 70, { align: 'center' });
    
    // Dispara download que o Android MainActivity irá interceptar
    doc.save(`OS_${order.id}.pdf`);
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
              <button onClick={() => handleEdit(order)} className="flex-1 bg-slate-50 text-slate-600 py-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1 active:scale-95"><ChevronRight size={16} /> Detalhes</button>
              <button onClick={() => generatePDF(order)} className="flex-[2] bg-blue-600 text-white py-3 rounded-xl text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 shadow-lg active:scale-95"><Eye size={16} /> Visualizar Saída</button>
              <button onClick={() => handleDelete(order.id)} className="p-3 text-red-500 bg-red-50 rounded-xl active:scale-90"><Trash2 size={16} /></button>
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

              <select name="status" value={formData.status} onChange={handleInputChange} className="w-full p-2 border rounded-xl">
                <option value="Pendente">Pendente</option>
                <option value="Concluído">Concluído</option>
                <option value="Entregue">Entregue</option>
              </select>

              <textarea name="defect" value={formData.defect} onChange={handleInputChange} className="w-full p-2 border rounded-xl" placeholder="Defeito" rows={2} />
              <textarea name="repairDetails" value={formData.repairDetails} onChange={handleInputChange} className="w-full p-2 border rounded-xl" placeholder="Reparo" rows={2} />
              
              <div className="grid grid-cols-2 gap-2">
                <input name="partsCost" value={formatCurrency(formData.partsCost || 0).replace('R$', '')} onChange={handleInputChange} className="w-full p-2 border rounded-xl" placeholder="Custo Peça" />
                <input name="serviceCost" value={formatCurrency(formData.serviceCost || 0).replace('R$', '')} onChange={handleInputChange} className="w-full p-2 border rounded-xl" placeholder="Serviço" />
              </div>

              <div className="bg-blue-50 p-4 rounded-2xl flex justify-between items-center font-bold text-blue-700">
                <span>TOTAL:</span>
                <span className="text-xl">{formatCurrency((formData.partsCost || 0) + (formData.serviceCost || 0))}</span>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-bold text-slate-400">Fotos Entrada</p>
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
            </div>
            <div className="p-6 border-t bg-slate-50 flex gap-2">
              <button onClick={closeModal} className="flex-1 bg-white border py-3 rounded-2xl font-bold">Cancelar</button>
              <button onClick={handleSave} className="flex-1 bg-blue-600 text-white py-3 rounded-2xl font-bold">Salvar O.S.</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ServiceOrderTab;
