
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { ShoppingBag, Search, X, History, ShoppingCart, Package, ArrowLeft, CheckCircle2, Eye, Loader2, Plus, Minus, Trash2, ChevronUp, ChevronDown, Receipt, Share2, Download, ScanBarcode, Lock, KeyRound } from 'lucide-react';
import { Product, Sale, AppSettings, User } from '../types';
import { formatCurrency, parseCurrencyString, formatDate } from '../utils';
import { Html5Qrcode } from 'html5-qrcode';

interface Props {
  products: Product[];
  setProducts: (products: Product[]) => void;
  sales: Sale[];
  setSales: (sales: Sale[]) => void;
  settings: AppSettings;
  currentUser: User | null;
  onDeleteSale: (sale: Sale) => Promise<void>;
  tenantId: string;
}

interface CartItem {
  product: Product;
  quantity: number;
}

const SalesTab: React.FC<Props> = ({ products, setProducts, sales, setSales, settings, currentUser, onDeleteSale, tenantId }) => {
  const [showHistory, setShowHistory] = useState(false);
  const [productSearch, setProductSearch] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);
  const [lastSaleAmount, setLastSaleAmount] = useState(0);
  const [lastTransactionItems, setLastTransactionItems] = useState<CartItem[]>([]);
  const [lastPaymentMethod, setLastPaymentMethod] = useState('');
  const [lastTransactionId, setLastTransactionId] = useState('');
  const [lastSaleDate, setLastSaleDate] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  const [isCancelling, setIsCancelling] = useState<string | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [verifyingPassword, setVerifyingPassword] = useState(false);
  const [authError, setAuthError] = useState(false);
  const [selectedSaleToCancel, setSelectedSaleToCancel] = useState<Sale | null>(null);

  const [cart, setCart] = useState<CartItem[]>([]);
  const [showCartDrawer, setShowCartDrawer] = useState(false);
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [amountReceived, setAmountReceived] = useState(0);
  const [totalDiscount, setTotalDiscount] = useState(0);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<'Dinheiro' | 'Cartão' | 'PIX'>('Dinheiro');
  const [isGeneratingReceipt, setIsGeneratingReceipt] = useState(false);

  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);

  const startScanner = async () => {
    setIsScannerOpen(true);
    setTimeout(async () => {
      try {
        const html5QrCode = new Html5Qrcode("scanner-region-sales");
        scannerRef.current = html5QrCode;
        
        await html5QrCode.start(
          { facingMode: "environment" },
          {
            fps: 20,
            qrbox: { width: 280, height: 180 },
            aspectRatio: 1.777778
          },
          (decodedText) => {
            setProductSearch(decodedText);
            stopScanner();
          },
          () => {}
        );

        // Tentar forçar o foco contínuo se o navegador suportar
        try {
          // Em versões mais antigas do html5-qrcode, getRunningTrack pode não existir
          // Vamos tentar pegar diretamente do elemento de vídeo
          const videoElement = document.querySelector("#scanner-region-sales video") as HTMLVideoElement;
          const stream = videoElement?.srcObject as MediaStream;
          const track = stream?.getVideoTracks()[0];
          
          if (track) {
            const capabilities = track.getCapabilities() as any;
            const constraints: any = {};
            
            if (capabilities.focusMode && capabilities.focusMode.includes('continuous')) {
              constraints.focusMode = 'continuous';
            }
            
            // Tentar aplicar 2x de zoom se disponível
            if (capabilities.zoom) {
              const maxZoom = capabilities.zoom.max || 1;
              constraints.zoom = Math.min(2, maxZoom);
            }
            
            if (Object.keys(constraints).length > 0) {
              await track.applyConstraints({ advanced: [constraints] } as any);
            }
          }
        } catch (focusErr) {
          console.warn("Não foi possível ajustar o foco automaticamente:", focusErr);
        }
      } catch (err) {
        console.error("Erro ao iniciar scanner:", err);
        alert("Não foi possível acessar a câmera.");
        setIsScannerOpen(false);
      }
    }, 300);
  };

  const stopScanner = async () => {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop();
      } catch (e) {}
      scannerRef.current = null;
    }
    setIsScannerOpen(false);
  };

  const initiateCancelSale = (sale: Sale) => {
    setSelectedSaleToCancel(sale);
    setIsAuthModalOpen(true);
    setPasswordInput('');
    setAuthError(false);
  };

  const confirmCancellation = async () => {
    if (!selectedSaleToCancel || !passwordInput || !tenantId) return;
    setVerifyingPassword(true);
    setAuthError(false);

    try {
      const { OnlineDB } = await import('../utils/api');
      const authResult = await OnlineDB.verifyAdminPassword(tenantId, passwordInput);
      if (authResult.success) {
        setIsCancelling(selectedSaleToCancel.id);
        setIsAuthModalOpen(false);
        try {
          await onDeleteSale(selectedSaleToCancel);
        } catch (e: any) {
          alert(`ERRO AO CANCELAR: ${e.message}`);
        } finally {
          setIsCancelling(null);
          setSelectedSaleToCancel(null);
        }
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

  useEffect(() => {
    return () => {
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {});
      }
    };
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [showHistory, productSearch]);

  const cartTotal = useMemo(() => {
    return cart.reduce((acc, item) => acc + (item.product.salePrice * item.quantity), 0);
  }, [cart]);

  const finalTotal = useMemo(() => {
    return Math.max(0, cartTotal - totalDiscount);
  }, [cartTotal, totalDiscount]);

  const addToCart = (product: Product) => {
    const existingItem = cart.find(item => item.product.id === product.id);
    const currentQtyInCart = existingItem ? existingItem.quantity : 0;
    if (currentQtyInCart + 1 > product.quantity) {
      alert(`Estoque insuficiente.`);
      return;
    }
    if (existingItem) {
      setCart(cart.map(item => item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item));
    } else {
      setCart([...cart, { product, quantity: 1 }]);
    }
  };

  const updateCartQuantity = (productId: string, delta: number) => {
    setCart(prevCart => prevCart.map(item => {
      if (item.product.id === productId) {
        const newQty = item.quantity + delta;
        if (newQty <= 0) return item; 
        if (newQty > item.product.quantity) return item;
        return { ...item, quantity: newQty };
      }
      return item;
    }));
  };

  const removeFromCart = (productId: string) => {
    setCart(prevCart => prevCart.filter(item => item.product.id !== productId));
  };

  const handleFinalizeSale = () => {
    if (cart.length === 0) return;
    const transactionId = Math.random().toString(36).substr(2, 6).toUpperCase();
    const date = new Date().toISOString();
    
    const newSales: Sale[] = cart.map(item => {
      const itemTotal = item.product.salePrice * item.quantity;
      // Distribui o desconto proporcionalmente se houver mais de um item
      const itemDiscount = cartTotal > 0 ? (itemTotal / cartTotal) * totalDiscount : 0;
      
      return {
        id: Math.random().toString(36).substr(2, 9),
        productId: item.product.id,
        productName: item.product.name,
        date,
        quantity: item.quantity,
        originalPrice: item.product.salePrice,
        discount: itemDiscount,
        finalPrice: itemTotal - itemDiscount,
        costAtSale: item.product.costPrice,
        paymentMethod: selectedPaymentMethod,
        sellerName: currentUser?.name || 'Sistema',
        transactionId
      };
    });

    const updatedProducts = products.map(p => {
      const cartItem = cart.find(item => item.product.id === p.id);
      if (cartItem) return { ...p, quantity: p.quantity - cartItem.quantity };
      return p;
    });
    setProducts(updatedProducts);
    setSales([...newSales, ...sales]);
    setLastSaleAmount(finalTotal);
    setLastTransactionItems([...cart]);
    setLastPaymentMethod(selectedPaymentMethod);
    setLastTransactionId(transactionId);
    setLastSaleDate(date);
    setCart([]);
    setTotalDiscount(0);
    setShowCheckoutModal(false);
    setShowCartDrawer(false);
    setShowSuccess(true);
  };

  const filteredProducts = products.filter(p => 
    p.quantity > 0 && 
    (p.name.toLowerCase().includes(productSearch.toLowerCase()) || (p.barcode && p.barcode.includes(productSearch)))
  );

  const paginatedProducts = filteredProducts.slice(0, settings.itemsPerPage === 999 ? filteredProducts.length : settings.itemsPerPage * currentPage);

  const paginatedSales = sales.slice(0, settings.itemsPerPage === 999 ? sales.length : settings.itemsPerPage * currentPage);

  const loadMore = () => {
    setCurrentPage(prev => prev + 1);
  };

  return (
    <div className="space-y-4 pb-32">
      {showHistory ? (
        <div className="space-y-4 animate-in fade-in slide-in-from-right duration-300">
           <div className="flex items-center gap-3">
            <button onClick={() => setShowHistory(false)} className="p-2 bg-slate-100 rounded-full"><ArrowLeft size={20} /></button>
            <h2 className="text-xl font-black text-slate-800 uppercase tracking-tighter">Histórico de Vendas</h2>
          </div>
          {/* Histórico permanece igual */}
          <div className="grid gap-2">
            {paginatedSales.map(sale => (
              <div key={sale.id} className="bg-white p-4 border border-slate-100 rounded-2xl flex justify-between items-center shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-emerald-50 text-emerald-500 rounded-lg flex items-center justify-center shrink-0">
                    <ShoppingBag size={16} />
                  </div>
                  <div>
                    <p className="text-xs font-black uppercase text-slate-800">{sale.productName}</p>
                    <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">{formatDate(sale.date)} • {sale.paymentMethod}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <p className="font-black text-emerald-600 text-sm">{formatCurrency(sale.finalPrice)}</p>
                  <button 
                    onClick={() => initiateCancelSale(sale)}
                    disabled={isCancelling === sale.id}
                    className="p-2 text-slate-300 hover:text-red-500 bg-slate-50 rounded-xl active:scale-90 disabled:opacity-50"
                  >
                    {isCancelling === sale.id ? <Loader2 className="animate-spin" size={14} /> : <Trash2 size={14} />}
                  </button>
                </div>
              </div>
            ))}
          </div>

          {settings.itemsPerPage !== 999 && sales.length > paginatedSales.length && (
            <button 
              onClick={loadMore}
              className="w-full py-4 bg-slate-100 text-slate-500 rounded-2xl font-black uppercase text-xs tracking-widest mt-4 active:scale-95 transition-transform">
              Carregar Mais
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between px-1">
            <h2 className="text-xl font-black text-slate-800 uppercase tracking-tighter flex items-center gap-2">
              <ShoppingCart size={22} className="text-emerald-600" /> VENDAS
            </h2>
            <button onClick={() => setShowHistory(true)} className="p-3 text-slate-400 bg-white border border-slate-100 rounded-2xl active:scale-90 transition-all shadow-sm">
              <History size={20} />
            </button>
          </div>

          <div className="flex gap-2">
            <div className="relative group flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
              <input type="text" placeholder="Nome ou código..." className="w-full pl-12 pr-4 py-4 bg-white border-none rounded-2xl text-xs font-bold shadow-sm outline-none" value={productSearch} onChange={(e) => setProductSearch(e.target.value)} />
            </div>
            <button onClick={startScanner} className="p-4 bg-slate-900 text-white rounded-2xl shadow-xl active:scale-95 transition-all"><ScanBarcode size={24} /></button>
          </div>

          {/* --- GRID DE VENDAS: MODIFICADO PARA PC (Muito Mais Colunas e Cards Menores) --- */}
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 gap-3">
            {paginatedProducts.map(product => (
              <button key={product.id} onClick={() => addToCart(product)} className="bg-white border border-slate-50 rounded-[2rem] overflow-hidden shadow-sm text-left active:scale-95 transition-all flex flex-col group hover:border-b-emerald-500 border-b-4 border-transparent">
                {/* Altura reduzida de h-28 para h-24/h-20 para ser mais compacto no PC */}
                <div className="h-24 md:h-20 bg-slate-50 relative overflow-hidden">
                  {product.photo ? (
                    <img src={product.photo} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-200"><Package size={20} /></div>
                  )}
                  <span className="absolute top-2 right-2 bg-slate-950/80 text-white text-[7px] font-black px-1.5 py-0.5 rounded shadow-lg">
                    {product.quantity}
                  </span>
                </div>
                <div className="p-2">
                  <h3 className="font-bold text-slate-800 text-[8px] uppercase truncate mb-0.5">{product.name}</h3>
                  <p className="text-emerald-600 font-black text-[10px]">{formatCurrency(product.salePrice)}</p>
                </div>
              </button>
            ))}
          </div>

          {settings.itemsPerPage !== 999 && filteredProducts.length > paginatedProducts.length && (
            <button 
              onClick={loadMore}
              className="w-full py-4 bg-slate-100 text-slate-500 rounded-2xl font-black uppercase text-xs tracking-widest my-4 active:scale-95 transition-transform">
              Carregar Mais
            </button>
          )}

          {/* BARRA DE CARRINHO (RODAPÉ) */}
          <div className="fixed bottom-20 left-0 right-0 p-4 z-40 bg-gradient-to-t from-slate-50 via-slate-50/80 to-transparent">
            <div className="max-w-xl mx-auto">
              <div className="bg-slate-950 rounded-[2.5rem] shadow-2xl overflow-hidden">
                <div className="p-4 flex items-center justify-between cursor-pointer" onClick={() => setShowCartDrawer(!showCartDrawer)}>
                  <div className="flex items-center gap-4">
                    <div className="relative">
                      <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center text-emerald-500"><ShoppingCart size={20} /></div>
                      <span className="absolute -top-2 -right-2 bg-emerald-500 text-white text-[9px] font-black w-5 h-5 rounded-full flex items-center justify-center border-2 border-slate-950">{cart.length}</span>
                    </div>
                    <div>
                      <p className="text-[8px] font-black uppercase text-slate-500">TOTAL</p>
                      <p className="text-lg font-black text-white">{formatCurrency(cartTotal)}</p>
                    </div>
                  </div>
                  <button onClick={(e) => { e.stopPropagation(); if(cart.length > 0) setShowCheckoutModal(true); }} disabled={cart.length === 0} className="bg-emerald-500 text-white px-6 py-3 rounded-xl font-black text-[10px] uppercase disabled:opacity-20 shadow-xl shadow-emerald-500/20">FECHAR</button>
                </div>
                {showCartDrawer && (
                  <div className="px-5 pb-6 max-h-[30vh] overflow-y-auto space-y-2">
                    {cart.map(item => (
                      <div key={item.product.id} className="bg-white/5 p-3 rounded-xl flex items-center justify-between">
                        <div className="flex items-center gap-3 min-w-0">
                          <h4 className="text-[9px] font-black text-white uppercase truncate">{item.product.name}</h4>
                        </div>
                        <div className="flex items-center gap-3">
                           <div className="flex items-center bg-slate-900 rounded-lg p-1 border border-white/5">
                             <button onClick={() => updateCartQuantity(item.product.id, -1)} className="p-1 text-slate-400"><Minus size={12} /></button>
                             <span className="w-6 text-center text-[10px] font-black text-white">{item.quantity}</span>
                             <button onClick={() => updateCartQuantity(item.product.id, 1)} className="p-1 text-slate-400"><Plus size={12} /></button>
                           </div>
                           <button onClick={() => removeFromCart(item.product.id)} className="text-red-500"><Trash2 size={14} /></button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* MODAL DE CHECKOUT */}
      {showCheckoutModal && (
        <div className="fixed inset-0 bg-slate-950/80 flex items-center justify-center z-[100] p-4 backdrop-blur-md">
          <div className="bg-white w-full max-w-sm rounded-[3rem] p-8 space-y-6">
            <h3 className="text-xl font-black text-slate-800 uppercase tracking-tighter text-center">Checkout</h3>
            
            <div className="space-y-4">
              <div className="bg-slate-50 p-4 rounded-3xl space-y-1">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Subtotal</p>
                <p className="text-xl font-black text-slate-600 text-center">{formatCurrency(cartTotal)}</p>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Desconto (R$)</label>
                <div className="relative">
                  <Minus className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                  <input 
                    type="number" 
                    value={totalDiscount || ''} 
                    onChange={(e) => setTotalDiscount(Number(e.target.value))}
                    className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-black outline-none focus:border-emerald-500 transition-colors"
                    placeholder="0,00"
                  />
                </div>
              </div>

              <div className="bg-emerald-50 p-6 rounded-3xl text-center">
                <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-1">Total a Pagar</p>
                <p className="text-4xl font-black text-emerald-800">{formatCurrency(finalTotal)}</p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {['Dinheiro', 'Cartão', 'PIX'].map(m => (
                <button key={m} onClick={() => setSelectedPaymentMethod(m as any)} className={`py-4 rounded-2xl text-[9px] font-black uppercase border transition-all ${selectedPaymentMethod === m ? 'bg-emerald-600 border-emerald-600 text-white shadow-xl' : 'bg-white border-slate-100 text-slate-400'}`}>{m}</button>
              ))}
            </div>
            <button onClick={handleFinalizeSale} className="w-full py-5 bg-emerald-600 text-white rounded-2xl font-black uppercase text-[10px] shadow-xl">FINALIZAR VENDA</button>
            <button onClick={() => setShowCheckoutModal(false)} className="w-full text-slate-400 font-black uppercase text-[9px]">Cancelar</button>
          </div>
        </div>
      )}

      {/* SUCESSO */}
      {showSuccess && (
        <div className="fixed inset-0 bg-slate-950/90 flex items-center justify-center z-[110] p-6 backdrop-blur-xl">
          <div className="bg-white w-full max-w-xs rounded-[3rem] p-10 text-center shadow-2xl">
            <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-[2.5rem] flex items-center justify-center mx-auto mb-6 shadow-lg"><CheckCircle2 size={48} /></div>
            <h3 className="text-xl font-black text-slate-800 uppercase mb-10">Venda Realizada!</h3>
            <button onClick={() => setShowSuccess(false)} className="w-full py-5 bg-slate-900 text-white font-black rounded-2xl text-[10px] uppercase shadow-xl">NOVA VENDA</button>
          </div>
        </div>
      )}

      {/* MODAL SCANNER */}
      {isScannerOpen && (
        <div className="fixed inset-0 bg-slate-950 z-[200] flex flex-col animate-in fade-in">
           <div className="p-6 flex items-center justify-between border-b border-white/10">
              <h3 className="font-black text-white uppercase text-xs tracking-widest">Scanner de Código</h3>
              <button onClick={stopScanner} className="p-2 bg-white/10 text-white rounded-full"><X size={20} /></button>
           </div>
           <div className="flex-1 relative flex items-center justify-center">
              <div id="scanner-region-sales" className="w-full h-full max-h-[60vh]"></div>
              <div className="absolute bottom-10 left-0 right-0 text-center px-6 pointer-events-none">
                <p className="text-white/60 text-[10px] font-bold uppercase tracking-widest bg-black/40 py-2 px-4 rounded-full inline-block">Aproxime o código lentamente para focar</p>
              </div>
           </div>
        </div>
      )}

      {/* MODAL DE AUTENTICAÇÃO PARA CANCELAMENTO */}
      {isAuthModalOpen && (
        <div className="fixed inset-0 bg-slate-950/90 z-[200] flex items-center justify-center p-6 backdrop-blur-xl animate-in fade-in">
           <div className="bg-white w-full max-w-xs rounded-[3rem] p-10 shadow-2xl animate-in zoom-in-95 border border-slate-100">
              <div className="w-20 h-20 bg-red-50 text-red-600 rounded-[2.5rem] flex items-center justify-center mx-auto mb-8 shadow-inner">
                 <Lock size={36} />
              </div>
              <h3 className="text-center font-black text-slate-800 uppercase text-sm mb-1">Autorização Requerida</h3>
              <p className="text-center text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-10 leading-tight">
                Insira a senha do administrador<br/>para cancelar esta venda
              </p>
              
              <div className={`flex items-center gap-3 bg-slate-50 border rounded-2xl px-5 py-5 mb-4 transition-all ${authError ? 'border-red-500 bg-red-50 ring-4 ring-red-100' : 'border-slate-100 focus-within:border-blue-500'}`}>
                 <KeyRound size={20} className={authError ? 'text-red-500' : 'text-slate-300'} />
                 <input 
                   type="password" 
                   autoFocus
                   value={passwordInput}
                   onChange={(e) => setPasswordInput(e.target.value)}
                   onKeyDown={(e) => e.key === 'Enter' && confirmCancellation()}
                   placeholder="SENHA DO ADM"
                   className="bg-transparent w-full outline-none font-black text-sm uppercase placeholder:text-slate-200"
                 />
              </div>
              
              {authError && <p className="text-center text-[9px] font-black text-red-500 uppercase mb-4 animate-bounce">Senha Incorreta!</p>}

              <div className="flex flex-col gap-2">
                 <button onClick={confirmCancellation} disabled={verifyingPassword} className="w-full py-5 bg-red-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl shadow-red-500/20 active:scale-95 transition-all flex items-center justify-center disabled:opacity-50">
                   {verifyingPassword ? <Loader2 size={18} className="animate-spin" /> : 'AUTORIZAR CANCELAMENTO'}
                 </button>
                 <button onClick={() => { setIsAuthModalOpen(false); setPasswordInput(''); setSelectedSaleToCancel(null); }} className="w-full py-4 text-slate-400 font-black uppercase text-[10px] tracking-widest">VOLTAR</button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default SalesTab;
