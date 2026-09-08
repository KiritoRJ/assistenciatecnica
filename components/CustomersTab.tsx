import React, { useState, useMemo } from 'react';
import { 
  Users, UserPlus, Search, Phone, MessageSquare, Calendar, DollarSign, 
  Wrench, Clock, CheckCircle2, AlertCircle, Edit, Trash2, Plus, 
  FileText, X, ChevronRight, Save, Filter, Sparkles, Smartphone, 
  ArrowUpRight, Receipt, Eye, EyeOff, Check, RefreshCw, SlidersHorizontal,
  ArrowDownAZ, RotateCcw, LayoutGrid, List, Columns, AlertTriangle
} from 'lucide-react';
import { Customer, CustomerNote, ServiceOrder, AppSettings, User } from '../types';
import { formatCurrency, formatDate, formatDateTime } from '../utils';
import { CustomerBroadcastModal } from './CustomerBroadcastModal';

interface Props {
  customers: Customer[];
  onSaveCustomer: (customer: Customer) => Promise<void>;
  onSaveCustomers: (customers: Customer[]) => Promise<void>;
  onDeleteCustomer: (id: string) => Promise<void>;
  onUpdateSettings?: (settings: AppSettings) => Promise<void>;
  orders: ServiceOrder[];
  settings: AppSettings;
  currentUser: User | null;
  tenantId: string;
  onNavigateToNewOS: (customer: Customer) => void;
  onViewOrder?: (order: ServiceOrder) => void;
}

export const CustomersTab: React.FC<Props> = ({
  customers,
  onSaveCustomer,
  onSaveCustomers,
  onDeleteCustomer,
  onUpdateSettings,
  orders,
  settings,
  currentUser,
  tenantId,
  onNavigateToNewOS,
  onViewOrder
}) => {
  // Estados de filtro, busca e ordenação
  const [searchTerm, setSearchTerm] = useState('');
  const [filterMode, setFilterMode] = useState<'all' | 'pending_os' | 'paying' | 'recurring' | 'no_os'>('all');
  const [sortMode, setSortMode] = useState<'recent' | 'alphabetical' | 'oldest' | 'revenue' | 'orders_count'>('recent');
  const [isSortModalOpen, setIsSortModalOpen] = useState(false);

  // Layout dos cards (small | medium | large | list)
  const [customersLayout, setCustomersLayout] = useState<'small' | 'medium' | 'large' | 'list'>(
    () => (settings.customersLayout || (localStorage.getItem('customers_layout') as any) || 'medium')
  );

  // Ocultar ou mostrar valores financeiros recebidos
  const [hideValues, setHideValues] = useState<boolean>(
    () => (settings.hideCustomerValues ?? (localStorage.getItem('hide_customer_values') === 'true'))
  );

  // Handler para alternar ocultação de valores
  const handleToggleHideValues = async () => {
    const next = !hideValues;
    setHideValues(next);
    localStorage.setItem('hide_customer_values', String(next));
    if (onUpdateSettings) {
      try {
        await onUpdateSettings({ ...settings, hideCustomerValues: next });
      } catch {
        // ignore
      }
    }
  };

  // Handler para atualizar layout
  const handleUpdateLayout = async (layout: 'small' | 'medium' | 'large' | 'list') => {
    setCustomersLayout(layout);
    localStorage.setItem('customers_layout', layout);
    if (onUpdateSettings) {
      try {
        await onUpdateSettings({ ...settings, customersLayout: layout });
      } catch {
        // ignore
      }
    }
  };

  // Helper para exibir ou mascarar valores financeiros
  const renderMoney = (amount: number) => {
    if (hideValues) return 'R$ •••••';
    return formatCurrency(amount);
  };

  // Modais
  const [isNewCustomerModalOpen, setIsNewCustomerModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [selectedCustomerForProfile, setSelectedCustomerForProfile] = useState<Customer | null>(null);
  const [customerToDelete, setCustomerToDelete] = useState<Customer | null>(null);
  const [broadcastCustomer, setBroadcastCustomer] = useState<{ name: string; phone: string; order?: ServiceOrder } | null>(null);

  // Perfil do Cliente: Abas internas
  const [profileTab, setProfileTab] = useState<'services' | 'payments' | 'notes' | 'details'>('services');

  // Estado do formulário de novo/editar cliente
  const [formData, setFormData] = useState<{
    name: string;
    phoneNumber: string;
    address: string;
    document: string;
    email: string;
    notes: string;
  }>({
    name: '',
    phoneNumber: '',
    address: '',
    document: '',
    email: '',
    notes: ''
  });

  // Estado para nova anotação no diário do cliente
  const [newNoteText, setNewNoteText] = useState('');
  const [isSavingNote, setIsSavingNote] = useState(false);
  const [mainNoteSuccess, setMainNoteSuccess] = useState(false);
  const [mainNoteDraft, setMainNoteDraft] = useState('');

  // Sincroniza nota draft quando o cliente selecionado muda
  React.useEffect(() => {
    if (selectedCustomerForProfile) {
      setMainNoteDraft(selectedCustomerForProfile.notes || '');
      setProfileTab('services');
      setNewNoteText('');
    }
  }, [selectedCustomerForProfile?.id]);

  // Função para normalizar strings de comparação (remove acentos e converte para minúsculas)
  const normalize = (str?: string) => 
    (str || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();

  const digitsOnly = (str?: string) => (str || '').replace(/\D/g, '');

  // Helper para buscar todas as O.S. vinculadas a um cliente
  const getCustomerOrders = (customer: Customer): ServiceOrder[] => {
    const custNameNorm = normalize(customer.name);
    const custPhoneDigits = digitsOnly(customer.phoneNumber);

    return orders.filter(o => {
      if (o.isDeleted) return false;
      if (o.customerId && o.customerId === customer.id) return true;
      if (normalize(o.customerName) === custNameNorm) return true;
      if (custPhoneDigits.length >= 8 && digitsOnly(o.phoneNumber) === custPhoneDigits) return true;
      return false;
    });
  };

  // Helper para calcular métricas de um cliente
  const getCustomerMetrics = (customer: Customer) => {
    const custOrders = getCustomerOrders(customer);
    const totalOrders = custOrders.length;
    const pendingOrders = custOrders.filter(o => o.status === 'Pendente');
    const completedOrders = custOrders.filter(o => o.status === 'Concluído' || o.status === 'Entregue');
    
    // Total pago/faturado
    const totalPaid = completedOrders.reduce((sum, o) => sum + (o.total || 0), 0);
    // Total em aberto
    const totalPending = pendingOrders.reduce((sum, o) => sum + (o.total || 0), 0);
    // Total histórico
    const totalHistorical = custOrders.reduce((sum, o) => sum + (o.total || 0), 0);

    return {
      custOrders,
      totalOrders,
      pendingOrdersCount: pendingOrders.length,
      completedOrdersCount: completedOrders.length,
      totalPaid,
      totalPending,
      totalHistorical,
      hasActiveOS: pendingOrders.length > 0,
      activeOS: pendingOrders[0] || null
    };
  };

  // Identifica potenciais clientes não cadastrados de O.S. existentes (backfill inteligente)
  const unimportedCustomersFromOrders = useMemo(() => {
    const map = new Map<string, { name: string; phone: string; address: string; count: number }>();
    
    orders.forEach(o => {
      if (o.isDeleted || !o.customerName?.trim()) return;
      const cleanName = o.customerName.trim();
      const cleanPhone = o.phoneNumber?.trim() || '';
      const key = digitsOnly(cleanPhone) || cleanName.toLowerCase();

      // Checa se já está na lista de clientes cadastrados
      const alreadyRegistered = customers.some(c => {
        if (c.name.trim().toLowerCase() === cleanName.toLowerCase()) return true;
        if (digitsOnly(c.phoneNumber) && digitsOnly(c.phoneNumber) === digitsOnly(cleanPhone)) return true;
        return false;
      });

      if (!alreadyRegistered) {
        if (!map.has(key)) {
          map.set(key, { name: cleanName, phone: cleanPhone, address: o.address || '', count: 1 });
        } else {
          map.get(key)!.count += 1;
        }
      }
    });

    return Array.from(map.values());
  }, [orders, customers]);

  // Auto-sincronização automática com o banco de dados caso existam clientes em O.S. que ainda não estão salvos na tabela de clientes
  const autoSyncedRef = React.useRef(false);
  React.useEffect(() => {
    if (unimportedCustomersFromOrders.length > 0 && !autoSyncedRef.current) {
      autoSyncedRef.current = true;
      const newCusts: Customer[] = unimportedCustomersFromOrders.map((item, index) => ({
        id: 'C_' + (Date.now() + index) + '_' + Math.random().toString(36).substr(2, 4).toUpperCase(),
        tenantId,
        name: item.name,
        phoneNumber: item.phone,
        address: item.address,
        notes: `Cliente cadastrado automaticamente via histórico de ${item.count} O.S.`,
        notesHistory: [],
        createdAt: new Date().toISOString()
      }));

      onSaveCustomers([...newCusts, ...customers]);
    }
  }, [unimportedCustomersFromOrders.length, tenantId]);

  // Importar clientes de O.S. existentes em lote manualmente (caso o usuário queira forçar)
  const handleAutoImportCustomers = async () => {
    if (unimportedCustomersFromOrders.length === 0) return;
    
    const newCusts: Customer[] = unimportedCustomersFromOrders.map((item, index) => ({
      id: 'C_' + (Date.now() + index) + '_' + Math.random().toString(36).substr(2, 4).toUpperCase(),
      tenantId,
      name: item.name,
      phoneNumber: item.phone,
      address: item.address,
      notes: `Cliente cadastrado automaticamente via histórico de ${item.count} O.S.`,
      notesHistory: [],
      createdAt: new Date().toISOString()
    }));

    await onSaveCustomers([...newCusts, ...customers]);
  };

  // Lista filtrada de clientes com busca inteligente e rápida
  const filteredCustomers = useMemo(() => {
    return customers.filter(customer => {
      if (customer.isDeleted) return false;

      // Filtro de texto inteligente
      if (searchTerm.trim()) {
        const rawTerm = searchTerm.trim();
        const normTerm = normalize(rawTerm);
        const termDigits = digitsOnly(rawTerm);

        // 1. Nome do cliente (insensível a maiúsculas e acentos)
        const nameMatch = normalize(customer.name).includes(normTerm);

        // 2. Telefone (por dígitos caso tenha digitado números, e também pelo texto formatado)
        const phoneDigits = digitsOnly(customer.phoneNumber);
        const phoneMatch = (termDigits.length > 0 && phoneDigits.includes(termDigits)) ||
                           normalize(customer.phoneNumber).includes(normTerm);

        // 3. Documento / CPF / CNPJ
        const docDigits = digitsOnly(customer.document);
        const docMatch = (termDigits.length > 0 && docDigits.includes(termDigits)) ||
                         normalize(customer.document).includes(normTerm);

        // 4. Endereço e E-mail
        const addrMatch = normalize(customer.address).includes(normTerm);
        const emailMatch = normalize(customer.email).includes(normTerm);

        // 5. Observações principais e anotações do diário
        const noteMatch = normalize(customer.notes).includes(normTerm);
        const notesHistoryMatch = (customer.notesHistory || []).some(n => 
          normalize(n.text).includes(normTerm) || normalize(n.authorName).includes(normTerm)
        );

        // 6. Ordens de Serviço do cliente (aparelho, marca, defeito, reparo, número da O.S.)
        const custOrders = getCustomerOrders(customer);
        const ordersMatch = custOrders.some(o => {
          const osIdMatch = normalize(o.id).includes(normTerm) || 
                            (termDigits.length > 0 && digitsOnly(o.id).includes(termDigits));
          const modelMatch = normalize(o.deviceModel).includes(normTerm);
          const brandMatch = normalize(o.deviceBrand).includes(normTerm);
          const defectMatch = normalize(o.defect).includes(normTerm);
          const repairMatch = normalize(o.repairDetails).includes(normTerm);
          return osIdMatch || modelMatch || brandMatch || defectMatch || repairMatch;
        });

        // 7. Busca combinada para múltiplas palavras (ex: "maria tela", "joao iphone", "silva 99")
        const tokens = normTerm.split(/\s+/).filter(t => t.length > 0);
        let multiWordMatch = false;
        if (tokens.length > 1) {
          multiWordMatch = tokens.every(token => {
            const tokenDigits = digitsOnly(token);
            const inName = normalize(customer.name).includes(token);
            const inPhone = (tokenDigits.length > 0 && phoneDigits.includes(tokenDigits)) || normalize(customer.phoneNumber).includes(token);
            const inDoc = (tokenDigits.length > 0 && docDigits.includes(tokenDigits)) || normalize(customer.document).includes(token);
            const inAddr = normalize(customer.address).includes(token);
            const inEmail = normalize(customer.email).includes(token);
            const inNotes = normalize(customer.notes).includes(token);
            const inOrders = custOrders.some(o => 
              normalize(o.id).includes(token) ||
              (tokenDigits.length > 0 && digitsOnly(o.id).includes(tokenDigits)) ||
              normalize(o.deviceModel).includes(token) ||
              normalize(o.deviceBrand).includes(token) ||
              normalize(o.defect).includes(token)
            );
            return inName || inPhone || inDoc || inAddr || inEmail || inNotes || inOrders;
          });
        }

        const isMatch = nameMatch || phoneMatch || docMatch || addrMatch || emailMatch || noteMatch || notesHistoryMatch || ordersMatch || multiWordMatch;

        if (!isMatch) {
          return false;
        }
      }

      // Filtros rápidos
      const metrics = getCustomerMetrics(customer);
      if (filterMode === 'pending_os' && !metrics.hasActiveOS) return false;
      if (filterMode === 'paying' && metrics.totalPaid <= 0) return false;
      if (filterMode === 'recurring' && metrics.totalOrders <= 1) return false;
      if (filterMode === 'no_os' && metrics.totalOrders > 0) return false;

      return true;
    }).sort((a, b) => {
      if (sortMode === 'alphabetical') {
        const nameCompare = a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' });
        if (nameCompare !== 0) return nameCompare;
        return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
      }

      if (sortMode === 'oldest') {
        return new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime();
      }

      if (sortMode === 'revenue') {
        const revA = getCustomerMetrics(a).totalPaid;
        const revB = getCustomerMetrics(b).totalPaid;
        if (revB !== revA) return revB - revA;
        return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
      }

      if (sortMode === 'orders_count') {
        const countA = getCustomerMetrics(a).totalOrders;
        const countB = getCustomerMetrics(b).totalOrders;
        if (countB !== countA) return countB - countA;
        return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
      }

      // Modo padrão: Mais Recentes primeiro
      return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
    });
  }, [customers, searchTerm, filterMode, sortMode, orders]);

  // Métricas globais de clientes
  const globalMetrics = useMemo(() => {
    const activeCustomers = customers.filter(c => !c.isDeleted);
    let totalRevenueFromCustomers = 0;
    let customersWithActiveOS = 0;

    activeCustomers.forEach(c => {
      const m = getCustomerMetrics(c);
      totalRevenueFromCustomers += m.totalPaid;
      if (m.hasActiveOS) customersWithActiveOS++;
    });

    const averageTicket = activeCustomers.length > 0 
      ? totalRevenueFromCustomers / Math.max(1, activeCustomers.length) 
      : 0;

    return {
      totalCount: activeCustomers.length,
      customersWithActiveOS,
      totalRevenueFromCustomers,
      averageTicket
    };
  }, [customers, orders]);

  // Abre formulário para novo cliente
  const handleOpenNewCustomer = () => {
    setEditingCustomer(null);
    setFormData({
      name: '',
      phoneNumber: '',
      address: '',
      document: '',
      email: '',
      notes: ''
    });
    setIsNewCustomerModalOpen(true);
  };

  // Abre formulário para editar cliente
  const handleOpenEditCustomer = (customer: Customer) => {
    setEditingCustomer(customer);
    setFormData({
      name: customer.name || '',
      phoneNumber: customer.phoneNumber || '',
      address: customer.address || '',
      document: customer.document || '',
      email: customer.email || '',
      notes: customer.notes || ''
    });
    setIsNewCustomerModalOpen(true);
  };

  // Salva cliente (criação ou edição)
  const handleSaveCustomerForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      alert('Por favor, informe o nome do cliente.');
      return;
    }

    if (editingCustomer) {
      const updated: Customer = {
        ...editingCustomer,
        name: formData.name.trim(),
        phoneNumber: formData.phoneNumber.trim(),
        address: formData.address.trim(),
        document: formData.document.trim(),
        email: formData.email.trim(),
        notes: formData.notes.trim(),
        updatedAt: new Date().toISOString()
      };
      await onSaveCustomer(updated);
      if (selectedCustomerForProfile?.id === updated.id) {
        setSelectedCustomerForProfile(updated);
      }
    } else {
      const newCustomer: Customer = {
        id: 'C_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5).toUpperCase(),
        tenantId,
        name: formData.name.trim(),
        phoneNumber: formData.phoneNumber.trim(),
        address: formData.address.trim(),
        document: formData.document.trim(),
        email: formData.email.trim(),
        notes: formData.notes.trim(),
        notesHistory: [],
        createdAt: new Date().toISOString()
      };
      await onSaveCustomer(newCustomer);
    }

    setIsNewCustomerModalOpen(false);
  };

  // Salva nota principal no perfil do cliente
  const handleSaveMainNote = async () => {
    if (!selectedCustomerForProfile) return;
    setIsSavingNote(true);
    const updated: Customer = {
      ...selectedCustomerForProfile,
      notes: mainNoteDraft.trim(),
      updatedAt: new Date().toISOString()
    };
    await onSaveCustomer(updated);
    setSelectedCustomerForProfile(updated);
    setIsSavingNote(false);
    setMainNoteSuccess(true);
    setTimeout(() => setMainNoteSuccess(false), 2500);
  };

  // Adiciona nova anotação com data e hora ao histórico do cliente
  const handleAddNoteToHistory = async () => {
    if (!selectedCustomerForProfile || !newNoteText.trim()) return;
    setIsSavingNote(true);

    const newNoteEntry: CustomerNote = {
      id: 'N_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
      text: newNoteText.trim(),
      createdAt: new Date().toISOString(),
      authorName: currentUser?.name || 'Administrador'
    };

    const updatedNotesHistory = [newNoteEntry, ...(selectedCustomerForProfile.notesHistory || [])];
    const updated: Customer = {
      ...selectedCustomerForProfile,
      notesHistory: updatedNotesHistory,
      updatedAt: new Date().toISOString()
    };

    await onSaveCustomer(updated);
    setSelectedCustomerForProfile(updated);
    setNewNoteText('');
    setIsSavingNote(false);
  };

  // Exclui uma anotação específica do histórico
  const handleDeleteNoteFromHistory = async (noteId: string) => {
    if (!selectedCustomerForProfile) return;
    const updatedNotesHistory = (selectedCustomerForProfile.notesHistory || []).filter(n => n.id !== noteId);
    const updated: Customer = {
      ...selectedCustomerForProfile,
      notesHistory: updatedNotesHistory,
      updatedAt: new Date().toISOString()
    };
    await onSaveCustomer(updated);
    setSelectedCustomerForProfile(updated);
  };

  // Formata telefone para link do WhatsApp
  const getWhatsAppLink = (phone?: string) => {
    if (!phone) return null;
    const digits = digitsOnly(phone);
    if (digits.length < 10) return null;
    // Se não tiver DDI 55, adiciona
    const fullNumber = digits.startsWith('55') ? digits : `55${digits}`;
    return `https://wa.me/${fullNumber}`;
  };

  // Iniciais do cliente para o avatar
  const getInitials = (name: string) => {
    if (!name) return 'CL';
    const parts = name.trim().split(' ');
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  // Paleta de cores para avatar
  const getAvatarColor = (name: string) => {
    const colors = [
      'bg-blue-600 text-white',
      'bg-emerald-600 text-white',
      'bg-purple-600 text-white',
      'bg-amber-600 text-white',
      'bg-rose-600 text-white',
      'bg-indigo-600 text-white'
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash += name.charCodeAt(i);
    return colors[hash % colors.length];
  };

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-500">
      {/* HEADER DA ABA */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 sm:p-6 rounded-3xl border border-slate-100 shadow-sm">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center shadow-inner shrink-0">
              <Users size={22} className="sm:w-6 sm:h-6" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-black text-slate-900 uppercase tracking-tight">
                Cadastro de Clientes
              </h2>
              <p className="text-[11px] sm:text-xs font-bold text-slate-400">
                Histórico completo de serviços, pagamentos e notas por cliente
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          {unimportedCustomersFromOrders.length > 0 && (
            <button
              onClick={handleAutoImportCustomers}
              className="px-3.5 sm:px-4 py-2.5 sm:py-3 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded-2xl font-black text-xs uppercase tracking-wider flex items-center gap-2 border border-amber-200 transition-all active:scale-95 shadow-sm"
              title="Importar clientes identificados em Ordens de Serviço antigas"
            >
              <RefreshCw size={16} />
              <span>Sincronizar {unimportedCustomersFromOrders.length} Clientes de O.S.</span>
            </button>
          )}

          <button
            onClick={handleOpenNewCustomer}
            className="flex-1 sm:flex-none px-4 sm:px-5 py-3 sm:py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20 active:scale-95 transition-all min-h-[44px]"
          >
            <UserPlus size={18} />
            <span>Novo Cliente</span>
          </button>
        </div>
      </div>

      {/* CARDS DE RESUMO / MÉTRICAS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 sm:gap-4">
        <div className="bg-white p-4 sm:p-5 rounded-3xl border border-slate-100 shadow-sm">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total de Clientes</p>
          <div className="flex items-baseline gap-2">
            <h3 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">{globalMetrics.totalCount}</h3>
            <span className="text-[10px] font-bold text-slate-400">cadastrados</span>
          </div>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-3xl border border-slate-100 shadow-sm">
          <p className="text-[10px] font-black text-amber-500 uppercase tracking-widest mb-1">Com O.S. em Aberto</p>
          <div className="flex items-baseline gap-2">
            <h3 className="text-xl sm:text-2xl font-black text-amber-600 tracking-tight">{globalMetrics.customersWithActiveOS}</h3>
            <span className="text-[10px] font-bold text-amber-500">na bancada</span>
          </div>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-3xl border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between mb-1">
            <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Total em Serviços</p>
            <button
              type="button"
              onClick={handleToggleHideValues}
              className="p-1 -mr-1 text-emerald-600/70 hover:text-emerald-800 rounded-lg hover:bg-emerald-50 transition-colors"
              title={hideValues ? "Mostrar valores financeiros" : "Ocultar valores financeiros"}
            >
              {hideValues ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
          <h3 className="text-xl sm:text-2xl font-black text-emerald-600 tracking-tight">
            {renderMoney(globalMetrics.totalRevenueFromCustomers)}
          </h3>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-3xl border border-slate-100 shadow-sm">
          <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-1">Média por Cliente</p>
          <h3 className="text-xl sm:text-2xl font-black text-blue-600 tracking-tight">
            {renderMoney(globalMetrics.averageTicket)}
          </h3>
        </div>
      </div>

      {/* BARRA DE BUSCA E FILTROS */}
      <div className="bg-white p-3 sm:p-4 rounded-3xl border border-slate-100 shadow-sm space-y-3">
        <div className="flex flex-col md:flex-row gap-2.5 sm:gap-3 items-stretch md:items-center justify-between">
          <div className="flex items-center gap-2 w-full md:w-auto flex-1 max-w-xl">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 sm:left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                id="customer-search-input"
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar por nome, telefone, CPF, aparelho..."
                className="w-full pl-10 sm:pl-11 pr-20 sm:pr-24 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-bold text-slate-800 outline-none focus:border-blue-500 focus:bg-white transition-all placeholder:text-slate-400 placeholder:font-medium min-h-[44px]"
              />
              {searchTerm && (
                <div className="absolute right-2.5 sm:right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                  <span className="text-[10px] font-black text-blue-600 bg-blue-50 px-2 py-0.5 rounded-lg">
                    {filteredCustomers.length}
                  </span>
                  <button
                    id="customer-search-clear-btn"
                    onClick={() => setSearchTerm('')}
                    className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200/50 transition-colors"
                    title="Limpar busca"
                  >
                    <X size={16} />
                  </button>
                </div>
              )}
            </div>

            {/* BOTÃO DO OLHO: OCULTAR / MOSTRAR VALORES */}
            <button
              id="btn-toggle-customer-values"
              type="button"
              onClick={handleToggleHideValues}
              className={`p-3 sm:p-3.5 rounded-2xl transition-all flex items-center justify-center active:scale-95 shrink-0 min-h-[44px] min-w-[44px] ${
                hideValues
                  ? 'bg-amber-500 text-white shadow-md shadow-amber-500/20'
                  : 'bg-slate-50 hover:bg-slate-100 text-slate-500 hover:text-slate-900 border border-slate-200/80'
              }`}
              title={hideValues ? "Mostrar valores de faturamento" : "Ocultar valores de faturamento"}
            >
              {hideValues ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>

            {/* BOTÃO ORGANIZAR LAYOUT / ORDENAÇÃO */}
            <button 
              id="btn-organize-customers"
              type="button"
              onClick={() => setIsSortModalOpen(true)}
              className={`p-3 sm:p-3.5 rounded-2xl transition-all flex items-center justify-center active:scale-95 relative shrink-0 min-h-[44px] min-w-[44px] ${
                sortMode !== 'recent' || filterMode !== 'all' || customersLayout !== 'medium'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20' 
                  : 'bg-slate-50 hover:bg-slate-100 text-slate-500 hover:text-slate-900 border border-slate-200/80'
              }`}
              title="Organizar layout, ordenação e filtros"
            >
              <SlidersHorizontal size={18} />
              {(sortMode !== 'recent' || filterMode !== 'all' || customersLayout !== 'medium') && (
                <span className="absolute -top-1 -right-1 w-3 h-3 bg-amber-400 rounded-full border-2 border-white animate-pulse" />
              )}
            </button>
          </div>

          {/* CHIPS DE FILTRO RÁPIDO COM ROLAGEM HORIZONTAL SUAVE NO MOBILE */}
          <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto no-scrollbar pb-1 md:pb-0 -mx-1 px-1">
            <button
              onClick={() => setFilterMode('all')}
              className={`px-3 sm:px-3.5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all whitespace-nowrap shrink-0 min-h-[38px] ${
                filterMode === 'all'
                  ? 'bg-slate-900 text-white shadow'
                  : 'bg-slate-50 text-slate-500 hover:bg-slate-100'
              }`}
            >
              Todos ({customers.filter(c => !c.isDeleted).length})
            </button>
            <button
              onClick={() => setFilterMode('pending_os')}
              className={`px-3 sm:px-3.5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all whitespace-nowrap flex items-center gap-1.5 shrink-0 min-h-[38px] ${
                filterMode === 'pending_os'
                  ? 'bg-amber-500 text-white shadow'
                  : 'bg-slate-50 text-slate-500 hover:bg-slate-100'
              }`}
            >
              <Clock size={12} />
              O.S. Pendente
            </button>
            <button
              onClick={() => setFilterMode('recurring')}
              className={`px-3 sm:px-3.5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all whitespace-nowrap flex items-center gap-1.5 shrink-0 min-h-[38px] ${
                filterMode === 'recurring'
                  ? 'bg-blue-600 text-white shadow'
                  : 'bg-slate-50 text-slate-500 hover:bg-slate-100'
              }`}
            >
              <Sparkles size={12} />
              Recorrentes (+1 O.S.)
            </button>
            <button
              onClick={() => setFilterMode('paying')}
              className={`px-3 sm:px-3.5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all whitespace-nowrap flex items-center gap-1.5 shrink-0 min-h-[38px] ${
                filterMode === 'paying'
                  ? 'bg-emerald-600 text-white shadow'
                  : 'bg-slate-50 text-slate-500 hover:bg-slate-100'
              }`}
            >
              <DollarSign size={12} />
              Com Pagamentos
            </button>
            <button
              onClick={() => setFilterMode('no_os')}
              className={`px-3 sm:px-3.5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all whitespace-nowrap flex items-center gap-1.5 shrink-0 min-h-[38px] ${
                filterMode === 'no_os'
                  ? 'bg-slate-700 text-white shadow'
                  : 'bg-slate-50 text-slate-500 hover:bg-slate-100'
              }`}
            >
              <AlertCircle size={12} />
              Sem O.S.
            </button>
          </div>
        </div>

        {/* INDICADOR DE FILTROS/ORDENAÇÃO ATIVOS */}
        {(sortMode !== 'recent' || filterMode !== 'all' || customersLayout !== 'medium') && (
          <div className="flex items-center gap-1.5 flex-wrap bg-slate-50 border border-slate-200/80 p-2.5 rounded-2xl animate-in fade-in">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider pl-1">Exibição:</span>
            
            {sortMode !== 'recent' && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white border border-slate-200 rounded-xl text-[11px] font-bold text-slate-700 shadow-2xs">
                {sortMode === 'alphabetical' && <ArrowDownAZ size={12} className="text-blue-600" />}
                {sortMode === 'oldest' && <Calendar size={12} className="text-blue-600" />}
                {sortMode === 'revenue' && <DollarSign size={12} className="text-emerald-600" />}
                {sortMode === 'orders_count' && <Wrench size={12} className="text-indigo-600" />}
                
                {sortMode === 'alphabetical' && 'Ordem Alfabética (A-Z)'}
                {sortMode === 'oldest' && 'Mais Antigos Primeiro'}
                {sortMode === 'revenue' && 'Maior Faturamento'}
                {sortMode === 'orders_count' && 'Mais O.S.'}

                <button 
                  onClick={() => setSortMode('recent')}
                  className="hover:text-red-600 p-0.5 rounded transition-colors"
                  title="Voltar para mais recentes"
                >
                  <X size={12} />
                </button>
              </span>
            )}

            {filterMode !== 'all' && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white border border-slate-200 rounded-xl text-[11px] font-bold text-slate-700 shadow-2xs">
                <Filter size={12} className="text-blue-600" />
                {filterMode === 'pending_os' && 'Com O.S. Pendente'}
                {filterMode === 'recurring' && 'Recorrentes (+1 O.S.)'}
                {filterMode === 'paying' && 'Com Pagamentos'}
                {filterMode === 'no_os' && 'Sem Nenhuma O.S.'}

                <button 
                  onClick={() => setFilterMode('all')}
                  className="hover:text-red-600 p-0.5 rounded transition-colors"
                  title="Remover filtro"
                >
                  <X size={12} />
                </button>
              </span>
            )}

            {customersLayout !== 'medium' && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white border border-slate-200 rounded-xl text-[11px] font-bold text-slate-700 shadow-2xs">
                {customersLayout === 'small' && <LayoutGrid size={12} className="text-blue-600" />}
                {customersLayout === 'large' && <LayoutGrid size={12} className="text-blue-600" />}
                {customersLayout === 'list' && <List size={12} className="text-blue-600" />}
                
                {customersLayout === 'small' && 'Layout Compacto'}
                {customersLayout === 'large' && 'Layout Grande'}
                {customersLayout === 'list' && 'Layout Lista'}

                <button 
                  onClick={() => handleUpdateLayout('medium')}
                  className="hover:text-red-600 p-0.5 rounded transition-colors"
                  title="Restaurar layout médio"
                >
                  <X size={12} />
                </button>
              </span>
            )}

            <button 
              onClick={() => {
                setSortMode('recent');
                setFilterMode('all');
                handleUpdateLayout('medium');
              }}
              className="text-[10px] font-black text-blue-600 hover:text-blue-800 hover:underline uppercase tracking-wider ml-auto pr-1"
            >
              Limpar filtros
            </button>
          </div>
        )}
      </div>

      {/* LISTAGEM DE CLIENTES */}
      {filteredCustomers.length === 0 ? (
        <div className="bg-white rounded-3xl border border-dashed border-slate-200 p-12 text-center">
          <div className="w-16 h-16 bg-slate-50 text-slate-300 rounded-3xl flex items-center justify-center mx-auto mb-4">
            <Users size={32} />
          </div>
          <h3 className="text-base font-black text-slate-800 uppercase tracking-tight mb-1">
            Nenhum cliente encontrado
          </h3>
          <p className="text-xs text-slate-400 font-medium max-w-sm mx-auto mb-6">
            {searchTerm
              ? `Nenhum resultado para "${searchTerm}". Verifique a digitação ou limpe a busca.`
              : 'Cadastre seus clientes para manter um histórico detalhado de serviços, valores pagos e anotações.'}
          </p>
          <div className="flex items-center justify-center gap-3 flex-wrap">
            {searchTerm ? (
              <button
                id="customer-clear-search-empty-btn"
                onClick={() => setSearchTerm('')}
                className="px-5 py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl font-black text-xs uppercase tracking-widest inline-flex items-center gap-2 shadow-md active:scale-95 transition-all"
              >
                <X size={16} />
                Limpar Busca
              </button>
            ) : (
              <button
                onClick={handleOpenNewCustomer}
                className="px-5 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black text-xs uppercase tracking-widest inline-flex items-center gap-2 shadow-lg shadow-blue-500/20 active:scale-95 transition-all"
              >
                <UserPlus size={16} />
                Cadastrar Primeiro Cliente
              </button>
            )}
          </div>
        </div>
      ) : customersLayout === 'list' ? (
        /* MODO LISTA */
        <div className="space-y-2 sm:space-y-2.5">
          {filteredCustomers.map(customer => {
            const metrics = getCustomerMetrics(customer);
            const waLink = getWhatsAppLink(customer.phoneNumber);

            return (
              <div
                key={customer.id}
                className="bg-white rounded-2xl sm:rounded-3xl border border-slate-100 p-3 sm:p-4 shadow-2xs hover:shadow-md transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 group"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className={`w-10 h-10 sm:w-11 sm:h-11 rounded-2xl flex items-center justify-center font-black text-xs shrink-0 shadow-2xs ${getAvatarColor(customer.name)}`}>
                    {getInitials(customer.name)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 
                        onClick={() => setSelectedCustomerForProfile(customer)}
                        className="font-black text-xs sm:text-sm text-slate-900 truncate uppercase tracking-tight group-hover:text-blue-600 cursor-pointer transition-colors"
                      >
                        {customer.name}
                      </h4>
                      {metrics.hasActiveOS && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-50 border border-amber-200 text-amber-700 text-[9px] font-black uppercase rounded-lg shrink-0">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                          O.S. #{metrics.activeOS?.id}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-[11px] font-bold text-slate-400 truncate mt-0.5">
                      <span>{customer.phoneNumber || 'Sem telefone'}</span>
                      {customer.address && <span className="hidden md:inline truncate">📍 {customer.address}</span>}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-2 sm:gap-4 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                  <div className="text-left sm:text-right">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider">
                      {metrics.totalOrders} {metrics.totalOrders === 1 ? 'O.S.' : 'O.S.'}
                    </p>
                    <p className="text-xs sm:text-sm font-black text-emerald-600">
                      {renderMoney(metrics.totalPaid)}
                    </p>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setBroadcastCustomer({
                        name: customer.name,
                        phone: customer.phoneNumber,
                        order: metrics.activeOS || metrics.custOrders[0]
                      })}
                      className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white flex items-center justify-center transition-colors active:scale-95 shadow-2xs"
                      title="Divulgar Promoção ou Enviar Proposta no WhatsApp (1-Clique)"
                    >
                      <MessageSquare size={14} />
                    </button>
                    {customer.phoneNumber && (
                      <a
                        href={`tel:${digitsOnly(customer.phoneNumber)}`}
                        className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-600 flex items-center justify-center transition-colors active:scale-95"
                        title="Ligar para o cliente"
                      >
                        <Phone size={14} />
                      </a>
                    )}
                    <button
                      onClick={() => setSelectedCustomerForProfile(customer)}
                      className="px-2.5 sm:px-3 py-1.5 sm:py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-black text-[10px] uppercase tracking-wider flex items-center gap-1 active:scale-95 transition-all shadow-2xs min-h-[36px]"
                    >
                      <Eye size={12} />
                      <span className="hidden sm:inline">Ficha</span>
                    </button>
                    <button
                      onClick={() => onNavigateToNewOS(customer)}
                      className="px-2.5 sm:px-3 py-1.5 sm:py-2 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-xl font-black text-[10px] uppercase tracking-wider flex items-center gap-1 active:scale-95 transition-all min-h-[36px]"
                      title="Abrir Nova O.S."
                    >
                      <Plus size={12} />
                      <span className="hidden sm:inline">Nova O.S.</span>
                    </button>
                    <button
                      onClick={() => handleOpenEditCustomer(customer)}
                      className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors"
                      title="Editar cliente"
                    >
                      <Edit size={14} />
                    </button>
                    <button
                      onClick={() => setCustomerToDelete(customer)}
                      className="p-2 text-slate-300 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                      title="Excluir cliente"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : customersLayout === 'small' ? (
        /* MODO PEQUENO / COMPACTO */
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5 sm:gap-3">
          {filteredCustomers.map(customer => {
            const metrics = getCustomerMetrics(customer);
            const waLink = getWhatsAppLink(customer.phoneNumber);

            return (
              <div
                key={customer.id}
                className="bg-white rounded-2xl sm:rounded-3xl border border-slate-100 p-3.5 sm:p-4 shadow-2xs hover:shadow-md transition-all flex flex-col justify-between group"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center font-black text-xs shrink-0 shadow-2xs ${getAvatarColor(customer.name)}`}>
                        {getInitials(customer.name)}
                      </div>
                      <div className="min-w-0">
                        <h4 className="font-black text-xs text-slate-900 truncate uppercase tracking-tight group-hover:text-blue-600 transition-colors">
                          {customer.name}
                        </h4>
                        <p className="text-[10px] font-bold text-slate-400 truncate">
                          {customer.phoneNumber || 'Sem telefone'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      {waLink && (
                        <a
                          href={waLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-7 h-7 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-600 flex items-center justify-center transition-colors"
                          title="WhatsApp"
                        >
                          <MessageSquare size={13} />
                        </a>
                      )}
                      {customer.phoneNumber && (
                        <a
                          href={`tel:${digitsOnly(customer.phoneNumber)}`}
                          className="w-7 h-7 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-600 flex items-center justify-center transition-colors"
                          title="Ligar"
                        >
                          <Phone size={13} />
                        </a>
                      )}
                    </div>
                  </div>

                  {metrics.hasActiveOS && (
                    <div className="mb-2.5 p-2 bg-amber-50 border border-amber-100 rounded-xl flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse shrink-0"></span>
                      <p className="text-[9px] font-black text-amber-700 uppercase tracking-tight truncate">
                        O.S. #{metrics.activeOS?.id} na bancada
                      </p>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-1.5 mb-3 bg-slate-50 p-2.5 rounded-xl text-center">
                    <div>
                      <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">O.S.</p>
                      <p className="text-[11px] font-black text-slate-800">{metrics.totalOrders}</p>
                    </div>
                    <div>
                      <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Pago</p>
                      <p className="text-[11px] font-black text-emerald-600 truncate">{renderMoney(metrics.totalPaid)}</p>
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-1">
                  <button
                    onClick={() => setSelectedCustomerForProfile(customer)}
                    className="flex-1 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-black text-[9px] uppercase tracking-wider flex items-center justify-center gap-1 active:scale-95 transition-all shadow-2xs"
                  >
                    <Eye size={11} />
                    <span>Ficha</span>
                  </button>
                  <button
                    onClick={() => onNavigateToNewOS(customer)}
                    className="py-1.5 px-2 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-lg font-black text-[9px] uppercase tracking-wider flex items-center justify-center gap-1 active:scale-95 transition-all"
                    title="Nova O.S."
                  >
                    <Plus size={11} />
                    <span>O.S.</span>
                  </button>
                  <button
                    onClick={() => handleOpenEditCustomer(customer)}
                    className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                    title="Editar"
                  >
                    <Edit size={12} />
                  </button>
                  <button
                    onClick={() => setCustomerToDelete(customer)}
                    className="p-1.5 text-slate-300 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="Excluir"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : customersLayout === 'large' ? (
        /* MODO GRANDE (2 COLUNAS) */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredCustomers.map(customer => {
            const metrics = getCustomerMetrics(customer);
            const waLink = getWhatsAppLink(customer.phoneNumber);

            return (
              <div
                key={customer.id}
                className="bg-white rounded-3xl border border-slate-100 p-5 sm:p-6 shadow-sm hover:shadow-md transition-all flex flex-col justify-between group"
              >
                <div>
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className={`w-12 h-12 sm:w-14 sm:h-14 rounded-2xl flex items-center justify-center font-black text-base shrink-0 shadow-sm ${getAvatarColor(customer.name)}`}>
                        {getInitials(customer.name)}
                      </div>
                      <div className="min-w-0">
                        <h4 className="font-black text-base text-slate-900 truncate uppercase tracking-tight group-hover:text-blue-600 transition-colors">
                          {customer.name}
                        </h4>
                        <div className="flex items-center gap-2 text-xs font-bold text-slate-400 truncate mt-0.5">
                          <span>{customer.phoneNumber || 'Sem telefone'}</span>
                          {customer.document && <span>• {customer.document}</span>}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {waLink && (
                        <a
                          href={waLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-9 h-9 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-600 flex items-center justify-center transition-colors active:scale-95"
                          title="Conversar no WhatsApp"
                        >
                          <MessageSquare size={16} />
                        </a>
                      )}
                      {customer.phoneNumber && (
                        <a
                          href={`tel:${digitsOnly(customer.phoneNumber)}`}
                          className="w-9 h-9 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-600 flex items-center justify-center transition-colors active:scale-95"
                          title="Ligar para o cliente"
                        >
                          <Phone size={16} />
                        </a>
                      )}
                    </div>
                  </div>

                  {customer.address && (
                    <p className="text-[11px] text-slate-500 font-medium mb-3 truncate flex items-center gap-1.5">
                      <span className="text-slate-400">📍</span> {customer.address}
                    </p>
                  )}

                  {/* Resumo Financeiro e Quantidade de Ordens */}
                  <div className="grid grid-cols-3 gap-2 mb-4 bg-slate-50 p-3.5 rounded-2xl">
                    <div>
                      <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Total O.S.</p>
                      <p className="text-sm font-black text-slate-800">{metrics.totalOrders} {metrics.totalOrders === 1 ? 'ordem' : 'ordens'}</p>
                    </div>
                    <div>
                      <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Concluídas</p>
                      <p className="text-sm font-black text-blue-600">{metrics.completedOrdersCount}</p>
                    </div>
                    <div>
                      <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Total Pago</p>
                      <p className="text-sm font-black text-emerald-600">{renderMoney(metrics.totalPaid)}</p>
                    </div>
                  </div>

                  {/* Alerta de O.S. ativa / pendente */}
                  {metrics.hasActiveOS && (
                    <div className="mb-3.5 p-3 bg-amber-50 border border-amber-100 rounded-2xl flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse shrink-0"></div>
                        <p className="text-xs font-black text-amber-800 uppercase tracking-tight truncate">
                          O.S. #{metrics.activeOS?.id} ({metrics.activeOS?.deviceModel})
                        </p>
                      </div>
                      <span className="text-[10px] font-bold text-amber-700 bg-white/80 px-2 py-0.5 rounded-lg border border-amber-200 shrink-0">
                        {metrics.activeOS?.status}
                      </span>
                    </div>
                  )}

                  {customer.notes && (
                    <div className="mb-4 p-3 bg-slate-50 rounded-2xl border border-slate-100">
                      <p className="text-[10px] font-medium text-slate-600 italic line-clamp-2">
                        "{customer.notes}"
                      </p>
                    </div>
                  )}
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2 mt-2">
                  <button
                    onClick={() => setSelectedCustomerForProfile(customer)}
                    className="flex-1 py-3 px-4 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 active:scale-95 transition-all shadow-sm min-h-[44px]"
                  >
                    <Eye size={14} />
                    <span>Ver Ficha Completa</span>
                  </button>

                  <button
                    onClick={() => onNavigateToNewOS(customer)}
                    className="py-3 px-4 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 active:scale-95 transition-all min-h-[44px]"
                    title="Abrir Nova O.S. para este cliente"
                  >
                    <Plus size={14} />
                    <span>Nova O.S.</span>
                  </button>

                  <button
                    onClick={() => handleOpenEditCustomer(customer)}
                    className="p-3 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
                    title="Editar dados cadastrais"
                  >
                    <Edit size={16} />
                  </button>

                  <button
                    onClick={() => setCustomerToDelete(customer)}
                    className="p-3 text-slate-300 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
                    title="Excluir cliente"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* MODO MÉDIO (PADRÃO - 3 COLUNAS) */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {filteredCustomers.map(customer => {
            const metrics = getCustomerMetrics(customer);
            const waLink = getWhatsAppLink(customer.phoneNumber);

            return (
              <div
                key={customer.id}
                className="bg-white rounded-3xl border border-slate-100 p-4 sm:p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between group"
              >
                <div>
                  {/* Topo do Card */}
                  <div className="flex items-start justify-between gap-3 mb-3.5">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-11 h-11 sm:w-12 sm:h-12 rounded-2xl flex items-center justify-center font-black text-sm shrink-0 shadow-sm ${getAvatarColor(customer.name)}`}>
                        {getInitials(customer.name)}
                      </div>
                      <div className="min-w-0">
                        <h4 className="font-black text-sm text-slate-900 truncate uppercase tracking-tight group-hover:text-blue-600 transition-colors">
                          {customer.name}
                        </h4>
                        <p className="text-[11px] font-bold text-slate-400 truncate">
                          {customer.phoneNumber || 'Sem telefone'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      {waLink && (
                        <a
                          href={waLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-600 flex items-center justify-center transition-colors active:scale-95"
                          title="Conversar no WhatsApp"
                        >
                          <MessageSquare size={14} />
                        </a>
                      )}
                      {customer.phoneNumber && (
                        <a
                          href={`tel:${digitsOnly(customer.phoneNumber)}`}
                          className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-600 flex items-center justify-center transition-colors active:scale-95"
                          title="Ligar para o cliente"
                        >
                          <Phone size={14} />
                        </a>
                      )}
                    </div>
                  </div>

                  {/* Endereço se houver */}
                  {customer.address && (
                    <p className="text-[10px] text-slate-400 font-medium mb-3 truncate">
                      📍 {customer.address}
                    </p>
                  )}

                  {/* Badges de Status e Métricas */}
                  <div className="grid grid-cols-2 gap-2 mb-3.5 bg-slate-50 p-3 rounded-2xl">
                    <div>
                      <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Serviços</p>
                      <p className="text-xs font-black text-slate-800">
                        {metrics.totalOrders} {metrics.totalOrders === 1 ? 'O.S.' : 'O.S.'}
                      </p>
                    </div>
                    <div>
                      <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Total Pago</p>
                      <p className="text-xs font-black text-emerald-600">
                        {renderMoney(metrics.totalPaid)}
                      </p>
                    </div>
                  </div>

                  {/* Alerta de O.S. ativa / pendente */}
                  {metrics.hasActiveOS && (
                    <div className="mb-3 p-2.5 bg-amber-50 border border-amber-100 rounded-xl flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse shrink-0"></div>
                      <p className="text-[9px] font-black text-amber-700 uppercase tracking-tight truncate">
                        O.S. #{metrics.activeOS?.id} em andamento ({metrics.activeOS?.deviceModel})
                      </p>
                    </div>
                  )}

                  {/* Prévia de Observação se houver */}
                  {customer.notes && (
                    <div className="mb-3 p-2 bg-slate-50 rounded-xl border border-slate-100">
                      <p className="text-[9px] font-medium text-slate-600 line-clamp-2 italic">
                        "{customer.notes}"
                      </p>
                    </div>
                  )}
                </div>

                {/* Rodapé do Card com Ações */}
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-1.5 sm:gap-2 mt-2">
                  <button
                    onClick={() => setSelectedCustomerForProfile(customer)}
                    className="flex-1 py-2.5 px-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-black text-[10px] uppercase tracking-wider flex items-center justify-center gap-1.5 active:scale-95 transition-all shadow-sm min-h-[40px]"
                  >
                    <Eye size={12} />
                    <span>Ver Ficha</span>
                  </button>

                  <button
                    onClick={() => onNavigateToNewOS(customer)}
                    className="py-2.5 px-3 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-xl font-black text-[10px] uppercase tracking-wider flex items-center justify-center gap-1 active:scale-95 transition-all min-h-[40px]"
                    title="Abrir Nova O.S. para este cliente"
                  >
                    <Plus size={12} />
                    <span>Nova O.S.</span>
                  </button>

                  <button
                    onClick={() => handleOpenEditCustomer(customer)}
                    className="p-2.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors min-h-[40px] min-w-[40px] flex items-center justify-center"
                    title="Editar dados cadastrais"
                  >
                    <Edit size={14} />
                  </button>

                  <button
                    onClick={() => setCustomerToDelete(customer)}
                    className="p-2.5 text-slate-300 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors min-h-[40px] min-w-[40px] flex items-center justify-center"
                    title="Excluir cliente"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL DO PERFIL COMPLETO DO CLIENTE (FICHA, HISTÓRICO, PAGAMENTOS E NOTAS) */}
      {/* ========================================================================= */}
      {selectedCustomerForProfile && (() => {
        const metrics = getCustomerMetrics(selectedCustomerForProfile);
        const waLink = getWhatsAppLink(selectedCustomerForProfile.phoneNumber);

        return (
          <div className="fixed inset-0 bg-slate-950/80 z-50 flex flex-col justify-end md:justify-center p-2 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white w-full max-w-3xl mx-auto rounded-[2.5rem] overflow-hidden shadow-2xl animate-in slide-in-from-bottom-6 flex flex-col max-h-[92vh]">
              {/* Header do Perfil */}
              <div className="p-6 bg-slate-900 text-white shrink-0 relative overflow-hidden">
                <button
                  onClick={() => setSelectedCustomerForProfile(null)}
                  className="absolute top-6 right-6 p-2 text-slate-400 hover:text-white bg-white/10 rounded-full transition-all"
                >
                  <X size={20} />
                </button>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pr-12">
                  <div className="flex items-center gap-4">
                    <div className={`w-16 h-16 rounded-3xl flex items-center justify-center font-black text-xl shadow-lg shrink-0 ${getAvatarColor(selectedCustomerForProfile.name)}`}>
                      {getInitials(selectedCustomerForProfile.name)}
                    </div>
                    <div>
                      <h3 className="text-xl font-black uppercase tracking-tight">
                        {selectedCustomerForProfile.name}
                      </h3>
                      <div className="flex items-center gap-3 text-xs text-slate-300 mt-1 flex-wrap">
                        {selectedCustomerForProfile.phoneNumber && (
                          <span>📞 {selectedCustomerForProfile.phoneNumber}</span>
                        )}
                        {selectedCustomerForProfile.document && (
                          <span>📄 {selectedCustomerForProfile.document}</span>
                        )}
                        <span className="text-slate-400 text-[10px]">
                          Cadastrado em {formatDate(selectedCustomerForProfile.createdAt)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setBroadcastCustomer({
                        name: selectedCustomerForProfile.name,
                        phone: selectedCustomerForProfile.phoneNumber,
                        order: metrics.activeOS || metrics.custOrders[0]
                      })}
                      className="px-3.5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 shadow-md active:scale-95 transition-all"
                      title="Divulgar Promoção ou Enviar Proposta / Orçamento no WhatsApp"
                    >
                      <MessageSquare size={14} />
                      <span>Divulgar / Proposta</span>
                    </button>
                    <button
                      onClick={() => {
                        const targetCust = selectedCustomerForProfile;
                        setSelectedCustomerForProfile(null);
                        onNavigateToNewOS(targetCust);
                      }}
                      className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 shadow-md active:scale-95 transition-all"
                    >
                      <Plus size={14} />
                      <span>Nova O.S.</span>
                    </button>
                  </div>
                </div>

                {/* Métricas Rápidas do Topo */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-6 pt-4 border-t border-white/10">
                  <div>
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Total de O.S.</p>
                    <p className="text-lg font-black text-white">{metrics.totalOrders}</p>
                  </div>
                  <div>
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Concluídas</p>
                    <p className="text-lg font-black text-emerald-400">{metrics.completedOrdersCount}</p>
                  </div>
                  <div>
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Total Pago</p>
                    <p className="text-lg font-black text-emerald-400">{renderMoney(metrics.totalPaid)}</p>
                  </div>
                  <div>
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Em Aberto</p>
                    <p className="text-lg font-black text-amber-400">{renderMoney(metrics.totalPending)}</p>
                  </div>
                </div>
              </div>

              {/* Barra de Abas do Perfil */}
              <div className="flex border-b border-slate-100 bg-white px-6 shrink-0 overflow-x-auto">
                <button
                  onClick={() => setProfileTab('services')}
                  className={`py-4 px-4 font-black text-xs uppercase tracking-wider border-b-2 flex items-center gap-2 transition-all whitespace-nowrap ${
                    profileTab === 'services'
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-slate-400 hover:text-slate-700'
                  }`}
                >
                  <Wrench size={16} />
                  <span>Histórico de Serviços ({metrics.totalOrders})</span>
                </button>

                <button
                  onClick={() => setProfileTab('payments')}
                  className={`py-4 px-4 font-black text-xs uppercase tracking-wider border-b-2 flex items-center gap-2 transition-all whitespace-nowrap ${
                    profileTab === 'payments'
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-slate-400 hover:text-slate-700'
                  }`}
                >
                  <DollarSign size={16} />
                  <span>Histórico Financeiro ({renderMoney(metrics.totalHistorical)})</span>
                </button>

                <button
                  onClick={() => setProfileTab('notes')}
                  className={`py-4 px-4 font-black text-xs uppercase tracking-wider border-b-2 flex items-center gap-2 transition-all whitespace-nowrap ${
                    profileTab === 'notes'
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-slate-400 hover:text-slate-700'
                  }`}
                >
                  <FileText size={16} />
                  <span>Observações & Notas</span>
                  {selectedCustomerForProfile.notes && (
                    <span className="w-2 h-2 rounded-full bg-blue-600"></span>
                  )}
                </button>

                <button
                  onClick={() => setProfileTab('details')}
                  className={`py-4 px-4 font-black text-xs uppercase tracking-wider border-b-2 flex items-center gap-2 transition-all whitespace-nowrap ${
                    profileTab === 'details'
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-slate-400 hover:text-slate-700'
                  }`}
                >
                  <Edit size={16} />
                  <span>Dados Cadastrais</span>
                </button>
              </div>

              {/* Conteúdo da Aba Selecionada */}
              <div className="p-6 overflow-y-auto flex-1 space-y-6">
                {/* ----------------- ABA 1: HISTÓRICO DE SERVIÇOS ----------------- */}
                {profileTab === 'services' && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">
                        Ordens de Serviço do Cliente
                      </h4>
                      <button
                        onClick={() => {
                          const targetCust = selectedCustomerForProfile;
                          setSelectedCustomerForProfile(null);
                          onNavigateToNewOS(targetCust);
                        }}
                        className="text-xs font-black text-blue-600 uppercase tracking-wider flex items-center gap-1 hover:underline"
                      >
                        <Plus size={14} />
                        Nova O.S.
                      </button>
                    </div>

                    {metrics.custOrders.length === 0 ? (
                      <div className="bg-slate-50 rounded-2xl p-8 text-center border border-slate-100">
                        <Wrench className="mx-auto text-slate-300 mb-2" size={28} />
                        <p className="text-xs font-black text-slate-600 uppercase tracking-tight">
                          Nenhum serviço registrado para este cliente ainda
                        </p>
                        <p className="text-[11px] text-slate-400 mt-1">
                          Quando uma nova O.S. for criada com o nome ou telefone deste cliente, ela aparecerá aqui automaticamente.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {metrics.custOrders.map(order => (
                          <div
                            key={order.id}
                            className="bg-slate-50 border border-slate-100 rounded-2xl p-4 hover:bg-slate-100/60 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                          >
                            <div className="space-y-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-black text-xs text-slate-900 bg-white px-2.5 py-1 rounded-lg border border-slate-200 shadow-2xs">
                                  O.S. #{order.id}
                                </span>
                                <span
                                  className={`text-[9px] font-black uppercase px-2.5 py-1 rounded-lg ${
                                    order.status === 'Entregue'
                                      ? 'bg-emerald-100 text-emerald-700'
                                      : order.status === 'Concluído'
                                      ? 'bg-blue-100 text-blue-700'
                                      : 'bg-amber-100 text-amber-700'
                                  }`}
                                >
                                  {order.status}
                                </span>
                                <span className="text-[10px] text-slate-400 font-bold">
                                  Entrada: {order.entryDate || formatDate(order.date)}
                                </span>
                              </div>

                              <p className="text-sm font-black text-slate-800 uppercase tracking-tight">
                                {order.deviceBrand} {order.deviceModel}
                              </p>

                              {order.defect && (
                                <p className="text-xs text-slate-500 font-medium">
                                  <strong className="text-slate-700">Defeito:</strong> {order.defect}
                                </p>
                              )}

                              {order.repairDetails && (
                                <p className="text-xs text-slate-500 font-medium">
                                  <strong className="text-slate-700">Reparo:</strong> {order.repairDetails}
                                </p>
                              )}
                            </div>

                            <div className="flex sm:flex-col items-center sm:items-end justify-between gap-2 border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-200">
                              <div className="text-right">
                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Valor</p>
                                <p className="text-base font-black text-slate-900">
                                  {renderMoney(order.total || 0)}
                                </p>
                              </div>

                              {onViewOrder && (
                                <button
                                  onClick={() => {
                                    setSelectedCustomerForProfile(null);
                                    onViewOrder(order);
                                  }}
                                  className="px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-[10px] font-black uppercase tracking-wider shadow-2xs"
                                >
                                  Ver Detalhes
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* ----------------- ABA 2: HISTÓRICO DE PAGAMENTOS ----------------- */}
                {profileTab === 'payments' && (
                  <div className="space-y-6">
                    {/* Resumo Financeiro */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-2xl">
                        <p className="text-[9px] font-black text-emerald-600 uppercase tracking-widest">Total Pago</p>
                        <p className="text-xl font-black text-emerald-700">{renderMoney(metrics.totalPaid)}</p>
                        <p className="text-[10px] text-emerald-600 mt-0.5">Serviços entregues e concluídos</p>
                      </div>

                      <div className="bg-amber-50 border border-amber-100 p-4 rounded-2xl">
                        <p className="text-[9px] font-black text-amber-600 uppercase tracking-widest">A Receber</p>
                        <p className="text-xl font-black text-amber-700">{renderMoney(metrics.totalPending)}</p>
                        <p className="text-[10px] text-amber-600 mt-0.5">Serviços pendentes na bancada</p>
                      </div>

                      <div className="bg-slate-50 border border-slate-100 p-4 rounded-2xl col-span-2 sm:col-span-1">
                        <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Total Geral</p>
                        <p className="text-xl font-black text-slate-900">{renderMoney(metrics.totalHistorical)}</p>
                        <p className="text-[10px] text-slate-400 mt-0.5">Histórico completo</p>
                      </div>
                    </div>

                    {/* Tabela de Lançamentos */}
                    <div className="space-y-3">
                      <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">
                        Extrato de Serviços e Pagamentos
                      </h4>

                      {metrics.custOrders.length === 0 ? (
                        <div className="bg-slate-50 rounded-2xl p-8 text-center text-slate-400 text-xs font-bold uppercase">
                          Nenhum lançamento financeiro registrado.
                        </div>
                      ) : (
                        <div className="divide-y divide-slate-100 border border-slate-100 rounded-2xl overflow-hidden bg-white shadow-2xs">
                          {metrics.custOrders.map(order => {
                            const isPaid = order.status === 'Concluído' || order.status === 'Entregue';

                            return (
                              <div key={`pay-${order.id}`} className="p-4 flex items-center justify-between gap-4">
                                <div className="space-y-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className={`w-2 h-2 rounded-full ${isPaid ? 'bg-emerald-500' : 'bg-amber-500'}`}></span>
                                    <p className="text-xs font-black text-slate-800 uppercase tracking-tight truncate">
                                      O.S. #{order.id} - {order.deviceBrand} {order.deviceModel}
                                    </p>
                                  </div>
                                  <p className="text-[10px] text-slate-400 font-medium">
                                    Data: {order.exitDate || order.entryDate || formatDate(order.date)}
                                    {order.paymentMethod && ` • Forma: ${order.paymentMethod}`}
                                    {order.paymentInstallments && order.paymentInstallments > 1 && ` (${order.paymentInstallments}x)`}
                                  </p>
                                </div>

                                <div className="text-right shrink-0">
                                  <span
                                    className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-md ${
                                      isPaid ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'
                                    }`}
                                  >
                                    {isPaid ? 'Pago' : 'Pendente'}
                                  </span>
                                  <p className={`text-sm font-black mt-1 ${isPaid ? 'text-emerald-600' : 'text-slate-800'}`}>
                                    {renderMoney(order.total || 0)}
                                  </p>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* ----------------- ABA 3: OBSERVAÇÕES & ANOTAÇÕES ----------------- */}
                {profileTab === 'notes' && (
                  <div className="space-y-6">
                    {/* Nota Principal Fixa do Cliente */}
                    <div className="bg-slate-50 p-5 rounded-3xl border border-slate-100 space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="text-xs font-black text-slate-900 uppercase tracking-tight">
                            Nota Principal do Cliente
                          </h4>
                          <p className="text-[10px] text-slate-400 font-medium">
                            Anotação permanente de preferências, observações e acordos com o cliente
                          </p>
                        </div>
                        {mainNoteSuccess && (
                          <span className="text-xs font-black text-emerald-600 flex items-center gap-1 animate-in fade-in">
                            <Check size={14} /> Salvo!
                          </span>
                        )}
                      </div>

                      <textarea
                        value={mainNoteDraft}
                        onChange={(e) => setMainNoteDraft(e.target.value)}
                        placeholder="Ex: Cliente VIP, prefere peças originais, retira sempre aos sábados, etc..."
                        rows={3}
                        className="w-full p-4 bg-white border border-slate-200 rounded-2xl text-xs font-bold text-slate-800 outline-none focus:border-blue-500 transition-all resize-none placeholder:text-slate-300"
                      />

                      <div className="flex justify-end">
                        <button
                          onClick={handleSaveMainNote}
                          disabled={isSavingNote}
                          className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 shadow-md active:scale-95 transition-all disabled:opacity-50"
                        >
                          <Save size={14} />
                          <span>Salvar Nota Principal</span>
                        </button>
                      </div>
                    </div>

                    {/* Diário de Anotações Cronológicas */}
                    <div className="space-y-4">
                      <div>
                        <h4 className="text-xs font-black text-slate-900 uppercase tracking-tight">
                          Diário de Atendimentos e Contatos
                        </h4>
                        <p className="text-[10px] text-slate-400 font-medium">
                          Adicione lembretes e registros de ligações com data, hora e autor
                        </p>
                      </div>

                      {/* Caixa de Entrada de Nova Anotação */}
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={newNoteText}
                          onChange={(e) => setNewNoteText(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleAddNoteToHistory()}
                          placeholder="Digite uma nova anotação e pressione Enter..."
                          className="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-800 outline-none focus:bg-white focus:border-blue-500 transition-all"
                        />
                        <button
                          onClick={handleAddNoteToHistory}
                          disabled={!newNoteText.trim() || isSavingNote}
                          className="px-5 py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl font-black text-xs uppercase tracking-wider flex items-center gap-1.5 active:scale-95 transition-all disabled:opacity-50"
                        >
                          <Plus size={16} />
                          <span>Adicionar</span>
                        </button>
                      </div>

                      {/* Lista do Diário */}
                      {(!selectedCustomerForProfile.notesHistory || selectedCustomerForProfile.notesHistory.length === 0) ? (
                        <div className="p-8 bg-slate-50 rounded-2xl text-center text-slate-400 text-xs font-bold uppercase">
                          Nenhuma anotação registrada ainda no diário.
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {selectedCustomerForProfile.notesHistory.map(note => (
                            <div
                              key={note.id}
                              className="p-4 bg-slate-50 border border-slate-100 rounded-2xl flex items-start justify-between gap-3 group"
                            >
                              <div className="space-y-1">
                                <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400">
                                  <span>{formatDateTime(note.createdAt)}</span>
                                  {note.authorName && (
                                    <>
                                      <span>•</span>
                                      <span className="text-slate-600 font-black">{note.authorName}</span>
                                    </>
                                  )}
                                </div>
                                <p className="text-xs font-bold text-slate-800 whitespace-pre-wrap">
                                  {note.text}
                                </p>
                              </div>

                              <button
                                onClick={() => handleDeleteNoteFromHistory(note.id)}
                                className="p-1.5 text-slate-300 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-all"
                                title="Excluir anotação"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* ----------------- ABA 4: DADOS CADASTRAIS ----------------- */}
                {profileTab === 'details' && (
                  <div className="space-y-4 max-w-xl">
                    <h4 className="text-xs font-black text-slate-900 uppercase tracking-tight">
                      Informações Cadastrais do Cliente
                    </h4>

                    <div className="bg-slate-50 p-5 rounded-3xl border border-slate-100 space-y-4">
                      <div className="space-y-1">
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">
                          Nome Completo
                        </label>
                        <input
                          type="text"
                          value={formData.name}
                          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                          className="w-full p-3 bg-white border border-slate-200 rounded-xl font-bold text-xs outline-none focus:border-blue-500"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">
                            Telefone / WhatsApp
                          </label>
                          <input
                            type="text"
                            value={formData.phoneNumber}
                            onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
                            className="w-full p-3 bg-white border border-slate-200 rounded-xl font-bold text-xs outline-none focus:border-blue-500"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">
                            CPF / CNPJ
                          </label>
                          <input
                            type="text"
                            value={formData.document}
                            onChange={(e) => setFormData({ ...formData, document: e.target.value })}
                            className="w-full p-3 bg-white border border-slate-200 rounded-xl font-bold text-xs outline-none focus:border-blue-500"
                          />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">
                          Endereço Completo
                        </label>
                        <input
                          type="text"
                          value={formData.address}
                          onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                          className="w-full p-3 bg-white border border-slate-200 rounded-xl font-bold text-xs outline-none focus:border-blue-500"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">
                          E-mail
                        </label>
                        <input
                          type="email"
                          value={formData.email}
                          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                          className="w-full p-3 bg-white border border-slate-200 rounded-xl font-bold text-xs outline-none focus:border-blue-500"
                        />
                      </div>

                      <div className="pt-2 flex justify-end">
                        <button
                          onClick={async () => {
                            if (!formData.name.trim()) return alert('Nome é obrigatório');
                            const updated: Customer = {
                              ...selectedCustomerForProfile,
                              name: formData.name.trim(),
                              phoneNumber: formData.phoneNumber.trim(),
                              address: formData.address.trim(),
                              document: formData.document.trim(),
                              email: formData.email.trim(),
                              updatedAt: new Date().toISOString()
                            };
                            await onSaveCustomer(updated);
                            setSelectedCustomerForProfile(updated);
                            alert('Dados atualizados com sucesso!');
                          }}
                          className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-md active:scale-95 transition-all"
                        >
                          Salvar Alterações
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* ========================================================================= */}
      {/* MODAL DE CRIAÇÃO / EDIÇÃO DE CLIENTE */}
      {/* ========================================================================= */}
      {isNewCustomerModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 z-50 flex flex-col justify-end md:justify-center p-2 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white w-full max-w-lg mx-auto rounded-[2.5rem] overflow-hidden shadow-2xl animate-in slide-in-from-bottom-6 flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-white shrink-0">
              <h3 className="font-black text-slate-800 text-lg uppercase tracking-tight">
                {editingCustomer ? 'Editar Cliente' : 'Cadastrar Novo Cliente'}
              </h3>
              <button
                onClick={() => setIsNewCustomerModalOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-600 bg-slate-50 rounded-full transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveCustomerForm} className="p-6 space-y-4 overflow-y-auto flex-1">
              <div className="space-y-1">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">
                  Nome Completo *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ex: João da Silva"
                  className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-xs outline-none focus:border-blue-500 focus:bg-white transition-all"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">
                    Telefone / WhatsApp *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.phoneNumber}
                    onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
                    placeholder="(00) 00000-0000"
                    className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-xs outline-none focus:border-blue-500 focus:bg-white transition-all"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">
                    CPF ou CNPJ (Opcional)
                  </label>
                  <input
                    type="text"
                    value={formData.document}
                    onChange={(e) => setFormData({ ...formData, document: e.target.value })}
                    placeholder="000.000.000-00"
                    className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-xs outline-none focus:border-blue-500 focus:bg-white transition-all"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">
                  Endereço Completo (Opcional)
                </label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="Rua, Número, Bairro, Cidade"
                  className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-xs outline-none focus:border-blue-500 focus:bg-white transition-all"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">
                  E-mail (Opcional)
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="cliente@email.com"
                  className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-xs outline-none focus:border-blue-500 focus:bg-white transition-all"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">
                  Observações Iniciais
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Informações sobre o cliente, preferências ou notas relevantes..."
                  rows={3}
                  className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-xs outline-none focus:border-blue-500 focus:bg-white transition-all resize-none"
                />
              </div>

              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsNewCustomerModalOpen(false)}
                  className="w-1/2 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl font-black text-xs uppercase tracking-widest transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="w-1/2 py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-lg shadow-blue-500/20 active:scale-95 transition-all"
                >
                  {editingCustomer ? 'Salvar Alterações' : 'Cadastrar Cliente'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL DE CONFIRMAÇÃO DE EXCLUSÃO */}
      {/* ========================================================================= */}
      {customerToDelete && (
        <div className="fixed inset-0 bg-slate-950/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white w-full max-w-sm rounded-[2rem] p-6 shadow-2xl animate-in zoom-in-95 border border-slate-100 text-center space-y-4">
            <div className="w-14 h-14 bg-red-50 text-red-600 rounded-2xl flex items-center justify-center mx-auto">
              <Trash2 size={28} />
            </div>

            <div>
              <h3 className="font-black text-slate-900 text-base uppercase tracking-tight">
                Excluir Cliente?
              </h3>
              <p className="text-xs text-slate-500 mt-1 font-medium">
                Tem certeza que deseja remover <strong>{customerToDelete.name}</strong>?
                As Ordens de Serviço permanecerão salvas no sistema.
              </p>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setCustomerToDelete(null)}
                className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl font-black text-xs uppercase tracking-wider"
              >
                Cancelar
              </button>
              <button
                onClick={async () => {
                  await onDeleteCustomer(customerToDelete.id);
                  setCustomerToDelete(null);
                  if (selectedCustomerForProfile?.id === customerToDelete.id) {
                    setSelectedCustomerForProfile(null);
                  }
                }}
                className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-black text-xs uppercase tracking-wider shadow-lg shadow-red-500/20"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL DE ORGANIZAR E PERSONALIZAR LAYOUT DOS CLIENTES */}
      {/* ========================================================================= */}
      {isSortModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white rounded-t-[2.5rem] sm:rounded-3xl p-5 sm:p-6 max-w-md w-full shadow-2xl border border-slate-100 animate-in slide-in-from-bottom-6 sm:zoom-in-95 duration-200 flex flex-col max-h-[92vh] sm:max-h-[90vh] overflow-hidden">
            {/* Header do Modal */}
            <div className="flex items-center justify-between pb-3.5 border-b border-slate-100 shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-blue-50 text-blue-600 rounded-2xl">
                  <SlidersHorizontal size={20} />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-black text-slate-800 uppercase tracking-tight">Organizar Clientes</h3>
                  <p className="text-xs text-slate-400 font-medium">Layout, ordenação e privacidade</p>
                </div>
              </div>
              <button 
                id="customers-modal-close-btn"
                onClick={() => setIsSortModalOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Conteúdo com Scroll */}
            <div className="py-4 space-y-5 overflow-y-auto pr-1">
              {/* Seção 1: Formato & Tamanho dos Cards */}
              <div>
                <label className="text-[11px] font-black text-slate-400 uppercase tracking-wider block mb-2.5">
                  1. Formato de Exibição dos Cards
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => handleUpdateLayout('list')}
                    className={`flex items-center gap-2.5 p-3 rounded-2xl border text-left transition-all ${
                      customersLayout === 'list'
                        ? 'border-blue-600 bg-blue-50/70 text-blue-900 font-bold shadow-xs'
                        : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-medium'
                    }`}
                  >
                    <div className={`p-1.5 rounded-xl ${customersLayout === 'list' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                      <List size={16} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold leading-tight">Lista</p>
                      <p className="text-[10px] text-slate-400 font-normal truncate">Visualização compacta</p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleUpdateLayout('small')}
                    className={`flex items-center gap-2.5 p-3 rounded-2xl border text-left transition-all ${
                      customersLayout === 'small'
                        ? 'border-blue-600 bg-blue-50/70 text-blue-900 font-bold shadow-xs'
                        : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-medium'
                    }`}
                  >
                    <div className={`p-1.5 rounded-xl ${customersLayout === 'small' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                      <LayoutGrid size={16} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold leading-tight">Pequeno</p>
                      <p className="text-[10px] text-slate-400 font-normal truncate">Grade compacta</p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleUpdateLayout('medium')}
                    className={`flex items-center gap-2.5 p-3 rounded-2xl border text-left transition-all ${
                      customersLayout === 'medium'
                        ? 'border-blue-600 bg-blue-50/70 text-blue-900 font-bold shadow-xs'
                        : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-medium'
                    }`}
                  >
                    <div className={`p-1.5 rounded-xl ${customersLayout === 'medium' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                      <LayoutGrid size={16} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold leading-tight">Médio (Padrão)</p>
                      <p className="text-[10px] text-slate-400 font-normal truncate">Grade equilibrada</p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleUpdateLayout('large')}
                    className={`flex items-center gap-2.5 p-3 rounded-2xl border text-left transition-all ${
                      customersLayout === 'large'
                        ? 'border-blue-600 bg-blue-50/70 text-blue-900 font-bold shadow-xs'
                        : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-medium'
                    }`}
                  >
                    <div className={`p-1.5 rounded-xl ${customersLayout === 'large' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                      <Columns size={16} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold leading-tight">Grande</p>
                      <p className="text-[10px] text-slate-400 font-normal truncate">2 Colunas detalhado</p>
                    </div>
                  </button>
                </div>
              </div>

              {/* Seção 2: Privacidade de Dinheiro / Valores */}
              <div>
                <label className="text-[11px] font-black text-slate-400 uppercase tracking-wider block mb-2.5">
                  2. Visualização de Valores Financeiros
                </label>
                <button
                  type="button"
                  onClick={handleToggleHideValues}
                  className={`w-full flex items-center justify-between p-3.5 rounded-2xl border text-left transition-all ${
                    hideValues
                      ? 'border-amber-500 bg-amber-50/70 text-amber-950 font-bold'
                      : 'border-emerald-500 bg-emerald-50/70 text-emerald-950 font-bold'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-xl ${hideValues ? 'bg-amber-500 text-white' : 'bg-emerald-600 text-white'}`}>
                      {hideValues ? <EyeOff size={18} /> : <Eye size={18} />}
                    </div>
                    <div>
                      <p className="text-sm font-bold leading-tight">
                        {hideValues ? 'Valores Ocultos (Modo Privacidade)' : 'Valores Visíveis'}
                      </p>
                      <p className="text-[11px] text-slate-500 font-normal">
                        {hideValues
                          ? 'Total recebido fica mascarado como R$ •••••'
                          : 'Valores reais são exibidos nos cards'}
                      </p>
                    </div>
                  </div>
                  <span className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-lg ${
                    hideValues ? 'bg-amber-200/80 text-amber-900' : 'bg-emerald-200/80 text-emerald-900'
                  }`}>
                    {hideValues ? 'Ativado' : 'Visível'}
                  </span>
                </button>
              </div>

              {/* Seção 3: Modo de Ordenação */}
              <div>
                <label className="text-[11px] font-black text-slate-400 uppercase tracking-wider block mb-2.5">
                  3. Modo de Ordenação
                </label>
                <div className="grid grid-cols-1 gap-2">
                  <button
                    type="button"
                    onClick={() => setSortMode('recent')}
                    className={`flex items-center justify-between p-3 rounded-2xl border text-left transition-all ${
                      sortMode === 'recent' 
                        ? 'border-blue-600 bg-blue-50/70 text-blue-900 font-bold shadow-xs' 
                        : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-medium'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-xl ${sortMode === 'recent' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                        <Clock size={16} />
                      </div>
                      <div>
                        <p className="text-sm font-bold leading-tight">Mais Recentes Primeiro</p>
                        <p className="text-[11px] text-slate-400 font-normal">Clientes cadastrados recentemente no topo</p>
                      </div>
                    </div>
                    {sortMode === 'recent' && <Check size={18} className="text-blue-600 shrink-0" />}
                  </button>

                  <button
                    type="button"
                    onClick={() => setSortMode('alphabetical')}
                    className={`flex items-center justify-between p-3 rounded-2xl border text-left transition-all ${
                      sortMode === 'alphabetical' 
                        ? 'border-blue-600 bg-blue-50/70 text-blue-900 font-bold shadow-xs' 
                        : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-medium'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-xl ${sortMode === 'alphabetical' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                        <ArrowDownAZ size={16} />
                      </div>
                      <div>
                        <p className="text-sm font-bold leading-tight">Ordem Alfabética (A - Z)</p>
                        <p className="text-[11px] text-slate-400 font-normal">Organizado pelo nome do cliente</p>
                      </div>
                    </div>
                    {sortMode === 'alphabetical' && <Check size={18} className="text-blue-600 shrink-0" />}
                  </button>

                  <button
                    type="button"
                    onClick={() => setSortMode('revenue')}
                    className={`flex items-center justify-between p-3 rounded-2xl border text-left transition-all ${
                      sortMode === 'revenue' 
                        ? 'border-emerald-600 bg-emerald-50/70 text-emerald-900 font-bold shadow-xs' 
                        : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-medium'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-xl ${sortMode === 'revenue' ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                        <DollarSign size={16} />
                      </div>
                      <div>
                        <p className="text-sm font-bold leading-tight">Maior Faturamento</p>
                        <p className="text-[11px] text-slate-400 font-normal">Clientes que mais geraram receita</p>
                      </div>
                    </div>
                    {sortMode === 'revenue' && <Check size={18} className="text-emerald-600 shrink-0" />}
                  </button>

                  <button
                    type="button"
                    onClick={() => setSortMode('orders_count')}
                    className={`flex items-center justify-between p-3 rounded-2xl border text-left transition-all ${
                      sortMode === 'orders_count' 
                        ? 'border-blue-600 bg-blue-50/70 text-blue-900 font-bold shadow-xs' 
                        : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-medium'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-xl ${sortMode === 'orders_count' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                        <Wrench size={16} />
                      </div>
                      <div>
                        <p className="text-sm font-bold leading-tight">Mais O.S. Realizadas</p>
                        <p className="text-[11px] text-slate-400 font-normal">Clientes com maior volume de serviços</p>
                      </div>
                    </div>
                    {sortMode === 'orders_count' && <Check size={18} className="text-blue-600 shrink-0" />}
                  </button>

                  <button
                    type="button"
                    onClick={() => setSortMode('oldest')}
                    className={`flex items-center justify-between p-3 rounded-2xl border text-left transition-all ${
                      sortMode === 'oldest' 
                        ? 'border-blue-600 bg-blue-50/70 text-blue-900 font-bold shadow-xs' 
                        : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-medium'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-xl ${sortMode === 'oldest' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                        <Calendar size={16} />
                      </div>
                      <div>
                        <p className="text-sm font-bold leading-tight">Mais Antigos Primeiro</p>
                        <p className="text-[11px] text-slate-400 font-normal">Primeiros clientes cadastrados</p>
                      </div>
                    </div>
                    {sortMode === 'oldest' && <Check size={18} className="text-blue-600 shrink-0" />}
                  </button>
                </div>
              </div>

              {/* Seção 4: Filtros Especiais */}
              <div>
                <label className="text-[11px] font-black text-slate-400 uppercase tracking-wider block mb-2.5">
                  4. Filtro de Clientes
                </label>
                <div className="grid grid-cols-1 gap-2">
                  <button
                    type="button"
                    onClick={() => setFilterMode('all')}
                    className={`flex items-center justify-between p-3 rounded-2xl border text-left transition-all ${
                      filterMode === 'all' 
                        ? 'border-blue-600 bg-blue-50/70 text-blue-900 font-bold shadow-xs' 
                        : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-medium'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-xl ${filterMode === 'all' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                        <Users size={16} />
                      </div>
                      <div>
                        <p className="text-sm font-bold leading-tight">Todos os Clientes</p>
                        <p className="text-[11px] text-slate-400 font-normal">Exibir todos sem restrições ({customers.length})</p>
                      </div>
                    </div>
                    {filterMode === 'all' && <Check size={18} className="text-blue-600 shrink-0" />}
                  </button>

                  <button
                    type="button"
                    onClick={() => setFilterMode('pending_os')}
                    className={`flex items-center justify-between p-3 rounded-2xl border text-left transition-all ${
                      filterMode === 'pending_os' 
                        ? 'border-amber-500 bg-amber-50/70 text-amber-900 font-bold shadow-xs' 
                        : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-medium'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-xl ${filterMode === 'pending_os' ? 'bg-amber-500 text-white' : 'bg-amber-50 text-amber-600'}`}>
                        <Clock size={16} />
                      </div>
                      <div>
                        <p className="text-sm font-bold leading-tight">Com O.S. Pendente</p>
                        <p className="text-[11px] text-slate-400 font-normal">Aparelhos atualmente em manutenção</p>
                      </div>
                    </div>
                    {filterMode === 'pending_os' && <Check size={18} className="text-amber-600 shrink-0" />}
                  </button>

                  <button
                    type="button"
                    onClick={() => setFilterMode('recurring')}
                    className={`flex items-center justify-between p-3 rounded-2xl border text-left transition-all ${
                      filterMode === 'recurring' 
                        ? 'border-blue-600 bg-blue-50/70 text-blue-900 font-bold shadow-xs' 
                        : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-medium'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-xl ${filterMode === 'recurring' ? 'bg-blue-600 text-white' : 'bg-blue-50 text-blue-600'}`}>
                        <Sparkles size={16} />
                      </div>
                      <div>
                        <p className="text-sm font-bold leading-tight">Clientes Recorrentes</p>
                        <p className="text-[11px] text-slate-400 font-normal">Clientes que já realizaram mais de 1 serviço</p>
                      </div>
                    </div>
                    {filterMode === 'recurring' && <Check size={18} className="text-blue-600 shrink-0" />}
                  </button>

                  <button
                    type="button"
                    onClick={() => setFilterMode('paying')}
                    className={`flex items-center justify-between p-3 rounded-2xl border text-left transition-all ${
                      filterMode === 'paying' 
                        ? 'border-emerald-600 bg-emerald-50/70 text-emerald-900 font-bold shadow-xs' 
                        : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-medium'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-xl ${filterMode === 'paying' ? 'bg-emerald-600 text-white' : 'bg-emerald-50 text-emerald-600'}`}>
                        <Receipt size={16} />
                      </div>
                      <div>
                        <p className="text-sm font-bold leading-tight">Com Pagamentos Realizados</p>
                        <p className="text-[11px] text-slate-400 font-normal">Clientes com serviços concluídos/pagos</p>
                      </div>
                    </div>
                    {filterMode === 'paying' && <Check size={18} className="text-emerald-600 shrink-0" />}
                  </button>

                  <button
                    type="button"
                    onClick={() => setFilterMode('no_os')}
                    className={`flex items-center justify-between p-3 rounded-2xl border text-left transition-all ${
                      filterMode === 'no_os' 
                        ? 'border-slate-600 bg-slate-100 text-slate-900 font-bold shadow-xs' 
                        : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-medium'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-xl ${filterMode === 'no_os' ? 'bg-slate-700 text-white' : 'bg-slate-100 text-slate-500'}`}>
                        <AlertCircle size={16} />
                      </div>
                      <div>
                        <p className="text-sm font-bold leading-tight">Sem Ordens de Serviço</p>
                        <p className="text-[11px] text-slate-400 font-normal">Cadastros sem serviços registrados</p>
                      </div>
                    </div>
                    {filterMode === 'no_os' && <Check size={18} className="text-slate-700 shrink-0" />}
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
                  setFilterMode('all');
                  handleUpdateLayout('medium');
                }}
                className="px-3 sm:px-4 py-2.5 rounded-2xl text-xs font-bold text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors flex items-center gap-1.5 min-h-[44px]"
              >
                <RotateCcw size={14} />
                <span>Restaurar Padrão</span>
              </button>

              <button
                type="button"
                onClick={() => setIsSortModalOpen(false)}
                className="px-5 py-2.5 rounded-2xl text-xs font-black uppercase tracking-wider bg-slate-900 text-white hover:bg-slate-800 shadow-md active:scale-95 transition-all min-h-[44px]"
              >
                Concluído
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE DIVULGAÇÃO E PROPOSTAS WHATSAPP 1-CLIQUE */}
      <CustomerBroadcastModal
        isOpen={!!broadcastCustomer}
        onClose={() => setBroadcastCustomer(null)}
        customer={broadcastCustomer ? {
          id: '',
          tenantId: tenantId,
          name: broadcastCustomer.name,
          phoneNumber: broadcastCustomer.phone,
          address: '',
          notes: '',
          createdAt: new Date().toISOString()
        } : null}
        order={broadcastCustomer?.order || null}
        settings={settings}
      />
    </div>
  );
};

export default CustomersTab;
