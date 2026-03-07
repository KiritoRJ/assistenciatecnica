
import React, { useState, useMemo, useEffect } from 'react';
import { Image as ImageIcon, Camera, FileText, Palette, MoveHorizontal, MoreVertical, ArrowLeft, Check, Layout, Pipette, X, AlertCircle, Users, Shield, UserPlus, Trash2, User as UserIcon, Loader2, Lock, MapPin, Phone, KeyRound, Briefcase, Smartphone, Download, Upload, LogOut, Bell, Package, DollarSign, Percent, Save, Edit2 } from 'lucide-react';
import { AppSettings, User, ServiceOrder, Product, Sale, Transaction, Employee } from '../types';
import { OnlineDB } from '../utils/api';
import { OfflineSync } from '../utils/offlineSync';
import { db } from '../utils/localDb';
import CatalogManager from './CatalogManager';

interface Props {
  products: Product[];
  setProducts: (products: Product[]) => void;
  settings: AppSettings;
  setSettings: (settings: AppSettings) => void;
  isCloudConnected?: boolean;
  currentUser: User;
  onSwitchProfile: (user: User) => void;
  tenantId?: string; 
  deferredPrompt?: any;
  onInstallApp?: () => void;
  subscriptionStatus?: string;
  subscriptionExpiresAt?: string;
  lastPlanType?: 'monthly' | 'quarterly' | 'yearly';
  enabledFeatures?: {
    osTab: boolean;
    stockTab: boolean;
    salesTab: boolean;
    financeTab: boolean;
    profiles: boolean;
    xmlExportImport: boolean;
    hideFinancialReports?: boolean;
  };
  maxUsers?: number;
  maxOS?: number;
  maxProducts?: number;
  onLogout?: () => void;
}

const SettingsTab: React.FC<Props> = ({ products, setProducts, settings, setSettings, isCloudConnected = true, currentUser, onSwitchProfile, tenantId, deferredPrompt, onInstallApp, subscriptionStatus, subscriptionExpiresAt, lastPlanType, enabledFeatures, maxUsers, maxOS, maxProducts, onLogout }) => {
  const isAdmin = useMemo(() => currentUser.role === 'admin' || (currentUser as any).role === 'super', [currentUser]);
  const getPlanName = () => {
    if (subscriptionStatus === 'trial') return 'Período de Teste';
    switch (lastPlanType) {
      case 'monthly': return 'Plano Mensal';
      case 'quarterly': return 'Plano Trimestral';
      case 'yearly': return 'Plano Anual';
      default: return 'Assinatura Ativa';
    }
  };

  const [view, setView] = useState<'main' | 'print' | 'theme' | 'users' | 'backup' | 'catalog' | 'notifications' | 'subscription'>('main');
  const [showMenu, setShowMenu] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [supportPhone, setSupportPhone] = useState('5511999999999');

  useEffect(() => {
    const loadSupportPhone = async () => {
      try {
        const globalSettings = await OnlineDB.getGlobalSettings();
        if (globalSettings?.supportPhone) {
          setSupportPhone(globalSettings.supportPhone);
        }
      } catch (e) {
        console.error("Erro ao carregar telefone de suporte:", e);
      }
    };
    loadSupportPhone();
  }, []);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authPassword, setAuthPassword] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [authError, setAuthError] = useState(false);
  const [pendingUserToSwitch, setPendingUserToSwitch] = useState<User | null>(null);

  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [newUserName, setNewUserName] = useState('');
  const [newUserPhoto, setNewUserPhoto] = useState<string | null>(null);
  const [newUserSpecialty, setNewUserSpecialty] = useState<'Vendedor' | 'Técnico' | 'Outros'>('Técnico');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [isEditingUser, setIsEditingUser] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [employeeFormData, setEmployeeFormData] = useState<Partial<Employee>>({
    role: 'vendedor',
    status: 'active',
    commissionType: 'sales_percent',
    permissions: { open_os: true, sell: true, view_finance: false, edit_price: false, cancel_sale: false }
  });

  useEffect(() => {
    if (view === 'users' && tenantId) {
      OnlineDB.fetchEmployees(tenantId).then(setEmployees);
    }
  }, [view, tenantId]);

  const [userToDelete, setUserToDelete] = useState<{ id: string, name: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isCompressing, setIsCompressing] = useState(false);

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
      const result = await OnlineDB.changePassword(tenantId!, oldPassword, newPassword);
      if (result.success) {
        setIsPasswordModalOpen(false);
        setOldPassword('');
        setNewPassword('');
        setConfirmPassword('');
        triggerSaveFeedback("Senha Alterada!");
      } else {
        setPasswordError(result.message || "Erro ao alterar senha.");
      }
    } catch (err) {
      setPasswordError("Erro de conexão.");
    } finally {
      setIsChangingPassword(false);
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
        resolve(canvas.toDataURL('image/webp', 0.7));
      };
    });
  };

  const triggerSaveFeedback = (msg: string = "Sincronizado!") => {
    setIsSaving(true);
    setSaveMessage(msg);
    setTimeout(() => {
      setIsSaving(false);
      setSaveMessage(null);
    }, 2000);
  };

  const updateSetting = async (key: keyof AppSettings, value: any) => {
    if (!isAdmin) return;
    const updated = { ...settings, [key]: value };
    setSettings(updated);
    triggerSaveFeedback();
  };

  const handleSwitchAttempt = (user: User) => {
    if (user.id === currentUser.id) return;

    if (user.role === 'admin') {
      setPendingUserToSwitch(user);
      setIsAuthModalOpen(true);
    } else {
      if (isAdmin) {
        onSwitchProfile(user);
      } else {
        setPendingUserToSwitch(user);
        setIsAuthModalOpen(true);
      }
    }
  };

  const verifyAdminPassword = async () => {
    if (isVerifying) return;
    setIsVerifying(true);
    setAuthError(false);
    
    if (!tenantId) {
        setAuthError(true);
        setIsVerifying(false);
        return;
    }

    const result = await OnlineDB.verifyAdminPassword(tenantId, authPassword);
    
    if (result.success) {
      if (pendingUserToSwitch) {
        onSwitchProfile(pendingUserToSwitch);
      }
      setIsAuthModalOpen(false);
      setAuthPassword('');
      setPendingUserToSwitch(null);
    } else {
      setAuthError(true);
      setAuthPassword('');
      setTimeout(() => setAuthError(false), 2000);
    }

    setIsVerifying(false);
  };

  const triggerUserPhotoUpload = () => {
    if (!isAdmin) return;
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '*/*';
    input.onchange = (e: any) => {
      const file = e.target.files?.[0];
      if (file) {
        // Validação: Apenas imagens
        if (!file.type.startsWith('image/')) {
          alert(`O arquivo "${file.name}" não é uma imagem e foi ignorado.`);
          input.value = '';
          return;
        }

        setIsCompressing(true);
        const reader = new FileReader();
        reader.onloadend = async () => {
          try {
            const compressed = await compressImage(reader.result as string, 400);
            setNewUserPhoto(compressed);
          } catch (err) {
            console.error("Erro ao processar imagem", err);
          } finally {
            setIsCompressing(false);
            input.value = '';
          }
        };
        reader.readAsDataURL(file);
      }
    };
    input.click();
  };

  const triggerUpload = () => {
    if (!isAdmin) return;
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '*/*';
    input.onchange = (e: any) => {
      const file = e.target.files?.[0];
      if (file) {
        // Validação: Apenas imagens
        if (!file.type.startsWith('image/')) {
          alert(`O arquivo "${file.name}" não é uma imagem e foi ignorado.`);
          input.value = '';
          return;
        }

        setIsCompressing(true);
        const reader = new FileReader();
        reader.onloadend = async () => {
          try {
            const compressed = await compressImage(reader.result as string, 600);
            updateSetting('logoUrl', compressed);
          } catch (err) {
            console.error("Erro ao processar imagem", err);
          } finally {
            setIsCompressing(false);
            input.value = '';
          }
        };
        reader.readAsDataURL(file);
      }
    };
    input.click();
  };

  const handleCreateUser = async () => {
    if (!isAdmin) return;
    if (!newUserName) return alert('O nome é obrigatório.');
    if (!tenantId) return alert('Erro interno: Tenant ID não encontrado.');

    // Verificar limite de usuários (apenas se for novo)
    if (!isEditingUser) {
      const activeProfiles = settings.users?.length || 0;
      const limit = maxUsers || 999;
      if (activeProfiles >= limit) {
        alert(`Limite de usuários atingido (${limit}). Seu plano atual permite apenas ${limit} usuários ativos.`);
        return;
      }
    }
    
    setIsSaving(true);
    const userId = isEditingUser ? editingUserId! : 'USR_' + Math.random().toString(36).substr(2, 6).toUpperCase();
    
    const newUser: User = {
      id: userId,
      name: newUserName,
      role: 'colaborador',
      password: newUserPassword || undefined,
      photo: newUserPhoto,
      specialty: newUserSpecialty,
      tenantId: tenantId
    };

    try {
      const res = await OnlineDB.upsertUser(tenantId, settings.storeName, newUser);
      
      if (res.success) {
        const newUserWithUsername = { ...newUser, username: res.username };
        
        // Upsert Employee
        const employeeData: Partial<Employee> = {
          ...employeeFormData,
          id: isEditingUser ? employees.find(e => e.userId === userId)?.id : undefined,
          userId: userId,
          name: newUserName,
          photoUrl: newUserPhoto || undefined,
          tenantId: tenantId as any
        };
        const empRes = await OnlineDB.upsertEmployee(tenantId, employeeData);
        if (!empRes.success) throw new Error(empRes.message);

        let updatedUsers = [...settings.users];
        if (isEditingUser) {
          updatedUsers = updatedUsers.map(u => u.id === userId ? newUserWithUsername : u);
        } else {
          updatedUsers.push(newUserWithUsername);
        }
        
        setSettings({ ...settings, users: updatedUsers });
        await OfflineSync.saveUser(tenantId, newUserWithUsername);
        
        // Refresh employees list
        const updatedEmps = await OnlineDB.fetchEmployees(tenantId);
        setEmployees(updatedEmps);

        setIsUserModalOpen(false);
        setNewUserName('');
        setNewUserPhoto(null);
        setNewUserSpecialty('Técnico');
        setNewUserPassword('');
        setIsEditingUser(false);
        setEditingUserId(null);
        setEmployeeFormData({
          role: 'vendedor',
          status: 'active',
          commissionType: 'sales_percent',
          permissions: { open_os: true, sell: true, view_finance: false, edit_price: false, cancel_sale: false }
        });
        triggerSaveFeedback(isEditingUser ? "Perfil Atualizado!" : "Perfil Criado!");
      } else {
        alert("Erro no Banco: " + res.message);
      }
    } catch (e: any) {
      alert("Erro fatal ao salvar: " + e.message);
    } finally {
      setIsSaving(false);
    }
  };

  const openEditUserModal = (user: User) => {
    const emp = employees.find(e => e.userId === user.id);
    setIsEditingUser(true);
    setEditingUserId(user.id);
    setNewUserName(user.name);
    setNewUserPhoto(user.photo);
    setNewUserSpecialty(user.specialty || 'Técnico');
    setNewUserPassword('');
    
    if (emp) {
      setEmployeeFormData(emp);
    } else {
      setEmployeeFormData({
        role: 'vendedor',
        status: 'active',
        commissionType: 'sales_percent',
        permissions: { open_os: true, sell: true, view_finance: false, edit_price: false, cancel_sale: false }
      });
    }
    setIsUserModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!userToDelete) return;
    if (!isAdmin) return;
    setIsDeleting(true);
    try {
      const result = await OnlineDB.deleteRemoteUser(userToDelete.id);
      if (result.success) {
        const updatedUsers = settings.users.filter(u => u.id !== userToDelete.id);
        setSettings({ ...settings, users: updatedUsers });
        await OfflineSync.deleteUser(tenantId, userToDelete.id);
        setUserToDelete(null);
        triggerSaveFeedback("Perfil Removido!");
      } else {
        alert(`Falha ao remover: ${result.message}`);
      }
    } catch (err: any) {
      alert("Erro de conexão com o banco.");
    } finally {
      setIsDeleting(false);
    }
  };

  const exportToXML = async () => {
    if (!tenantId) return;
    setIsExporting(true);
    try {
      const data = await OfflineSync.getLocalData(tenantId);
      
      let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
      xml += '<AssistenciaProBackup>\n';
      
      // Export Orders
      xml += '  <ServiceOrders>\n';
      data.orders.forEach((o: ServiceOrder) => {
        xml += '    <Order>\n';
        Object.entries(o).forEach(([key, value]) => {
          if (Array.isArray(value)) {
            xml += `      <${key}>\n`;
            value.forEach(item => xml += `        <Item>${item}</Item>\n`);
            xml += `      </${key}>\n`;
          } else {
            xml += `      <${key}>${value}</${key}>\n`;
          }
        });
        xml += '    </Order>\n';
      });
      xml += '  </ServiceOrders>\n';

      // Export Products
      xml += '  <Products>\n';
      data.products.forEach((p: Product) => {
        xml += '    <Product>\n';
        Object.entries(p).forEach(([key, value]) => {
          xml += `      <${key}>${value}</${key}>\n`;
        });
        xml += '    </Product>\n';
      });
      xml += '  </Products>\n';

      // Export Sales
      xml += '  <Sales>\n';
      data.sales.forEach((s: Sale) => {
        xml += '    <Sale>\n';
        Object.entries(s).forEach(([key, value]) => {
          xml += `      <${key}>${value}</${key}>\n`;
        });
        xml += '    </Sale>\n';
      });
      xml += '  </Sales>\n';

      // Export Transactions
      xml += '  <Transactions>\n';
      data.transactions.forEach((t: Transaction) => {
        xml += '    <Transaction>\n';
        Object.entries(t).forEach(([key, value]) => {
          xml += `      <${key}>${value}</${key}>\n`;
        });
        xml += '    </Transaction>\n';
      });
      xml += '  </Transactions>\n';

      xml += '</AssistenciaProBackup>';

      const blob = new Blob([xml], { type: 'application/xml' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `backup_assistencia_pro_${new Date().toISOString().split('T')[0]}.xml`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      triggerSaveFeedback("XML Exportado!");
    } catch (err) {
      alert("Erro ao exportar backup.");
    } finally {
      setIsExporting(false);
    }
  };

  const importFromXML = () => {
    if (!tenantId) return;
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.xml';
    input.onchange = async (e: any) => {
      const file = e.target.files?.[0];
      if (!file) return;
      
      setIsImporting(true);
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const xmlText = event.target?.result as string;
          const parser = new DOMParser();
          const xmlDoc = parser.parseFromString(xmlText, "text/xml");
          
          const parseNode = (node: Element) => {
            const obj: any = {};
            Array.from(node.children).forEach(child => {
              if (child.children.length > 0) {
                obj[child.tagName] = Array.from(child.children).map(c => c.textContent);
              } else {
                const val = child.textContent;
                // Basic type conversion
                if (val === 'true') obj[child.tagName] = true;
                else if (val === 'false') obj[child.tagName] = false;
                else if (!isNaN(Number(val)) && val !== '') obj[child.tagName] = Number(val);
                else obj[child.tagName] = val;
              }
            });
            return obj;
          };

          const orders = Array.from(xmlDoc.getElementsByTagName('Order')).map(parseNode);
          const products = Array.from(xmlDoc.getElementsByTagName('Product')).map(parseNode);
          const sales = Array.from(xmlDoc.getElementsByTagName('Sale')).map(parseNode);
          const transactions = Array.from(xmlDoc.getElementsByTagName('Transaction')).map(parseNode);

          if (confirm(`Deseja importar ${orders.length} OS, ${products.length} Produtos, ${sales.length} Vendas e ${transactions.length} Transações? Isso substituirá dados locais com IDs conflitantes.`)) {
            // Bulk save to local DB and sync queue
            for (const o of orders) await OfflineSync.saveOrder(tenantId, o);
            for (const p of products) await OfflineSync.saveProduct(tenantId, p);
            for (const s of sales) await OfflineSync.saveSale(tenantId, s);
            for (const t of transactions) await OfflineSync.saveTransaction(tenantId, t);
            
            triggerSaveFeedback("Backup Importado!");
            setTimeout(() => window.location.reload(), 1500);
          }
        } catch (err) {
          alert("Erro ao processar arquivo XML. Verifique o formato.");
        } finally {
          setIsImporting(false);
        }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  if (view === 'users') {
    return (
      <div className="space-y-6 animate-in slide-in-from-right-10 duration-500 pb-24 h-full">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <button onClick={() => setView('main')} className="p-3 bg-white shadow-sm border border-slate-100 rounded-2xl text-slate-600 active:scale-90 transition-all">
              <ArrowLeft size={24} />
            </button>
            <h2 className="text-2xl font-black text-slate-800 tracking-tight uppercase">{isAdmin ? 'Equipe da Loja' : 'Trocar de Perfil'}</h2>
          </div>
          {isAdmin && (
            <button onClick={() => setIsUserModalOpen(true)} className="p-3 bg-slate-900 text-white rounded-2xl shadow-xl active:scale-90 transition-all">
              <UserPlus size={24} />
            </button>
          )}
        </div>

        <div className="space-y-3">
          {settings.users.map(user => {
            const emp = employees.find(e => e.userId === user.id);
            return (
              <div 
                key={user.id} 
                className={`p-5 rounded-[2.5rem] border transition-all relative flex items-center justify-between shadow-sm overflow-hidden ${user.id === currentUser.id ? 'bg-white border-blue-500 ring-4 ring-blue-50' : 'bg-[#f1f1f1] border-transparent hover:bg-white hover:border-blue-200'}`}
              >
                <div className="flex items-center gap-5">
                  <div className="relative shrink-0">
                    {user.photo ? (
                      <img src={user.photo} className="w-14 h-14 rounded-3xl object-cover border-2 border-white shadow-sm" />
                    ) : (
                      <div className="w-14 h-14 bg-slate-200 text-slate-400 rounded-3xl flex items-center justify-center border-2 border-white">
                        <UserIcon size={24} />
                      </div>
                    )}
                    {user.role === 'admin' && (
                      <div className="absolute -bottom-1 -right-1 bg-blue-600 text-white p-1 rounded-lg border-2 border-white shadow-sm">
                        <Shield size={10} />
                      </div>
                    )}
                  </div>
                  <div>
                    <h3 className={`font-black uppercase text-xs tracking-tight mb-1 ${user.id === currentUser.id ? 'text-blue-600' : 'text-slate-800'}`}>
                      {user.name}
                    </h3>
                    <div className="flex items-center gap-2">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        {emp?.role || user.specialty || (user.role === 'admin' ? 'Administrador' : 'Colaborador')}
                      </p>
                      {emp?.status === 'inactive' && (
                        <span className="text-[8px] font-black bg-red-100 text-red-600 px-2 py-0.5 rounded-md uppercase tracking-widest">Inativo</span>
                      )}
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  {user.id === currentUser.id ? (
                    <div className="flex flex-col items-end gap-2">
                      <span className="text-[9px] font-black text-white bg-blue-600 px-5 py-2 rounded-2xl uppercase tracking-widest shadow-lg shadow-blue-500/20">Logado</span>
                      {user.role === 'admin' && (
                        <button 
                          onClick={(e) => { e.stopPropagation(); setIsPasswordModalOpen(true); }}
                          className="text-[8px] font-black text-blue-600 uppercase tracking-widest bg-blue-50 px-3 py-1.5 rounded-xl border border-blue-100 hover:bg-blue-600 hover:text-white transition-all"
                        >
                          Alterar Minha Senha
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => {
                          if (isAdmin) {
                            onSwitchProfile(user);
                          } else {
                            setPendingUserToSwitch(user);
                            setIsAuthModalOpen(true);
                          }
                        }}
                        className="px-4 py-2.5 bg-blue-600 text-white rounded-xl font-black uppercase text-[9px] tracking-widest shadow-lg shadow-blue-500/20 active:scale-95 transition-all flex items-center gap-2"
                      >
                        <LogOut size={14} className="rotate-180" /> Logar
                      </button>
                      {isAdmin && (
                        <>
                          <button 
                            onClick={() => openEditUserModal(user)}
                            className="p-3 bg-white text-slate-600 rounded-xl border border-slate-200 shadow-sm active:scale-90 transition-all hover:bg-slate-50"
                          >
                            <Edit2 size={18} />
                          </button>
                          {user.role === 'colaborador' && (
                            <button 
                              onClick={() => setUserToDelete({ id: user.id, name: user.name })} 
                              className="p-3 bg-white text-red-500 rounded-xl border border-slate-200 shadow-sm active:scale-90 transition-all hover:bg-red-500 hover:text-white"
                            >
                              <Trash2 size={18} />
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {userToDelete && isAdmin && (
          <div className="fixed inset-0 bg-slate-950/80 z-[200] flex items-center justify-center p-6 backdrop-blur-md animate-in fade-in duration-200">
            <div className="bg-white w-full max-w-sm rounded-[3rem] overflow-hidden shadow-2xl animate-in zoom-in-95 border border-slate-100">
              <div className="p-8 text-center space-y-6">
                <div className="w-20 h-20 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-2">
                  <Trash2 size={40} />
                </div>
                <div className="space-y-2">
                  <h3 className="font-black text-slate-800 uppercase text-lg">Remover Colaborador?</h3>
                  <p className="text-slate-400 text-sm font-bold uppercase leading-tight px-4">
                    Deseja apagar permanentemente o perfil de <span className="text-red-600 font-black">"{userToDelete.name}"</span>?
                  </p>
                </div>
                <div className="flex flex-col gap-3 pt-4">
                  <button 
                    onClick={handleConfirmDelete} 
                    disabled={isDeleting}
                    className="w-full py-5 bg-red-600 text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl shadow-red-500/20 active:scale-95 disabled:opacity-50 flex items-center justify-center gap-3"
                  >
                    {isDeleting ? <Loader2 className="animate-spin" size={18} /> : 'Confirmar Exclusão'}
                  </button>
                  <button 
                    onClick={() => setUserToDelete(null)} 
                    disabled={isDeleting}
                    className="w-full py-5 bg-slate-100 text-slate-500 rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-slate-200 transition-colors"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {isPasswordModalOpen && (
          <div className="fixed inset-0 bg-slate-950/90 z-[300] flex items-center justify-center p-6 backdrop-blur-xl animate-in fade-in">
            <div className="bg-white w-full max-w-xs rounded-[3rem] p-8 shadow-2xl animate-in zoom-in-95 border border-slate-100">
              <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-inner">
                <Lock size={32} />
              </div>
              <h3 className="text-center font-black text-slate-800 uppercase text-sm mb-1">Nova Senha Admin</h3>
              <p className="text-center text-[9px] text-slate-400 font-bold uppercase tracking-widest mb-8 leading-tight">Altere a senha de acesso<br/>principal da sua loja</p>
              
              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-4">Senha Atual</label>
                  <div className="flex items-center gap-3 bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 focus-within:border-blue-500 transition-all">
                    <KeyRound size={18} className="text-slate-300" />
                    <input 
                      type="password" 
                      value={oldPassword}
                      onChange={(e) => setOldPassword(e.target.value)}
                      placeholder="SENHA ATUAL"
                      className="bg-transparent w-full outline-none font-black text-xs uppercase placeholder:text-slate-200"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-4">Nova Senha</label>
                  <div className="flex items-center gap-3 bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 focus-within:border-blue-500 transition-all">
                    <Lock size={18} className="text-slate-300" />
                    <input 
                      type="password" 
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="NOVA SENHA"
                      className="bg-transparent w-full outline-none font-black text-xs uppercase placeholder:text-slate-200"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-4">Confirmar Nova Senha</label>
                  <div className="flex items-center gap-3 bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 focus-within:border-blue-500 transition-all">
                    <Check size={18} className="text-slate-300" />
                    <input 
                      type="password" 
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="REPETIR SENHA"
                      className="bg-transparent w-full outline-none font-black text-xs uppercase placeholder:text-slate-200"
                    />
                  </div>
                </div>
              </div>
              
              {passwordError && <p className="text-center text-[9px] font-black text-red-500 uppercase mt-4 animate-bounce">{passwordError}</p>}

              <div className="flex flex-col gap-2 mt-8">
                <button 
                  onClick={handleChangePassword} 
                  disabled={isChangingPassword} 
                  className="w-full py-5 bg-blue-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl shadow-blue-500/20 active:scale-95 transition-all flex items-center justify-center disabled:opacity-50"
                >
                  {isChangingPassword ? <Loader2 size={18} className="animate-spin" /> : 'Atualizar Senha'}
                </button>
                <button 
                  onClick={() => { setIsPasswordModalOpen(false); setOldPassword(''); setNewPassword(''); setConfirmPassword(''); setPasswordError(null); }} 
                  className="w-full py-4 text-slate-400 font-black uppercase text-[10px] tracking-widest"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        )}

        {isAuthModalOpen && (
          <div className="fixed inset-0 bg-slate-950/90 z-[200] flex items-center justify-center p-6 backdrop-blur-xl animate-in fade-in">
             <div className="bg-white w-full max-w-xs rounded-[3rem] p-10 shadow-2xl animate-in zoom-in-95 border border-slate-100">
                <div className="w-20 h-20 bg-slate-100 text-slate-900 rounded-[2.5rem] flex items-center justify-center mx-auto mb-8 shadow-inner">
                   <Lock size={36} />
                </div>
                <h3 className="text-center font-black text-slate-800 uppercase text-sm mb-1">Acesso Restrito</h3>
                <p className="text-center text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-10 leading-tight">Trocar perfil requer<br/>senha do ADM da Loja</p>
                
                <div className={`flex items-center gap-3 bg-slate-50 border rounded-2xl px-5 py-5 mb-4 transition-all ${authError ? 'border-red-500 bg-red-50 ring-4 ring-red-100' : 'border-slate-100 focus-within:border-blue-500'}`}>
                   <KeyRound size={20} className={authError ? 'text-red-500' : 'text-slate-300'} />
                   <input 
                     type="password" 
                     autoFocus
                     value={authPassword}
                     onChange={(e) => setAuthPassword(e.target.value)}
                     onKeyDown={(e) => e.key === 'Enter' && verifyAdminPassword()}
                     placeholder="SENHA DO ADM"
                     className="bg-transparent w-full outline-none font-black text-sm uppercase placeholder:text-slate-200"
                   />
                </div>
                
                {authError && <p className="text-center text-[9px] font-black text-red-500 uppercase mb-4 animate-bounce">Senha Incorreta!</p>}

                <div className="flex flex-col gap-2">
                   <button onClick={verifyAdminPassword} disabled={isVerifying} className="w-full py-5 bg-blue-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl shadow-blue-500/20 active:scale-95 transition-all flex items-center justify-center disabled:opacity-50">
                     {isVerifying ? <Loader2 size={18} className="animate-spin" /> : 'Validar Gerente'}
                   </button>
                   <button onClick={() => { setIsAuthModalOpen(false); setAuthPassword(''); setPendingUserToSwitch(null); }} className="w-full py-4 text-slate-400 font-black uppercase text-[10px] tracking-widest">Cancelar</button>
                </div>
             </div>
          </div>
        )}

        {isUserModalOpen && isAdmin && (
          <div className="fixed inset-0 bg-slate-950/80 z-[100] flex flex-col justify-end md:justify-center p-4 backdrop-blur-md">
            <div className="bg-white w-full max-w-2xl mx-auto rounded-[3.5rem] shadow-2xl overflow-hidden animate-in slide-in-from-bottom-10 border border-slate-100 flex flex-col max-h-[90vh]">
              <div className="p-8 border-b border-slate-50 flex items-center justify-between shrink-0">
                <h3 className="text-xl font-black text-slate-800 uppercase tracking-tighter">{isEditingUser ? 'Editar Colaborador' : 'Novo Colaborador'}</h3>
                <button onClick={() => { setIsUserModalOpen(false); setIsEditingUser(false); }} className="text-slate-400 p-3 bg-slate-50 rounded-full active:scale-90"><X size={20} /></button>
              </div>
              
              <div className="p-8 space-y-8 overflow-y-auto flex-1 hide-scrollbar">
                {/* Cabeçalho com Foto e Nome */}
                <div className="flex flex-col md:flex-row items-center gap-8">
                  <div className="flex flex-col items-center gap-3">
                    <button onClick={triggerUserPhotoUpload} className="relative group">
                      <div className="w-24 h-24 bg-slate-50 rounded-[2.5rem] border-4 border-dashed border-slate-200 flex items-center justify-center overflow-hidden active:scale-95 transition-transform">
                        {isCompressing ? <Loader2 className="animate-spin text-blue-500" /> : newUserPhoto ? <img src={newUserPhoto} className="w-full h-full object-cover" /> : <Camera className="text-slate-200" size={32} />}
                      </div>
                    </button>
                    <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Foto do Perfil</p>
                  </div>
                  
                  <div className="flex-1 w-full space-y-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Nome Completo</label>
                      <input 
                        value={newUserName} 
                        onChange={(e) => setNewUserName(e.target.value)} 
                        placeholder="NOME DO PROFISSIONAL" 
                        className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-3xl outline-none font-black uppercase text-xs focus:ring-4 focus:ring-slate-100 transition-all" 
                      />
                    </div>
                  </div>
                </div>

                {/* Dados do Funcionário */}
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Cargo</label>
                      <select 
                        value={employeeFormData.role}
                        onChange={e => setEmployeeFormData({...employeeFormData, role: e.target.value as any})}
                        className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-3xl outline-none font-black uppercase text-xs focus:ring-4 focus:ring-slate-100 transition-all"
                      >
                        <option value="vendedor">Vendedor</option>
                        <option value="tecnico">Técnico</option>
                        <option value="atendente">Atendente</option>
                        <option value="gerente">Gerente</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Status</label>
                      <select 
                        value={employeeFormData.status}
                        onChange={e => setEmployeeFormData({...employeeFormData, status: e.target.value as any})}
                        className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-3xl outline-none font-black uppercase text-xs focus:ring-4 focus:ring-slate-100 transition-all"
                      >
                        <option value="active">Ativo</option>
                        <option value="inactive">Inativo</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">CPF</label>
                      <input 
                        value={employeeFormData.cpf || ''}
                        onChange={e => setEmployeeFormData({...employeeFormData, cpf: e.target.value})}
                        placeholder="000.000.000-00"
                        className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-3xl outline-none font-black uppercase text-xs focus:ring-4 focus:ring-slate-100 transition-all"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Telefone</label>
                      <input 
                        value={employeeFormData.phone || ''}
                        onChange={e => setEmployeeFormData({...employeeFormData, phone: e.target.value})}
                        placeholder="(00) 00000-0000"
                        className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-3xl outline-none font-black uppercase text-xs focus:ring-4 focus:ring-slate-100 transition-all"
                      />
                    </div>
                  </div>

                  {/* Financeiro */}
                  <div className="p-6 bg-slate-50 rounded-[2.5rem] space-y-4 border border-slate-100">
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                      <DollarSign size={14} /> Financeiro e Comissões
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-4">Salário Base</label>
                        <input 
                          type="number"
                          value={employeeFormData.salaryBase || 0}
                          onChange={e => setEmployeeFormData({...employeeFormData, salaryBase: Number(e.target.value)})}
                          className="w-full px-5 py-3 bg-white border border-slate-100 rounded-2xl outline-none font-black text-xs"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-4">Meta Mensal de Vendas (Opcional)</label>
                        <input 
                          type="number"
                          value={employeeFormData.goalMonthly || 0}
                          onChange={e => setEmployeeFormData({...employeeFormData, goalMonthly: Number(e.target.value)})}
                          className="w-full px-5 py-3 bg-white border border-slate-100 rounded-2xl outline-none font-black text-xs"
                        />
                        <p className="text-[8px] text-slate-400 font-medium px-4 mt-1">
                          Usado para ativar Regras de Comissão que exigem "Meta Batida".
                        </p>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-4">Tipo de Comissão</label>
                        <select 
                          value={employeeFormData.commissionType}
                          onChange={e => setEmployeeFormData({...employeeFormData, commissionType: e.target.value as any})}
                          className="w-full px-5 py-3 bg-white border border-slate-100 rounded-2xl outline-none font-black text-[10px] uppercase"
                        >
                          <option value="sales_percent">% Sobre Venda</option>
                          <option value="profit_percent">% Sobre Lucro</option>
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-4">Comissão (%)</label>
                        <input 
                          type="number"
                          value={employeeFormData.defaultCommissionPercent || 0}
                          onChange={e => setEmployeeFormData({...employeeFormData, defaultCommissionPercent: Number(e.target.value)})}
                          className="w-full px-5 py-3 bg-white border border-slate-100 rounded-2xl outline-none font-black text-xs"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Permissões */}
                  <div className="space-y-4">
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                      <Shield size={14} /> Permissões de Acesso
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {[
                        { key: 'open_os', label: 'Abrir O.S.' },
                        { key: 'sell', label: 'Realizar Vendas' },
                        { key: 'view_finance', label: 'Ver Financeiro' },
                        { key: 'edit_price', label: 'Editar Preços' },
                        { key: 'cancel_sale', label: 'Cancelar Vendas' },
                      ].map(perm => (
                        <label key={perm.key} className="flex items-center gap-3 p-4 bg-slate-50 border border-slate-100 rounded-2xl cursor-pointer hover:bg-white transition-all">
                          <input 
                            type="checkbox"
                            checked={(employeeFormData.permissions as any)?.[perm.key]}
                            onChange={e => setEmployeeFormData({
                              ...employeeFormData,
                              permissions: { ...employeeFormData.permissions, [perm.key]: e.target.checked } as any
                            })}
                            className="w-5 h-5 text-blue-600 rounded-lg border-slate-200 focus:ring-blue-500"
                          />
                          <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">{perm.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>

                <button 
                  onClick={handleCreateUser} 
                  disabled={isSaving} 
                  className="w-full py-6 bg-slate-900 text-white rounded-[2.5rem] font-black uppercase text-[11px] tracking-widest shadow-2xl active:scale-95 transition-all flex items-center justify-center gap-3"
                >
                  {isSaving ? <Loader2 className="animate-spin" /> : (
                    <>
                      <Save size={18} />
                      {isEditingUser ? 'Salvar Alterações' : 'Cadastrar Colaborador'}
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (view === 'backup' && isAdmin) {
    return (
      <div className="space-y-6 animate-in slide-in-from-right-10 duration-500 pb-24 h-full">
        <div className="flex items-center gap-4 mb-8">
          <button onClick={() => setView('main')} className="p-3 bg-white shadow-sm border border-slate-100 rounded-2xl text-slate-600 active:scale-90 transition-all">
            <ArrowLeft size={24} />
          </button>
          <h2 className="text-2xl font-black text-slate-800 tracking-tight uppercase">Backup de Dados</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-sm space-y-6 flex flex-col items-center text-center">
            <div className="w-20 h-20 bg-blue-50 text-blue-600 rounded-[2rem] flex items-center justify-center shadow-inner">
              <Download size={40} />
            </div>
            <div className="space-y-2">
              <h3 className="font-black text-slate-800 uppercase text-sm">Exportar XML</h3>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest leading-tight">Gera um arquivo com todas as OS, Produtos, Vendas e Fotos.</p>
            </div>
            <button 
              onClick={exportToXML} 
              disabled={isExporting}
              className="w-full py-5 bg-blue-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl shadow-blue-500/20 active:scale-95 disabled:opacity-50 flex items-center justify-center gap-3"
            >
              {isExporting ? <Loader2 className="animate-spin" size={18} /> : 'Baixar Backup XML'}
            </button>
          </div>

          <div className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-sm space-y-6 flex flex-col items-center text-center">
            <div className="w-20 h-20 bg-emerald-50 text-emerald-600 rounded-[2rem] flex items-center justify-center shadow-inner">
              <Upload size={40} />
            </div>
            <div className="space-y-2">
              <h3 className="font-black text-slate-800 uppercase text-sm">Importar XML</h3>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest leading-tight">Restaura dados de um arquivo XML anterior para o sistema.</p>
            </div>
            <button 
              onClick={importFromXML} 
              disabled={isImporting}
              className="w-full py-5 bg-emerald-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl shadow-emerald-500/20 active:scale-95 disabled:opacity-50 flex items-center justify-center gap-3"
            >
              {isImporting ? <Loader2 className="animate-spin" size={18} /> : 'Selecionar Arquivo'}
            </button>
          </div>
        </div>
      </div>
    );
  }
  if (view === 'subscription' && isAdmin) {
    return (
      <div className="space-y-6 animate-in slide-in-from-right-10 duration-500 pb-24 h-full">
        <div className="flex items-center gap-4 mb-8">
          <button onClick={() => setView('main')} className="p-3 bg-white shadow-sm border border-slate-100 rounded-2xl text-slate-600 active:scale-90 transition-all">
            <ArrowLeft size={24} />
          </button>
          <h2 className="text-2xl font-black text-slate-800 tracking-tight uppercase">Plano e Limites</h2>
        </div>

        <div className="max-w-xl mx-auto space-y-6">
          {/* PLANO ATUAL */}
          {subscriptionStatus && (
            <div className="bg-white rounded-[3rem] p-8 flex flex-col sm:flex-row items-center justify-between relative overflow-hidden border border-slate-100 shadow-sm gap-6">
              <div className="flex items-center gap-6 relative z-10">
                <div className={`w-16 h-16 rounded-3xl flex items-center justify-center shadow-inner ${subscriptionStatus === 'trial' ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'}`}>
                  <Shield size={32} />
                </div>
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Plano Atual</p>
                  <h3 className="font-black text-slate-800 uppercase text-lg leading-tight">
                    {getPlanName()}
                  </h3>
                </div>
              </div>
              <div className="text-center sm:text-right relative z-10 bg-slate-50 sm:bg-transparent p-4 sm:p-0 rounded-2xl w-full sm:w-auto">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Expira em</p>
                <p className="font-black text-slate-800 text-lg">
                  {subscriptionExpiresAt ? new Date(subscriptionExpiresAt).toLocaleDateString('pt-BR') : 'N/A'}
                </p>
              </div>
              {/* Decorative background element */}
              <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-slate-50 rounded-full blur-3xl pointer-events-none"></div>
            </div>
          )}

          {/* LIMITES DETALHADOS */}
          <div className="bg-white rounded-[3rem] p-8 border border-slate-100 shadow-sm space-y-8">
            <div className="text-center space-y-2">
              <h3 className="font-black text-slate-800 uppercase text-sm tracking-widest">Capacidade do Sistema</h3>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Acompanhe o uso dos recursos do seu plano</p>
            </div>

            <div className="grid grid-cols-1 gap-4">
              <div className="bg-slate-50 p-6 rounded-[2rem] flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center">
                    <Users size={24} />
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Usuários Ativos</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-black text-blue-600 text-2xl leading-none">
                    {settings.users?.length || 0} 
                    <span className="text-slate-300 text-sm ml-1">/ {maxUsers === 999 ? '∞' : maxUsers}</span>
                  </p>
                </div>
              </div>

              <div className="bg-slate-50 p-6 rounded-[2rem] flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-indigo-100 text-indigo-600 rounded-2xl flex items-center justify-center">
                    <Smartphone size={24} />
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Ordens</p>
                    <p className="text-xs font-bold text-slate-600 uppercase">Limite de O.S.</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-black text-indigo-600 text-2xl leading-none">
                    {maxOS === 999 ? '∞' : maxOS}
                  </p>
                </div>
              </div>

              <div className="bg-slate-50 p-6 rounded-[2rem] flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center">
                    <Package size={24} />
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Produtos</p>
                    <p className="text-xs font-bold text-slate-600 uppercase">Limite de Estoque</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-black text-emerald-600 text-2xl leading-none">
                    {maxProducts === 999 ? '∞' : maxProducts}
                  </p>
                </div>
              </div>
            </div>

            <div className="pt-4">
              <button 
                onClick={() => window.open(`https://wa.me/${supportPhone}?text=Olá, gostaria de falar sobre meu plano na ${settings.storeName}`, '_blank')}
                className="w-full py-5 bg-slate-900 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl active:scale-95 transition-all flex items-center justify-center gap-3"
              >
                Falar com Suporte / Upgrade
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (view === 'theme' && isAdmin) {
    return (
      <div className="space-y-6 animate-in slide-in-from-right-10 duration-500">
        <div className="flex items-center gap-4 mb-8">
          <button onClick={() => setView('main')} className="p-3 bg-white shadow-sm border border-slate-100 rounded-2xl text-slate-600 active:scale-90 transition-all"><ArrowLeft size={24} /></button>
          <h2 className="text-2xl font-black text-slate-800 tracking-tight uppercase">Cores do App</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[
            { label: 'Cor Principal (Botões)', key: 'themePrimary', icon: Palette },
            { label: 'Cor do Menu Lateral', key: 'themeSidebar', icon: Layout },
          ].map((item) => (
            <div key={item.key} className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-4">
              <p className="font-black text-slate-400 text-[10px] uppercase tracking-widest">{item.label}</p>
              <input 
                type="color" 
                value={(settings as any)[item.key] || '#000000'} 
                onChange={(e) => updateSetting(item.key as any, e.target.value)}
                className="w-full h-12 rounded-xl cursor-pointer bg-transparent border-0"
              />
            </div>
          ))}
        </div>
      </div>
    );
  }
  if (view === 'notifications' && isAdmin) {
    return (
      <div className="space-y-6 animate-in slide-in-from-right-10 duration-500">
        <div className="flex items-center gap-4 mb-8">
          <button onClick={() => setView('main')} className="p-3 bg-white shadow-sm border border-slate-100 rounded-2xl text-slate-600 active:scale-90 transition-all"><ArrowLeft size={24} /></button>
          <h2 className="text-2xl font-black text-slate-800 tracking-tight uppercase">Notificações</h2>
        </div>
        <div className="bg-white rounded-[3rem] p-8 shadow-sm border border-slate-100 space-y-6">
          {/* Contas a Pagar */}
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">Contas a Pagar</h3>
              <p className="text-xs text-slate-500 mt-1">Alertas 3 dias antes do vencimento.</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input 
                type="checkbox" 
                className="sr-only peer" 
                checked={settings.enableBillNotifications || false}
                onChange={(e) => {
                  const checked = e.target.checked;
                  updateSetting('enableBillNotifications', checked);
                  if (checked) {
                    if ('Notification' in window) {
                      Notification.requestPermission().then(permission => {
                        if (permission === 'granted') {
                          alert('Notificações ativadas com sucesso!');
                        } else if (permission === 'denied') {
                          alert('Você bloqueou as notificações. Por favor, ative-as nas configurações do seu navegador/celular para este site.');
                        }
                      });
                    } else {
                      alert('Seu navegador não suporta notificações push. No iPhone/iPad, você precisa instalar o aplicativo na tela inicial e abrir por lá para receber notificações.');
                    }
                  }
                }}
              />
              <div className="w-14 h-7 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-blue-500"></div>
            </label>
          </div>

          <div className="h-px bg-slate-100 w-full"></div>

          {/* Contas a Receber */}
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">Contas a Receber</h3>
              <p className="text-xs text-slate-500 mt-1">Alertas de pagamentos de clientes.</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input 
                type="checkbox" 
                className="sr-only peer" 
                checked={settings.enableReceivableNotifications || false}
                onChange={(e) => updateSetting('enableReceivableNotifications', e.target.checked)}
              />
              <div className="w-14 h-7 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-blue-500"></div>
            </label>
          </div>

          <div className="h-px bg-slate-100 w-full"></div>

          {/* Estoque Baixo */}
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">Estoque Baixo</h3>
              <p className="text-xs text-slate-500 mt-1">Avisar quando houver menos de 3 unidades.</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input 
                type="checkbox" 
                className="sr-only peer" 
                checked={settings.enableLowStockNotifications || false}
                onChange={(e) => updateSetting('enableLowStockNotifications', e.target.checked)}
              />
              <div className="w-14 h-7 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-blue-500"></div>
            </label>
          </div>

          <div className="h-px bg-slate-100 w-full"></div>

          {/* Novas OS */}
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">Novas O.S.</h3>
              <p className="text-xs text-slate-500 mt-1">Alertar quando colaboradores criarem O.S.</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input 
                type="checkbox" 
                className="sr-only peer" 
                checked={settings.enableNewOSNotifications || false}
                onChange={(e) => updateSetting('enableNewOSNotifications', e.target.checked)}
              />
              <div className="w-14 h-7 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-blue-500"></div>
            </label>
          </div>

          <div className="h-px bg-slate-100 w-full"></div>

          {/* Novas Vendas */}
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">Novas Vendas</h3>
              <p className="text-xs text-slate-500 mt-1">Alertar quando colaboradores fizerem vendas.</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input 
                type="checkbox" 
                className="sr-only peer" 
                checked={settings.enableNewSaleNotifications || false}
                onChange={(e) => updateSetting('enableNewSaleNotifications', e.target.checked)}
              />
              <div className="w-14 h-7 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-blue-500"></div>
            </label>
          </div>
        </div>

        <div className="bg-white rounded-[3rem] p-8 shadow-sm border border-slate-100 space-y-4">
          <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">Teste de Sistema</h3>
          <p className="text-xs text-slate-500">Clique no botão abaixo para verificar se as notificações estão funcionando corretamente no seu aparelho.</p>
          <button 
            onClick={() => {
              if (!('Notification' in window)) {
                alert('Seu navegador não suporta notificações.');
                return;
              }
              if (Notification.permission !== 'granted') {
                alert('Você precisa permitir as notificações primeiro.');
                return;
              }
              
              const title = 'Teste de Notificação';
              const options = {
                body: 'Parabéns! As notificações estão funcionando corretamente no seu aparelho.',
                icon: '/icon.svg',
                badge: '/icon.svg',
                vibrate: [200, 100, 200]
              };

              if ('serviceWorker' in navigator) {
                navigator.serviceWorker.ready.then((registration) => {
                  registration.showNotification(title, options);
                }).catch(() => {
                  new Notification(title, options);
                });
              } else {
                new Notification(title, options);
              }
            }}
            className="w-full py-4 bg-blue-50 text-blue-600 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-blue-600 hover:text-white transition-all"
          >
            Enviar Notificação de Teste
          </button>
        </div>
      </div>
    );
  }

  if (view === 'print' && isAdmin) {
    return (
      <div className="space-y-6 animate-in slide-in-from-right-10 duration-500">
        <div className="flex items-center gap-4 mb-8">
          <button onClick={() => setView('main')} className="p-3 bg-white shadow-sm border border-slate-100 rounded-2xl text-slate-600 active:scale-90 transition-all"><ArrowLeft size={24} /></button>
          <h2 className="text-2xl font-black text-slate-800 tracking-tight uppercase">Garantia</h2>
        </div>
        <div className="bg-white rounded-[3rem] p-8 space-y-6 shadow-sm border border-slate-100">
          <div className="space-y-3">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Termo de Garantia Padrão</label>
            <textarea value={settings.pdfWarrantyText} onChange={(e) => updateSetting('pdfWarrantyText', e.target.value)} rows={5} className="w-full px-6 py-5 bg-slate-50 border border-slate-100 rounded-3xl outline-none text-sm font-medium leading-relaxed" />
          </div>
          <button onClick={() => setView('main')} className="w-full py-5 bg-slate-900 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest">Salvar</button>
        </div>
      </div>
    );
  }
  if (view === 'catalog' && isAdmin) {
    return (
      <CatalogManager 
        products={products} 
        setProducts={setProducts} 
        settings={settings} 
        setSettings={setSettings}
        tenantId={tenantId || ''} 
        onBack={() => setView('main')} 
      />
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500 relative pb-24">
      {saveMessage && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[100] animate-in slide-in-from-top-4">
           <div className="bg-emerald-500 text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-3 border border-white/20">
              <Check size={16} />
              <span className="text-[10px] font-black uppercase tracking-widest">{saveMessage}</span>
           </div>
        </div>
      )}

      <div className="flex items-center justify-between px-2">
        <h2 className="text-xl font-black text-slate-800 tracking-tight uppercase">AJUSTES</h2>
        <div className="relative">
          <button onClick={() => setShowMenu(!showMenu)} className="p-3 bg-slate-100 rounded-xl text-slate-400 shadow-sm active:scale-90 transition-all">
            <MoreVertical size={20} />
          </button>
          {showMenu && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
              <div className="absolute right-0 mt-2 w-64 bg-white border border-slate-100 rounded-2xl shadow-2xl z-50 py-2 overflow-hidden animate-in zoom-in-95 origin-top-right">
                {isAdmin && (
                  <>
                    <button onClick={() => { setView('subscription'); setShowMenu(false); }} className={`w-full flex items-center gap-3 px-5 py-4 text-[10px] font-black text-slate-600 hover:bg-slate-50 transition-colors uppercase tracking-widest text-left border-l-4 ${(view as any) === 'subscription' ? 'border-blue-500 bg-blue-50' : 'border-transparent'}`}>
                      <Shield size={16} /> Plano e Limites
                    </button>
                    <button onClick={() => { setView('theme'); setShowMenu(false); }} className={`w-full flex items-center gap-3 px-5 py-4 text-[10px] font-black text-slate-600 hover:bg-slate-50 transition-colors uppercase tracking-widest text-left border-l-4 ${(view as any) === 'theme' ? 'border-blue-500 bg-blue-50' : 'border-transparent'}`}>
                      <Palette size={16} /> Aparência Global
                    </button>
                    <button onClick={() => { setView('print'); setShowMenu(false); }} className={`w-full flex items-center gap-3 px-5 py-4 text-[10px] font-black text-slate-600 hover:bg-slate-50 transition-colors uppercase tracking-widest text-left border-l-4 ${(view as any) === 'print' ? 'border-blue-500 bg-blue-50' : 'border-transparent'}`}>
                      <FileText size={16} /> Dados do Recibo
                    </button>
                    <button onClick={() => { setView('notifications'); setShowMenu(false); }} className={`w-full flex items-center gap-3 px-5 py-4 text-[10px] font-black text-slate-600 hover:bg-slate-50 transition-colors uppercase tracking-widest text-left border-l-4 ${(view as any) === 'notifications' ? 'border-blue-500 bg-blue-50' : 'border-transparent'}`}>
                      <Bell size={16} /> Notificações
                    </button>
                    <button onClick={() => { setView('catalog'); setShowMenu(false); }} className={`w-full flex items-center gap-3 px-5 py-4 text-[10px] font-black text-slate-600 hover:bg-slate-50 transition-colors uppercase tracking-widest text-left border-l-4 ${(view as any) === 'catalog' ? 'border-blue-500 bg-blue-50' : 'border-transparent'}`}>
                      <Briefcase size={16} /> Catálogo Online
                    </button>
                    {enabledFeatures?.xmlExportImport !== false && (
                      <button onClick={() => { setView('backup'); setShowMenu(false); }} className={`w-full flex items-center gap-3 px-5 py-4 text-[10px] font-black text-slate-600 hover:bg-slate-50 transition-colors uppercase tracking-widest text-left border-l-4 ${(view as any) === 'backup' ? 'border-blue-500 bg-blue-50' : 'border-transparent'}`}>
                        <Download size={16} /> Backup e Importação
                      </button>
                    )}
                  </>
                )}
                {enabledFeatures?.profiles !== false && (
                  <button onClick={() => { setView('users'); setShowMenu(false); }} className={`w-full flex items-center gap-3 px-5 py-4 text-[10px] font-black text-slate-600 hover:bg-slate-50 transition-colors uppercase tracking-widest text-left border-l-4 ${(view as any) === 'users' ? 'border-blue-500 bg-blue-50' : 'border-transparent'}`}>
                    <Users size={16} /> {isAdmin ? 'Gestão de Equipe' : 'Trocar de Perfil'}
                  </button>
                )}
                {deferredPrompt && (
                  <button 
                    onClick={() => { onInstallApp?.(); setShowMenu(false); }} 
                    className="w-full flex items-center gap-3 px-5 py-4 text-[10px] font-black text-blue-600 hover:bg-blue-50 transition-colors uppercase tracking-widest text-left border-l-4 border-transparent"
                  >
                    <Smartphone size={16} /> Instalar Aplicativo
                  </button>
                )}
                {onLogout && (
                  <button 
                    onClick={() => { onLogout(); setShowMenu(false); }} 
                    className="w-full flex items-center gap-3 px-5 py-4 text-[10px] font-black text-red-600 hover:bg-red-50 transition-colors uppercase tracking-widest text-left border-l-4 border-transparent"
                  >
                    <LogOut size={16} /> Sair
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      <div className="max-w-xl mx-auto space-y-4">
        {/* DADOS DA LOJA (Compacto) */}
        <div className="bg-white rounded-[2rem] border border-slate-100 p-6 shadow-sm space-y-5">
           <div className="flex items-center gap-4 mb-2">
              <div className="relative group shrink-0">
                <div className="w-16 h-16 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-center overflow-hidden">
                  {isCompressing ? <Loader2 className="animate-spin text-blue-500" size={20} /> : settings.logoUrl ? <img src={settings.logoUrl} className="w-full h-full object-cover" /> : <ImageIcon size={24} className="text-slate-300" />}
                </div>
                {isAdmin && (
                  <button onClick={triggerUpload} className="absolute -bottom-2 -right-2 bg-blue-600 text-white p-2 rounded-xl shadow-lg active:scale-90 transition-all">
                    <Camera size={14} />
                  </button>
                )}
              </div>
              <div className="flex-1 min-w-0">
                 <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Nome da Loja</label>
                 <input readOnly={!isAdmin} type="text" value={settings.storeName} onChange={(e) => updateSetting('storeName', e.target.value)} className={`w-full bg-transparent border-none p-0 font-black text-lg text-slate-800 outline-none truncate ${isAdmin ? 'placeholder:text-slate-300' : ''}`} placeholder="Nome da Loja" />
              </div>
           </div>

           <div className="grid grid-cols-1 gap-4">
              <div className="space-y-1">
                 <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5"><MapPin size={10}/> Endereço</label>
                 <input readOnly={!isAdmin} type="text" value={settings.storeAddress || ''} onChange={(e) => updateSetting('storeAddress', e.target.value)} className="w-full px-4 py-3 bg-slate-50 rounded-xl text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500/20 transition-all" placeholder="Endereço completo" />
              </div>
              <div className="space-y-1">
                 <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5"><Phone size={10}/> Telefone</label>
                 <input readOnly={!isAdmin} type="text" value={settings.storePhone || ''} onChange={(e) => updateSetting('storePhone', e.target.value)} className="w-full px-4 py-3 bg-slate-50 rounded-xl text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500/20 transition-all" placeholder="(00) 00000-0000" />
              </div>
           </div>
        </div>

        {/* OUTRAS CONFIGURAÇÕES */}
        <div className="grid grid-cols-2 gap-3">
           <div className="bg-white p-4 rounded-[2rem] border border-slate-100 shadow-sm space-y-3">
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5"><Layout size={12}/> Paginação</label>
              <div className="grid grid-cols-2 gap-2">
                {[8, 16, 32, 64].map(num => (
                  <button 
                    key={num}
                    onClick={() => updateSetting('itemsPerPage', num as any)}
                    className={`py-2 rounded-lg text-[10px] font-black uppercase transition-all ${settings.itemsPerPage === num ? 'bg-slate-900 text-white shadow-md' : 'bg-slate-50 text-slate-500'}`}>
                    {num}
                  </button>
                ))}
              </div>
           </div>

           <div className={`p-4 rounded-[2rem] border flex flex-col items-center justify-center text-center gap-2 transition-all ${isCloudConnected ? 'bg-emerald-50/50 border-emerald-100' : 'bg-red-50/50 border-red-100'}`}>
              <div className={`w-8 h-8 text-white rounded-full flex items-center justify-center shadow-sm ${isCloudConnected ? 'bg-emerald-500' : 'bg-red-500'}`}>
                {isCloudConnected ? <Check size={14} /> : <AlertCircle size={14} />}
              </div>
              <div>
                <p className={`text-[10px] font-black uppercase tracking-tight ${isCloudConnected ? 'text-emerald-800' : 'text-red-800'}`}>
                  {isCloudConnected ? 'Online' : 'Offline'}
                </p>
                <p className="text-[8px] text-slate-400 uppercase tracking-widest font-bold">Sincronizado</p>
              </div>
           </div>
        </div>

        {deferredPrompt && (
          <button 
            onClick={onInstallApp}
            className="w-full py-4 bg-blue-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl shadow-blue-500/20 active:scale-95 transition-all flex items-center justify-center gap-2"
          >
            <Smartphone size={16} />
            Instalar App
          </button>
        )}

        {/* VERSÃO E ATUALIZAÇÃO */}
        <div className="pt-8 pb-4 text-center space-y-4">
           <div className="inline-flex items-center gap-2 px-3 py-1 bg-slate-100 rounded-full">
              <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></div>
              <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Versão 2.1.0 - Estável</span>
           </div>
           <p className="text-[8px] font-bold text-slate-300 uppercase tracking-widest leading-relaxed">
              Se as novas funções não aparecerem,<br/>clique no botão abaixo para atualizar.
           </p>
           <button 
             onClick={() => {
               if ('serviceWorker' in navigator) {
                 navigator.serviceWorker.getRegistrations().then(registrations => {
                   for(let registration of registrations) {
                     registration.update();
                   }
                   alert('Verificando atualizações... O app irá reiniciar se houver uma nova versão.');
                   window.location.reload();
                 });
               } else {
                 window.location.reload();
               }
             }}
             className="flex items-center gap-2 mx-auto px-4 py-2 text-slate-400 hover:text-blue-600 transition-colors"
           >
              <Download size={14} />
              <span className="text-[9px] font-black uppercase tracking-widest">Forçar Atualização</span>
           </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsTab;
