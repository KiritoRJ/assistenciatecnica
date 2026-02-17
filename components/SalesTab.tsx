
import React, { useState, useMemo } from 'react';
import { ShoppingBag, Search, X, History, ShoppingCart, Package, ArrowLeft, CheckCircle2, Eye, Loader2, Plus, Minus, Trash2, ChevronUp, ChevronDown, Receipt, Share2, Download } from 'lucide-react';
import { Product, Sale, AppSettings, User } from '../types';
import { formatCurrency, parseCurrencyString, formatDate } from '../utils';

interface Props {
  products: Product[];
  setProducts: (products: Product[]) => void;
  sales: Sale[];
  setSales: (sales: Sale[]) => void;
  settings: AppSettings;
  currentUser: User | null;
}

interface CartItem {
  product: Product;
  quantity: number;
}

const SalesTab: React.FC<Props> = ({ products, setProducts, sales, setSales, settings, currentUser }) => {
  const [showHistory, setShowHistory] = useState(false);
  const [productSearch, setProductSearch] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);
  const [lastSaleAmount, setLastSaleAmount] = useState(0);
  const [lastTransactionItems, setLastTransactionItems] = useState<CartItem[]>([]);
  const [lastPaymentMethod, setLastPaymentMethod] = useState('');
  const [lastTransactionId, setLastTransactionId] = useState('');
  const [lastSaleDate, setLastSaleDate] = useState('');

  const [cart, setCart] = useState<CartItem[]>([]);
  const [showCartDrawer, setShowCartDrawer] = useState(false);
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [amountReceived, setAmountReceived] = useState(0);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<'Dinheiro' | 'Cartão' | 'PIX'>('Dinheiro');
  const [isGeneratingReceipt, setIsGeneratingReceipt] = useState(false);

  const cartTotal = useMemo(() => {
    return cart.reduce((acc, item) => acc + (item.product.salePrice * item.quantity), 0);
  }, [cart]);

  const changeDue = useMemo(() => {
    return Math.max(0, amountReceived - cartTotal);
  }, [amountReceived, cartTotal]);

  const addToCart = (product: Product) => {
    const existingItem = cart.find(item => item.product.id === product.id);
    const currentQtyInCart = existingItem ? existingItem.quantity : 0;

    if (currentQtyInCart + 1 > product.quantity) {
      alert(`Estoque insuficiente para ${product.name}.`);
      return;
    }

    if (existingItem) {
      setCart(cart.map(item => 
        item.product.id === product.id 
          ? { ...item, quantity: item.quantity + 1 }
          : item
      ));
    } else {
      setCart([...cart, { product, quantity: 1 }]);
    }
  };

  const updateCartQuantity = (productId: string, delta: number) => {
    setCart(prevCart => {
      return prevCart.map(item => {
        if (item.product.id === productId) {
          const newQty = item.quantity + delta;
          if (newQty <= 0) return item; 
          if (newQty > item.product.quantity) {
            alert("Limite de estoque atingido.");
            return item;
          }
          return { ...item, quantity: newQty };
        }
        return item;
      });
    });
  };

  const removeFromCart = (productId: string) => {
    setCart(prevCart => prevCart.filter(item => item.product.id !== productId));
  };

  const handleFinalizeSale = () => {
    if (cart.length === 0) return;
    const transactionId = Math.random().toString(36).substr(2, 6).toUpperCase();
    const date = new Date().toISOString();

    const newSales: Sale[] = cart.map(item => ({
      id: Math.random().toString(36).substr(2, 9),
      productId: item.product.id,
      productName: item.product.name,
      date,
      quantity: item.quantity,
      originalPrice: item.product.salePrice,
      discount: 0,
      finalPrice: item.product.salePrice * item.quantity,
      costAtSale: item.product.costPrice,
      paymentMethod: selectedPaymentMethod,
      sellerName: currentUser?.name || 'Sistema',
      transactionId
    }));

    const updatedProducts = products.map(p => {
      const cartItem = cart.find(item => item.product.id === p.id);
      if (cartItem) return { ...p, quantity: p.quantity - cartItem.quantity };
      return p;
    });

    setProducts(updatedProducts);
    setSales([...newSales, ...sales]);
    setLastSaleAmount(cartTotal);
    setLastTransactionItems([...cart]);
    setLastPaymentMethod(selectedPaymentMethod);
    setLastTransactionId(transactionId);
    setLastSaleDate(date);
    
    setCart([]);
    setShowCheckoutModal(false);
    setShowCartDrawer(false);
    setShowSuccess(true);
  };

  const generateReceiptImage = async () => {
    setIsGeneratingReceipt(true);
    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const scale = 2;
      const width = (settings.pdfPaperWidth || 80) * 4.75 * scale;
      const thermalFont = (sz: number, bold: boolean = false) => `${bold ? '900' : '400'} ${sz * scale}px "Courier New", Courier, monospace`;

      // Cálculo de altura dinâmica baseado na quantidade de itens
      const headerHeight = 250 * scale;
      const itemHeight = 30 * scale;
      const footerHeight = 200 * scale;
      const dynamicHeight = headerHeight + (lastTransactionItems.length * itemHeight) + footerHeight;

      canvas.width = width;
      canvas.height = dynamicHeight;
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, width, dynamicHeight);

      const drawText = (text: string, y: number, sz: number, b: boolean = false, al: 'center' | 'left' | 'right' = 'center', col: string = '#000') => {
        ctx.fillStyle = col;
        ctx.font = thermalFont(sz, b);
        ctx.textAlign = al;
        let x = al === 'center' ? width / 2 : (al === 'left' ? 20 * scale : width - 20 * scale);
        ctx.fillText((text || '').toUpperCase(), x, y);
      };

      const drawDashedLine = (y: number) => {
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 1 * scale;
        ctx.setLineDash([5 * scale, 3 * scale]);
        ctx.beginPath();
        ctx.moveTo(15 * scale, y);
        ctx.lineTo(width - 15 * scale, y);
        ctx.stroke();
        ctx.setLineDash([]);
      };

      let currentY = 40 * scale;

      // Header
      drawText(settings.storeName, currentY, 18, true);
      currentY += 25 * scale;
      drawText("RECIBO DE VENDA", currentY, 10, true);
      currentY += 25 * scale;
      drawDashedLine(currentY);
      currentY += 25 * scale;

      // Info
      drawText(`TRANS: #${lastTransactionId}`, currentY, 9, false, 'left');
      drawText(new Date(lastSaleDate).toLocaleDateString(), currentY, 9, false, 'right');
      currentY += 15 * scale;
      drawText(`VENDEDOR: ${currentUser?.name || 'SISTEMA'}`, currentY, 9, false, 'left');
      currentY += 25 * scale;
      drawDashedLine(currentY);
      currentY += 25 * scale;

      // Itens Header
      drawText("ITEM", currentY, 8, true, 'left');
      drawText("QTD", currentY, 8, true, 'center');
      drawText("TOTAL", currentY, 8, true, 'right');
      currentY += 20 * scale;

      // Itens List
      lastTransactionItems.forEach(item => {
        const name = item.product.name.substring(0, 18);
        drawText(name, currentY, 9, false, 'left');
        drawText(item.quantity.toString(), currentY, 9, false, 'center');
        drawText(formatCurrency(item.product.salePrice * item.quantity), currentY, 9, false, 'right');
        currentY += 18 * scale;
      });

      currentY += 10 * scale;
      drawDashedLine(currentY);
      currentY += 30 * scale;

      // Totais
      drawText("PAGAMENTO:", currentY, 9, true, 'left');
      drawText(lastPaymentMethod, currentY, 10, true, 'right');
      currentY += 25 * scale;

      ctx.fillStyle = '#F8FAFC';
      ctx.fillRect(15 * scale, currentY - 20 * scale, width - 30 * scale, 45 * scale);
      drawText("TOTAL GERAL", currentY + 12 * scale, 12, true, 'left', '#000');
      drawText(formatCurrency(lastSaleAmount), currentY + 12 * scale, 16, true, 'right', '#000');
      currentY += 60 * scale;

      drawDashedLine(currentY);
      currentY += 30 * scale;
      drawText("OBRIGADO PELA PREFERENCIA!", currentY, 9, true);
      currentY += 20 * scale;
      drawText("SISTEMA ASSISTÊNCIA PRO", currentY, 7, false, 'center', '#94A3B8');

      // Export
      const finalCanvas = document.createElement('canvas');
      finalCanvas.width = width;
      finalCanvas.height = currentY + 40 * scale;
      const finalCtx = finalCanvas.getContext('2d');
      if (finalCtx) {
        finalCtx.drawImage(canvas, 0, 0);
        const jpeg = finalCanvas.toDataURL('image/jpeg', 0.9);
        
        if ((window as any).AndroidBridge) {
          const base64 = jpeg.split(',')[1];
          (window as any).AndroidBridge.shareFile(base64, `CUPOM_${lastTransactionId}.jpg`, 'image/jpeg');
        } else {
          const a = document.createElement('a');
          a.href = jpeg;
          a.download = `CUPOM_${lastTransactionId}.jpg`;
          a.click();
        }
      }
    } catch (err) {
      console.error("Erro ao gerar cupom:", err);
      alert("Falha ao processar o cupom fiscal.");
    } finally {
      setIsGeneratingReceipt(false);
    }
  };

  const filteredProducts = products.filter(p => 
    p.quantity > 0 && 
    p.name.toLowerCase().includes(productSearch.toLowerCase())
  );

  return (
    <div className="space-y-4 pb-32">
      {showHistory ? (
        <div className="space-y-4 animate-in fade-in slide-in-from-right duration-300">
           <div className="flex items-center gap-3">
            <button onClick={() => setShowHistory(false)} className="p-2 bg-slate-100 rounded-full"><ArrowLeft size={20} /></button>
            <h2 className="text-xl font-black text-slate-800 uppercase tracking-tighter">Histórico de Vendas</h2>
          </div>
          <div className="grid gap-2">
            {sales.length > 0 ? sales.map(sale => (
              <div key={sale.id} className="bg-white p-4 border border-slate-100 rounded-2xl flex justify-between items-center shadow-sm">
                <div>
                  <p className="text-xs font-black uppercase text-slate-800">{sale.productName}</p>
                  <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">{formatDate(sale.date)} • {sale.paymentMethod} • Qtd: {sale.quantity}</p>
                </div>
                <p className="font-black text-emerald-600 text-sm">{formatCurrency(sale.finalPrice)}</p>
              </div>
            )) : (
              <div className="text-center py-20 opacity-30 uppercase font-black text-xs tracking-[0.2em]">Sem vendas registradas</div>
            )}
          </div>
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

          <div className="relative group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-emerald-500 transition-colors" size={18} />
            <input 
              type="text" 
              placeholder="Buscar item no estoque..." 
              className="w-full pl-12 pr-4 py-4 bg-white border-none rounded-2xl text-xs font-bold shadow-sm focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all placeholder:text-slate-300" 
              value={productSearch} 
              onChange={(e) => setProductSearch(e.target.value)} 
            />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {filteredProducts.map(product => (
              <button key={product.id} onClick={() => addToCart(product)} className="bg-white border border-slate-50 rounded-[2rem] overflow-hidden shadow-sm text-left active:scale-95 transition-all flex flex-col group border-b-4 border-b-transparent hover:border-b-emerald-500">
                <div className="h-28 bg-slate-50 relative overflow-hidden">
                  {product.photo ? (
                    <img src={product.photo} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-200"><Package size={32} /></div>
                  )}
                  <span className="absolute top-2 right-2 bg-slate-900 text-white text-[9px] font-black px-2 py-1 rounded-lg shadow-lg">
                    {product.quantity}
                  </span>
                </div>
                <div className="p-3">
                  <h3 className="font-bold text-slate-800 text-[10px] uppercase truncate mb-1">{product.name}</h3>
                  <p className="text-emerald-600 font-black text-xs">{formatCurrency(product.salePrice)}</p>
                </div>
              </button>
            ))}
          </div>

          <div className="fixed bottom-20 left-0 right-0 p-4 z-40 bg-gradient-to-t from-slate-50 via-slate-50/80 to-transparent">
            <div className="max-w-xl mx-auto">
              <div className={`bg-slate-950 rounded-[2.5rem] shadow-2xl overflow-hidden transition-all duration-300 ${showCartDrawer ? 'mb-0' : 'mb-0'}`}>
                
                <div className="p-5 flex items-center justify-between cursor-pointer active:bg-slate-900 transition-colors" onClick={() => setShowCartDrawer(!showCartDrawer)}>
                  <div className="flex items-center gap-4">
                    <div className="relative">
                      <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center text-emerald-500">
                        <ShoppingCart size={24} />
                      </div>
                      <span className="absolute -top-2 -right-2 bg-emerald-500 text-white text-[10px] font-black w-6 h-6 rounded-full flex items-center justify-center border-2 border-slate-950 shadow-lg">
                        {cart.length}
                      </span>
                    </div>
                    <div>
                      <p className="text-[9px] font-black uppercase text-slate-500 tracking-widest">CARRINHO ({cart.length})</p>
                      <p className="text-xl font-black text-white">{formatCurrency(cartTotal)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <button 
                      onClick={(e) => { e.stopPropagation(); if(cart.length > 0) setShowCheckoutModal(true); }}
                      disabled={cart.length === 0} 
                      className="bg-emerald-500 text-white px-8 py-3.5 rounded-2xl font-black text-[11px] uppercase tracking-widest active:scale-90 disabled:opacity-20 transition-all shadow-xl shadow-emerald-500/20"
                    >
                      CHECKOUT
                    </button>
                    {showCartDrawer ? <ChevronDown size={20} className="text-slate-500" /> : <ChevronUp size={20} className="text-slate-500" />}
                  </div>
                </div>

                {showCartDrawer && (
                  <div className="px-5 pb-8 max-h-[40vh] overflow-y-auto space-y-3 animate-in slide-in-from-bottom-5">
                    {cart.length > 0 ? cart.map((item) => (
                      <div key={item.product.id} className="bg-white/5 p-4 rounded-2xl flex items-center justify-between border border-white/5">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-10 h-10 bg-slate-900 rounded-xl overflow-hidden shrink-0">
                             {item.product.photo ? <img src={item.product.photo} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-slate-800"><Package size={14}/></div>}
                          </div>
                          <div className="min-w-0">
                            <h4 className="text-[10px] font-black text-white uppercase truncate">{item.product.name}</h4>
                            <p className="text-[9px] text-emerald-500 font-bold uppercase">{formatCurrency(item.product.salePrice)}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="flex items-center bg-slate-900 rounded-xl border border-white/10 p-1">
                            <button onClick={() => updateCartQuantity(item.product.id, -1)} className="p-2 text-slate-400 hover:text-white active:scale-90"><Minus size={14} /></button>
                            <span className="w-8 text-center text-[11px] font-black text-white">{item.quantity}</span>
                            <button onClick={() => updateCartQuantity(item.product.id, 1)} className="p-2 text-slate-400 hover:text-white active:scale-90"><Plus size={14} /></button>
                          </div>
                          <button onClick={() => removeFromCart(item.product.id)} className="p-3 bg-red-500/10 text-red-500 rounded-xl active:scale-90 transition-all"><Trash2 size={16} /></button>
                        </div>
                      </div>
                    )) : (
                      <div className="text-center py-6 text-slate-600 font-black uppercase text-[9px] tracking-widest opacity-50">Carrinho Vazio</div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {showCheckoutModal && (
        <div className="fixed inset-0 bg-slate-950/80 flex items-center justify-center z-[100] p-4 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-sm rounded-[3rem] shadow-2xl overflow-hidden animate-in zoom-in-95">
            <div className="p-8 border-b border-slate-50 flex items-center justify-between">
              <h3 className="text-xl font-black text-slate-800 uppercase tracking-tighter">Finalizar Venda</h3>
              <button onClick={() => setShowCheckoutModal(false)} className="text-slate-400 p-3 bg-slate-50 rounded-full active:scale-90"><X size={20} /></button>
            </div>
            <div className="p-8 space-y-6">
              <div className="bg-emerald-50 p-8 rounded-[2.5rem] text-center border border-emerald-100">
                <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-1">TOTAL DA VENDA</p>
                <p className="text-4xl font-black text-emerald-800 tracking-tighter">{formatCurrency(cartTotal)}</p>
              </div>

              <div className="space-y-3">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 text-center">Meio de Pagamento</p>
                <div className="grid grid-cols-3 gap-2">
                  {['Dinheiro', 'Cartão', 'PIX'].map(m => (
                    <button 
                      key={m} 
                      onClick={() => {
                        setSelectedPaymentMethod(m as any);
                        if (m !== 'Dinheiro') setAmountReceived(cartTotal);
                      }} 
                      className={`py-4 rounded-2xl text-[10px] font-black uppercase border transition-all active:scale-95 ${selectedPaymentMethod === m ? 'bg-emerald-600 border-emerald-600 text-white shadow-xl shadow-emerald-500/20' : 'bg-white border-slate-100 text-slate-400'}`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              {selectedPaymentMethod === 'Dinheiro' && (
                <div className="space-y-3 animate-in slide-in-from-top-2">
                   <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 text-center">Valor Recebido</p>
                   <input 
                    autoFocus 
                    type="text"
                    value={formatCurrency(amountReceived).replace('R$', '').trim()} 
                    onChange={(e) => setAmountReceived(parseCurrencyString(e.target.value))} 
                    onFocus={(e) => e.target.select()}
                    className="w-full p-6 bg-slate-50 border-2 border-emerald-100 rounded-[2rem] text-center font-black text-emerald-700 outline-none text-2xl focus:border-emerald-500 transition-all" 
                    placeholder="0,00"
                  />
                  {amountReceived > cartTotal && (
                    <div className="bg-slate-900 p-5 rounded-2xl flex items-center justify-between border border-slate-800 shadow-xl">
                      <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">Troco ao Cliente</p>
                      <p className="text-xl font-black text-white">{formatCurrency(changeDue)}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="p-8 bg-slate-50 flex gap-3">
              <button onClick={() => setShowCheckoutModal(false)} className="flex-1 py-5 font-black text-slate-400 bg-white border border-slate-200 rounded-2xl uppercase text-[10px] tracking-widest active:scale-95">SAIR</button>
              <button 
                onClick={handleFinalizeSale} 
                disabled={selectedPaymentMethod === 'Dinheiro' && amountReceived < cartTotal}
                className="flex-[2] py-5 font-black text-white bg-emerald-600 rounded-2xl shadow-xl shadow-emerald-500/20 uppercase text-[10px] tracking-widest active:scale-95 disabled:opacity-40 transition-all"
              >
                CONFIRMAR VENDA
              </button>
            </div>
          </div>
        </div>
      )}

      {showSuccess && (
        <div className="fixed inset-0 bg-slate-950/90 flex items-center justify-center z-[110] p-6 backdrop-blur-xl animate-in zoom-in-95 duration-500">
          <div className="bg-white w-full max-w-xs rounded-[3rem] p-10 text-center shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-2 bg-emerald-500" />
            <div className="w-24 h-24 bg-emerald-100 text-emerald-600 rounded-[2.5rem] flex items-center justify-center mx-auto mb-6 animate-bounce shadow-lg shadow-emerald-500/10">
              <CheckCircle2 size={56} />
            </div>
            <h3 className="text-2xl font-black text-slate-800 uppercase tracking-tighter mb-2">Venda Concluída</h3>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-10">O estoque foi atualizado</p>
            <div className="space-y-3">
              <button 
                onClick={generateReceiptImage} 
                disabled={isGeneratingReceipt}
                className="w-full py-5 bg-blue-600 text-white font-black rounded-2xl text-[11px] uppercase tracking-widest active:scale-95 shadow-xl flex items-center justify-center gap-2"
              >
                {isGeneratingReceipt ? <Loader2 className="animate-spin" size={18} /> : <Receipt size={18} />}
                {isGeneratingReceipt ? 'GERANDO...' : 'GERAR CUPOM (JPEG)'}
              </button>
              <button 
                onClick={() => {
                  setLastTransactionItems([]); 
                  setShowSuccess(false);
                }} 
                className="w-full py-5 bg-slate-900 text-white font-black rounded-2xl text-[11px] uppercase tracking-widest active:scale-95 shadow-xl"
              >
                NOVA VENDA
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SalesTab;
