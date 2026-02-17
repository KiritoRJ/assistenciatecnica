
import React, { useState, useEffect, useCallback } from 'react';
import { Smartphone, Package, ShoppingCart, BarChart3, Settings, LogOut, Menu, X, Loader2, ShieldCheck } from 'lucide-react';
import { ServiceOrder, Product, Sale, AppSettings, User } from './types';
import ServiceOrderTab from './components/ServiceOrderTab';
import StockTab from './components/StockTab';
import SalesTab from './components/SalesTab';
import FinanceTab from './components/FinanceTab';
import SettingsTab from './components/SettingsTab';
import SuperAdminDashboard from './components/SuperAdminDashboard';
import { OnlineDB } from './utils/api';
import { getData, saveData } from './utils/db';

type Tab = 'os' | 'estoque' | 'vendas' | 'financeiro' | 'config';

const DEFAULT_SETTINGS: AppSettings = {
  storeName: 'Minha Assistência',
  logoUrl: null,
  users: [
    { id: 'admin_1', name: 'Administrador', role: 'admin', photo: null }
  ],
  isConfigured: true,
  themePrimary: '#2563eb',
  themeSidebar: '#0f172a',
  themeBg: '#f8fafc',
  themeBottomTab: '#0f172a',
  pdfWarrantyText: "Concede-se garantia pelo prazo de 90 (noventa) dias contra defeitos de fabricação ou do serviço executado. A garantia não cobre danos por mau uso, contato com líquidos ou quedas.",
  pdfFontSize: 8,
  pdfFontFamily: 'helvetica',
  pdfPaperWidth: 80,
  pdfTextColor: '#000000',
  pdfBgColor: '#FFFFFF'
};

const App: React.FC = () => {
  const [session, setSession] = useState<{ isLoggedIn: boolean; type: 'super' | 'admin' | 'tecnico' | 'vendedor'; tenantId?: string; user?: User } | null>(null);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [orders, setOrders] = useState<ServiceOrder[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [activeTab, setActiveTab] = useState<Tab>('os');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isCloudConnected, setIsCloudConnected] = useState(true);
  const [isInitializing, setIsInitializing] = useState(true);

  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  useEffect(() => {
    const restoreSession = async () => {
      try {
        const storedSession = localStorage.getItem('session_pro');
        const storedUser = localStorage.getItem('currentUser_pro');
        
        if (storedSession) {
          const parsed = JSON.parse(storedSession);
          if (parsed.isSuper) {
            setSession({ isLoggedIn: true, type: 'super' });
          } else if (parsed.tenantId) {
            const user = storedUser ? JSON.parse(storedUser) : null;
            setSession({
              isLoggedIn: true,
              type: parsed.type || 'admin',
              tenantId: parsed.tenantId,
              user: user
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
      const [cloudSettings, cloudOrders, cloudProducts, cloudSales] = await Promise.all([
        OnlineDB.syncPull(tenantId, 'settings'),
        OnlineDB.fetchOrders(tenantId),
        OnlineDB.fetchProducts(tenantId),
        OnlineDB.syncPull(tenantId, 'sales')
      ]);

      const localSettings = await getData('settings', tenantId);

      if (cloudSettings) {
        setSettings(cloudSettings);
      } else if (localSettings) {
        setSettings(localSettings);
      } else {
        // LOJA NOVA: Aplica configurações padrão e salva na nuvem imediatamente
        setSettings(DEFAULT_SETTINGS);
        await saveData('settings', tenantId, DEFAULT_SETTINGS);
        await OnlineDB.syncPush(tenantId, 'settings', DEFAULT_SETTINGS);
      }

      setOrders(cloudOrders || []);
      setProducts(cloudProducts || []);
      setSales(cloudSales || []);
      setIsCloudConnected(true);
    } catch (e) {
      console.error("Erro no carregamento de dados:", e);
      setIsCloudConnected(false);
      
      const localSettings = await getData('settings', tenantId);
      const localOrders = await getData('orders', tenantId) || [];
      const localProducts = await getData('products', tenantId) || [];
      const localSales = await getData('sales', tenantId) || [];

      setSettings(localSettings || DEFAULT_SETTINGS);
      setOrders(localOrders);
      setProducts(localProducts);
      setSales(localSales);
    }
  }, []);

  useEffect(() => {
    if (session?.isLoggedIn && session.tenantId) {
      loadData(session.tenantId);
    }
  }, [session?.isLoggedIn, session?.tenantId, loadData]);

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
          
          const newSession = { 
            isLoggedIn: true, 
            type: result.type as any, 
            tenantId: tenantId,
            isSuper: false
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

  const handleLogout = () => {
    localStorage.removeItem('session_pro');
    localStorage.removeItem('currentUser_pro');
    setSession(null);
    setSettings(null);
    setOrders([]);
    setProducts([]);
    setSales([]);
    setActiveTab('os');
  };

  const saveSettings = async (newSettings: AppSettings) => {
    setSettings(newSettings);
    if (session?.tenantId) {
      await saveData('settings', session.tenantId, newSettings);
      await OnlineDB.syncPush(session.tenantId, 'settings', newSettings);
    }
  };

  const saveOrders = async (newOrders: ServiceOrder[]) => {
    setOrders(newOrders);
    if (session?.tenantId) {
      await saveData('orders', session.tenantId, newOrders);
      await OnlineDB.upsertOrders(session.tenantId, newOrders);
    }
  };

  const removeOrder = async (id: string) => {
    const updated = orders.filter(o => o.id !== id);
    setOrders(updated);
    if (session?.tenantId) {
      await saveData('orders', session.tenantId, updated);
      await OnlineDB.deleteOS(id);
    }
  };

  const saveProducts = async (newProducts: Product[]) => {
    setProducts(newProducts);
    if (session?.tenantId) {
      await saveData('products', session.tenantId, newProducts);
      await OnlineDB.upsertProducts(session.tenantId, newProducts);
    }
  };

  const removeProduct = async (id: string) => {
    const updated = products.filter(p => p.id !== id);
    setProducts(updated);
    if (session?.tenantId) {
      await saveData('products', session.tenantId, updated);
      await OnlineDB.deleteProduct(id);
    }
  };

  const saveSales = async (newSales: Sale[]) => {
    setSales(newSales);
    if (session?.tenantId) {
      await saveData('sales', session.tenantId, newSales);
      await OnlineDB.syncPush(session.tenantId, 'sales', newSales);
    }
  };

  const handleSwitchProfile = (user: User) => {
    if (session) {
      setSession({ ...session, user, type: user.role });
      localStorage.setItem('currentUser_pro', JSON.stringify(user));
    }
  };

  if (isInitializing) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center gap-4">
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
            <h1 className="text-3xl font-black text-white tracking-tighter uppercase">Assistência Pro</h1>
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Login Centralizado SQL Cloud</p>
          </div>

          <form onSubmit={handleLogin} className="bg-white/5 p-8 rounded-[3rem] border border-white/10 space-y-4 shadow-2xl">
            <div className="space-y-1">
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-4">Usuário / Login</label>
              <input 
                type="text" 
                autoFocus
                value={loginForm.username}
                onChange={e => setLoginForm({...loginForm, username: e.target.value.toLowerCase()})}
                className="w-full bg-white/5 border border-white/5 rounded-2xl p-4 font-bold text-white outline-none focus:border-blue-500 transition-colors text-xs" 
                placeholder="Ex: wandev ou seu_login"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-4">Senha</label>
              <input 
                type="password" 
                value={loginForm.password}
                onChange={e => setLoginForm({...loginForm, password: e.target.value})}
                className="w-full bg-white/5 border border-white/5 rounded-2xl p-4 font-bold text-white outline-none focus:border-blue-500 transition-colors text-xs" 
                placeholder="••••••"
              />
            </div>
            
            {loginError && (
              <div className="flex items-center gap-2 text-red-400 bg-red-400/10 p-3 rounded-xl border border-red-400/20">
                <ShieldCheck size={14} className="shrink-0" />
                <p className="text-[9px] font-black uppercase tracking-tight">{loginError}</p>
              </div>
            )}

            <button type="submit" disabled={isLoggingIn} className="w-full bg-blue-600 text-white py-5 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-2xl active:scale-95 transition-all mt-4 disabled:opacity-50">
              {isLoggingIn ? <Loader2 className="animate-spin mx-auto" size={20} /> : 'Acessar Sistema'}
            </button>
          </form>
          <p className="text-center text-[8px] font-black text-slate-600 uppercase tracking-widest">Infraestrutura Wandev Global © 2024</p>
        </div>
      </div>
    );
  }

  if (session.type === 'super') {
    return <SuperAdminDashboard onLogout={handleLogout} />;
  }

  if (!settings) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center gap-6 p-10 text-center">
        <div className="w-16 h-16 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin"></div>
        <div className="space-y-2">
          <p className="text-white font-black uppercase tracking-[0.3em] text-xs">Sincronizando Dados</p>
          <p className="text-slate-500 text-[9px] font-bold uppercase">Carregando tabelas SQL da loja</p>
        </div>
        <button onClick={handleLogout} className="text-[10px] font-black text-red-400 uppercase tracking-widest mt-10">Sair</button>
      </div>
    );
  }

  const currentUser = session.user || settings.users[0];
  const navItems = [
    { id: 'os', label: 'Ordens', icon: Smartphone, roles: ['admin', 'tecnico'] },
    { id: 'estoque', label: 'Estoque', icon: Package, roles: ['admin', 'vendedor'] },
    { id: 'vendas', label: 'Vendas', icon: ShoppingCart, roles: ['admin', 'vendedor'] },
    { id: 'financeiro', label: 'Finanças', icon: BarChart3, roles: ['admin'] },
    { id: 'config', label: 'Ajustes', icon: Settings, roles: ['admin', 'tecnico', 'vendedor'] },
  ];

  const visibleNavItems = navItems.filter(item => item.roles.includes(currentUser.role));

  return (
    <div className="min-h-screen bg-slate-50 font-sans flex flex-col md:flex-row">
      <aside className="hidden md:flex flex-col w-72 bg-slate-900 text-white p-8 h-screen sticky top-0 overflow-y-auto">
        <div className="flex items-center gap-4 mb-12">
          <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg">
            {settings.logoUrl ? <img src={settings.logoUrl} className="w-full h-full object-cover rounded-2xl" /> : <Smartphone size={24} />}
          </div>
          <h1 className="text-xl font-black tracking-tighter uppercase leading-tight truncate">{settings.storeName}</h1>
        </div>
        <nav className="flex-1 space-y-2">
          {visibleNavItems.map(item => (
            <button key={item.id} onClick={() => setActiveTab(item.id as Tab)} className={`w-full flex items-center gap-4 px-6 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all ${activeTab === item.id ? 'bg-blue-600 text-white shadow-xl' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}>
              <item.icon size={20} />
              {item.label}
            </button>
          ))}
        </nav>
        
        <div className="mt-8 pt-8 border-t border-white/5">
          <div className="flex items-center gap-3 mb-6 px-4">
            <div className="w-10 h-10 bg-slate-800 rounded-xl overflow-hidden border border-white/10">
              {currentUser.photo ? <img src={currentUser.photo} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-slate-600 font-black text-xs">?</div>}
            </div>
            <div className="min-w-0">
              <p className="text-[9px] font-black uppercase text-white truncate">{currentUser.name}</p>
              <p className="text-[7px] font-bold uppercase text-slate-500">{currentUser.role}</p>
            </div>
          </div>
          <button onClick={handleLogout} className="w-full flex items-center gap-4 px-6 py-4 text-slate-500 hover:text-red-400 font-black text-[10px] uppercase tracking-widest transition-colors">
            <LogOut size={20} />
            Sair
          </button>
        </div>
      </aside>

      <header className="md:hidden fixed top-0 left-0 right-0 bg-white/80 backdrop-blur-md z-40 px-6 py-4 flex items-center justify-between border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-lg">
            {settings.logoUrl ? <img src={settings.logoUrl} className="w-full h-full object-cover rounded-xl" /> : <Smartphone size={20} />}
          </div>
          <h1 className="font-black text-slate-800 text-sm tracking-tighter uppercase truncate max-w-[150px]">{settings.storeName}</h1>
        </div>
        <button onClick={() => setIsSidebarOpen(true)} className="p-2 text-slate-400"><Menu size={24} /></button>
      </header>

      <main className="flex-1 p-4 pt-24 md:pt-10 max-w-7xl mx-auto w-full animate-in fade-in duration-700">
        {activeTab === 'os' && <ServiceOrderTab orders={orders} setOrders={saveOrders} settings={settings} onDeleteOrder={removeOrder} />}
        {activeTab === 'estoque' && <StockTab products={products} setProducts={saveProducts} onDeleteProduct={removeProduct} />}
        {activeTab === 'vendas' && <SalesTab products={products} setProducts={saveProducts} sales={sales} setSales={saveSales} settings={settings} currentUser={currentUser} />}
        {activeTab === 'financeiro' && <FinanceTab orders={orders} sales={sales} />}
        {activeTab === 'config' && <SettingsTab settings={settings} setSettings={saveSettings} isCloudConnected={isCloudConnected} currentUser={currentUser} onSwitchProfile={handleSwitchProfile} tenantId={session.tenantId} />}
      </main>

      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-100 px-6 py-4 flex justify-between items-center z-40">
        {visibleNavItems.map(item => (
          <button key={item.id} onClick={() => setActiveTab(item.id as Tab)} className={`p-2 transition-all ${activeTab === item.id ? 'text-blue-600 scale-110' : 'text-slate-300'}`}>
            <item.icon size={24} strokeWidth={activeTab === item.id ? 3 : 2} />
          </button>
        ))}
      </nav>

      {isSidebarOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 animate-in fade-in">
          <div className="absolute right-0 top-0 bottom-0 w-72 bg-slate-900 p-8 flex flex-col animate-in slide-in-from-right">
            <button onClick={() => setIsSidebarOpen(false)} className="self-end text-slate-400 mb-8"><X size={28} /></button>
            <div className="space-y-4">
              <div className="flex items-center gap-4 p-4 bg-white/5 rounded-2xl mb-8">
                {currentUser.photo ? <img src={currentUser.photo} className="w-12 h-12 rounded-xl object-cover" /> : <div className="w-12 h-12 bg-slate-800 rounded-xl" />}
                <div>
                  <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Acesso Ativo</p>
                  <p className="text-xs font-black text-white uppercase truncate max-w-[120px]">{currentUser.name}</p>
                </div>
              </div>
              <nav className="space-y-2 mb-10">
                 {visibleNavItems.map(item => (
                  <button key={item.id} onClick={() => { setActiveTab(item.id as Tab); setIsSidebarOpen(false); }} className={`w-full flex items-center gap-4 px-4 py-4 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${activeTab === item.id ? 'bg-blue-600 text-white shadow-xl' : 'text-slate-400'}`}>
                    <item.icon size={18} />
                    {item.label}
                  </button>
                ))}
              </nav>
              <button onClick={handleLogout} className="w-full flex items-center gap-4 px-6 py-4 text-red-400 font-black text-[10px] uppercase tracking-widest border border-red-400/20 rounded-xl bg-red-400/5">
                <LogOut size={20} /> Sair do Sistema
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
