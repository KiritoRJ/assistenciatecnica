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
  const [viewMode, setViewMode] = useState<'feed' | 'grid' | 'profile'>('grid');
  const [activeProductIndex, setActiveProductIndex] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [playingStates, setPlayingStates] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setActiveProductIndex(0);
    if (containerRef.current) {
      containerRef.current.scrollTop = 0;
    }
  }, [searchQuery]);

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    (p.barcode && p.barcode.includes(searchQuery))
  );

  const displayProducts = searchQuery ? filteredProducts : products;
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

  const toggleVideo = (productId: string) => {
    const iframe = document.getElementById(`iframe-${productId}`) as HTMLIFrameElement;
    if (iframe && iframe.contentWindow) {
      const isPlaying = playingStates[productId] ?? true;
      const command = isPlaying ? 'pauseVideo' : 'playVideo';
      iframe.contentWindow.postMessage(JSON.stringify({ event: 'command', func: command, args: '' }), '*');
      
      if (!isPlaying) {
        iframe.contentWindow.postMessage(JSON.stringify({ event: 'command', func: 'unMute', args: '' }), '*');
        setIsMuted(false);
      }
      
      setPlayingStates(prev => ({ ...prev, [productId]: !isPlaying }));
    }
  };

  const getEmbedUrl = (url: string, shouldPlay: boolean) => {
    if (!url) return '';
    
    // YouTube (Standard & Shorts)
    if (url.includes('youtube.com') || url.includes('youtu.be')) {
      let videoId = '';
      if (url.includes('shorts/')) {
        videoId = url.split('shorts/')[1].split('?')[0];
      } else if (url.includes('v=')) {
        videoId = url.split('v=')[1].split('&')[0];
      } else {
        videoId = url.split('/').pop() || '';
      }
      return `https://www.youtube.com/embed/${videoId}?autoplay=${shouldPlay ? 1 : 0}&mute=${isMuted ? 1 : 0}&controls=0&loop=1&playlist=${videoId}&playsinline=1&rel=0&enablejsapi=1`;
    }
    
    // TikTok
    if (url.includes('tiktok.com')) {
      // Extract video ID from TikTok URL (usually the last numeric part)
      const videoId = url.split('/video/')[1]?.split('?')[0] || '';
      if (videoId) {
        return `https://www.tiktok.com/embed/v2/${videoId}?lang=pt-BR&autoplay=${shouldPlay ? 1 : 0}`;
      }
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
    <div className="fixed inset-0 w-full bg-black text-white overflow-hidden font-sans">
      {/* Top Bar - TikTok Style */}
      {viewMode !== 'profile' && (
      <div className="absolute top-0 left-0 right-0 z-20 pt-8 pb-4 px-4 flex justify-between items-center bg-gradient-to-b from-black/60 to-transparent pointer-events-none">
        
        {isSearchOpen ? (
          <div className="w-full flex items-center gap-2 pointer-events-auto bg-black/50 backdrop-blur-md rounded-full px-4 py-2 border border-white/10">
            <Search size={18} className="text-white/60" />
            <input 
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar produto..."
              className="bg-transparent border-none outline-none text-white text-sm w-full placeholder:text-white/40"
              autoFocus
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')}>
                <VolumeX size={16} className="text-white/60 rotate-45" />
              </button>
            )}
            <button onClick={() => {
              setIsSearchOpen(false);
              setSearchQuery('');
            }} className="text-xs font-bold text-white ml-2">
              Cancelar
            </button>
          </div>
        ) : (
          <>
            <div className="w-8"></div> {/* Spacer */}
            <div className="flex items-center gap-4 text-base font-bold shadow-black drop-shadow-md pointer-events-auto">
               <span 
                 onClick={() => {
                   setViewMode('grid');
                   // Pause current video when switching tabs
                   const currentProduct = displayProducts[activeProductIndex];
                   if (currentProduct) {
                     const iframe = document.getElementById(`iframe-${currentProduct.id}`) as HTMLIFrameElement;
                     if (iframe && iframe.contentWindow) {
                       iframe.contentWindow.postMessage(JSON.stringify({ 
                         event: 'command', 
                         func: 'pauseVideo', 
                         args: '' 
                       }), '*');
                       setPlayingStates(prev => ({ ...prev, [currentProduct.id]: false }));
                     }
                   }
                 }}
                 className={`${viewMode === 'grid' ? 'text-white border-b-2 border-white pb-1' : 'text-white/60 hover:text-white'} cursor-pointer transition-all`}
               >
                 Todos
               </span>
               <span 
                 onClick={() => {
                   setViewMode('feed');
                   // Auto-play current video when switching to feed
                   const currentProduct = displayProducts[activeProductIndex];
                   if (currentProduct) {
                     const iframe = document.getElementById(`iframe-${currentProduct.id}`) as HTMLIFrameElement;
                     if (iframe && iframe.contentWindow) {
                       iframe.contentWindow.postMessage(JSON.stringify({ 
                         event: 'command', 
                         func: 'playVideo', 
                         args: '' 
                       }), '*');
                       iframe.contentWindow.postMessage(JSON.stringify({ 
                         event: 'command', 
                         func: 'unMute', 
                         args: '' 
                       }), '*');
                     }
                     setPlayingStates(prev => ({ ...prev, [currentProduct.id]: true }));
                     setIsMuted(false);
                   }
                 }}
                 className={`${viewMode === 'feed' ? 'text-white border-b-2 border-white pb-1' : 'text-white/60 hover:text-white'} cursor-pointer transition-all`}
               >
                 Vídeos
               </span>
            </div>
            <button 
              onClick={() => {
                setIsSearchOpen(true);
                setViewMode('grid');
              }}
              className="pointer-events-auto"
            >
               <Search size={24} className="text-white" />
            </button>
          </>
        )}
      </div>
      )}

      {/* Profile View */}
      {viewMode === 'profile' && settings && (
        <div className="h-full w-full bg-black flex flex-col items-center pt-20 px-6 text-center overflow-y-auto pb-24">
          <div className="w-32 h-32 rounded-full border-2 border-white/20 overflow-hidden mb-6 bg-zinc-900">
            {settings.logoUrl ? (
              <img src={settings.logoUrl} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <ShoppingBag size={48} className="text-zinc-600" />
              </div>
            )}
          </div>
          
          <h1 className="text-2xl font-bold text-white mb-2">{settings.storeName}</h1>
          <p className="text-zinc-400 text-sm mb-8">@{settings.catalogSlug || catalogSlug || settings.storeName.replace(/\s+/g, '').toLowerCase()}</p>
          
          <div className="w-full max-w-xs space-y-4">
            {settings.storePhone && (
              <div className="bg-zinc-900/50 p-4 rounded-xl flex items-center gap-4 border border-white/5">
                <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center">
                  <MessageCircle size={20} className="text-emerald-500" />
                </div>
                <div className="text-left">
                  <p className="text-xs text-zinc-500 font-medium uppercase">WhatsApp</p>
                  <p className="text-white font-medium">{settings.storePhone}</p>
                </div>
              </div>
            )}
            
            {settings.storeAddress && (
              <div className="bg-zinc-900/50 p-4 rounded-xl flex items-center gap-4 border border-white/5">
                <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center">
                  <Home size={20} className="text-blue-500" />
                </div>
                <div className="text-left">
                  <p className="text-xs text-zinc-500 font-medium uppercase">Endereço</p>
                  <p className="text-white font-medium">{settings.storeAddress}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Grid View */}
      {viewMode === 'grid' && (
        <div className="h-full w-full overflow-y-auto bg-black pt-24 pb-24 px-2">
          {displayProducts.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-zinc-500">
              <Search size={48} className="mb-4 opacity-50" />
              <p>Nenhum produto encontrado</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {displayProducts.map((product) => (
                <div 
                  key={product.id} 
                  onClick={() => {
                    const index = displayProducts.findIndex(p => p.id === product.id);
                    setActiveProductIndex(index);
                    setViewMode('feed');
                    
                    // Force play via postMessage
                    setTimeout(() => {
                      const iframe = document.getElementById(`iframe-${product.id}`) as HTMLIFrameElement;
                      if (iframe && iframe.contentWindow) {
                        iframe.contentWindow.postMessage(JSON.stringify({ event: 'command', func: 'playVideo', args: '' }), '*');
                        iframe.contentWindow.postMessage(JSON.stringify({ event: 'command', func: 'unMute', args: '' }), '*');
                      }
                    }, 100);

                    setPlayingStates(prev => ({ ...prev, [product.id]: true }));
                    setIsMuted(false);
                    // Optional: scroll to item when switching back to feed
                    setTimeout(() => {
                      if (containerRef.current) {
                        containerRef.current.scrollTop = index * window.innerHeight;
                      }
                    }, 100);
                  }}
                  className="relative aspect-[3/4] bg-zinc-900 rounded-lg overflow-hidden cursor-pointer active:scale-95 transition-transform"
                >
                  {product.photo ? (
                    <img src={product.photo} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-zinc-800">
                      <ImageIcon size={32} className="text-zinc-600" />
                    </div>
                  )}
                  {product.isPromotion && (
                    <div className="absolute top-2 right-2 bg-red-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded shadow-sm">
                      Promo
                    </div>
                  )}
                  <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/90 to-transparent flex flex-col gap-2">
                    <div>
                      <p className="text-white text-xs font-bold truncate">{product.name}</p>
                      <p className="text-emerald-400 text-xs font-black">
                        R$ {(product.isPromotion && product.promotionalPrice ? product.promotionalPrice : product.salePrice).toFixed(2).replace('.', ',')}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          handleWhatsAppClick(product);
                        }}
                        className="flex-1 bg-emerald-600 text-white text-[9px] font-bold py-1.5 rounded flex items-center justify-center gap-1 active:scale-95 transition-transform"
                      >
                        <MessageCircle size={10} /> Comprar
                      </button>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          const index = displayProducts.findIndex(p => p.id === product.id);
                          setActiveProductIndex(index);
                          setViewMode('feed');
                          
                          // Force play via postMessage
                          setTimeout(() => {
                            const iframe = document.getElementById(`iframe-${product.id}`) as HTMLIFrameElement;
                            if (iframe && iframe.contentWindow) {
                              iframe.contentWindow.postMessage(JSON.stringify({ event: 'command', func: 'playVideo', args: '' }), '*');
                              iframe.contentWindow.postMessage(JSON.stringify({ event: 'command', func: 'unMute', args: '' }), '*');
                            }
                          }, 100);

                          setPlayingStates(prev => ({ ...prev, [product.id]: true }));
                          setIsMuted(false);
                        }}
                        className="flex-1 bg-white text-black text-[9px] font-bold py-1.5 rounded flex items-center justify-center gap-1 active:scale-95 transition-transform"
                      >
                        <PlayCircle size={10} /> Vídeo
                      </button>
                    </div>
                  </div>
                  {product.videoUrl && (
                    <div className="absolute top-2 left-2 text-white drop-shadow-md">
                      <PlayCircle size={16} fill="rgba(0,0,0,0.5)" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Feed Container */}
      <div 
        ref={containerRef}
        onScroll={handleScroll}
        className={`h-full w-full overflow-y-scroll snap-y snap-mandatory hide-scrollbar [&::-webkit-scrollbar]:hidden ${viewMode !== 'feed' ? 'hidden' : ''}`}
      >
        {displayProducts.map((product, index) => {
          const currentPrice = product.isPromotion && product.promotionalPrice ? product.promotionalPrice : product.salePrice;
          const isActive = index === activeProductIndex;
          const hasVideo = !!product.videoUrl;
          const isLiked = likedProducts[product.id];
          const isSaved = savedProducts[product.id];
          const likes = likeCounts[product.id] || 0;
          const isPlaying = playingStates[product.id] ?? true;

          return (
            <div key={product.id} className="h-full w-full snap-start relative flex items-center justify-center bg-zinc-900">
              {/* Media Layer */}
              <div className="absolute inset-0 z-0" onClick={() => hasVideo ? toggleVideo(product.id) : setIsMuted(!isMuted)}>
                {hasVideo ? (
                  <iframe 
                    id={`iframe-${product.id}`}
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
                
                {/* Play/Pause Overlay Icon */}
                {hasVideo && !isPlaying && isActive && (
                  <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
                    <PlayCircle size={64} className="text-white/50 animate-pulse" />
                  </div>
                )}
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
      <div className="absolute bottom-0 left-0 right-0 bg-black border-t border-white/10 py-3 pb-6 px-2 flex justify-between items-center z-50">
        <button 
          onClick={() => setViewMode('grid')}
          className={`flex flex-col items-center gap-1 w-1/5 ${viewMode === 'grid' || viewMode === 'feed' ? 'text-white' : 'text-white/60 hover:text-white'} transition-colors`}
        >
          <Home size={24} className="drop-shadow-md" />
          <span className="text-[10px] font-medium">Início</span>
        </button>
        <button 
          onClick={() => {
            setIsSearchOpen(true);
            setViewMode('grid');
          }}
          className="flex flex-col items-center gap-1 text-white/60 w-1/5 hover:text-white transition-colors"
        >
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
        <button 
          onClick={() => {
            setViewMode('profile');
            // Pause video if playing
            const currentProduct = displayProducts[activeProductIndex];
            if (currentProduct) {
                 const iframe = document.getElementById(`iframe-${currentProduct.id}`) as HTMLIFrameElement;
                 if (iframe && iframe.contentWindow) {
                   iframe.contentWindow.postMessage(JSON.stringify({ 
                     event: 'command', 
                     func: 'pauseVideo', 
                     args: '' 
                   }), '*');
                   setPlayingStates(prev => ({ ...prev, [currentProduct.id]: false }));
                 }
            }
          }}
          className={`flex flex-col items-center gap-1 w-1/5 ${viewMode === 'profile' ? 'text-white' : 'text-white/60 hover:text-white'} transition-colors`}
        >
          <User size={24} />
          <span className="text-[10px] font-medium">Perfil</span>
        </button>
      </div>
    </div>
  );
};

export default CustomerCatalog;
