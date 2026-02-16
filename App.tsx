
import React, { useState, useEffect } from 'react';
import { LayoutGrid, ClipboardList, Wallet, Settings as SettingsIcon, Package, ShoppingCart, User as UserIcon, LogOut, ShieldAlert, Lock, X, ShieldCheck, RefreshCw, Globe } from 'lucide-react';
import { ServiceOrder, AppSettings, Product, Sale, User, Tenant } from './types';
import ServiceOrderTab from './components/ServiceOrderTab';
import FinanceTab from './components/FinanceTab';
import SettingsTab from './components/SettingsTab';
import StockTab from './components/StockTab';
import SalesTab from './components/SalesTab';
import UserManagementTab from './components/UserManagementTab';
import SuperAdminDashboard from './components/SuperAdminDashboard';
import { getData, saveData, initDB } from './utils/db';
import { OnlineDB } from './utils/api';

const App: React.FC = () => {
  const [session, setSession] = useState<{ type: 'super' | 'admin' | null, tenantId?: string }>({ type: null });
  const [isLogged, setIsLogged] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  
  const [loginUser, setLoginUser] = useState('');
  const [loginPass, setLoginPass] = useState('');

  const [activeTab, setActiveTab] = useState<'os' | 'financeiro' | 'config' | 'estoque' | 'vendas' | 'usuarios'>('os');
  const [orders, setOrders] = useState<ServiceOrder[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [settings, setSettings] = useState<AppSettings | null>(null);

  useEffect(() => {
    if (session.type === 'admin' && session.tenantId) {
      fullSync(session.tenantId);
    }
  }, [session]);

  const fullSync = async (tid: string) => {
    setIsSyncing(true);
    try {
      // 1. Tenta baixar dados do banco ONLINE (Para caso o usuário esteja em um novo PC/Celular)
      const remoteOrders = await OnlineDB.syncPull(tid, 'orders');
      const remoteProducts = await OnlineDB.syncPull(tid, 'products');
      const remoteSales = await OnlineDB.syncPull(tid, 'sales');
      const remoteConfig = await OnlineDB.syncPull(tid, 'settings');

      // 2. Atualiza o banco LOCAL (IndexedDB) com os dados vindos da nuvem
      if (remoteOrders) { setOrders(remoteOrders); await saveData('orders', `${tid}_orders`, remoteOrders); }
      if (remoteProducts) { setProducts(remoteProducts); await saveData('products', `${tid}_products`, remoteProducts); }
      if (remoteSales) { setSales(remoteSales); await saveData('sales', `${tid}_sales`, remoteSales); }
      
      if (remoteConfig) {
        setSettings(remoteConfig);
        await saveData('settings', `${tid}_config`, remoteConfig);
        setCurrentUser(remoteConfig.users[0]);
      } else {
        // Fallback para novos usuários
        const localSettings = await getData('settings', `${tid}_config`);
        if (localSettings) {
          setSettings(localSettings);
          setCurrentUser(localSettings.users[0]);
        } else {
          const defaultSettings: AppSettings = {
            storeName: 'Nova Assistência', logoUrl: null, users: [], isConfigured: true,
            pdfWarrantyText: "Garantia de 90 dias...", pdfFontSize: 8, pdfFontFamily: 'helvetica',
            pdfPaperWidth: 80, pdfTextColor: '#000000', pdfBgColor: '#FFFFFF'
          };
          setSettings(defaultSettings);
        }
      }
    } catch (e) {
      console.error("Erro na sincronização inicial", e);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleLogin = async () => {
    const passHash = btoa(loginPass);
    const result = await OnlineDB.login(loginUser, passHash);

    if (result.success) {
      if (result.type === 'super') {
        setSession({ type: 'super' });
      } else {
        setSession({ type: 'admin', tenantId: result.tenant.id });
      }
      setIsLogged(true);
    } else {
      alert('Acesso negado. Verifique usuário e senha no banco online.');
    }
  };

  const handleLogout = () => {
    setIsLogged(false);
    setSession({ type: null });
    setSettings(null);
  };

  // Funções de Persistência com Push Automático para Nuvem
  const saveOrders = (newOrders: ServiceOrder[]) => {
    setOrders(newOrders);
    saveData('orders', `${session.tenantId}_orders`, newOrders);
    OnlineDB.syncPush(session.tenantId!, 'orders', newOrders);
  };

  const saveProducts = (newProducts: Product[]) => {
    setProducts(newProducts);
    saveData('products', `${session.tenantId}_products`, newProducts);
    OnlineDB.syncPush(session.tenantId!, 'products', newProducts);
  };

  const saveSales = (newSales: Sale[]) => {
    setSales(newSales);
    saveData('sales', `${session.tenantId}_sales`, newSales);
    OnlineDB.syncPush(session.tenantId!, 'sales', newSales);
  };

  const saveSettings = (newSettings: AppSettings) => {
    setSettings(newSettings);
    saveData('settings', `${session.tenantId}_config`, newSettings);
    OnlineDB.syncPush(session.tenantId!, 'settings', newSettings);
  };

  if (!isLogged) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 font-sans">
        <div className="w-full max-w-sm bg-white/10 backdrop-blur-xl rounded-[3rem] border border-white/10 shadow-2xl p-10 animate-in zoom-in-95 duration-700">
          <div className="text-center mb-10">
            <div className="w-24 h-24 bg-gradient-to-tr from-blue-600 to-indigo-600 rounded-[2.5rem] flex items-center justify-center text-white font-black text-4xl mx-auto mb-6 shadow-2xl shadow-blue-500/40 relative">
              <Globe className="absolute -top-2 -right-2 text-blue-300 animate-pulse" size={24} />
              A
            </div>
            <h1 className="text-3xl font-black text-white uppercase tracking-tighter">Assistencia Pro</h1>
            <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest mt-2 bg-blue-500/10 py-1 rounded-full">Banco de Dados Online Ativo</p>
          </div>

          <div className="space-y-5">
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Usuário Central</label>
              <input 
                value={loginUser} 
                onChange={e => setLoginUser(e.target.value)}
                className="w-full p-5 bg-white/5 border border-white/10 rounded-[2rem] font-bold text-white outline-none focus:ring-4 focus:ring-blue-500/20 transition-all placeholder:text-white/20" 
                placeholder="wandev ou admin" 
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Senha</label>
              <input 
                type="password"
                value={loginPass} 
                onChange={e => setLoginPass(e.target.value)}
                className="w-full p-5 bg-white/5 border border-white/10 rounded-[2rem] font-bold text-white outline-none focus:ring-4 focus:ring-blue-500/20 transition-all placeholder:text-white/20" 
                placeholder="••••••" 
              />
            </div>
            <button 
              onClick={handleLogin} 
              className="w-full py-6 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-[2rem] font-black uppercase text-xs tracking-[0.2em] shadow-2xl shadow-blue-600/30 active:scale-95 transition-all mt-6"
            >
              Conectar à Nuvem
            </button>
          </div>
          <p className="text-center mt-10 text-[9px] text-white/30 font-black uppercase tracking-widest">Sistema Multi-Tenant v4.0 Online</p>
        </div>
      </div>
    );
  }

  if (session.type === 'super') {
    return <SuperAdminDashboard onLogout={handleLogout} />;
  }

  if (session.type === 'admin' && settings) {
    return (
      <div className="min-h-screen flex flex-col pb-20 md:pb-0 md:pl-64 bg-slate-50">
        <header className="fixed top-0 left-0 right-0 bg-white/80 backdrop-blur-md border-b border-slate-200 z-40 px-6 py-3 flex items-center justify-between md:left-64">
          <div className="flex items-center gap-4">
            {isSyncing ? (
              <RefreshCw className="text-blue-500 animate-spin" size={18} />
            ) : (
              <Globe className="text-emerald-500" size={18} />
            )}
            <div>
              <h1 className="font-black text-slate-800 text-xs md:text-sm uppercase tracking-tight">{settings.storeName}</h1>
              <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">{isSyncing ? 'Sincronizando...' : 'Online'}</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
               <p className="text-[10px] font-black text-slate-800 leading-none">{currentUser?.name}</p>
               <p className="text-[8px] font-black text-blue-600 uppercase tracking-widest mt-0.5">{currentUser?.role}</p>
            </div>
            <button onClick={handleLogout} className="p-3 text-slate-400 bg-slate-100 rounded-2xl active:scale-90 transition-all"><LogOut size={20} /></button>
          </div>
        </header>

        <aside className="hidden md:flex fixed inset-y-0 left-0 w-64 bg-slate-900 text-white flex-col z-50">
          <div className="p-10 border-b border-slate-800 flex flex-col items-center gap-6 text-center">
             <div className="w-20 h-20 bg-gradient-to-tr from-blue-600 to-indigo-600 rounded-3xl flex items-center justify-center font-black text-3xl shadow-2xl shadow-blue-500/20">{settings.storeName.charAt(0)}</div>
             <h2 className="font-black uppercase tracking-tight text-sm">{settings.storeName}</h2>
          </div>
          <nav className="flex-1 p-6 space-y-2">
            <button onClick={() => setActiveTab('os')} className={`w-full flex items-center gap-4 px-6 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all ${activeTab === 'os' ? 'bg-blue-600 text-white shadow-xl shadow-blue-600/20' : 'text-slate-500 hover:bg-slate-800'}`}><ClipboardList size={20}/> Ordens</button>
            <button onClick={() => setActiveTab('estoque')} className={`w-full flex items-center gap-4 px-6 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all ${activeTab === 'estoque' ? 'bg-blue-600 text-white shadow-xl shadow-blue-600/20' : 'text-slate-500 hover:bg-slate-800'}`}><Package size={20}/> Estoque</button>
            <button onClick={() => setActiveTab('vendas')} className={`w-full flex items-center gap-4 px-6 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all ${activeTab === 'vendas' ? 'bg-blue-600 text-white shadow-xl shadow-blue-600/20' : 'text-slate-500 hover:bg-slate-800'}`}><ShoppingCart size={20}/> Vendas</button>
            <button onClick={() => setActiveTab('financeiro')} className={`w-full flex items-center gap-4 px-6 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all ${activeTab === 'financeiro' ? 'bg-emerald-600 text-white shadow-xl shadow-emerald-600/20' : 'text-slate-500 hover:bg-slate-800'}`}><Wallet size={20}/> Financeiro</button>
            <div className="pt-6 mt-6 border-t border-slate-800">
               <button onClick={() => setActiveTab('config')} className={`w-full flex items-center gap-4 px-6 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all ${activeTab === 'config' ? 'bg-blue-600 text-white shadow-xl shadow-blue-600/20' : 'text-slate-500 hover:bg-slate-800'}`}><SettingsIcon size={20}/> Config</button>
            </div>
          </nav>
        </aside>

        <main className="flex-1 p-6 pt-24 md:pt-24 max-w-6xl mx-auto w-full">
          {activeTab === 'os' && <ServiceOrderTab orders={orders} setOrders={saveOrders} settings={settings} />}
          {activeTab === 'estoque' && <StockTab products={products} setProducts={saveProducts} />}
          {activeTab === 'vendas' && <SalesTab products={products} setProducts={saveProducts} sales={sales} setSales={saveSales} settings={settings} currentUser={currentUser} />}
          {activeTab === 'financeiro' && <FinanceTab orders={orders} sales={sales} />}
          {activeTab === 'config' && <SettingsTab settings={settings} setSettings={saveSettings} />}
          {activeTab === 'usuarios' && <UserManagementTab settings={settings} setSettings={saveSettings} currentUser={currentUser!} onSwitchProfile={()=>{}} />}
        </main>

        <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-100 flex items-center justify-around p-2 md:hidden z-40 pb-6">
           <button onClick={() => setActiveTab('os')} className={`p-4 rounded-2xl transition-all ${activeTab === 'os' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-300'}`}><ClipboardList size={24}/></button>
           <button onClick={() => setActiveTab('estoque')} className={`p-4 rounded-2xl transition-all ${activeTab === 'estoque' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-300'}`}><Package size={24}/></button>
           <button onClick={() => setActiveTab('vendas')} className={`p-4 rounded-2xl transition-all ${activeTab === 'vendas' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-300'}`}><ShoppingCart size={24}/></button>
           <button onClick={() => setActiveTab('financeiro')} className={`p-4 rounded-2xl transition-all ${activeTab === 'financeiro' ? 'bg-emerald-600 text-white shadow-lg' : 'text-slate-300'}`}><Wallet size={24}/></button>
           <button onClick={() => setActiveTab('config')} className={`p-4 rounded-2xl transition-all ${activeTab === 'config' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-300'}`}><SettingsIcon size={24}/></button>
        </nav>
      </div>
    );
  }

  return null;
};

export default App;
