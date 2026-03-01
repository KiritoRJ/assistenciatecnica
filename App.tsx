
import React, { useState, useEffect, useCallback } from 'react';
import { Smartphone, Package, ShoppingCart, BarChart3, Settings, LogOut, Menu, X, Loader2, ShieldCheck, KeyRound } from 'lucide-react';
import { ServiceOrder, Product, Sale, Transaction, AppSettings, User } from './types';
import ServiceOrderTab from './components/ServiceOrderTab';
import StockTab from './components/StockTab';
import SalesTab from './components/SalesTab';
import FinanceTab from './components/FinanceTab';
import SettingsTab from './components/SettingsTab';
import SuperAdminDashboard from './components/SuperAdminDashboard';
import SubscriptionView from './components/SubscriptionView';
import CustomerCatalog from './components/CustomerCatalog';
import { OnlineDB } from './utils/api';
import { OfflineSync } from './utils/offlineSync';
import { db } from './utils/localDb';

type Tab = 'os' | 'estoque' | 'vendas' | 'financeiro' | 'config';

const DEFAULT_SETTINGS: AppSettings = {
  storeName: 'Minha Assistência',
  storeAddress: '',
  storePhone: '',
  logoUrl: null,
  users: [],
  isConfigured: true,
  themePrimary: '#2563eb',
  themeSidebar: '#0f172a',
  themeBg: '#f8fafc',
  themeBottomTab: '#0f172a',
  pdfWarrantyText: "Concede-se garantia pelo prazo de 90 (noventa) dias contra defeitos de fabricação ou do serviço executado. A garantia não cobre danos por mau uso, contato com líquidos ou quedas.",
  pdfFontSize: 8,
  pdfFontFamily: 'helvetica',
  pdfPaperWidth: 80,
  printerSize: 58,
  pdfTextColor: '#000000',
  pdfBgColor: '#FFFFFF',
  itemsPerPage: 32
};

const App: React.FC = () => {
  const [session, setSession] = useState<{ 
    isLoggedIn: boolean; 
    type: 'super' | 'admin' | 'colaborador'; 
    tenantId?: string; 
    user?: User; 
    subscriptionStatus?: string; 
    subscriptionExpiresAt?: string;
    customMonthlyPrice?: number;
    customQuarterlyPrice?: number;
    customYearlyPrice?: number;
    lastPlanType?: 'monthly' | 'quarterly' | 'yearly';
    enabledFeatures?: {
      osTab: boolean;
      stockTab: boolean;
      salesTab: boolean;
      financeTab: boolean;
      profiles: boolean;
      xmlExportImport: boolean;
      hideFinancialReports?: boolean;
      promoBanner?: boolean;
    };
    maxUsers?: number;
    maxOS?: number;
    maxProducts?: number;
    printerSize?: 58 | 80;
  } | null>(null);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [orders, setOrders] = useState<ServiceOrder[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [activeTab, setActiveTab] = useState<Tab>('os');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);
  const [isSubscriptionModalOpen, setIsSubscriptionModalOpen] = useState(false);
  const [logoutPassword, setLogoutPassword] = useState('');
  const [isVerifyingLogout, setIsVerifyingLogout] = useState(false);
  const [logoutError, setLogoutError] = useState(false);
  const [isCloudConnected, setIsCloudConnected] = useState(true);
  const [isInitializing, setIsInitializing] = useState(true);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  const pathname = window.location.pathname;
  let catalogTenantId = new URLSearchParams(window.location.search).get('catalog');
  let catalogSlug = null;
  
  if (pathname.startsWith('/catalogo/')) {
    catalogTenantId = pathname.split('/catalogo/')[1].replace(/\/$/, '');
  } else if (pathname.length > 1 && !pathname.startsWith('/api/') && !pathname.startsWith('/auth/')) {
    catalogSlug = pathname.substring(1).replace(/\/$/, '');
  }

  useEffect(() => {
    let deviceId = localStorage.getItem('device_id');
    if (!deviceId) {
      deviceId = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
      localStorage.setItem('device_id', deviceId);
    }
    
    OfflineSync.init();
    const handleStatusChange = () => setIsOnline(navigator.onLine);
    window.addEventListener('online', handleStatusChange);
    window.addEventListener('offline', handleStatusChange);
    return () => {
      window.removeEventListener('online', handleStatusChange);
      window.removeEventListener('offline', handleStatusChange);
    };
  }, []);

  useEffect(() => {
    const handler = (e: any) => {
      console.log('beforeinstallprompt event fired');
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);
    
    // Debug: check if app is already installed or standalone
    if (window.matchMedia('(display-mode: standalone)').matches) {
      console.log('App is running in standalone mode');
    }

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstallApp = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
    }
  };

  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [registerForm, setRegisterForm] = useState({ storeName: '', username: '', password: '' });
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!registerForm.storeName || !registerForm.username || !registerForm.password) {
      setLoginError("Preencha todos os campos.");
      return;
    }
    setIsRegistering(true);
    setLoginError(null);
    try {
      const tenantId = 'T_' + Math.random().toString(36).substr(2, 6).toUpperCase();
      const res = await OnlineDB.createTenant({
        id: tenantId,
        storeName: registerForm.storeName,
        adminUsername: registerForm.username,
        adminPasswordPlain: registerForm.password,
        logoUrl: null,
        phoneNumber: ''
      });

      if (res.success) {
        setLoginForm({ username: registerForm.username, password: registerForm.password });
        setIsRegisterMode(false);
        setLoginError("Loja criada com sucesso! Faça login para começar seus 7 dias grátis.");
      } else {
        setLoginError(res.message || "Erro ao criar loja.");
      }
    } catch (e) {
      setLoginError("Erro de conexão.");
    } finally {
      setIsRegistering(false);
    }
  };

  useEffect(() => {
    const restoreSession = async () => {
      try {
        const storedSession = localStorage.getItem('session_pro');
        const storedUser = localStorage.getItem('currentUser_pro');
        
        if (storedSession) {
          const parsed = JSON.parse(storedSession);
          if (parsed.isSuper) {
            setSession({
            isLoggedIn: true,
            type: 'super'
          });
          } else if (parsed.tenantId) {
            const user = storedUser ? JSON.parse(storedUser) : null;
            setSession({
              isLoggedIn: true,
              type: parsed.type || 'admin',
              tenantId: parsed.tenantId,
              user: user,
              subscriptionStatus: parsed.subscriptionStatus,
              subscriptionExpiresAt: parsed.subscriptionExpiresAt,
              customMonthlyPrice: parsed.customMonthlyPrice,
              customQuarterlyPrice: parsed.customQuarterlyPrice,
              customYearlyPrice: parsed.customYearlyPrice,
              lastPlanType: parsed.lastPlanType,
              enabledFeatures: parsed.enabledFeatures,
              maxUsers: parsed.maxUsers,
              maxOS: parsed.maxOS,
              maxProducts: parsed.maxProducts,
              printerSize: parsed.printerSize
            });
          }
        }
      } catch (e) {
        console.error("Erro ao restaurar sessão:", e);
      } finally {
        setIsInitializing(false);
      }
    };
    restoreSession();
  }, []);

  const loadData = useCallback(async (tenantId: string) => {
    try {
      setIsCloudConnected(navigator.onLine);
      
      // Tenta puxar dados novos se estiver online
      if (navigator.onLine) {
        const cloudData = await OfflineSync.pullAllData(tenantId);
        if (cloudData) {
          const finalSettings = { ...DEFAULT_SETTINGS, ...cloudData.settings };
          if (session?.printerSize) {
            finalSettings.printerSize = session.printerSize;
          }
          finalSettings.users = cloudData.users || [];
          setSettings(finalSettings);
          setOrders(cloudData.orders || []);
          setProducts(cloudData.products || []);
          setSales(cloudData.sales || []);
          setTransactions(cloudData.transactions || []);
          return;
        }
      }

      // Se offline ou falha no pull, carrega local
      const localData = await OfflineSync.getLocalData(tenantId);
      const finalSettings = { ...DEFAULT_SETTINGS, ...(localData.settings || {}) };
      finalSettings.users = localData.users || [];
      setSettings(finalSettings);
      setOrders(localData.orders || []);
      setProducts(localData.products || []);
      setSales(localData.sales || []);
      setTransactions(localData.transactions || []);
    } catch (e) {
      console.error("Erro ao carregar dados:", e);
      setIsCloudConnected(false);
      const localData = await OfflineSync.getLocalData(tenantId);
      const finalSettings = { ...DEFAULT_SETTINGS, ...(localData.settings || {}) };
      finalSettings.users = localData.users || [];
      setSettings(finalSettings);
      setOrders(localData.orders || []);
      setProducts(localData.products || []);
      setSales(localData.sales || []);
      setTransactions(localData.transactions || []);
    }
  }, []);

  useEffect(() => {
    if (session?.isLoggedIn && session.tenantId) {
      loadData(session.tenantId);
    }
  }, [session?.isLoggedIn, session?.tenantId, loadData]);

  useEffect(() => {
    if (!session?.isLoggedIn || session.type === 'super' || !session.tenantId) return;

    const deviceId = localStorage.getItem('device_id') || '';
    const maxUsers = session.maxUsers || 1;

    const interval = setInterval(async () => {
      if (!navigator.onLine) return;
      const res = await OnlineDB.heartbeatSession(session.tenantId!, deviceId, maxUsers);
      if (res && res.kicked) {
        handleLogout();
        alert("Sua sessão foi encerrada porque o limite de acessos simultâneos da loja foi atingido por outro dispositivo.");
      }
    }, 2 * 60 * 1000); // Heartbeat a cada 2 minutos

    return () => clearInterval(interval);
  }, [session]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    setIsLoggingIn(true);
    
    try {
      const result = await OnlineDB.login(loginForm.username, loginForm.password);
      
      if (result.success) {
        if (result.type === 'super') {
          const superSession = { isLoggedIn: true, type: 'super', isSuper: true };
          localStorage.setItem('session_pro', JSON.stringify(superSession));
          setSession(superSession as any);
        } else {
          const tenantId = result.tenant?.id;
          const maxUsers = result.tenant?.maxUsers || 1;
          const deviceId = localStorage.getItem('device_id') || '';
          
          const sessionRes = await OnlineDB.checkAndRegisterSession(tenantId, maxUsers, deviceId, loginForm.username);
          if (!sessionRes.success) {
            setLoginError(sessionRes.message);
            setIsLoggingIn(false);
            return;
          }

          const newSession = { 
              isLoggedIn: true, 
              type: result.type as any, 
              tenantId: tenantId,
              isSuper: false,
              subscriptionStatus: result.tenant?.subscriptionStatus,
              subscriptionExpiresAt: result.tenant?.subscriptionExpiresAt,
              customMonthlyPrice: result.tenant?.customMonthlyPrice,
              customQuarterlyPrice: result.tenant?.customQuarterlyPrice,
              customYearlyPrice: result.tenant?.customYearlyPrice,
              lastPlanType: result.tenant?.lastPlanType,
              enabledFeatures: result.tenant?.enabledFeatures,
              maxUsers: result.tenant?.maxUsers,
              maxOS: result.tenant?.maxOS,
              maxProducts: result.tenant?.maxProducts,
              printerSize: result.tenant?.printerSize
            };
          const finalUser = { 
            id: result.tenant?.id || 'temp', 
            name: result.tenant?.name || result.tenant?.username || 'Administrador', 
            role: result.type as any, 
            photo: null 
          };
          localStorage.setItem('session_pro', JSON.stringify(newSession));
          localStorage.setItem('currentUser_pro', JSON.stringify(finalUser));
          setSession({ ...newSession, user: finalUser });
        }
      } else {
        setLoginError(result.message || "Acesso negado.");
      }
    } catch (err) {
      setLoginError("Erro de rede. Verifique sua conexão.");
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLoginAs = async (tenantId: string) => {
    const tenant = await OnlineDB.getTenantById(tenantId);
    if (tenant) {
      const newSession = {
        isLoggedIn: true,
        type: 'admin' as const,
        tenantId: tenant.id,
        isSuper: false,
        subscriptionStatus: tenant.subscription_status,
        subscriptionExpiresAt: tenant.subscription_expires_at,
        customMonthlyPrice: tenant.custom_monthly_price,
        customQuarterlyPrice: tenant.custom_quarterly_price,
        customYearlyPrice: tenant.custom_yearly_price,
        lastPlanType: tenant.last_plan_type,
        enabledFeatures: tenant.enabled_features,
        maxUsers: tenant.max_users,
        maxOS: tenant.tenant_limits?.max_os,
        maxProducts: tenant.tenant_limits?.max_products,
      };
      const finalUser = {
        id: tenant.users.find((u: any) => u.role === 'admin')?.id || 'admin',
        name: tenant.users.find((u: any) => u.role === 'admin')?.name || 'Admin',
        role: 'admin' as const,
        photo: null,
      };
      localStorage.setItem('session_pro', JSON.stringify(newSession));
      localStorage.setItem('currentUser_pro', JSON.stringify(finalUser));
      setSession({ ...newSession, user: finalUser });
    }
  };

  const handleLogout = async () => {
    if (session?.tenantId) {
      const deviceId = localStorage.getItem('device_id') || '';
      await OnlineDB.removeSession(session.tenantId, deviceId);
    }
    localStorage.removeItem('session_pro');
    localStorage.removeItem('currentUser_pro');
    setSession(null);
    setSettings(null);
    setOrders([]);
    setProducts([]);
    setSales([]);
    setActiveTab('os');
    setIsLogoutModalOpen(false);
    setLogoutPassword('');
  };

  const confirmLogout = async () => {
    if (!session?.tenantId) return handleLogout();
    setIsVerifyingLogout(true);
    setLogoutError(false);
    
    const result = await OnlineDB.verifyAdminPassword(session.tenantId, logoutPassword);
    if (result.success) {
      handleLogout();
    } else {
      setLogoutError(true);
      setLogoutPassword('');
      setTimeout(() => setLogoutError(false), 2000);
    }
    setIsVerifyingLogout(false);
  };

  const saveSettings = async (newSettings: AppSettings) => {
    setSettings(newSettings);
    if (session?.tenantId) {
      await OfflineSync.saveSettings(session.tenantId, newSettings);
    }
  };

  const saveOrders = async (newOrders: ServiceOrder[]) => {
    setOrders(newOrders);
    if (session?.tenantId) {
      // Identifica o que mudou para salvar individualmente no OfflineSync
      // Para simplificar, vamos salvar a lista toda localmente e tentar sincronizar
      // Mas o ideal é salvar apenas o item novo/editado.
      // Como o app usa o padrão de passar a lista toda, vamos iterar ou salvar a lista.
      // Ajuste: OfflineSync.saveOrder agora suporta salvar o estado atual.
      for (const order of newOrders) {
        await OfflineSync.saveOrder(session.tenantId, order);
      }
    }
  };

  const removeOrder = async (id: string) => {
    if (session?.tenantId) {
      const updated = orders.map(o => o.id === id ? { ...o, isDeleted: true } : o);
      setOrders(updated);
      await OfflineSync.deleteOrder(session.tenantId, id);
    }
  };

  const saveProducts = async (newProducts: Product[]) => {
    setProducts(newProducts);
    if (session?.tenantId) {
      for (const product of newProducts) {
        await OfflineSync.saveProduct(session.tenantId, product);
      }
    }
  };

  const removeProduct = async (id: string) => {
    const updated = products.filter(p => p.id !== id);
    setProducts(updated);
    if (session?.tenantId) {
      await OfflineSync.deleteProduct(session.tenantId, id);
    }
  };

  const saveSales = async (newSales: Sale[]) => {
    setSales(newSales);
    if (session?.tenantId) {
      for (const sale of newSales) {
        await OfflineSync.saveSale(session.tenantId, sale);
      }
    }
  };

  const removeSale = async (sale: Sale) => {
    if (!session?.tenantId) return;
    const updatedSales = sales.map(s => s.id === sale.id ? { ...s, isDeleted: true } : s);
    setSales(updatedSales);
    const updatedProducts = products.map(p => {
      if (p.id === sale.productId) {
        return { ...p, quantity: p.quantity + sale.quantity };
      }
      return p;
    });
    setProducts(updatedProducts);
    
    await Promise.all([
      OfflineSync.deleteSale(session.tenantId, sale.id),
      ...updatedProducts.map(p => OfflineSync.saveProduct(session.tenantId!, p))
    ]);
  };

  const saveTransactions = async (newTransactions: Transaction[]) => {
    setTransactions(newTransactions);
    if (session?.tenantId) {
      for (const transaction of newTransactions) {
        await OfflineSync.saveTransaction(session.tenantId, transaction);
      }
    }
  };

  const removeTransaction = async (id: string) => {
    if (!session?.tenantId) return;
    const updated = transactions.map(t => t.id === id ? { ...t, isDeleted: true } : t);
    setTransactions(updated);
    await OfflineSync.deleteTransaction(session.tenantId, id);
  };

  const handleSwitchProfile = (user: User) => {
    if (session) {
      const newType = user.role;
      setSession({ ...session, user, type: newType });
      localStorage.setItem('currentUser_pro', JSON.stringify(user));
      const allowedTabs = navItems.filter(item => item.roles.includes(newType)).map(i => i.id);
      if (!allowedTabs.includes(activeTab)) {
        setActiveTab('os');
      }
    }
  };

  if (catalogTenantId || catalogSlug) {
    return <CustomerCatalog tenantId={catalogTenantId} catalogSlug={catalogSlug} />;
  }

  if (isInitializing) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center gap-4">
        <Loader2 className="animate-spin text-blue-500" size={40} />
        <p className="text-[10px] font-black text-blue-500 uppercase tracking-[0.3em]">Validando Sistema...</p>
      </div>
    );
  }

  if (!session?.isLoggedIn) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 font-sans">
        <div className="w-full max-w-sm space-y-8 animate-in fade-in zoom-in-95 duration-700">
          <div className="text-center space-y-4">
            <div className="w-20 h-20 bg-blue-600 rounded-[2.5rem] flex items-center justify-center mx-auto shadow-2xl border border-white/10">
              <Smartphone size={40} className="text-white" />
            </div>
            <h1 className="text-3xl font-black text-white tracking-tighter uppercase">LOJAS CLOUD</h1>
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
              {isRegisterMode ? 'Crie sua loja grátis por 7 dias' : 'sua loja nas nuvens'}
            </p>
          </div>

          {isRegisterMode ? (
            <form onSubmit={handleRegister} className="bg-white/5 p-8 rounded-[3rem] border border-white/10 space-y-4 shadow-2xl">
              <div className="space-y-1">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-4">Nome da Loja</label>
                <input type="text" value={registerForm.storeName} onChange={e => setRegisterForm({...registerForm, storeName: e.target.value})} className="w-full bg-white/5 border border-white/5 rounded-2xl p-4 font-bold text-white outline-none focus:border-blue-500 transition-colors text-xs" placeholder="Ex: Tech Cell" />
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-4">Usuário Administrador</label>
                <input type="text" value={registerForm.username} onChange={e => setRegisterForm({...registerForm, username: e.target.value.toLowerCase()})} className="w-full bg-white/5 border border-white/5 rounded-2xl p-4 font-bold text-white outline-none focus:border-blue-500 transition-colors text-xs" placeholder="Seu usuário" />
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-4">Senha</label>
                <input type="password" value={registerForm.password} onChange={e => setRegisterForm({...registerForm, password: e.target.value})} className="w-full bg-white/5 border border-white/5 rounded-2xl p-4 font-bold text-white outline-none focus:border-blue-500 transition-colors text-xs" placeholder="••••••" />
              </div>
              {loginError && (
                <div className="flex items-center gap-2 text-red-400 bg-red-400/10 p-3 rounded-xl border border-red-400/20">
                  <ShieldCheck size={14} className="shrink-0" />
                  <p className="text-[9px] font-black uppercase tracking-tight">{loginError}</p>
                </div>
              )}
              <button type="submit" disabled={isRegistering} className="w-full bg-blue-600 text-white py-5 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-2xl active:scale-95 transition-all mt-4 disabled:opacity-50">
                {isRegistering ? <Loader2 className="animate-spin mx-auto" size={20} /> : 'Criar Minha Loja'}
              </button>
              <button type="button" onClick={() => { setIsRegisterMode(false); setLoginError(null); }} className="w-full text-slate-500 font-black uppercase text-[9px] tracking-widest hover:text-white transition-colors">
                Já tenho uma conta
              </button>
            </form>
          ) : (
            <form onSubmit={handleLogin} className="bg-white/5 p-8 rounded-[3rem] border border-white/10 space-y-4 shadow-2xl">
              <div className="space-y-1">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-4">Usuário / Login</label>
                <input type="text" autoFocus value={loginForm.username} onChange={e => setLoginForm({...loginForm, username: e.target.value.toLowerCase()})} className="w-full bg-white/5 border border-white/5 rounded-2xl p-4 font-bold text-white outline-none focus:border-blue-500 transition-colors text-xs" placeholder="Seu usuário" />
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-4">Senha</label>
                <input type="password" value={loginForm.password} onChange={e => setLoginForm({...loginForm, password: e.target.value})} className="w-full bg-white/5 border border-white/5 rounded-2xl p-4 font-bold text-white outline-none focus:border-blue-500 transition-colors text-xs" placeholder="••••••" />
              </div>
              {loginError && (
                <div className={`flex items-center gap-2 ${loginError.includes('sucesso') ? 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20' : 'text-red-400 bg-red-400/10 border-red-400/20'} p-3 rounded-xl border`}>
                  <ShieldCheck size={14} className="shrink-0" />
                  <p className="text-[9px] font-black uppercase tracking-tight">{loginError}</p>
                </div>
              )}
              <button type="submit" disabled={isLoggingIn} className="w-full bg-blue-600 text-white py-5 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-2xl active:scale-95 transition-all mt-4 disabled:opacity-50">
                {isLoggingIn ? <Loader2 className="animate-spin mx-auto" size={20} /> : 'Acessar Sistema'}
              </button>
              <button type="button" onClick={() => { setIsRegisterMode(true); setLoginError(null); }} className="w-full text-slate-500 font-black uppercase text-[9px] tracking-widest hover:text-white transition-colors">
                Criar nova loja grátis
              </button>
            </form>
          )}
        </div>
      </div>
    );
  }

  if (session.type === 'super') return <SuperAdminDashboard onLogout={handleLogout} onLoginAs={handleLoginAs} />;

  if (session.subscriptionStatus === 'expired' || isSubscriptionModalOpen) {
    return (
      <>
        <SubscriptionView 
          tenantId={session.tenantId!} 
          storeName={settings?.storeName || 'Sua Loja'} 
          expiresAt={session.subscriptionExpiresAt!}
          customMonthlyPrice={session.customMonthlyPrice}
          customQuarterlyPrice={session.customQuarterlyPrice}
          customYearlyPrice={session.customYearlyPrice}
          onLogout={() => setIsLogoutModalOpen(true)}
          onClose={session.subscriptionStatus !== 'expired' ? () => setIsSubscriptionModalOpen(false) : undefined}
          onSuccess={(newExpiresAt) => {
            const updatedSession = { ...session, subscriptionStatus: 'active', subscriptionExpiresAt: newExpiresAt };
            setSession(updatedSession);
            localStorage.setItem('session_pro', JSON.stringify(updatedSession));
            setIsSubscriptionModalOpen(false);
          }}
        />
        {isLogoutModalOpen && (
          <div className="fixed inset-0 bg-slate-950/90 z-[300] flex items-center justify-center p-6 backdrop-blur-xl animate-in fade-in">
             <div className="bg-white w-full max-w-xs rounded-[3rem] p-10 shadow-2xl animate-in zoom-in-95 border border-slate-100">
                <div className="w-20 h-20 bg-red-50 text-red-600 rounded-[2.5rem] flex items-center justify-center mx-auto mb-8 shadow-inner">
                   <LogOut size={36} />
                </div>
                <h3 className="text-center font-black text-slate-800 uppercase text-sm mb-1">Confirmar Saída</h3>
                <p className="text-center text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-10 leading-tight">Para deslogar, digite a<br/>senha do ADM da Loja</p>
                
                <div className={`flex items-center gap-3 bg-slate-50 border rounded-2xl px-5 py-5 mb-4 transition-all ${logoutError ? 'border-red-500 bg-red-50 ring-4 ring-red-100' : 'border-slate-100 focus-within:border-blue-500'}`}>
                   <KeyRound size={20} className={logoutError ? 'text-red-500' : 'text-slate-300'} />
                   <input 
                     type="password" 
                     autoFocus
                     value={logoutPassword}
                     onChange={(e) => setLogoutPassword(e.target.value)}
                     onKeyDown={(e) => e.key === 'Enter' && confirmLogout()}
                     placeholder="SENHA DO ADM"
                     className="bg-transparent w-full outline-none font-black text-sm uppercase placeholder:text-slate-200"
                   />
                </div>
                
                {logoutError && <p className="text-center text-[9px] font-black text-red-500 uppercase mb-4 animate-bounce">Senha Incorreta!</p>}

                <div className="flex flex-col gap-2">
                   <button onClick={confirmLogout} disabled={isVerifyingLogout} className="w-full py-5 bg-red-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl shadow-red-500/20 active:scale-95 transition-all flex items-center justify-center disabled:opacity-50">
                     {isVerifyingLogout ? <Loader2 size={18} className="animate-spin" /> : 'Confirmar Saída'}
                   </button>
                   <button onClick={() => { setIsLogoutModalOpen(false); setLogoutPassword(''); }} className="w-full py-4 text-slate-400 font-black uppercase text-[10px] tracking-widest">Cancelar</button>
                </div>
             </div>
          </div>
        )}
      </>
    );
  }

  if (!settings) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center gap-6 p-10 text-center">
        <div className="w-16 h-16 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin"></div>
        <p className="text-blue-600 font-black uppercase tracking-[0.3em] text-xs">Sincronizando Dados</p>
        <button onClick={() => setIsLogoutModalOpen(true)} className="text-[10px] font-black text-red-400 uppercase tracking-widest mt-10">Sair</button>
        {isLogoutModalOpen && (
          <div className="fixed inset-0 bg-slate-950/90 z-[300] flex items-center justify-center p-6 backdrop-blur-xl animate-in fade-in">
             <div className="bg-white w-full max-w-xs rounded-[3rem] p-10 shadow-2xl animate-in zoom-in-95 border border-slate-100">
                <div className="w-20 h-20 bg-red-50 text-red-600 rounded-[2.5rem] flex items-center justify-center mx-auto mb-8 shadow-inner">
                   <LogOut size={36} />
                </div>
                <h3 className="text-center font-black text-slate-800 uppercase text-sm mb-1">Confirmar Saída</h3>
                <p className="text-center text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-10 leading-tight">Para deslogar, digite a<br/>senha do ADM da Loja</p>
                
                <div className={`flex items-center gap-3 bg-slate-50 border rounded-2xl px-5 py-5 mb-4 transition-all ${logoutError ? 'border-red-500 bg-red-50 ring-4 ring-red-100' : 'border-slate-100 focus-within:border-blue-500'}`}>
                   <KeyRound size={20} className={logoutError ? 'text-red-500' : 'text-slate-300'} />
                   <input 
                     type="password" 
                     autoFocus
                     value={logoutPassword}
                     onChange={(e) => setLogoutPassword(e.target.value)}
                     onKeyDown={(e) => e.key === 'Enter' && confirmLogout()}
                     placeholder="SENHA DO ADM"
                     className="bg-transparent w-full outline-none font-black text-sm uppercase placeholder:text-slate-200"
                   />
                </div>
                
                {logoutError && <p className="text-center text-[9px] font-black text-red-500 uppercase mb-4 animate-bounce">Senha Incorreta!</p>}

                <div className="flex flex-col gap-2">
                   <button onClick={confirmLogout} disabled={isVerifyingLogout} className="w-full py-5 bg-red-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl shadow-red-500/20 active:scale-95 transition-all flex items-center justify-center disabled:opacity-50">
                     {isVerifyingLogout ? <Loader2 size={18} className="animate-spin" /> : 'Confirmar Saída'}
                   </button>
                   <button onClick={() => { setIsLogoutModalOpen(false); setLogoutPassword(''); }} className="w-full py-4 text-slate-400 font-black uppercase text-[10px] tracking-widest">Cancelar</button>
                </div>
             </div>
          </div>
        )}
      </div>
    );
  }

  const currentUser = session.user || settings.users[0];
  const navItems = [
    { id: 'os', label: 'Ordens', icon: Smartphone, roles: ['admin', 'colaborador'], feature: 'osTab' },
    { id: 'estoque', label: 'Estoque', icon: Package, roles: ['admin'], feature: 'stockTab' },
    { id: 'vendas', label: 'Vendas', icon: ShoppingCart, roles: ['admin', 'colaborador'], feature: 'salesTab' },
    { id: 'financeiro', label: 'Finanças', icon: BarChart3, roles: ['admin'], feature: 'financeTab' },
    { id: 'config', label: 'Ajustes', icon: Settings, roles: ['admin', 'colaborador'] },
  ];
  
  const visibleNavItems = navItems.filter(item => {
    const roleAllowed = item.roles.includes(currentUser.role);
    const featureAllowed = !item.feature || (session.enabledFeatures as any)?.[item.feature] !== false;
    return roleAllowed && featureAllowed;
  });

  return (
    <div className="min-h-screen bg-slate-50 font-sans flex flex-col md:flex-row">
      <aside className={`hidden md:flex flex-col ${isSidebarCollapsed ? 'w-24' : 'w-72'} bg-slate-900 text-white p-6 h-screen sticky top-0 overflow-y-auto transition-all duration-300 ease-in-out`}>
        <div className={`flex items-center ${isSidebarCollapsed ? 'justify-center' : 'justify-between'} mb-12`}>
          {!isSidebarCollapsed && (
            <div className="flex items-center gap-4 overflow-hidden animate-in fade-in">
              <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shrink-0">
                {settings.logoUrl ? <img src={settings.logoUrl} className="w-full h-full object-cover rounded-xl" /> : <Smartphone size={20} />}
              </div>
              <h1 className="text-sm font-black tracking-tighter uppercase leading-tight truncate">{settings.storeName}</h1>
            </div>
          )}
          <button onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)} className="p-2 text-slate-400 hover:text-white hover:bg-white/5 rounded-xl transition-all">
            {isSidebarCollapsed ? <Menu size={24} /> : <X size={20} />}
          </button>
        </div>
        <nav className="flex-1 space-y-2">
          {visibleNavItems.map(item => (
            <button key={item.id} onClick={() => setActiveTab(item.id as Tab)} className={`w-full flex items-center ${isSidebarCollapsed ? 'justify-center px-0' : 'gap-4 px-6'} py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all ${activeTab === item.id ? 'bg-blue-600 text-white shadow-xl' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}>
              <item.icon size={20} className="shrink-0" />
              {!isSidebarCollapsed && <span className="animate-in fade-in whitespace-nowrap">{item.label}</span>}
            </button>
          ))}
        </nav>
        <div className="mt-8 pt-8 border-t border-white/5">
          <div className={`flex items-center ${isSidebarCollapsed ? 'justify-center px-0' : 'gap-3 px-4'} mb-6`}>
            <div className="w-10 h-10 bg-slate-800 rounded-xl overflow-hidden border border-white/10 shrink-0">
              {currentUser.photo ? <img src={currentUser.photo} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-slate-600 font-black text-xs">?</div>}
            </div>
            {!isSidebarCollapsed && (
              <div className="min-w-0 animate-in fade-in">
                <p className="text-[9px] font-black uppercase text-white truncate">{currentUser.name}</p>
                <p className="text-[7px] font-bold uppercase text-slate-500 truncate">{currentUser.specialty || (currentUser.role === 'admin' ? 'Administrador' : 'Colaborador')}</p>
              </div>
            )}
          </div>
          <button onClick={() => setIsLogoutModalOpen(true)} className={`w-full flex items-center ${isSidebarCollapsed ? 'justify-center px-0' : 'gap-4 px-6'} py-4 text-slate-500 hover:text-red-400 font-black text-[10px] uppercase tracking-widest transition-colors`}>
            <LogOut size={20} className="shrink-0" />
            {!isSidebarCollapsed && <span className="animate-in fade-in">Sair</span>}
          </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        {(session.subscriptionStatus === 'trial' || session.enabledFeatures?.promoBanner) && (
          <div 
            onClick={() => setIsSubscriptionModalOpen(true)}
            className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-4 py-3 text-center cursor-pointer hover:from-blue-700 hover:to-indigo-700 transition-all shrink-0 shadow-md z-10 flex items-center justify-center gap-2"
          >
            <span className="text-[10px] sm:text-xs font-black uppercase tracking-widest">
              {session.subscriptionStatus === 'trial' ? 'Você está no período de teste. Clique aqui para assinar e não perder o acesso!' : 'Aproveite nossas ofertas exclusivas! Clique aqui para ver os planos.'}
            </span>
          </div>
        )}
        <div className="flex-1 overflow-y-auto p-4 pt-4 pb-28 md:pt-10 md:pb-4 max-w-7xl mx-auto w-full animate-in fade-in duration-700">
          {activeTab === 'os' && <ServiceOrderTab orders={orders.filter(o => !o.isDeleted)} setOrders={saveOrders} settings={settings} onUpdateSettings={saveSettings} onDeleteOrder={removeOrder} tenantId={session.tenantId || ''} maxOS={session.maxOS} />}
          {activeTab === 'estoque' && <StockTab products={products} setProducts={saveProducts} onDeleteProduct={removeProduct} settings={settings} onUpdateSettings={saveSettings} maxProducts={session.maxProducts} />}
          {activeTab === 'vendas' && <SalesTab products={products} setProducts={saveProducts} sales={sales.filter(s => !s.isDeleted)} setSales={saveSales} settings={settings} onUpdateSettings={saveSettings} currentUser={currentUser} onDeleteSale={removeSale} tenantId={session.tenantId || ''} />}
          {activeTab === 'financeiro' && <FinanceTab orders={orders} sales={sales} products={products} transactions={transactions} setTransactions={saveTransactions} onDeleteTransaction={removeTransaction} onDeleteSale={removeSale} tenantId={session.tenantId || ''} settings={settings} enabledFeatures={session.enabledFeatures} />}
          {activeTab === 'config' && <SettingsTab products={products} setProducts={saveProducts} settings={settings} setSettings={saveSettings} isCloudConnected={isCloudConnected} currentUser={currentUser} onSwitchProfile={handleSwitchProfile} tenantId={session.tenantId} deferredPrompt={deferredPrompt} onInstallApp={handleInstallApp} subscriptionStatus={session.subscriptionStatus} subscriptionExpiresAt={session.subscriptionExpiresAt} lastPlanType={session.lastPlanType} enabledFeatures={session.enabledFeatures} maxUsers={session.maxUsers} maxOS={session.maxOS} maxProducts={session.maxProducts} onLogout={() => setIsLogoutModalOpen(true)} />}
        </div>
      </main>

      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-100 px-6 py-4 flex justify-between items-center z-40">
        {visibleNavItems.map(item => (
          <button key={item.id} onClick={() => setActiveTab(item.id as Tab)} className={`p-2 transition-all ${activeTab === item.id ? 'text-blue-600 scale-110' : 'text-slate-300'}`}>
            <item.icon size={24} strokeWidth={activeTab === item.id ? 3 : 2} />
          </button>
        ))}
      </nav>

      {isSidebarOpen && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 animate-in fade-in flex justify-end">
          <div className="w-[85vw] max-w-[280px] h-full bg-slate-950 p-5 flex flex-col shadow-2xl animate-in slide-in-from-right duration-300 border-l border-white/5 overflow-hidden">
            <div className="flex justify-end mb-6 shrink-0">
              <button onClick={() => setIsSidebarOpen(false)} className="p-2 text-slate-400 hover:text-white transition-colors bg-white/5 rounded-full active:scale-90">
                <X size={20} />
              </button>
            </div>

            <div className="flex items-center gap-3 p-3 bg-white/5 rounded-2xl mb-6 border border-white/5 shrink-0">
              <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-lg shrink-0">
                {settings.logoUrl ? <img src={settings.logoUrl} className="w-full h-full object-cover rounded-xl" /> : <Smartphone size={20} />}
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-[10px] font-black text-white uppercase tracking-tight truncate">{settings.storeName}</h3>
                <p className="text-[8px] font-bold text-slate-500 uppercase tracking-widest truncate">
                  {currentUser.role === 'admin' ? 'Administrador' : 'Colaborador'}
                </p>
              </div>
            </div>

            <nav className="flex-1 space-y-1.5 overflow-y-auto overflow-x-hidden pr-1">
               {visibleNavItems.map(item => (
                <button 
                  key={item.id} 
                  onClick={() => { setActiveTab(item.id as Tab); setIsSidebarOpen(false); }} 
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${
                    activeTab === item.id 
                      ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20' 
                      : 'text-slate-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <item.icon size={18} className={activeTab === item.id ? 'animate-pulse' : ''} />
                  {item.label}
                </button>
              ))}
            </nav>

            <div className="mt-4 pt-4 border-t border-white/5 shrink-0">
              <button 
                onClick={() => setIsLogoutModalOpen(true)} 
                className="w-full flex items-center justify-center gap-2 px-6 py-3.5 text-red-500 font-black text-[10px] uppercase tracking-widest border border-red-500/10 rounded-xl bg-red-500/5 hover:bg-red-500/10 transition-all active:scale-95"
              >
                <LogOut size={16} /> 
                Sair
              </button>
            </div>
          </div>
        </div>
      )}
      {isLogoutModalOpen && (
        <div className="fixed inset-0 bg-slate-950/90 z-[300] flex items-center justify-center p-6 backdrop-blur-xl animate-in fade-in">
           <div className="bg-white w-full max-w-xs rounded-[3rem] p-10 shadow-2xl animate-in zoom-in-95 border border-slate-100">
              <div className="w-20 h-20 bg-red-50 text-red-600 rounded-[2.5rem] flex items-center justify-center mx-auto mb-8 shadow-inner">
                 <LogOut size={36} />
              </div>
              <h3 className="text-center font-black text-slate-800 uppercase text-sm mb-1">Confirmar Saída</h3>
              <p className="text-center text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-10 leading-tight">Para deslogar, digite a<br/>senha do ADM da Loja</p>
              
              <div className={`flex items-center gap-3 bg-slate-50 border rounded-2xl px-5 py-5 mb-4 transition-all ${logoutError ? 'border-red-500 bg-red-50 ring-4 ring-red-100' : 'border-slate-100 focus-within:border-blue-500'}`}>
                 <KeyRound size={20} className={logoutError ? 'text-red-500' : 'text-slate-300'} />
                 <input 
                   type="password" 
                   autoFocus
                   value={logoutPassword}
                   onChange={(e) => setLogoutPassword(e.target.value)}
                   onKeyDown={(e) => e.key === 'Enter' && confirmLogout()}
                   placeholder="SENHA DO ADM"
                   className="bg-transparent w-full outline-none font-black text-sm uppercase placeholder:text-slate-200"
                 />
              </div>
              
              {logoutError && <p className="text-center text-[9px] font-black text-red-500 uppercase mb-4 animate-bounce">Senha Incorreta!</p>}

              <div className="flex flex-col gap-2">
                 <button onClick={confirmLogout} disabled={isVerifyingLogout} className="w-full py-5 bg-red-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl shadow-red-500/20 active:scale-95 transition-all flex items-center justify-center disabled:opacity-50">
                   {isVerifyingLogout ? <Loader2 size={18} className="animate-spin" /> : 'Confirmar Saída'}
                 </button>
                 <button onClick={() => { setIsLogoutModalOpen(false); setLogoutPassword(''); }} className="w-full py-4 text-slate-400 font-black uppercase text-[10px] tracking-widest">Cancelar</button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default App;
