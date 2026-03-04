
import React, { useState, useEffect } from 'react';
import { Users, Plus, Store, ShieldCheck, LogOut, Key, Trash2, CheckCircle2, Globe, Server, Shield, Loader2, AlertCircle, X, Camera, Calendar, Clock, DollarSign, Settings2, Phone, Search, Copy, Check, KeySquare } from 'lucide-react';
import DatePicker, { registerLocale } from 'react-datepicker';
import { ptBR } from 'date-fns/locale/pt-BR';
import 'react-datepicker/dist/react-datepicker.css';

registerLocale('pt-BR', ptBR);
import { OnlineDB } from '../utils/api';

interface Props {
  onLogout: () => void;
  onLoginAs: (tenantId: string) => void;
}

const SuperAdminDashboard: React.FC<Props> = ({ onLogout, onLoginAs }) => {
  const [tenants, setTenants] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [formData, setFormData] = useState({ storeName: '', username: '', password: '', logoUrl: null as string | null, phoneNumber: '' });
  const [tenantToDelete, setTenantToDelete] = useState<{ id: string, name: string } | null>(null);
  const [tenantToEditSub, setTenantToEditSub] = useState<{ id: string, name: string, expiresAt: string, status: string, planType?: string } | null>(null);
  const [tenantToEditPrices, setTenantToEditPrices] = useState<{ id: string, name: string, monthly?: number, quarterly?: number, yearly?: number } | null>(null);
  const [tenantToEditFeatures, setTenantToEditFeatures] = useState<{ id: string; name: string; features: any; maxUsers: number; maxOS: number; maxProducts: number; printerSize: 58 | 80; retentionMonths: number; } | null>(null);
const [globalPlans, setGlobalPlans] = useState<any>({});
  const [isEditingGlobal, setIsEditingGlobal] = useState(false);
  const [newSubDate, setNewSubDate] = useState('');
  const [newPlanType, setNewPlanType] = useState<'monthly' | 'quarterly' | 'yearly'>('monthly');
  const [isCompressing, setIsCompressing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const handleChangePassword = async () => {
    if (!oldPassword || !newPassword || !confirmPassword) {
      setPasswordError("Preencha todos os campos.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("As senhas não coincidem.");
      return;
    }
    if (newPassword.length < 6) {
      setPasswordError("A nova senha deve ter pelo menos 6 caracteres.");
      return;
    }

    setIsChangingPassword(true);
    setPasswordError(null);

    try {
      const result = await OnlineDB.changeSuperPassword(oldPassword, newPassword);
      if (result.success) {
        setIsPasswordModalOpen(false);
        setOldPassword('');
        setNewPassword('');
        setConfirmPassword('');
        alert("Senha do Super Admin alterada com sucesso!");
      } else {
        setPasswordError(result.message || "Erro ao alterar senha.");
      }
    } catch (err) {
      setPasswordError("Erro de conexão.");
    } finally {
      setIsChangingPassword(false);
    }
  };

  // Corrige o problema de fuso horário ao converter string YYYY-MM-DD para Date
  const parseDate = (dateString: string) => {
    if (!dateString) return new Date();
    const [year, month, day] = dateString.split('-').map(Number);
    return new Date(year, month - 1, day);
  };


  useEffect(() => {
    loadTenants();
    loadGlobalSettings();
  }, []);

  const formatDateBR = (dateStr: string | null | undefined) => {
    if (!dateStr) return 'N/A';
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return dateStr;
      // Usando Intl para garantir o formato DD/MM/YYYY independente do ambiente
      return new Intl.DateTimeFormat('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        timeZone: 'UTC' // Força UTC para evitar problemas de fuso com datas puras
      }).format(date);
    } catch (e) {
      return dateStr;
    }
  };

  const loadGlobalSettings = async () => {
    const settings = await OnlineDB.getGlobalSettings();
    setGlobalPlans(settings);
  };

  const loadTenants = async () => {
    setIsLoading(true);
    try {
      const data = await OnlineDB.getTenants();
      // Filtra a loja de sistema para não aparecer no dashboard
      const filteredData = (data || []).filter(t => 
        t.id !== 'SYSTEM' && 
        t.id !== 'system-settings' && 
        !t.store_name?.toLowerCase().includes('system settings') &&
        !t.store_name?.toLowerCase().includes('sistem settings')
      );
      setTenants(filteredData);
    } catch (e) {
      console.error("Erro ao carregar lojas", e);
    } finally {
      setIsLoading(false);
    }
  };

  const compressImage = (base64Str: string, size: number = 500): Promise<string> => {
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

  const handleLogoUpload = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e: any) => {
      const file = e.target.files?.[0];
      if (file) {
        setIsCompressing(true);
        const reader = new FileReader();
        reader.onloadend = async () => {
          const compressed = await compressImage(reader.result as string);
          setFormData(prev => ({ ...prev, logoUrl: compressed }));
          setIsCompressing(false);
        };
        reader.readAsDataURL(file);
      }
    };
    input.click();
  };

    const handlePlanChange = (planId: string, field: string, value: any) => {
    setGlobalPlans((prev: any) => ({
      ...prev,
      [planId]: {
        ...prev[planId],
        [field]: value
      }
    }));
  };

  const handleCreateTenant = async () => {
    setErrorMsg(null);
    if (!formData.storeName || !formData.username || !formData.password) {
      return alert('Preencha todos os campos.');
    }
    
    setIsSaving(true);
    try {
      const tenantId = 'LOJA_' + Math.random().toString(36).substr(2, 5).toUpperCase();
      const result = await OnlineDB.createTenant({
        id: tenantId,
        storeName: formData.storeName,
        adminUsername: formData.username,
        adminPasswordPlain: formData.password,
        logoUrl: formData.logoUrl,
        phoneNumber: formData.phoneNumber
      });

      if (result.success) {
        setFormData({ storeName: '', username: '', password: '', logoUrl: null, phoneNumber: '' });
        setIsRegisterModalOpen(false);
        await loadTenants();
      } else {
        setErrorMsg(result.message);
      }
    } catch (e) {
      setErrorMsg("Erro na comunicação com o Supabase.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdateGlobalPlans = async () => {
    setIsSaving(true);
    const res = await OnlineDB.updateGlobalSettings(globalPlans);
    if (res.success) {
      setIsEditingGlobal(false);
    } else {
      setErrorMsg(res.message || "Erro ao salvar planos.");
    }
    setIsSaving(false);
  };

  const handleUpdateCustomPrices = async () => {
    if (!tenantToEditPrices) return;
    setIsSaving(true);
    const res = await OnlineDB.updateTenantCustomPrices(tenantToEditPrices.id, {
      monthly: tenantToEditPrices.monthly,
      quarterly: tenantToEditPrices.quarterly,
      yearly: tenantToEditPrices.yearly
    });
    if (res.success) {
      setTenantToEditPrices(null);
      await loadTenants();
    } else {
      setErrorMsg(res.message || "Erro ao salvar preços.");
    }
    setIsSaving(false);
  };

  const handleUpdateFeatures = async () => {
    if (!tenantToEditFeatures) return;
    setIsSaving(true);
    const res = await OnlineDB.updateTenantFeatures(
      tenantToEditFeatures.id, 
      tenantToEditFeatures.features, 
      tenantToEditFeatures.maxUsers,
      tenantToEditFeatures.maxOS,
      tenantToEditFeatures.maxProducts,
      tenantToEditFeatures.printerSize,
      tenantToEditFeatures.retentionMonths
    );
    if (res.success) {
      setTenantToEditFeatures(null);
      await loadTenants();
    } else {
      setErrorMsg(res.message || "Erro ao salvar permissões.");
    }
    setIsSaving(false);
  };

  const handleUpdateSubscription = async () => {
    if (!tenantToEditSub || !newSubDate) return;
    setIsSaving(true);
    try {
      // Ajusta para o final do dia selecionado para evitar expiração precoce
      const expirationDate = new Date(newSubDate + 'T23:59:59');
      const status = expirationDate < new Date() ? 'expired' : 'active';
      
      const result = await OnlineDB.setSubscriptionDate(tenantToEditSub.id, expirationDate.toISOString(), status, newPlanType);
      if (result.success) {
        setTenantToEditSub(null);
        // Pequeno delay para garantir que o Supabase processou antes de recarregar
        setTimeout(async () => {
          await loadTenants();
        }, 500);
      } else {
        setErrorMsg(result.message || "Erro ao atualizar assinatura.");
      }
    } catch (e) {
      setErrorMsg("Erro ao processar data.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteTenant = async () => {
    if (!tenantToDelete) return;
    setIsDeleting(true);
    setErrorMsg(null);
    try {
      const result = await OnlineDB.deleteTenant(tenantToDelete.id);
      if (result.success) {
        setTenantToDelete(null);
        await loadTenants();
      } else {
        setErrorMsg(result.message || "Erro ao excluir loja.");
        setTenantToDelete(null);
      }
    } catch (e: any) {
      setErrorMsg("Erro fatal ao tentar excluir.");
      setTenantToDelete(null);
    } finally {
      setIsDeleting(false);
    }
  };

  const filteredTenants = tenants.filter(t => 
    t.store_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleCopyToClipboard = (id: string) => {
    navigator.clipboard.writeText(id);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const stats = {
    active: tenants.filter(t => t.subscription_status === 'active' && new Date(t.subscription_expires_at) >= new Date()).length,
    expired: tenants.filter(t => t.subscription_status === 'expired' || new Date(t.subscription_expires_at) < new Date()).length,
    trial: tenants.filter(t => t.subscription_status === 'trial').length
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white p-4 sm:p-8 font-sans">
      <header className="max-w-6xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 mb-8 sm:mb-16">
        <div className="flex items-center gap-4 sm:gap-6">
          <div className="w-12 h-12 sm:w-16 sm:h-16 bg-blue-600 rounded-2xl sm:rounded-[2rem] flex items-center justify-center shadow-2xl shadow-blue-500/20 border border-white/10 shrink-0">
            <ShieldCheck size={24} className="sm:hidden" />
            <ShieldCheck size={32} className="hidden sm:block" />
          </div>
          <div>
            <h1 className="text-xl sm:text-3xl font-black uppercase tracking-tighter text-white leading-none">Wandev Global</h1>
            <p className="text-[8px] sm:text-[10px] font-black text-blue-400 uppercase tracking-widest flex items-center gap-2 mt-1">
               <Server size={10} className="sm:hidden" />
               <Server size={12} className="hidden sm:block" /> Cloud Supabase Ativa
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto">
          <button 
            onClick={() => setIsRegisterModalOpen(true)}
            className="flex-1 sm:flex-none px-4 sm:px-6 py-3 sm:py-4 bg-blue-600 border border-blue-500 rounded-xl sm:rounded-2xl text-white hover:bg-blue-700 transition-all flex items-center justify-center gap-2 font-black text-[8px] sm:text-[10px] uppercase tracking-widest shadow-lg shadow-blue-600/20"
          >
            <Plus size={14} className="sm:hidden" />
            <Plus size={16} className="hidden sm:block" /> Nova Loja
          </button>
          <button 
            onClick={() => setIsPasswordModalOpen(true)}
            className="flex-1 sm:flex-none px-4 sm:px-6 py-3 sm:py-4 bg-white/5 border border-white/10 rounded-xl sm:rounded-2xl text-slate-400 hover:text-white hover:bg-white/10 transition-all flex items-center justify-center gap-2 font-black text-[8px] sm:text-[10px] uppercase tracking-widest"
          >
            <Key size={14} className="sm:hidden" />
            <Key size={16} className="hidden sm:block" /> Alterar Senha
          </button>
          <button onClick={onLogout} className="px-4 sm:px-6 py-3 sm:py-4 bg-white/5 border border-white/10 rounded-xl sm:rounded-2xl text-slate-400 hover:text-white hover:bg-white/10 transition-all flex items-center justify-center gap-2 font-black text-[8px] sm:text-[10px] uppercase tracking-widest">
            Sair <LogOut size={14} className="sm:hidden" />
            <LogOut size={16} className="hidden sm:block" />
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto space-y-6">
        <div className="space-y-4 sm:space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between bg-white/5 p-4 sm:p-6 rounded-2xl sm:rounded-3xl border border-white/10 gap-4">
            <div>
               <div>
                 <h2 className="text-xs sm:text-sm font-black uppercase tracking-[0.2em] text-slate-400">Empresas Cadastradas</h2>
                 <p className="text-[8px] sm:text-[10px] font-bold text-slate-600 uppercase tracking-wider mt-0.5">
                   Mostrando {filteredTenants.length} de {tenants.length} empresas
                 </p>
               </div>
            </div>
            <div className="flex items-center justify-between sm:justify-end gap-4 w-full sm:w-auto">
              <button 
                onClick={() => setIsEditingGlobal(true)}
                className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-blue-600/10 text-blue-400 border border-blue-600/20 rounded-lg sm:rounded-xl text-[8px] sm:text-[10px] font-black uppercase tracking-widest hover:bg-blue-600 hover:text-white transition-all"
              >
                <Settings2 size={12} className="sm:hidden" />
                <Settings2 size={14} className="hidden sm:block" /> Planos Globais
              </button>
              {isLoading ? <Loader2 className="animate-spin text-blue-500" /> : (
                <>
                  <Globe className="text-blue-500 animate-pulse sm:hidden" size={24} />
                  <Globe className="text-blue-500 animate-pulse hidden sm:block" size={32} />
                </>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl sm:rounded-3xl p-4 sm:p-6">
              <h3 className="text-xs sm:text-sm font-black uppercase tracking-widest text-emerald-400">Ativas</h3>
              <p className="text-2xl sm:text-4xl font-black text-white mt-1 sm:mt-2">{stats.active}</p>
            </div>
            <div className="bg-red-500/10 border border-red-500/20 rounded-2xl sm:rounded-3xl p-4 sm:p-6">
              <h3 className="text-xs sm:text-sm font-black uppercase tracking-widest text-red-400">Expiradas</h3>
              <p className="text-2xl sm:text-4xl font-black text-white mt-1 sm:mt-2">{stats.expired}</p>
            </div>
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl sm:rounded-3xl p-4 sm:p-6">
              <h3 className="text-xs sm:text-sm font-black uppercase tracking-widest text-amber-400">Em Teste</h3>
              <p className="text-2xl sm:text-4xl font-black text-white mt-1 sm:mt-2">{stats.trial}</p>
            </div>
          </div>

          {errorMsg && (
            <div className="bg-red-500/10 border border-red-500/20 p-5 rounded-3xl flex items-center gap-3 text-red-500 text-xs font-bold uppercase animate-in slide-in-from-top-2">
              <AlertCircle size={18} />
              <span>{errorMsg}</span>
            </div>
          )}



            <div className="relative">
              <Search size={18} className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-500" />
              <input 
                type="text"
                placeholder="Buscar empresa por nome..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-14 pr-6 text-sm font-bold text-white placeholder-slate-500 outline-none focus:border-blue-500 transition-colors"
              />
            </div>

            <div className="grid gap-3 sm:gap-4">
            {filteredTenants.map(t => (
              <div key={t.id} className="bg-white/5 border border-white/5 p-4 sm:p-6 rounded-2xl sm:rounded-[2rem] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 group hover:border-blue-500/30 transition-all">
                <div className="flex items-center gap-3 sm:gap-5 w-full sm:w-auto">
                  <div className="w-10 h-10 sm:w-14 sm:h-14 bg-slate-900 rounded-xl sm:rounded-2xl flex items-center justify-center text-blue-500 border border-white/5 overflow-hidden shrink-0">
                    {t.logo_url ? <img src={t.logo_url} className="w-full h-full object-cover" /> : <Store size={20} className="sm:hidden" />}
                    {!t.logo_url && <Store size={24} className="hidden sm:block" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-black text-slate-100 uppercase text-[10px] sm:text-sm truncate">{t.store_name}</h3>
                    <div className="flex flex-wrap items-center gap-x-2 sm:gap-x-3 gap-y-1 mt-0.5 text-[7px] sm:text-[9px] font-black text-slate-500 uppercase">
                       <div className="flex items-center gap-1.5">
                         <span className="text-slate-400">ID: {t.id}</span>
                         <button onClick={() => handleCopyToClipboard(t.id)} className="text-slate-500 hover:text-white">
                           {copiedId === t.id ? <Check size={10} className="text-emerald-500" /> : <Copy size={10} />}
                         </button>
                       </div>
                       <span className="opacity-30">•</span>
                       <div className="flex items-center gap-1">
                         <Calendar size={8} className="text-blue-400 sm:hidden" />
                         <Calendar size={10} className="text-blue-400 hidden sm:block" />
                         <span>{formatDateBR(t.created_at)}</span>
                       </div>
                       <span className="opacity-30">•</span>
                       <div className="flex items-center gap-1">
                         <Clock size={8} className={`${t.subscription_expires_at && new Date(t.subscription_expires_at) < new Date() ? "text-red-500" : "text-emerald-500"} sm:hidden`} />
                         <Clock size={10} className={`${t.subscription_expires_at && new Date(t.subscription_expires_at) < new Date() ? "text-red-500" : "text-emerald-500"} hidden sm:block`} />
                         <span>{formatDateBR(t.subscription_expires_at)}</span>
                       </div>
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-between sm:justify-end gap-1.5 sm:gap-2 w-full sm:w-auto pt-3 sm:pt-0 border-t sm:border-t-0 border-white/5">
                  <div className="flex items-center gap-1.5 sm:gap-2">
                    <button 
                      onClick={() => onLoginAs(t.id)}
                      className="p-2 sm:p-2.5 bg-yellow-500/10 text-yellow-500 rounded-lg sm:rounded-xl hover:bg-yellow-500 hover:text-white transition-all active:scale-90"
                      title="Login como Admin"
                    >
                      <KeySquare size={14} className="sm:hidden" />
                      <KeySquare size={16} className="hidden sm:block" />
                    </button>
                    <button 
                      onClick={() => setTenantToEditFeatures({ 
                        id: t.id, 
                        name: t.store_name, 
                        features: t.enabled_features || {},
                        maxUsers: t.max_users || 999,
                        maxOS: t.tenant_limits?.max_os || 999,
                        maxProducts: t.tenant_limits?.max_products || 999,
                        printerSize: t.printer_size || 58,
                        retentionMonths: t.retention_months || 6
                      })}
                      className="p-2 sm:p-2.5 bg-slate-800 text-slate-400 rounded-lg sm:rounded-xl hover:bg-slate-700 hover:text-white transition-all active:scale-90"
                      title="Permissões"
                    >
                      <Settings2 size={14} className="sm:hidden" />
                      <Settings2 size={16} className="hidden sm:block" />
                    </button>
                    <button 
                      onClick={() => setTenantToEditPrices({ 
                        id: t.id, 
                        name: t.store_name, 
                        monthly: t.custom_monthly_price, 
                        quarterly: t.custom_quarterly_price, 
                        yearly: t.custom_yearly_price 
                      })}
                      className="p-2 sm:p-2.5 bg-blue-500/10 text-blue-500 rounded-lg sm:rounded-xl hover:bg-blue-500 hover:text-white transition-all active:scale-90"
                      title="Preços"
                    >
                      <DollarSign size={14} className="sm:hidden" />
                      <DollarSign size={16} className="hidden sm:block" />
                    </button>
                    <button 
                      onClick={() => {
                        setTenantToEditSub({ 
                          id: t.id, 
                          name: t.store_name, 
                          expiresAt: t.subscription_expires_at || new Date().toISOString(),
                          status: t.subscription_status || 'trial',
                          planType: t.last_plan_type
                        });
                        setNewSubDate(t.subscription_expires_at ? new Date(t.subscription_expires_at).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]);
                        setNewPlanType(t.last_plan_type || 'monthly');
                      }}
                      className={`p-2 sm:p-2.5 rounded-lg sm:rounded-xl text-[8px] font-black uppercase tracking-widest border transition-all active:scale-90 ${
                        (t.subscription_status === 'expired' || (t.subscription_expires_at && new Date(t.subscription_expires_at) < new Date()))
                        ? 'bg-red-500/10 text-red-500 border-red-500/20' 
                        : 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                      }`}
                      title="Assinatura"
                    >
                      <ShieldCheck size={14} className="sm:hidden" />
                      <ShieldCheck size={16} className="hidden sm:block" />
                    </button>
                    {t.phone_number && (
                      <a
                        href={`https://wa.me/55${t.phone_number.replace(/\D/g, '')}?text=Olá, ${t.store_name}! Temos uma novidade para você.`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 sm:p-2.5 bg-emerald-500/10 text-emerald-500 rounded-lg sm:rounded-xl hover:bg-emerald-500 hover:text-white transition-all active:scale-90"
                        title="WhatsApp"
                      >
                        <Phone size={14} className="sm:hidden" />
                        <Phone size={16} className="hidden sm:block" />
                      </a>
                    )}
                    <button 
                      onClick={() => setTenantToDelete({ id: t.id, name: t.store_name })}
                      className="p-2 sm:p-2.5 bg-red-500/10 text-red-500 rounded-lg sm:rounded-xl hover:bg-red-500 hover:text-white transition-all active:scale-90"
                      title="Excluir"
                    >
                      <Trash2 size={14} className="sm:hidden" />
                      <Trash2 size={16} className="hidden sm:block" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
            {!isLoading && tenants.length === 0 && (
               <div className="text-center py-20 bg-white/5 rounded-[2rem] border-2 border-dashed border-white/10">
                  <p className="text-slate-600 font-black uppercase text-xs">Nenhuma empresa encontrada</p>
               </div>
            )}
          </div>
        </div>
      </main>

      {isRegisterModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 z-[100] flex items-center justify-center p-4 sm:p-6 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-blue-600 w-full max-w-lg sm:max-w-xl rounded-2xl sm:rounded-[3rem] p-6 sm:p-10 space-y-6 sm:space-y-8 shadow-2xl border border-white/20 animate-in zoom-in-95 max-h-[90vh] overflow-y-auto relative">
            <button 
              onClick={() => setIsRegisterModalOpen(false)}
              className="absolute top-4 right-4 sm:top-6 sm:right-6 p-2 bg-white/10 text-white rounded-full hover:bg-white/20 transition-colors"
            >
              <X size={20} />
            </button>
            <div className="flex flex-col items-center">
              <button onClick={handleLogoUpload} className="relative group">
                <div className="w-20 h-20 sm:w-24 sm:h-24 bg-white/20 rounded-2xl sm:rounded-3xl flex items-center justify-center mb-2 shadow-inner overflow-hidden border-2 border-dashed border-white/30 group-hover:border-white transition-all">
                  {isCompressing ? <Loader2 className="animate-spin text-white" /> : formData.logoUrl ? <img src={formData.logoUrl} className="w-full h-full object-cover" /> : <Plus size={28} className="sm:hidden" />}
                  {!isCompressing && !formData.logoUrl && <Plus size={32} className="hidden sm:block" />}
                </div>
                <div className="absolute -bottom-1 -right-1 bg-white text-blue-600 p-1.5 rounded-lg shadow-lg"><Camera size={12} className="sm:hidden" /><Camera size={14} className="hidden sm:block" /></div>
              </button>
              <p className="text-[8px] sm:text-[9px] font-black uppercase tracking-widest text-blue-100 mt-2">Logotipo da Loja</p>
            </div>

            <h2 className="text-xl sm:text-2xl font-black tracking-tighter text-center uppercase text-white">Cadastrar Loja</h2>
            <div className="space-y-4 sm:space-y-5">
              <div className="space-y-1 sm:space-y-2">
                <label className="text-[8px] sm:text-[9px] font-black uppercase tracking-widest text-blue-200 ml-4">Nome da Loja</label>
                <input 
                  value={formData.storeName} 
                  onChange={e => setFormData({...formData, storeName: e.target.value})}
                  placeholder="Ex: Assistência do João" 
                  className="w-full bg-white/10 border border-white/10 rounded-xl sm:rounded-2xl p-4 sm:p-5 font-bold outline-none uppercase text-xs sm:text-sm placeholder:text-blue-200/50 text-white" 
                />
              </div>
              <div className="space-y-1 sm:space-y-2">
                <label className="text-[8px] sm:text-[9px] font-black uppercase tracking-widest text-blue-200 ml-4">Usuário para Login</label>
                <input 
                  value={formData.username} 
                  onChange={e => setFormData({...formData, username: e.target.value.toLowerCase()})}
                  placeholder="Ex: joao_adm" 
                  className="w-full bg-white/10 border border-white/10 rounded-xl sm:rounded-2xl p-4 sm:p-5 font-bold outline-none text-xs sm:text-sm placeholder:text-blue-200/50 text-white" 
                />
              </div>
              <div className="space-y-1 sm:space-y-2">
                <label className="text-[8px] sm:text-[9px] font-black uppercase tracking-widest text-blue-200 ml-4">Senha</label>
                <input 
                  type="text"
                  value={formData.password} 
                  onChange={e => setFormData({...formData, password: e.target.value})}
                  placeholder="Ex: 123456" 
                  className="w-full bg-white/10 border border-white/10 rounded-xl sm:rounded-2xl p-4 sm:p-5 font-bold outline-none text-xs sm:text-sm placeholder:text-blue-200/50 text-white" 
                />
              </div>
              <div className="space-y-1 sm:space-y-2">
                <label className="text-[8px] sm:text-[9px] font-black uppercase tracking-widest text-blue-200 ml-4">Telefone (WhatsApp)</label>
                <input 
                  value={formData.phoneNumber} 
                  onChange={e => setFormData({...formData, phoneNumber: e.target.value})}
                  placeholder="Ex: 11987654321" 
                  className="w-full bg-white/10 border border-white/10 rounded-xl sm:rounded-2xl p-4 sm:p-5 font-bold outline-none text-xs sm:text-sm placeholder:text-blue-200/50 text-white" 
                />
              </div>
            </div>
            <button 
              onClick={handleCreateTenant} 
              disabled={isSaving || isCompressing}
              className="w-full bg-white text-blue-600 py-5 sm:py-6 rounded-xl sm:rounded-[2rem] font-black uppercase text-[10px] sm:text-xs tracking-[0.2em] shadow-2xl active:scale-95 transition-all mt-2 sm:mt-4 disabled:opacity-50 flex items-center justify-center gap-3"
            >
              {isSaving ? <Loader2 className="animate-spin" size={18} /> : 'Autorizar Acesso'}
            </button>
          </div>
        </div>
      )}

      {isEditingGlobal && (
        <div className="fixed inset-0 bg-slate-950/80 z-[100] flex items-center justify-center p-4 sm:p-6 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-lg sm:max-w-2xl rounded-2xl sm:rounded-[3rem] overflow-hidden shadow-2xl animate-in zoom-in-95 border border-slate-100 flex flex-col max-h-[90vh]">
            <div className="p-6 sm:p-8 pb-4 text-center shrink-0">
              <div className="w-16 h-16 sm:w-20 sm:h-20 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto">
                <Settings2 size={32} className="sm:hidden" />
                <Settings2 size={40} className="hidden sm:block" />
              </div>
              <h3 className="font-black text-slate-800 uppercase text-base sm:text-lg mt-4">Configurações dos Planos</h3>
            </div>
            
            <div className="px-4 sm:px-8 overflow-y-auto flex-grow">
              <div className="space-y-3 sm:space-y-4">
                <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100 mb-4">
                  <h4 className="font-bold text-blue-600 uppercase text-[10px] sm:text-xs mb-3">Suporte Geral</h4>
                  <div className="space-y-1">
                    <label className="text-[8px] sm:text-[9px] font-bold text-slate-400">WhatsApp Suporte (com DDD)</label>
                    <div className="relative">
                      <Phone size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input 
                        type="text" 
                        value={globalPlans.supportPhone || ''} 
                        onChange={e => setGlobalPlans((prev: any) => ({ ...prev, supportPhone: e.target.value.replace(/\D/g, '') }))} 
                        placeholder="Ex: 11999999999" 
                        className="w-full bg-white border border-slate-200 rounded-lg p-2 pl-10 text-[10px] sm:text-xs text-slate-800 font-bold" 
                      />
                    </div>
                  </div>
                </div>

                {['trial', 'monthly', 'quarterly', 'yearly'].map(planId => {
                  const plan = globalPlans[planId as keyof typeof globalPlans] || {};
                  return (
                    <div key={planId} className="bg-slate-50 p-3 sm:p-4 rounded-xl sm:rounded-2xl border border-slate-100">
                      <h4 className="font-bold text-blue-600 uppercase text-[10px] sm:text-xs mb-2 sm:mb-3">Plano {planId === 'trial' ? 'Teste' : planId.charAt(0).toUpperCase() + planId.slice(1)}</h4>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3">
                        {planId !== 'trial' && (
                          <div className="space-y-1">
                            <label className="text-[8px] sm:text-[9px] font-bold text-slate-400">Preço (R$)</label>
                            <input type="number" value={plan.price || ''} onChange={e => handlePlanChange(planId, 'price', Number(e.target.value))} className="w-full bg-white border-slate-200 rounded-lg p-2 text-[10px] sm:text-xs text-slate-800 font-bold" />
                          </div>
                        )}
                        <div className="space-y-1">
                          <label className="text-[8px] sm:text-[9px] font-bold text-slate-400">Usuários</label>
                          <input type="number" value={plan.maxUsers || ''} onChange={e => handlePlanChange(planId, 'maxUsers', Number(e.target.value))} className="w-full bg-white border-slate-200 rounded-lg p-2 text-[10px] sm:text-xs text-slate-800 font-bold" />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[8px] sm:text-[9px] font-bold text-slate-400">O.S.</label>
                          <input type="number" value={plan.maxOS || ''} onChange={e => handlePlanChange(planId, 'maxOS', Number(e.target.value))} className="w-full bg-white border-slate-200 rounded-lg p-2 text-[10px] sm:text-xs text-slate-800 font-bold" />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[8px] sm:text-[9px] font-bold text-slate-400">Produtos</label>
                          <input type="number" value={plan.maxProducts || ''} onChange={e => handlePlanChange(planId, 'maxProducts', Number(e.target.value))} className="w-full bg-white border-slate-200 rounded-lg p-2 text-[10px] sm:text-xs text-slate-800 font-bold" />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="p-6 sm:p-8 pt-4 sm:pt-6 mt-auto shrink-0 border-t border-slate-100 bg-white">
              <div className="flex flex-col sm:flex-row-reverse gap-2 sm:gap-3">
                <button onClick={handleUpdateGlobalPlans} disabled={isSaving} className="w-full py-4 sm:py-5 bg-blue-600 text-white rounded-xl sm:rounded-2xl font-black uppercase text-[10px] sm:text-xs tracking-widest shadow-xl shadow-blue-500/20 active:scale-95 disabled:opacity-50 flex items-center justify-center gap-3">
                  {isSaving ? <Loader2 className="animate-spin" size={18} /> : 'Salvar Planos Globais'}
                </button>
                <button onClick={() => setIsEditingGlobal(false)} disabled={isSaving} className="w-full sm:w-auto sm:px-10 py-4 sm:py-5 bg-slate-100 text-slate-500 rounded-xl sm:rounded-2xl font-black uppercase text-[10px] sm:text-xs tracking-widest hover:bg-slate-200 transition-colors">
                  Fechar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {tenantToEditPrices && (
        <div className="fixed inset-0 bg-slate-950/80 z-[100] flex items-center justify-center p-4 sm:p-6 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-sm rounded-2xl sm:rounded-[3rem] overflow-hidden shadow-2xl animate-in zoom-in-95 border border-slate-100">
            <div className="p-6 sm:p-8 text-center space-y-4 sm:space-y-6">
              <div className="w-16 h-16 sm:w-20 sm:h-20 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-2">
                <DollarSign size={32} className="sm:hidden" />
                <DollarSign size={40} className="hidden sm:block" />
              </div>
              <div className="space-y-2">
                <h3 className="font-black text-slate-800 uppercase text-base sm:text-lg">Preços Customizados</h3>
                <p className="text-slate-400 text-xs font-bold uppercase leading-tight px-4">Loja: <span className="text-blue-600 font-black">{tenantToEditPrices.name}</span></p>
                <p className="text-[8px] text-blue-400 font-black uppercase tracking-widest">Estes valores serão fixos para esta loja.</p>
              </div>
              
              <div className="space-y-3 sm:space-y-4 text-left">
                <div className="space-y-1">
                  <label className="text-[8px] sm:text-[9px] font-black uppercase tracking-widest text-slate-400 ml-4">Mensal (R$)</label>
                  <input type="number" value={tenantToEditPrices.monthly || ''} onChange={e => setTenantToEditPrices({...tenantToEditPrices, monthly: e.target.value ? Number(e.target.value) : undefined})} placeholder="Usar Global" className="w-full bg-slate-50 border border-slate-100 rounded-xl sm:rounded-2xl p-4 font-bold text-slate-800 outline-none focus:border-blue-500 transition-colors text-xs sm:text-sm" />
                </div>
                <div className="space-y-1">
                  <label className="text-[8px] sm:text-[9px] font-black uppercase tracking-widest text-slate-400 ml-4">Trimestral (R$)</label>
                  <input type="number" value={tenantToEditPrices.quarterly || ''} onChange={e => setTenantToEditPrices({...tenantToEditPrices, quarterly: e.target.value ? Number(e.target.value) : undefined})} placeholder="Usar Global" className="w-full bg-slate-50 border border-slate-100 rounded-xl sm:rounded-2xl p-4 font-bold text-slate-800 outline-none focus:border-blue-500 transition-colors text-xs sm:text-sm" />
                </div>
                <div className="space-y-1">
                  <label className="text-[8px] sm:text-[9px] font-black uppercase tracking-widest text-slate-400 ml-4">Anual (R$)</label>
                  <input type="number" value={tenantToEditPrices.yearly || ''} onChange={e => setTenantToEditPrices({...tenantToEditPrices, yearly: e.target.value ? Number(e.target.value) : undefined})} placeholder="Usar Global" className="w-full bg-slate-50 border border-slate-100 rounded-xl sm:rounded-2xl p-4 font-bold text-slate-800 outline-none focus:border-blue-500 transition-colors text-xs sm:text-sm" />
                </div>
              </div>

              <div className="flex flex-col gap-2 sm:gap-3 pt-4">
                <button onClick={handleUpdateCustomPrices} disabled={isSaving} className="w-full py-4 sm:py-5 bg-blue-600 text-white rounded-xl sm:rounded-2xl font-black uppercase text-[10px] sm:text-xs tracking-widest shadow-xl shadow-blue-500/20 active:scale-95 disabled:opacity-50 flex items-center justify-center gap-3">
                  {isSaving ? <Loader2 className="animate-spin" size={18} /> : 'Fixar Preços'}
                </button>
                <button onClick={() => setTenantToEditPrices(null)} disabled={isSaving} className="w-full py-4 sm:py-5 bg-slate-100 text-slate-500 rounded-xl sm:rounded-2xl font-black uppercase text-[10px] sm:text-xs tracking-widest hover:bg-slate-200 transition-colors">
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {tenantToEditSub && (
        <div className="fixed inset-0 bg-slate-950/80 z-[100] flex items-center justify-center p-4 sm:p-6 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-sm rounded-2xl sm:rounded-[3rem] overflow-hidden shadow-2xl animate-in zoom-in-95 border border-slate-100">
            <div className="p-6 sm:p-8 text-center space-y-4 sm:space-y-6">
              <div className="w-16 h-16 sm:w-20 sm:h-20 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-2">
                <Calendar size={32} className="sm:hidden" />
                <Calendar size={40} className="hidden sm:block" />
              </div>
              <div className="space-y-2">
                <h3 className="font-black text-slate-800 uppercase text-base sm:text-lg">Gerenciar Assinatura</h3>
                <p className="text-slate-400 text-xs font-bold uppercase leading-tight px-4">
                  Loja: <span className="text-blue-600 font-black">{tenantToEditSub.name}</span>
                </p>
              </div>
              
              <div className="space-y-3 sm:space-y-4 text-left">
                  <div className="space-y-1">
                    <label className="text-[8px] sm:text-[9px] font-black uppercase tracking-widest text-slate-400 ml-4">Expiração Atual</label>
                    <input 
                      type="text" 
                      value={formatDateBR(tenantToEditSub.expiresAt)} 
                      disabled 
                      className="w-full bg-slate-100 border-slate-200 rounded-xl sm:rounded-2xl p-4 font-black text-slate-500 text-xs sm:text-sm cursor-not-allowed"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[8px] sm:text-[9px] font-black uppercase tracking-widest text-slate-400 ml-4">Nova Data de Expiração</label>
                    <DatePicker
                      selected={parseDate(newSubDate)}
                      onChange={(date: Date) => setNewSubDate(date.toISOString().split('T')[0])}
                      dateFormat="dd/MM/yyyy"
                      locale="pt-BR"
                      className="w-full bg-slate-50 border border-slate-100 rounded-xl sm:rounded-2xl p-4 font-bold text-slate-800 outline-none focus:border-blue-500 transition-colors text-xs sm:text-sm"
                    />
                  </div>
                <div className="space-y-1">
                  <label className="text-[8px] sm:text-[9px] font-black uppercase tracking-widest text-slate-400 ml-4">Tipo de Plano</label>
                  <select 
                    value={newPlanType}
                    onChange={e => setNewPlanType(e.target.value as any)}
                    className="w-full bg-slate-50 border border-slate-100 rounded-xl sm:rounded-2xl p-4 font-bold text-slate-800 outline-none focus:border-blue-500 transition-colors text-xs sm:text-sm"
                  >
                    <option value="monthly">Mensal</option>
                    <option value="quarterly">Trimestral</option>
                    <option value="yearly">Anual</option>
                  </select>
                </div>
              </div>

              <div className="flex flex-col gap-2 sm:gap-3 pt-4">
                <button 
                  onClick={handleUpdateSubscription} 
                  disabled={isSaving}
                  className="w-full py-4 sm:py-5 bg-blue-600 text-white rounded-xl sm:rounded-2xl font-black uppercase text-[10px] sm:text-xs tracking-widest shadow-xl shadow-blue-500/20 active:scale-95 disabled:opacity-50 flex items-center justify-center gap-3"
                >
                  {isSaving ? <Loader2 className="animate-spin" size={18} /> : 'Salvar Alteração'}
                </button>
                <button 
                  onClick={() => setTenantToEditSub(null)} 
                  disabled={isSaving}
                  className="w-full py-4 sm:py-5 bg-slate-100 text-slate-500 rounded-xl sm:rounded-2xl font-black uppercase text-[10px] sm:text-xs tracking-widest hover:bg-slate-200 transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {tenantToEditFeatures && (
        <div className="fixed inset-0 bg-slate-950/80 z-[200] flex justify-end backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white w-full sm:max-w-md h-full flex flex-col shadow-2xl animate-in slide-in-from-right-full duration-300">
            <div className="p-5 sm:p-6 border-b border-slate-100 flex items-center justify-between shrink-0 bg-slate-50">
              <div>
                <h3 className="font-black text-slate-800 uppercase text-sm sm:text-base">Recursos da Loja</h3>
                <p className="text-slate-400 text-[10px] sm:text-xs font-bold uppercase">{tenantToEditFeatures.name}</p>
              </div>
              <button onClick={() => setTenantToEditFeatures(null)} className="p-2 sm:p-3 bg-slate-200 rounded-full text-slate-500 hover:bg-slate-300 transition-colors">
                <X size={16} />
              </button>
            </div>

            <div className="p-5 sm:p-6 space-y-4 overflow-y-auto flex-grow">
              <div className="grid grid-cols-2 gap-3 sm:gap-4">
                <div className="space-y-1 sm:space-y-2 text-left">
                  <label className="text-[8px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Limite de O.S.</label>
                  <input 
                    type="number" 
                    value={tenantToEditFeatures.maxOS} 
                    onChange={e => setTenantToEditFeatures({ ...tenantToEditFeatures, maxOS: parseInt(e.target.value) || 1 })}
                    className="w-full bg-slate-50 border border-slate-100 rounded-xl sm:rounded-2xl p-3 sm:p-4 font-bold text-slate-800 outline-none focus:border-blue-500 transition-colors text-xs sm:text-sm"
                  />
                </div>
                <div className="space-y-1 sm:space-y-2 text-left">
                  <label className="text-[8px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Limite de Produtos</label>
                  <input 
                    type="number" 
                    value={tenantToEditFeatures.maxProducts} 
                    onChange={e => setTenantToEditFeatures({ ...tenantToEditFeatures, maxProducts: parseInt(e.target.value) || 1 })}
                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 font-bold text-slate-800 outline-none focus:border-blue-500 transition-colors text-sm"
                  />
                </div>
              </div>

              <div className="space-y-2 text-left">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Tamanho da Impressora</label>
                  <select 
                    value={tenantToEditFeatures.printerSize} 
                    onChange={e => setTenantToEditFeatures({ ...tenantToEditFeatures, printerSize: parseInt(e.target.value) as 58 | 80 })}
                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 font-bold text-slate-800 outline-none focus:border-blue-500 transition-colors text-sm"
                  >
                    <option value={58}>58mm (Padrão)</option>
                    <option value={80}>80mm (Larga)</option>
                  </select>
              </div>

              <div className="space-y-2 text-left">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Retenção de Dados (Meses)</label>
                  <input 
                    type="number" 
                    value={tenantToEditFeatures.retentionMonths} 
                    onChange={e => setTenantToEditFeatures({ ...tenantToEditFeatures, retentionMonths: parseInt(e.target.value) || 6 })}
                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 font-bold text-slate-800 outline-none focus:border-blue-500 transition-colors text-sm"
                  />
              </div>

              <div className="space-y-3 text-left pt-2">
                  {[
                    { id: 'osTab', label: 'Aba Ordem de Serviço' },
                    { id: 'stockTab', label: 'Aba Estoque' },
                    { id: 'salesTab', label: 'Aba Vendas' },
                    { id: 'financeTab', label: 'Aba Financeira' },
                    { id: 'hideFinancialReports', label: 'Ocultar Botão Relatórios' },
                    { id: 'profiles', label: 'Criar Perfis/Usuários' },
                    { id: 'xmlExportImport', label: 'Exportar/Importar XML' },
                    { id: 'promoBanner', label: 'Exibir Banner Promocional' },
                  ].map(feature => (
                    <label key={feature.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl cursor-pointer hover:bg-slate-100 transition-colors">
                      <span className="text-xs font-black uppercase tracking-tight text-slate-700">{feature.label}</span>
                      <input 
                        type="checkbox" 
                        checked={!!tenantToEditFeatures.features[feature.id]} 
                        onChange={e => setTenantToEditFeatures({
                          ...tenantToEditFeatures,
                          features: { ...tenantToEditFeatures.features, [feature.id]: e.target.checked }
                        })}
                        className="w-5 h-5 rounded-lg border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                    </label>
                  ))}
                </div>

              <div className="space-y-2 text-left pt-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Limite de Usuários Ativos</label>
                <div className="flex items-center gap-3">
                  <input 
                    type="number" 
                    value={tenantToEditFeatures.maxUsers} 
                    onChange={e => setTenantToEditFeatures({ ...tenantToEditFeatures, maxUsers: parseInt(e.target.value) || 1 })}
                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 font-bold text-slate-800 outline-none focus:border-blue-500 transition-colors text-sm"
                  />
                </div>
                <div className="grid grid-cols-3 gap-2 pt-2">
                  <button onClick={() => setTenantToEditFeatures({ ...tenantToEditFeatures, maxUsers: 2, maxOS: 50, maxProducts: 50 })} className="px-3 py-2 bg-blue-50 text-blue-600 rounded-lg text-[8px] font-black uppercase">Start</button>
                  <button onClick={() => setTenantToEditFeatures({ ...tenantToEditFeatures, maxUsers: 5, maxOS: 200, maxProducts: 200 })} className="px-3 py-2 bg-blue-50 text-blue-600 rounded-lg text-[8px] font-black uppercase">Pro</button>
                  <button onClick={() => setTenantToEditFeatures({ ...tenantToEditFeatures, maxUsers: 999, maxOS: 999, maxProducts: 999 })} className="px-3 py-2 bg-slate-100 text-slate-600 rounded-lg text-[8px] font-black uppercase">Ilimitado</button>
                </div>
                <p className="text-[8px] text-slate-400 ml-4 pt-1">No Plano Start o limite é 2 (Admin + 1 Funcionário)</p>
              </div>
            </div>

            <div className="p-6 border-t border-slate-100 bg-white shrink-0">
              <button onClick={handleUpdateFeatures} disabled={isSaving} className="w-full py-5 bg-blue-600 text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl shadow-blue-500/20 active:scale-95 disabled:opacity-50 flex items-center justify-center gap-3">
                {isSaving ? <Loader2 className="animate-spin" size={18} /> : 'Salvar Permissões'}
              </button>
            </div>
          </div>
        </div>
      )}

      {tenantToDelete && (
        <div className="fixed inset-0 bg-slate-950/80 z-[100] flex items-center justify-center p-4 sm:p-6 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-sm rounded-2xl sm:rounded-[3rem] overflow-hidden shadow-2xl animate-in zoom-in-95 border border-slate-100">
            <div className="p-6 sm:p-8 text-center space-y-4 sm:space-y-6">
              <div className="w-16 h-16 sm:w-20 sm:h-20 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-2">
                <Trash2 size={32} className="sm:hidden" />
                <Trash2 size={40} className="hidden sm:block" />
              </div>
              <div className="space-y-2">
                <h3 className="font-black text-slate-800 uppercase text-base sm:text-lg">Excluir Loja?</h3>
                <p className="text-slate-400 text-xs sm:text-sm font-bold uppercase leading-tight px-4">
                  Deseja realmente apagar a loja <span className="text-red-600 font-black">"{tenantToDelete.name}"</span>?
                </p>
                <p className="text-[8px] sm:text-[10px] text-red-400 font-black uppercase tracking-widest animate-pulse mt-4">
                  Isso apagará todos os usuários, OS e estoque vinculados!
                </p>
              </div>
              <div className="flex flex-col gap-2 sm:gap-3 pt-4">
                <button 
                  onClick={handleDeleteTenant} 
                  disabled={isDeleting}
                  className="w-full py-4 sm:py-5 bg-red-600 text-white rounded-xl sm:rounded-2xl font-black uppercase text-[10px] sm:text-xs tracking-widest shadow-xl shadow-red-500/20 active:scale-95 disabled:opacity-50 flex items-center justify-center gap-3"
                >
                  {isDeleting ? <Loader2 className="animate-spin" size={18} /> : 'Confirmar Exclusão'}
                </button>
                <button 
                  onClick={() => setTenantToDelete(null)} 
                  disabled={isDeleting}
                  className="w-full py-4 sm:py-5 bg-slate-100 text-slate-500 rounded-xl sm:rounded-2xl font-black uppercase text-[10px] sm:text-xs tracking-widest hover:bg-slate-200 transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {isPasswordModalOpen && (
        <div className="fixed inset-0 bg-slate-950/90 z-[300] flex items-center justify-center p-4 sm:p-6 backdrop-blur-xl animate-in fade-in">
          <div className="bg-white w-full max-w-xs rounded-2xl sm:rounded-[3rem] p-6 sm:p-8 shadow-2xl animate-in zoom-in-95 border border-slate-100">
            <div className="w-12 h-12 sm:w-16 sm:h-16 bg-blue-50 text-blue-600 rounded-xl sm:rounded-2xl flex items-center justify-center mx-auto mb-4 sm:mb-6 shadow-inner">
              <Shield size={24} className="sm:hidden" />
              <Shield size={32} className="hidden sm:block" />
            </div>
            <h3 className="text-center font-black text-slate-800 uppercase text-xs sm:text-sm mb-1">Senha Super Admin</h3>
            <p className="text-center text-[8px] sm:text-[9px] text-slate-400 font-bold uppercase tracking-widest mb-6 sm:mb-8 leading-tight">Altere a senha de acesso<br/>global do sistema</p>
            
            <div className="space-y-2 sm:space-y-3">
              <div className="space-y-1">
                <label className="text-[8px] sm:text-[9px] font-black text-slate-400 uppercase tracking-widest ml-4">Senha Atual</label>
                <div className="flex items-center gap-2 sm:gap-3 bg-slate-50 border border-slate-100 rounded-xl sm:rounded-2xl px-4 sm:px-5 py-3 sm:py-4 focus-within:border-blue-500 transition-all">
                  <KeySquare size={16} className="text-slate-300 sm:hidden" />
                  <KeySquare size={18} className="text-slate-300 hidden sm:block" />
                  <input 
                    type="password" 
                    value={oldPassword}
                    onChange={(e) => setOldPassword(e.target.value)}
                    placeholder="SENHA ATUAL"
                    className="bg-transparent w-full outline-none font-black text-[10px] sm:text-xs uppercase placeholder:text-slate-200 text-slate-800"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[8px] sm:text-[9px] font-black text-slate-400 uppercase tracking-widest ml-4">Nova Senha</label>
                <div className="flex items-center gap-2 sm:gap-3 bg-slate-50 border border-slate-100 rounded-xl sm:rounded-2xl px-4 sm:px-5 py-3 sm:py-4 focus-within:border-blue-500 transition-all">
                  <Shield size={16} className="text-slate-300 sm:hidden" />
                  <Shield size={18} className="text-slate-300 hidden sm:block" />
                  <input 
                    type="password" 
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="NOVA SENHA"
                    className="bg-transparent w-full outline-none font-black text-[10px] sm:text-xs uppercase placeholder:text-slate-200 text-slate-800"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[8px] sm:text-[9px] font-black text-slate-400 uppercase tracking-widest ml-4">Confirmar Nova Senha</label>
                <div className="flex items-center gap-2 sm:gap-3 bg-slate-50 border border-slate-100 rounded-xl sm:rounded-2xl px-4 sm:px-5 py-3 sm:py-4 focus-within:border-blue-500 transition-all">
                  <Check size={16} className="text-slate-300 sm:hidden" />
                  <Check size={18} className="text-slate-300 hidden sm:block" />
                  <input 
                    type="password" 
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="REPETIR SENHA"
                    className="bg-transparent w-full outline-none font-black text-[10px] sm:text-xs uppercase placeholder:text-slate-200 text-slate-800"
                  />
                </div>
              </div>
            </div>
            
            {passwordError && <p className="text-center text-[8px] sm:text-[9px] font-black text-red-500 uppercase mt-4 animate-bounce">{passwordError}</p>}

            <div className="flex flex-col gap-2 mt-6 sm:mt-8">
              <button 
                onClick={handleChangePassword} 
                disabled={isChangingPassword} 
                className="w-full py-4 sm:py-5 bg-blue-600 text-white rounded-xl sm:rounded-2xl font-black uppercase text-[9px] sm:text-[10px] tracking-widest shadow-xl shadow-blue-500/20 active:scale-95 transition-all flex items-center justify-center disabled:opacity-50"
              >
                {isChangingPassword ? <Loader2 size={18} className="animate-spin" /> : 'Atualizar Senha Global'}
              </button>
              <button 
                onClick={() => { setIsPasswordModalOpen(false); setOldPassword(''); setNewPassword(''); setConfirmPassword(''); setPasswordError(null); }} 
                className="w-full py-3 sm:py-4 text-slate-400 font-black uppercase text-[9px] sm:text-[10px] tracking-widest"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SuperAdminDashboard;
