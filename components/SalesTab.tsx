
import React, { useState, useMemo } from 'react';
import { ShoppingBag, Search, X, History, ShoppingCart, MoreVertical, Package, ArrowLeft, CheckCircle2, Share2, Calendar, Layers, MessageCircle, Plus, Minus, Trash2, DollarSign, Calculator, FileText, CreditCard, Wallet as WalletIcon, Coins } from 'lucide-react';
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

  // Cart State
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
      alert(`Estoque insuficiente para ${product.name}`);
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
        if (newQty > item.product.quantity) {
          alert('Estoque máximo atingido');
          return item;
        }
        return { ...item, quantity: newQty };
      }
      return item;
    }));
  };

  const removeFromCart = (productId: string) => {
    setCart(cart.filter(item => item.product.id !== productId));
  };

  const generateReceiptPDF = (items: CartItem[], total: number, payment: string, seller: string, change: number = 0) => {
    const baseFontSize = settings.pdfFontSize || 8;
    const fontFamily = settings.pdfFontFamily || 'helvetica';
    const width = settings.pdfPaperWidth || 80;
    const margin = 5;
    const centerX = width / 2;
    const textColor = settings.pdfTextColor || '#000000';
    const bgColor = settings.pdfBgColor || '#FFFFFF';

    const now = new Date();
    const dateStr = now.toLocaleDateString('pt-BR');
    const timeStr = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

    const estimatedHeight = 100 + (items.length * 12);
    const doc = new jsPDF({
      orientation: 'p',
      unit: 'mm',
      format: [width, estimatedHeight]
    });

    doc.setFillColor(bgColor);
    doc.rect(0, 0, width, estimatedHeight, 'F');
    doc.setTextColor(textColor);
    doc.setFont(fontFamily, 'normal');

    let y = 10;
    doc.setFontSize(baseFontSize + 4);
    doc.setFont(fontFamily, 'bold');
    doc.text(settings.storeName.toUpperCase(), centerX, y, { align: 'center' });
    y += 8;

    doc.setFontSize(baseFontSize);
    doc.text('CUPOM NÃO FISCAL - RECIBO DE VENDA', centerX, y, { align: 'center' });
    y += 6;
    doc.setFont(fontFamily, 'normal');
    doc.text(`Data: ${dateStr} - ${timeStr}`, margin, y);
    y += 5;
    doc.text(`Vendedor: ${seller}`, margin, y);
    y += 5;
    doc.line(margin, y, width - margin, y);
    y += 7;

    doc.setFont(fontFamily, 'bold');
    doc.text('ITEM', margin, y);
    doc.text('QTD', centerX, y, { align: 'center' });
    doc.text('PREÇO', width - margin, y, { align: 'right' });
    y += 5;
    doc.setFont(fontFamily, 'normal');

    items.forEach((item) => {
      const splitName = doc.splitTextToSize(item.product.name.toUpperCase(), width - 35);
      doc.text(splitName, margin, y);
      doc.text(item.quantity.toString(), centerX, y, { align: 'center' });
      doc.text(formatCurrency(item.product.salePrice * item.quantity), width - margin, y, { align: 'right' });
      y += (splitName.length * 4) + 1;
    });

    y += 2;
    doc.line(margin, y, width - margin, y);
    y += 8;
    
    doc.setFontSize(baseFontSize + 2);
    doc.setFont(fontFamily, 'bold');
    doc.text(`TOTAL:`, margin, y);
    doc.text(formatCurrency(total), width - margin, y, { align: 'right' });
    y += 7;

    doc.setFontSize(baseFontSize);
    doc.setFont(fontFamily, 'normal');
    doc.text(`PAGAMENTO: ${payment}`, margin, y);
    if (payment === 'Dinheiro' && change > 0) {
      y += 5;
      doc.text(`TROCO: ${formatCurrency(change)}`, margin, y);
    }
    
    y += 10;
    doc.setFontSize(baseFontSize - 1);
    doc.text('OBRIGADO PELA PREFERÊNCIA!', centerX, y, { align: 'center' });
    
    return doc;
  };

  const handleFinalizeSale = () => {
    if (cart.length === 0) return;

    const transactionId = Math.random().toString(36).substr(2, 9);
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
    setCart([]);
    setShowCheckoutModal(false);
    setAmountReceived(0);
    setShowSuccess(true);
  };

  const handleShareReceipt = async () => {
    try {
      const doc = generateReceiptPDF(
        lastTransactionItems, 
        lastSaleAmount, 
        lastPaymentMethod, 
        currentUser?.name || 'Sistema',
        changeDue
      );
      const pdfBlob = doc.output('blob');
      const fileName = `Recibo_Venda_${lastPaymentMethod}.pdf`;
      const file = new File([pdfBlob], fileName, { type: 'application/pdf' });

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: `Recibo de Venda - ${settings.storeName}`,
          text: `Recibo da sua compra em ${settings.storeName}`,
        });
      } else {
        doc.save(fileName);
        alert('Recibo baixado com sucesso!');
      }
    } catch (error) {
      console.error('Erro ao gerar recibo:', error);
      alert('Não foi possível gerar o recibo.');
    }
  };

  const getFilteredSales = () => {
    const today = new Date().toISOString().split('T')[0];
    const currentMonth = new Date().toISOString().slice(0, 7);

    return sales.filter(s => {
      const saleDate = s.date.split('T')[0];
      const matchesSearch = s.productName.toLowerCase().includes(historySearch.toLowerCase()) || formatDate(s.date).includes(historySearch);
      
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

  const generateSalesReportPDF = (filteredSalesList: Sale[]) => {
    const baseFontSize = settings.pdfFontSize || 8;
    const fontFamily = settings.pdfFontFamily || 'helvetica';
    const width = settings.pdfPaperWidth || 80;
    const margin = 5;
    const centerX = width / 2;
    const textColor = settings.pdfTextColor || '#000000';
    const bgColor = settings.pdfBgColor || '#FFFFFF';

    const estimatedHeight = 100 + (filteredSalesList.length * 15);
    const doc = new jsPDF({
      orientation: 'p',
      unit: 'mm',
      format: [width, estimatedHeight]
    });

    doc.setFillColor(bgColor);
    doc.rect(0, 0, width, estimatedHeight, 'F');
    doc.setTextColor(textColor);
    doc.setFont(fontFamily, 'normal');

    let y = 10;
    doc.setFontSize(baseFontSize + 4);
    doc.setFont(fontFamily, 'bold');
    doc.text(settings.storeName.toUpperCase(), centerX, y, { align: 'center' });
    y += 8;

    doc.setFontSize(baseFontSize);
    const periodLabel = historyFilter === 'today' ? 'DIÁRIO' : historyFilter === 'month' ? 'MENSAL' : 'GERAL';
    doc.text(`RELATÓRIO DE VENDAS - ${periodLabel}`, centerX, y, { align: 'center' });
    y += 5;
    doc.setFont(fontFamily, 'normal');
    doc.text(`Emitido em: ${new Date().toLocaleString('pt-BR')}`, centerX, y, { align: 'center' });
    y += 5;
    doc.line(margin, y, width - margin, y);
    y += 7;

    let totalRevenue = 0;
    filteredSalesList.forEach((sale) => {
      doc.setFont(fontFamily, 'bold');
      doc.text(sale.productName.toUpperCase(), margin, y);
      y += 4;
      doc.setFont(fontFamily, 'normal');
      doc.text(`${formatDate(sale.date)} | Qtd: ${sale.quantity}`, margin, y);
      doc.setFont(fontFamily, 'bold');
      doc.text(formatCurrency(sale.finalPrice), width - margin, y, { align: 'right' });
      y += 6;
      totalRevenue += sale.finalPrice;
    });

    y += 2;
    doc.line(margin, y, width - margin, y);
    y += 8;
    doc.setFontSize(baseFontSize + 2);
    doc.text(`TOTAL RECEBIDO:`, margin, y);
    doc.text(formatCurrency(totalRevenue), width - margin, y, { align: 'right' });
    
    return doc;
  };

  const shareSalesReport = async () => {
    if (filteredSales.length === 0) return alert('Nenhuma venda no período para gerar relatório.');
    
    try {
      const doc = generateSalesReportPDF(filteredSales);
      const pdfBlob = doc.output('blob');
      const fileName = `Relatorio_Vendas_${historyFilter}.pdf`;
      const file = new File([pdfBlob], fileName, { type: 'application/pdf' });

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: `Relatório de Vendas - ${settings.storeName}`,
          text: `Confira o relatório de vendas do período.`,
        });
      } else {
        doc.save(fileName);
        alert('O PDF foi baixado. Agora você pode enviá-lo manualmente pelo WhatsApp.');
      }
    } catch (error) {
      console.error('Erro ao compartilhar relatório:', error);
      alert('Não foi possível compartilhar o relatório.');
    }
  };

  if (showHistory) {
    return (
      <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300 pb-20">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setShowHistory(false)}
              className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-600 active:scale-90"
            >
              <ArrowLeft size={24} />
            </button>
            <h2 className="text-2xl font-black text-slate-800">Histórico</h2>
          </div>
          
          <button 
            onClick={shareSalesReport}
            className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest shadow-lg shadow-green-100 active:scale-95"
          >
            <MessageCircle size={16} /> Relatório PDF
          </button>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
          <button onClick={() => setHistoryFilter('all')} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 border transition-all shrink-0 ${historyFilter === 'all' ? 'bg-slate-900 border-slate-900 text-white' : 'bg-white border-slate-200 text-slate-400'}`}><Layers size={14} /> Tudo</button>
          <button onClick={() => setHistoryFilter('today')} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 border transition-all shrink-0 ${historyFilter === 'today' ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-100' : 'bg-white border-slate-200 text-slate-400'}`}><Calendar size={14} /> Hoje</button>
          <button onClick={() => setHistoryFilter('month')} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 border transition-all shrink-0 ${historyFilter === 'month' ? 'bg-emerald-600 border-emerald-600 text-white shadow-lg shadow-emerald-100' : 'bg-white border-slate-200 text-slate-400'}`}><History size={14} /> Este Mês</button>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input type="text" placeholder="Buscar produto ou data..." className="w-full pl-10 pr-4 py-4 bg-white border border-slate-200 rounded-2xl focus:ring-4 focus:ring-blue-500/10 outline-none shadow-sm text-sm font-bold" value={historySearch} onChange={(e) => setHistorySearch(e.target.value)} />
        </div>

        <div className="space-y-3">
          {filteredSales.length > 0 ? (
            filteredSales.map(sale => (
              <div key={sale.id} className="bg-white flex items-center justify-between p-4 border border-slate-100 rounded-3xl shadow-sm hover:shadow-md transition-all gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center shrink-0 border border-emerald-100"><ShoppingBag size={28} /></div>
                  <div>
                    <h4 className="font-black text-slate-800 text-sm leading-tight uppercase">{sale.productName}</h4>
                    <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mt-0.5">{formatDate(sale.date)} • Qtd: {sale.quantity}</p>
                    <p className="text-[9px] text-slate-300 font-black uppercase tracking-tighter">{sale.paymentMethod} • {sale.sellerName}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-lg font-black text-emerald-600 leading-none">{formatCurrency(sale.finalPrice)}</p>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-20 bg-white rounded-[40px] border border-dashed border-slate-200">
              <History className="mx-auto text-slate-200 mb-4" size={56} />
              <p className="text-slate-400 font-bold uppercase tracking-[0.2em] text-[10px]">Sem registros no período</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-24 md:pb-6">
      <div className="flex items-center justify-between relative">
        <h2 className="text-2xl font-black text-slate-800 flex items-center gap-3">
          <div className="p-2 bg-emerald-600 text-white rounded-xl shadow-lg shadow-emerald-200"><ShoppingCart size={24} /></div>
          Vendas
        </h2>
        <div className="relative">
          <button onClick={() => setShowMenu(!showMenu)} className="p-3 hover:bg-white border border-transparent hover:border-slate-200 rounded-2xl transition-all text-slate-500 active:scale-95"><MoreVertical size={24} /></button>
          {showMenu && (
            <div className="absolute right-0 mt-2 w-64 bg-white border border-slate-200 rounded-3xl shadow-2xl z-50 py-3 animate-in fade-in zoom-in-95 duration-200 overflow-hidden">
              <button onClick={() => { setShowHistory(true); setShowMenu(false); }} className="w-full flex items-center gap-3 px-5 py-4 text-sm font-black text-slate-700 hover:bg-slate-50 transition-colors uppercase tracking-tight">
                <div className="p-2 bg-slate-100 text-slate-500 rounded-xl"><History size={18} /></div>
                Histórico de Vendas
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
            <input type="text" placeholder="Nome do produto..." className="w-full pl-12 pr-4 py-5 bg-white border border-slate-200 rounded-[2.5rem] focus:ring-4 focus:ring-emerald-500/10 outline-none shadow-sm text-lg font-black placeholder:text-slate-200" value={productSearch} onChange={(e) => setProductSearch(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {filteredProducts.length > 0 ? filteredProducts.map(product => (
              <button key={product.id} onClick={() => addToCart(product)} className="bg-white border border-slate-200 rounded-[2rem] overflow-hidden shadow-sm hover:shadow-xl hover:border-emerald-500/50 transition-all text-left flex flex-col group active:scale-95">
                <div className="aspect-square bg-slate-50 relative overflow-hidden p-2">
                  {product.photo ? <img src={product.photo} className="w-full h-full object-contain transition-transform group-hover:scale-110 duration-500" /> : <div className="w-full h-full flex items-center justify-center text-slate-200"><Package size={48} /></div>}
                  <div className="absolute top-3 right-3 bg-slate-900 text-white text-[9px] font-black px-2 py-1 rounded-lg shadow-sm uppercase tracking-widest">{product.quantity} un.</div>
                </div>
                <div className="p-4 bg-white border-t border-slate-50">
                  <h3 className="font-black text-slate-800 text-[11px] uppercase truncate mb-1">{product.name}</h3>
                  <p className="text-emerald-600 font-black text-xl">{formatCurrency(product.salePrice)}</p>
                </div>
              </button>
            )) : <div className="col-span-full py-24 text-center bg-white rounded-[40px] border border-dashed border-slate-200"><Package className="mx-auto text-slate-100 mb-4" size={80} /><p className="text-slate-300 font-black uppercase tracking-[0.25em] text-xs">Produto não encontrado</p></div>}
          </div>
        </div>

        <div className="lg:col-span-1">
          <div className="bg-white border border-slate-200 rounded-[2.5rem] shadow-xl overflow-hidden flex flex-col h-full min-h-[500px] sticky top-20">
            <div className="p-6 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-black text-slate-800 flex items-center gap-2 uppercase tracking-tight">
                <ShoppingCart size={18} className="text-emerald-600" /> Carrinho
                <span className="bg-emerald-600 text-white text-[10px] px-2 py-0.5 rounded-full ml-1">{cart.reduce((acc, i) => acc + i.quantity, 0)}</span>
              </h3>
              {cart.length > 0 && <button onClick={() => setCart([])} className="text-[10px] font-black text-red-500 uppercase tracking-widest hover:underline">Limpar</button>}
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {cart.length > 0 ? cart.map(item => (
                <div key={item.product.id} className="flex items-center gap-3 bg-slate-50/50 p-3 rounded-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-200">
                  <div className="w-12 h-12 bg-white rounded-xl overflow-hidden shrink-0 border border-slate-200">{item.product.photo ? <img src={item.product.photo} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-slate-300"><Package size={16} /></div>}</div>
                  <div className="flex-1 min-w-0"><h4 className="text-[11px] font-black text-slate-800 uppercase truncate">{item.product.name}</h4><p className="text-xs font-bold text-emerald-600">{formatCurrency(item.product.salePrice)}</p></div>
                  <div className="flex flex-col items-center gap-1">
                    <div className="flex items-center gap-2 bg-white rounded-lg border border-slate-200 p-1"><button onClick={() => updateCartQuantity(item.product.id, -1)} className="p-1 text-slate-400 hover:text-red-500"><Minus size={12} /></button><span className="text-xs font-black text-slate-700 w-4 text-center">{item.quantity}</span><button onClick={() => updateCartQuantity(item.product.id, 1)} className="p-1 text-slate-400 hover:text-emerald-600"><Plus size={12} /></button></div>
                    <button onClick={() => removeFromCart(item.product.id)} className="text-[9px] font-black text-red-400 uppercase tracking-tighter">Remover</button>
                  </div>
                </div>
              )) : <div className="h-full flex flex-col items-center justify-center text-center py-10"><ShoppingBag size={48} className="text-slate-100 mb-2" /><p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em]">Seu carrinho está vazio</p></div>}
            </div>
            <div className="p-6 bg-slate-900 space-y-4">
              <div className="flex justify-between items-center text-white"><span className="text-[10px] font-black uppercase tracking-[0.3em] opacity-60">Total Venda</span><span className="text-2xl font-black text-emerald-400">{formatCurrency(cartTotal)}</span></div>
              <button disabled={cart.length === 0} onClick={() => setShowCheckoutModal(true)} className="w-full py-4 bg-emerald-600 text-white rounded-[1.5rem] font-black shadow-xl shadow-emerald-900/50 hover:bg-emerald-700 active:scale-95 transition-all uppercase text-xs tracking-widest disabled:opacity-50 disabled:active:scale-100">Fechar Pedido</button>
            </div>
          </div>
        </div>
      </div>

      {showCheckoutModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-md rounded-[40px] shadow-2xl overflow-hidden animate-in slide-in-from-bottom-8 duration-300">
            <div className="p-8 border-b border-slate-50 flex items-center justify-between bg-emerald-50/30">
              <h3 className="text-xl font-black text-slate-800 flex items-center gap-3 uppercase tracking-tight"><Calculator className="text-emerald-600" size={28} /> Checkout & Troco</h3>
              <button onClick={() => { setShowCheckoutModal(false); setAmountReceived(0); }} className="text-slate-400 hover:text-slate-600 p-2 active:scale-90 transition-transform"><X size={28} /></button>
            </div>
            
            <div className="p-8 space-y-6 max-h-[60vh] overflow-y-auto">
              <div className="bg-slate-50 rounded-3xl p-6 border border-slate-100 space-y-3">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Valor Total da Venda</p>
                <p className="text-4xl font-black text-slate-800 text-center tracking-tighter">{formatCurrency(cartTotal)}</p>
              </div>

              <div className="space-y-3">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Método de Pagamento</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: 'Dinheiro', icon: <Coins size={14} /> },
                    { id: 'Cartão de Crédito', icon: <CreditCard size={14} /> },
                    { id: 'Cartão de Débito', icon: <CreditCard size={14} /> },
                    { id: 'PIX', icon: <WalletIcon size={14} /> }
                  ].map(method => (
                    <button 
                      key={method.id}
                      onClick={() => setSelectedPaymentMethod(method.id as any)}
                      className={`flex items-center gap-2 px-4 py-3 rounded-2xl text-[10px] font-black uppercase tracking-tight border transition-all ${selectedPaymentMethod === method.id ? 'bg-emerald-600 border-emerald-600 text-white shadow-lg' : 'bg-white border-slate-100 text-slate-400'}`}
                    >
                      {method.icon} {method.id}
                    </button>
                  ))}
                </div>
              </div>

              {selectedPaymentMethod === 'Dinheiro' && (
                <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1 flex items-center gap-2"><DollarSign size={14} className="text-emerald-500" /> Valor Pago pelo Cliente</label>
                  <input autoFocus value={formatCurrency(amountReceived).replace('R$', '').trim()} onChange={(e) => setAmountReceived(parseCurrencyString(e.target.value))} className="w-full px-6 py-6 bg-slate-50 border-2 border-emerald-100 rounded-[2rem] text-center font-black text-emerald-700 outline-none focus:border-emerald-500 transition-all text-3xl shadow-inner" placeholder="0,00" />
                  <div className="flex gap-2 justify-center pt-2">{[10, 20, 50, 100].map(val => (<button key={val} onClick={() => setAmountReceived(val)} className="px-3 py-1 bg-white border border-slate-200 rounded-full text-[10px] font-black text-slate-400 hover:bg-emerald-50 hover:text-emerald-600 hover:border-emerald-200 transition-all">R$ {val}</button>))}<button onClick={() => setAmountReceived(cartTotal)} className="px-3 py-1 bg-emerald-100 border border-emerald-200 rounded-full text-[10px] font-black text-emerald-700">Valor Exato</button></div>
                  <div className={`p-6 rounded-[2.5rem] transition-all duration-500 border-2 mt-4 ${amountReceived >= cartTotal ? 'bg-emerald-900 border-emerald-500 shadow-2xl shadow-emerald-900/40' : 'bg-slate-100 border-slate-200'}`}>
                    <p className={`text-[10px] font-black uppercase tracking-[0.3em] text-center mb-1 ${amountReceived >= cartTotal ? 'text-emerald-400' : 'text-slate-400'}`}>Troco a Devolver</p>
                    <p className={`text-4xl font-black text-center tracking-tighter ${amountReceived >= cartTotal ? 'text-white' : 'text-slate-300'}`}>{formatCurrency(changeDue)}</p>
                  </div>
                </div>
              )}
            </div>

            <div className="p-8 bg-slate-50 flex gap-4 border-t border-slate-100">
              <button onClick={() => { setShowCheckoutModal(false); setAmountReceived(0); }} className="flex-1 py-4 font-black text-slate-400 bg-white border-2 border-slate-100 rounded-[1.5rem] hover:bg-slate-50 transition-all uppercase text-xs">Voltar</button>
              <button disabled={selectedPaymentMethod === 'Dinheiro' && amountReceived < cartTotal} onClick={handleFinalizeSale} className="flex-1 py-5 font-black text-white bg-emerald-600 rounded-[1.5rem] shadow-xl shadow-emerald-200 hover:bg-emerald-700 active:scale-95 transition-all uppercase text-xs tracking-widest disabled:opacity-50 disabled:grayscale disabled:active:scale-100">Concluir Venda</button>
            </div>
          </div>
        </div>
      )}

      {showSuccess && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[60] p-6 backdrop-blur-xl animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-sm rounded-[40px] shadow-2xl p-10 text-center animate-in zoom-in-95 duration-300">
            <div className="w-24 h-24 bg-emerald-100 text-emerald-600 rounded-[2.5rem] flex items-center justify-center mx-auto mb-8 shadow-lg shadow-emerald-100 border-4 border-white"><CheckCircle2 size={56} strokeWidth={2.5} /></div>
            <h3 className="text-3xl font-black text-slate-800 mb-3 tracking-tight uppercase">Venda Finalizada!</h3>
            <p className="text-slate-500 font-bold mb-8 text-sm uppercase tracking-wider">Recibo processado com sucesso</p>
            <div className="bg-emerald-50 rounded-[2rem] p-6 mb-8 border border-emerald-100">
              <span className="block text-[10px] font-black text-emerald-700 uppercase tracking-[0.3em] mb-2">Total Recebido</span>
              <span className="text-4xl font-black text-emerald-600 tracking-tighter">{formatCurrency(lastSaleAmount)}</span>
            </div>
            <div className="flex flex-col gap-3">
              <button onClick={handleShareReceipt} className="w-full py-4 bg-emerald-600 text-white font-black rounded-[2rem] shadow-lg shadow-emerald-100 hover:bg-emerald-700 active:scale-95 transition-all uppercase text-xs tracking-[0.2em] flex items-center justify-center gap-2"><FileText size={18} /> Gerar Recibo (PDF)</button>
              <button onClick={() => setShowSuccess(false)} className="w-full py-4 bg-slate-900 text-white font-black rounded-[2rem] shadow-2xl shadow-slate-900/30 hover:bg-slate-800 active:scale-95 transition-all uppercase text-xs tracking-[0.2em]">Concluir</button>
            </div>
          </div>
        </div>
      )}

      {showMenu && <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />}
    </div>
  );
};

export default SalesTab;
