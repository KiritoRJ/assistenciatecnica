import React, { useState, useEffect, useRef } from 'react';
import { Search, ShoppingBag, MessageCircle, ArrowLeft, Loader2, Image as ImageIcon, Tag, Share2, Star, ChevronDown, Home, FileText, User, PlayCircle, Heart, MoreVertical, Volume2, VolumeX, Plus, Music, Bookmark, Send } from 'lucide-react';
import { Product, AppSettings } from '../types';
import { OnlineDB } from '../utils/api';

interface CustomerCatalogProps {
  tenantId?: string | null;
  catalogSlug?: string | null;
}

const CustomerCatalog: React.FC<CustomerCatalogProps> = ({ tenantId, catalogSlug }) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeProductIndex, setActiveProductIndex] = useState(0);
  const [isMuted, setIsMuted] = useState(true);
  const [likedProducts, setLikedProducts] = useState<Record<string, boolean>>({});
  const [savedProducts, setSavedProducts] = useState<Record<string, boolean>>({});
  const [likeCounts, setLikeCounts] = useState<Record<string, number>>({});
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const loadCatalog = async () => {
      try {
        let activeTenantId = tenantId;
        
        if (catalogSlug) {
          activeTenantId = await OnlineDB.getTenantIdBySlug(catalogSlug);
        }
        
        if (activeTenantId) {
          const data = await OnlineDB.getPublicCatalog(activeTenantId);
          if (data) {
            setSettings(data.settings);
            setProducts(data.products.filter(p => p.quantity > 0));
            
            // Initialize random like counts for demo feel
            const initialLikes: Record<string, number> = {};
            data.products.forEach(p => {
              initialLikes[p.id] = Math.floor(Math.random() * 100) + 10;
            });
            setLikeCounts(initialLikes);
          }
        }
      } catch (e) {
        console.error("Erro ao carregar catálogo:", e);
      } finally {
        setLoading(false);
      }
    };
    loadCatalog();
  }, [tenantId, catalogSlug]);

  const handleScroll = () => {
    if (containerRef.current) {
      // Simple debounce/threshold to prevent rapid state updates during scroll
      const index = Math.round(containerRef.current.scrollTop / window.innerHeight);
      if (index !== activeProductIndex) {
        // Only update if we are clearly snapped to a new item
        const diff = Math.abs(containerRef.current.scrollTop - (index * window.innerHeight));
        if (diff < 50) { // Threshold to confirm snap
           setActiveProductIndex(index);
        }
      }
    }
  };

  const handleLike = (e: React.MouseEvent, productId: string) => {
    e.stopPropagation();
    const isLiked = likedProducts[productId];
    setLikedProducts(prev => ({ ...prev, [productId]: !isLiked }));
    setLikeCounts(prev => ({
      ...prev,
      [productId]: (prev[productId] || 0) + (isLiked ? -1 : 1)
    }));
  };

  const handleSave = (e: React.MouseEvent, productId: string) => {
    e.stopPropagation();
    setSavedProducts(prev => ({ ...prev, [productId]: !prev[productId] }));
  };

  const handleWhatsAppClick = (product: Product) => {
    if (!settings?.storePhone) {
      alert("O lojista não configurou um número de WhatsApp.");
      return;
    }
    const phone = settings.storePhone.replace(/\D/g, '');
    const price = product.isPromotion && product.promotionalPrice ? product.promotionalPrice : product.salePrice;
    const message = encodeURIComponent(`Olá! Vi o produto *${product.name}* no seu catálogo e tenho interesse.`);
    window.open(`https://wa.me/55${phone}?text=${message}`, '_blank');
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: settings?.storeName || 'Catálogo Online',
        text: 'Confira este produto incrível!',
        url: window.location.href,
      }).catch(console.error);
    } else {
      navigator.clipboard.writeText(window.location.href);
      alert('Link copiado!');
    }
  };

  const getEmbedUrl = (url: string, shouldPlay: boolean) => {
    if (url.includes('youtube.com') || url.includes('youtu.be')) {
      const videoId = url.includes('v=') ? url.split('v=')[1].split('&')[0] : url.split('/').pop();
      return `https://www.youtube.com/embed/${videoId}?autoplay=${shouldPlay ? 1 : 0}&mute=${isMuted ? 1 : 0}&controls=0&loop=1&playlist=${videoId}`;
    }
    return url;
  };

  if (loading) {
    return (
      <div className="h-screen bg-black flex flex-col items-center justify-center">
        <Loader2 size={48} className="animate-spin text-white mb-4" />
      </div>
    );
  }

  if (!settings || products.length === 0) {
    return (
      <div className="h-screen bg-black flex flex-col items-center justify-center p-6 text-center text-white">
        <ShoppingBag size={64} className="text-zinc-700 mb-6" />
        <h1 className="text-xl font-bold mb-2">Nenhum produto encontrado</h1>
      </div>
    );
  }

  return (
    <div className="h-screen w-full bg-black text-white overflow-hidden relative font-sans">
      {/* Top Bar - TikTok Style */}
      <div className="absolute top-0 left-0 right-0 z-20 pt-8 pb-4 px-4 flex justify-between items-center bg-gradient-to-b from-black/60 to-transparent pointer-events-none">
        <div className="w-8"></div> {/* Spacer */}
        <div className="flex items-center gap-4 text-base font-bold shadow-black drop-shadow-md pointer-events-auto">
           <span className="text-white/60 cursor-pointer hover:text-white transition-colors">Seguindo</span>
           <span className="text-white border-b-2 border-white pb-1 cursor-pointer">Para Você</span>
        </div>
        <button className="pointer-events-auto">
           <Search size={24} className="text-white" />
        </button>
      </div>

      {/* Feed Container */}
      <div 
        ref={containerRef}
        onScroll={handleScroll}
        className="h-full w-full overflow-y-scroll snap-y snap-mandatory hide-scrollbar [&::-webkit-scrollbar]:hidden"
      >
        {products.map((product, index) => {
          const currentPrice = product.isPromotion && product.promotionalPrice ? product.promotionalPrice : product.salePrice;
          const isActive = index === activeProductIndex;
          const hasVideo = !!product.videoUrl;
          const isLiked = likedProducts[product.id];
          const isSaved = savedProducts[product.id];
          const likes = likeCounts[product.id] || 0;

          return (
            <div key={product.id} className="h-full w-full snap-start relative flex items-center justify-center bg-zinc-900">
              {/* Media Layer */}
              <div className="absolute inset-0 z-0" onClick={() => setIsMuted(!isMuted)}>
                {hasVideo ? (
                  <iframe 
                    src={getEmbedUrl(product.videoUrl!, isActive)} 
                    className="w-full h-full object-cover pointer-events-none scale-[1.35]"
                    allow="autoplay; encrypted-media"
                  />
                ) : product.photo ? (
                  <img src={product.photo} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-zinc-800">
                    <ImageIcon size={64} className="text-zinc-600" />
                  </div>
                )}
                {/* Dark Gradient Overlay */}
                <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/80" />
              </div>

              {/* Right Sidebar Actions */}
              <div className="absolute right-2 bottom-20 z-20 flex flex-col gap-4 items-center pb-4">
                {/* Profile/Store Avatar */}
                <div className="relative mb-2">
                  <div className="w-12 h-12 rounded-full border border-white p-0.5 overflow-hidden bg-black">
                    {settings.logoUrl ? <img src={settings.logoUrl} className="w-full h-full object-cover rounded-full" /> : <div className="w-full h-full bg-zinc-800" />}
                  </div>
                  <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-red-500 rounded-full p-0.5">
                    <Plus size={12} className="text-white" />
                  </div>
                </div>

                {/* Like Button */}
                <div className="flex flex-col items-center gap-1">
                  <button onClick={(e) => handleLike(e, product.id)} className="active:scale-90 transition-transform">
                    <Heart size={32} className={`${isLiked ? 'fill-red-500 text-red-500' : 'text-white'} drop-shadow-md`} />
                  </button>
                  <span className="text-xs font-bold shadow-black drop-shadow-md">{likes}</span>
                </div>
                
                {/* Comment/WhatsApp Button */}
                <div className="flex flex-col items-center gap-1">
                  <button onClick={() => handleWhatsAppClick(product)} className="active:scale-90 transition-transform">
                    <MessageCircle size={32} className="text-white drop-shadow-md" />
                  </button>
                  <span className="text-xs font-bold shadow-black drop-shadow-md">Comprar</span>
                </div>

                {/* Bookmark Button */}
                <div className="flex flex-col items-center gap-1">
                  <button onClick={(e) => handleSave(e, product.id)} className="active:scale-90 transition-transform">
                    <Bookmark size={32} className={`${isSaved ? 'fill-orange-500 text-orange-500' : 'text-white'} drop-shadow-md`} />
                  </button>
                  <span className="text-xs font-bold shadow-black drop-shadow-md">Salvar</span>
                </div>

                {/* Share Button */}
                <div className="flex flex-col items-center gap-1">
                  <button onClick={handleShare} className="active:scale-90 transition-transform">
                    <Share2 size={32} className="text-white drop-shadow-md" />
                  </button>
                  <span className="text-xs font-bold shadow-black drop-shadow-md">Comp.</span>
                </div>

                {/* Rotating Disc */}
                <div className="mt-4 animate-[spin_5s_linear_infinite]">
                  <div className="w-12 h-12 bg-zinc-800 rounded-full border-4 border-zinc-900 flex items-center justify-center overflow-hidden">
                    {settings.logoUrl ? <img src={settings.logoUrl} className="w-full h-full object-cover rounded-full" /> : <Music size={20} />}
                  </div>
                </div>
              </div>

              {/* Bottom Info Layer */}
              <div className="absolute bottom-0 left-0 right-16 p-4 pb-20 z-20 flex flex-col gap-2 text-left">
                <h3 className="font-bold text-white text-lg shadow-black drop-shadow-md">@{settings.catalogSlug || catalogSlug || settings.storeName.replace(/\s+/g, '').toLowerCase()}</h3>
                
                <div className="space-y-1">
                  <p className="text-sm text-white/90 leading-snug line-clamp-2 drop-shadow-md">
                    {product.name} - {product.description || 'Confira este produto incrível!'}
                  </p>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-xl font-black text-emerald-400 drop-shadow-md">R$ {currentPrice.toFixed(2).replace('.', ',')}</span>
                    {product.isPromotion && (
                       <span className="bg-red-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">Promo</span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 mt-2">
                  <Music size={14} className="text-white animate-pulse" />
                  <div className="text-xs font-medium text-white truncate w-48">
                    Som original - {settings.storeName}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Bottom Navigation */}
      <div className="absolute bottom-0 left-0 right-0 bg-black border-t border-white/10 py-3 px-2 flex justify-between items-center z-30">
        <button className="flex flex-col items-center gap-1 text-white w-1/5">
          <Home size={24} className="drop-shadow-md" />
          <span className="text-[10px] font-medium">Início</span>
        </button>
        <button className="flex flex-col items-center gap-1 text-white/60 w-1/5 hover:text-white transition-colors">
          <Search size={24} />
          <span className="text-[10px] font-medium">Busca</span>
        </button>
        <div className="w-1/5 flex justify-center">
          <button className="w-12 h-8 bg-gradient-to-r from-cyan-400 to-red-500 rounded-lg flex items-center justify-center relative group active:scale-95 transition-transform">
             <div className="absolute inset-x-1 inset-y-0 bg-white rounded-md flex items-center justify-center">
                <Plus size={16} className="text-black" />
             </div>
          </button>
        </div>
        <button className="flex flex-col items-center gap-1 text-white/60 w-1/5 hover:text-white transition-colors">
          <MessageCircle size={24} />
          <span className="text-[10px] font-medium">Entrada</span>
        </button>
        <button className="flex flex-col items-center gap-1 text-white/60 w-1/5 hover:text-white transition-colors">
          <User size={24} />
          <span className="text-[10px] font-medium">Perfil</span>
        </button>
      </div>
    </div>
  );
};

export default CustomerCatalog;
