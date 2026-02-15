
import React, { useState, useEffect } from 'react';
import { LayoutGrid, ClipboardList, Wallet, Settings as SettingsIcon, Package, ShoppingCart, User as UserIcon, LogOut, ShieldAlert, Lock, X } from 'lucide-react';
import { ServiceOrder, AppSettings, Product, Sale, User } from './types';
import ServiceOrderTab from './components/ServiceOrderTab';
import FinanceTab from './components/FinanceTab';
import SettingsTab from './components/SettingsTab';
import StockTab from './components/StockTab';
import SalesTab from './components/SalesTab';
import SetupWizard from './components/SetupWizard';
import UserManagementTab from './components/UserManagementTab';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'os' | 'financeiro' | 'config' | 'estoque' | 'vendas' | 'usuarios'>('os');
  const [orders, setOrders] = useState<ServiceOrder[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isFinanciallyAuthenticated, setIsFinanciallyAuthenticated] = useState(false);
  const [showUserPicker, setShowUserPicker] = useState(false);
  const [showFinanceAuthModal, setShowFinanceAuthModal] = useState(false);
  const [pendingProfileSwitch, setPendingProfileSwitch] = useState<User | null>(null);
  const [pendingLoginUser, setPendingLoginUser] = useState<User | null>(null);
  const [switchPassword, setSwitchPassword] = useState('');
  
  const [settings, setSettings] = useState<AppSettings>({
    storeName: 'Minha Assistência',
    logoUrl: null,
    users: [],
    isConfigured: false,
    pdfWarrantyText: "Concede-se garantia pelo prazo de 90 (noventa) dias, contados a partir da data de realização do serviço.\n\nA garantia cobre exclusivamente defeitos decorrentes de falhas crônicas de fabricação em telas frontais, desde que o produto seja devolvido nas mesmas condições inalteradas.\n\nNão estão cobertos pela garantia danos ocasionados por mau uso, tais como arranhões, vazamentos, trincas, quedas, contato com líquidos, oxidação ou quaisquer outros danos decorrentes de causas externas.",
    pdfFontSize: 8,
    pdfFontFamily: 'helvetica',
    pdfPaperWidth: 80,
    pdfTextColor: '#000000',
    pdfBgColor: '#FFFFFF'
  });

  useEffect(() => {
    const savedOrders = localStorage.getItem('service_orders');
    if (savedOrders) setOrders(JSON.parse(savedOrders));

    const savedSettings = localStorage.getItem('app_settings');
    if (savedSettings) {
      const parsed = JSON.parse(savedSettings);
      setSettings(prev => ({ ...prev, ...parsed }));
    }

    const savedProducts = localStorage.getItem('stock_products');
    if (savedProducts) setProducts(JSON.parse(savedProducts));

    const savedSales = localStorage.getItem('sales_history');
    if (savedSales) setSales(JSON.parse(savedSales));
  }, []);

  const saveOrders = (newOrders: ServiceOrder[]) => {
    setOrders(newOrders);
    localStorage.setItem('service_orders', JSON.stringify(newOrders));
  };

  const saveSettings = (newSettings: AppSettings) => {
    setSettings(newSettings);
    localStorage.setItem('app_settings', JSON.stringify(newSettings));
  };

  const handleSetupComplete = (newSettings: AppSettings) => {
    saveSettings(newSettings);
    setCurrentUser(newSettings.users[0]);
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setIsFinanciallyAuthenticated(false);
    setActiveTab('os');
  };

  const changeTab = (tab: typeof activeTab) => {
    if (activeTab === 'financeiro' && tab !== 'financeiro') {
      setIsFinanciallyAuthenticated(false);
    }
    setActiveTab(tab);
  };

  const handleFinanceAccess = () => {
    if (activeTab === 'financeiro') return;
    setSwitchPassword('');
    setShowFinanceAuthModal(true);
  };

  const confirmFinanceAccess = () => {
    const adminUser = settings.users.find(u => u.role === 'admin');
    if (!adminUser) return;

    if (switchPassword === adminUser.password) {
      setIsFinanciallyAuthenticated(true);
      setShowFinanceAuthModal(false);
      setSwitchPassword('');
      changeTab('financeiro');
    } else {
      alert('Senha do Administrador incorreta!');
    }
  };

  const requestProfileSwitch = (targetUser: User) => {
    if (targetUser.id === currentUser?.id) return;
    setPendingProfileSwitch(targetUser);
    setShowUserPicker(false);
    setSwitchPassword('');
  };

  const confirmProfileSwitch = () => {
    const adminUser = settings.users.find(u => u.role === 'admin');
    if (!adminUser) return;

    if (switchPassword === adminUser.password) {
      setCurrentUser(pendingProfileSwitch);
      setIsFinanciallyAuthenticated(false);
      setPendingProfileSwitch(null);
      setSwitchPassword('');
    } else {
      alert('Senha do Administrador incorreta!');
    }
  };

  const handleLoginAttempt = (user: User) => {
    setPendingLoginUser(user);
    setSwitchPassword('');
  };

  const confirmLogin = () => {
    if (!pendingLoginUser) return;
    const adminUser = settings.users.find(u => u.role === 'admin');
    if (!adminUser) return;

    if (switchPassword === adminUser.password) {
      setCurrentUser(pendingLoginUser);
      setIsFinanciallyAuthenticated(false);
      setPendingLoginUser(null);
      setSwitchPassword('');
    } else {
      alert('Senha do Administrador incorreta!');
    }
  };

  if (!settings.isConfigured) {
    return <SetupWizard onComplete={handleSetupComplete} />;
  }

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-6 text-white">
        <div className="w-full max-w-sm space-y-12 text-center">
          <div className="space-y-3">
            {settings.logoUrl ? (
              <img src={settings.logoUrl} className="w-20 h-20 object-contain mx-auto bg-white rounded-3xl p-3 mb-4 shadow-2xl" />
            ) : (
              <div className="w-16 h-16 bg-blue-600 rounded-2xl mx-auto flex items-center justify-center text-3xl font-black mb-4 shadow-[0_0_30px_rgba(37,99,235,0.4)]">
                {settings.storeName.charAt(0).toUpperCase()}
              </div>
            )}
            <h1 className="text-4xl font-black tracking-tight">{settings.storeName.toLowerCase()}</h1>
            <p className="text-slate-400 font-black uppercase tracking-[0.2em] text-[10px]">Selecione seu perfil</p>
          </div>

          <div className="grid grid-cols-2 gap-6 px-2">
            {settings.users.map(user => (
              <button 
                key={user.id}
                onClick={() => handleLoginAttempt(user)}
                className="group flex flex-col items-center gap-4 active:scale-95 transition-all duration-300"
              >
                <div className="relative">
                  <div className="w-28 h-28 rounded-[2.5rem] bg-slate-800 border-2 border-slate-700 flex items-center justify-center overflow-hidden transition-all group-hover:border-blue-500 group-hover:shadow-[0_0_25px_rgba(59,130,246,0.3)]">
                    {user.photo ? (
                      <img src={user.photo} className="w-full h-full object-cover opacity-90 group-hover:opacity-100" />
                    ) : (
                      <UserIcon size={40} className="text-slate-600 group-hover:text-blue-400" />
                    )}
                  </div>
                </div>
                <div className="text-center">
                  <span className="block text-white font-black text-sm tracking-wide group-hover:text-blue-400 transition-colors uppercase">{user.name}</span>
                  <span className="block text-slate-500 text-[9px] uppercase font-black tracking-widest mt-0.5">{user.role}</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {pendingLoginUser && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] p-6 backdrop-blur-xl animate-in fade-in duration-300">
            <div className="bg-slate-900 w-full max-w-xs rounded-[40px] border border-slate-800 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
              <div className="p-8 text-center space-y-6">
                <div className="w-20 h-20 bg-blue-600/20 text-blue-500 rounded-3xl flex items-center justify-center mx-auto shadow-inner">
                  <Lock size={32} />
                </div>
                <div>
                  <h3 className="text-xl font-black text-white">Acesso Restrito</h3>
                  <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mt-1">Digite a senha do ADM para entrar no perfil: <span className="text-white">{pendingLoginUser.name}</span></p>
                </div>
                
                <div className="space-y-4">
                  <input 
                    type="password" 
                    autoFocus
                    value={switchPassword}
                    onChange={(e) => setSwitchPassword(e.target.value)}
                    placeholder="••••••"
                    className="w-full px-4 py-5 bg-slate-800 border-2 border-slate-700 rounded-3xl outline-none focus:border-blue-500 text-center font-bold text-2xl text-white tracking-[0.5em]"
                    onKeyDown={(e) => e.key === 'Enter' && confirmLogin()}
                  />
                  
                  <div className="flex gap-3 pt-2">
                    <button 
                      onClick={() => { setPendingLoginUser(null); setSwitchPassword(''); }}
                      className="flex-1 py-4 font-black text-slate-500 hover:text-white transition-colors text-xs uppercase"
                    >
                      Voltar
                    </button>
                    <button 
                      onClick={confirmLogin}
                      className="flex-1 py-4 bg-blue-600 text-white rounded-[2rem] font-black shadow-lg shadow-blue-900/40 active:scale-95 transition-all text-xs uppercase"
                    >
                      Confirmar
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col pb-20 md:pb-0 md:pl-64 bg-slate-50">
      <header className="fixed top-0 left-0 right-0 bg-white border-b border-slate-200 z-40 px-4 py-2 flex items-center justify-between md:left-64">
        <div className="flex items-center gap-3">
          {settings.logoUrl ? (
            <img src={settings.logoUrl} alt="Logo" className="w-8 h-8 object-contain rounded" />
          ) : (
            <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center text-white font-bold text-xs">{settings.storeName.charAt(0)}</div>
          )}
          <h1 className="font-bold text-slate-800 text-sm md:text-base truncate max-w-[120px] md:max-w-none">{settings.storeName}</h1>
        </div>

        <div className="flex items-center gap-3 relative">
          <div className="text-right hidden sm:block">
            <p className="text-xs font-bold text-slate-800 leading-none">{currentUser.name}</p>
            <p className="text-[9px] font-black text-blue-600 uppercase tracking-widest">{currentUser.role}</p>
          </div>
          <button onClick={() => setShowUserPicker(!showUserPicker)} className="relative active:scale-95 transition-transform">
            {currentUser.photo ? (
              <img src={currentUser.photo} className="w-10 h-10 rounded-full object-cover border-2 border-blue-500 shadow-sm" />
            ) : (
              <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center border-2 border-blue-500"><UserIcon size={20} /></div>
            )}
          </button>

          {showUserPicker && (
            <>
              <div className="fixed inset-0 z-[60]" onClick={() => setShowUserPicker(false)} />
              <div className="absolute right-0 top-12 w-64 bg-white border border-slate-200 rounded-2xl shadow-2xl z-[70] py-2 animate-in fade-in zoom-in-95">
                <div className="px-4 py-2 border-b border-slate-50 mb-1">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Trocar Perfil</p>
                </div>
                
                <div className="max-h-48 overflow-y-auto px-2">
                  {settings.users.map(user => (
                    <button 
                      key={user.id}
                      onClick={() => requestProfileSwitch(user)}
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl transition-colors mb-1 ${user.id === currentUser.id ? 'bg-blue-50' : 'hover:bg-slate-50'}`}
                    >
                      {user.photo ? (
                        <img src={user.photo} className="w-8 h-8 rounded-full object-cover border border-slate-200" />
                      ) : (
                        <div className="w-8 h-8 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center border border-slate-200"><UserIcon size={14} /></div>
                      )}
                      <div className="text-left flex-1 min-w-0">
                        <p className={`text-xs font-bold truncate ${user.id === currentUser.id ? 'text-blue-600' : 'text-slate-700'}`}>{user.name}</p>
                        <p className="text-[9px] text-slate-400 uppercase font-black">{user.role}</p>
                      </div>
                    </button>
                  ))}
                </div>

                <div className="border-t border-slate-100 mt-1 py-1">
                  <button 
                    onClick={() => { changeTab('usuarios'); setShowUserPicker(false); }}
                    className="w-full flex items-center gap-3 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
                  >
                    <UserIcon size={16} className="text-blue-500" /> Gerenciar Perfis
                  </button>
                  <button 
                    onClick={handleLogout}
                    className="w-full flex items-center gap-3 px-4 py-2 text-xs font-bold text-red-600 hover:bg-red-50"
                  >
                    <LogOut size={16} /> Sair do Perfil
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </header>

      {showFinanceAuthModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100] p-6 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-sm rounded-[40px] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="p-8 text-center space-y-4">
              <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-2 border-2 border-white shadow-lg">
                <Wallet size={28} />
              </div>
              <div>
                <h3 className="text-xl font-black text-slate-800">Acesso Financeiro</h3>
                <p className="text-sm text-slate-500 font-medium">Digite a senha do <b>Administrador</b> para visualizar os dados financeiros da loja.</p>
              </div>
              
              <div className="space-y-4 pt-2">
                <input 
                  type="password" 
                  autoFocus
                  value={switchPassword}
                  onChange={(e) => setSwitchPassword(e.target.value)}
                  placeholder="Senha do ADM"
                  className="w-full px-4 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none focus:border-blue-500 text-center font-bold text-lg"
                  onKeyDown={(e) => e.key === 'Enter' && confirmFinanceAccess()}
                />
                
                <div className="flex gap-3">
                  <button 
                    onClick={() => { setShowFinanceAuthModal(false); setSwitchPassword(''); }}
                    className="flex-1 py-3 font-bold text-slate-500 hover:text-slate-700 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button 
                    onClick={confirmFinanceAccess}
                    className="flex-1 py-4 bg-emerald-600 text-white rounded-2xl font-black shadow-lg shadow-emerald-100 active:scale-95 transition-all"
                  >
                    Acessar
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {pendingProfileSwitch && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100] p-6 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-sm rounded-[40px] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="p-8 text-center space-y-4">
              <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-2 border-2 border-white shadow-lg">
                <Lock size={28} />
              </div>
              <div>
                <h3 className="text-xl font-black text-slate-800">Trocar Usuário</h3>
                <p className="text-sm text-slate-500 font-medium">Digite a senha do <b>Administrador</b> para entrar no perfil de <b>{pendingProfileSwitch.name}</b>.</p>
              </div>
              
              <div className="space-y-4 pt-2">
                <input 
                  type="password" 
                  autoFocus
                  value={switchPassword}
                  onChange={(e) => setSwitchPassword(e.target.value)}
                  placeholder="Senha do ADM"
                  className="w-full px-4 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none focus:border-blue-500 text-center font-bold text-lg"
                  onKeyDown={(e) => e.key === 'Enter' && confirmProfileSwitch()}
                />
                
                <div className="flex gap-3">
                  <button 
                    onClick={() => { setPendingProfileSwitch(null); setSwitchPassword(''); }}
                    className="flex-1 py-3 font-bold text-slate-500 hover:text-slate-700 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button 
                    onClick={confirmProfileSwitch}
                    className="flex-1 py-4 bg-blue-600 text-white rounded-2xl font-black shadow-lg shadow-blue-100 active:scale-95 transition-all"
                  >
                    Confirmar
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <aside className="hidden md:flex fixed inset-y-0 left-0 w-64 bg-slate-900 text-white flex-col z-50">
        <div className="p-6 border-b border-slate-800 flex flex-col items-center gap-4">
          {settings.logoUrl ? (
            <img src={settings.logoUrl} alt="Logo" className="w-16 h-16 object-contain bg-white rounded-lg p-1" />
          ) : (
            <div className="w-16 h-16 bg-blue-600 rounded-xl flex items-center justify-center text-2xl font-bold">{settings.storeName.charAt(0)}</div>
          )}
          <h2 className="font-bold text-lg text-center leading-tight">{settings.storeName}</h2>
        </div>
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          <button onClick={() => changeTab('os')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${activeTab === 'os' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-800'}`}><ClipboardList size={20} />Ordens de Serviço</button>
          <button onClick={() => changeTab('estoque')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${activeTab === 'estoque' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-800'}`}><Package size={20} />Estoque</button>
          <button onClick={() => changeTab('vendas')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${activeTab === 'vendas' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-800'}`}><ShoppingCart size={20} />Vendas</button>
          <button onClick={handleFinanceAccess} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${activeTab === 'financeiro' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:bg-slate-800'}`}><Wallet size={20} />Financeiro</button>
          <button onClick={() => changeTab('config')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${activeTab === 'config' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-800'}`}><SettingsIcon size={20} />Configurações</button>
        </nav>
      </aside>

      <main className="flex-1 p-4 pt-16 md:pt-16 max-w-5xl mx-auto w-full overflow-x-hidden">
        {activeTab === 'os' && <ServiceOrderTab orders={orders} setOrders={saveOrders} settings={settings} />}
        {activeTab === 'estoque' && <StockTab products={products} setProducts={(p) => { setProducts(p); localStorage.setItem('stock_products', JSON.stringify(p)); }} />}
        {activeTab === 'vendas' && <SalesTab products={products} setProducts={(p) => { setProducts(p); localStorage.setItem('stock_products', JSON.stringify(p)); }} sales={sales} setSales={(s) => { setSales(s); localStorage.setItem('sales_history', JSON.stringify(s)); }} settings={settings} currentUser={currentUser} />}
        {activeTab === 'financeiro' && (isFinanciallyAuthenticated ? <FinanceTab orders={orders} sales={sales} /> : <div className="flex flex-col items-center justify-center py-20 text-center space-y-4"><ShieldAlert className="text-red-500" size={64} /><h3 className="text-xl font-bold">Acesso Bloqueado</h3><p className="text-slate-500">A senha do Administrador é obrigatória para ver os dados financeiros.</p></div>)}
        {activeTab === 'config' && <SettingsTab settings={settings} setSettings={saveSettings} />}
        {activeTab === 'usuarios' && <UserManagementTab settings={settings} setSettings={saveSettings} currentUser={currentUser} onSwitchProfile={requestProfileSwitch} />}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 flex items-center justify-around p-1 z-[45] md:hidden">
        <button onClick={() => changeTab('os')} className={`flex flex-col items-center p-2 rounded-lg ${activeTab === 'os' ? 'text-blue-600' : 'text-slate-400'}`}><ClipboardList size={22} /><span className="text-[10px] font-medium">O.S.</span></button>
        <button onClick={() => changeTab('estoque')} className={`flex flex-col items-center p-2 rounded-lg ${activeTab === 'estoque' ? 'text-blue-600' : 'text-slate-400'}`}><Package size={22} /><span className="text-[10px] font-medium">Estoque</span></button>
        <button onClick={() => changeTab('vendas')} className={`flex flex-col items-center p-2 rounded-lg ${activeTab === 'vendas' ? 'text-blue-600' : 'text-slate-400'}`}><ShoppingCart size={22} /><span className="text-[10px] font-medium">Vendas</span></button>
        <button onClick={handleFinanceAccess} className={`flex flex-col items-center p-2 rounded-lg ${activeTab === 'financeiro' ? 'text-emerald-600' : 'text-slate-400'}`}><Wallet size={22} /><span className="text-[10px] font-medium">Financeiro</span></button>
        <button onClick={() => changeTab('config')} className={`flex flex-col items-center p-2 rounded-lg ${activeTab === 'config' ? 'text-blue-600' : 'text-slate-400'}`}><SettingsIcon size={22} /><span className="text-[10px] font-medium">Config</span></button>
      </nav>
    </div>
  );
};

export default App;
