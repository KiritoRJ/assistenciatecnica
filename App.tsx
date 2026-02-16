
import React, { useState, useEffect } from 'react';
import { LayoutGrid, ClipboardList, Wallet, Settings as SettingsIcon, Package, ShoppingCart, User as UserIcon, LogOut, ShieldAlert, Lock, X, ShieldCheck } from 'lucide-react';
import { ServiceOrder, AppSettings, Product, Sale, User, Tenant } from './types';
import ServiceOrderTab from './components/ServiceOrderTab';
import FinanceTab from './components/FinanceTab';
import SettingsTab from './components/SettingsTab';
import StockTab from './components/StockTab';
import SalesTab from './components/SalesTab';
import UserManagementTab from './components/UserManagementTab';
import SuperAdminDashboard from './components/SuperAdminDashboard';
import { getData, saveData, initDB } from './utils/db';

const App: React.FC = () => {
  // Estados de Sessão
  const [session, setSession] = useState<{ type: 'super' | 'admin' | null, tenantId?: string }>({ type: null });
  const [isLogged, setIsLogged] = useState(false);
  
  // Login
  const [loginUser, setLoginUser] = useState('');
  const [loginPass, setLoginPass] = useState('');

  // Dados da Loja (Carregados após login do Admin)
  const [activeTab, setActiveTab] = useState<'os' | 'financeiro' | 'config' | 'estoque' | 'vendas' | 'usuarios'>('os');
  const [orders, setOrders] = useState<ServiceOrder[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isFinanciallyAuthenticated, setIsFinanciallyAuthenticated] = useState(false);
  const [showFinanceAuthModal, setShowFinanceAuthModal] = useState(false);
  const [switchPassword, setSwitchPassword] = useState('');
  const [settings, setSettings] = useState<AppSettings | null>(null);

  // Efeito para carregar dados do tenant logado
  useEffect(() => {
    if (session.type === 'admin' && session.tenantId) {
      loadTenantData(session.tenantId);
    }
  }, [session]);

  const loadTenantData = async (tid: string) => {
    try {
      const savedOrders = await getData('orders', `${tid}_orders`);
      setOrders(savedOrders || []);

      const savedSettings = await getData('settings', `${tid}_config`);
      if (savedSettings) {
        setSettings(savedSettings);
        // Primeiro usuário da lista costuma ser o admin da loja
        setCurrentUser(savedSettings.users[0]);
      } else {
        // Inicializar configurações padrão para novo tenant
        const defaultSettings: AppSettings = {
          storeName: 'Nova Assistência', logoUrl: null, users: [], isConfigured: true,
          pdfWarrantyText: "Garantia de 90 dias...", pdfFontSize: 8, pdfFontFamily: 'helvetica',
          pdfPaperWidth: 80, pdfTextColor: '#000000', pdfBgColor: '#FFFFFF'
        };
        setSettings(defaultSettings);
      }

      const savedProducts = await getData('products', `${tid}_products`);
      setProducts(savedProducts || []);

      const savedSales = await getData('sales', `${tid}_sales`);
      setSales(savedSales || []);
    } catch (err) {
      console.error(err);
    }
  };

  const handleLogin = async () => {
    // 1. Verificar Super Admin Wandev
    if (loginUser === 'wandev' && loginPass === 'wan123') {
      setSession({ type: 'super' });
      setIsLogged(true);
      return;
    }

    // 2. Verificar ADMs de Lojas no DB
    const db = await initDB();
    const tx = db.transaction('global_tenants', 'readonly');
    const store = tx.objectStore('global_tenants');
    const request = store.get(loginUser);

    request.onsuccess = () => {
      const tenant: Tenant = request.result;
      if (tenant && tenant.adminPasswordHash === btoa(loginPass)) {
        setSession({ type: 'admin', tenantId: tenant.id });
        setIsLogged(true);
      } else {
        alert('Usuário ou senha incorretos!');
      }
    };
  };

  const handleLogout = () => {
    setIsLogged(false);
    setSession({ type: null });
    setSettings(null);
    setLoginUser('');
    setLoginPass('');
  };

  // Funções de Persistência Isoladas
  const saveOrders = (newOrders: ServiceOrder[]) => {
    setOrders(newOrders);
    saveData('orders', `${session.tenantId}_orders`, newOrders);
  };

  const saveProducts = (newProducts: Product[]) => {
    setProducts(newProducts);
    saveData('products', `${session.tenantId}_products`, newProducts);
  };

  const saveSales = (newSales: Sale[]) => {
    setSales(newSales);
    saveData('sales', `${session.tenantId}_sales`, newSales);
  };

  const saveSettings = (newSettings: AppSettings) => {
    setSettings(newSettings);
    saveData('settings', `${session.tenantId}_config`, newSettings);
  };

  // TELA DE LOGIN
  if (!isLogged) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
        <div className="w-full max-w-sm bg-white rounded-[2.5rem] shadow-2xl overflow-hidden p-8 animate-in zoom-in-95 duration-500">
          <div className="text-center mb-10">
            <div className="w-20 h-20 bg-blue-600 rounded-[2rem] flex items-center justify-center text-white font-black text-3xl mx-auto mb-6 shadow-xl shadow-blue-500/20">A</div>
            <h1 className="text-2xl font-black text-slate-800 uppercase tracking-tighter">Assistencia Pro</h1>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Gestão Inteligente</p>
          </div>

          <div className="space-y-4">
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Usuário</label>
              <input 
                value={loginUser} 
                onChange={e => setLoginUser(e.target.value)}
                className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold outline-none focus:ring-2 focus:ring-blue-500/10" 
                placeholder="wandev ou admin" 
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Senha</label>
              <input 
                type="password"
                value={loginPass} 
                onChange={e => setLoginPass(e.target.value)}
                className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold outline-none focus:ring-2 focus:ring-blue-500/10" 
                placeholder="••••••" 
              />
            </div>
            <button onClick={handleLogin} className="w-full py-5 bg-blue-600 text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl shadow-blue-500/20 active:scale-95 transition-all mt-4">Entrar no Sistema</button>
          </div>
        </div>
      </div>
    );
  }

  // PAINEL WANDEV (SUPER ADMIN)
  if (session.type === 'super') {
    return <SuperAdminDashboard onLogout={handleLogout} />;
  }

  // PAINEL DE LOJA (ADMIN/FUNCIONÁRIO)
  if (session.type === 'admin' && settings) {
    return (
      <div className="min-h-screen flex flex-col pb-20 md:pb-0 md:pl-64 bg-slate-50">
        <header className="fixed top-0 left-0 right-0 bg-white border-b border-slate-200 z-40 px-4 py-2 flex items-center justify-between md:left-64">
          <div className="flex items-center gap-3">
            {settings.logoUrl ? (
              <img src={settings.logoUrl} alt="Logo" className="w-8 h-8 object-contain rounded" />
            ) : (
              <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center text-white font-bold text-xs">{settings.storeName.charAt(0)}</div>
            )}
            <h1 className="font-bold text-slate-800 text-sm md:text-base truncate max-w-[150px]">{settings.storeName}</h1>
          </div>
          <button onClick={handleLogout} className="p-2 text-slate-400 bg-slate-50 rounded-xl"><LogOut size={20} /></button>
        </header>

        <aside className="hidden md:flex fixed inset-y-0 left-0 w-64 bg-slate-900 text-white flex-col z-50">
          <div className="p-6 border-b border-slate-800 flex flex-col items-center gap-4 text-center">
             <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center font-black text-2xl">{settings.storeName.charAt(0)}</div>
             <h2 className="font-bold">{settings.storeName}</h2>
          </div>
          <nav className="flex-1 p-4 space-y-1">
            <button onClick={() => setActiveTab('os')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl ${activeTab === 'os' ? 'bg-blue-600' : 'hover:bg-slate-800'}`}><ClipboardList size={20}/> O.S.</button>
            <button onClick={() => setActiveTab('estoque')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl ${activeTab === 'estoque' ? 'bg-blue-600' : 'hover:bg-slate-800'}`}><Package size={20}/> Estoque</button>
            <button onClick={() => setActiveTab('vendas')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl ${activeTab === 'vendas' ? 'bg-blue-600' : 'hover:bg-slate-800'}`}><ShoppingCart size={20}/> Vendas</button>
            <button onClick={() => setActiveTab('financeiro')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl ${activeTab === 'financeiro' ? 'bg-emerald-600' : 'hover:bg-slate-800'}`}><Wallet size={20}/> Financeiro</button>
            <button onClick={() => setActiveTab('config')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl ${activeTab === 'config' ? 'bg-blue-600' : 'hover:bg-slate-800'}`}><SettingsIcon size={20}/> Config</button>
          </nav>
        </aside>

        <main className="flex-1 p-4 pt-16 md:pt-16 max-w-5xl mx-auto w-full">
          {activeTab === 'os' && <ServiceOrderTab orders={orders} setOrders={saveOrders} settings={settings} />}
          {activeTab === 'estoque' && <StockTab products={products} setProducts={saveProducts} />}
          {activeTab === 'vendas' && <SalesTab products={products} setProducts={saveProducts} sales={sales} setSales={saveSales} settings={settings} currentUser={currentUser} />}
          {activeTab === 'financeiro' && <FinanceTab orders={orders} sales={sales} />}
          {activeTab === 'config' && <SettingsTab settings={settings} setSettings={saveSettings} />}
          {activeTab === 'usuarios' && <UserManagementTab settings={settings} setSettings={saveSettings} currentUser={currentUser!} onSwitchProfile={()=>{}} />}
        </main>

        <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 flex items-center justify-around p-1 md:hidden z-40">
           <button onClick={() => setActiveTab('os')} className={`p-3 ${activeTab === 'os' ? 'text-blue-600' : 'text-slate-400'}`}><ClipboardList size={24}/></button>
           <button onClick={() => setActiveTab('estoque')} className={`p-3 ${activeTab === 'estoque' ? 'text-blue-600' : 'text-slate-400'}`}><Package size={24}/></button>
           <button onClick={() => setActiveTab('vendas')} className={`p-3 ${activeTab === 'vendas' ? 'text-blue-600' : 'text-slate-400'}`}><ShoppingCart size={24}/></button>
           <button onClick={() => setActiveTab('financeiro')} className={`p-3 ${activeTab === 'financeiro' ? 'text-emerald-600' : 'text-slate-400'}`}><Wallet size={24}/></button>
           <button onClick={() => setActiveTab('config')} className={`p-3 ${activeTab === 'config' ? 'text-blue-600' : 'text-slate-400'}`}><SettingsIcon size={24}/></button>
        </nav>
      </div>
    );
  }

  return null;
};

export default App;
