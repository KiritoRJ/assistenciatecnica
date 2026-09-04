import React, { useState, useEffect, useRef } from 'react';
import { 
  CheckCircle2, XCircle, AlertTriangle, ArrowLeft, ArrowRight, 
  Smartphone, Camera, Mic, Volume2, Wifi, Battery, Compass,
  Sparkles, RefreshCw, Send, Check, Play, Square, Loader2,
  Share2, ShieldCheck, Eye, HelpCircle, Layers, Award,
  Sliders, ChevronRight, MessageCircle, Maximize2, Zap, Radio
} from 'lucide-react';
import { ChecklistTestItem, InteractiveChecklistResult, ServiceOrder, AppSettings } from '../types';
import { DEFAULT_CHECKLIST_TESTS, computeChecklistStats, formatWhatsAppChecklistReport } from '../utils/checklistHelper';
import { supabase } from '../utils/api';

interface Props {
  token?: string;
  orderData?: Partial<ServiceOrder> | null;
  settings?: AppSettings | null;
  tenantId?: string;
  onClose?: () => void;
  onSaveResult?: (result: InteractiveChecklistResult) => Promise<void>;
  isBenchMode?: boolean; // Se aberto pelo próprio técnico na loja
}

export const InteractiveChecklistRunner: React.FC<Props> = ({
  token,
  orderData: propOrderData,
  settings: propSettings,
  tenantId: propTenantId,
  onClose,
  onSaveResult,
  isBenchMode = false
}) => {
  const [loading, setLoading] = useState<boolean>(() => {
    if (propOrderData) return false;
    if (token && token.trim().length > 0) return true;
    return false;
  });
  const [order, setOrder] = useState<Partial<ServiceOrder> | null>(propOrderData || null);
  const [storeInfo, setStoreInfo] = useState<{ name: string; phone?: string; logo?: string }>(() => ({
    name: propSettings?.storeName || 'Assistência Técnica',
    phone: propSettings?.storePhone,
    logo: propSettings?.logoUrl || undefined
  }));
  const [resolvedTenantId, setResolvedTenantId] = useState<string>(propTenantId || '');

  // Estado do Teste
  const [currentTestIndex, setCurrentTestIndex] = useState(0);
  const [tests, setTests] = useState<ChecklistTestItem[]>(() => 
    DEFAULT_CHECKLIST_TESTS.map(t => ({ ...t, status: 'pending' }))
  );
  const [mode, setMode] = useState<'welcome' | 'guided' | 'matrix' | 'completed'>('welcome');
  const [customerNotes, setCustomerNotes] = useState('');
  const [signatureData, setSignatureData] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedResult, setSubmittedResult] = useState<InteractiveChecklistResult | null>(null);
  const [itemNoteInput, setItemNoteInput] = useState('');
  const [showNoteModal, setShowNoteModal] = useState<string | null>(null);

  // Estados de Testes Interativos de Hardware
  // 1. Touchscreen Grid
  const [touchGrid, setTouchGrid] = useState<boolean[]>(() => Array(48).fill(false));
  const isTouchGridComplete = touchGrid.every(Boolean);

  // 2. Camera Stream
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [cameraFacing, setCameraFacing] = useState<'environment' | 'user'>('environment');
  const [cameraPhoto, setCameraPhoto] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // 3. Audio & Microfone
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [isRecordingMic, setIsRecordingMic] = useState(false);
  const [micAudioUrl, setMicAudioUrl] = useState<string | null>(null);
  const [micVolumeLevel, setMicVolumeLevel] = useState<number>(0);
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);

  // 4. Giroscópio / Orientação
  const [tilt, setTilt] = useState<{ beta: number; gamma: number }>({ beta: 0, gamma: 0 });
  const [tiltTargetReached, setTiltTargetReached] = useState(false);

  // 5. Bateria & Rede
  const [batteryInfo, setBatteryInfo] = useState<{ level?: number; charging?: boolean }>({});
  const [networkPing, setNetworkPing] = useState<number | null>(null);

  // 6. Assinatura Canvas
  const signatureCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isSigning, setIsSigning] = useState(false);

  // Busca dados da O.S. pelo token se necessário
  useEffect(() => {
    if (propOrderData) {
      setOrder(propOrderData);
      setLoading(false);
      return;
    }

    if (token && token.trim().length > 0) {
      loadOrderByToken(token.trim());
    } else {
      setLoading(false);
    }
  }, [token, propOrderData]);

  // Timeout de segurança absoluto: nunca fica mais de 3.5s na tela de loading
  useEffect(() => {
    if (loading) {
      const timer = setTimeout(() => {
        setLoading(false);
      }, 3500);
      return () => clearTimeout(timer);
    }
  }, [loading]);

  const loadOrderByToken = async (cleanToken: string) => {
    setLoading(true);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2500);

    try {
      // 1. Tenta API do servidor com timeout
      try {
        const res = await fetch(`/api/os-tracking/${encodeURIComponent(cleanToken)}`, {
          signal: controller.signal
        });
        clearTimeout(timeoutId);
        if (res.ok) {
          const data = await res.json();
          if (data && data.id) {
            setOrder({
              id: data.id,
              customerName: data.customerName,
              phoneNumber: data.phoneNumber,
              deviceBrand: data.deviceBrand,
              deviceModel: data.deviceModel,
              defect: data.defect,
              status: data.status,
              trackingToken: cleanToken
            });
            if (data.store) {
              setStoreInfo(data.store);
            }
            if (data.tenant_id) {
              setResolvedTenantId(data.tenant_id);
            }
            setLoading(false);
            return;
          }
        }
      } catch (e) {
        // Ignora e tenta fallback
      }

      // 2. Fallback Supabase direto
      try {
        let { data: orderData } = await supabase
          .from('service_orders')
          .select('*')
          .or(`tracking_token.eq.${cleanToken},id.eq.${cleanToken}`)
          .maybeSingle();

        if (orderData) {
          setOrder({
            id: orderData.id,
            customerName: orderData.customer_name,
            phoneNumber: orderData.phone_number,
            deviceBrand: orderData.device_brand,
            deviceModel: orderData.device_model,
            defect: orderData.defect,
            status: orderData.status,
            trackingToken: orderData.tracking_token
          });
          if (orderData.tenant_id) {
            setResolvedTenantId(orderData.tenant_id);
            try {
              const { data: storeData } = await supabase
                .from('cloud_data')
                .select('data_json')
                .eq('tenant_id', orderData.tenant_id)
                .eq('store_key', 'settings')
                .maybeSingle();
              if (storeData?.data_json) {
                setStoreInfo({
                  name: storeData.data_json.storeName || 'Assistência Técnica',
                  phone: storeData.data_json.phoneNumber,
                  logo: storeData.data_json.logoUrl
                });
              }
            } catch {}
          }
        }
      } catch (errDb) {
        console.warn('Erro ao consultar Supabase fallback:', errDb);
      }
    } catch (e) {
      console.error('Erro ao carregar dados do teste:', e);
    } finally {
      clearTimeout(timeoutId);
      setLoading(false);
    }
  };

  // Coleta dados automáticos do dispositivo no carregamento
  useEffect(() => {
    // Leitura da Bateria
    if (typeof navigator !== 'undefined' && (navigator as any).getBattery) {
      (navigator as any).getBattery().then((bat: any) => {
        setBatteryInfo({
          level: Math.round(bat.level * 100),
          charging: bat.charging
        });
        bat.addEventListener('levelchange', () => {
          setBatteryInfo(prev => ({ ...prev, level: Math.round(bat.level * 100) }));
        });
        bat.addEventListener('chargingchange', () => {
          setBatteryInfo(prev => ({ ...prev, charging: bat.charging }));
        });
      }).catch(() => {});
    }

    // Leitura do Ping / Rede
    const checkPing = async () => {
      const start = Date.now();
      try {
        await fetch('/api/health?t=' + Date.now(), { method: 'GET', cache: 'no-store' });
        setNetworkPing(Date.now() - start);
      } catch {
        setNetworkPing(navigator.onLine ? 45 : 999);
      }
    };
    checkPing();

    // Sensor de Orientação
    const handleOrientation = (e: DeviceOrientationEvent) => {
      const beta = e.beta || 0; // -180 to 180 (frente/trás)
      const gamma = e.gamma || 0; // -90 to 90 (esquerda/direita)
      setTilt({ beta, gamma });
      if (Math.abs(beta) > 20 || Math.abs(gamma) > 20) {
        setTiltTargetReached(true);
      }
    };

    if (typeof window !== 'undefined' && window.DeviceOrientationEvent) {
      window.addEventListener('deviceorientation', handleOrientation);
    }

    return () => {
      if (typeof window !== 'undefined' && window.DeviceOrientationEvent) {
        window.removeEventListener('deviceorientation', handleOrientation);
      }
      stopCamera();
      stopAudio();
    };
  }, []);

  // Controladores de Câmera
  const startCamera = async (facing: 'environment' | 'user') => {
    stopCamera();
    setCameraError(null);
    setCameraFacing(facing);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: facing, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false
      });
      setCameraStream(stream);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
    } catch (err: any) {
      console.warn('Câmera indisponível:', err);
      setCameraError('Permissão da câmera negada ou câmera não suportada no navegador.');
    }
  };

  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(t => t.stop());
      setCameraStream(null);
    }
  };

  const capturePhoto = () => {
    if (!videoRef.current) return;
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth || 640;
    canvas.height = videoRef.current.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(videoRef.current, 0, 0);
      setCameraPhoto(canvas.toDataURL('image/jpeg', 0.8));
    }
  };

  // Controladores de Áudio (Alto-Falante)
  const playTestAudio = () => {
    stopAudio();
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioCtx();
      audioContextRef.current = ctx;

      setIsPlayingAudio(true);

      // Gera sequência harmônica cristalina
      const notes = [523.25, 659.25, 783.99, 1046.50, 783.99, 1046.50]; // C5, E5, G5, C6
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.25);

        gain.gain.setValueAtTime(0.3, ctx.currentTime + idx * 0.25);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + (idx + 1) * 0.25);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(ctx.currentTime + idx * 0.25);
        osc.stop(ctx.currentTime + (idx + 1) * 0.25);
      });

      setTimeout(() => {
        setIsPlayingAudio(false);
      }, notes.length * 250 + 200);
    } catch (e) {
      console.warn('Erro ao tocar áudio:', e);
      setIsPlayingAudio(false);
    }
  };

  const stopAudio = () => {
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    setIsPlayingAudio(false);
  };

  // Controladores de Microfone
  const startMicTest = async () => {
    setMicAudioUrl(null);
    setMicVolumeLevel(0);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStreamRef.current = stream;

      // Medidor de volume VU
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const audioCtx = new AudioCtx();
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const updateVolume = () => {
        if (!micStreamRef.current) return;
        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
        }
        const avg = sum / bufferLength;
        setMicVolumeLevel(Math.min(100, Math.round((avg / 128) * 100)));
        requestAnimationFrame(updateVolume);
      };
      updateVolume();

      // Gravação
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      const chunks: Blob[] = [];

      recorder.ondataavailable = e => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'audio/webm' });
        setMicAudioUrl(URL.createObjectURL(blob));
        if (micStreamRef.current) {
          micStreamRef.current.getTracks().forEach(t => t.stop());
          micStreamRef.current = null;
        }
        audioCtx.close().catch(() => {});
      };

      recorder.start();
      setIsRecordingMic(true);

      // Auto para após 4 segundos
      setTimeout(() => {
        if (recorder.state === 'recording') {
          recorder.stop();
          setIsRecordingMic(false);
        }
      }, 4000);
    } catch (err) {
      console.warn('Microfone indisponível:', err);
      alert('Permissão de microfone necessária para o teste.');
    }
  };

  const stopMicTest = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
      setIsRecordingMic(false);
    }
  };

  // Teste de Vibração
  const triggerVibrate = () => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate([150, 100, 250, 100, 350]);
    } else {
      alert('Seu dispositivo ou navegador não suporta a API de vibração web.');
    }
  };

  // Gerenciamento de Status dos Itens do Checklist
  const updateTestStatus = (
    testId: string, 
    status: 'passed' | 'failed' | 'skipped', 
    notes?: string,
    measuredData?: Record<string, any>
  ) => {
    setTests(prev => prev.map(t => {
      if (t.id === testId) {
        return {
          ...t,
          status,
          notes: notes !== undefined ? notes : t.notes,
          measuredData: measuredData || t.measuredData
        };
      }
      return t;
    }));

    // Se estiver no modo guiado, avança para o próximo automaticamente
    if (mode === 'guided') {
      stopCamera();
      stopAudio();
      if (currentTestIndex < tests.length - 1) {
        setCurrentTestIndex(prev => prev + 1);
      } else {
        setMode('completed');
      }
    }
  };

  const currentTest = tests[currentTestIndex];
  const stats = computeChecklistStats(tests);

  // Assinatura Digital
  const startDrawing = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = signatureCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    ctx.beginPath();
    ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
    setIsSigning(true);
  };

  const drawSignature = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isSigning) return;
    const canvas = signatureCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.stroke();
  };

  const stopDrawingSignature = () => {
    if (!isSigning) return;
    setIsSigning(false);
    const canvas = signatureCanvasRef.current;
    if (canvas) {
      setSignatureData(canvas.toDataURL('image/png'));
    }
  };

  const clearSignature = () => {
    const canvas = signatureCanvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      ctx?.clearRect(0, 0, canvas.width, canvas.height);
      setSignatureData('');
    }
  };

  // Finalizar e Salvar Laudo
  const handleFinalizeChecklist = async () => {
    setIsSubmitting(true);
    try {
      const finalStats = computeChecklistStats(tests);
      const result: InteractiveChecklistResult = {
        id: 'CHK_' + Math.random().toString(36).substring(2, 9).toUpperCase(),
        orderId: order?.id || '',
        tenantId: resolvedTenantId || 'SYSTEM',
        customerName: order?.customerName || 'Cliente',
        phoneNumber: order?.phoneNumber || '',
        deviceBrand: order?.deviceBrand || '',
        deviceModel: order?.deviceModel || '',
        completedAt: new Date().toISOString(),
        completedBy: isBenchMode ? 'tecnico' : 'cliente',
        totalTests: finalStats.total,
        passedCount: finalStats.passed,
        failedCount: finalStats.failed,
        skippedCount: finalStats.skipped,
        scorePercent: finalStats.scorePercent,
        tests: tests,
        customerNotes: customerNotes,
        customerSignature: signatureData || undefined,
        deviceSpecs: {
          userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
          screenResolution: typeof window !== 'undefined' ? `${window.screen.width}x${window.screen.height}` : undefined,
          batteryLevel: batteryInfo.level,
          isCharging: batteryInfo.charging,
          onlineStatus: typeof navigator !== 'undefined' ? navigator.onLine : true,
          touchPoints: typeof navigator !== 'undefined' ? navigator.maxTouchPoints : undefined,
          platform: typeof navigator !== 'undefined' ? (navigator as any).platform : undefined
        }
      };

      // 1. Chama callback se fornecido
      if (onSaveResult) {
        await onSaveResult(result);
      }

      // 2. Tenta enviar para o servidor / API
      try {
        await fetch('/api/checklist/submit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(result)
        });
      } catch (e) {
        console.warn('Fallback para salvamento direto no Supabase:', e);
      }

      // 3. Salva de forma universal no Supabase cloud_data e atualiza a ordem
      if (resolvedTenantId) {
        try {
          // Salva histórico de checklists do tenant
          const existing = await supabase
            .from('cloud_data')
            .select('data_json')
            .eq('tenant_id', resolvedTenantId)
            .eq('store_key', 'checklists')
            .maybeSingle();

          const list: InteractiveChecklistResult[] = Array.isArray(existing.data?.data_json) 
            ? existing.data.data_json.filter((c: any) => c.orderId !== result.orderId)
            : [];
          list.unshift(result);

          await supabase
            .from('cloud_data')
            .upsert({
              tenant_id: resolvedTenantId,
              store_key: 'checklists',
              data_json: list.slice(0, 500),
              updated_at: new Date().toISOString()
            }, { onConflict: 'tenant_id,store_key' });

          // Se tiver O.S., atualiza o checklist na própria ordem
          if (order?.id) {
            await supabase
              .from('service_orders')
              .update({
                public_notes: `[LAUDO INTERATIVO REALIZADO: ${result.scorePercent}% APROVADO]`
              })
              .eq('id', order.id);
          }
        } catch (dbErr) {
          console.error('Erro ao gravar checklist no banco:', dbErr);
        }
      }

      setSubmittedResult(result);
      setMode('completed');
    } catch (err: any) {
      alert('Erro ao enviar checklist: ' + (err.message || 'Tente novamente.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  // Compartilhar Laudo via WhatsApp
  const handleShareWhatsApp = () => {
    const res = submittedResult || {
      id: 'CHK_1',
      orderId: order?.id || '',
      tenantId: resolvedTenantId,
      customerName: order?.customerName || 'Cliente',
      phoneNumber: order?.phoneNumber,
      deviceBrand: order?.deviceBrand,
      deviceModel: order?.deviceModel,
      completedAt: new Date().toISOString(),
      completedBy: isBenchMode ? 'tecnico' : 'cliente',
      totalTests: stats.total,
      passedCount: stats.passed,
      failedCount: stats.failed,
      skippedCount: stats.skipped,
      scorePercent: stats.scorePercent,
      tests: tests,
      customerNotes: customerNotes,
      customerSignature: signatureData
    };

    const text = formatWhatsAppChecklistReport(res, {
      storeName: storeInfo.name,
      storePhone: storeInfo.phone
    } as any);

    const cleanPhone = (storeInfo.phone || order?.phoneNumber || '').replace(/\D/g, '');
    const phoneWithCountry = cleanPhone.length <= 11 && !cleanPhone.startsWith('55') ? `55${cleanPhone}` : cleanPhone;

    const url = phoneWithCountry 
      ? `https://wa.me/${phoneWithCountry}?text=${encodeURIComponent(text)}`
      : `https://wa.me/?text=${encodeURIComponent(text)}`;

    window.open(url, '_blank');
  };

  // Renderização da Tela de Boas-Vindas
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-200">
        <div className="w-16 h-16 rounded-3xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center mb-4 text-indigo-400 animate-pulse shadow-lg shadow-indigo-500/10">
          <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
        </div>
        <p className="font-black text-sm uppercase tracking-widest text-slate-200">Carregando Checklist Interativo...</p>
        <p className="text-xs text-slate-400 mt-1 max-w-xs">Preparando módulos de teste de tela, áudio, câmeras e sensores...</p>
        
        <button
          onClick={() => setLoading(false)}
          className="mt-6 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition-all"
        >
          Iniciar Teste Diretamente
        </button>
      </div>
    );
  }

  if (mode === 'welcome') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-white flex flex-col justify-between p-4 sm:p-8 max-w-lg mx-auto font-sans animate-in fade-in duration-300">
        {/* Header Loja */}
        <div className="text-center pt-4 space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-black uppercase tracking-wider">
            <Sparkles size={14} />
            <span>Auto-Diagnóstico & Teste Interativo</span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            {storeInfo.name}
          </h1>

          {order && (
            <div className="bg-white/5 border border-white/10 rounded-2xl p-3.5 space-y-1 text-left">
              <div className="flex items-center justify-between text-xs font-bold text-slate-400">
                <span>Cliente: <strong className="text-white">{order.customerName || 'Cliente'}</strong></span>
                {order.id && <span className="bg-slate-800 text-emerald-400 px-2 py-0.5 rounded-md font-mono text-[11px]">O.S. #{order.id.split('-')[0]}</span>}
              </div>
              {(order.deviceBrand || order.deviceModel) && (
                <p className="text-xs text-slate-300 font-medium">
                  📱 Aparelho: <strong className="text-white">{order.deviceBrand} {order.deviceModel}</strong>
                </p>
              )}
              {order.defect && (
                <p className="text-[11px] text-amber-300/90 font-medium">
                  ⚠️ Defeito Relatado: {order.defect}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Card Informativo com Recursos */}
        <div className="my-6 bg-slate-900/80 border border-slate-800 rounded-3xl p-5 space-y-4 shadow-xl">
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
              <ShieldCheck size={22} />
            </div>
            <div>
              <h3 className="font-bold text-sm text-white">Segurança & Transparência</h3>
              <p className="text-xs text-slate-400 leading-relaxed mt-0.5">
                Você irá testar as funções vitais do aparelho diretamente nesta tela (toque, câmeras, som, microfone, sensores e botões).
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2.5 pt-2 border-t border-slate-800/80">
            <div className="bg-slate-950/60 p-3 rounded-2xl border border-slate-800 flex items-center gap-2.5">
              <Zap size={16} className="text-emerald-400 shrink-0" />
              <div className="min-w-0">
                <p className="text-[11px] font-bold text-white truncate">100% no Navegador</p>
                <p className="text-[9px] text-slate-400">Sem instalar nada</p>
              </div>
            </div>
            <div className="bg-slate-950/60 p-3 rounded-2xl border border-slate-800 flex items-center gap-2.5">
              <Award size={16} className="text-blue-400 shrink-0" />
              <div className="min-w-0">
                <p className="text-[11px] font-bold text-white truncate">Laudo Oficial</p>
                <p className="text-[9px] text-slate-400">Salvo na sua O.S.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Botões de Ação para Iniciar */}
        <div className="space-y-3 pb-4">
          <button
            onClick={() => {
              setCurrentTestIndex(0);
              setMode('guided');
            }}
            className="w-full py-4 px-6 bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-2xl font-black text-sm uppercase tracking-wider flex items-center justify-center gap-3 shadow-lg shadow-emerald-500/25 active:scale-95 transition-all"
          >
            <span>Iniciar Teste Guiado</span>
            <ArrowRight size={18} />
          </button>

          <button
            onClick={() => setMode('matrix')}
            className="w-full py-3.5 px-6 bg-slate-800/80 hover:bg-slate-800 text-slate-300 rounded-2xl font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 border border-slate-700/60 active:scale-95 transition-all"
          >
            <Layers size={16} />
            <span>Ver Matriz de Todos os Testes ({tests.length})</span>
          </button>

          {onClose && (
            <button
              onClick={onClose}
              className="w-full py-2.5 text-center text-xs text-slate-500 hover:text-slate-400 font-bold"
            >
              Fechar
            </button>
          )}
        </div>
      </div>
    );
  }

  // Visualização de Matriz de Testes (Lista Completa)
  if (mode === 'matrix') {
    return (
      <div className="min-h-screen bg-slate-950 text-white p-4 sm:p-6 max-w-xl mx-auto flex flex-col font-sans">
        {/* Top bar */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800 shrink-0">
          <button
            onClick={() => setMode('welcome')}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-900 hover:bg-slate-800 text-slate-300 rounded-xl text-xs font-bold transition-colors"
          >
            <ArrowLeft size={16} />
            <span>Voltar</span>
          </button>
          <div className="text-right">
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Progresso Geral</p>
            <p className="text-xs font-mono font-bold text-emerald-400">
              {stats.passed + stats.failed}/{stats.total} Concluídos ({stats.scorePercent}%)
            </p>
          </div>
        </div>

        {/* Lista de Itens */}
        <div className="flex-1 overflow-y-auto py-4 space-y-2.5">
          {tests.map((t, idx) => {
            let badgeBg = 'bg-slate-800 text-slate-400 border-slate-700';
            if (t.status === 'passed') badgeBg = 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40';
            if (t.status === 'failed') badgeBg = 'bg-red-500/20 text-red-400 border-red-500/40';
            if (t.status === 'skipped') badgeBg = 'bg-amber-500/20 text-amber-400 border-amber-500/40';

            return (
              <div
                key={t.id}
                className="bg-slate-900/90 border border-slate-800/90 rounded-2xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-slate-700 transition-all"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono text-slate-500 font-bold">#{idx + 1}</span>
                    <h4 className="text-xs font-bold text-white truncate">{t.title}</h4>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-1">{t.description}</p>
                  {t.notes && (
                    <p className="text-[10px] text-amber-300/90 mt-1 italic">Obs: {t.notes}</p>
                  )}
                </div>

                <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                  <button
                    onClick={() => updateTestStatus(t.id, 'passed')}
                    className={`px-3 py-1.5 rounded-xl text-[11px] font-black uppercase transition-all ${
                      t.status === 'passed' 
                        ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/30' 
                        : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                    }`}
                  >
                    ✓ Aprovado
                  </button>
                  <button
                    onClick={() => updateTestStatus(t.id, 'failed')}
                    className={`px-3 py-1.5 rounded-xl text-[11px] font-black uppercase transition-all ${
                      t.status === 'failed' 
                        ? 'bg-red-500 text-white shadow-md shadow-red-500/30' 
                        : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                    }`}
                  >
                    ✗ Defeito
                  </button>
                  <button
                    onClick={() => {
                      setCurrentTestIndex(idx);
                      setMode('guided');
                    }}
                    className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-xl"
                    title="Testar Interativamente"
                  >
                    <Sliders size={15} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="pt-3 border-t border-slate-800 flex items-center gap-3 shrink-0">
          <button
            onClick={() => {
              setCurrentTestIndex(0);
              setMode('guided');
            }}
            className="flex-1 py-3 bg-slate-800 text-slate-200 rounded-xl font-bold text-xs uppercase"
          >
            Modo Passo a Passo
          </button>
          <button
            onClick={() => setMode('completed')}
            className="flex-1 py-3 bg-emerald-500 text-slate-950 rounded-xl font-black text-xs uppercase shadow-lg shadow-emerald-500/20"
          >
            Avançar para Assinatura & Envio
          </button>
        </div>
      </div>
    );
  }

  // TELA DE CONCLUSÃO / ASSINATURA / ENVIO
  if (mode === 'completed') {
    return (
      <div className="min-h-screen bg-slate-950 text-white p-4 sm:p-6 max-w-lg mx-auto flex flex-col justify-between font-sans">
        <div className="space-y-4 pt-2">
          {/* Top Title */}
          <div className="text-center space-y-1">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto mb-2">
              <Award size={26} />
            </div>
            <h2 className="text-xl font-black text-white">Resumo do Diagnóstico</h2>
            <p className="text-xs text-slate-400">Verifique os resultados antes de enviar o laudo</p>
          </div>

          {/* Placar / Score */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 text-center relative overflow-hidden">
            <div className="flex items-center justify-around">
              <div>
                <span className="text-3xl font-black text-emerald-400 font-mono">{stats.scorePercent}%</span>
                <p className="text-[10px] uppercase font-black tracking-widest text-slate-400 mt-0.5">Saúde Geral</p>
              </div>
              <div className="h-10 w-px bg-slate-800" />
              <div>
                <span className="text-xl font-black text-emerald-400 font-mono">{stats.passed}</span>
                <p className="text-[10px] uppercase font-bold text-slate-400 mt-0.5">Aprovados</p>
              </div>
              <div className="h-10 w-px bg-slate-800" />
              <div>
                <span className="text-xl font-black text-red-400 font-mono">{stats.failed}</span>
                <p className="text-[10px] uppercase font-bold text-slate-400 mt-0.5">Com Defeito</p>
              </div>
            </div>
          </div>

          {/* Observações do Cliente */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-black uppercase tracking-wider text-slate-400">
              Observações Adicionais (Opcional)
            </label>
            <textarea
              value={customerNotes}
              onChange={e => setCustomerNotes(e.target.value)}
              placeholder="Descreva detalhes específicos ou dúvidas sobre o aparelho..."
              className="w-full h-20 p-3 bg-slate-900 border border-slate-800 rounded-2xl text-xs text-white placeholder:text-slate-500 outline-none focus:border-emerald-500 transition-colors resize-none"
            />
          </div>

          {/* Assinatura Digital */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-black uppercase tracking-wider text-slate-400">
                Assinatura do Cliente
              </label>
              {signatureData && (
                <button
                  onClick={clearSignature}
                  className="text-[10px] font-bold text-red-400 hover:text-red-300 uppercase"
                >
                  Limpar
                </button>
              )}
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden relative h-28">
              <canvas
                ref={signatureCanvasRef}
                width={360}
                height={112}
                onPointerDown={startDrawing}
                onPointerMove={drawSignature}
                onPointerUp={stopDrawingSignature}
                onPointerOut={stopDrawingSignature}
                className="w-full h-full cursor-crosshair touch-none"
              />
              {!signatureData && !isSigning && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-slate-600 text-xs font-bold uppercase tracking-wider">
                  ✍️ Desenhe sua assinatura aqui
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Botões de Ação Finais */}
        <div className="space-y-2.5 pt-4 pb-2">
          <button
            onClick={handleFinalizeChecklist}
            disabled={isSubmitting}
            className="w-full py-4 px-6 bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-2xl font-black text-sm uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/25 active:scale-95 transition-all disabled:opacity-50"
          >
            {isSubmitting ? <Loader2 className="animate-spin" size={18} /> : (
              <>
                <CheckCircle2 size={18} />
                <span>Salvar & Finalizar Laudo</span>
              </>
            )}
          </button>

          <button
            onClick={handleShareWhatsApp}
            className="w-full py-3.5 px-6 bg-green-600 hover:bg-green-500 text-white rounded-2xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-md active:scale-95 transition-all"
          >
            <MessageCircle size={16} />
            <span>Enviar Laudo para o WhatsApp da Loja</span>
          </button>

          <button
            onClick={() => setMode('matrix')}
            className="w-full py-2.5 text-slate-400 hover:text-slate-300 text-xs font-bold uppercase"
          >
            Revisar Itens do Checklist
          </button>
        </div>
      </div>
    );
  }

  // ==========================================
  // MODO GUIADO PASSO A PASSO (TESTES INTERATIVOS)
  // ==========================================
  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col justify-between p-4 sm:p-6 max-w-lg mx-auto font-sans select-none">
      {/* Top Header & Progress */}
      <div className="space-y-3 shrink-0">
        <div className="flex items-center justify-between">
          <button
            onClick={() => {
              stopCamera();
              stopAudio();
              setMode('matrix');
            }}
            className="p-2 rounded-xl bg-slate-900 text-slate-400 hover:text-white"
          >
            <Layers size={18} />
          </button>

          <div className="text-center">
            <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400">
              Teste {currentTestIndex + 1} de {tests.length}
            </span>
            <h3 className="text-xs font-bold text-slate-200 truncate max-w-[200px]">
              {currentTest.title}
            </h3>
          </div>

          <button
            onClick={() => updateTestStatus(currentTest.id, 'skipped')}
            className="px-2.5 py-1.5 rounded-xl bg-slate-900 text-[10px] font-bold text-slate-400 hover:text-white uppercase"
          >
            Pular
          </button>
        </div>

        {/* Barra de Progresso */}
        <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden">
          <div
            className="h-full bg-emerald-500 transition-all duration-300"
            style={{ width: `${((currentTestIndex + 1) / tests.length) * 100}%` }}
          />
        </div>
      </div>

      {/* ÁREA INTERATIVA DO TESTE ESPECÍFICO */}
      <div className="my-auto py-4 flex flex-col items-center justify-center text-center space-y-4">
        {/* 1. TESTE DE TOUCHSCREEN (GRADE DE TOQUE) */}
        {currentTest.id === 'touch_screen' && (
          <div className="w-full space-y-3">
            <p className="text-xs text-slate-400">
              Deslize o dedo por todos os blocos até preencher 100% da grade em verde:
            </p>
            <div 
              className="grid grid-cols-6 gap-1.5 p-3 bg-slate-900 border border-slate-800 rounded-3xl touch-none max-w-xs mx-auto aspect-[3/4]"
              onPointerMove={(e) => {
                const elements = document.elementsFromPoint(e.clientX, e.clientY);
                elements.forEach(el => {
                  const idx = el.getAttribute('data-touch-idx');
                  if (idx !== null) {
                    const num = parseInt(idx, 10);
                    if (!touchGrid[num]) {
                      setTouchGrid(prev => {
                        const next = [...prev];
                        next[num] = true;
                        return next;
                      });
                    }
                  }
                });
              }}
            >
              {touchGrid.map((filled, i) => (
                <div
                  key={i}
                  data-touch-idx={i}
                  onPointerDown={() => {
                    setTouchGrid(prev => {
                      const next = [...prev];
                      next[i] = true;
                      return next;
                    });
                  }}
                  className={`rounded-xl transition-colors duration-150 ${
                    filled ? 'bg-emerald-500 shadow-sm shadow-emerald-500/50' : 'bg-slate-800'
                  }`}
                />
              ))}
            </div>
            <div className="text-xs font-mono font-bold text-emerald-400">
              {Math.round((touchGrid.filter(Boolean).length / touchGrid.length) * 100)}% Coberto
            </div>
          </div>
        )}

        {/* 2. TESTE DE CÂMERA (TRASEIRA OU FRONTAL) */}
        {(currentTest.id === 'rear_camera' || currentTest.id === 'front_camera') && (
          <div className="w-full space-y-3">
            <p className="text-xs text-slate-400">
              {currentTest.id === 'rear_camera' ? 'Ative a câmera traseira e tire uma foto de teste:' : 'Verifique se a câmera selfie está nítida:'}
            </p>

            <div className="relative aspect-[3/4] max-w-xs mx-auto bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden flex flex-col items-center justify-center">
              {cameraStream ? (
                <>
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className={`w-full h-full object-cover ${currentTest.id === 'front_camera' ? 'scale-x-[-1]' : ''}`}
                  />
                  <div className="absolute bottom-3 flex items-center gap-3">
                    <button
                      onClick={capturePhoto}
                      className="p-4 bg-white text-slate-950 rounded-full shadow-xl active:scale-95"
                    >
                      <Camera size={20} />
                    </button>
                  </div>
                </>
              ) : cameraPhoto ? (
                <div className="relative w-full h-full">
                  <img src={cameraPhoto} className="w-full h-full object-cover" />
                  <button
                    onClick={() => setCameraPhoto(null)}
                    className="absolute top-2 right-2 p-2 bg-slate-900/80 text-white rounded-xl text-xs font-bold"
                  >
                    Tentar Novamente
                  </button>
                </div>
              ) : (
                <div className="p-6 text-center space-y-3">
                  <div className="w-14 h-14 rounded-2xl bg-slate-800 flex items-center justify-center mx-auto text-slate-400">
                    <Camera size={28} />
                  </div>
                  {cameraError ? (
                    <p className="text-xs text-red-400 font-bold">{cameraError}</p>
                  ) : (
                    <button
                      onClick={() => startCamera(currentTest.id === 'rear_camera' ? 'environment' : 'user')}
                      className="px-5 py-3 bg-emerald-500 text-slate-950 rounded-2xl font-black text-xs uppercase"
                    >
                      Abrir Câmera Agora
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* 3. TESTE DE ÁUDIO / ALTO-FALANTE */}
        {(currentTest.id === 'main_speaker' || currentTest.id === 'ear_speaker') && (
          <div className="w-full space-y-4">
            <div className="w-20 h-20 rounded-3xl bg-slate-900 border border-slate-800 flex items-center justify-center mx-auto text-emerald-400 shadow-xl">
              <Volume2 size={36} className={isPlayingAudio ? 'animate-bounce' : ''} />
            </div>
            <div>
              <h4 className="text-sm font-bold text-white">Teste de Saída de Som</h4>
              <p className="text-xs text-slate-400 mt-1">Toque no botão abaixo para reproduzir um som de alta fidelidade:</p>
            </div>
            <button
              onClick={playTestAudio}
              className={`px-6 py-4 rounded-2xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 mx-auto transition-all ${
                isPlayingAudio ? 'bg-emerald-400 text-slate-950 scale-105' : 'bg-slate-800 hover:bg-slate-700 text-white'
              }`}
            >
              <Play size={16} />
              <span>{isPlayingAudio ? 'Tocando Som...' : 'Tocar Som de Teste'}</span>
            </button>
          </div>
        )}

        {/* 4. TESTE DE MICROFONE */}
        {currentTest.id === 'main_microphone' && (
          <div className="w-full space-y-4">
            <div className="w-20 h-20 rounded-3xl bg-slate-900 border border-slate-800 flex items-center justify-center mx-auto text-emerald-400">
              <Mic size={36} className={isRecordingMic ? 'animate-pulse text-red-400' : ''} />
            </div>
            <div>
              <h4 className="text-sm font-bold text-white">Gravação & Retorno de Voz</h4>
              <p className="text-xs text-slate-400 mt-1">Fale "1, 2, 3 Testando" e ouça como sua voz foi captada:</p>
            </div>

            {/* VU Meter */}
            {isRecordingMic && (
              <div className="w-48 mx-auto h-3 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
                <div className="h-full bg-red-500 transition-all duration-75" style={{ width: `${micVolumeLevel}%` }} />
              </div>
            )}

            <div className="flex items-center justify-center gap-2">
              {!isRecordingMic ? (
                <button
                  onClick={startMicTest}
                  className="px-6 py-3.5 bg-red-500 text-white rounded-2xl font-black text-xs uppercase flex items-center gap-2"
                >
                  <Mic size={16} />
                  <span>Gravar 4 Segundos</span>
                </button>
              ) : (
                <button
                  onClick={stopMicTest}
                  className="px-6 py-3.5 bg-slate-800 text-red-400 rounded-2xl font-black text-xs uppercase flex items-center gap-2 animate-pulse"
                >
                  <Square size={16} />
                  <span>Gravando... Parar</span>
                </button>
              )}
            </div>

            {micAudioUrl && (
              <div className="pt-2 animate-in fade-in">
                <p className="text-xs text-emerald-400 font-bold mb-2">Áudio gravado! Ouça abaixo:</p>
                <audio controls src={micAudioUrl} className="mx-auto" />
              </div>
            )}
          </div>
        )}

        {/* 5. TESTE DE VIBRAÇÃO */}
        {currentTest.id === 'vibration' && (
          <div className="w-full space-y-4">
            <div className="w-20 h-20 rounded-3xl bg-slate-900 border border-slate-800 flex items-center justify-center mx-auto text-emerald-400">
              <Radio size={36} />
            </div>
            <div>
              <h4 className="text-sm font-bold text-white">Teste do Motor de Vibração</h4>
              <p className="text-xs text-slate-400 mt-1">Acione a vibração para sentir se o motor está firme e silencioso:</p>
            </div>
            <button
              onClick={triggerVibrate}
              className="px-6 py-4 bg-emerald-500 text-slate-950 rounded-2xl font-black text-xs uppercase tracking-wider mx-auto active:scale-95"
            >
              Vibrar Agora
            </button>
          </div>
        )}

        {/* 6. TESTE DE GIROSCÓPIO & INCLINAÇÃO */}
        {currentTest.id === 'gyroscope' && (
          <div className="w-full space-y-4">
            <div className="w-28 h-28 rounded-full bg-slate-900 border-2 border-slate-800 relative mx-auto flex items-center justify-center overflow-hidden">
              {/* Bolha de Nível */}
              <div
                className={`w-10 h-10 rounded-full transition-transform duration-100 ${
                  tiltTargetReached ? 'bg-emerald-500 shadow-lg shadow-emerald-500/50' : 'bg-blue-500'
                }`}
                style={{
                  transform: `translate(${Math.min(40, Math.max(-40, tilt.gamma))}px, ${Math.min(40, Math.max(-40, tilt.beta - 45))}px)`
                }}
              />
            </div>
            <div>
              <h4 className="text-sm font-bold text-white">Incline o Aparelho</h4>
              <p className="text-xs text-slate-400 mt-1">Incline seu celular para os lados para testar o sensor:</p>
            </div>
            <p className="text-xs font-mono font-bold text-emerald-400">
              {tiltTargetReached ? '✓ Sensor de Rotação Aprovado!' : 'Incline o telefone...'}
            </p>
          </div>
        )}

        {/* 7. TESTE DE BATERIA & ENERGIA */}
        {currentTest.id === 'battery_status' && (
          <div className="w-full space-y-4">
            <div className="w-20 h-20 rounded-3xl bg-slate-900 border border-slate-800 flex items-center justify-center mx-auto text-emerald-400">
              <Battery size={36} />
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 max-w-xs mx-auto text-left space-y-1.5">
              <p className="text-xs text-slate-400">Nível Detectado: <strong className="text-white font-mono">{batteryInfo.level !== undefined ? `${batteryInfo.level}%` : 'Lendo...'}</strong></p>
              <p className="text-xs text-slate-400">Status do Cabo: <strong className="text-white">{batteryInfo.charging ? '⚡ Conectado / Carregando' : '🔋 Na Bateria'}</strong></p>
            </div>
          </div>
        )}

        {/* 8. TESTES GERAIS / PADRÃO */}
        {!['touch_screen', 'rear_camera', 'front_camera', 'main_speaker', 'ear_speaker', 'main_microphone', 'vibration', 'gyroscope', 'battery_status'].includes(currentTest.id) && (
          <div className="w-full space-y-3">
            <div className="w-16 h-16 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center mx-auto text-emerald-400">
              <Smartphone size={32} />
            </div>
            <div>
              <h4 className="text-sm font-bold text-white">{currentTest.title}</h4>
              <p className="text-xs text-slate-400 max-w-xs mx-auto mt-1 leading-relaxed">{currentTest.description}</p>
            </div>
          </div>
        )}
      </div>

      {/* BOTÕES DE DECISÃO DO ITEM ATUAL */}
      <div className="space-y-2.5 pt-4 shrink-0">
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => updateTestStatus(currentTest.id, 'passed')}
            className="py-4 bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-2xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 active:scale-95 transition-all"
          >
            <CheckCircle2 size={18} />
            <span>Aprovado</span>
          </button>

          <button
            onClick={() => setShowNoteModal(currentTest.id)}
            className="py-4 bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/40 rounded-2xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 active:scale-95 transition-all"
          >
            <XCircle size={18} />
            <span>Apresenta Defeito</span>
          </button>
        </div>

        <div className="flex items-center justify-between text-xs text-slate-500 px-1 pt-1">
          <button
            onClick={() => {
              if (currentTestIndex > 0) setCurrentTestIndex(prev => prev - 1);
            }}
            disabled={currentTestIndex === 0}
            className="disabled:opacity-30 hover:text-slate-400"
          >
            ← Anterior
          </button>
          <button
            onClick={() => {
              stopCamera();
              stopAudio();
              if (currentTestIndex < tests.length - 1) {
                setCurrentTestIndex(prev => prev + 1);
              } else {
                setMode('completed');
              }
            }}
            className="hover:text-slate-400 font-bold"
          >
            Próximo →
          </button>
        </div>
      </div>

      {/* Modal para Adicionar Observação ao Reprovar */}
      {showNoteModal && (
        <div className="fixed inset-0 bg-slate-950/90 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-sm rounded-3xl p-6 space-y-4">
            <h3 className="text-sm font-black text-white uppercase">Registrar Defeito</h3>
            <p className="text-xs text-slate-400">Qual foi a falha observada nesta função?</p>
            <input
              type="text"
              autoFocus
              value={itemNoteInput}
              onChange={e => setItemNoteInput(e.target.value)}
              placeholder="Ex: Não sai som, chiando, toque falhando..."
              className="w-full p-3.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white outline-none focus:border-red-500"
            />
            <div className="flex gap-2">
              <button
                onClick={() => {
                  updateTestStatus(showNoteModal, 'failed', itemNoteInput || 'Defeito constatado');
                  setItemNoteInput('');
                  setShowNoteModal(null);
                }}
                className="flex-1 py-3 bg-red-500 text-white rounded-xl font-bold text-xs uppercase"
              >
                Salvar Defeito
              </button>
              <button
                onClick={() => setShowNoteModal(null)}
                className="py-3 px-4 bg-slate-800 text-slate-400 rounded-xl font-bold text-xs"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InteractiveChecklistRunner;
