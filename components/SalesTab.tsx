
import React, { useState, useMemo } from 'react';
import { ShoppingBag, Search, X, History, ShoppingCart, Package, ArrowLeft, CheckCircle2, Eye, Loader2 } from 'lucide-react';
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
  const [historySearch, setHistorySearch] = useState('');
  const [historyFilter, setHistoryFilter] = useState<'all' | 'today' | 'month'>('all');
  const [showSuccess, setShowSuccess] = useState(false);
  const [lastSaleAmount, setLastSaleAmount] = useState(0);
  const [lastTransactionItems, setLastTransactionItems] = useState<CartItem[]>([]);
  const [lastPaymentMethod, setLastPaymentMethod] = useState('');

  const [cart, setCart] = useState<CartItem[]>([]);
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [amountReceived, setAmountReceived] = useState(0);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<'Dinheiro' | 'Cartão' | 'PIX'>('Dinheiro');

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

  // GERAÇÃO DE CUPOM DE VENDA EM IMAGEM JPEG
  const generateSalesReceiptImage = (items: CartItem[], total: number, payment: string, seller: string) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const scale = 2;
    const width = 400 * scale;
    // Altura baseada no número de itens vendidos
    const height = (200 + items.length * 30) * scale;
    canvas.width = width;
    canvas.height = height;

    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = '#000000';
    ctx.textAlign = 'center';
    ctx.font = `bold ${18 * scale}px Arial`;
    ctx.fillText(settings.storeName.toUpperCase(), width / 2, 40 * scale);
    
    ctx.font = `bold ${10 * scale}px Arial`;
    ctx.fillText('CUPOM DE VENDA (BALCÃO)', width / 2, 65 * scale);
    
    ctx.strokeStyle = '#F1F5F9';
    ctx.lineWidth = 1 * scale;
    ctx.beginPath(); ctx.moveTo(20*scale, 75*scale); ctx.lineTo((width-20*scale), 75*scale); ctx.stroke();

    ctx.textAlign = 'left';
    ctx.font = `${10 * scale}px Arial`;
    ctx.fillText(`DATA: ${new Date().toLocaleDateString()}`, 20 * scale, 95 * scale);
    ctx.fillText(`VENDEDOR: ${seller}`, 20 * scale, 110 * scale);
    ctx.fillText(`PAGAMENTO: ${payment}`, 20 * scale, 125 * scale);

    let y = 160;
    ctx.font = `bold ${9 * scale}px Arial`;
    ctx.fillText('PRODUTO / QTD', 20 * scale, (y - 20) * scale);
    ctx.textAlign = 'right';
    ctx.fillText('TOTAL ITEM', (width - 20 * scale), (y - 20) * scale);

    items.forEach(item => {
      ctx.font = `${10 * scale}px Arial`;
      ctx.textAlign = 'left';
      ctx.fillText(`${item.quantity}x ${item.product.name.substring(0, 22).toUpperCase()}`, 20 * scale, y * scale);
      ctx.textAlign = 'right';
      ctx.fillText(formatCurrency(item.product.salePrice * item.quantity), (width - 20 * scale), y * scale);
      y += 20;
    });

    y += 10;
    ctx.beginPath(); ctx.moveTo(20*scale, (y-10)*scale); ctx.lineTo((width-20*scale), (y-10)*scale); ctx.stroke();
    
    ctx.font = `bold ${16 * scale}px Arial`;
    ctx.textAlign = 'left';
    ctx.fillText('TOTAL PAGO', 20 * scale, (y + 15) * scale);
    ctx.textAlign = 'right';
    ctx.fillText(formatCurrency(total), (width - 20 * scale), (y + 15) * scale);

    y += 45;
    ctx.textAlign = 'center';
    ctx.font = `italic ${9 * scale}px Arial`;
    ctx.fillText('AGRADECEMOS A SUA PREFERÊNCIA!', width / 2, y * scale);

    const jpegBase64 = canvas.toDataURL('image/jpeg', 0.8).split(',')[1];
    const fileName = `Venda_${Date.now()}.jpg`;

    if ((window as any).AndroidBridge) {
      (window as any).AndroidBridge.shareFile(jpegBase64, fileName, 'image/jpeg');
    } else {
      const link = document.createElement('a');
      link.download = fileName; link.href = `data:image/jpeg;base64,${jpegBase64}`; link.click();
    }
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
    setCart([]);
    setShowCheckoutModal(false);
    setShowSuccess(true);
  };

  const handleViewReceipt = () => {
    generateSalesReceiptImage(
      lastTransactionItems, 
      lastSaleAmount, 
      lastPaymentMethod, 
      currentUser?.name || 'Sistema'
    );
  };

  const filteredProducts = products.filter(p => 
    p.quantity > 0 && 
    p.name.toLowerCase().includes(productSearch.toLowerCase())
  );

  return (
    <div className="space-y-4 pb-20">
      {showHistory ? (
        <div className="space-y-4 animate-in fade-in duration-300">
           <div className="flex items-center gap-3">
            <button onClick={() => setShowHistory(false)} className="p-2 bg-slate-100 rounded-full"><ArrowLeft size={20} /></button>
            <h2 className="text-xl font-black text-slate-800 uppercase">Histórico</h2>
          </div>
          <div className="grid gap-2">
            {sales.filter(s => s.productName.toLowerCase().includes(historySearch.toLowerCase())).map(sale => (
              <div key={sale.id} className="bg-white p-3 border border-slate-100 rounded-xl flex justify-between items-center shadow-sm">
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
            <input type="text" placeholder="Buscar item..." className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold shadow-sm" value={productSearch} onChange={(e) => setProductSearch(e.target.value)} />
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
              <button disabled={cart.length === 0} onClick={() => setShowCheckoutModal(true)} className="bg-emerald-600 text-white px-6 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest active:scale-95 disabled:opacity-50">Checkout</button>
            </div>
          </div>
        </>
      )}

      {showCheckoutModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-3 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden">
            <div className="p-4 border-b border-slate-50 flex items-center justify-between">
              <h3 className="text-sm font-black text-slate-800 uppercase">Checkout</h3>
              <button onClick={() => setShowCheckoutModal(false)} className="text-slate-400 p-1.5 bg-slate-50 rounded-full"><X size={18} /></button>
            </div>
            <div className="p-4 space-y-4">
              <div className="bg-slate-50 p-4 rounded-xl text-center">
                <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Total a Pagar</p>
                <p className="text-2xl font-black text-slate-800">{formatCurrency(cartTotal)}</p>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {['Dinheiro', 'Cartão', 'PIX'].map(m => (
                  <button key={m} onClick={() => setSelectedPaymentMethod(m as any)} className={`py-2 rounded-xl text-[9px] font-black uppercase border transition-all ${selectedPaymentMethod === m ? 'bg-emerald-600 border-emerald-600 text-white shadow-md' : 'bg-white border-slate-100 text-slate-400'}`}>{m}</button>
                ))}
              </div>
              {selectedPaymentMethod === 'Dinheiro' && (
                <input 
                  autoFocus 
                  type="text"
                  value={formatCurrency(amountReceived).replace('R$', '').trim()} 
                  onChange={(e) => setAmountReceived(parseCurrencyString(e.target.value))} 
                  onFocus={(e) => e.target.select()}
                  className="w-full p-3 bg-slate-50 border-2 border-emerald-100 rounded-xl text-center font-black text-emerald-700 outline-none text-xl" 
                />
              )}
              {amountReceived > cartTotal && (
                <div className="bg-emerald-900 p-2 rounded-xl text-center">
                  <p className="text-[9px] font-black text-emerald-400 uppercase tracking-widest">Troco</p>
                  <p className="text-xl font-black text-white">{formatCurrency(changeDue)}</p>
                </div>
              )}
            </div>
            <div className="p-4 bg-slate-50 flex gap-2">
              <button onClick={() => setShowCheckoutModal(false)} className="flex-1 py-3 font-bold text-slate-400 bg-white border border-slate-200 rounded-xl uppercase text-[9px]">Sair</button>
              <button onClick={handleFinalizeSale} className="flex-[2] py-3 font-black text-white bg-emerald-600 rounded-xl shadow-md uppercase text-[9px] tracking-widest">Finalizar</button>
            </div>
          </div>
        </div>
      )}

      {showSuccess && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[60] p-4 backdrop-blur-xl animate-in zoom-in-95">
          <div className="bg-white w-full max-w-xs rounded-2xl p-6 text-center shadow-2xl">
            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4 animate-bounce"><CheckCircle2 size={40} /></div>
            <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight mb-4">Sucesso!</h3>
            <div className="space-y-2">
              <button onClick={handleViewReceipt} className="w-full py-3 bg-blue-600 text-white font-black rounded-xl text-[10px] uppercase tracking-widest flex items-center justify-center gap-2"><Eye size={16} /> Enviar Recibo</button>
              <button onClick={() => setShowSuccess(false)} className="w-full py-3 bg-slate-900 text-white font-black rounded-xl text-[10px] uppercase tracking-widest">Concluído</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SalesTab;
