
import React, { useState, useEffect } from 'react';
import { ClipboardList, Wallet, Settings as SettingsIcon, Package, ShoppingCart, LogOut, RefreshCw, Globe, Loader2 } from 'lucide-react';
import { ServiceOrder, AppSettings, Product, Sale, User } from './types';
import ServiceOrderTab from './components/ServiceOrderTab';
import FinanceTab from './components/FinanceTab';
import SettingsTab from './components/SettingsTab';
import StockTab from './components/StockTab';
import SalesTab from './components/SalesTab';
import SuperAdminDashboard from './components/SuperAdminDashboard';
import { getData, saveData } from './utils/db';
import { OnlineDB } from './utils/api';

const App: React.FC = () => {
  const [session, setSession] = useState<{ type: 'super' | 'admin' | null, tenantId?: string }>({ type: null });
  const [isLogged, setIsLogged] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  
  const [loginUser, setLoginUser] = useState('');
  const [loginPass, setLoginPass] = useState('');

  const [activeTab, setActiveTab] = useState<'os' | 'financeiro' | 'config' | 'estoque' | 'vendas' | 'usuarios'>('os');
  const [orders, setOrders] = useState<ServiceOrder[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [settings, setSettings] = useState<AppSettings | null>(null);

  useEffect(() => {
    if (isLogged && session.type === 'admin' && session.tenantId) {
      fullSync(session.tenantId);
    }
  }, [isLogged, session]);

  const fullSync = async (tid: string) => {
    setIsSyncing(true);
    try {
      // 1. Carregar do IndexedDB primeiro (Imediato)
      const localOrders = await getData('orders', `${tid}_orders`);
      const localProducts = await getData('products', `${tid}_products`);
      const localSales = await getData('sales', `${tid}_sales`);
      const localConfig = await getData('settings', `${tid}_config`);

      if (localOrders) setOrders(localOrders);
      if (localProducts) setProducts(localProducts);
      if (localSales) setSales(localSales);
      if (localConfig) {
        setSettings(localConfig);
        setCurrentUser(localConfig.users[0]);
      }

      // 2. Buscar Ordens da tabela SQL (Cloud)
      const remoteOrders = await OnlineDB.fetchOrders(tid);
      if (remoteOrders !== null) {
        setOrders(remoteOrders);
        await saveData('orders', `${tid}_orders`, remoteOrders);
      }

      // 3. Buscar outros dados via JSON blob
      const remoteProducts = await OnlineDB.syncPull(tid, 'products');
      const remoteSales = await OnlineDB.syncPull(tid, 'sales');
      const remoteConfig = await OnlineDB.syncPull(tid, 'settings');

      if (remoteProducts) { setProducts(remoteProducts); await saveData('products', `${tid}_products`, remoteProducts); }
      if (remoteSales) { setSales(remoteSales); await saveData('sales', `${tid}_sales`, remoteSales); }
      
      if (remoteConfig) {
        setSettings(remoteConfig);
        await saveData('settings', `${tid}_config`, remoteConfig);
        setCurrentUser(remoteConfig.users[0]);
      } else if (!localConfig) {
        // Fallback para configurações padrão se nada existir
        const defaultSettings: AppSettings = {
          storeName: 'Minha Loja', logoUrl: null, users: [{id:'adm_1', name: 'Administrador', role: 'admin', photo: null}], isConfigured: true,
          pdfWarrantyText: "Garantia de 90 dias...", pdfFontSize: 8, pdfFontFamily: 'helvetica',
          pdfPaperWidth: 80, pdfTextColor: '#000000', pdfBgColor: '#FFFFFF'
        };
        setSettings(defaultSettings);
        setCurrentUser(defaultSettings.users[0]);
      }
    } catch (e) {
      console.error("Erro na sincronização:", e);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleLogin = async () => {
    const cleanUser = loginUser.trim().toLowerCase();
    const cleanPass = loginPass.trim();
    if (!cleanUser || !cleanPass) return;

    if (cleanUser === 'wandev' && (cleanPass === '123' || cleanPass === 'wan123')) {
      setSession({ type: 'super' });
      setIsLogged(true);
      return;
    }

    setIsAuthenticating(true);
    try {
      const result = await OnlineDB.login(cleanUser, cleanPass);
      if (result.success) {
        setSession({ type: result.type as any, tenantId: result.tenant?.id });
        setIsLogged(true);
      } else {
        alert(result.message);
      }
    } catch (err) {
      alert("Erro ao conectar com o banco de dados.");
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleLogout = () => {
    setIsLogged(false);
    setSession({ type: null });
    setSettings(null);
    setOrders([]);
    setProducts([]);
    setSales([]);
    setLoginUser('');
    setLoginPass('');
  };

  const saveOrders = async (newOrders: ServiceOrder[]) => {
    const oldOrders = [...orders];
    setOrders(newOrders);
    await saveData('orders', `${session.tenantId}_orders`, newOrders);

    if (session.tenantId) {
      const changedOrder = newOrders.find(no => {
        const old = oldOrders.find(oo => oo.id === no.id);
        return !old || JSON.stringify(old) !== JSON.stringify(no);
      });
      if (changedOrder) {
        await OnlineDB.upsertOS(session.tenantId, changedOrder);
      }
    }
  };

  const removeOrder = async (orderId: string) => {
    if (!confirm('Deseja realmente excluir esta O.S.?')) return;
    const newOrders = orders.filter(o => o.id !== orderId);
    setOrders(newOrders);
    await saveData('orders', `${session.tenantId}_orders`, newOrders);
    if (session.tenantId) await OnlineDB.deleteOS(orderId);
  };

  const saveProducts = (newProducts: Product[]) => {
    setProducts(newProducts);
    saveData('products', `${session.tenantId}_products`, newProducts);
    if (session.tenantId) OnlineDB.syncPush(session.tenantId, 'products', newProducts);
  };

  const saveSales = (newSales: Sale[]) => {
    setSales(newSales);
    saveData('sales', `${session.tenantId}_sales`, newSales);
    if (session.tenantId) OnlineDB.syncPush(session.tenantId, 'sales', newSales);
  };

  const saveSettings = (newSettings: AppSettings) => {
    setSettings(newSettings);
    saveData('settings', `${session.tenantId}_config`, newSettings);
    if (session.tenantId) OnlineDB.syncPush(session.tenantId, 'settings', newSettings);
  };

  if (!isLogged) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 font-sans">
        <div className="w-full max-w-sm bg-white/5 backdrop-blur-2xl rounded-[3rem] border border-white/10 shadow-[0_0_100px_rgba(37,99,235,0.15)] p-10 relative overflow-hidden">
          {isAuthenticating && (
            <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-md z-50 flex flex-col items-center justify-center text-white gap-4 text-center p-6">
              <Loader2 className="animate-spin text-blue-500" size={48} />
              <p className="text-[10px] font-black uppercase tracking-[0.3em]">Autenticando...</p>
            </div>
          )}
          <div className="text-center mb-10">
            <div className="w-24 h-24 bg-gradient-to-tr from-blue-600 to-blue-400 rounded-[2.5rem] flex items-center justify-center text-white font-black text-4xl mx-auto mb-6 shadow-2xl">A</div>
            <h1 className="text-3xl font-black text-white uppercase tracking-tighter">Assistencia Pro</h1>
            <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest mt-2">SQL Cloud Nativa</p>
          </div>
          <div className="space-y-5">
            <input value={loginUser} onChange={e => setLoginUser(e.target.value)} className="w-full p-5 bg-white/5 border border-white/10 rounded-[2rem] font-bold text-white outline-none text-sm" placeholder="Usuário" />
            <input type="password" value={loginPass} onChange={e => setLoginPass(e.target.value)} className="w-full p-5 bg-white/5 border border-white/10 rounded-[2rem] font-bold text-white outline-none text-sm" placeholder="Senha" />
            <button onClick={handleLogin} disabled={isAuthenticating} className="w-full py-6 bg-blue-600 text-white rounded-[2rem] font-black uppercase text-xs tracking-[0.2em] shadow-2xl active:scale-95 disabled:opacity-50 mt-6">Acessar Painel</button>
          </div>
        </div>
      </div>
    );
  }

  if (session.type === 'super') return <SuperAdminDashboard onLogout={handleLogout} />;
  
  if (session.type === 'admin' && settings) {
    return (
      <div className="min-h-screen flex flex-col pb-20 md:pb-0 md:pl-64 bg-slate-50">
        <header className="fixed top-0 left-0 right-0 bg-white/80 backdrop-blur-md border-b border-slate-200 z-40 px-6 py-3 flex items-center justify-between md:left-64">
          <div className="flex items-center gap-4">
            <div className={`p-2 rounded-xl ${isSyncing ? 'bg-blue-50 text-blue-500' : 'bg-emerald-50 text-emerald-500'}`}>
              {isSyncing ? <RefreshCw className="animate-spin" size={18} /> : <Globe size={18} />}
            </div>
            <div>
              <h1 className="font-black text-slate-800 text-xs md:text-sm uppercase">{settings.storeName}</h1>
              <p className="text-[8px] font-black text-slate-400 uppercase">{isSyncing ? 'Sincronizando SQL...' : 'Cloud SQL Online'}</p>
            </div>
          </div>
          <button onClick={handleLogout} className="p-3 text-slate-400 bg-slate-100 rounded-2xl active:scale-90"><LogOut size={20} /></button>
        </header>

        <aside className="hidden md:flex fixed inset-y-0 left-0 w-64 bg-slate-900 text-white flex-col z-50">
          <div className="p-10 text-center border-b border-white/5">
             <div className="w-16 h-16 bg-blue-600 rounded-3xl flex items-center justify-center font-black text-2xl mx-auto mb-4">{settings.storeName.charAt(0)}</div>
             <p className="font-black uppercase text-xs tracking-widest">{settings.storeName}</p>
          </div>
          <nav className="p-6 space-y-2">
            <button onClick={() => setActiveTab('os')} className={`w-full flex items-center gap-4 p-4 rounded-xl font-black text-[10px] uppercase transition-all ${activeTab === 'os' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:bg-white/5'}`}><ClipboardList size={20}/> Ordens</button>
            <button onClick={() => setActiveTab('estoque')} className={`w-full flex items-center gap-4 p-4 rounded-xl font-black text-[10px] uppercase transition-all ${activeTab === 'estoque' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:bg-white/5'}`}><Package size={20}/> Estoque</button>
            <button onClick={() => setActiveTab('vendas')} className={`w-full flex items-center gap-4 p-4 rounded-xl font-black text-[10px] uppercase transition-all ${activeTab === 'vendas' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:bg-white/5'}`}><ShoppingCart size={20}/> Vendas</button>
            <button onClick={() => setActiveTab('financeiro')} className={`w-full flex items-center gap-4 p-4 rounded-xl font-black text-[10px] uppercase transition-all ${activeTab === 'financeiro' ? 'bg-emerald-600 text-white shadow-lg' : 'text-slate-500 hover:bg-white/5'}`}><Wallet size={20}/> Financeiro</button>
            <button onClick={() => setActiveTab('config')} className={`w-full flex items-center gap-4 p-4 rounded-xl font-black text-[10px] uppercase transition-all ${activeTab === 'config' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:bg-white/5'}`}><SettingsIcon size={20}/> Ajustes</button>
          </nav>
        </aside>

        <main className="flex-1 p-6 pt-24 md:pt-24 max-w-6xl mx-auto w-full">
          {activeTab === 'os' && <ServiceOrderTab orders={orders} setOrders={saveOrders} settings={settings} onDeleteOrder={removeOrder} />}
          {activeTab === 'estoque' && <StockTab products={products} setProducts={saveProducts} />}
          {activeTab === 'vendas' && <SalesTab products={products} setProducts={saveProducts} sales={sales} setSales={saveSales} settings={settings} currentUser={currentUser} />}
          {activeTab === 'financeiro' && <FinanceTab orders={orders} sales={sales} />}
          {activeTab === 'config' && <SettingsTab settings={settings} setSettings={saveSettings} />}
        </main>

        <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-100 flex items-center justify-around p-2 md:hidden z-40 pb-6">
           <button onClick={() => setActiveTab('os')} className={`p-4 rounded-2xl ${activeTab === 'os' ? 'bg-blue-600 text-white' : 'text-slate-300'}`}><ClipboardList size={24}/></button>
           <button onClick={() => setActiveTab('estoque')} className={`p-4 rounded-2xl ${activeTab === 'estoque' ? 'bg-blue-600 text-white' : 'text-slate-300'}`}><Package size={24}/></button>
           <button onClick={() => setActiveTab('vendas')} className={`p-4 rounded-2xl ${activeTab === 'vendas' ? 'bg-blue-600 text-white' : 'text-slate-300'}`}><ShoppingCart size={24}/></button>
           <button onClick={() => setActiveTab('financeiro')} className={`p-4 rounded-2xl ${activeTab === 'financeiro' ? 'bg-emerald-600 text-white' : 'text-slate-300'}`}><Wallet size={24}/></button>
           <button onClick={() => setActiveTab('config')} className={`p-4 rounded-2xl ${activeTab === 'config' ? 'bg-blue-600 text-white' : 'text-slate-300'}`}><SettingsIcon size={24}/></button>
        </nav>
      </div>
    );
  }
  return null;
};

export default App;
