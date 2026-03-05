
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ShoppingBag, Search, X, History, ShoppingCart, Package, ArrowLeft, CheckCircle2, Eye, Loader2, Plus, Minus, Trash2, ChevronUp, ChevronDown, Receipt, Share2, Download, ScanBarcode, Lock, KeyRound, Printer, LayoutGrid, Grid, List, Rows, CreditCard } from 'lucide-react';
import html2pdf from 'html2pdf.js';
import html2canvas from 'html2canvas';
import { Product, Sale, AppSettings, User } from '../types';
import { formatCurrency, parseCurrencyString, formatDate, formatDateTime, playBeepSound } from '../utils';
import { OnlineDB } from '../utils/api';
import { Html5Qrcode } from 'html5-qrcode';

interface Props {
  products: Product[];
  setProducts: (products: Product[]) => void;
  sales: Sale[];
  setSales: (sales: Sale[]) => void;
  settings: AppSettings;
  onUpdateSettings: (settings: AppSettings) => Promise<void>;
  currentUser: User | null;
  onDeleteSale: (sale: Sale) => Promise<void>;
  tenantId: string;
}

interface CartItem {
  product: Product;
  quantity: number;
}

interface PaymentEntry {
  method: 'Dinheiro' | 'Cartão' | 'PIX';
  amount: number;
  installments?: number;
}

const SalesTab: React.FC<Props> = ({ products, setProducts, sales, setSales, settings, onUpdateSettings, currentUser, onDeleteSale, tenantId }) => {
  const [showHistory, setShowHistory] = useState(false);
  const [productSearch, setProductSearch] = useState('');

  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [showHistoryReceiptModal, setShowHistoryReceiptModal] = useState(false);
  const [showReceiptOptions, setShowReceiptOptions] = useState(false);
  const [lastSaleAmount, setLastSaleAmount] = useState(0);
  const [lastTransactionItems, setLastTransactionItems] = useState<CartItem[]>([]);
  const [lastPaymentMethod, setLastPaymentMethod] = useState('');
  const [lastTransactionId, setLastTransactionId] = useState('');
  const [lastSaleDate, setLastSaleDate] = useState('');
  const [lastSurcharge, setLastSurcharge] = useState(0);
  const [lastDiscount, setLastDiscount] = useState(0);
  const [lastChange, setLastChange] = useState(0);
  const [lastPaymentEntries, setLastPaymentEntries] = useState<PaymentEntry[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [layoutMode, setLayoutMode] = useState<'small' | 'medium' | 'list'>(settings.salesLayout || 'small');

  const [isCancelling, setIsCancelling] = useState<string | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [verifyingPassword, setVerifyingPassword] = useState(false);
  const [authError, setAuthError] = useState(false);
  const [selectedSaleToCancel, setSelectedSaleToCancel] = useState<Sale | null>(null);

  const [cart, setCart] = useState<CartItem[]>([]);
  const [showCartDrawer, setShowCartDrawer] = useState(false);
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [totalDiscount, setTotalDiscount] = useState(0);
  const [totalSurcharge, setTotalSurcharge] = useState(0); // Acréscimo em %
  const [paymentEntries, setPaymentEntries] = useState<PaymentEntry[]>([{ method: 'Dinheiro', amount: 0 }]);
  const [isGeneratingReceipt, setIsGeneratingReceipt] = useState(false);

  const handleDownloadReceipt = () => {
    const element = document.getElementById('receipt-pdf-container');
    if (element) {
      const opt = {
        margin: 0,
        filename: `cupom_${lastTransactionId}.pdf`,
        image: { type: 'jpeg' as const, quality: 0.98 },
        html2canvas: { scale: 3, useCORS: true },
        jsPDF: { unit: 'mm' as const, format: 'a4' as const, orientation: 'portrait' as const }
      };
      html2pdf().set(opt).from(element).save();
    }
  };

  const handleShareWhatsApp = async () => {
    const element = document.getElementById('receipt-content');
    if (!element) return;

    try {
      setIsGeneratingReceipt(true);
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff'
      });
      
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/webp', 0.8));
      
      if (blob) {
        const file = new File([blob], `cupom_${lastTransactionId}.webp`, { type: 'image/webp' });
        
        if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({
            files: [file],
            title: 'Cupom de Venda',
            text: `Cupom da venda #${lastTransactionId}`
          });
        } else {
          // Fallback: download and instructions
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `cupom_${lastTransactionId}.webp`;
          a.click();
          URL.revokeObjectURL(url);
          alert('O cupom foi baixado em formato WebP. Agora você pode compartilhá-lo manualmente no WhatsApp.');
        }
      }
    } catch (error) {
      console.error('Erro ao gerar imagem para WhatsApp:', error);
      alert('Erro ao gerar o cupom para compartilhamento.');
    } finally {
      setIsGeneratingReceipt(false);
    }
  };

  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);

  const startScanner = async (mode: 'search' = 'search') => {
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
            playBeepSound();
            const product = products.find(p => p.barcode === decodedText);
            if (product) {
              addToCart(product);
            } else {
              setProductSearch(decodedText);
            }
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
    const discounted = Math.max(0, cartTotal - totalDiscount);
    const surchargeAmount = discounted * (totalSurcharge / 100);
    return discounted + surchargeAmount;
  }, [cartTotal, totalDiscount, totalSurcharge]);

  const calculateFinalTotal = (discount: number, surcharge: number) => {
    const discounted = Math.max(0, cartTotal - discount);
    const surchargeAmount = discounted * (surcharge / 100);
    return discounted + surchargeAmount;
  };

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

  const addPaymentEntry = () => {
    if (paymentEntries.length < 2) {
      setPaymentEntries(prev => [...prev, { method: 'Dinheiro', amount: 0 }]);
    }
  };

  const removePaymentEntry = (index: number) => {
    setPaymentEntries(prev => prev.filter((_, i) => i !== index));
  };

  const updatePaymentEntry = (index: number, field: keyof PaymentEntry, value: any) => {
    setPaymentEntries(prev => prev.map((entry, i) => {
      if (i === index) {
        const updated = { ...entry, [field]: value };
        if (field === 'method' && value === 'Cartão' && !updated.installments) {
          updated.installments = 1;
        }
        return updated;
      }
      return entry;
    }));
  };

  const handleFinalizeSale = () => {
    if (cart.length === 0) return;
    const uniqueTransactions = new Set(sales.map(s => s.transactionId).filter(Boolean));
    const nextTransactionNumber = uniqueTransactions.size + 1;
    const transactionId = nextTransactionNumber.toString().padStart(2, '0');
    const date = new Date().toISOString();
    
    const totalPaid = paymentEntries.reduce((acc, curr) => acc + curr.amount, 0);
    const totalCash = paymentEntries.filter(p => p.method === 'Dinheiro').reduce((acc, curr) => acc + curr.amount, 0);
    const change = paymentEntries.length < 2 ? Math.min(Math.max(0, totalPaid - finalTotal), totalCash) : 0;



    const discountedTotal = Math.max(0, cartTotal - totalDiscount);
    const surchargeAmount = discountedTotal * (totalSurcharge / 100);

    const newSales: Sale[] = cart.map((item, index) => {
      const itemTotal = item.product.salePrice * item.quantity;
      // Distribui o desconto proporcionalmente se houver mais de um item
      const itemDiscount = cartTotal > 0 ? (itemTotal / cartTotal) * totalDiscount : 0;
      const itemSurcharge = cartTotal > 0 ? (itemTotal / cartTotal) * surchargeAmount : 0;
      
      const nextIdNumber = sales.length + index + 1;
      const formattedId = nextIdNumber.toString().padStart(2, '0');

      const newSale: Sale = {
        id: formattedId,
        productId: item.product.id,
        productName: item.product.name,
        date,
        quantity: item.quantity,
        originalPrice: item.product.salePrice,
        discount: itemDiscount,
        surcharge: itemSurcharge,
        finalPrice: itemTotal - itemDiscount + itemSurcharge,
        costAtSale: item.product.costPrice * item.quantity,
        paymentMethod: paymentEntries.map(p => p.method === 'Cartão' && p.installments && p.installments > 1 ? `${p.method} (${p.installments}x)` : p.method).join(', '),
        paymentEntriesJson: JSON.stringify(paymentEntries),
        change: change,
        sellerName: currentUser?.name || 'Sistema',
        sellerId: currentUser?.id,
        transactionId
      };

      // Calcula comissão em background
      if (tenantId && currentUser?.id) {
        OnlineDB.calculateAndLogCommission(tenantId, newSale, 'sale', currentUser.id);
      }

      return newSale;
    });

    const updatedProducts = products.map(p => {
      const cartItem = cart.find(item => item.product.id === p.id);
      if (cartItem) return { ...p, quantity: p.quantity - cartItem.quantity };
      return p;
    });
    setProducts(updatedProducts);
    setSales([...newSales, ...sales]);
    setLastSaleAmount(finalTotal); // Record the actual sale amount, not the received amount
    setLastSurcharge(surchargeAmount);
    setLastDiscount(totalDiscount);
    setLastChange(change);
    setLastPaymentEntries([...paymentEntries]);
    setLastTransactionItems([...cart]);
    setLastPaymentMethod(paymentEntries.map(p => p.method === 'Cartão' && p.installments && p.installments > 1 ? `${p.method} (${p.installments}x)` : p.method).join(', '));
    setLastTransactionId(transactionId);
    setLastSaleDate(date);
    setCart([]);
    setTotalDiscount(0);
    setTotalSurcharge(0);
    setPaymentEntries([{ method: 'Dinheiro', amount: 0 }]);
    setShowCheckoutModal(false);
    setShowCartDrawer(false);
    setShowReceiptModal(true);
  };

  const reprintReceipt = (sale: Sale) => {
    const relatedSales = sales.filter(s => s.transactionId === sale.transactionId);
    
    // Reconstruct cart items from sales
    const items: CartItem[] = relatedSales.map(s => ({
      product: {
        id: s.productId,
        name: s.productName,
        salePrice: s.originalPrice,
        costPrice: s.costAtSale,
        quantity: 0, // Not needed for receipt
        photo: null
      },
      quantity: s.quantity
    }));

    const total = relatedSales.reduce((acc, s) => acc + s.finalPrice, 0);
    const discount = relatedSales.reduce((acc, s) => acc + s.discount, 0);
    const surcharge = relatedSales.reduce((acc, s) => acc + (s.surcharge || 0), 0);
    
    setLastTransactionItems(items);
    setLastSaleAmount(total);
    setLastDiscount(discount);
    setLastSurcharge(surcharge);
    setLastTransactionId(sale.transactionId || '');
    setLastSaleDate(sale.date);
    setLastPaymentMethod(sale.paymentMethod || '');
    
    if (sale.paymentEntriesJson) {
      try {
        setLastPaymentEntries(JSON.parse(sale.paymentEntriesJson));
      } catch (e) {
        setLastPaymentEntries([{ method: 'Dinheiro', amount: total }]);
      }
    } else {
      setLastPaymentEntries([{ method: 'Dinheiro', amount: total }]);
    }
    
    setLastChange(sale.change || 0);
    setShowHistoryReceiptModal(true);
  };

  const { sortedProducts, topSellers } = useMemo(() => {
    const salesCount: Record<string, number> = {};
    sales.forEach(sale => {
      salesCount[sale.productId] = (salesCount[sale.productId] || 0) + sale.quantity;
    });

    const filtered = products.filter(p => 
      p.quantity > 0 && 
      (p.name.toLowerCase().includes(productSearch.toLowerCase()) || (p.barcode && p.barcode.includes(productSearch)))
    );

    const sorted = [...filtered].sort((a, b) => (salesCount[b.id] || 0) - (salesCount[a.id] || 0));
    
    // Identifica os IDs dos top 3 mais vendidos (que tenham pelo menos 1 venda)
    const topIds = sorted
      .filter(p => (salesCount[p.id] || 0) > 0)
      .slice(0, 3)
      .map(p => p.id);

    return { sortedProducts: sorted, topSellers: topIds };
  }, [products, sales, productSearch]);

  const paginatedProducts = sortedProducts.slice(0, settings.itemsPerPage * currentPage);

  const sortedSales = useMemo(() => {
    return [...sales].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [sales]);

  const paginatedSales = sortedSales.slice(0, settings.itemsPerPage * currentPage);

  const loadMore = () => {
    setCurrentPage(prev => prev + 1);
  };

  const toggleLayout = () => {
    const modes: ('small' | 'medium' | 'list')[] = ['small', 'medium', 'list'];
    const nextIndex = (modes.indexOf(layoutMode) + 1) % modes.length;
    const newMode = modes[nextIndex];
    setLayoutMode(newMode);
    onUpdateSettings({ ...settings, salesLayout: newMode });
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
              <div 
                key={sale.id} 
                onClick={() => reprintReceipt(sale)}
                className="bg-white p-4 border border-slate-100 rounded-2xl flex justify-between items-center shadow-sm cursor-pointer active:scale-[0.98] transition-all hover:bg-slate-50 group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-emerald-50 text-emerald-500 rounded-lg flex items-center justify-center shrink-0 group-hover:bg-emerald-100 transition-colors">
                    <ShoppingBag size={16} />
                  </div>
                  <div>
                    <p className="text-xs font-black uppercase text-slate-800">{sale.productName}</p>
                    <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">Pedido #{sale.transactionId} • {formatDate(sale.date)} • {sale.paymentMethod}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
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

          {sales.length > paginatedSales.length && (
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

          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
              <input type="text" placeholder="Nome ou código..." className="w-full pl-11 pr-4 py-3.5 bg-white border-none rounded-2xl text-sm font-medium shadow-sm outline-none focus:ring-2 focus:ring-slate-900" value={productSearch} onChange={(e) => setProductSearch(e.target.value)} />
            </div>
            <button onClick={() => startScanner('search')} className="p-3.5 bg-white text-slate-600 rounded-2xl shadow-sm active:scale-95 shrink-0">
              <ScanBarcode size={20} />
            </button>
            <button onClick={toggleLayout} className="p-3.5 bg-white text-slate-400 hover:text-slate-600 transition-colors rounded-2xl shadow-sm active:scale-95 shrink-0">
               {layoutMode === 'small' && <Grid size={20} />}
               {layoutMode === 'medium' && <LayoutGrid size={20} />}
               {layoutMode === 'list' && <Rows size={20} />}
            </button>
          </div>

          {/* --- GRID DE VENDAS --- */}
          <div className={`grid gap-3 ${
            layoutMode === 'small' ? 'grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10' :
            layoutMode === 'medium' ? 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8' :
            'grid-cols-1'
          }`}>
            {paginatedProducts.map(product => {
              const isTopSeller = topSellers.includes(product.id);
              return (
                <button 
                  key={product.id} 
                  onClick={() => addToCart(product)} 
                  className={`bg-white border rounded-[2rem] overflow-hidden shadow-sm text-left active:scale-95 transition-all flex group hover:border-b-emerald-500 border-b-4 ${
                    isTopSeller ? 'neon-glow border-emerald-400' : 'border-slate-50 border-transparent'
                  } ${layoutMode === 'list' ? 'flex-row items-center p-2 gap-3' : 'flex-col'}`}
                >
                  {/* Imagem */}
                  <div className={`bg-slate-50 relative overflow-hidden shrink-0 ${
                    layoutMode === 'list' ? 'w-14 h-14 rounded-2xl' : 
                    layoutMode === 'small' ? 'h-20' : 
                    'h-24 md:h-20'
                  }`}>
                    {product.photo ? (
                      <img src={product.photo} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-200"><Package size={layoutMode === 'small' || layoutMode === 'list' ? 16 : 20} /></div>
                    )}
                    {layoutMode !== 'list' && (
                      <span className="absolute top-2 right-2 bg-slate-950/80 text-white text-[7px] font-black px-1.5 py-0.5 rounded shadow-lg">
                        {product.quantity}
                      </span>
                    )}
                    {isTopSeller && (
                      <div className="absolute top-2 left-2 bg-emerald-500 text-white text-[6px] font-black px-1.5 py-0.5 rounded shadow-lg uppercase tracking-tighter">
                        Top
                      </div>
                    )}
                  </div>

                  {/* Conteúdo */}
                  <div className={`${layoutMode === 'list' ? 'flex-1 flex items-center justify-between pr-2 min-w-0' : 'p-2'}`}>
                    <div className="min-w-0 flex-1 mr-2">
                      <h3 className={`font-bold text-slate-800 uppercase truncate mb-0.5 ${layoutMode === 'small' ? 'text-[8px]' : 'text-[9px] sm:text-[10px]'}`}>{product.name}</h3>
                      <p className="text-emerald-600 font-black text-[10px] sm:text-xs">{formatCurrency(product.salePrice)}</p>
                      {layoutMode === 'list' && (
                         <div className="flex items-center gap-2 mt-0.5">
                            <span className={`px-2 py-0.5 rounded-md text-[8px] font-black uppercase tracking-widest ${product.quantity <= 2 ? 'bg-red-100 text-red-600' : 'bg-slate-100 text-slate-600'}`}>Estoque: {product.quantity}</span>
                         </div>
                      )}
                    </div>
                    
                    {layoutMode === 'list' && (
                      <div className="flex items-center justify-center w-8 h-8 bg-emerald-50 text-emerald-600 rounded-full shrink-0">
                        <Plus size={16} />
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {sortedProducts.length > paginatedProducts.length && (
            <button 
              onClick={loadMore}
              className="w-full py-4 bg-slate-100 text-slate-500 rounded-2xl font-black uppercase text-xs tracking-widest my-4 active:scale-95 transition-transform">
              Carregar Mais
            </button>
          )}

          {/* BARRA DE CARRINHO (RODAPÉ) */}
          <div className="fixed bottom-20 left-0 right-0 md:bottom-6 md:left-1/2 md:right-auto md:-translate-x-1/2 md:w-[600px] p-4 z-40 pointer-events-none">
            <div className="max-w-xl mx-auto pointer-events-auto md:max-w-none">
              <div className="bg-slate-950 rounded-[2.5rem] shadow-2xl overflow-hidden border border-white/10">
                <div className="py-2 px-4 md:py-2 md:px-6 flex items-center justify-between cursor-pointer" onClick={() => setShowCartDrawer(!showCartDrawer)}>
                  <div className="flex items-center gap-4">
                    <div className="relative">
                      <div className="w-8 h-8 md:w-8 md:h-8 bg-white/10 rounded-xl flex items-center justify-center text-emerald-500"><ShoppingCart size={16} className="md:w-4 md:h-4" /></div>
                      <span className="absolute -top-2 -right-2 bg-emerald-500 text-white text-[9px] font-black w-5 h-5 rounded-full flex items-center justify-center border-2 border-slate-950">{cart.length}</span>
                    </div>
                    <div className="flex flex-col md:flex-row md:items-center md:gap-2">
                      <p className="text-[8px] font-black uppercase text-slate-500 md:text-[9px]">TOTAL</p>
                      <p className="text-base font-black text-white md:text-base">{formatCurrency(cartTotal)}</p>
                    </div>
                  </div>
                  <button 
                    onClick={(e) => { 
                      e.stopPropagation(); 
                      if(cart.length > 0) {
                        setPaymentEntries([{ method: 'Dinheiro', amount: finalTotal }]);
                        setShowCheckoutModal(true); 
                      }
                    }} 
                    disabled={cart.length === 0} 
                    className="bg-emerald-500 text-white px-4 py-2 md:px-8 md:py-2 rounded-xl font-black text-[10px] uppercase disabled:opacity-20 shadow-xl shadow-emerald-500/20 hover:bg-emerald-400 transition-colors"
                  >
                    COBRAR
                  </button>
                </div>
                {showCartDrawer && (
                  <div className="px-5 pb-6 max-h-[30vh] md:max-h-[40vh] overflow-y-auto space-y-2 custom-scrollbar">
                    {cart.map(item => (
                      <div key={item.product.id} className="bg-white/5 p-3 rounded-xl flex items-center justify-between">
                        <div className="flex items-center gap-3 min-w-0">
                          <h4 className="text-[9px] font-black text-white uppercase truncate max-w-[200px]" title={item.product.name}>
                            {item.product.name.length > 25 ? item.product.name.substring(0, 25) + '...' : item.product.name}
                          </h4>
                        </div>
                        <div className="flex items-center gap-2">
                           <div className="flex items-center bg-slate-900 rounded-lg p-1 border border-white/5">
                             <button onClick={() => updateCartQuantity(item.product.id, -1)} className="p-1 text-slate-400 hover:text-white"><Minus size={10} /></button>
                             <span className="w-5 text-center text-[9px] font-black text-white">{item.quantity}</span>
                             <button onClick={() => updateCartQuantity(item.product.id, 1)} className="p-1 text-slate-400 hover:text-white"><Plus size={10} /></button>
                           </div>
                           <button onClick={() => removeFromCart(item.product.id)} className="text-red-500 hover:text-red-400"><Trash2 size={12} /></button>
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
          <div className="bg-white w-full max-w-sm rounded-[3rem] p-8 space-y-4 overflow-y-auto max-h-[90vh]">
            <h3 className="text-xl font-black text-slate-800 uppercase tracking-tighter text-center">Checkout</h3>
            
            <div className="space-y-3">
              {/* DESCONTO E ACRÉSCIMO (Compact) */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-4">Desconto (R$)</label>
                  <div className="relative">
                    <Minus className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={14} />
                    <input 
                      type="number" 
                      value={totalDiscount || ''} 
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        setTotalDiscount(val);
                        if (paymentEntries.length === 1) {
                          setPaymentEntries([{ ...paymentEntries[0], amount: calculateFinalTotal(val, totalSurcharge) }]);
                        }
                      }}
                      className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-xs font-black outline-none focus:border-emerald-500 transition-colors"
                      placeholder="0,00"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-4">Acréscimo (%)</label>
                  <div className="relative">
                    <Plus className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={14} />
                    <input 
                      type="number" 
                      value={totalSurcharge || ''} 
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        setTotalSurcharge(val);
                        if (paymentEntries.length === 1) {
                          setPaymentEntries([{ ...paymentEntries[0], amount: calculateFinalTotal(totalDiscount, val) }]);
                        }
                      }}
                      className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-xs font-black outline-none focus:border-blue-500 transition-colors"
                      placeholder="0%"
                    />
                  </div>
                </div>
              </div>

              {/* FORMAS DE PAGAMENTO (Max 2) */}
              <div className="space-y-2">
                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-4">Pagamento</p>
                {paymentEntries.map((entry, index) => (
                  <div key={index} className="space-y-1">
                    <div className="flex items-center gap-1 bg-slate-50 p-1 rounded-xl border border-slate-100">
                      <select
                        value={entry.method}
                        onChange={(e) => updatePaymentEntry(index, 'method', e.target.value as 'Dinheiro' | 'Cartão' | 'PIX')}
                        className="bg-transparent outline-none font-bold text-[8px] uppercase w-16"
                      >
                        <option>Dinheiro</option>
                        <option>Cartão</option>
                        <option>PIX</option>
                      </select>
                      <input
                        type="number"
                        value={entry.amount || ''}
                        onChange={(e) => updatePaymentEntry(index, 'amount', Number(e.target.value))}
                        placeholder="0.00"
                        className="flex-1 bg-white px-1 py-0 rounded-md outline-none font-black text-xs text-right border-2 border-slate-200 focus:border-emerald-500 transition-all"
                      />
                      {paymentEntries.length > 1 && (
                        <button onClick={() => removePaymentEntry(index)} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg">
                          <X size={14} />
                        </button>
                      )}
                    </div>
                    {entry.method === 'Cartão' && (
                      <div className="flex items-center justify-between px-4 animate-in fade-in slide-in-from-top-1">
                        <div className="flex items-center gap-2">
                          <span className="text-[7px] font-black text-slate-400 uppercase">Parcelas:</span>
                          <select 
                            value={entry.installments || 1}
                            onChange={(e) => updatePaymentEntry(index, 'installments', Number(e.target.value))}
                            className="bg-white border border-slate-200 rounded px-1 py-0.5 text-[9px] font-black outline-none"
                          >
                            {[...Array(12)].map((_, i) => (
                              <option key={i+1} value={i+1}>{i+1}x</option>
                            ))}
                          </select>
                        </div>
                        {entry.installments && entry.installments > 1 && entry.amount > 0 && (
                          <span className="text-[8px] font-black text-emerald-600">
                            {entry.installments}x {formatCurrency(entry.amount / entry.installments)}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                ))}
                {paymentEntries.length < 2 && (
                  <button onClick={addPaymentEntry} className="w-full py-2 bg-slate-100 text-slate-500 rounded-xl font-black uppercase text-[8px] flex items-center justify-center gap-2 active:scale-95 transition-all">
                    <Plus size={12} /> Adicionar Forma
                  </button>
                )}
              </div>

              {/* INFORMAÇÕES DE PAGAMENTO DINÂMICAS (TROCO / RESTANTE) */}
              {(() => {
                const totalPaid = paymentEntries.reduce((acc, curr) => acc + curr.amount, 0);
                const remaining = finalTotal - totalPaid;

                if (totalPaid > finalTotal && paymentEntries.length < 2) {
                  const totalCash = paymentEntries.filter(p => p.method === 'Dinheiro').reduce((acc, curr) => acc + curr.amount, 0);
                  const displayChange = Math.min(totalPaid - finalTotal, totalCash);
                  
                  if (displayChange <= 0) return null;

                  return (
                    <div className="bg-blue-50 p-4 rounded-2xl text-center mt-2 animate-in fade-in slide-in-from-top-2">
                      <p className="text-[8px] font-black text-blue-600 uppercase tracking-widest mb-0.5">Troco</p>
                      <p className="text-2xl font-black text-blue-800">{formatCurrency(displayChange)}</p>
                    </div>
                  );
                } else if (remaining > 0) {
                  return (
                    <div className="bg-red-50 p-4 rounded-2xl text-center mt-2 animate-in fade-in slide-in-from-top-2">
                      <p className="text-[8px] font-black text-red-600 uppercase tracking-widest mb-0.5">Faltam</p>
                      <p className="text-2xl font-black text-red-800">{formatCurrency(remaining)}</p>
                    </div>
                  );
                }
                return null;
              })()}

              {/* TOTAL A PAGAR (Grande, no final) */}
              <div className="bg-emerald-50 p-6 rounded-[2rem] text-center mt-4">
                <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-1">Total a Pagar</p>
                <p className="text-4xl font-black text-emerald-800">{formatCurrency(finalTotal)}</p>
              </div>
            </div>

            <div className="space-y-2 pt-2">
              <button 
                onClick={handleFinalizeSale} 
                disabled={paymentEntries.reduce((acc, curr) => acc + curr.amount, 0) < finalTotal - 0.001} 
                className="w-full py-5 bg-emerald-600 text-white rounded-2xl font-black uppercase text-[10px] shadow-xl disabled:opacity-50 active:scale-95 transition-all"
              >
                FINALIZAR VENDA
              </button>
              <button onClick={() => setShowCheckoutModal(false)} className="w-full py-2 text-slate-400 font-black uppercase text-[8px]">Cancelar</button>
            </div>
          </div>
        </div>
      )}


      {/* MODAL DE SUCESSO DA VENDA (APÓS FINALIZAR) */}
      {showReceiptModal && (
        <div className="fixed inset-0 bg-slate-950/90 flex items-center justify-center z-[110] p-6 backdrop-blur-xl animate-in fade-in">
          <div className="bg-white w-full max-w-xs rounded-[3rem] p-10 text-center shadow-2xl animate-in zoom-in-95">
            <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-[2.5rem] flex items-center justify-center mx-auto mb-6 shadow-lg">
              <CheckCircle2 size={48} />
            </div>
            <h3 className="text-xl font-black text-slate-800 uppercase mb-2">Venda Realizada!</h3>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-8">O que deseja fazer agora?</p>
            
            <div className="flex flex-col gap-3">
              <button onClick={handleDownloadReceipt} className="w-full py-5 bg-blue-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl active:scale-95 transition-all flex items-center justify-center gap-2">
                <Download size={18} /> Baixar Cupom
              </button>
              <button onClick={handleShareWhatsApp} disabled={isGeneratingReceipt} className="w-full py-5 bg-emerald-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50">
                {isGeneratingReceipt ? <Loader2 size={18} className="animate-spin" /> : <Share2 size={18} />} Compartilhar WhatsApp
              </button>
              <button onClick={() => window.print()} className="w-full py-5 bg-slate-900 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl active:scale-95 transition-all flex items-center justify-center gap-2">
                <Printer size={18} /> Imprimir Direto
              </button>
              <button onClick={() => { setShowReceiptModal(false); setLastChange(0); }} className="w-full py-4 text-slate-400 font-black uppercase text-[10px] tracking-widest">Nova Venda</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE VISUALIZAÇÃO DE RECIBO (HISTÓRICO) */}
      {showHistoryReceiptModal && (
        <div className="fixed inset-0 bg-slate-950/90 flex items-center justify-center z-[110] p-4 md:p-6 backdrop-blur-xl animate-in fade-in overflow-y-auto">
          <div className="bg-white w-full max-w-md rounded-[2.5rem] p-6 md:p-8 text-center shadow-2xl animate-in zoom-in-95 my-auto relative border-4 border-blue-500/10">
            <div className="flex justify-between items-center mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center shadow-sm">
                  <Receipt size={20} />
                </div>
                <h3 className="text-lg font-black text-slate-800 uppercase tracking-tighter">Visualizar Cupom</h3>
              </div>
              <button onClick={() => { setShowHistoryReceiptModal(false); setShowReceiptOptions(false); }} className="p-2 text-slate-400 hover:text-slate-600 bg-slate-100 rounded-full transition-colors">
                <X size={20} />
              </button>
            </div>

            {/* INFORMAÇÕES DO CUPOM (Digital View) */}
            <div className="mb-20 text-left space-y-8 overflow-y-auto max-h-[60vh] pr-2 custom-scrollbar">
              <div className="space-y-1 pb-6 border-b border-slate-100">
                <h4 className="font-black text-slate-900 uppercase text-lg tracking-tighter leading-tight">{settings.storeName}</h4>
                <div className="flex flex-wrap gap-x-4 gap-y-1">
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{settings.storeAddress}</p>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{settings.storePhone}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-8">
                <div className="space-y-1">
                  <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest">Identificação</p>
                  <p className="text-xs font-black text-slate-700">Pedido #{lastTransactionId}</p>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{formatDateTime(lastSaleDate)}</p>
                </div>
                <div className="space-y-1 text-right">
                  <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest">Vendedor</p>
                  <p className="text-xs font-black text-slate-700 truncate">{currentUser?.name?.toUpperCase() || 'SISTEMA'}</p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest">Produtos</p>
                  <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest">{lastTransactionItems.length} Itens</span>
                </div>
                <div className="space-y-4">
                  {lastTransactionItems.map((item, index) => (
                    <div key={index} className="flex justify-between items-start group">
                      <div className="space-y-1">
                        <p className="text-xs font-black text-slate-800 uppercase group-hover:text-blue-600 transition-colors">{item.product.name}</p>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                          {item.quantity} UN <span className="mx-1 text-slate-200">|</span> {formatCurrency(item.product.salePrice)}
                        </p>
                      </div>
                      <p className="text-xs font-black text-slate-900">{formatCurrency(item.product.salePrice * item.quantity)}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-slate-50 rounded-3xl p-6 space-y-3 border border-slate-100">
                <div className="flex justify-between items-center text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  <span>Subtotal</span>
                  <span>{formatCurrency(lastTransactionItems.reduce((acc, item) => acc + (item.product.salePrice * item.quantity), 0))}</span>
                </div>
                {lastDiscount > 0 && (
                  <div className="flex justify-between items-center text-[10px] font-bold text-red-500 uppercase tracking-widest">
                    <span>Desconto Aplicado</span>
                    <span>-{formatCurrency(lastDiscount)}</span>
                  </div>
                )}
                {lastSurcharge > 0 && (
                  <div className="flex justify-between items-center text-[10px] font-bold text-emerald-500 uppercase tracking-widest">
                    <span>Acréscimo</span>
                    <span>+{formatCurrency(lastSurcharge)}</span>
                  </div>
                )}
                <div className="flex justify-between items-center pt-3 border-t border-slate-200">
                  <span className="text-xs font-black text-slate-800 uppercase tracking-widest">Valor Total</span>
                  <span className="text-2xl font-black text-blue-600">{formatCurrency(lastSaleAmount)}</span>
                </div>
              </div>

              <div className="space-y-3">
                <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest">Pagamento Efetuado</p>
                <div className="grid grid-cols-1 gap-2">
                  {lastPaymentEntries.map((entry, idx) => (
                    <div key={idx} className="flex justify-between items-center bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-blue-50 text-blue-500 rounded-lg flex items-center justify-center">
                          <CreditCard size={14} />
                        </div>
                        <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">{entry.method}</span>
                      </div>
                      <span className="text-xs font-black text-slate-900">{formatCurrency(entry.amount)}</span>
                    </div>
                  ))}
                  {lastChange > 0 && (
                    <div className="flex justify-between items-center bg-amber-50 p-4 rounded-2xl border border-amber-100 shadow-sm">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-amber-100 text-amber-600 rounded-lg flex items-center justify-center">
                          <History size={14} />
                        </div>
                        <span className="text-[10px] font-black text-amber-600 uppercase tracking-widest">Troco</span>
                      </div>
                      <span className="text-xs font-black text-amber-700">{formatCurrency(lastChange)}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* BOTÃO EXPANSÍVEL DE OPÇÕES */}
            <div className="absolute bottom-8 right-8 flex flex-col items-end gap-3">
              {showReceiptOptions && (
                <div className="flex flex-col gap-3 animate-in slide-in-from-bottom-4 duration-300">
                  <button 
                    onClick={handleDownloadReceipt}
                    className="w-12 h-12 bg-blue-600 text-white rounded-full flex items-center justify-center shadow-lg active:scale-90 transition-all"
                    title="Baixar PDF"
                  >
                    <Download size={20} />
                  </button>
                  <button 
                    onClick={handleShareWhatsApp}
                    disabled={isGeneratingReceipt}
                    className="w-12 h-12 bg-emerald-600 text-white rounded-full flex items-center justify-center shadow-lg active:scale-90 transition-all disabled:opacity-50"
                    title="WhatsApp"
                  >
                    {isGeneratingReceipt ? <Loader2 size={20} className="animate-spin" /> : <Share2 size={20} />}
                  </button>
                  <button 
                    onClick={() => window.print()}
                    className="w-12 h-12 bg-slate-900 text-white rounded-full flex items-center justify-center shadow-lg active:scale-90 transition-all"
                    title="Imprimir"
                  >
                    <Printer size={20} />
                  </button>
                </div>
              )}
              <button 
                onClick={() => setShowReceiptOptions(!showReceiptOptions)}
                className={`w-14 h-14 ${showReceiptOptions ? 'bg-red-500 rotate-45' : 'bg-blue-600'} text-white rounded-full flex items-center justify-center shadow-2xl transition-all duration-300 active:scale-95`}
              >
                <Plus size={28} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONTEÚDO DO RECIBO (OCULTO NA TELA, MAS USADO PARA IMPRESSÃO/PDF) */}
      <div style={{ position: 'absolute', left: '-9999px', top: '0' }}>
        <div id="receipt-pdf-container" style={{ width: '210mm', minHeight: '297mm', display: 'flex', flexDirection: 'column', alignItems: 'center', backgroundColor: 'white', padding: '20mm 0' }}>
          <div 
            id="receipt-content" 
            style={{ 
              width: settings.printerSize === 80 ? '80mm' : '58mm', 
              padding: settings.printerSize === 80 ? '8mm' : '4mm', 
              backgroundColor: 'white', 
              color: 'black', 
              fontFamily: 'monospace',
              fontSize: settings.printerSize === 80 ? '11px' : '10px',
              lineHeight: '1.4',
              border: '1px solid #eee'
            }}
          >
            <div style={{ textAlign: 'center', marginBottom: '6mm' }}>
              <p style={{ fontWeight: 'bold', fontSize: '16px', textTransform: 'uppercase', margin: '0 0 2mm 0' }}>{settings.storeName}</p>
              <p style={{ margin: '2px 0', fontSize: '10px' }}>{settings.storeAddress}</p>
              <p style={{ margin: '2px 0', fontSize: '10px' }}>{settings.storePhone}</p>
              <div style={{ margin: '4mm 0', borderTop: '1px solid black', borderBottom: '1px solid black', padding: '1mm 0' }}>
                <p style={{ fontWeight: 'bold', margin: '0', fontSize: '12px' }}>CUPOM DE VENDA</p>
                <p style={{ margin: '0', fontSize: '9px' }}>NÃO É DOCUMENTO FISCAL</p>
              </div>
            </div>
            
            <div style={{ marginBottom: '4mm', fontSize: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>PEDIDO:</span>
                <span style={{ fontWeight: 'bold' }}>#{lastTransactionId}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>DATA:</span>
                <span>{formatDateTime(lastSaleDate)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>VENDEDOR:</span>
                <span>{currentUser?.name?.toUpperCase() || 'SISTEMA'}</span>
              </div>
            </div>

            <div style={{ borderTop: '1px dashed black', borderBottom: '1px dashed black', padding: '3mm 0', marginBottom: '4mm' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', marginBottom: '2mm', fontSize: '10px' }}>
                <span>DESCRIÇÃO</span>
                <span>TOTAL</span>
              </div>
              {lastTransactionItems.map((item, index) => (
                <div key={index} style={{ marginBottom: '2mm' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ textTransform: 'uppercase' }}>{item.product.name}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#666' }}>
                    <span>{item.quantity} UN x {formatCurrency(item.product.salePrice)}</span>
                    <span style={{ color: '#000' }}>{formatCurrency(item.product.salePrice * item.quantity)}</span>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ marginBottom: '4mm' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1mm' }}>
                <span>SUBTOTAL:</span>
                <span>{formatCurrency(lastTransactionItems.reduce((acc, item) => acc + (item.product.salePrice * item.quantity), 0))}</span>
              </div>
              {lastDiscount > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1mm', color: '#d32f2f' }}>
                  <span>DESCONTO:</span>
                  <span>-{formatCurrency(lastDiscount)}</span>
                </div>
              )}
              {lastSurcharge > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1mm', color: '#388e3c' }}>
                  <span>ACRÉSCIMO:</span>
                  <span>+{formatCurrency(lastSurcharge)}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '14px', marginTop: '2mm', borderTop: '1px solid black', paddingTop: '2mm' }}>
                <span>TOTAL:</span>
                <span>{formatCurrency(lastSaleAmount)}</span>
              </div>
            </div>

            <div style={{ borderTop: '1px dashed black', paddingTop: '3mm', marginBottom: '6mm' }}>
              <p style={{ fontWeight: 'bold', marginBottom: '2mm', fontSize: '10px' }}>FORMA DE PAGAMENTO:</p>
              {lastPaymentEntries.map((entry, idx) => (
                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1mm' }}>
                  <span>
                    {entry.method.toUpperCase()}
                    {entry.method === 'Cartão' && entry.installments && entry.installments > 1 
                      ? ` (${entry.installments}x de ${formatCurrency(entry.amount / entry.installments)})` 
                      : ''}
                  </span>
                  <span>{formatCurrency(entry.amount)}</span>
                </div>
              ))}
              {lastChange > 0 && (
                <div style={{ marginTop: '2mm', borderTop: '1px dotted #ccc', paddingTop: '2mm' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px' }}>
                    <span>VALOR RECEBIDO:</span>
                    <span>{formatCurrency(lastPaymentEntries.reduce((acc, curr) => acc + curr.amount, 0))}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '12px' }}>
                    <span>TROCO:</span>
                    <span>{formatCurrency(lastChange)}</span>
                  </div>
                </div>
              )}
            </div>

            <div style={{ textAlign: 'center', fontSize: '10px', marginTop: '4mm' }}>
              <p style={{ margin: '0', fontWeight: 'bold' }}>OBRIGADO PELA PREFERÊNCIA!</p>
              <p style={{ margin: '2px 0' }}>VOLTE SEMPRE!</p>
            </div>
          </div>
        </div>
      </div>

      {/* PORTAL PARA IMPRESSÃO DIRETA */}
      {document.getElementById('print-section') && createPortal(
        <div 
          style={{ 
            width: settings.printerSize === 80 ? '80mm' : '58mm', 
            padding: settings.printerSize === 80 ? '4mm' : '2mm', 
            backgroundColor: 'white', 
            color: 'black', 
            fontFamily: 'monospace',
            fontSize: settings.printerSize === 80 ? '11px' : '10px',
            lineHeight: '1.2'
          }}
        >
          <div style={{ textAlign: 'center', marginBottom: '4mm' }}>
            <p style={{ fontWeight: 'bold', fontSize: '12px', textTransform: 'uppercase', margin: '0' }}>{settings.storeName}</p>
            <p style={{ margin: '1px 0' }}>{settings.storeAddress}</p>
            <p style={{ margin: '1px 0' }}>{settings.storePhone}</p>
            <p style={{ fontWeight: 'bold', margin: '2mm 0 0 0', borderTop: '1px solid black', borderBottom: '1px solid black' }}>CUPOM DE VENDA</p>
          </div>
          
          <div style={{ marginBottom: '3mm' }}>
            <p style={{ margin: '1px 0' }}>ID: #{lastTransactionId}</p>
            <p style={{ margin: '1px 0' }}>DATA: {formatDateTime(lastSaleDate)}</p>
            <p style={{ margin: '1px 0' }}>VEND: {currentUser?.name?.toUpperCase() || 'SISTEMA'}</p>
          </div>

          <div style={{ borderTop: '1px dashed black', borderBottom: '1px dashed black', padding: '2mm 0', marginBottom: '3mm' }}>
            {lastTransactionItems.map((item, index) => (
              <div key={index} style={{ marginBottom: '1mm' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>{item.product.name.substring(0, 20)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px' }}>
                  <span>{item.quantity}x {formatCurrency(item.product.salePrice)}</span>
                  <span>{formatCurrency(item.product.salePrice * item.quantity)}</span>
                </div>
              </div>
            ))}
          </div>

          <div style={{ marginBottom: '3mm' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>SUBTOTAL:</span>
              <span>{formatCurrency(lastTransactionItems.reduce((acc, item) => acc + (item.product.salePrice * item.quantity), 0))}</span>
            </div>
            {lastDiscount > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>DESCONTO:</span>
                <span>-{formatCurrency(lastDiscount)}</span>
              </div>
            )}
            {lastSurcharge > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>ACRÉSCIMO:</span>
                <span>+{formatCurrency(lastSurcharge)}</span>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', marginTop: '1mm' }}>
              <span>TOTAL:</span>
              <span>{formatCurrency(lastSaleAmount)}</span>
            </div>
          </div>

          <div style={{ borderTop: '1px dashed black', paddingTop: '2mm', marginBottom: '4mm' }}>
            {lastPaymentEntries.map((entry, idx) => (
              <div key={idx} style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>
                  {entry.method.toUpperCase()}
                  {entry.method === 'Cartão' && entry.installments && entry.installments > 1 ? ` (${entry.installments}X)` : ''}
                </span>
                <span>{formatCurrency(entry.amount)}</span>
              </div>
            ))}
            {lastChange > 0 && (
              <div style={{ marginTop: '1mm', borderTop: '1px dotted #ccc', paddingTop: '1mm' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>RECEBIDO:</span>
                  <span>{formatCurrency(lastPaymentEntries.reduce((acc, curr) => acc + curr.amount, 0))}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold' }}>
                  <span>TROCO:</span>
                  <span>{formatCurrency(lastChange)}</span>
                </div>
              </div>
            )}
          </div>

          <div style={{ textAlign: 'center', fontSize: '9px' }}>
            <p>OBRIGADO PELA PREFERÊNCIA!</p>
          </div>
        </div>,
        document.getElementById('print-section')!
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
