
import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Search, Trash2, Camera, X, Eye, Loader2, Smartphone, AlertTriangle, Calculator, CheckCircle, Image as ImageIcon, Calendar, KeyRound, Lock, Download, Maximize2, Layout, Check } from 'lucide-react';
import { ServiceOrder, AppSettings } from '../types';
import { formatCurrency, parseCurrencyString, formatDate } from '../utils';

interface Props {
  orders: ServiceOrder[];
  setOrders: (orders: ServiceOrder[]) => void;
  settings: AppSettings;
  onUpdateSettings: (settings: AppSettings) => Promise<void>;
  onDeleteOrder: (id: string) => void;
  tenantId: string;
  maxOS?: number;
}

const COMMON_DEFECTS = [
  'Não Liga', 'Tela Quebrada', 'Bateria Viciada', 'Conector de Carga', 
  'Câmera com Defeito', 'Botões Falhando', 'Som Baixo/Mudo', 'Sinal de Rede', 
  'Wi-Fi não conecta', 'Software/Travando', 'Oxidação/Molhou', 'Vidro Traseiro'
];

const ServiceOrderTab: React.FC<Props> = ({ orders, setOrders, settings, onUpdateSettings, onDeleteOrder, tenantId, maxOS }) => {
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
  const [osLayout, setOsLayout] = useState<'small' | 'medium' | 'large'>(settings.osLayout || 'medium');
  const [isSigning, setIsSigning] = useState(false);
  const signatureRef = React.useRef<HTMLCanvasElement>(null);
  const fullScreenSignatureRef = React.useRef<HTMLCanvasElement>(null);
  const [isFullScreenSignatureOpen, setIsFullScreenSignatureOpen] = useState(false);

  const visibleOrders = useMemo(() => orders.filter(o => !o.isDeleted), [orders]);
  const osCount = visibleOrders.length;
  const limitReached = maxOS !== undefined && osCount >= maxOS;

  const handleLayoutChange = async () => {
    const modes: ('small' | 'medium' | 'large')[] = ['small', 'medium', 'large'];
    const currentIndex = modes.indexOf(osLayout);
    const nextMode = modes[(currentIndex + 1) % modes.length];
    setOsLayout(nextMode);
    await onUpdateSettings({ ...settings, osLayout: nextMode });
  };

  // --- ESTADO DO FORMULÁRIO (DADOS DA O.S.) ---
  const [formData, setFormData] = useState<Partial<ServiceOrder>>({
    customerName: '', phoneNumber: '', address: '', deviceBrand: '', deviceModel: '',
    defect: '', repairDetails: '', partsCost: 0, serviceCost: 0, status: 'Pendente',
    photos: [], finishedPhotos: [], entryDate: '', exitDate: '',
    checklist: [], signature: ''
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
    if (limitReached && !editingOrder) {
      alert(`Limite de ${maxOS} Ordens de Serviço atingido. Para cadastrar mais, atualize seu plano.`);
      return;
    }

    if (!formData.customerName || !formData.deviceModel) return alert('Campos obrigatórios faltando.');
    setIsSaving(true);
    
    let newOrdersList: ServiceOrder[];
    if (editingOrder) {
      newOrdersList = orders.map(o => o.id === editingOrder.id ? { ...o, ...formData } as ServiceOrder : o);
    } else {
      // Calculate next ID based on the highest existing ID to avoid collisions with deleted orders
      const maxId = orders.reduce((max, o) => {
        const idNum = parseInt(o.id, 10);
        return !isNaN(idNum) && idNum > max ? idNum : max;
      }, 0);
      const nextIdNumber = maxId + 1;
      const formattedId = nextIdNumber.toString().padStart(2, '0');
      const newOrder: ServiceOrder = {
        ...formData, 
        id: formattedId,
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
      exitDate: '',
      checklist: [],
      signature: ''
    });
  };

  // --- LÓGICA DE ASSINATURA ---
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = e.currentTarget;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = ('touches' in e) ? e.touches[0].clientX - rect.left : (e as React.MouseEvent).clientX - rect.left;
    const y = ('touches' in e) ? e.touches[0].clientY - rect.top : (e as React.MouseEvent).clientY - rect.top;

    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsSigning(true);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isSigning) return;
    const canvas = e.currentTarget;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = ('touches' in e) ? e.touches[0].clientX - rect.left : (e as React.MouseEvent).clientX - rect.left;
    const y = ('touches' in e) ? e.touches[0].clientY - rect.top : (e as React.MouseEvent).clientY - rect.top;

    ctx.lineTo(x, y);
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.stroke();
  };

  const stopDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>, isFullScreen: boolean = false) => {
    if (!isSigning) return;
    setIsSigning(false);
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
      .filter(o => 
        o.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        o.deviceModel.toLowerCase().includes(searchTerm.toLowerCase()) ||
        o.id.includes(searchTerm) ||
        (o.phoneNumber && o.phoneNumber.includes(searchTerm))
      )
      .sort((a, b) => {
        // 1. Status: Pendente sempre primeiro
        if (a.status === 'Pendente' && b.status !== 'Pendente') return -1;
        if (a.status !== 'Pendente' && b.status === 'Pendente') return 1;
        
        // 2. Nome: Ordem Alfabética (A-Z)
        const nameCompare = a.customerName.localeCompare(b.customerName, 'pt-BR', { sensitivity: 'base' });
        if (nameCompare !== 0) return nameCompare;
        
        // 3. Data: Mais recentes primeiro (caso nomes sejam iguais)
        return new Date(b.date).getTime() - new Date(a.date).getTime();
      });
  }, [visibleOrders, searchTerm]);

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
          onClick={handleLayoutChange}
          className="bg-white p-3.5 rounded-2xl shadow-sm text-slate-400 hover:text-slate-900 transition-colors flex items-center justify-center active:scale-95"
          title={`Alternar Layout (Atual: ${osLayout === 'small' ? 'Pequeno' : osLayout === 'medium' ? 'Médio' : 'Grande'})`}
        >
          <Layout size={18} />
        </button>
      </div>

      {/* LISTA DE ORDENS */}
      <div className={`grid gap-3 ${osLayout === 'large' ? 'sm:grid-cols-2' : ''}`}>
        {paginatedOrders.length > 0 ? paginatedOrders.map(order => (
          <div 
            key={order.id} 
            className={`bg-white rounded-2xl sm:rounded-3xl shadow-sm border border-slate-50 flex items-center justify-between gap-2 sm:gap-4 group animate-in fade-in
              ${osLayout === 'small' ? 'p-2' : osLayout === 'medium' ? 'p-3 sm:p-4' : 'p-5 sm:p-6'}
            `}
          >
            <div className="flex items-center gap-3 sm:gap-4 flex-1 min-w-0 cursor-pointer" onClick={() => { setEditingOrder(order); setFormData(order); setIsModalOpen(true); }}>
              <div 
                onClick={(e) => { e.stopPropagation(); setStatusChangeOrder(order); }}
                className={`bg-slate-50 rounded-xl sm:rounded-2xl flex items-center justify-center text-custom-primary overflow-hidden border border-slate-100 shrink-0 hover:bg-blue-50 transition-colors
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
                <div className="flex items-center gap-2 mt-0.5">
                   <span className={`font-black px-1.5 py-0.5 rounded-full ${order.status === 'Entregue' ? 'bg-emerald-50 text-emerald-500' : 'bg-blue-50 text-blue-500'} uppercase
                     ${osLayout === 'small' ? 'text-[6px] sm:text-[7px]' : osLayout === 'medium' ? 'text-[7px] sm:text-[8px]' : 'text-[8px] sm:text-[9px]'}
                   `}>{order.status}</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1.5 sm:gap-2">
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
        )) : (
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
                <div className="bg-slate-50 p-4 rounded-3xl space-y-3">
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200 pb-2">Dados do Cliente</h4>
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Nome Completo</label>
                    <input name="customerName" value={formData.customerName} onChange={handleInputChange} placeholder="Nome do cliente" className="w-full p-3 bg-white rounded-xl outline-none font-bold text-xs border border-slate-100" />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Telefone</label>
                      <input name="phoneNumber" value={formData.phoneNumber} onChange={handleInputChange} placeholder="(00) 00000-0000" className="w-full p-3 bg-white rounded-xl outline-none font-bold text-xs border border-slate-100" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Endereço</label>
                      <input name="address" value={formData.address} onChange={handleInputChange} placeholder="Endereço" className="w-full p-3 bg-white rounded-xl outline-none font-bold text-xs border border-slate-100" />
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
  accept="image/*"
  multiple
  className="hidden"
  onChange={(e) => handleFileChange(e, 'photos')}
/>
                        </label>
                        {formData.photos?.map((p, i) => (
                          <div key={i} className="relative aspect-square rounded-xl overflow-hidden border border-slate-100 shadow-sm">
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
  accept="image/*"
  multiple
  className="hidden"
  onChange={(e) => handleFileChange(e, 'finishedPhotos')}
/>
                          </label>
                          {formData.finishedPhotos?.map((p, i) => (
                            <div key={i} className="relative aspect-square rounded-xl overflow-hidden border border-emerald-100 shadow-sm">
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
                      onMouseDown={startDrawing}
                      onMouseMove={draw}
                      onMouseUp={stopDrawing}
                      onMouseOut={stopDrawing}
                      onTouchStart={startDrawing}
                      onTouchMove={draw}
                      onTouchEnd={stopDrawing}
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
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={(e) => stopDrawing(e, true)}
                onMouseOut={(e) => stopDrawing(e, true)}
                onTouchStart={startDrawing}
                onTouchMove={draw}
                onTouchEnd={(e) => stopDrawing(e, true)}
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
    </div>
  );
};

export default ServiceOrderTab;
