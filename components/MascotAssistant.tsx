import React, { useState, useEffect, useRef } from 'react';
import { MessageCircle, X } from 'lucide-react';
import { useLocation } from 'react-router-dom';

interface MascotProps {
  enabled: boolean;
  onDisable: () => void;
}

export const MascotAssistant: React.FC<MascotProps> = ({ enabled, onDisable }) => {
  const [position, setPosition] = useState({ x: 20, y: window.innerHeight - 100 });
  const [direction, setDirection] = useState<'left' | 'right'>('right');
  const [isMoving, setIsMoving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [mood, setMood] = useState<'happy' | 'sleepy' | 'alert'>('happy');
  const containerRef = useRef<HTMLDivElement>(null);
  const location = useLocation();

  // Movimento aleatório
  useEffect(() => {
    if (!enabled) return;

    const moveInterval = setInterval(() => {
      if (Math.random() > 0.7) {
        setIsMoving(true);
        const newX = Math.random() * (window.innerWidth - 100);
        setDirection(newX > position.x ? 'right' : 'left');
        setPosition(prev => ({ ...prev, x: newX }));
        
        setTimeout(() => setIsMoving(false), 2000);
      }
    }, 5000);

    return () => clearInterval(moveInterval);
  }, [enabled, position.x]);

  // Mensagens contextuais
  useEffect(() => {
    if (!enabled) return;

    const messages = [
      "Olá! Estou aqui para ajudar.",
      "Que tal verificar o estoque hoje?",
      "Vendas estão indo bem!",
      "Não esqueça de fazer backup.",
      "Precisa de ajuda com algo?",
      "Miau! 😺"
    ];

    const messageInterval = setInterval(() => {
      if (Math.random() > 0.6) {
        const randomMsg = messages[Math.floor(Math.random() * messages.length)];
        setMessage(randomMsg);
        setTimeout(() => setMessage(null), 4000);
      }
    }, 10000);

    return () => clearInterval(messageInterval);
  }, [enabled]);

  if (!enabled) return null;

  return (
    <div 
      ref={containerRef}
      className="fixed z-50 pointer-events-none transition-all duration-[2000ms] ease-in-out"
      style={{ 
        left: `${position.x}px`, 
        top: `${position.y}px`,
        transform: `scaleX(${direction === 'left' ? -1 : 1})`
      }}
    >
      <div className="relative pointer-events-auto group">
        {/* Balão de Fala */}
        {message && (
          <div 
            className="absolute -top-20 left-1/2 -translate-x-1/2 bg-white text-slate-800 px-4 py-2 rounded-2xl shadow-xl border-2 border-slate-900 min-w-[150px] text-center animate-in zoom-in slide-in-from-bottom-2"
            style={{ transform: `scaleX(${direction === 'left' ? -1 : 1})` }} // Desvira o texto
          >
            <p className="text-[10px] font-black uppercase leading-tight">{message}</p>
            <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-white border-r-2 border-b-2 border-slate-900 rotate-45"></div>
          </div>
        )}

        {/* O Gatinho (SVG CSS) */}
        <div className="w-16 h-16 relative cursor-pointer hover:scale-110 transition-transform" onClick={() => setMessage("Miau! 😺")}>
          {/* Corpo */}
          <div className="absolute bottom-0 left-2 w-12 h-8 bg-slate-800 rounded-full"></div>
          {/* Cabeça */}
          <div className="absolute bottom-4 left-0 w-10 h-9 bg-slate-800 rounded-2xl">
            {/* Orelhas */}
            <div className="absolute -top-2 left-0 w-4 h-4 bg-slate-800 rounded-sm rotate-45"></div>
            <div className="absolute -top-2 right-0 w-4 h-4 bg-slate-800 rounded-sm rotate-45"></div>
            {/* Olhos */}
            <div className={`absolute top-3 left-2 w-2 h-2 bg-white rounded-full ${mood === 'sleepy' ? 'h-0.5 top-4' : ''}`}></div>
            <div className={`absolute top-3 right-2 w-2 h-2 bg-white rounded-full ${mood === 'sleepy' ? 'h-0.5 top-4' : ''}`}></div>
            {/* Nariz */}
            <div className="absolute top-5 left-1/2 -translate-x-1/2 w-1.5 h-1 bg-pink-400 rounded-full"></div>
          </div>
          {/* Rabo */}
          <div className={`absolute bottom-2 -right-2 w-8 h-2 bg-slate-800 rounded-full origin-left ${isMoving ? 'animate-bounce' : ''}`}></div>
          {/* Patas */}
          <div className={`absolute -bottom-1 left-3 w-3 h-2 bg-white rounded-full ${isMoving ? 'animate-pulse' : ''}`}></div>
          <div className={`absolute -bottom-1 right-4 w-3 h-2 bg-white rounded-full ${isMoving ? 'animate-pulse delay-75' : ''}`}></div>
        </div>

        {/* Botão Fechar (só aparece no hover) */}
        <button 
          onClick={(e) => { e.stopPropagation(); onDisable(); }}
          className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
          style={{ transform: `scaleX(${direction === 'left' ? -1 : 1})` }}
        >
          <X size={10} />
        </button>
      </div>
    </div>
  );
};
