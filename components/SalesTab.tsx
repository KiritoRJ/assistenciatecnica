
import React, { useState, useMemo } from 'react';
import { ShoppingBag, Search, X, History, ShoppingCart, MoreVertical, Package, ArrowLeft, CheckCircle2, Share2, Calendar, Layers, MessageCircle, Plus, Minus, Trash2, DollarSign, Calculator, FileText, CreditCard, Wallet as WalletIcon, Coins, Eye } from 'lucide-react';
import { Product, Sale, AppSettings, User } from '../types';
import { formatCurrency, parseCurrencyString, formatDate } from '../utils';
import { jsPDF } from 'jspdf';

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
  const [historySearch, setHistorySearch] = useState('');
  const [historyFilter, setHistoryFilter] = useState<'all' | 'today' | 'month'>('all');
  const [showMenu, setShowMenu] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [lastSaleAmount, setLastSaleAmount] = useState(0);
  const [lastTransactionItems, setLastTransactionItems] = useState<CartItem[]>([]);
  const [lastPaymentMethod, setLastPaymentMethod] = useState('');
  const [lastTransactionId, setLastTransactionId] = useState('');

  const [cart, setCart] = useState<CartItem[]>([]);
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [amountReceived, setAmountReceived] = useState(0);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<'Dinheiro' | 'Cartão de Crédito' | 'Cartão de Débito' | 'PIX'>('Dinheiro');

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
      alert(`Estoque insuficiente.`);
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
    setCart(cart.map(item => {
      if (item.product.id === productId) {
        const newQty = item.quantity + delta;
        if (newQty < 1) return item;
        if (newQty > item.product.quantity) return item;
        return { ...item, quantity: newQty };
      }
      return item;
    }));
  };

  const removeFromCart = (productId: string) => {
    setCart(cart.filter(item => item.product.id !== productId));
  };

  const generateReceiptPDF = (items: CartItem[], total: number, payment: string, seller: string, change: number = 0) => {
    const baseFontSize = 8;
    const width = 80;
    const margin = 5;
    const centerX = width / 2;

    const estimatedHeight = 100 + (items.length * 10);
    const doc = new jsPDF({
      orientation: 'p',
      unit: 'mm',
      format: [width, estimatedHeight]
    });

    let y = 10;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text(settings.storeName.toUpperCase(), centerX, y, { align: 'center' });
    y += 8;

    doc.setFontSize(baseFontSize);
    doc.text('CUPOM DE VENDA', centerX, y, { align: 'center' });
    y += 6;
    doc.setFont('helvetica', 'normal');
    doc.text(`Data: ${new Date().toLocaleDateString('pt-BR')}`, margin, y);
    y += 5;
    doc.text(`Vendedor: ${seller}`, margin, y);
    y += 5;
    doc.line(margin, y, width - margin, y);
    y += 7;

    doc.setFont('helvetica', 'bold');
    doc.text('DESCRIÇÃO', margin, y);
    doc.text('VALOR', width - margin, y, { align: 'right' });
    y += 5;
    doc.setFont('helvetica', 'normal');

    items.forEach((item) => {
      const splitName = doc.splitTextToSize(`${item.quantity}x ${item.product.name.toUpperCase()}`, width - 25);
      doc.text(splitName, margin, y);
      doc.text(formatCurrency(item.product.salePrice * item.quantity), width - margin, y, { align: 'right' });
      y += (splitName.length * 4) + 1;
    });

    y += 2;
    doc.line(margin, y, width - margin, y);
    y += 8;
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text(`TOTAL:`, margin, y);
    doc.text(formatCurrency(total), width - margin, y, { align: 'right' });
    y += 7;

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text(`PAGAMENTO: ${payment}`, margin, y);
    
    y += 15;
    doc.text('OBRIGADO PELA PREFERÊNCIA!', centerX, y, { align: 'center' });
    
    return doc;
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
      if (cartItem) {
        return { ...p, quantity: p.quantity - cartItem.quantity };
      }
      return p;
    });

    setProducts(updatedProducts);
    setSales([...newSales, ...sales]);
    setLastSaleAmount(cartTotal);
    setLastTransactionItems([...cart]);
    setLastPaymentMethod(selectedPaymentMethod);
    setLastTransactionId(transactionId);
    setCart([]);
    setShowCheckoutModal(false);
    setAmountReceived(0);
    setShowSuccess(true);
  };

  const handleViewReceipt = () => {
    try {
      const doc = generateReceiptPDF(
        lastTransactionItems, 
        lastSaleAmount, 
        lastPaymentMethod, 
        currentUser?.name || 'Sistema',
        changeDue
      );
      // USAR DATA URI PARA O ANDROID STUDIO WEBVIEW
      const dataUri = doc.output('datauristring');
      window.location.href = dataUri;
    } catch (error) {
      alert('Erro ao gerar recibo.');
    }
  };

  const getFilteredSales = () => {
    const today = new Date().toISOString().split('T')[0];
    const currentMonth = new Date().toISOString().slice(0, 7);
    return sales.filter(s => {
      const saleDate = s.date.split('T')[0];
      const matchesSearch = s.productName.toLowerCase().includes(historySearch.toLowerCase());
      if (historyFilter === 'today') return saleDate === today && matchesSearch;
      if (historyFilter === 'month') return s.date.startsWith(currentMonth) && matchesSearch;
      return matchesSearch;
    });
  };

  const filteredProducts = products.filter(p => 
    p.quantity > 0 && 
    p.name.toLowerCase().includes(productSearch.toLowerCase())
  );

  const filteredSales = getFilteredSales();

  return (
    <div className="space-y-4 pb-20">
      {showHistory ? (
        <div className="space-y-4 animate-in fade-in duration-300">
           <div className="flex items-center gap-3">
            <button onClick={() => setShowHistory(false)} className="p-2 bg-slate-100 rounded-full"><ArrowLeft size={20} /></button>
            <h2 className="text-xl font-black text-slate-800 uppercase">Histórico</h2>
          </div>
          <div className="grid gap-2">
            {filteredSales.map(sale => (
              <div key={sale.id} className="bg-white p-3 border border-slate-100 rounded-xl flex justify-between items-center">
                <div>
                  <p className="text-xs font-bold uppercase">{sale.productName}</p>
                  <p className="text-[9px] text-slate-400 font-bold uppercase">{formatDate(sale.date)} • {sale.paymentMethod}</p>
                </div>
                <p className="font-black text-emerald-600 text-sm">{formatCurrency(sale.finalPrice)}</p>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-black text-slate-800 uppercase tracking-tight flex items-center gap-2">
              <ShoppingCart size={18} className="text-emerald-600" /> Vendas
            </h2>
            <button onClick={() => setShowHistory(true)} className="p-2 text-slate-400 bg-white border border-slate-100 rounded-xl"><History size={18} /></button>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input type="text" placeholder="Buscar produto..." className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold" value={productSearch} onChange={(e) => setProductSearch(e.target.value)} />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {filteredProducts.map(product => (
              <button key={product.id} onClick={() => addToCart(product)} className="bg-white border border-slate-100 rounded-xl overflow-hidden shadow-sm text-left active:scale-95 transition-all">
                <div className="h-24 bg-slate-50 relative">
                  {product.photo ? <img src={product.photo} className="w-full h-full object-contain" /> : <div className="w-full h-full flex items-center justify-center text-slate-200"><Package size={24} /></div>}
                  <span className="absolute top-1 right-1 bg-slate-900 text-white text-[8px] font-black px-1.5 py-0.5 rounded-md">{product.quantity}</span>
                </div>
                <div className="p-2">
                  <h3 className="font-bold text-slate-800 text-[9px] uppercase truncate">{product.name}</h3>
                  <p className="text-emerald-600 font-black text-xs">{formatCurrency(product.salePrice)}</p>
                </div>
              </button>
            ))}
          </div>

          <div className="fixed bottom-20 left-0 right-0 p-3 z-40 md:static md:p-0">
            <div className="bg-slate-900 rounded-2xl p-4 flex justify-between items-center shadow-xl">
              <div>
                <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Carrinho ({cart.length})</p>
                <p className="text-lg font-black text-emerald-400">{formatCurrency(cartTotal)}</p>
              </div>
              <button disabled={cart.length === 0} onClick={() => setShowCheckoutModal(true)} className="bg-emerald-600 text-white px-6 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest active:scale-95 disabled:opacity-50">Finalizar</button>
            </div>
          </div>
        </>
      )}

      {showCheckoutModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-3 backdrop-blur-sm">
          <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95">
            <div className="p-4 border-b border-slate-50 flex items-center justify-between">
              <h3 className="text-sm font-black text-slate-800 uppercase tracking-tight">Checkout</h3>
              <button onClick={() => setShowCheckoutModal(false)} className="text-slate-400 p-1.5 bg-slate-50 rounded-full"><X size={18} /></button>
            </div>
            <div className="p-4 space-y-4">
              <div className="bg-slate-50 p-4 rounded-xl text-center">
                <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Total</p>
                <p className="text-2xl font-black text-slate-800">{formatCurrency(cartTotal)}</p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {['Dinheiro', 'Cartão', 'PIX'].map(m => (
                  <button key={m} onClick={() => setSelectedPaymentMethod(m as any)} className={`py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${selectedPaymentMethod === m ? 'bg-emerald-600 border-emerald-600 text-white' : 'bg-white border-slate-100 text-slate-400'}`}>{m}</button>
                ))}
              </div>
              {selectedPaymentMethod === 'Dinheiro' && (
                <input 
                  autoFocus 
                  value={formatCurrency(amountReceived).replace('R$', '').trim()} 
                  onChange={(e) => setAmountReceived(parseCurrencyString(e.target.value))} 
                  onFocus={(e) => e.target.select()}
                  className="w-full p-4 bg-slate-50 border-2 border-emerald-100 rounded-xl text-center font-black text-emerald-700 outline-none text-2xl" 
                  placeholder="0,00" 
                />
              )}
              {amountReceived > cartTotal && (
                <div className="bg-emerald-900 p-3 rounded-xl text-center">
                  <p className="text-[9px] font-black text-emerald-400 uppercase tracking-widest">Troco</p>
                  <p className="text-xl font-black text-white">{formatCurrency(changeDue)}</p>
                </div>
              )}
            </div>
            <div className="p-4 bg-slate-50 flex gap-2">
              <button onClick={() => setShowCheckoutModal(false)} className="flex-1 py-3 font-bold text-slate-400 bg-white border border-slate-200 rounded-xl uppercase text-[10px]">Voltar</button>
              <button onClick={handleFinalizeSale} className="flex-[2] py-3 font-black text-white bg-emerald-600 rounded-xl shadow-md uppercase text-[10px] tracking-widest">Finalizar Venda</button>
            </div>
          </div>
        </div>
      )}

      {showSuccess && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[60] p-4 backdrop-blur-xl animate-in zoom-in-95">
          <div className="bg-white w-full max-w-xs rounded-2xl p-6 text-center shadow-2xl">
            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4"><CheckCircle2 size={40} /></div>
            <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight mb-4">Venda Concluída!</h3>
            <div className="space-y-2">
              <button onClick={handleViewReceipt} className="w-full py-3 bg-blue-600 text-white font-black rounded-xl text-[10px] uppercase tracking-widest flex items-center justify-center gap-2"><Eye size={16} /> Ver Recibo</button>
              <button onClick={() => setShowSuccess(false)} className="w-full py-3 bg-slate-900 text-white font-black rounded-xl text-[10px] uppercase tracking-widest">Fechar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SalesTab;
