import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Gamepad2, 
  RotateCcw, 
  X, 
  Trophy, 
  Flame, 
  ArrowUp, 
  ArrowDown, 
  ArrowLeft, 
  ArrowRight, 
  Play, 
  Pause,
  BellRing,
  Radio,
  Sparkles
} from 'lucide-react';

interface SnakeGameModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentStatus?: string;
  statusUpdateToast?: { prev: string; current: string } | null;
  onDismissToast?: () => void;
}

type Point = { x: number; y: number };
type Direction = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT';

const GRID_SIZE = 16;
const INITIAL_SNAKE: Point[] = [
  { x: 8, y: 8 },
  { x: 8, y: 9 },
  { x: 8, y: 10 }
];
const INITIAL_SPEED = 140;

export const SnakeGameModal: React.FC<SnakeGameModalProps> = ({ 
  isOpen, 
  onClose,
  currentStatus,
  statusUpdateToast,
  onDismissToast
}) => {
  const [snake, setSnake] = useState<Point[]>(INITIAL_SNAKE);
  const [food, setFood] = useState<Point>({ x: 4, y: 4 });
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState<number>(() => {
    try {
      return parseInt(localStorage.getItem('snake_highscore') || '0', 10);
    } catch {
      return 0;
    }
  });
  const [isGameOver, setIsGameOver] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);

  // Refs for zero-latency game loop and input queue
  const currentDirectionRef = useRef<Direction>('UP');
  const inputQueueRef = useRef<Direction[]>([]);
  const isPlayingRef = useRef(false);
  const isGameOverRef = useRef(false);
  const snakeRef = useRef<Point[]>(INITIAL_SNAKE);
  const foodRef = useRef<Point>({ x: 4, y: 4 });
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  isPlayingRef.current = isPlaying;
  isGameOverRef.current = isGameOver;
  snakeRef.current = snake;
  foodRef.current = food;

  const isOpposite = (dirA: Direction, dirB: Direction) => {
    return (
      (dirA === 'UP' && dirB === 'DOWN') ||
      (dirA === 'DOWN' && dirB === 'UP') ||
      (dirA === 'LEFT' && dirB === 'RIGHT') ||
      (dirA === 'RIGHT' && dirB === 'LEFT')
    );
  };

  const generateFood = useCallback((currentSnake: Point[]): Point => {
    while (true) {
      const newFood: Point = {
        x: Math.floor(Math.random() * GRID_SIZE),
        y: Math.floor(Math.random() * GRID_SIZE)
      };
      const collision = currentSnake.some(seg => seg.x === newFood.x && seg.y === newFood.y);
      if (!collision) return newFood;
    }
  }, []);

  const resetGame = useCallback(() => {
    const freshFood = generateFood(INITIAL_SNAKE);
    setSnake(INITIAL_SNAKE);
    snakeRef.current = INITIAL_SNAKE;
    currentDirectionRef.current = 'UP';
    inputQueueRef.current = [];
    setScore(0);
    setIsGameOver(false);
    isGameOverRef.current = false;
    setFood(freshFood);
    foodRef.current = freshFood;
    setIsPlaying(true);
    isPlayingRef.current = true;
  }, [generateFood]);

  const changeDirection = useCallback((newDir: Direction) => {
    if (!isPlayingRef.current && !isGameOverRef.current) {
      setIsPlaying(true);
      isPlayingRef.current = true;
    }
    if (isGameOverRef.current) return;

    // Compare with the last queued direction or current moving direction
    const lastDir = inputQueueRef.current.length > 0 
      ? inputQueueRef.current[inputQueueRef.current.length - 1] 
      : currentDirectionRef.current;

    // Ignore if same direction or direct opposite (reverse into self)
    if (newDir !== lastDir && !isOpposite(newDir, lastDir)) {
      // Buffer up to 2 fast inputs (e.g. quick corner turns)
      if (inputQueueRef.current.length < 2) {
        inputQueueRef.current.push(newDir);
      }
    }
  }, []);

  // Keyboard controls with zero delay
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (['ArrowUp', 'KeyW'].includes(e.code)) {
        e.preventDefault();
        changeDirection('UP');
      } else if (['ArrowDown', 'KeyS'].includes(e.code)) {
        e.preventDefault();
        changeDirection('DOWN');
      } else if (['ArrowLeft', 'KeyA'].includes(e.code)) {
        e.preventDefault();
        changeDirection('LEFT');
      } else if (['ArrowRight', 'KeyD'].includes(e.code)) {
        e.preventDefault();
        changeDirection('RIGHT');
      } else if (e.code === 'Space') {
        e.preventDefault();
        if (isGameOverRef.current) {
          resetGame();
        } else {
          setIsPlaying(p => !p);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown, { passive: false });
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, changeDirection, resetGame]);

  // Touch Swipe Handlers for instant direct-touch play
  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStartRef.current) return;
    const touch = e.changedTouches[0];
    const dx = touch.clientX - touchStartRef.current.x;
    const dy = touch.clientY - touchStartRef.current.y;
    const absX = Math.abs(dx);
    const absY = Math.abs(dy);

    // Minimum swipe threshold
    if (Math.max(absX, absY) > 20) {
      if (absX > absY) {
        // Horizontal swipe
        if (dx > 0) changeDirection('RIGHT');
        else changeDirection('LEFT');
      } else {
        // Vertical swipe
        if (dy > 0) changeDirection('DOWN');
        else changeDirection('UP');
      }
    }
    touchStartRef.current = null;
  };

  // Game Loop
  useEffect(() => {
    if (!isOpen || !isPlaying || isGameOver) return;

    const speed = Math.max(75, 115 - Math.floor(score / 4) * 4);

    const interval = setInterval(() => {
      // Dequeue next direction if available
      if (inputQueueRef.current.length > 0) {
        const nextDir = inputQueueRef.current.shift()!;
        if (!isOpposite(nextDir, currentDirectionRef.current)) {
          currentDirectionRef.current = nextDir;
        }
      }

      const curDir = currentDirectionRef.current;
      const prevSnake = snakeRef.current;
      const head = { ...prevSnake[0] };

      if (curDir === 'UP') head.y -= 1;
      if (curDir === 'DOWN') head.y += 1;
      if (curDir === 'LEFT') head.x -= 1;
      if (curDir === 'RIGHT') head.x += 1;

      // Collision with walls
      if (head.x < 0 || head.x >= GRID_SIZE || head.y < 0 || head.y >= GRID_SIZE) {
        setIsGameOver(true);
        setIsPlaying(false);
        return;
      }

      // Collision with self
      if (prevSnake.some(seg => seg.x === head.x && seg.y === head.y)) {
        setIsGameOver(true);
        setIsPlaying(false);
        return;
      }

      const newSnake = [head, ...prevSnake];
      const curFood = foodRef.current;

      // Eat food
      if (head.x === curFood.x && head.y === curFood.y) {
        try {
          if (navigator.vibrate) navigator.vibrate(15);
        } catch {}

        setScore(s => {
          const nextScore = s + 1;
          if (nextScore > highScore) {
            setHighScore(nextScore);
            try {
              localStorage.setItem('snake_highscore', nextScore.toString());
            } catch {}
          }
          return nextScore;
        });

        const newFood = generateFood(newSnake);
        foodRef.current = newFood;
        setFood(newFood);
      } else {
        newSnake.pop();
      }

      snakeRef.current = newSnake;
      setSnake(newSnake);
    }, speed);

    return () => clearInterval(interval);
  }, [isOpen, isPlaying, isGameOver, score, highScore, generateFood]);

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in"
      onClick={onClose}
    >
      <div 
        className="bg-slate-900 border border-slate-800 w-full max-w-sm rounded-3xl p-5 shadow-2xl relative flex flex-col items-center max-h-[95vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* NOTIFICAÇÃO DE STATUS ATUALIZADO DENTRO DO MODAL DO JOGO */}
        {statusUpdateToast && (
          <div className="w-full mb-3 bg-emerald-600 text-white p-3.5 rounded-2xl border-2 border-emerald-300 shadow-xl shadow-emerald-950/80 animate-in slide-in-from-top duration-300 flex items-center justify-between gap-2.5">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-emerald-700 flex items-center justify-center shrink-0 animate-bounce">
                <BellRing size={16} className="text-white" />
              </div>
              <div>
                <p className="text-[9px] font-black uppercase tracking-wider text-emerald-200 leading-tight">O.S. Atualizada!</p>
                <p className="text-[11px] font-bold leading-tight mt-0.5">
                  Novo status: <span className="underline font-black text-emerald-100">{statusUpdateToast.current}</span>
                </p>
              </div>
            </div>
            {onDismissToast && (
              <button 
                type="button"
                onClick={onDismissToast}
                className="p-1 hover:bg-emerald-700/70 rounded-lg text-emerald-100 transition-colors"
              >
                <X size={14} />
              </button>
            )}
          </div>
        )}

        {/* Cabeçalho do Jogo */}
        <div className="w-full flex items-center justify-between mb-2.5">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <Gamepad2 size={18} />
            </div>
            <div>
              <h3 className="text-xs font-black uppercase tracking-wider text-white">Jogo da Cobrinha</h3>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                </span>
                <p className="text-[9px] font-bold text-emerald-400 uppercase tracking-wide">
                  O.S.: {currentStatus || 'Em acompanhamento'}
                </p>
              </div>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white bg-slate-800 rounded-xl transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Placar */}
        <div className="w-full flex items-center justify-between bg-slate-950/80 px-4 py-2 rounded-2xl border border-slate-800/80 mb-3 text-xs">
          <div className="flex items-center gap-1.5 text-emerald-400 font-bold">
            <Flame size={14} />
            <span>Pontos: <strong className="text-white text-sm font-black">{score}</strong></span>
          </div>
          <div className="flex items-center gap-1.5 text-amber-400 font-bold">
            <Trophy size={14} />
            <span>Recorde: <strong className="text-white text-sm font-black">{highScore}</strong></span>
          </div>
        </div>

        {/* Tabuleiro do Jogo com suporte a deslizar o dedo (Swipe) */}
        <div 
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          className="relative w-full aspect-square bg-slate-950 rounded-2xl border-2 border-slate-800 overflow-hidden shadow-inner flex items-center justify-center touch-none select-none cursor-pointer"
        >
          {/* Grade de fundo discreta */}
          <div 
            className="absolute inset-0 grid pointer-events-none" 
            style={{ 
              gridTemplateColumns: `repeat(${GRID_SIZE}, minmax(0, 1fr))`,
              gridTemplateRows: `repeat(${GRID_SIZE}, minmax(0, 1fr))` 
            }}
          >
            {Array.from({ length: GRID_SIZE * GRID_SIZE }).map((_, i) => (
              <div key={i} className="border-[0.5px] border-slate-900/40" />
            ))}
          </div>

          {/* Comida (Maçã / Circuito) */}
          <div 
            className="absolute bg-red-500 rounded-full shadow-lg shadow-red-500/50 border border-red-300 animate-pulse pointer-events-none"
            style={{
              width: `${100 / GRID_SIZE}%`,
              height: `${100 / GRID_SIZE}%`,
              left: `${(food.x / GRID_SIZE) * 100}%`,
              top: `${(food.y / GRID_SIZE) * 100}%`
            }}
          />

          {/* Cobrinha com renderização instantânea (sem lag de transição CSS) */}
          {snake.map((seg, idx) => {
            const isHead = idx === 0;
            return (
              <div 
                key={idx}
                className={`absolute pointer-events-none ${
                  isHead 
                    ? 'bg-emerald-400 rounded-[3px] shadow-md shadow-emerald-400/60 border border-emerald-200 z-10' 
                    : 'bg-emerald-600 rounded-[2px]'
                }`}
                style={{
                  width: `${100 / GRID_SIZE}%`,
                  height: `${100 / GRID_SIZE}%`,
                  left: `${(seg.x / GRID_SIZE) * 100}%`,
                  top: `${(seg.y / GRID_SIZE) * 100}%`
                }}
              />
            );
          })}

          {/* Overlay: Game Over */}
          {isGameOver && (
            <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-xs flex flex-col items-center justify-center p-4 z-20 animate-in zoom-in-95">
              <span className="text-red-500 font-black text-sm uppercase tracking-wider mb-1">Fim de Jogo!</span>
              <p className="text-slate-300 text-xs mb-3">Você fez <strong>{score}</strong> {score === 1 ? 'ponto' : 'pontos'}</p>
              <button
                type="button"
                onClick={resetGame}
                onPointerDown={e => { e.preventDefault(); resetGame(); }}
                className="bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-bold text-xs uppercase tracking-wider py-2.5 px-5 rounded-xl flex items-center gap-1.5 shadow-lg shadow-emerald-600/30 transition-all touch-manipulation cursor-pointer"
              >
                <RotateCcw size={14} /> Jogar Novamente
              </button>
            </div>
          )}

          {/* Overlay: Início / Pausa */}
          {!isPlaying && !isGameOver && (
            <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-xs flex flex-col items-center justify-center p-4 z-20">
              <p className="text-xs text-slate-300 font-medium text-center mb-3">
                Deslize o dedo na tela, use os botões ou as setas do teclado
              </p>
              <button
                type="button"
                onClick={() => setIsPlaying(true)}
                onPointerDown={e => { e.preventDefault(); setIsPlaying(true); }}
                className="bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-bold text-xs uppercase tracking-wider py-2.5 px-5 rounded-xl flex items-center gap-1.5 shadow-lg shadow-emerald-600/30 transition-all touch-manipulation cursor-pointer"
              >
                <Play size={14} /> Iniciar Jogo
              </button>
            </div>
          )}
        </div>

        {/* Controles Touch / D-Pad para Celular (Sem atraso de toque) */}
        <div className="mt-3 flex flex-col items-center gap-1.5 select-none touch-manipulation">
          <button
            type="button"
            onPointerDown={e => { e.preventDefault(); changeDirection('UP'); }}
            onClick={() => changeDirection('UP')}
            className="w-14 h-11 bg-slate-800 hover:bg-slate-700 active:bg-emerald-600 active:scale-90 text-white rounded-xl flex items-center justify-center shadow-md transition-all touch-manipulation cursor-pointer"
            aria-label="Cima"
          >
            <ArrowUp size={20} />
          </button>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onPointerDown={e => { e.preventDefault(); changeDirection('LEFT'); }}
              onClick={() => changeDirection('LEFT')}
              className="w-14 h-11 bg-slate-800 hover:bg-slate-700 active:bg-emerald-600 active:scale-90 text-white rounded-xl flex items-center justify-center shadow-md transition-all touch-manipulation cursor-pointer"
              aria-label="Esquerda"
            >
              <ArrowLeft size={20} />
            </button>
            <button
              type="button"
              onPointerDown={e => {
                e.preventDefault();
                if (isGameOver) resetGame();
                else setIsPlaying(p => !p);
              }}
              onClick={() => {
                if (isGameOver) resetGame();
                else setIsPlaying(p => !p);
              }}
              className="w-12 h-11 bg-slate-950 border border-slate-800 text-slate-400 hover:text-white active:scale-90 rounded-xl flex items-center justify-center text-[10px] font-bold uppercase transition-all touch-manipulation cursor-pointer"
              title="Pausar / Continuar"
            >
              {isPlaying ? <Pause size={16} /> : <Play size={16} />}
            </button>
            <button
              type="button"
              onPointerDown={e => { e.preventDefault(); changeDirection('RIGHT'); }}
              onClick={() => changeDirection('RIGHT')}
              className="w-14 h-11 bg-slate-800 hover:bg-slate-700 active:bg-emerald-600 active:scale-90 text-white rounded-xl flex items-center justify-center shadow-md transition-all touch-manipulation cursor-pointer"
              aria-label="Direita"
            >
              <ArrowRight size={20} />
            </button>
          </div>
          <button
            type="button"
            onPointerDown={e => { e.preventDefault(); changeDirection('DOWN'); }}
            onClick={() => changeDirection('DOWN')}
            className="w-14 h-11 bg-slate-800 hover:bg-slate-700 active:bg-emerald-600 active:scale-90 text-white rounded-xl flex items-center justify-center shadow-md transition-all touch-manipulation cursor-pointer"
            aria-label="Baixo"
          >
            <ArrowDown size={20} />
          </button>
        </div>

        {/* Rodapé do jogo com status ao vivo */}
        <div className="mt-2 text-[10px] text-slate-400 text-center font-medium flex items-center justify-center gap-1">
          <Radio size={12} className="text-emerald-400 animate-pulse" />
          <span>Monitorando status da O.S. ao vivo em tempo real</span>
        </div>
      </div>
    </div>
  );
};
