
import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { 
  Plus, Search, Trash2, Camera, X, Eye, Loader2, Smartphone, 
  AlertTriangle, Calculator, CheckCircle, Image as ImageIcon, Calendar, 
  KeyRound, Lock, Download, Maximize2, Layout, Check, Printer, Share2,
  SlidersHorizontal, ArrowDownAZ, Clock, ShieldCheck, RotateCcw
} from 'lucide-react';
import { ServiceOrder, AppSettings, User, Customer } from '../types';
import { formatCurrency, parseCurrencyString, formatDate, formatDateTime, generateRandomNumericCode } from '../utils';
import { OnlineDB } from '../utils/api';

interface Props {
  orders: ServiceOrder[];
  setOrders: (orders: ServiceOrder[]) => void;
  settings: AppSettings;
  onUpdateSettings: (settings: AppSettings) => Promise<void>;
  onDeleteOrder: (id: string) => void;
  tenantId: string;
  maxOS?: number;
  currentUser: User | null;
  customers?: Customer[];
  onSaveCustomer?: (customer: Customer) => Promise<void>;
  onSaveCustomers?: (customers: Customer[]) => Promise<void>;
  prefilledCustomer?: Customer | null;
  onClearPrefilledCustomer?: () => void;
}

const COMMON_DEFECTS = [
  'Não Liga', 'Tela Quebrada', 'Bateria Viciada', 'Conector de Carga', 
  'Câmera com Defeito', 'Botões Falhando', 'Som Baixo/Mudo', 'Sinal de Rede', 
  'Wi-Fi não conecta', 'Software/Travando', 'Oxidação/Molhou', 'Vidro Traseiro'
];

const ServiceOrderTab: React.FC<Props> = ({ 
  orders, 
  setOrders, 
  settings, 
  onUpdateSettings, 
  onDeleteOrder, 
  tenantId, 
  maxOS, 
  currentUser,
  customers = [],
  onSaveCustomer,
  onSaveCustomers,
  prefilledCustomer,
  onClearPrefilledCustomer
}) => {
  // --- ESTADOS DE CONTROLE DE INTERFACE ---
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingOrder, setEditingOrder] = useState<ServiceOrder | null>(null);
  const [isCompressing, setIsCompressing] = useState(false);
  const [isGeneratingReceipt, setIsGeneratingReceipt] = useState(false);
  const [orderToDelete, setOrderToDelete] = useState<string | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [verifyingPassword, setVerifyingPassword] = useState(false);
  const [authError, setAuthError] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedOrderForPhotos, setSelectedOrderForPhotos] = useState<ServiceOrder | null>(null);
  const [statusChangeOrder, setStatusChangeOrder] = useState<ServiceOrder | null>(null);
  const [fullScreenPhoto, setFullScreenPhoto] = useState<string | null>(null);

  const [suppliers, setSuppliers] = useState<any[]>([]);

  useEffect(() => {
    if (tenantId) {
      OnlineDB.fetchSuppliers(tenantId).then(setSuppliers);
    }
  }, [tenantId, isModalOpen]);
  const [osLayout, setOsLayout] = useState<'small' | 'medium' | 'large'>(settings.osLayout || 'medium');
  const [sortMode, setSortMode] = useState<'recent' | 'alphabetical' | 'oldest'>('recent');
  const [filterType, setFilterType] = useState<'all' | 'warranty_only' | 'expired_only' | 'pending_only' | 'delivered_only'>('all');
  const [isSortModalOpen, setIsSortModalOpen] = useState(false);
  const [isSigning, setIsSigning] = useState(false);
  const signatureRef = React.useRef<HTMLCanvasElement>(null);
  const fullScreenSignatureRef = React.useRef<HTMLCanvasElement>(null);
  const [isFullScreenSignatureOpen, setIsFullScreenSignatureOpen] = useState(false);
  const [lastCreatedOrder, setLastCreatedOrder] = useState<ServiceOrder | null>(null);
  const [orderToPrint, setOrderToPrint] = useState<ServiceOrder | null>(null);

  const visibleOrders = useMemo(() => orders.filter(o => !o.isDeleted), [orders]);
  const osCount = visibleOrders.length;
  const limitReached = maxOS !== undefined && osCount >= maxOS;

  const isExpired = (dateStr: string) => {
    if (!dateStr) return false;
    const orderDate = new Date(dateStr);
    if (isNaN(orderDate.getTime())) return false;
    
    // 3 meses atrás
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    
    return orderDate < threeMonthsAgo;
  };

  // Verifica se a ordem está dentro do prazo de garantia (90 dias padrão a partir da entrega/saída ou criação)
  const isUnderWarranty = (order: ServiceOrder) => {
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    // Se possui data de saída informada
    if (order.exitDate) {
      if (order.exitDate.includes('/')) {
        const parts = order.exitDate.split('/');
        if (parts.length === 3) {
          const exitD = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
          if (!isNaN(exitD.getTime())) {
            return exitD >= ninetyDaysAgo;
          }
        }
      } else {
        const exitD = new Date(order.exitDate);
        if (!isNaN(exitD.getTime())) {
          return exitD >= ninetyDaysAgo;
        }
      }
    }

    // Pela data de criação da OS
    if (order.date) {
      const orderDate = new Date(order.date);
      if (!isNaN(orderDate.getTime())) {
        return orderDate >= ninetyDaysAgo;
      }
    }

    return false;
  };

  // --- ESTADO DO FORMULÁRIO (DADOS DA O.S.) ---
  const [formData, setFormData] = useState<Partial<ServiceOrder>>({
    customerName: '', phoneNumber: '', address: '', deviceBrand: '', deviceModel: '',
    defect: '', repairDetails: '', partsCost: 0, serviceCost: 0, status: 'Pendente',
    photos: [], finishedPhotos: [], entryDate: '', exitDate: '',
    checklist: [], signature: '', partSupplierId: '', partSupplierWarranty: '',
    customerId: ''
  });

  // Sugestões e busca automática de clientes existentes
  const [showCustomerSuggestions, setShowCustomerSuggestions] = useState(false);

  // Efeito para preencher cliente vindo da aba Clientes
  useEffect(() => {
    if (prefilledCustomer) {
      resetForm();
      const today = new Date().toLocaleDateString('pt-BR');
      setFormData(prev => ({
        ...prev,
        customerName: prefilledCustomer.name,
        phoneNumber: prefilledCustomer.phoneNumber || '',
        address: prefilledCustomer.address || '',
        customerId: prefilledCustomer.id,
        entryDate: today,
        status: 'Pendente'
      }));
      setIsModalOpen(true);
      if (onClearPrefilledCustomer) onClearPrefilledCustomer();
    }
  }, [prefilledCustomer]);

  // Lista de sugestões de clientes baseada no que o usuário digita
  const matchedCustomerSuggestions = useMemo(() => {
    if (!customers || customers.length === 0) return [];
    const nameSearch = (formData.customerName || '').trim().toLowerCase();
    const phoneSearch = (formData.phoneNumber || '').replace(/\D/g, '');

    if (nameSearch.length < 2 && phoneSearch.length < 3) return [];

    return customers.filter(c => {
      if (c.isDeleted) return false;
      const cName = c.name.toLowerCase();
      const cPhone = (c.phoneNumber || '').replace(/\D/g, '');

      const matchName = nameSearch.length >= 2 && cName.includes(nameSearch);
      const matchPhone = phoneSearch.length >= 3 && cPhone.includes(phoneSearch);

      return matchName || matchPhone;
    }).slice(0, 5);
  }, [customers, formData.customerName, formData.phoneNumber]);

  // Checa se o cliente atual já existe cadastrado
  const matchedExistingCustomer = useMemo(() => {
    if (!customers || customers.length === 0) return null;
    const cleanName = (formData.customerName || '').trim().toLowerCase();
    const cleanPhone = (formData.phoneNumber || '').replace(/\D/g, '');

    if (!cleanName && cleanPhone.length < 8) return null;

    return customers.find(c => {
      if (c.isDeleted) return false;
      if (formData.customerId && c.id === formData.customerId) return true;
      const cPhone = (c.phoneNumber || '').replace(/\D/g, '');
      if (cleanPhone.length >= 8 && cPhone.length >= 8 && cleanPhone === cPhone) return true;
      if (cleanName && c.name.trim().toLowerCase() === cleanName) return true;
      return false;
    }) || null;
  }, [customers, formData.customerName, formData.phoneNumber, formData.customerId]);

  const selectSuggestedCustomer = (customer: Customer) => {
    setFormData(prev => ({
      ...prev,
      customerName: customer.name,
      phoneNumber: customer.phoneNumber || prev.phoneNumber,
      address: customer.address || prev.address,
      customerId: customer.id
    }));
    setShowCustomerSuggestions(false);
  };

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
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsCompressing(true);
    const processedImages: string[] = [];

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        
        // Validação: Apenas imagens
        if (!file.type.startsWith('image/')) {
          alert(`O arquivo "${file.name}" não é uma imagem e foi ignorado.`);
          continue;
        }

        const reader = new FileReader();
        
        await new Promise<void>((resolve) => {
          reader.onloadend = async () => {
            try {
              if (reader.result) {
                const compressed = await compressImage(reader.result as string);
                processedImages.push(compressed);
              }
            } catch (err) {
              console.error("Erro ao processar imagem", err);
            }
            resolve();
          };
          reader.readAsDataURL(file);
        });
      }
      
      if (processedImages.length > 0) {
        setFormData(prev => ({ ...prev, [field]: [...(prev[field] || []), ...processedImages] }));
      }
    } catch (err) {
      console.error("Erro ao processar imagens", err);
    } finally {
      setIsCompressing(false);
      if (e.target) e.target.value = ''; 
    }
  };

  // --- PERSISTÊNCIA ---
  // Salva ou atualiza a O.S. na lista e sincroniza com o banco remoto
  const handleSave = async () => {
    if (limitReached && !editingOrder) {
      alert(`Limite de ${maxOS} Ordens de Serviço atingido. Para cadastrar mais, atualize seu plano.`);
      return;
    }

    if (!formData.customerName || !formData.deviceModel) return alert('Campos obrigatórios faltando.');
    setIsSaving(true);

    // --- SINCRONIZAÇÃO AUTOMÁTICA DO CLIENTE ---
    let assignedCustomerId = formData.customerId;
    const cleanCustomerName = (formData.customerName || '').trim();
    const cleanPhone = (formData.phoneNumber || '').trim();
    const rawPhoneDigits = cleanPhone.replace(/\D/g, '');

    // Busca se o cliente já existe (por ID, telefone com 8+ dígitos, ou nome exato)
    const existingCustomer = (customers || []).find(c => {
      if (c.isDeleted) return false;
      if (assignedCustomerId && c.id === assignedCustomerId) return true;
      const cPhoneDigits = (c.phoneNumber || '').replace(/\D/g, '');
      if (rawPhoneDigits.length >= 8 && cPhoneDigits.length >= 8 && rawPhoneDigits === cPhoneDigits) {
        return true;
      }
      return c.name.trim().toLowerCase() === cleanCustomerName.toLowerCase();
    });

    if (existingCustomer) {
      assignedCustomerId = existingCustomer.id;
      // Atualiza telefone ou endereço se o cliente não tinha ou se foi informado algo novo
      const updatedCustomer: Customer = {
        ...existingCustomer,
        address: formData.address?.trim() || existingCustomer.address || '',
        phoneNumber: cleanPhone || existingCustomer.phoneNumber || '',
        updatedAt: new Date().toISOString()
      };
      if (onSaveCustomer) {
        await onSaveCustomer(updatedCustomer);
      }
    } else if (cleanCustomerName) {
      // Cliente NÃO existe: o sistema cria automaticamente!
      const newCustomer: Customer = {
        id: 'C_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5).toUpperCase(),
        tenantId: tenantId,
        name: cleanCustomerName,
        phoneNumber: cleanPhone,
        address: formData.address?.trim() || '',
        notes: '',
        notesHistory: [],
        createdAt: new Date().toISOString()
      };
      assignedCustomerId = newCustomer.id;
      if (onSaveCustomer) {
        await onSaveCustomer(newCustomer);
      }
    }
    
    let newOrdersList: ServiceOrder[];
    if (editingOrder) {
      const updatedOrder = { ...editingOrder, ...formData, customerId: assignedCustomerId } as ServiceOrder;
      
      // Se o status mudou para Concluído ou Entregue, calcula comissão
      if ((updatedOrder.status === 'Concluído' || updatedOrder.status === 'Entregue') && 
          (editingOrder.status !== 'Concluído' && editingOrder.status !== 'Entregue')) {
          
          if (tenantId && currentUser?.id) {
             // Atribui o técnico logado se não houver um definido
             if (!updatedOrder.technicianId) {
                 updatedOrder.technicianId = currentUser.id;
             }
             // Calcula comissão para o técnico responsável (se houver)
             if (updatedOrder.technicianId) {
                OnlineDB.calculateAndLogCommission(tenantId, updatedOrder, 'service_order', updatedOrder.technicianId);
             }
          }
      }

      newOrdersList = orders.map(o => o.id === editingOrder.id ? updatedOrder : o);
    } else {
      const formattedId = generateRandomNumericCode();
      
      const newOrder: ServiceOrder = {
        ...formData, 
        id: formattedId,
        customerId: assignedCustomerId,
        date: new Date().toISOString(), 
        total: formData.total || (formData.partsCost || 0) + (formData.serviceCost || 0),
        sellerId: currentUser?.id, // Quem abriu a OS
        technicianId: null // Técnico será atribuído ao concluir
      } as ServiceOrder;
      
      newOrdersList = [newOrder, ...orders];
    }
    
    setOrders(newOrdersList);
    setIsModalOpen(false);

    // Se for uma nova OS, imprime diretamente
    if (!editingOrder) {
      const newOrder = newOrdersList[0];
      setLastCreatedOrder(newOrder);
      setOrderToPrint(newOrder);
      setTimeout(() => {
        window.print();
      }, 500);
    }

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
      exitDate: '',
      checklist: [],
      signature: '',
      paymentMethod: undefined,
      paymentInstallments: 1,
      partSupplierId: '',
      partSupplierWarranty: '',
      customerId: '',
      trackingToken: '',
      publicNotes: '',
      isTrackingEnabled: true
    });
    setShowCustomerSuggestions(false);
  };

  // --- LÓGICA DE ASSINATURA ---
  const startDrawing = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    const canvas = e.currentTarget;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsSigning(true);
  };

  const draw = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isSigning) return;
    const canvas = e.currentTarget;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    ctx.lineTo(x, y);
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.stroke();
  };

  const stopDrawing = (e: React.PointerEvent<HTMLCanvasElement>, isFullScreen: boolean = false) => {
    if (!isSigning) return;
    setIsSigning(false);
    e.currentTarget.releasePointerCapture(e.pointerId);
    const canvas = e.currentTarget;
    if (canvas && !isFullScreen) {
      setFormData(prev => ({ ...prev, signature: canvas.toDataURL('image/png') }));
    }
  };

  const clearSignature = () => {
    const canvas = signatureRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      ctx?.clearRect(0, 0, canvas.width, canvas.height);
      setFormData(prev => ({ ...prev, signature: '' }));
    }
  };

  const clearFullScreenSignature = () => {
    const canvas = fullScreenSignatureRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      ctx?.clearRect(0, 0, canvas.width, canvas.height);
    }
  };

  const saveFullScreenSignature = () => {
    const canvas = fullScreenSignatureRef.current;
    if (canvas) {
      setFormData(prev => ({ ...prev, signature: canvas.toDataURL('image/png') }));
      setIsFullScreenSignatureOpen(false);
    }
  };

  const toggleChecklist = (item: string) => {
    setFormData(prev => {
      const current = prev.checklist || [];
      if (current.includes(item)) {
        return { ...prev, checklist: current.filter(i => i !== item) };
      }
      return { ...prev, checklist: [...current, item] };
    });
  };

  const generateTrackingToken = () => {
    const newToken = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    setFormData(prev => ({ ...prev, trackingToken: newToken }));
  };

  const copyLink = () => {
    const link = `${window.location.origin}/acompanhamento/${formData.trackingToken}`;
    navigator.clipboard.writeText(link);
    alert('Link copiado!');
  };

  const sendWhatsApp = () => {
     const link = `${window.location.origin}/acompanhamento/${formData.trackingToken}`;
     const message = `Olá, ${formData.customerName}! 👋%0A%0ASua Ordem de Serviço #${formData.id?.split('-')[0] || ''} foi registrada na TICCELL.%0A%0AVocê pode acompanhar o andamento do serviço pelo link abaixo:%0A%0A${link}%0A%0AQualquer dúvida, estamos à disposição.`;
     window.open(`https://wa.me/${formData.phoneNumber?.replace(/\D/g, '')}?text=${message}`, '_blank');
  };

  useEffect(() => {
    if (isModalOpen && !formData.signature && signatureRef.current) {
      const canvas = signatureRef.current;
      const ctx = canvas.getContext('2d');
      ctx?.clearRect(0, 0, canvas.width, canvas.height);
    }
  }, [isModalOpen, formData.signature]);

  useEffect(() => {
    if (isFullScreenSignatureOpen && fullScreenSignatureRef.current) {
      const canvas = fullScreenSignatureRef.current;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        if (formData.signature) {
          const img = new Image();
          img.onload = () => {
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          };
          img.src = formData.signature;
        }
      }
    }
  }, [isFullScreenSignatureOpen, formData.signature]);

  const handleQuickStatusChange = (newStatus: 'Pendente' | 'Concluído' | 'Entregue') => {
    if (!statusChangeOrder) return;
    
    const updatedOrder = { ...statusChangeOrder, status: newStatus };
    const newOrdersList = orders.map(o => o.id === statusChangeOrder.id ? updatedOrder : o);
    
    setOrders(newOrdersList);
    setStatusChangeOrder(null);
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

      // 3.5 Checklist
      if (order.checklist && order.checklist.length > 0) {
        ctx.font = `900 ${10 * scale}px "Inter", sans-serif`;
        ctx.textAlign = 'left';
        ctx.fillText("CHECKLIST DE DEFEITOS", 25 * scale, currentY);
        currentY += 18 * scale;
        ctx.font = `500 ${9 * scale}px "Inter", sans-serif`;
        const checklistText = order.checklist.join(', ');
        currentY = wrapTextByChars(checklistText, 25 * scale, currentY, 60, 12 * scale);
        currentY += 10 * scale;
        currentY = drawSeparator(currentY);
      }

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

      if (order.paymentMethod) {
        ctx.font = `900 ${10 * scale}px "Inter", sans-serif`;
        ctx.textAlign = 'center';
        const methodText = order.paymentMethod === 'Cartão' && order.paymentInstallments && order.paymentInstallments > 1
          ? `PAGAMENTO: CARTÃO DE CRÉDITO (${order.paymentInstallments}X)`
          : `PAGAMENTO: ${order.paymentMethod.toUpperCase()}`;
        ctx.fillText(methodText, width / 2, currentY);
        currentY += 20 * scale;
      }

      currentY = drawSeparator(currentY);

      // 6. Garantia e Rodapé
      ctx.font = `900 ${10 * scale}px "Inter", sans-serif`;
      ctx.textAlign = 'left';
      ctx.fillText("GARANTIA", 25 * scale, currentY);
      currentY += 18 * scale;
      const cleanWarranty = settings.pdfWarrantyText.replace(/\[\/?(B|C|J|COLOR.*?|U)\]/g, '');
      currentY = wrapText(cleanWarranty, 25 * scale, currentY, width - 50 * scale, 12 * scale, false, '#666');

      currentY += 50 * scale;

      // 6.5 Assinatura
      if (order.signature) {
        ctx.font = `900 ${10 * scale}px "Inter", sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText("ASSINATURA DO CLIENTE", width / 2, currentY);
        currentY += 10 * scale;
        const sigImg = new Image();
        sigImg.src = order.signature;
        await new Promise(r => sigImg.onload = r);
        const sigWidth = 200 * scale;
        const sigHeight = 64 * scale;
        ctx.drawImage(sigImg, (width - sigWidth) / 2, currentY, sigWidth, sigHeight);
        currentY += sigHeight + 20 * scale;
      }

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

  const initiateDelete = (id: string) => {
    setOrderToDelete(id);
    setIsAuthModalOpen(true);
    setPasswordInput('');
    setAuthError(false);
  };

  const downloadImage = (base64: string, name: string) => {
    if ((window as any).AndroidBridge) {
      (window as any).AndroidBridge.shareFile(base64.split(',')[1], name, 'image/webp');
    } else {
      const link = document.createElement('a');
      link.href = base64;
      link.download = name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const confirmDeletion = async () => {
    if (!orderToDelete || !passwordInput || !tenantId) return;
    setVerifyingPassword(true);
    setAuthError(false);

    try {
      const { OnlineDB } = await import('../utils/api');
      const authResult = await OnlineDB.verifyAdminPassword(tenantId, passwordInput);
      if (authResult.success) {
        onDeleteOrder(orderToDelete);
        setIsAuthModalOpen(false);
        setOrderToDelete(null);
      } else {
        setAuthError(true);
        setTimeout(() => setAuthError(false), 2000);
      }
    } catch (err) {
      alert("Falha de rede ao verificar autorização.");
    } finally {
      setVerifyingPassword(false);
    }
  };

  const filtered = useMemo(() => {
    return visibleOrders
      .filter(o => {
        // Busca textual inteligente (Nome, Modelo, Marca, Defeito, Reparo, ID, Telefone com e sem formatação, e sem acentos)
        if (searchTerm.trim()) {
          const normTerm = searchTerm.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
          const termDigits = searchTerm.replace(/\D/g, '');

          const nameMatch = (o.customerName || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').includes(normTerm);
          const modelMatch = (o.deviceModel || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').includes(normTerm);
          const brandMatch = (o.deviceBrand || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').includes(normTerm);
          const defectMatch = (o.defect || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').includes(normTerm);
          const idMatch = (o.id || '').toLowerCase().includes(normTerm) || (termDigits.length > 0 && (o.id || '').replace(/\D/g, '').includes(termDigits));
          const phoneDigits = (o.phoneNumber || '').replace(/\D/g, '');
          const phoneMatch = (termDigits.length > 0 && phoneDigits.includes(termDigits)) ||
                             (o.phoneNumber || '').toLowerCase().includes(normTerm);

          const matchesSearch = nameMatch || modelMatch || brandMatch || defectMatch || idMatch || phoneMatch;

          if (!matchesSearch) return false;
        }

        // Filtros Especiais
        if (filterType === 'expired_only') {
          return isExpired(o.date);
        }
        if (filterType === 'warranty_only') {
          return isUnderWarranty(o);
        }
        if (filterType === 'pending_only') {
          return o.status === 'Pendente';
        }
        if (filterType === 'delivered_only') {
          return o.status === 'Entregue';
        }

        return true;
      })
      .sort((a, b) => {
        if (sortMode === 'alphabetical') {
          // Ordem Alfabética (A-Z)
          const nameCompare = a.customerName.localeCompare(b.customerName, 'pt-BR', { sensitivity: 'base' });
          if (nameCompare !== 0) return nameCompare;
          return new Date(b.date).getTime() - new Date(a.date).getTime();
        }

        if (sortMode === 'oldest') {
          // Mais antigas primeiro
          return new Date(a.date).getTime() - new Date(b.date).getTime();
        }

        // Modo Padrão: Mais recentes primeiro
        return new Date(b.date).getTime() - new Date(a.date).getTime();
      });
  }, [visibleOrders, searchTerm, sortMode, filterType]);

  const paginatedOrders = filtered.slice(0, settings.itemsPerPage * currentPage);

  const loadMore = () => {
    setCurrentPage(prev => prev + 1);
  };

  return (
    <div className="space-y-4 pb-4">
      {/* CABEÇALHO DA TAB */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-black text-slate-800 tracking-tight text-custom-primary uppercase">ORDENS DE SERVIÇO</h2>
        <button onClick={() => { resetForm(); setIsModalOpen(true); }} disabled={limitReached} className="bg-slate-900 text-white p-2.5 rounded-2xl shadow-lg active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"><Plus size={20} /></button>
      </div>

      {limitReached && (
        <div className="bg-amber-50 border border-amber-200 p-3 rounded-2xl text-amber-700 text-xs font-bold flex items-center gap-3">
          <AlertTriangle size={16} />
          <span>Você atingiu o limite de {maxOS} Ordens de Serviço. Para cadastrar mais, atualize seu plano.</span>
        </div>
      )}

      {/* BUSCA E FILTROS */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
          <input type="text" placeholder="Pesquisar..." className="w-full pl-11 pr-4 py-3.5 bg-white border-none rounded-2xl shadow-sm text-sm font-medium focus:ring-2 focus:ring-slate-900 outline-none" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
        </div>
        <button 
          id="btn-organize-os"
          onClick={() => setIsSortModalOpen(true)}
          className={`p-3.5 rounded-2xl shadow-sm transition-all flex items-center justify-center active:scale-95 relative ${
            sortMode !== 'recent' || filterType !== 'all' 
              ? 'bg-blue-600 text-white shadow-blue-200' 
              : 'bg-white text-slate-400 hover:text-slate-900'
          }`}
          title="Organizar e Filtrar Listagem (Ordem Alfabética, Recentes, Expiradas, Garantia)"
        >
          <SlidersHorizontal size={18} />
          {(sortMode !== 'recent' || filterType !== 'all') && (
            <span className="absolute -top-1 -right-1 w-3 h-3 bg-amber-400 rounded-full border-2 border-white animate-pulse" />
          )}
        </button>
      </div>

      {/* INDICADOR DE FILTROS/ORDENAÇÃO ATIVOS */}
      {(sortMode !== 'recent' || filterType !== 'all') && (
        <div className="flex items-center gap-1.5 flex-wrap bg-slate-50 border border-slate-200/80 p-2.5 rounded-2xl animate-in fade-in">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider pl-1">Exibição:</span>
          {sortMode === 'alphabetical' && (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-blue-100 text-blue-800 rounded-xl text-xs font-bold">
              <ArrowDownAZ size={13} />
              Ordem Alfabética (A-Z)
              <button onClick={() => setSortMode('recent')} className="hover:text-blue-950 ml-1 p-0.5"><X size={11} /></button>
            </span>
          )}
          {sortMode === 'oldest' && (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-blue-100 text-blue-800 rounded-xl text-xs font-bold">
              <Clock size={13} />
              Mais Antigas Primeiro
              <button onClick={() => setSortMode('recent')} className="hover:text-blue-950 ml-1 p-0.5"><X size={11} /></button>
            </span>
          )}
          {filterType === 'expired_only' && (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-red-100 text-red-800 rounded-xl text-xs font-bold">
              <AlertTriangle size={13} />
              Apenas Expiradas (+3 meses)
              <button onClick={() => setFilterType('all')} className="hover:text-red-950 ml-1 p-0.5"><X size={11} /></button>
            </span>
          )}
          {filterType === 'warranty_only' && (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-emerald-100 text-emerald-800 rounded-xl text-xs font-bold">
              <ShieldCheck size={13} />
              Apenas Dentro da Garantia
              <button onClick={() => setFilterType('all')} className="hover:text-emerald-950 ml-1 p-0.5"><X size={11} /></button>
            </span>
          )}
          {filterType === 'pending_only' && (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-amber-100 text-amber-800 rounded-xl text-xs font-bold">
              <Clock size={13} />
              Apenas Pendentes
              <button onClick={() => setFilterType('all')} className="hover:text-amber-950 ml-1 p-0.5"><X size={11} /></button>
            </span>
          )}
          {filterType === 'delivered_only' && (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-emerald-100 text-emerald-800 rounded-xl text-xs font-bold">
              <CheckCircle size={13} />
              Apenas Entregues
              <button onClick={() => setFilterType('all')} className="hover:text-emerald-950 ml-1 p-0.5"><X size={11} /></button>
            </span>
          )}
          <button 
            onClick={() => { setSortMode('recent'); setFilterType('all'); }}
            className="text-[11px] font-bold text-slate-500 hover:text-slate-800 underline ml-auto pr-1"
          >
            Limpar filtros
          </button>
        </div>
      )}

      {/* LISTA DE ORDENS */}
      <div className={`grid gap-3 ${osLayout === 'large' ? 'sm:grid-cols-2' : ''}`}>
        {paginatedOrders.length > 0 ? paginatedOrders.map(order => {
          const expired = isExpired(order.date);
          let entryDateDisplay = order.entryDate;
          if (!entryDateDisplay && order.date) {
            if (order.date.includes('/')) {
              entryDateDisplay = order.date;
            } else {
              try {
                const d = new Date(order.date);
                entryDateDisplay = isNaN(d.getTime()) ? order.date : d.toLocaleDateString('pt-BR');
              } catch {
                entryDateDisplay = order.date;
              }
            }
          }
          if (!entryDateDisplay) entryDateDisplay = '-';

          return (
            <div 
              key={order.id} 
              className={`rounded-2xl sm:rounded-3xl shadow-sm border flex items-center justify-between gap-2 sm:gap-4 group animate-in fade-in transition-all
                ${expired ? 'bg-red-50/95 border-red-200 shadow-sm shadow-red-100/50' : 'bg-white border-slate-50'}
                ${osLayout === 'small' ? 'p-2' : osLayout === 'medium' ? 'p-3 sm:p-4' : 'p-5 sm:p-6'}
              `}
            >
              <div className="flex items-center gap-3 sm:gap-4 flex-1 min-w-0 cursor-pointer" onClick={() => { setEditingOrder(order); setFormData(order); setIsModalOpen(true); }}>
                <div 
                  onClick={(e) => { e.stopPropagation(); setStatusChangeOrder(order); }}
                  className={`rounded-xl sm:rounded-2xl flex items-center justify-center text-custom-primary overflow-hidden border shrink-0 transition-colors
                  ${expired ? 'bg-red-100/50 border-red-200/50 hover:bg-red-100' : 'bg-slate-50 border-slate-100 hover:bg-blue-50'}
                  ${osLayout === 'small' ? 'w-8 h-8 sm:w-10 sm:h-10' : osLayout === 'medium' ? 'w-10 h-10 sm:w-14 sm:h-14' : 'w-14 h-14 sm:w-20 sm:h-20'}
                `}>
                  {order.photos && order.photos.length > 0 ? (
                    <img src={order.photos[0]} className="w-full h-full object-cover" />
                  ) : (
                    <>
                      <Smartphone size={osLayout === 'small' ? 12 : 16} className="sm:hidden" />
                      <Smartphone size={osLayout === 'small' ? 16 : 24} className="hidden sm:block" />
                    </>
                  )}
                </div>
                <div className="min-w-0">
                  <h3 className={`font-bold text-slate-800 truncate uppercase leading-tight
                    ${osLayout === 'small' ? (order.customerName.length > 15 ? 'text-[9px]' : 'text-[10px]') : 
                      osLayout === 'medium' ? (order.customerName.length > 15 ? 'text-[10px]' : 'text-[11px]') : 
                      (order.customerName.length > 15 ? 'text-[12px]' : 'text-sm')}
                    sm:${osLayout === 'small' ? 'text-xs' : osLayout === 'medium' ? 'text-sm' : 'text-base'}
                  `}>
                    {order.customerName.length > 15 ? order.customerName.substring(0, 15) + '...' : order.customerName}
                  </h3>
                  <p className={`text-slate-400 font-bold uppercase truncate leading-tight
                    ${osLayout === 'small' ? 'text-[8px] sm:text-[9px]' : osLayout === 'medium' ? 'text-[9px] sm:text-[10px]' : 'text-[10px] sm:text-xs'}
                  `}>{order.deviceBrand} {order.deviceModel}</p>
                  <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mt-1">
                     <span className={`font-black px-1.5 py-0.5 rounded-full ${order.status === 'Entregue' ? 'bg-emerald-50 text-emerald-500' : 'bg-blue-50 text-blue-500'} uppercase shrink-0
                       ${osLayout === 'small' ? 'text-[6px] sm:text-[7px]' : osLayout === 'medium' ? 'text-[7px] sm:text-[8px]' : 'text-[8px] sm:text-[9px]'}
                     `}>{order.status}</span>
                     <span className={`font-black text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-full shrink-0
                       ${osLayout === 'small' ? 'text-[6px] sm:text-[7px]' : osLayout === 'medium' ? 'text-[7px] sm:text-[8px]' : 'text-[8px] sm:text-[9px]'}
                     `}>#{order.id}</span>
                     <span className={`font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full flex items-center gap-1 shrink-0
                       ${osLayout === 'small' ? 'text-[6px] sm:text-[7px]' : osLayout === 'medium' ? 'text-[7px] sm:text-[8px]' : 'text-[8px] sm:text-[9px]'}
                     `}>
                       <Calendar size={osLayout === 'small' ? 8 : 10} className="shrink-0 text-slate-400" />
                       Entrada: {entryDateDisplay}
                     </span>
                     {expired && (
                       <span className={`font-black px-2 py-0.5 rounded-full bg-red-600 text-white uppercase animate-pulse shrink-0
                         ${osLayout === 'small' ? 'text-[6px] sm:text-[7px]' : osLayout === 'medium' ? 'text-[7px] sm:text-[8px]' : 'text-[8px] sm:text-[9px]'}
                       `}>EXPIRADA</span>
                     )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1.5 sm:gap-2">
                <button onClick={(e) => { 
                  e.stopPropagation(); 
                  setOrderToPrint(order);
                  setTimeout(() => window.print(), 500);
                }} className={`bg-slate-900 text-white rounded-lg sm:rounded-xl shadow-md active:scale-90 flex items-center justify-center
                  ${osLayout === 'small' ? 'p-1 sm:p-1.5' : osLayout === 'medium' ? 'p-1.5 sm:p-2.5' : 'p-2.5 sm:p-3.5'}
                `} title="Imprimir Cupom">
                  <Printer size={14} className={osLayout === 'large' ? 'sm:w-[20px] sm:h-[20px]' : 'sm:w-[18px] sm:h-[18px]'} />
                </button>
                <button onClick={(e) => { e.stopPropagation(); generateReceiptImage(order); }} disabled={isGeneratingReceipt} className={`bg-blue-600 text-white rounded-lg sm:rounded-xl shadow-md active:scale-90 disabled:opacity-50 flex items-center justify-center
                  ${osLayout === 'small' ? 'p-1 sm:p-1.5' : osLayout === 'medium' ? 'p-1.5 sm:p-2.5' : 'p-2.5 sm:p-3.5'}
                `} title="Ver Recibo">
                  {isGeneratingReceipt ? <Loader2 className="animate-spin" size={14} /> : <Eye size={14} className={osLayout === 'large' ? 'sm:w-[20px] sm:h-[20px]' : 'sm:w-[18px] sm:h-[18px]'} />}
                </button>
                <button onClick={(e) => { e.stopPropagation(); setSelectedOrderForPhotos(order); }} className={`bg-emerald-600 text-white rounded-lg sm:rounded-xl shadow-md active:scale-90 flex items-center justify-center
                  ${osLayout === 'small' ? 'p-1 sm:p-1.5' : osLayout === 'medium' ? 'p-1.5 sm:p-2.5' : 'p-2.5 sm:p-3.5'}
                `} title="Ver Fotos">
                  <ImageIcon size={14} className={osLayout === 'large' ? 'sm:w-[20px] sm:h-[20px]' : 'sm:w-[18px] sm:h-[18px]'} />
                </button>
                <button onClick={(e) => { e.stopPropagation(); initiateDelete(order.id); }} className={`bg-red-50 text-red-500 rounded-lg sm:rounded-xl hover:bg-red-500 hover:text-white transition-all active:scale-90 flex items-center justify-center
                  ${osLayout === 'small' ? 'p-1 sm:p-1.5' : osLayout === 'medium' ? 'p-1.5 sm:p-2.5' : 'p-2.5 sm:p-3.5'}
                `} title="Excluir">
                  <Trash2 size={14} className={osLayout === 'large' ? 'sm:w-[20px] sm:h-[20px]' : 'sm:w-[18px] sm:h-[18px]'} />
                </button>
              </div>
            </div>
          );
        }) : (
          <div className="text-center py-20 bg-white rounded-[2.5rem] border-2 border-dashed border-slate-100">
            <p className="text-slate-300 font-black uppercase text-xs">Nenhuma O.S. encontrada</p>
          </div>
        )}
      </div>

      {filtered.length > paginatedOrders.length && (
        <button 
          onClick={loadMore}
          className="w-full py-4 bg-slate-100 text-slate-500 rounded-2xl font-black uppercase text-xs tracking-widest mt-4 active:scale-95 transition-transform">
          Carregar Mais
        </button>
      )}

      {/* MODAL DE EDIÇÃO / CRIAÇÃO */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 z-50 flex flex-col justify-end md:justify-center p-2 backdrop-blur-sm">
          <div className="bg-white w-full max-w-md mx-auto rounded-[2.5rem] overflow-hidden shadow-2xl animate-in slide-in-from-bottom-10 flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-slate-50 flex justify-between items-center bg-white shrink-0">
              <h3 className="font-black text-slate-800 text-lg uppercase tracking-tight">{editingOrder ? 'Editar O.S.' : 'Nova O.S.'}</h3>
              <button onClick={() => setIsModalOpen(false)} className="p-2 text-slate-400 bg-slate-50 rounded-full"><X size={20} /></button>
            </div>
            
            <div className="p-4 space-y-4 overflow-y-auto pb-10 flex-1">
              <div className="grid grid-cols-1 gap-3">
                {/* DADOS DO CLIENTE */}
                <div className="bg-slate-50 p-4 rounded-3xl space-y-3 relative">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Dados do Cliente</h4>
                    {matchedExistingCustomer ? (
                      <span className="text-[9px] font-black text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-md flex items-center gap-1">
                        ✓ Cliente Cadastrado
                      </span>
                    ) : formData.customerName?.trim() ? (
                      <span className="text-[9px] font-black text-blue-700 bg-blue-100 px-2 py-0.5 rounded-md flex items-center gap-1">
                        ✨ Novo Cliente (Automático)
                      </span>
                    ) : null}
                  </div>

                  <div className="space-y-1 relative">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Nome Completo</label>
                    <input 
                      name="customerName" 
                      value={formData.customerName || ''} 
                      onChange={(e) => {
                        handleInputChange(e);
                        setShowCustomerSuggestions(true);
                      }} 
                      onFocus={() => setShowCustomerSuggestions(true)}
                      placeholder="Nome do cliente" 
                      className="w-full p-3 bg-white rounded-xl outline-none font-bold text-xs border border-slate-100 focus:border-blue-500 transition-all" 
                    />

                    {/* Sugestões de clientes cadastrados */}
                    {showCustomerSuggestions && matchedCustomerSuggestions.length > 0 && (
                      <div className="absolute top-full left-0 right-0 z-30 mt-1 bg-white border border-slate-200 rounded-2xl shadow-xl p-1.5 space-y-1">
                        <div className="px-2 py-1 flex items-center justify-between text-[9px] font-black text-slate-400 uppercase tracking-wider">
                          <span>Clientes Existentes ({matchedCustomerSuggestions.length})</span>
                          <button 
                            type="button" 
                            onClick={() => setShowCustomerSuggestions(false)}
                            className="text-slate-400 hover:text-slate-600 font-bold"
                          >
                            ✕
                          </button>
                        </div>
                        {matchedCustomerSuggestions.map(sug => (
                          <button
                            key={sug.id}
                            type="button"
                            onClick={() => selectSuggestedCustomer(sug)}
                            className="w-full text-left p-2 hover:bg-blue-50 rounded-xl transition-colors flex items-center justify-between gap-2"
                          >
                            <div className="min-w-0">
                              <p className="text-xs font-black text-slate-800 truncate uppercase">{sug.name}</p>
                              <p className="text-[10px] text-slate-400 truncate">{sug.phoneNumber || 'Sem telefone'}</p>
                            </div>
                            <span className="text-[9px] font-black uppercase text-blue-600 bg-blue-100/60 px-2 py-0.5 rounded-md shrink-0">
                              Selecionar
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Telefone / WhatsApp</label>
                      <input 
                        name="phoneNumber" 
                        value={formData.phoneNumber || ''} 
                        onChange={(e) => {
                          handleInputChange(e);
                          setShowCustomerSuggestions(true);
                        }} 
                        placeholder="(00) 00000-0000" 
                        className="w-full p-3 bg-white rounded-xl outline-none font-bold text-xs border border-slate-100 focus:border-blue-500 transition-all" 
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Endereço</label>
                      <input 
                        name="address" 
                        value={formData.address || ''} 
                        onChange={handleInputChange} 
                        placeholder="Endereço" 
                        className="w-full p-3 bg-white rounded-xl outline-none font-bold text-xs border border-slate-100 focus:border-blue-500 transition-all" 
                      />
                    </div>
                  </div>
                </div>

                {/* DADOS DO APARELHO */}
                <div className="bg-slate-50 p-4 rounded-3xl space-y-3">
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200 pb-2">Dados do Aparelho</h4>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Marca</label>
                      <input name="deviceBrand" value={formData.deviceBrand} onChange={handleInputChange} placeholder="Ex: Samsung" className="w-full p-3 bg-white rounded-xl outline-none font-bold text-xs border border-slate-100" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Modelo</label>
                      <input name="deviceModel" value={formData.deviceModel} onChange={handleInputChange} placeholder="Ex: S21 Ultra" className="w-full p-3 bg-white rounded-xl outline-none font-bold text-xs border border-slate-100" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-1"><Calendar size={10}/> Entrada</label>
                      <input name="entryDate" value={formData.entryDate} onChange={handleInputChange} placeholder="DD/MM/AAAA" className="w-full p-3 bg-white rounded-xl outline-none font-bold text-xs border border-slate-100" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-1"><Calendar size={10}/> Saída</label>
                      <input name="exitDate" value={formData.exitDate} onChange={handleInputChange} placeholder="DD/MM/AAAA" className={`w-full p-3 bg-white rounded-xl outline-none font-bold text-xs border border-slate-100 ${!(formData.status === 'Concluído' || formData.status === 'Entregue') ? 'opacity-50' : ''}`} />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Status da O.S.</label>
                    <select name="status" value={formData.status} onChange={handleInputChange} className="w-full p-3 bg-white rounded-xl outline-none font-bold text-xs border border-slate-100 appearance-none">
                      <option value="Pendente">Pendente</option>
                      <option value="Concluído">Concluído</option>
                      <option value="Entregue">Entregue</option>
                    </select>
                  </div>
                </div>

                {/* ACOMPANHAMENTO DO CLIENTE */}
                <div className="bg-orange-50 p-4 rounded-3xl space-y-3 mb-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-[10px] font-black text-orange-900 uppercase tracking-widest flex items-center gap-1.5"><Eye size={12}/> Acompanhamento Público</h4>
                    {formData.trackingToken && (
                      <button onClick={generateTrackingToken} className="text-[8px] font-black text-orange-600 uppercase tracking-widest hover:underline">Regenerar Link</button>
                    )}
                  </div>
                  {formData.trackingToken ? (
                    <div className="space-y-2">
                       <input readOnly value={`${window.location.origin}/acompanhamento/${formData.trackingToken}`} className="w-full p-2 text-[10px] font-mono bg-white rounded-lg border border-orange-100" />
                       <div className="flex gap-2">
                         <button onClick={copyLink} className="flex-1 bg-white border border-orange-200 text-orange-900 py-2 rounded-xl text-[10px] font-black uppercase">Copiar Link</button>
                         <button onClick={sendWhatsApp} className="flex-1 bg-green-500 text-white py-2 rounded-xl text-[10px] font-black uppercase">WhatsApp</button>
                       </div>
                    </div>
                  ) : (
                    <button onClick={generateTrackingToken} className="w-full bg-orange-600 text-white py-2 rounded-xl text-[10px] font-black uppercase">Gerar Link de Acompanhamento</button>
                  )}
                  <textarea name="publicNotes" value={formData.publicNotes || ''} onChange={handleInputChange} placeholder="Observações públicas para o cliente..." className="w-full p-3 bg-white rounded-xl outline-none font-bold text-xs h-16 resize-none border border-orange-100" />
                </div>

                {/* CHECKLIST DE DEFEITOS */}
                <div className="bg-slate-50 p-4 rounded-3xl space-y-3">
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200 pb-2">Checklist de Defeitos</h4>
                  <div className="grid grid-cols-2 gap-2">
                    {COMMON_DEFECTS.map(item => (
                      <button 
                        key={item}
                        onClick={() => toggleChecklist(item)}
                        className={`p-2 rounded-xl text-[10px] font-bold uppercase transition-all flex items-center gap-2 border ${formData.checklist?.includes(item) ? 'bg-blue-600 text-white border-blue-600 shadow-md' : 'bg-white text-slate-400 border-slate-100'}`}
                      >
                        <div className={`w-3 h-3 rounded flex items-center justify-center ${formData.checklist?.includes(item) ? 'bg-white text-blue-600' : 'bg-slate-100'}`}>
                          {formData.checklist?.includes(item) && <Check size={10} />}
                        </div>
                        {item}
                      </button>
                    ))}
                  </div>
                </div>

                {/* DEFEITO E REPARO */}
                <div className="bg-slate-50 p-4 rounded-3xl space-y-3">
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200 pb-2">Descrição Detalhada</h4>
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Defeito Informado</label>
                    <textarea name="defect" value={formData.defect} onChange={handleInputChange} placeholder="Descreva o problema..." className="w-full p-3 bg-white rounded-xl outline-none font-bold text-xs h-16 resize-none border border-slate-100" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Reparo Efetuado</label>
                    <textarea name="repairDetails" value={formData.repairDetails} onChange={handleInputChange} placeholder="O que foi feito..." className="w-full p-3 bg-white rounded-xl outline-none font-bold text-xs h-16 resize-none border border-slate-100" />
                  </div>
                </div>

                {/* INFORMAÇÕES DO FORNECEDOR (PEÇA) */}
                <div className="bg-slate-50 p-4 rounded-3xl space-y-3">
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200 pb-2">Informações da Peça (Para Uso Interno)</h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Fornecedor</label>
                      <select 
                        name="partSupplierId" 
                        value={formData.partSupplierId || ''} 
                        onChange={handleInputChange} 
                        className="w-full p-3 bg-white rounded-xl outline-none font-bold text-xs border border-slate-100"
                      >
                        <option value="">Nenhum</option>
                        {suppliers.map(s => (
                          <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Garantia Fornecedor</label>
                      <input 
                        type="text" 
                        name="partSupplierWarranty" 
                        value={formData.partSupplierWarranty || ''} 
                        onChange={handleInputChange} 
                        placeholder="Ex: 3 meses, 90 dias" 
                        className="w-full p-3 bg-white rounded-xl outline-none font-bold text-xs border border-slate-100"
                      />
                    </div>
                  </div>
                </div>
                
                {/* FOTOS */}
                <div className="bg-slate-50 p-4 rounded-3xl space-y-3">
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200 pb-2">Galeria de Fotos</h4>
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5"><Camera size={10}/> Fotos de Entrada</label>
                      <div className="grid grid-cols-4 gap-2">
                        <label className="aspect-square bg-white border border-slate-200 rounded-xl flex items-center justify-center text-slate-400 cursor-pointer active:scale-95 transition-all">
                          {isCompressing ? <Loader2 className="animate-spin" size={14} /> : <Plus size={20} />}
                         <input
  type="file"
  accept="*/*"
  multiple
  className="hidden"
  onChange={(e) => handleFileChange(e, 'photos')}
/>
                        </label>
                        {formData.photos?.map((p, i) => (
                          <div key={`photo-${i}`} className="relative aspect-square rounded-xl overflow-hidden border border-slate-100 shadow-sm">
                            <img src={p} className="w-full h-full object-cover" />
                            <button onClick={() => setFormData(f => ({ ...f, photos: f.photos?.filter((_, idx) => idx !== i) }))} className="absolute top-1 right-1 bg-red-500 text-white p-1 rounded-lg"><X size={8} /></button>
                          </div>
                        ))}
                      </div>
                    </div>

                    {(formData.status === 'Concluído' || formData.status === 'Entregue') && (
                      <div className="space-y-2 animate-in fade-in">
                        <label className="text-[9px] font-black text-emerald-600 uppercase tracking-widest flex items-center gap-1.5"><CheckCircle size={10}/> Fotos de Saída</label>
                        <div className="grid grid-cols-4 gap-2">
                          <label className="aspect-square bg-white border border-emerald-100 rounded-xl flex items-center justify-center text-emerald-400 cursor-pointer active:scale-95 transition-all">
                            {isCompressing ? <Loader2 className="animate-spin" size={14} /> : <Plus size={20} />}
                            <input
                              type="file"
                              accept="*/*"
                              multiple
                              className="hidden"
                              onChange={(e) => handleFileChange(e, 'finishedPhotos')}
                            />
                          </label>
                          {formData.finishedPhotos?.map((p, i) => (
                            <div key={`finishedPhoto-${i}`} className="relative aspect-square rounded-xl overflow-hidden border border-emerald-100 shadow-sm">
                              <img src={p} className="w-full h-full object-cover" />
                              <button onClick={() => setFormData(f => ({ ...f, finishedPhotos: f.finishedPhotos?.filter((_, idx) => idx !== i) }))} className="absolute top-1 right-1 bg-red-500 text-white p-1 rounded-lg"><X size={8} /></button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* ASSINATURA DIGITAL */}
                <div className="bg-slate-50 p-4 rounded-3xl space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Assinatura Digital (Opcional)</h4>
                    <div className="flex items-center gap-3">
                      <button onClick={() => setIsFullScreenSignatureOpen(true)} className="text-[8px] font-black text-blue-600 uppercase tracking-widest flex items-center gap-1"><Maximize2 size={10} /> Tela Cheia</button>
                      <button onClick={clearSignature} className="text-[8px] font-black text-red-500 uppercase tracking-widest">Limpar</button>
                    </div>
                  </div>
                  <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden relative h-32">
                    {formData.signature && !isSigning ? (
                      <img src={formData.signature} className="w-full h-full object-contain pointer-events-none" />
                    ) : null}
                    <canvas 
                      ref={signatureRef}
                      width={400}
                      height={128}
                      onPointerDown={startDrawing}
                      onPointerMove={draw}
                      onPointerUp={stopDrawing}
                      onPointerOut={stopDrawing}
                      className="absolute inset-0 w-full h-full cursor-crosshair touch-none"
                    />
                  </div>
                </div>

                {/* FINANCEIRO */}
                <div className="bg-slate-900 p-5 rounded-[2rem] space-y-4 shadow-xl">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Custo Peças</label>
                      <div className="p-3 bg-white/5 rounded-xl flex items-center gap-2 border border-white/10">
                        <span className="text-[9px] font-black text-white/50">R$</span>
                        <input name="partsCost" value={formatCurrency(formData.partsCost || 0).replace('R$', '').trim()} onChange={handleInputChange} className="w-full bg-transparent font-bold text-xs text-white outline-none" placeholder="0,00" />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Mão de Obra</label>
                      <div className="p-3 bg-white/5 rounded-xl flex items-center gap-2 border border-white/10">
                        <span className="text-[9px] font-black text-white/50">R$</span>
                        <input name="serviceCost" value={formatCurrency(formData.serviceCost || 0).replace('R$', '').trim()} onChange={handleInputChange} className="w-full bg-transparent font-bold text-xs text-white outline-none" placeholder="0,00" />
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-white/10">
                    <div className="flex items-center gap-2 text-white">
                      <Calculator size={16} className="text-blue-400" />
                      <span className="text-[10px] font-black uppercase tracking-widest">Total Geral</span>
                    </div>
                    <input name="total" value={formatCurrency(formData.total || 0).replace('R$', '').trim()} onChange={handleInputChange} className="bg-transparent font-black text-white outline-none text-xl text-right w-32" placeholder="0,00" />
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-2 border-t border-white/10">
                    <div className="space-y-1">
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Pagamento</label>
                      <select 
                        name="paymentMethod" 
                        value={formData.paymentMethod || ''} 
                        onChange={handleInputChange} 
                        className="w-full p-3 bg-white/5 rounded-xl outline-none font-bold text-xs text-white border border-white/10 appearance-none"
                      >
                        <option value="" className="text-slate-900">Selecione...</option>
                        <option value="Dinheiro" className="text-slate-900">Dinheiro</option>
                        <option value="Cartão" className="text-slate-900">Cartão</option>
                        <option value="PIX" className="text-slate-900">PIX</option>
                      </select>
                    </div>
                    {formData.paymentMethod === 'Cartão' && (
                      <div className="space-y-1">
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Parcelas</label>
                        <select 
                          name="paymentInstallments" 
                          value={formData.paymentInstallments || 1} 
                          onChange={(e) => setFormData(prev => ({ ...prev, paymentInstallments: Number(e.target.value) }))} 
                          className="w-full p-3 bg-white/5 rounded-xl outline-none font-bold text-xs text-white border border-white/10 appearance-none"
                        >
                          {[...Array(12)].map((_, i) => (
                            <option key={`installment-${i+1}`} value={i+1} className="text-slate-900">{i+1}x</option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* BOTÕES DE AÇÃO DO MODAL */}
            <div className="p-6 border-t border-slate-50 bg-slate-50 flex gap-3 shrink-0">
              <button onClick={() => setIsModalOpen(false)} className="flex-1 py-4 font-black text-slate-400 uppercase text-[10px]">Sair</button>
              <button onClick={handleSave} disabled={isSaving} className="flex-[2] py-4 bg-blue-600 text-white rounded-2xl font-black uppercase text-[10px] shadow-xl active:scale-95">
                {isSaving ? <Loader2 className="animate-spin" size={20} /> : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE ASSINATURA TELA CHEIA */}
      {isFullScreenSignatureOpen && (
        <div className="fixed inset-0 bg-slate-950/90 z-[200] flex flex-col animate-in fade-in">
          <div className="p-6 flex items-center justify-between bg-white shrink-0">
            <div>
              <h3 className="font-black text-slate-800 text-lg uppercase tracking-tight">Assinatura Digital</h3>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Assine no espaço abaixo</p>
            </div>
            <button onClick={() => setIsFullScreenSignatureOpen(false)} className="p-2 text-slate-400 bg-slate-50 rounded-full"><X size={20} /></button>
          </div>
          
          <div className="flex-1 bg-slate-100 p-4 flex flex-col">
            <div className="flex-1 bg-white rounded-3xl shadow-inner relative overflow-hidden border-2 border-slate-200">
              <canvas 
                ref={fullScreenSignatureRef}
                width={window.innerWidth - 32}
                height={window.innerHeight - 200}
                onPointerDown={startDrawing}
                onPointerMove={draw}
                onPointerUp={(e) => stopDrawing(e, true)}
                onPointerOut={(e) => stopDrawing(e, true)}
                className="absolute inset-0 w-full h-full cursor-crosshair touch-none"
              />
              <div className="absolute bottom-4 left-0 right-0 flex justify-center pointer-events-none">
                <span className="text-slate-300 font-black text-2xl uppercase tracking-widest opacity-50">Assine Aqui</span>
              </div>
            </div>
          </div>
          
          <div className="p-6 bg-white flex gap-3 shrink-0">
            <button onClick={clearFullScreenSignature} className="flex-1 py-4 bg-slate-100 text-slate-500 rounded-2xl font-black uppercase text-[10px] shadow-sm active:scale-95">Limpar</button>
            <button onClick={saveFullScreenSignature} className="flex-[2] py-4 bg-blue-600 text-white rounded-2xl font-black uppercase text-[10px] shadow-xl active:scale-95">Salvar Assinatura</button>
          </div>
        </div>
      )}

      {/* MODAL DE VISUALIZAÇÃO DE FOTOS */}
      {selectedOrderForPhotos && (
        <div className="fixed inset-0 bg-slate-950/90 z-[150] flex items-center justify-center p-4 backdrop-blur-md animate-in fade-in">
          <div className="bg-white w-full max-w-lg rounded-[2.5rem] overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-slate-50 flex justify-between items-center bg-white shrink-0">
              <div>
                <h3 className="font-black text-slate-800 text-lg uppercase tracking-tight">Fotos da O.S. #{selectedOrderForPhotos.id}</h3>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{selectedOrderForPhotos.customerName}</p>
              </div>
              <button onClick={() => setSelectedOrderForPhotos(null)} className="p-2 text-slate-400 bg-slate-50 rounded-full"><X size={20} /></button>
            </div>
            
            <div className="p-6 overflow-y-auto space-y-8">
              {/* FOTOS DE ENTRADA */}
              <div className="space-y-4">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                  <Camera size={14} /> Fotos de Entrada
                </h4>
                {selectedOrderForPhotos.photos && selectedOrderForPhotos.photos.length > 0 ? (
                  <div className="grid grid-cols-2 gap-3">
                    {selectedOrderForPhotos.photos.map((photo, idx) => (
                      <div key={idx} className="relative group rounded-2xl overflow-hidden border border-slate-100 shadow-sm aspect-square bg-slate-50">
                        <img src={photo} className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                          <button onClick={() => setFullScreenPhoto(photo)} className="p-2 bg-white text-slate-900 rounded-full shadow-lg active:scale-90"><Maximize2 size={16} /></button>
                          <button onClick={() => downloadImage(photo, `OS_${selectedOrderForPhotos.id}_entrada_${idx}.webp`)} className="p-2 bg-blue-600 text-white rounded-full shadow-lg active:scale-90"><Download size={16} /></button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[10px] text-slate-300 font-bold uppercase text-center py-4">Nenhuma foto de entrada</p>
                )}
              </div>

              {/* FOTOS DE SAÍDA */}
              <div className="space-y-4">
                <h4 className="text-[10px] font-black text-emerald-500 uppercase tracking-widest flex items-center gap-2">
                  <CheckCircle size={14} /> Fotos de Saída
                </h4>
                {selectedOrderForPhotos.finishedPhotos && selectedOrderForPhotos.finishedPhotos.length > 0 ? (
                  <div className="grid grid-cols-2 gap-3">
                    {selectedOrderForPhotos.finishedPhotos.map((photo, idx) => (
                      <div key={idx} className="relative group rounded-2xl overflow-hidden border border-emerald-50 shadow-sm aspect-square bg-emerald-50">
                        <img src={photo} className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                          <button onClick={() => setFullScreenPhoto(photo)} className="p-2 bg-white text-slate-900 rounded-full shadow-lg active:scale-90"><Maximize2 size={16} /></button>
                          <button onClick={() => downloadImage(photo, `OS_${selectedOrderForPhotos.id}_saida_${idx}.webp`)} className="p-2 bg-emerald-600 text-white rounded-full shadow-lg active:scale-90"><Download size={16} /></button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[10px] text-slate-300 font-bold uppercase text-center py-4">Nenhuma foto de saída</p>
                )}
              </div>
            </div>
            
            <div className="p-6 border-t border-slate-50 bg-slate-50">
              <button onClick={() => setSelectedOrderForPhotos(null)} className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl active:scale-95">Fechar</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL FOTO FULLSCREEN */}
      {fullScreenPhoto && (
        <div className="fixed inset-0 bg-black z-[200] flex flex-col animate-in fade-in" onClick={() => setFullScreenPhoto(null)}>
          <div className="p-6 flex items-center justify-between bg-black/20 backdrop-blur-sm">
            <h3 className="text-white font-black uppercase text-xs tracking-widest">Visualização em Tamanho Real</h3>
            <button onClick={() => setFullScreenPhoto(null)} className="p-2 bg-white/10 text-white rounded-full"><X size={24} /></button>
          </div>
          <div className="flex-1 flex items-center justify-center p-4">
            <img src={fullScreenPhoto} className="max-w-full max-h-full object-contain shadow-2xl" onClick={(e) => e.stopPropagation()} />
          </div>
          <div className="p-8 flex justify-center bg-black/20 backdrop-blur-sm">
             <button 
               onClick={(e) => { e.stopPropagation(); downloadImage(fullScreenPhoto, 'foto_os_full.webp'); }} 
               className="bg-white text-black px-8 py-4 rounded-2xl font-black uppercase text-xs tracking-widest flex items-center gap-3 shadow-2xl active:scale-95"
             >
               <Download size={20} /> Baixar Imagem
             </button>
          </div>
        </div>
      )}

      {/* MODAL DE CONFIRMAÇÃO DE EXCLUSÃO COM SENHA */}
      {isAuthModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 z-[100] flex items-center justify-center p-6 backdrop-blur-sm animate-in fade-in">
          <div className={`bg-white w-full max-w-xs rounded-[2rem] overflow-hidden shadow-2xl transition-all duration-300 ${authError ? 'animate-shake' : ''}`}>
            <div className="p-8 text-center space-y-4">
              <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-2"><AlertTriangle size={32} /></div>
              <h3 className="font-black text-slate-800 uppercase text-sm">Excluir O.S.?</h3>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Digite a senha do Administrador para confirmar.</p>
              <div className="relative">
                <KeyRound size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" />
                <input 
                  type="password"
                  value={passwordInput}
                  onChange={e => setPasswordInput(e.target.value)}
                  onKeyPress={e => e.key === 'Enter' && confirmDeletion()}
                  placeholder="Senha do ADM"
                  className="w-full pl-10 pr-4 py-3 bg-slate-100 border-2 border-slate-200 rounded-xl font-mono text-sm tracking-widest text-center outline-none focus:ring-2 focus:ring-red-500"
                />
                {authError && <Lock size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-red-500" />}
              </div>
              <div className="flex gap-2 pt-2">
                <button onClick={() => setIsAuthModalOpen(false)} className="flex-1 py-4 bg-slate-100 text-slate-500 rounded-xl font-black text-[9px]">Sair</button>
                <button onClick={confirmDeletion} disabled={verifyingPassword} className="flex-1 py-4 bg-red-600 text-white rounded-xl font-black text-[9px] shadow-lg flex items-center justify-center gap-2">
                  {verifyingPassword ? <Loader2 className="animate-spin" size={14} /> : 'Remover'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE ALTERAÇÃO RÁPIDA DE STATUS */}
      {statusChangeOrder && (
        <div className="fixed inset-0 bg-slate-950/80 z-[100] flex items-center justify-center p-6 backdrop-blur-sm animate-in fade-in" onClick={() => setStatusChangeOrder(null)}>
          <div className="bg-white w-full max-w-xs rounded-[2rem] overflow-hidden shadow-2xl transition-all duration-300 p-6" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-black text-slate-800 uppercase text-sm tracking-tight">Alterar Status</h3>
              <button onClick={() => setStatusChangeOrder(null)} className="p-2 text-slate-400 bg-slate-50 rounded-full hover:bg-slate-100 transition-colors"><X size={16} /></button>
            </div>
            
            <div className="space-y-3">
              <button 
                onClick={() => handleQuickStatusChange('Pendente')}
                className={`w-full py-4 px-4 rounded-xl font-black text-xs uppercase tracking-widest flex items-center justify-between transition-all ${statusChangeOrder.status === 'Pendente' ? 'bg-slate-800 text-white' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'}`}
              >
                <span>Pendente</span>
                {statusChangeOrder.status === 'Pendente' && <CheckCircle size={16} />}
              </button>
              <button 
                onClick={() => handleQuickStatusChange('Concluído')}
                className={`w-full py-4 px-4 rounded-xl font-black text-xs uppercase tracking-widest flex items-center justify-between transition-all ${statusChangeOrder.status === 'Concluído' ? 'bg-blue-600 text-white' : 'bg-blue-50 text-blue-600 hover:bg-blue-100'}`}
              >
                <span>Concluído</span>
                {statusChangeOrder.status === 'Concluído' && <CheckCircle size={16} />}
              </button>
              <button 
                onClick={() => handleQuickStatusChange('Entregue')}
                className={`w-full py-4 px-4 rounded-xl font-black text-xs uppercase tracking-widest flex items-center justify-between transition-all ${statusChangeOrder.status === 'Entregue' ? 'bg-emerald-600 text-white' : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'}`}
              >
                <span>Entregue</span>
                {statusChangeOrder.status === 'Entregue' && <CheckCircle size={16} />}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE ORGANIZAR E FILTRAR LISTAGEM */}
      {isSortModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-5 sm:p-6 max-w-md w-full shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[90vh] overflow-hidden">
            {/* Header do Modal */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-blue-50 text-blue-600 rounded-2xl">
                  <SlidersHorizontal size={20} />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-black text-slate-800 uppercase tracking-tight">Organizar Listagem</h3>
                  <p className="text-xs text-slate-400 font-medium">Selecione ordenação e filtros de exibição</p>
                </div>
              </div>
              <button 
                onClick={() => setIsSortModalOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Conteúdo com Scroll */}
            <div className="py-4 space-y-5 overflow-y-auto pr-1">
              {/* Seção 1: Modo de Ordenação */}
              <div>
                <label className="text-[11px] font-black text-slate-400 uppercase tracking-wider block mb-2.5">
                  1. Modo de Ordenação
                </label>
                <div className="grid grid-cols-1 gap-2">
                  <button
                    type="button"
                    onClick={() => setSortMode('recent')}
                    className={`flex items-center justify-between p-3.5 rounded-2xl border text-left transition-all ${
                      sortMode === 'recent' 
                        ? 'border-blue-600 bg-blue-50/70 text-blue-900 font-bold shadow-sm' 
                        : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-medium'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-xl ${sortMode === 'recent' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                        <Clock size={16} />
                      </div>
                      <div>
                        <p className="text-sm font-bold leading-tight">Mais Recentes Primeiro</p>
                        <p className="text-[11px] text-slate-400 font-normal">Ordens criadas recentemente no topo</p>
                      </div>
                    </div>
                    {sortMode === 'recent' && <Check size={18} className="text-blue-600 shrink-0" />}
                  </button>

                  <button
                    type="button"
                    onClick={() => setSortMode('alphabetical')}
                    className={`flex items-center justify-between p-3.5 rounded-2xl border text-left transition-all ${
                      sortMode === 'alphabetical' 
                        ? 'border-blue-600 bg-blue-50/70 text-blue-900 font-bold shadow-sm' 
                        : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-medium'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-xl ${sortMode === 'alphabetical' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                        <ArrowDownAZ size={16} />
                      </div>
                      <div>
                        <p className="text-sm font-bold leading-tight">Ordem Alfabética (A - Z)</p>
                        <p className="text-[11px] text-slate-400 font-normal">Nome do cliente em ordem alfabética</p>
                      </div>
                    </div>
                    {sortMode === 'alphabetical' && <Check size={18} className="text-blue-600 shrink-0" />}
                  </button>

                  <button
                    type="button"
                    onClick={() => setSortMode('oldest')}
                    className={`flex items-center justify-between p-3.5 rounded-2xl border text-left transition-all ${
                      sortMode === 'oldest' 
                        ? 'border-blue-600 bg-blue-50/70 text-blue-900 font-bold shadow-sm' 
                        : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-medium'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-xl ${sortMode === 'oldest' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                        <Calendar size={16} />
                      </div>
                      <div>
                        <p className="text-sm font-bold leading-tight">Mais Antigas Primeiro</p>
                        <p className="text-[11px] text-slate-400 font-normal">Ordens mais antigas no topo</p>
                      </div>
                    </div>
                    {sortMode === 'oldest' && <Check size={18} className="text-blue-600 shrink-0" />}
                  </button>
                </div>
              </div>

              {/* Seção 2: Filtro de Exibição */}
              <div>
                <label className="text-[11px] font-black text-slate-400 uppercase tracking-wider block mb-2.5">
                  2. Filtro de Exibição
                </label>
                <div className="grid grid-cols-1 gap-2">
                  <button
                    type="button"
                    onClick={() => setFilterType('all')}
                    className={`flex items-center justify-between p-3 rounded-2xl border text-left transition-all ${
                      filterType === 'all' 
                        ? 'border-blue-600 bg-blue-50/70 text-blue-900 font-bold' 
                        : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-medium'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-xl ${filterType === 'all' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                        <Layout size={16} />
                      </div>
                      <div>
                        <p className="text-sm font-bold leading-tight">Todas as Ordens</p>
                        <p className="text-[11px] text-slate-400 font-normal">Exibe todas as ordens cadastradas</p>
                      </div>
                    </div>
                    {filterType === 'all' && <Check size={18} className="text-blue-600 shrink-0" />}
                  </button>

                  <button
                    type="button"
                    onClick={() => setFilterType('warranty_only')}
                    className={`flex items-center justify-between p-3 rounded-2xl border text-left transition-all ${
                      filterType === 'warranty_only' 
                        ? 'border-emerald-600 bg-emerald-50/70 text-emerald-900 font-bold' 
                        : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-medium'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-xl ${filterType === 'warranty_only' ? 'bg-emerald-600 text-white' : 'bg-emerald-50 text-emerald-600'}`}>
                        <ShieldCheck size={16} />
                      </div>
                      <div>
                        <p className="text-sm font-bold leading-tight flex items-center gap-2">
                          Dentro da Garantia
                          <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-700 rounded-md text-[10px] font-black">90 DIAS</span>
                        </p>
                        <p className="text-[11px] text-slate-400 font-normal">Apenas ordens com garantia ativa</p>
                      </div>
                    </div>
                    {filterType === 'warranty_only' && <Check size={18} className="text-emerald-600 shrink-0" />}
                  </button>

                  <button
                    type="button"
                    onClick={() => setFilterType('expired_only')}
                    className={`flex items-center justify-between p-3 rounded-2xl border text-left transition-all ${
                      filterType === 'expired_only' 
                        ? 'border-red-600 bg-red-50/70 text-red-900 font-bold' 
                        : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-medium'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-xl ${filterType === 'expired_only' ? 'bg-red-600 text-white' : 'bg-red-50 text-red-600'}`}>
                        <AlertTriangle size={16} />
                      </div>
                      <div>
                        <p className="text-sm font-bold leading-tight flex items-center gap-2">
                          Apenas Expiradas
                          <span className="px-1.5 py-0.5 bg-red-100 text-red-700 rounded-md text-[10px] font-black">+3 MESES</span>
                        </p>
                        <p className="text-[11px] text-slate-400 font-normal">Ordens que ultrapassaram 3 meses</p>
                      </div>
                    </div>
                    {filterType === 'expired_only' && <Check size={18} className="text-red-600 shrink-0" />}
                  </button>

                  <button
                    type="button"
                    onClick={() => setFilterType('pending_only')}
                    className={`flex items-center justify-between p-3 rounded-2xl border text-left transition-all ${
                      filterType === 'pending_only' 
                        ? 'border-amber-500 bg-amber-50/70 text-amber-900 font-bold' 
                        : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-medium'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-xl ${filterType === 'pending_only' ? 'bg-amber-500 text-white' : 'bg-amber-50 text-amber-600'}`}>
                        <Clock size={16} />
                      </div>
                      <div>
                        <p className="text-sm font-bold leading-tight">Apenas Pendentes</p>
                        <p className="text-[11px] text-slate-400 font-normal">Aparelhos em manutenção</p>
                      </div>
                    </div>
                    {filterType === 'pending_only' && <Check size={18} className="text-amber-600 shrink-0" />}
                  </button>
                </div>
              </div>

              {/* Seção 3: Tamanho do Card */}
              <div>
                <label className="text-[11px] font-black text-slate-400 uppercase tracking-wider block mb-2.5">
                  3. Tamanho de Exibição dos Cards
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={async () => {
                      setOsLayout('small');
                      await onUpdateSettings({ ...settings, osLayout: 'small' });
                    }}
                    className={`py-2.5 px-3 rounded-2xl border text-center font-bold text-xs transition-all ${
                      osLayout === 'small'
                        ? 'border-slate-900 bg-slate-900 text-white shadow-sm'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    Pequeno
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      setOsLayout('medium');
                      await onUpdateSettings({ ...settings, osLayout: 'medium' });
                    }}
                    className={`py-2.5 px-3 rounded-2xl border text-center font-bold text-xs transition-all ${
                      osLayout === 'medium'
                        ? 'border-slate-900 bg-slate-900 text-white shadow-sm'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    Médio
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      setOsLayout('large');
                      await onUpdateSettings({ ...settings, osLayout: 'large' });
                    }}
                    className={`py-2.5 px-3 rounded-2xl border text-center font-bold text-xs transition-all ${
                      osLayout === 'large'
                        ? 'border-slate-900 bg-slate-900 text-white shadow-sm'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    Grande (2 Col)
                  </button>
                </div>
              </div>
            </div>

            {/* Footer do Modal */}
            <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-3 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setSortMode('recent');
                  setFilterType('all');
                }}
                className="px-4 py-3 rounded-2xl text-xs font-bold text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors flex items-center gap-1.5"
              >
                <RotateCcw size={14} />
                Restaurar Padrão
              </button>
              <button
                type="button"
                onClick={() => setIsSortModalOpen(false)}
                className="px-6 py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl text-xs font-bold shadow-lg active:scale-95 transition-all"
              >
                Aplicar e Fechar
              </button>
            </div>
          </div>
        </div>
      )}
      {/* PORTAL PARA IMPRESSÃO DIRETA DA O.S. */}
      {document.getElementById('print-section') && orderToPrint && createPortal(
        <div 
          style={{ 
            width: Number(settings.printerSize) === 80 ? '80mm' : '58mm', 
            padding: Number(settings.printerSize) === 80 ? '4mm' : '2mm', 
            backgroundColor: 'white', 
            color: 'black', 
            fontFamily: 'monospace',
            fontSize: Number(settings.printerSize) === 80 ? '11px' : '10px',
            lineHeight: '1.2'
          }}
        >
          <div style={{ textAlign: 'center', marginBottom: '4mm' }}>
            <p style={{ fontWeight: 'bold', fontSize: '14px', textTransform: 'uppercase', margin: '0 0 1mm 0' }}>{settings.storeName}</p>
            <p style={{ margin: '1px 0', fontSize: '9px' }}>{settings.storeAddress}</p>
            <p style={{ margin: '1px 0', fontSize: '9px' }}>{settings.storePhone}</p>
            <div style={{ margin: '3mm 0', borderTop: '1px solid black', borderBottom: '1px solid black', padding: '1mm 0' }}>
              <p style={{ fontWeight: 'bold', margin: '0', fontSize: '11px' }}>ORDEM DE SERVIÇO</p>
              <p style={{ margin: '0', fontSize: '8px' }}>{orderToPrint.status === 'Pendente' ? 'COMPROVANTE DE ENTRADA' : 'RECIBO DE ENTREGA'}</p>
              <p style={{ margin: '1mm 0 0 0', fontSize: '7px' }}>NÃO É DOCUMENTO FISCAL</p>
            </div>
          </div>

          <div style={{ marginBottom: '3mm', fontSize: '9px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>PROTOCOLO:</span>
              <span style={{ fontWeight: 'bold' }}>#{orderToPrint.id}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>DATA:</span>
              <span>{formatDateTime(orderToPrint.date)}</span>
            </div>
          </div>

          <div style={{ borderTop: '1px dashed black', padding: '2mm 0', marginBottom: '2mm' }}>
            <p style={{ fontWeight: 'bold', fontSize: '9px', marginBottom: '1mm', textTransform: 'uppercase' }}>Cliente:</p>
            <p style={{ margin: '0', fontSize: '9px' }}>{orderToPrint.customerName}</p>
            <p style={{ margin: '0', fontSize: '9px' }}>{orderToPrint.phoneNumber}</p>
          </div>

          <div style={{ borderTop: '1px dashed black', padding: '2mm 0', marginBottom: '2mm' }}>
            <p style={{ fontWeight: 'bold', fontSize: '9px', marginBottom: '1mm', textTransform: 'uppercase' }}>Aparelho:</p>
            <p style={{ margin: '0', fontSize: '9px' }}>{orderToPrint.deviceBrand} {orderToPrint.deviceModel}</p>
            <p style={{ fontWeight: 'bold', fontSize: '9px', marginTop: '2mm', textTransform: 'uppercase' }}>Defeito Relatado:</p>
            <p style={{ margin: '0', fontSize: '9px' }}>{orderToPrint.defect}</p>
          </div>

          {orderToPrint.checklist && orderToPrint.checklist.length > 0 && (
            <div style={{ borderTop: '1px dashed black', padding: '2mm 0', marginBottom: '2mm' }}>
              <p style={{ fontWeight: 'bold', fontSize: '9px', marginBottom: '1mm', textTransform: 'uppercase' }}>Checklist:</p>
              <p style={{ margin: '0', fontSize: '8px' }}>{orderToPrint.checklist.join(', ')}</p>
            </div>
          )}

          {(orderToPrint.status === 'Concluído' || orderToPrint.status === 'Entregue') && orderToPrint.repairDetails && (
            <div style={{ borderTop: '1px dashed black', padding: '2mm 0', marginBottom: '2mm' }}>
              <p style={{ fontWeight: 'bold', fontSize: '9px', marginBottom: '1mm', textTransform: 'uppercase' }}>Reparo Efetuado:</p>
              <p style={{ margin: '0', fontSize: '9px' }}>{orderToPrint.repairDetails}</p>
            </div>
          )}

          <div style={{ borderTop: '1px solid black', padding: '2mm 0', marginTop: '2mm' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '11px' }}>
              <span>TOTAL:</span>
              <span>{formatCurrency(orderToPrint.total)}</span>
            </div>
          </div>

          {settings.pdfWarrantyText && (
            <div style={{ borderTop: '1px dashed black', padding: '2mm 0', marginTop: '2mm' }}>
              <p style={{ fontWeight: 'bold', fontSize: '9px', marginBottom: '1mm', textTransform: 'uppercase' }}>Garantia:</p>
              <p style={{ margin: '0', fontSize: '8px', textAlign: 'justify' }}>
                {settings.pdfWarrantyText.replace(/\[\/?(B|C|J|COLOR.*?|U)\]/g, '')}
              </p>
            </div>
          )}

          <div style={{ marginTop: '6mm', borderTop: '1px solid black', paddingTop: '4mm', textAlign: 'center' }}>
            {orderToPrint.signature ? (
              <div style={{ marginBottom: '2mm' }}>
                <img src={orderToPrint.signature} style={{ width: '40mm', height: 'auto', display: 'block', margin: '0 auto' }} />
              </div>
            ) : (
              <div style={{ height: '10mm' }}></div>
            )}
            <p style={{ borderTop: '0.5px solid black', display: 'inline-block', width: '80%', fontSize: '8px', paddingTop: '1mm' }}>ASSINATURA DO CLIENTE</p>
          </div>

          <div style={{ textAlign: 'center', fontSize: '8px', marginTop: '4mm' }}>
            <p style={{ margin: '0', fontWeight: 'bold' }}>OBRIGADO PELA PREFERÊNCIA!</p>
          </div>
        </div>,
        document.getElementById('print-section')!
      )}
    </div>
  );
};

export default ServiceOrderTab;
