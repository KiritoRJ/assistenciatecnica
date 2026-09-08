
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ShoppingBag, Search, X, History, ShoppingCart, Package, ArrowLeft, CheckCircle2, Eye, Loader2, Plus, Minus, Trash2, ChevronUp, ChevronDown, Receipt, Share2, Download, ScanBarcode, Lock, KeyRound, Printer, LayoutGrid, Grid, List, Rows, CreditCard, Camera, Image as ImageIcon, AlertTriangle, Sparkles, TrendingUp, ShieldAlert } from 'lucide-react';
import html2pdf from 'html2pdf.js';
import html2canvas from 'html2canvas';
import { Product, Sale, AppSettings, User } from '../types';
import { formatCurrency, parseCurrencyString, formatDate, formatDateTime, playBeepSound, generateRandomNumericCode } from '../utils';
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
  const [historySearch, setHistorySearch] = useState('');

  const [lastSaleAmount, setLastSaleAmount] = useState(0);
  const [lastTransactionItems, setLastTransactionItems] = useState<CartItem[]>([]);
  const [lastPaymentMethod, setLastPaymentMethod] = useState('');
  const [lastTransactionId, setLastTransactionId] = useState('');
  const [lastSaleDate, setLastSaleDate] = useState('');
  const [lastSurcharge, setLastSurcharge] = useState(0);
  const [lastDiscount, setLastDiscount] = useState(0);
  const [lastChange, setLastChange] = useState(0);
  const [lastPaymentEntries, setLastPaymentEntries] = useState<PaymentEntry[]>([]);
  const [lastAddedProduct, setLastAddedProduct] = useState<Product | null>(null);
  const [layoutMode, setLayoutMode] = useState<'small' | 'medium' | 'list'>(settings.salesLayout || 'small');

  const [isCancelling, setIsCancelling] = useState<string | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authAction, setAuthAction] = useState<'cancel_sale' | 'remove_banner' | null>(null);
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
  const [isCompressingBanner, setIsCompressingBanner] = useState(false);
  const bannerInputRef = useRef<HTMLInputElement>(null);

  // Recupera carrinho do PDV caso o app seja minimizado ou recarregado no celular
  useEffect(() => {
    try {
      const savedDraft = localStorage.getItem('lojascloud_pdv_draft');
      if (savedDraft) {
        const parsed = JSON.parse(savedDraft);
        if (parsed && Array.isArray(parsed.cart) && parsed.cart.length > 0) {
          setCart(parsed.cart);
          if (typeof parsed.totalDiscount === 'number') setTotalDiscount(parsed.totalDiscount);
          if (typeof parsed.totalSurcharge === 'number') setTotalSurcharge(parsed.totalSurcharge);
          if (Array.isArray(parsed.paymentEntries) && parsed.paymentEntries.length > 0) {
            setPaymentEntries(parsed.paymentEntries);
          }
          if (parsed.showCheckoutModal) {
            setShowCheckoutModal(true);
          }
          if (parsed.showCartDrawer) {
            setShowCartDrawer(true);
          }
        }
      }
    } catch (e) {
      console.warn('Erro ao restaurar carrinho PDV:', e);
    }
  }, []);

  // Salva automaticamente o carrinho e estado de finalização no storage
  useEffect(() => {
    try {
      if (cart.length > 0) {
        localStorage.setItem('lojascloud_pdv_draft', JSON.stringify({
          cart,
          totalDiscount,
          totalSurcharge,
          paymentEntries,
          showCheckoutModal,
          showCartDrawer,
          savedAt: Date.now()
        }));
      } else {
        localStorage.removeItem('lojascloud_pdv_draft');
      }
    } catch (e) {}
  }, [cart, totalDiscount, totalSurcharge, paymentEntries, showCheckoutModal, showCartDrawer]);

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

  const handleBannerUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsCompressingBanner(true);
      const reader = new FileReader();
      reader.onload = async (event) => {
        const base64 = event.target?.result as string;
        const compressed = await compressImage(base64, 1200);
        await onUpdateSettings({ ...settings, salesBannerUrl: compressed });
        setIsCompressingBanner(false);
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error('Erro ao processar banner:', error);
      setIsCompressingBanner(false);
    }
  };

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
    setAuthAction('cancel_sale');
    setIsAuthModalOpen(true);
    setPasswordInput('');
    setAuthError(false);
  };

  const initiateRemoveBanner = () => {
    setAuthAction('remove_banner');
    setIsAuthModalOpen(true);
    setPasswordInput('');
    setAuthError(false);
  };

  const confirmAuth = async () => {
    if (!passwordInput || !tenantId) return;
    
    // Se for cancelamento de venda, precisa ter a venda selecionada
    if (authAction === 'cancel_sale' && !selectedSaleToCancel) return;

    setVerifyingPassword(true);
    setAuthError(false);

    try {
      const { OnlineDB } = await import('../utils/api');
      const authResult = await OnlineDB.verifyAdminPassword(tenantId, passwordInput);
      if (authResult.success) {
        if (authAction === 'cancel_sale' && selectedSaleToCancel) {
          setIsCancelling(selectedSaleToCancel.id);
          setIsAuthModalOpen(false);
          try {
            await onDeleteSale(selectedSaleToCancel);
          } catch (e: any) {
            alert(`ERRO AO CANCELAR: ${e.message}`);
          } finally {
            setIsCancelling(null);
            setSelectedSaleToCancel(null);
            setAuthAction(null);
            setPasswordInput('');
          }
        } else if (authAction === 'remove_banner') {
          await onUpdateSettings({ ...settings, salesBannerUrl: null });
          setIsAuthModalOpen(false);
          setAuthAction(null);
          setPasswordInput('');
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

  const cartTotal = useMemo(() => {
    return cart.reduce((acc, item) => acc + (item.product.salePrice * item.quantity), 0);
  }, [cart]);

  const cartCost = useMemo(() => {
    return cart.reduce((acc, item) => acc + ((item.product.costPrice || 0) * item.quantity), 0);
  }, [cart]);

  const finalTotal = useMemo(() => {
    const discounted = Math.max(0, cartTotal - totalDiscount);
    const surchargeAmount = discounted * (totalSurcharge / 100);
    return discounted + surchargeAmount;
  }, [cartTotal, totalDiscount, totalSurcharge]);

  const cartProfit = useMemo(() => {
    return finalTotal - cartCost;
  }, [finalTotal, cartCost]);

  const profitMarginPercent = useMemo(() => {
    if (finalTotal <= 0) return 0;
    return (cartProfit / finalTotal) * 100;
  }, [cartProfit, finalTotal]);

  const isCartInLoss = useMemo(() => {
    return cart.length > 0 && cartCost > 0 && finalTotal < cartCost;
  }, [cart.length, cartCost, finalTotal]);

  // Sugestões inteligentes de Venda Casada (Cross-Selling)
  const crossSellSuggestions = useMemo(() => {
    if (!products || products.length === 0) return [];
    const cartProductIds = new Set(cart.map(item => item.product.id));
    const available = products.filter(p => p.quantity > 0 && !cartProductIds.has(p.id));
    
    // Palavras-chave de acessórios e itens complementares de alta conversão
    const highMarginKeywords = ['pelicula', 'película', 'capa', 'capinha', 'carregador', 'cabo', 'fone', 'suporte', 'adaptador', 'bateria'];
    
    const matched = available.filter(p => {
      const text = `${p.name} ${p.category || ''} ${p.description || ''}`.toLowerCase();
      return highMarginKeywords.some(k => text.includes(k));
    });

    return (matched.length > 0 ? matched : available).slice(0, 6);
  }, [products, cart]);

  const calculateFinalTotal = (discount: number, surcharge: number) => {
    const discounted = Math.max(0, cartTotal - discount);
    const surchargeAmount = discounted * (surcharge / 100);
    return discounted + surchargeAmount;
  };

  const addToCart = (product: Product) => {
    setLastAddedProduct(product);
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

    // Trava de Margem de Lucro / Alerta de Prejuízo no PDV
    if (cartCost > 0 && finalTotal < cartCost) {
      const lossAmount = cartCost - finalTotal;
      const confirmed = window.confirm(
        `⚠️ ALERTA DE PREJUÍZO NO PDV!\n\nO valor final da venda (${formatCurrency(finalTotal)}) é MENOR que o custo dos produtos em estoque (${formatCurrency(cartCost)}).\n\n📉 Prejuízo estimado: -${formatCurrency(lossAmount)}\n\nDeseja realmente autorizar e finalizar esta venda com prejuízo?`
      );
      if (!confirmed) return;
    }

    const uniqueTransactions = new Set(sales.map(s => s.transactionId).filter(Boolean));
    const nextTransactionNumber = uniqueTransactions.size + 1;
    const transactionId = generateRandomNumericCode();
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
      
      const formattedId = generateRandomNumericCode();

      const newSale: Sale = {
        id: formattedId,
        productId: item.product.id,
        productName: item.product.name,
        category: item.product.category,
        date,
        quantity: item.quantity,
        originalPrice: item.product.salePrice,
        discount: itemDiscount,
        surcharge: itemSurcharge,
        finalPrice: itemTotal - itemDiscount + itemSurcharge,
        costAtSale: item.product.costPrice * item.quantity,
        costPerUnitAtSale: item.product.costPrice,
        salePricePerUnitAtSale: item.product.salePrice,
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
    
    // Impressão Direta conforme solicitado
    setTimeout(() => {
      try {
        window.print();
      } catch (e) {
        alert("Aviso: Impressora não reconhecida ou erro na comunicação.");
      }
    }, 500);
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
    } else if (sale.paymentMethod) {
      const methods = sale.paymentMethod.split(',').map(m => m.trim());
      if (methods.length === 1) {
        const m = methods[0];
        if (m.startsWith('Cartão')) {
          const match = m.match(/Cartão \((\d+)x\)/);
          const installments = match ? parseInt(match[1], 10) : 1;
          setLastPaymentEntries([{ method: 'Cartão', amount: total, installments }]);
        } else {
          setLastPaymentEntries([{ method: m as any, amount: total }]);
        }
      } else {
        const splitAmount = total / methods.length;
        const entries = methods.map(m => {
          if (m.startsWith('Cartão')) {
            const match = m.match(/Cartão \((\d+)x\)/);
            const installments = match ? parseInt(match[1], 10) : 1;
            return { method: 'Cartão' as const, amount: splitAmount, installments };
          }
          return { method: m as any, amount: splitAmount };
        });
        setLastPaymentEntries(entries);
      }
    } else {
      setLastPaymentEntries([{ method: 'Dinheiro', amount: total }]);
    }
    
    setLastChange(sale.change || 0);
    
    setTimeout(() => {
      window.print();
    }, 500);
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

  const sortedSales = useMemo(() => {
    let filtered = [...sales];
    if (historySearch) {
      const lowerSearch = historySearch.toLowerCase();
      filtered = filtered.filter(s => 
        (s.transactionId && s.transactionId.toLowerCase().includes(lowerSearch)) ||
        (s.productName && s.productName.toLowerCase().includes(lowerSearch))
      );
    }
    return filtered.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [sales, historySearch]);

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
          
          <div className="bg-white p-2 rounded-2xl border border-slate-100 flex items-center gap-2 shadow-sm focus-within:border-blue-500 focus-within:ring-4 focus-within:ring-blue-500/10 transition-all">
            <Search className="text-slate-400 ml-2" size={20} />
            <input 
              type="text" 
              placeholder="Buscar por número do pedido ou produto..." 
              value={historySearch}
              onChange={e => setHistorySearch(e.target.value)}
              className="w-full bg-transparent border-none outline-none p-2 text-sm font-medium text-slate-700 placeholder:text-slate-400"
            />
            {historySearch && (
              <button onClick={() => setHistorySearch('')} className="p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-colors">
                <X size={16} />
              </button>
            )}
          </div>

          <div className="grid gap-2">
            {sortedSales.map(sale => (
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
                    <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">Pedido {sale.transactionId} • {formatDate(sale.date)} • {sale.paymentMethod}</p>
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
        </div>
      ) : (
        <div className="h-full">
          {/* --- LAYOUT DESKTOP --- */}
          <div className="hidden lg:flex flex-col gap-3 h-full">
            {/* Top Banner Area (Desktop) */}
            <div className="flex items-center justify-between bg-white rounded-xl p-3 border-b border-slate-100 shadow-sm">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-emerald-100 text-emerald-600 rounded-lg flex items-center justify-center shadow-sm">
                  <ShoppingCart size={16} />
                </div>
                <h2 className="text-base font-black text-slate-800 uppercase tracking-tighter">VENDAS</h2>
              </div>
              
              <div className="flex-1 flex items-center justify-center">
                <div 
                  onClick={() => currentUser?.role === 'admin' && bannerInputRef.current?.click()}
                  className={`relative group ${currentUser?.role === 'admin' ? 'cursor-pointer' : ''} max-w-[400px] w-full h-12 bg-slate-50 rounded-lg border border-dashed border-slate-200 flex items-center justify-center overflow-hidden hover:border-blue-400 transition-all`}
                >
                  {isCompressingBanner ? (
                    <Loader2 className="animate-spin text-blue-500" size={20} />
                  ) : settings.salesBannerUrl ? (
                    <>
                      <img src={settings.salesBannerUrl} className="w-full h-full object-contain" referrerPolicy="no-referrer" />
                      {currentUser?.role === 'admin' && (
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-2 transition-all">
                          <Camera size={16} className="text-white" />
                          <button 
                            onClick={(e) => { 
                              e.preventDefault();
                              e.stopPropagation(); 
                              initiateRemoveBanner(); 
                            }}
                            className="p-1.5 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors shadow-lg pointer-events-auto"
                            title="Remover Banner"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="flex items-center gap-2 text-slate-300">
                      <ImageIcon size={16} />
                      <h1 className="text-[10px] font-black uppercase tracking-[0.2em]">
                        {currentUser?.role === 'admin' ? 'ANEXAR LOGO / BANNER' : 'LOGO BANNER'}
                      </h1>
                    </div>
                  )}
                  <input 
                    type="file" 
                    ref={bannerInputRef} 
                    onChange={handleBannerUpload} 
                    accept="image/*" 
                    className="hidden" 
                  />
                </div>
              </div>

              <button onClick={() => setShowHistory(true)} className="p-2.5 text-slate-400 bg-white border border-slate-100 rounded-lg active:scale-90 transition-all shadow-sm hover:text-slate-600">
                <History size={18} />
              </button>
            </div>

            <div className="grid grid-cols-12 gap-3 flex-1 min-h-0">
              {/* Coluna Esquerda: Lista de Produtos */}
              <div className="col-span-4 flex flex-col gap-2.5 min-h-0">
                {/* Layout Toggle for Desktop */}
                <div className="flex items-center justify-end">
                  <button onClick={toggleLayout} className="p-2 bg-white text-slate-400 hover:text-slate-600 transition-colors rounded-lg shadow-sm active:scale-95 border border-slate-100 flex items-center gap-2 text-[8px] font-black uppercase tracking-widest">
                     {layoutMode === 'small' ? <Grid size={14} /> : layoutMode === 'medium' ? <LayoutGrid size={14} /> : <Rows size={14} />}
                     Visualização
                  </button>
                </div>

                {/* --- GRID DE VENDAS --- */}
                <div className={`grid gap-2 overflow-y-auto custom-scrollbar pr-1 flex-1 ${
                  layoutMode === 'small' ? 'grid-cols-2 lg:grid-cols-2 xl:grid-cols-3' :
                  layoutMode === 'medium' ? 'lg:grid-cols-1 xl:grid-cols-2' :
                  'grid-cols-1'
                }`}>
                  {sortedProducts.slice(0, 6).map(product => {
                    const isTopSeller = topSellers.includes(product.id);
                    return (
                      <button 
                        key={product.id} 
                        onClick={() => addToCart(product)} 
                        className={`bg-white border overflow-hidden shadow-sm text-left active:scale-95 transition-all flex group ${
                          layoutMode === 'list' ? 'rounded-lg p-1.5 pr-2 border' : 'rounded-xl border-b'
                        } ${
                          isTopSeller ? 'border-emerald-400 bg-emerald-50/30' : 'border-slate-100'
                        } ${layoutMode === 'list' ? 'flex-row items-center gap-2' : 'flex-col'}`}
                      >
                        {/* Imagem */}
                        <div className={`bg-slate-50 relative overflow-hidden shrink-0 ${
                          layoutMode === 'list' ? 'w-10 h-10 rounded-md ml-0.5' : 
                          layoutMode === 'small' ? 'h-16' : 
                          'h-24'
                        }`}>
                          {product.photo ? (
                            <img src={product.photo} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" referrerPolicy="no-referrer" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-slate-200"><Package size={layoutMode === 'small' || layoutMode === 'list' ? 14 : 18} /></div>
                          )}
                          
                          {isTopSeller && (
                            <div className={`absolute top-1 left-1 bg-emerald-500 text-white font-black flex items-center justify-center shadow-lg uppercase tracking-tighter px-1 py-0.5 rounded-full text-[5px]`}>
                              MAIS VENDIDO
                            </div>
                          )}
                        </div>

                        {/* Conteúdo */}
                        <div className={`${layoutMode === 'list' ? 'flex-1 flex items-center justify-between pr-1 min-w-0' : 'p-2'}`}>
                          <div className="min-w-0 flex-1 mr-1">
                            <h3 className={`font-black text-slate-800 uppercase truncate mb-0.5 ${layoutMode === 'small' ? 'text-[7px]' : 'text-[9px]'}`}>{product.name}</h3>
                            <div className="flex items-center justify-between gap-1">
                              <p className="text-emerald-600 font-black text-[9px] sm:text-[10px] whitespace-nowrap">{formatCurrency(product.salePrice)}</p>
                              <span className={`text-[6px] font-black uppercase px-1.5 py-0.5 rounded-md shrink-0 ${
                                product.quantity <= 0 ? 'bg-red-500 text-white' : 
                                product.quantity <= 2 ? 'bg-amber-500 text-white' : 
                                'bg-slate-900 text-white'
                              }`}>
                                Estoque: {product.quantity}
                              </span>
                            </div>
                          </div>
                          
                          {layoutMode === 'list' && (
                            <div className="flex items-center justify-center w-6 h-6 bg-emerald-500 text-white rounded-full shrink-0 shadow-lg group-hover:scale-110 transition-transform">
                              <Plus size={12} />
                            </div>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Coluna Central: Banner/Display (Desktop) */}
              <div className="flex col-span-4 flex-col gap-3 min-h-0">
                <div className="flex-1 bg-white rounded-xl border border-slate-100 flex flex-col items-center justify-center p-6 text-center gap-6 relative overflow-hidden shadow-sm">
                  <div className="absolute inset-0 bg-gradient-to-b from-slate-50 to-transparent opacity-50"></div>
                  
                  {lastAddedProduct ? (
                    <div className="flex flex-col items-center gap-6 animate-in zoom-in-95 duration-300 relative z-10 w-full">
                      <div className="w-full aspect-square bg-slate-50 rounded-2xl shadow-inner flex items-center justify-center overflow-hidden border border-slate-100 max-w-[240px]">
                        {lastAddedProduct.photo ? (
                          <img src={lastAddedProduct.photo} className="w-full h-full object-contain p-4" referrerPolicy="no-referrer" />
                        ) : (
                          <Package size={100} className="text-slate-200" strokeWidth={0.5} />
                        )}
                      </div>
                      <div className="space-y-1">
                        <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tighter leading-tight">{lastAddedProduct.name}</h2>
                        <p className="text-xl font-black text-emerald-600">{formatCurrency(lastAddedProduct.salePrice)}</p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-4 opacity-20 relative z-10">
                      <Package size={100} strokeWidth={0.5} />
                      <h2 className="text-xl font-black uppercase tracking-widest">Aguardando Produto</h2>
                    </div>
                  )}

                  {/* Search Bar moved here for Desktop */}
                  <div className="w-full max-w-sm mt-4 space-y-3 relative z-10">
                     <div className="flex items-center gap-2">
                      <div className="relative flex-1">
                        <ScanBarcode className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <input 
                          type="text" 
                          placeholder="BIPAR CÓDIGO OU NOME..." 
                          className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-xl text-xs font-black shadow-sm outline-none focus:border-slate-900 focus:ring-4 focus:ring-slate-900/5 transition-all uppercase placeholder:text-slate-300" 
                          value={productSearch} 
                          onChange={(e) => setProductSearch(e.target.value)} 
                          autoFocus
                        />
                      </div>
                      <button onClick={() => startScanner('search')} className="p-4 bg-slate-900 text-white rounded-xl shadow-lg active:scale-95 shrink-0">
                        <Search size={18} />
                      </button>
                    </div>
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-[0.2em]">Passe o produto no leitor ou digite o nome</p>
                  </div>
                </div>
              </div>

              {/* Coluna Direita: Cupom de Venda (Desktop) */}
              <div className="flex col-span-4 flex-col bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden h-full sticky top-4">
                <div className="p-3 bg-slate-900 text-white flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 bg-white/10 rounded-lg flex items-center justify-center text-emerald-400">
                      <Receipt size={14} />
                    </div>
                    <div>
                      <h3 className="font-black uppercase text-[9px] tracking-widest">Cupom de Venda</h3>
                      <p className="text-[7px] text-slate-400 font-bold uppercase">Itens: {cart.length}</p>
                    </div>
                  </div>
                  {cart.length > 0 && (
                    <button onClick={() => setCart([])} className="p-1.5 text-slate-400 hover:text-red-400 transition-colors">
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>

                <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar">
                  {cart.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-slate-300 gap-2 opacity-50">
                      <ShoppingCart size={28} strokeWidth={1} />
                      <p className="text-[7px] font-black uppercase tracking-widest">Carrinho Vazio</p>
                    </div>
                  ) : (
                    cart.map(item => (
                      <div key={item.product.id} className="flex items-start justify-between gap-2 group">
                        <div className="flex gap-2 min-w-0">
                          <div className="w-7 h-7 bg-slate-50 rounded-md flex items-center justify-center text-slate-300 shrink-0 overflow-hidden border border-slate-100">
                            {item.product.photo ? <img src={item.product.photo} className="w-full h-full object-cover" /> : <Package size={12} />}
                          </div>
                          <div className="min-w-0">
                            <h4 className="text-[8px] font-black text-slate-800 uppercase truncate leading-tight">{item.product.name}</h4>
                            <p className="text-[7px] font-bold text-slate-400 uppercase mt-0.5">
                              {item.quantity} UN x {formatCurrency(item.product.salePrice)}
                            </p>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-0.5">
                          <p className="text-[9px] font-black text-slate-900">{formatCurrency(item.product.salePrice * item.quantity)}</p>
                          <div className="flex items-center gap-1">
                            <button onClick={() => updateCartQuantity(item.product.id, -1)} className="p-0.5 text-slate-400 hover:text-slate-900"><Minus size={8} /></button>
                            <button onClick={() => updateCartQuantity(item.product.id, 1)} className="p-0.5 text-slate-400 hover:text-slate-900"><Plus size={8} /></button>
                            <button onClick={() => removeFromCart(item.product.id)} className="p-1 text-red-400 hover:text-red-600 ml-0.5 bg-red-50 rounded-md transition-colors"><Trash2 size={10} /></button>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <div className="p-3 bg-slate-50 border-t border-slate-100 space-y-2">
                  {/* ALERTA DE PREJUÍZO / MARGEM DE LUCRO */}
                  {cart.length > 0 && (
                    isCartInLoss ? (
                      <div className="p-2 bg-red-500 text-white rounded-lg text-[8px] font-black uppercase tracking-wider flex items-center gap-1.5 shadow-sm animate-pulse">
                        <AlertTriangle size={12} className="shrink-0" />
                        <span>Atenção: Prejuízo de {formatCurrency(cartCost - finalTotal)}</span>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between px-2 py-1 bg-emerald-50 text-emerald-800 rounded-md text-[8px] font-bold border border-emerald-100">
                        <span className="flex items-center gap-1">
                          <TrendingUp size={10} className="text-emerald-600" /> Lucro Est.:
                        </span>
                        <span className="font-black text-emerald-700">
                          {formatCurrency(cartProfit)} ({profitMarginPercent.toFixed(0)}%)
                        </span>
                      </div>
                    )
                  )}

                  {/* SUGESTÃO DE VENDA CASADA (CROSS-SELLING) */}
                  {cart.length > 0 && crossSellSuggestions.length > 0 && (
                    <div className="bg-blue-50/70 border border-blue-100 rounded-lg p-2 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[8px] font-black text-blue-900 uppercase tracking-wider flex items-center gap-1">
                          <Sparkles size={10} className="text-blue-600" /> Venda Casada (+Ticket)
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 custom-scrollbar">
                        {crossSellSuggestions.map(p => (
                          <button
                            key={p.id}
                            onClick={() => addToCart(p)}
                            className="px-2 py-1 bg-white hover:bg-blue-600 hover:text-white border border-blue-200 rounded-md text-[8px] font-black uppercase text-blue-800 shrink-0 transition-all flex items-center gap-1 active:scale-95 shadow-2xs"
                            title={`Adicionar ${p.name}`}
                          >
                            <Plus size={8} />
                            <span className="max-w-[70px] truncate">{p.name}</span>
                            <span className="text-emerald-600 group-hover:text-white font-bold">+{formatCurrency(p.salePrice)}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="space-y-1">
                    <div className="flex justify-between text-lg font-bold text-slate-400 uppercase">
                      <span>Subtotal</span>
                      <span>{formatCurrency(cartTotal)}</span>
                    </div>
                    {totalDiscount > 0 && (
                      <div className="flex justify-between text-[8px] font-bold text-red-500 uppercase">
                        <span>Desconto</span>
                        <span>- {formatCurrency(totalDiscount)}</span>
                      </div>
                    )}
                    {totalSurcharge > 0 && (
                      <div className="flex justify-between text-[8px] font-bold text-blue-500 uppercase">
                        <span>Acréscimo ({totalSurcharge}%)</span>
                        <span>+ {formatCurrency(cartTotal * (totalSurcharge / 100))}</span>
                      </div>
                    )}
                    <div className="flex justify-between items-end pt-2 border-t border-slate-200">
                      <span className="text-xs font-black text-slate-900 uppercase tracking-widest">Total</span>
                      <span className="text-4xl font-black text-emerald-600 leading-none">{formatCurrency(finalTotal)}</span>
                    </div>
                  </div>

                  <button 
                    onClick={() => {
                      if(cart.length > 0) {
                        setPaymentEntries([{ method: 'Dinheiro', amount: finalTotal }]);
                        setShowCheckoutModal(true);
                      }
                    }}
                    disabled={cart.length === 0}
                    className="w-full py-3 bg-emerald-500 text-white rounded-lg font-black uppercase text-[9px] tracking-widest shadow-lg shadow-emerald-500/20 active:scale-95 transition-all disabled:opacity-20 flex items-center justify-center gap-2"
                  >
                    <CreditCard size={14} /> Finalizar Venda
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* --- LAYOUT MOBILE --- */}
          <div className="lg:hidden flex flex-col gap-1.5 h-full relative">
            <div className="flex items-center justify-between px-1">
              <h2 className="text-sm font-black text-slate-800 uppercase tracking-tighter flex items-center gap-1.5">
                <ShoppingCart size={16} className="text-emerald-600" /> VENDAS
              </h2>
              <button onClick={() => setShowHistory(true)} className="p-1.5 text-slate-400 bg-white border border-slate-100 rounded-lg active:scale-90 transition-all shadow-sm">
                <History size={14} />
              </button>
            </div>

            <div className="flex items-center gap-1">
              <div className="relative flex-1">
                <ScanBarcode className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-300" size={10} />
                <input 
                  type="text" 
                  placeholder="BIPAR CÓDIGO OU NOME..." 
                  className="w-full h-7 pl-7 pr-2 bg-white border border-slate-200 rounded-lg text-[8px] font-black shadow-sm outline-none focus:border-slate-900 transition-all uppercase placeholder:text-slate-300" 
                  value={productSearch} 
                  onChange={(e) => setProductSearch(e.target.value)} 
                />
              </div>
              <button onClick={() => startScanner('search')} className="w-7 h-7 bg-slate-900 text-white rounded-lg shadow-lg active:scale-95 shrink-0 flex items-center justify-center">
                <Search size={12} />
              </button>
              <button onClick={toggleLayout} className="w-7 h-7 bg-white text-slate-400 hover:text-slate-600 transition-colors rounded-lg shadow-sm active:scale-95 shrink-0 border border-slate-100 flex items-center justify-center">
                 {layoutMode === 'small' && <Grid size={12} />}
                 {layoutMode === 'medium' && <LayoutGrid size={12} />}
                 {layoutMode === 'list' && <Rows size={12} />}
              </button>
            </div>

            {/* --- GRID DE VENDAS MOBILE --- */}
            <div className={`grid gap-1 overflow-y-auto custom-scrollbar pr-1 flex-1 ${
              layoutMode === 'small' ? 'grid-cols-3 sm:grid-cols-4 md:grid-cols-5' :
              layoutMode === 'medium' ? 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4' :
              'grid-cols-1'
            }`}>
              {sortedProducts.slice(0, 6).map(product => {
                const isTopSeller = topSellers.includes(product.id);
                return (
                  <button 
                    key={product.id} 
                    onClick={() => addToCart(product)} 
                    className={`bg-white border overflow-hidden shadow-sm text-left active:scale-95 transition-all flex group ${
                      layoutMode === 'list' ? 'rounded-lg p-0.5 pr-1 border' : 'rounded-lg border'
                    } ${
                      isTopSeller ? 'border-emerald-400 bg-emerald-50/30' : 'border-slate-100'
                    } ${layoutMode === 'list' ? 'flex-row items-center gap-1.5' : 'flex-col'}`}
                  >
                    {/* Imagem */}
                    <div className={`bg-slate-50 relative overflow-hidden shrink-0 ${
                      layoutMode === 'list' ? 'w-8 h-8 rounded ml-0.5' : 
                      layoutMode === 'small' ? 'h-12' : 
                      'h-18'
                    }`}>
                      {product.photo ? (
                        <img src={product.photo} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" referrerPolicy="no-referrer" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-200"><Package size={layoutMode === 'small' || layoutMode === 'list' ? 10 : 14} /></div>
                      )}
                    </div>

                    {/* Conteúdo */}
                    <div className={`${layoutMode === 'list' ? 'flex-1 flex items-center justify-between pr-0.5 min-w-0' : 'p-1'}`}>
                      <div className="min-w-0 flex-1 mr-1">
                        <h3 className={`font-black text-slate-800 uppercase truncate mb-0.5 ${layoutMode === 'small' ? 'text-[5.5px]' : 'text-[7.5px]'}`}>{product.name}</h3>
                        <div className="flex items-center justify-between gap-1">
                          <p className={`text-emerald-600 font-black whitespace-nowrap ${layoutMode === 'small' ? 'text-[7px]' : 'text-[8px]'}`}>{formatCurrency(product.salePrice)}</p>
                          <span className={`text-[4.5px] font-black uppercase px-0.5 py-0.5 rounded shrink-0 ${
                            product.quantity <= 0 ? 'bg-red-500 text-white' : 
                            product.quantity <= 2 ? 'bg-amber-500 text-white' : 
                            'bg-slate-900 text-white'
                          }`}>
                            Estoque: {product.quantity}
                          </span>
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* PERSISTENT BOTTOM CART BAR (Mobile) */}
            <div className="fixed bottom-[72px] left-0 right-0 px-4 py-1.5 z-40 lg:hidden pointer-events-none">
              <button 
                onClick={() => setShowCartDrawer(true)}
                className={`w-full h-9 rounded-lg shadow-lg flex items-center justify-between px-3.5 transition-all active:scale-[0.98] pointer-events-auto ${
                  cart.length > 0 
                    ? 'bg-emerald-500 text-white' 
                    : 'bg-white text-slate-400 border border-slate-100'
                }`}
              >
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <ShoppingCart size={14} />
                    {cart.length > 0 && (
                      <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[6px] font-black w-3 h-3 rounded-full flex items-center justify-center border border-white">
                        {cart.length}
                      </span>
                    )}
                  </div>
                  <div className="text-left">
                    <p className="text-[6px] font-black uppercase tracking-widest opacity-80 leading-none mb-0.5">Carrinho</p>
                    <p className="text-[9px] font-black leading-none">{cart.length} {cart.length === 1 ? 'item' : 'itens'}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-[6px] font-black uppercase tracking-widest opacity-80 leading-none mb-0.5">Total</p>
                  <p className="text-xs font-black leading-none">{formatCurrency(finalTotal)}</p>
                </div>
              </button>
            </div>

            {/* MOBILE CART DRAWER */}
            {showCartDrawer && (
              <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 animate-in fade-in duration-300">
                <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-[20px] max-h-[75vh] flex flex-col animate-in slide-in-from-bottom duration-300 shadow-2xl">
                  <div className="px-4 py-3 flex items-center justify-between border-b border-slate-100">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 bg-slate-900 text-white rounded-lg flex items-center justify-center">
                        <ShoppingCart size={16} />
                      </div>
                      <div>
                        <h3 className="font-black uppercase text-[10px] tracking-tighter">Carrinho</h3>
                        <p className="text-[8px] text-slate-400 font-bold uppercase">{cart.length} Itens Selecionados</p>
                      </div>
                    </div>
                    <button onClick={() => setShowCartDrawer(false)} className="p-2 bg-slate-100 text-slate-400 rounded-lg active:scale-90 transition-transform">
                      <X size={16} />
                    </button>
                  </div>

                  <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2.5 custom-scrollbar">
                    {cart.map(item => (
                      <div key={item.product.id} className="flex items-center justify-between gap-2.5 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-8 h-8 bg-white rounded flex items-center justify-center text-slate-300 shrink-0 overflow-hidden border border-slate-100 shadow-sm">
                            {item.product.photo ? <img src={item.product.photo} className="w-full h-full object-cover" /> : <Package size={14} />}
                          </div>
                          <div className="min-w-0">
                            <h4 className="text-[9px] font-black text-slate-800 uppercase truncate leading-tight">{item.product.name}</h4>
                            <p className="text-[8px] font-bold text-slate-400 uppercase mt-0.5">
                              {formatCurrency(item.product.salePrice)}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="flex items-center gap-1.5 bg-white p-0.5 rounded border border-slate-200 shadow-sm">
                            <button onClick={() => updateCartQuantity(item.product.id, -1)} className="w-6 h-6 flex items-center justify-center text-slate-400 hover:text-slate-900 active:scale-75 transition-transform"><Minus size={10} /></button>
                            <span className="text-[9px] font-black text-slate-900 w-2.5 text-center">{item.quantity}</span>
                            <button onClick={() => updateCartQuantity(item.product.id, 1)} className="w-6 h-6 flex items-center justify-center text-slate-400 hover:text-slate-900 active:scale-75 transition-transform"><Plus size={10} /></button>
                          </div>
                          <button onClick={() => removeFromCart(item.product.id)} className="p-1.5 text-red-500 bg-red-50 rounded-lg active:scale-90 transition-transform">
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="px-4 py-3 bg-slate-50 border-t border-slate-100 space-y-2.5">
                    {/* ALERTA DE PREJUÍZO / MARGEM MOBILE */}
                    {cart.length > 0 && (
                      isCartInLoss ? (
                        <div className="p-2 bg-red-500 text-white rounded-lg text-[8px] font-black uppercase tracking-wider flex items-center gap-1.5 shadow-sm animate-pulse">
                          <AlertTriangle size={12} className="shrink-0" />
                          <span>Prejuízo Detectado: -{formatCurrency(cartCost - finalTotal)}</span>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between px-2 py-1 bg-emerald-50 text-emerald-800 rounded-md text-[8px] font-bold border border-emerald-100">
                          <span className="flex items-center gap-1">
                            <TrendingUp size={10} className="text-emerald-600" /> Lucro Est.:
                          </span>
                          <span className="font-black text-emerald-700">
                            {formatCurrency(cartProfit)} ({profitMarginPercent.toFixed(0)}%)
                          </span>
                        </div>
                      )
                    )}

                    {/* VENDA CASADA MOBILE */}
                    {cart.length > 0 && crossSellSuggestions.length > 0 && (
                      <div className="bg-blue-50/70 border border-blue-100 rounded-lg p-2 space-y-1">
                        <span className="text-[7px] font-black text-blue-900 uppercase tracking-wider flex items-center gap-1">
                          <Sparkles size={9} className="text-blue-600" /> Sugestão de Venda Casada
                        </span>
                        <div className="flex items-center gap-1 overflow-x-auto pb-0.5 custom-scrollbar">
                          {crossSellSuggestions.map(p => (
                            <button
                              key={p.id}
                              onClick={() => addToCart(p)}
                              className="px-2 py-1 bg-white hover:bg-blue-600 hover:text-white border border-blue-200 rounded-md text-[7px] font-black uppercase text-blue-800 shrink-0 transition-all flex items-center gap-1 active:scale-95 shadow-2xs"
                            >
                              <Plus size={8} />
                              <span className="max-w-[65px] truncate">{p.name}</span>
                              <span className="text-emerald-600 font-bold">+{formatCurrency(p.salePrice)}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="space-y-1">
                      <div className="flex justify-between text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                        <span>Subtotal</span>
                        <span>{formatCurrency(cartTotal)}</span>
                      </div>
                      <div className="flex justify-between items-end pt-1 border-t border-slate-200">
                        <span className="text-[9px] font-black text-slate-900 uppercase tracking-widest">Total</span>
                        <span className="text-3xl font-black text-emerald-600 leading-none">{formatCurrency(finalTotal)}</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <button 
                        onClick={() => setCart([])}
                        className="py-2.5 bg-white border border-slate-200 text-slate-400 rounded-lg font-black uppercase text-[8px] tracking-widest active:scale-95 transition-all"
                      >
                        Limpar
                      </button>
                      <button 
                        onClick={() => {
                          setShowCartDrawer(false);
                          setPaymentEntries([{ method: 'Dinheiro', amount: finalTotal }]);
                          setShowCheckoutModal(true);
                        }}
                        className="py-2.5 bg-emerald-500 text-white rounded-lg font-black uppercase text-[8px] tracking-widest shadow-lg shadow-emerald-500/20 active:scale-95 transition-all"
                      >
                        Pagar Agora
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL DE CHECKOUT */}
      {showCheckoutModal && (
        <div className="fixed inset-0 bg-slate-950/80 flex items-center justify-center z-[100] p-4 backdrop-blur-md">
          <div className="bg-white w-full max-w-sm rounded-2xl p-6 space-y-4 overflow-y-auto max-h-[90vh] shadow-2xl border border-slate-100">
            <h3 className="text-lg font-black text-slate-800 uppercase tracking-tighter text-center">Checkout</h3>
            
            <div className="space-y-2.5">
              {/* DESCONTO E ACRÉSCIMO (Compact) */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[7px] font-black text-slate-400 uppercase tracking-widest ml-3">Desconto (R$)</label>
                  <div className="relative">
                    <Minus className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={12} />
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
                      className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-100 rounded-lg text-[10px] font-black outline-none focus:border-emerald-500 transition-colors"
                      placeholder="0,00"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[7px] font-black text-slate-400 uppercase tracking-widest ml-3">Acréscimo (%)</label>
                  <div className="relative">
                    <Plus className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={12} />
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
                      className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-100 rounded-lg text-[10px] font-black outline-none focus:border-blue-500 transition-colors"
                      placeholder="0%"
                    />
                  </div>
                </div>
              </div>

              {/* FORMAS DE PAGAMENTO (Max 2) */}
              <div className="space-y-2">
                <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest ml-3">Pagamento</p>
                {paymentEntries.map((entry, index) => (
                  <div key={index} className="space-y-1">
                    <div className="flex items-center gap-1 bg-slate-50 p-1 rounded-lg border border-slate-100">
                      <select
                        value={entry.method}
                        onChange={(e) => updatePaymentEntry(index, 'method', e.target.value as 'Dinheiro' | 'Cartão' | 'PIX')}
                        className="bg-transparent outline-none font-bold text-[7px] uppercase w-14"
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
                        className="flex-1 bg-white px-1 py-0.5 rounded-md outline-none font-black text-[10px] text-right border border-slate-200 focus:border-emerald-500 transition-all"
                      />
                      {paymentEntries.length > 1 && (
                        <button onClick={() => removePaymentEntry(index)} className="p-1 text-red-500 hover:bg-red-50 rounded-md">
                          <X size={12} />
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
                              <option key={`opt-${index}-${i+1}`} value={i+1}>{i+1}x</option>
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

              {/* TOTAL A PAGAR COM TRAVA / MARGEM DE LUCRO */}
              <div className="bg-emerald-50 p-3.5 rounded-xl text-center mt-2 border border-emerald-100 space-y-1">
                <p className="text-[8px] font-black text-emerald-600 uppercase tracking-widest leading-none">Total a Pagar</p>
                <p className="text-2xl font-black text-emerald-800 leading-tight">{formatCurrency(finalTotal)}</p>
                
                {/* STATUS DE MARGEM / PREJUÍZO */}
                {cartCost > 0 && (
                  <div className="pt-1.5 border-t border-emerald-200/60 mt-1">
                    {isCartInLoss ? (
                      <div className="bg-red-500 text-white py-1 px-2 rounded-lg text-[9px] font-black flex items-center justify-center gap-1 animate-pulse">
                        <AlertTriangle size={12} />
                        <span>PREJUÍZO: -{formatCurrency(cartCost - finalTotal)} (Custo: {formatCurrency(cartCost)})</span>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between text-[9px] font-bold text-emerald-900 px-1">
                        <span className="text-emerald-700">Lucro Líquido:</span>
                        <span className="font-black text-emerald-800">
                          {formatCurrency(cartProfit)} ({profitMarginPercent.toFixed(0)}% de margem)
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-1.5 pt-1">
              <button 
                onClick={handleFinalizeSale} 
                disabled={paymentEntries.reduce((acc, curr) => acc + curr.amount, 0) < finalTotal - 0.001} 
                className="w-full py-3 bg-emerald-600 text-white rounded-lg font-black uppercase text-[9px] shadow-lg disabled:opacity-50 active:scale-95 transition-all flex items-center justify-center gap-2"
              >
                <CheckCircle2 size={16} /> FINALIZAR VENDA
              </button>
              <button onClick={() => setShowCheckoutModal(false)} className="w-full py-1.5 text-slate-400 font-black uppercase text-[7px] tracking-widest">Cancelar</button>
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
                <span style={{ fontWeight: 'bold' }}>{lastTransactionId}</span>
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
                    <span style={{ textTransform: 'uppercase' }}>{String(index + 1).padStart(3, '0')} - {item.product.name}</span>
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
                    {entry.method === 'Cartão' && entry.installments && entry.installments > 1 
                      ? `CARTÃO DE CRÉDITO (${entry.installments}x de ${formatCurrency(entry.amount / entry.installments)})` 
                      : entry.method.toUpperCase()}
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
            width: Number(settings.printerSize) === 80 ? '80mm' : '58mm', 
            padding: Number(settings.printerSize) === 80 ? '4mm' : '2mm', 
            backgroundColor: 'white', 
            color: 'black', 
            fontFamily: 'monospace',
            fontSize: Number(settings.printerSize) === 80 ? '11px' : '10px',
            lineHeight: '1.2'
          }}
        >
          <div style={{ textAlign: 'center', marginBottom: '4mm' }}>
            <p style={{ fontWeight: 'bold', fontSize: '12px', textTransform: 'uppercase', margin: '0' }}>{settings.storeName}</p>
            <p style={{ margin: '1px 0' }}>{settings.storeAddress}</p>
            <p style={{ margin: '1px 0' }}>{settings.storePhone}</p>
            <p style={{ fontWeight: 'bold', margin: '2mm 0 0 0', borderTop: '1px solid black', borderBottom: '1px solid black' }}>CUPOM DE VENDA</p>
            <p style={{ margin: '0', fontSize: '8px' }}>NÃO É DOCUMENTO FISCAL</p>
          </div>
          
          <div style={{ marginBottom: '3mm' }}>
            <p style={{ margin: '1px 0' }}>ID: {lastTransactionId}</p>
            <p style={{ margin: '1px 0' }}>DATA: {formatDateTime(lastSaleDate)}</p>
            <p style={{ margin: '1px 0' }}>VEND: {currentUser?.name?.toUpperCase() || 'SISTEMA'}</p>
          </div>

          <div style={{ borderTop: '1px dashed black', borderBottom: '1px dashed black', padding: '2mm 0', marginBottom: '3mm' }}>
            {lastTransactionItems.map((item, index) => (
              <div key={index} style={{ marginBottom: '1mm' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>{String(index + 1).padStart(3, '0')} - {item.product.name.substring(0, 20)}</span>
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
                  {entry.method === 'Cartão' && entry.installments && entry.installments > 1 
                    ? `CARTÃO DE CRÉDITO (${entry.installments}X)` 
                    : entry.method.toUpperCase()}
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
           <div className="bg-white w-full max-w-xs rounded-2xl p-6 shadow-2xl animate-in zoom-in-95 border border-slate-100">
              <div className="w-12 h-12 bg-red-50 text-red-600 rounded-xl flex items-center justify-center mx-auto mb-4 shadow-inner">
                 <Lock size={24} />
              </div>
              <h3 className="text-center font-black text-slate-800 uppercase text-xs mb-1">Autorização Requerida</h3>
              <p className="text-center text-[8px] text-slate-400 font-bold uppercase tracking-widest mb-6 leading-tight">
                {authAction === 'cancel_sale' ? 'Insira a senha do administrador para cancelar esta venda' : 'Insira a senha do administrador para remover o banner'}
              </p>
              
              <div className={`flex items-center gap-2 bg-slate-50 border rounded-xl px-4 py-3 mb-3 transition-all ${authError ? 'border-red-500 bg-red-50 ring-2 ring-red-100' : 'border-slate-100 focus-within:border-blue-500'}`}>
                 <KeyRound size={16} className={authError ? 'text-red-500' : 'text-slate-300'} />
                 <input 
                   type="password" 
                   autoFocus
                   value={passwordInput}
                   onChange={(e) => setPasswordInput(e.target.value)}
                   onKeyDown={(e) => e.key === 'Enter' && confirmAuth()}
                   placeholder="SENHA DO ADM"
                   className="bg-transparent w-full outline-none font-black text-[10px] uppercase placeholder:text-slate-200"
                 />
              </div>
              
              {authError && <p className="text-center text-[8px] font-black text-red-500 uppercase mb-3 animate-bounce">Senha Incorreta!</p>}

              <div className="flex flex-col gap-1.5">
                 <button onClick={confirmAuth} disabled={verifyingPassword} className="w-full py-3 bg-red-600 text-white rounded-lg font-black uppercase text-[9px] tracking-widest shadow-xl shadow-red-500/20 active:scale-95 transition-all flex items-center justify-center disabled:opacity-50">
                   {verifyingPassword ? <Loader2 size={16} className="animate-spin" /> : authAction === 'cancel_sale' ? 'AUTORIZAR CANCELAMENTO' : 'AUTORIZAR REMOÇÃO'}
                 </button>
                 <button onClick={() => { setIsAuthModalOpen(false); setPasswordInput(''); setSelectedSaleToCancel(null); setAuthAction(null); }} className="w-full py-2 text-slate-400 font-black uppercase text-[8px] tracking-widest">VOLTAR</button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default SalesTab;
