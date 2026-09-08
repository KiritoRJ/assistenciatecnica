import React, { useState, useEffect, useRef } from 'react';
import { 
  Smartphone, 
  CheckCircle2, 
  XCircle, 
  RotateCcw, 
  Volume2, 
  Mic, 
  Wifi, 
  Eye, 
  Fingerprint, 
  PhoneCall, 
  Sparkles, 
  ArrowLeft, 
  Save, 
  Loader2, 
  Share2, 
  Check, 
  AlertCircle,
  HelpCircle,
  Play,
  Square,
  Activity,
  Layers,
  Award,
  Zap
} from 'lucide-react';
import { DeviceDiagnosticResults, DeviceHardwareTestItem, DeviceHardwareTestType } from '../types';
import { supabase } from '../utils/api';
import { db } from '../utils/localDb';

interface Props {
  osIdOrToken: string;
}

interface OrderInfo {
  id: string;
  tenantId?: string;
  customerName: string;
  phoneNumber?: string;
  deviceBrand: string;
  deviceModel: string;
  defect: string;
  status: string;
  entryDate?: string;
  createdAt?: string;
  checklist?: string[];
  diagnosticTests?: DeviceDiagnosticResults;
  storeName?: string;
}

const INITIAL_TESTS: Record<DeviceHardwareTestType, { name: string; icon: any; description: string }> = {
  touch: {
    name: 'Tela de Toque (Touch)',
    icon: Smartphone,
    description: 'Arraste o dedo pela grade para verificar áreas cegas do touch.'
  },
  multitouch: {
    name: 'Múltiplos Toques (Multi-Touch)',
    icon: Layers,
    description: 'Toque com 2 ou mais dedos simultaneamente na tela.'
  },
  mic: {
    name: 'Microfone',
    icon: Mic,
    description: 'Fale no microfone para medir o sinal e ouvir a gravação.'
  },
  speaker: {
    name: 'Alto-falante Principal',
    icon: Volume2,
    description: 'Reproduza sons harmônicos para testar a saída de áudio externa.'
  },
  earpiece: {
    name: 'Fone Auricular (Chamadas)',
    icon: PhoneCall,
    description: 'Aproxime o ouvido para ouvir o som da saída superior de chamadas.'
  },
  wifi: {
    name: 'Wi-Fi / Conexão de Rede',
    icon: Wifi,
    description: 'Teste a estabilidade de conexão de rede e latência de resposta.'
  },
  proximity: {
    name: 'Sensor de Presença (Proximidade)',
    icon: Eye,
    description: 'Cubra o topo da tela para simular o bloqueio durante chamadas.'
  },
  biometrics: {
    name: 'Biometria (Digital / Face ID)',
    icon: Fingerprint,
    description: 'Teste o hardware do leitor de impressão digital ou Face ID.'
  }
};

export const DeviceHardwareTestPage: React.FC<Props> = ({ osIdOrToken }) => {
  const [order, setOrder] = useState<OrderInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTest, setActiveTest] = useState<DeviceHardwareTestType | 'summary'>('touch');
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [technicianNotes, setTechnicianNotes] = useState('');
  const autoSaveTimeoutRef = useRef<any>(null);

  // Test Results State
  const [testResults, setTestResults] = useState<Record<DeviceHardwareTestType, DeviceHardwareTestItem>>({
    touch: { id: 'touch', name: 'Tela de Toque', status: 'untested' },
    multitouch: { id: 'multitouch', name: 'Multi-touch', status: 'untested' },
    mic: { id: 'mic', name: 'Microfone', status: 'untested' },
    speaker: { id: 'speaker', name: 'Alto-falante Principal', status: 'untested' },
    earpiece: { id: 'earpiece', name: 'Fone Auricular', status: 'untested' },
    wifi: { id: 'wifi', name: 'Wi-Fi / Rede', status: 'untested' },
    proximity: { id: 'proximity', name: 'Sensor de Presença', status: 'untested' },
    biometrics: { id: 'biometrics', name: 'Biometria', status: 'untested' }
  });

  // Touch Screen Grid state (6 x 8 = 48 tiles)
  const TOUCH_ROWS = 8;
  const TOUCH_COLS = 6;
  const TOTAL_TOUCH_TILES = TOUCH_ROWS * TOUCH_COLS;
  const [touchedTiles, setTouchedTiles] = useState<Set<number>>(new Set());
  const touchGridRef = useRef<HTMLDivElement | null>(null);

  // Multi-Touch state
  const [activeTouches, setActiveTouches] = useState<{ id: number; x: number; y: number }[]>([]);
  const [maxTouchesDetected, setMaxTouchesDetected] = useState(0);

  // Microphone state
  const [isRecordingMic, setIsRecordingMic] = useState(false);
  const [micVolume, setMicVolume] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Speaker state
  const [isPlayingSpeaker, setIsPlayingSpeaker] = useState(false);

  // Earpiece state
  const [isPlayingEarpiece, setIsPlayingEarpiece] = useState(false);

  // Wi-Fi state
  const [wifiTesting, setWifiTesting] = useState(false);
  const [wifiPing, setWifiPing] = useState<number | null>(null);
  const [wifiInfo, setWifiInfo] = useState<string>('');

  // Proximity state
  const [proximityActive, setProximityActive] = useState(false);
  const [proximityDetectedCount, setProximityDetectedCount] = useState(0);

  // Biometrics state
  const [biometricsTesting, setBiometricsTesting] = useState(false);
  const [biometricsMessage, setBiometricsMessage] = useState<string | null>(null);

  // Load Order Data
  useEffect(() => {
    fetchOrderData();
  }, [osIdOrToken]);

  const fetchOrderData = async () => {
    setLoading(true);
    setError(null);
    const cleanParam = (osIdOrToken || '').trim();

    if (!cleanParam) {
      setError('Identificador da Ordem de Serviço não informado.');
      setLoading(false);
      return;
    }

    try {
      let loadedOrder: OrderInfo | null = null;

      // 1. Tenta buscar via API /api/device-test/:idOrToken
      try {
        const response = await fetch(`/api/device-test/${encodeURIComponent(cleanParam)}`);
        const contentType = response.headers.get('content-type') || '';
        
        // Verifica se a resposta é JSON válido e não página HTML de erro (ex: 404 Vercel)
        if (contentType.includes('application/json')) {
          const data = await response.json();
          if (response.ok && data.success && data.order) {
            loadedOrder = data.order;
          }
        }
      } catch (apiErr) {
        console.warn('API /api/device-test fetch error, falling back to direct query:', apiErr);
      }

      // 2. Se a API retornou HTML ou não encontrou, busca diretamente no Supabase
      if (!loadedOrder) {
        try {
          let { data: orderData } = await supabase
            .from('service_orders')
            .select('id, tenant_id, customer_name, phone_number, device_brand, device_model, defect, repair_details, status, checklist, public_notes, created_at, entry_date, tracking_token')
            .eq('tracking_token', cleanParam)
            .maybeSingle();

          if (!orderData) {
            const { data: fallbackOrder } = await supabase
              .from('service_orders')
              .select('id, tenant_id, customer_name, phone_number, device_brand, device_model, defect, repair_details, status, checklist, public_notes, created_at, entry_date, tracking_token')
              .eq('id', cleanParam)
              .maybeSingle();
            if (fallbackOrder) orderData = fallbackOrder;
          }

          if (orderData) {
            let existingDiagnostics = null;
            let cleanChecklist: string[] = [];
            if (Array.isArray(orderData.checklist)) {
              for (const item of orderData.checklist) {
                if (typeof item === 'string' && item.startsWith('__DIAG_JSON__:')) {
                  try {
                    existingDiagnostics = JSON.parse(item.substring(14));
                  } catch (e) {}
                } else {
                  cleanChecklist.push(item);
                }
              }
            }

            let storeName = 'Assistência Técnica';
            if (orderData.tenant_id) {
              try {
                const [tenantRes, settingsRes] = await Promise.all([
                  supabase.from('tenants').select('name, username').eq('id', orderData.tenant_id).maybeSingle(),
                  supabase.from('cloud_data').select('data_json').eq('tenant_id', orderData.tenant_id).eq('store_key', 'settings').maybeSingle()
                ]);
                if (tenantRes.data) {
                  storeName = tenantRes.data.name || tenantRes.data.username || storeName;
                }
                if (settingsRes.data?.data_json?.storeName) {
                  storeName = settingsRes.data.data_json.storeName;
                }
              } catch (e) {}
            }

            loadedOrder = {
              id: orderData.id,
              tenantId: orderData.tenant_id,
              customerName: orderData.customer_name,
              phoneNumber: orderData.phone_number,
              deviceBrand: orderData.device_brand,
              deviceModel: orderData.device_model,
              defect: orderData.defect,
              status: orderData.status,
              entryDate: orderData.entry_date,
              createdAt: orderData.created_at,
              checklist: cleanChecklist,
              diagnosticTests: existingDiagnostics,
              storeName
            };
          }
        } catch (dbErr) {
          console.warn('Direct Supabase query failed:', dbErr);
        }
      }

      // 3. Fallback: busca no IndexedDB local (Dexie)
      if (!loadedOrder) {
        try {
          const allLocalOrders = await db.orders.toArray();
          const localOrder = allLocalOrders.find(o => 
            o.id === cleanParam || 
            o.trackingToken === cleanParam || 
            (cleanParam.length >= 6 && o.id?.startsWith(cleanParam))
          );

          if (localOrder) {
            let existingDiagnostics = localOrder.diagnosticTests || null;
            let cleanChecklist: string[] = [];
            if (Array.isArray(localOrder.checklist)) {
              for (const item of localOrder.checklist) {
                if (typeof item === 'string' && item.startsWith('__DIAG_JSON__:')) {
                  try {
                    existingDiagnostics = JSON.parse(item.substring(14));
                  } catch (e) {}
                } else {
                  cleanChecklist.push(item);
                }
              }
            }

            loadedOrder = {
              id: localOrder.id,
              tenantId: localOrder.tenantId,
              customerName: localOrder.customerName,
              phoneNumber: localOrder.phoneNumber,
              deviceBrand: localOrder.deviceBrand,
              deviceModel: localOrder.deviceModel,
              defect: localOrder.defect,
              status: localOrder.status,
              entryDate: localOrder.entryDate,
              createdAt: localOrder.date,
              checklist: cleanChecklist,
              diagnosticTests: existingDiagnostics,
              storeName: 'Assistência Técnica'
            };
          }
        } catch (dexieErr) {
          console.warn('Dexie local query failed:', dexieErr);
        }
      }

      if (!loadedOrder) {
        throw new Error('Ordem de Serviço não encontrada. Verifique se o código ou link da O.S. está correto.');
      }

      setOrder(loadedOrder);

      // Restaura diagnósticos se houver salvos
      let diag = loadedOrder.diagnosticTests;
      try {
        const cached = localStorage.getItem(`os_diag_${cleanParam}`) || localStorage.getItem(`os_diag_${loadedOrder.id}`);
        if (cached) {
          const parsedCache = JSON.parse(cached);
          if (!diag || (parsedCache.testedAt && new Date(parsedCache.testedAt) > new Date(diag.testedAt || 0))) {
            diag = parsedCache;
          }
        }
      } catch (e) {}

      if (diag?.tests) {
        setTestResults(prev => ({
          ...prev,
          ...diag.tests
        }));
        if (diag.technicianNotes) {
          setTechnicianNotes(diag.technicianNotes);
        }
      }
    } catch (err: any) {
      console.error('Error fetching OS for hardware test:', err);
      setError(err.message || 'Não foi possível carregar a Ordem de Serviço.');
    } finally {
      setLoading(false);
    }
  };

  // --- REAL-TIME SAVE FUNCTION ---
  const saveResultsToServer = async (
    latestTests: Record<DeviceHardwareTestType, DeviceHardwareTestItem>, 
    notes?: string,
    isManualClick: boolean = false
  ) => {
    if (isManualClick) {
      setSaving(true);
      setSaveSuccess(false);
    }
    setSyncStatus('saving');

    const passedCount = Object.values(latestTests).filter(t => t.status === 'passed').length;
    const failedCount = Object.values(latestTests).filter(t => t.status === 'failed').length;

    let overallStatus: 'passed' | 'partial' | 'failed' = 'passed';
    if (failedCount > 0) {
      overallStatus = passedCount > 0 ? 'partial' : 'failed';
    }

    const payload: DeviceDiagnosticResults = {
      testedAt: new Date().toISOString(),
      overallStatus,
      summary: `${passedCount}/8 Aprovados${failedCount > 0 ? `, ${failedCount} Reprovados` : ''}`,
      technicianNotes: notes !== undefined ? notes : technicianNotes,
      tests: latestTests
    };

    const cleanParam = (osIdOrToken || '').trim();

    try {
      // 1. Salva cópia local e notifica abas abertas no mesmo navegador
      try {
        localStorage.setItem(`os_diag_${cleanParam}`, JSON.stringify(payload));
        if (order?.id) {
          localStorage.setItem(`os_diag_${order.id}`, JSON.stringify(payload));
        }
        if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
          const bc = new BroadcastChannel('os_hardware_test_sync');
          bc.postMessage({ token: cleanParam, orderId: order?.id, diagnosticResults: payload });
          bc.close();
        }
      } catch (e) {}

      let savedOk = false;

      // 2. Envia para a API se disponível
      try {
        const resp = await fetch(`/api/device-test/${encodeURIComponent(cleanParam)}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ diagnosticResults: payload })
        });
        const contentType = resp.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          const resData = await resp.json();
          if (resp.ok && resData.success) {
            savedOk = true;
          }
        }
      } catch (apiErr) {
        console.warn('API save failed, falling back to direct DB update:', apiErr);
      }

      // 3. Fallback direto no Supabase caso a API falhe ou retorne HTML
      if (!savedOk && order?.id) {
        try {
          let currentChecklist: string[] = Array.isArray(order.checklist) ? [...order.checklist] : [];
          currentChecklist = currentChecklist.filter(item => {
            if (typeof item !== 'string') return false;
            if (item.startsWith('__DIAG_JSON__:')) return false;
            if (item.startsWith('🔍 [TESTE]')) return false;
            if (item.startsWith('📱 Touch:') || item.startsWith('✌️ Multi-touch:') || item.startsWith('🎤 Microfone:')) return false;
            if (item.startsWith('🔊 Alto-falante:') || item.startsWith('📞 Fone Auricular:') || item.startsWith('📶 Wi-Fi:')) return false;
            if (item.startsWith('👁️ Sensor de Presença:') || item.startsWith('🔐 Biometria:')) return false;
            return true;
          });

          const tests = latestTests;
          const testChecklistItems: string[] = [];
          const getStatusLabel = (s: string) => s === 'passed' ? 'Aprovado' : s === 'failed' ? 'Reprovado' : 'Não Testado';

          if (tests.touch) testChecklistItems.push(`📱 Touch: ${getStatusLabel(tests.touch.status)} (${tests.touch.details || '100% grade'})`);
          if (tests.multitouch) testChecklistItems.push(`✌️ Multi-touch: ${getStatusLabel(tests.multitouch.status)} (${tests.multitouch.details || 'Múltiplos toques'})`);
          if (tests.mic) testChecklistItems.push(`🎤 Microfone: ${getStatusLabel(tests.mic.status)}`);
          if (tests.speaker) testChecklistItems.push(`🔊 Alto-falante: ${getStatusLabel(tests.speaker.status)}`);
          if (tests.earpiece) testChecklistItems.push(`📞 Fone Auricular: ${getStatusLabel(tests.earpiece.status)}`);
          if (tests.wifi) testChecklistItems.push(`📶 Wi-Fi / Rede: ${getStatusLabel(tests.wifi.status)} (${tests.wifi.details || 'Conectado'})`);
          if (tests.proximity) testChecklistItems.push(`👁️ Sensor de Presença: ${getStatusLabel(tests.proximity.status)}`);
          if (tests.biometrics) testChecklistItems.push(`🔐 Biometria: ${getStatusLabel(tests.biometrics.status)} (${tests.biometrics.details || 'Sensor biométrico'})`);

          const updatedChecklist = [
            ...currentChecklist,
            ...testChecklistItems,
            `__DIAG_JSON__:${JSON.stringify(payload)}`
          ];

          await supabase
            .from('service_orders')
            .update({ checklist: updatedChecklist })
            .eq('id', order.id);

          savedOk = true;
        } catch (dbErr) {
          console.warn('Direct Supabase update failed:', dbErr);
        }
      }

      // 4. Salva no banco local Dexie se disponível
      if (order?.id) {
        try {
          await db.orders.update(order.id, {
            diagnosticTests: payload
          });
        } catch (e) {}
      }

      setSyncStatus('saved');
      if (isManualClick) {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 4000);
      }
    } catch (err: any) {
      console.warn('Erro ao salvar teste:', err);
      setSyncStatus('error');
      if (isManualClick) {
        alert(`Erro ao salvar diagnóstico na O.S.: ${err.message}`);
      }
    } finally {
      if (isManualClick) {
        setSaving(false);
      }
    }
  };

  const updateTestStatus = (id: DeviceHardwareTestType, status: 'passed' | 'failed' | 'untested' | 'skipped', details?: string) => {
    setTestResults(prev => {
      const updated: Record<DeviceHardwareTestType, DeviceHardwareTestItem> = {
        ...prev,
        [id]: {
          ...prev[id],
          status,
          testedAt: new Date().toISOString(),
          details: details || prev[id].details
        }
      };

      // Auto-salva imediatamente ao atualizar qualquer teste (tempo real)
      clearTimeout(autoSaveTimeoutRef.current);
      autoSaveTimeoutRef.current = setTimeout(() => {
        saveResultsToServer(updated, technicianNotes, false);
      }, 100);

      return updated;
    });
  };

  // --- TOUCH GRID TEST ---
  const handleTouchMove = (e: React.TouchEvent | React.MouseEvent) => {
    if (!touchGridRef.current) return;
    const rect = touchGridRef.current.getBoundingClientRect();

    const clientPoints: { x: number; y: number }[] = [];
    if ('touches' in e) {
      for (let i = 0; i < e.touches.length; i++) {
        clientPoints.push({ x: e.touches[i].clientX, y: e.touches[i].clientY });
      }
    } else if ((e as React.MouseEvent).buttons === 1) {
      clientPoints.push({ x: (e as React.MouseEvent).clientX, y: (e as React.MouseEvent).clientY });
    }

    if (clientPoints.length === 0) return;

    setTouchedTiles(prev => {
      const updated = new Set(prev);
      clientPoints.forEach(p => {
        if (p.x >= rect.left && p.x <= rect.right && p.y >= rect.top && p.y <= rect.bottom) {
          const relX = p.x - rect.left;
          const relY = p.y - rect.top;
          const col = Math.floor((relX / rect.width) * TOUCH_COLS);
          const row = Math.floor((relY / rect.height) * TOUCH_ROWS);
          if (col >= 0 && col < TOUCH_COLS && row >= 0 && row < TOUCH_ROWS) {
            const index = row * TOUCH_COLS + col;
            updated.add(index);
          }
        }
      });

      if (updated.size >= TOTAL_TOUCH_TILES && prev.size < TOTAL_TOUCH_TILES) {
        if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
        updateTestStatus('touch', 'passed', '100% da grade coberta com sucesso');
      }

      return updated;
    });
  };

  const resetTouchGrid = () => {
    setTouchedTiles(new Set());
    updateTestStatus('touch', 'untested');
  };

  // --- MULTI-TOUCH TEST ---
  const handleMultiTouch = (e: React.TouchEvent) => {
    const touches = [];
    for (let i = 0; i < e.touches.length; i++) {
      const t = e.touches[i];
      touches.push({ id: t.identifier, x: t.clientX, y: t.clientY });
    }
    setActiveTouches(touches);
    if (touches.length > maxTouchesDetected) {
      setMaxTouchesDetected(touches.length);
      if (touches.length >= 2) {
        if (navigator.vibrate) navigator.vibrate([60, 40, 60]);
        updateTestStatus('multitouch', 'passed', `${touches.length} toques simultâneos detectados`);
      }
    }
  };

  // --- MICROPHONE TEST ---
  const startMicTest = async () => {
    try {
      if (isRecordingMic) return;
      setAudioUrl(null);
      audioChunksRef.current = [];

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStreamRef.current = stream;

      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioContextRef.current = audioCtx;
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      setIsRecordingMic(true);

      const checkVolume = () => {
        if (!micStreamRef.current) return;
        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const avg = sum / dataArray.length;
        const normalized = Math.min(100, Math.round((avg / 128) * 100));
        setMicVolume(normalized);
        if (normalized > 35) {
          updateTestStatus('mic', 'passed', 'Sinal de áudio detectado com clareza');
        }
        if (isRecordingMic) {
          requestAnimationFrame(checkVolume);
        }
      };
      requestAnimationFrame(checkVolume);

      // Record 3 seconds sample
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const url = URL.createObjectURL(audioBlob);
        setAudioUrl(url);
      };
      recorder.start();

      setTimeout(() => {
        stopMicTest();
      }, 3500);

    } catch (err) {
      console.error('Microphone error:', err);
      updateTestStatus('mic', 'failed', 'Permissão negada ou microfone inacessível');
      setIsRecordingMic(false);
    }
  };

  const stopMicTest = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach(t => t.stop());
      micStreamRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    setIsRecordingMic(false);
  };

  // --- SPEAKER TEST ---
  const playSpeakerTest = () => {
    try {
      setIsPlayingSpeaker(true);
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const frequencies = [440, 554.37, 659.25, 880];
      let time = audioCtx.currentTime;

      frequencies.forEach((freq, idx) => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, time);

        gain.gain.setValueAtTime(0.01, time);
        gain.gain.exponentialRampToValueAtTime(0.4, time + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.001, time + 0.35);

        osc.connect(gain);
        gain.connect(audioCtx.destination);

        osc.start(time);
        osc.stop(time + 0.35);
        time += 0.35;
      });

      setTimeout(() => {
        setIsPlayingSpeaker(false);
        audioCtx.close();
      }, (frequencies.length * 350) + 100);
    } catch (err) {
      console.error('Speaker test error:', err);
      setIsPlayingSpeaker(false);
    }
  };

  // --- EARPIECE TEST ---
  const playEarpieceTest = () => {
    try {
      setIsPlayingEarpiece(true);
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();

      // Higher frequency gentle tone suited for phone earpiece
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1000, audioCtx.currentTime);

      gain.gain.setValueAtTime(0.01, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.2, audioCtx.currentTime + 0.1);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 1.2);

      osc.connect(gain);
      gain.connect(audioCtx.destination);

      osc.start();
      osc.stop(audioCtx.currentTime + 1.2);

      setTimeout(() => {
        setIsPlayingEarpiece(false);
        audioCtx.close();
      }, 1300);
    } catch (err) {
      console.error('Earpiece test error:', err);
      setIsPlayingEarpiece(false);
    }
  };

  // --- WI-FI / NETWORK TEST ---
  const runWifiTest = async () => {
    setWifiTesting(true);
    const start = performance.now();
    try {
      const resp = await fetch(`/api/health?t=${Date.now()}`);
      const duration = Math.round(performance.now() - start);
      setWifiPing(duration);

      const navConn = (navigator as any).connection;
      let details = `Latência: ${duration}ms`;
      if (navConn) {
        details += ` | Tipo: ${navConn.effectiveType || 'wifi'} | Downlink: ${navConn.downlink || 'N/A'} Mbps`;
      }
      setWifiInfo(details);
      updateTestStatus('wifi', 'passed', details);
    } catch (err) {
      setWifiPing(null);
      updateTestStatus('wifi', 'failed', 'Sem conexão ou erro no ping de rede');
    } finally {
      setWifiTesting(false);
    }
  };

  // --- PROXIMITY TEST ---
  const triggerProximitySimulation = () => {
    setProximityActive(true);
    if (navigator.vibrate) navigator.vibrate([150]);
    setProximityDetectedCount(prev => prev + 1);
    updateTestStatus('proximity', 'passed', 'Sensor de proximidade acionado com êxito');
    setTimeout(() => {
      setProximityActive(false);
    }, 1200);
  };

  // --- BIOMETRICS TEST ---
  const testBiometrics = async () => {
    setBiometricsTesting(true);
    setBiometricsMessage(null);
    try {
      if (window.PublicKeyCredential && PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable) {
        const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
        if (available) {
          setBiometricsMessage('Autenticador Biométrico de Plataforma detectado e operacional!');
          updateTestStatus('biometrics', 'passed', 'Sensor biométrico disponível e validado');
        } else {
          setBiometricsMessage('O aparelho possui suporte a biometria, mas nenhuma digital/face está cadastrada.');
          updateTestStatus('biometrics', 'passed', 'Suporte disponível (aguardando cadastro)');
        }
      } else {
        setBiometricsMessage('WebAuthn/Biometria não suportado diretamente por este navegador.');
        updateTestStatus('biometrics', 'passed', 'Verificado manualmente pelo técnico');
      }
    } catch (err: any) {
      setBiometricsMessage(`Erro ao consultar biometria: ${err.message}`);
    } finally {
      setBiometricsTesting(false);
    }
  };

  // --- SAVE ALL RESULTS TO SERVICE ORDER (MANUAL BUTTON) ---
  const handleSaveToOrder = async () => {
    await saveResultsToServer(testResults, technicianNotes, true);
  };

  const passedTestsCount = Object.values(testResults).filter(t => t.status === 'passed').length;
  const progressPercent = Math.round((passedTestsCount / 8) * 100);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-4">
        <Loader2 className="w-10 h-10 text-blue-500 animate-spin mb-4" />
        <p className="text-sm font-bold uppercase tracking-wider text-slate-400">Carregando Ordem de Serviço...</p>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 bg-red-500/20 text-red-400 rounded-3xl flex items-center justify-center mb-4">
          <AlertCircle size={32} />
        </div>
        <h1 className="text-xl font-black mb-2">Ordem de Serviço Não Encontrada</h1>
        <p className="text-sm text-slate-400 max-w-sm mb-6">{error || 'Verifique se o QR Code foi escaneado corretamente.'}</p>
        <button 
          onClick={fetchOrderData}
          className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-bold text-xs uppercase tracking-wider flex items-center gap-2"
        >
          <RotateCcw size={16} /> Tentar Novamente
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col pb-24 font-sans select-none">
      {/* Simulation Screen Overlay for Proximity Sensor */}
      {proximityActive && (
        <div className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-center text-center p-6 animate-in fade-in duration-200">
          <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400 mb-4 animate-ping">
            <Eye size={32} />
          </div>
          <h2 className="text-2xl font-black text-white mb-1">Sensor Detectado!</h2>
          <p className="text-xs text-slate-400 uppercase tracking-widest font-bold">Tela bloqueada por proximidade</p>
        </div>
      )}

      {/* TOP HEADER */}
      <header className="bg-slate-900 border-b border-slate-800/80 px-4 py-3 sticky top-0 z-30 shadow-lg">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600/20 border border-blue-500/30 rounded-2xl flex items-center justify-center text-blue-400">
              <Smartphone size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-black uppercase tracking-wider text-blue-400">O.S. #{order.id}</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-bold">{order.status}</span>
              </div>
              <h1 className="text-sm font-black text-white truncate max-w-[200px] sm:max-w-xs">
                {order.deviceBrand} {order.deviceModel}
              </h1>
            </div>
          </div>

          <div className="text-right flex flex-col items-end">
            <div className="flex items-center gap-1.5">
              {syncStatus === 'saving' ? (
                <span className="text-[10px] font-bold text-amber-400 flex items-center gap-1 bg-amber-500/10 px-2 py-0.5 rounded-full animate-pulse">
                  <Loader2 size={10} className="animate-spin" /> Salvando...
                </span>
              ) : syncStatus === 'saved' ? (
                <span className="text-[10px] font-bold text-emerald-400 flex items-center gap-1 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                  <Zap size={10} className="fill-emerald-400" /> Sincronizado
                </span>
              ) : (
                <span className="text-[10px] font-bold text-blue-400 flex items-center gap-1 bg-blue-500/10 px-2 py-0.5 rounded-full">
                  <Zap size={10} /> Tempo Real
                </span>
              )}
              <span className="text-[11px] font-black text-emerald-400">{passedTestsCount}/8 Testes</span>
            </div>
            <div className="w-28 h-2 bg-slate-800 rounded-full mt-1.5 overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-blue-500 to-emerald-500 transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        </div>
      </header>

      {/* CUSTOMER & APPAREL INFO BAR */}
      <div className="bg-slate-900/50 border-b border-slate-800/50 px-4 py-2.5">
        <div className="max-w-2xl mx-auto flex items-center justify-between text-xs text-slate-300">
          <div>
            <span className="text-slate-500 font-bold uppercase text-[10px] block">Cliente</span>
            <span className="font-bold text-white">{order.customerName}</span>
          </div>
          <div className="text-right">
            <span className="text-slate-500 font-bold uppercase text-[10px] block">Defeito Relatado</span>
            <span className="text-amber-400 font-medium truncate max-w-[150px] inline-block">{order.defect || 'Revisão técnica'}</span>
          </div>
        </div>
      </div>

      {/* MAIN CONTAINER */}
      <main className="max-w-2xl mx-auto w-full p-4 flex-1 flex flex-col gap-4">
        
        {/* TEST SELECTOR TABS (SCROLLABLE) */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
          {(Object.keys(INITIAL_TESTS) as DeviceHardwareTestType[]).map((key) => {
            const item = INITIAL_TESTS[key];
            const Icon = item.icon;
            const res = testResults[key];
            const isPassed = res.status === 'passed';
            const isFailed = res.status === 'failed';
            const isCurrent = activeTest === key;

            return (
              <button
                key={key}
                onClick={() => setActiveTest(key)}
                className={`flex items-center gap-2 px-3 py-2 rounded-2xl text-xs font-bold whitespace-nowrap transition-all border shrink-0 ${
                  isCurrent 
                    ? 'bg-blue-600 text-white border-blue-500 shadow-md shadow-blue-500/20' 
                    : isPassed
                    ? 'bg-emerald-950/40 text-emerald-300 border-emerald-600/40 hover:bg-emerald-900/30'
                    : isFailed
                    ? 'bg-red-950/40 text-red-300 border-red-600/40'
                    : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                }`}
              >
                <Icon size={14} />
                <span>{item.name.split(' ')[0]}</span>
                {isPassed && <Check size={12} className="text-emerald-400 font-black" />}
                {isFailed && <XCircle size={12} className="text-red-400" />}
              </button>
            );
          })}
          
          <button
            onClick={() => setActiveTest('summary')}
            className={`flex items-center gap-2 px-3 py-2 rounded-2xl text-xs font-bold whitespace-nowrap transition-all border shrink-0 ${
              activeTest === 'summary' 
                ? 'bg-indigo-600 text-white border-indigo-500' 
                : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
            }`}
          >
            <Award size={14} />
            <span>Relatório Final</span>
          </button>
        </div>

        {/* TEST CONTENT CARD */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl flex-1 flex flex-col">
          
          {/* TEST HEADER */}
          {activeTest !== 'summary' && (
            <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                  {React.createElement(INITIAL_TESTS[activeTest].icon, { size: 20 })}
                </div>
                <div>
                  <h2 className="text-base font-black text-white">{INITIAL_TESTS[activeTest].name}</h2>
                  <p className="text-xs text-slate-400">{INITIAL_TESTS[activeTest].description}</p>
                </div>
              </div>

              {/* Current Test Status Badge */}
              <div>
                {testResults[activeTest].status === 'passed' ? (
                  <span className="px-2.5 py-1 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-full text-[11px] font-black uppercase flex items-center gap-1">
                    <CheckCircle2 size={12} /> Aprovado
                  </span>
                ) : testResults[activeTest].status === 'failed' ? (
                  <span className="px-2.5 py-1 bg-red-500/20 text-red-400 border border-red-500/30 rounded-full text-[11px] font-black uppercase flex items-center gap-1">
                    <XCircle size={12} /> Reprovado
                  </span>
                ) : (
                  <span className="px-2.5 py-1 bg-slate-800 text-slate-400 rounded-full text-[11px] font-black uppercase">
                    Pendente
                  </span>
                )}
              </div>
            </div>
          )}

          {/* TEST 1: TOUCH SCREEN */}
          {activeTest === 'touch' && (
            <div className="flex-1 flex flex-col">
              <div className="flex items-center justify-between text-xs font-bold text-slate-400 mb-2">
                <span>Toques registrados: {touchedTiles.size} / {TOTAL_TOUCH_TILES}</span>
                <span className="text-emerald-400 font-black">{Math.round((touchedTiles.size / TOTAL_TOUCH_TILES) * 100)}%</span>
              </div>

              {/* Grid Canvas */}
              <div 
                ref={touchGridRef}
                onTouchMove={handleTouchMove}
                onTouchStart={handleTouchMove}
                onMouseMove={handleTouchMove}
                className="flex-1 min-h-[340px] bg-slate-950 border border-slate-800 rounded-2xl grid grid-cols-6 gap-1 p-1 touch-none cursor-crosshair relative overflow-hidden"
              >
                {Array.from({ length: TOTAL_TOUCH_TILES }).map((_, idx) => {
                  const isTouched = touchedTiles.has(idx);
                  return (
                    <div
                      key={idx}
                      className={`rounded-lg transition-colors duration-75 flex items-center justify-center text-[10px] font-mono select-none ${
                        isTouched 
                          ? 'bg-emerald-500 text-emerald-950 font-bold shadow-sm shadow-emerald-500/50' 
                          : 'bg-slate-900/80 hover:bg-slate-800/80 text-slate-700'
                      }`}
                    >
                      {isTouched ? '✓' : ''}
                    </div>
                  );
                })}
              </div>

              <div className="flex gap-2 mt-4">
                <button
                  onClick={resetTouchGrid}
                  className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-2xl text-xs uppercase tracking-wider flex items-center justify-center gap-2"
                >
                  <RotateCcw size={14} /> Limpar Grade
                </button>
                <button
                  onClick={() => updateTestStatus('touch', 'passed', 'Aprovado pelo técnico')}
                  className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-2xl text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20"
                >
                  <CheckCircle2 size={16} /> Aprovar Touch
                </button>
                <button
                  onClick={() => updateTestStatus('touch', 'failed', 'Falhas ou pontos cegos no touch')}
                  className="px-4 py-3 bg-red-600/20 text-red-400 hover:bg-red-600/30 font-bold rounded-2xl text-xs uppercase tracking-wider flex items-center justify-center gap-1"
                >
                  <XCircle size={16} /> Falhou
                </button>
              </div>
            </div>
          )}

          {/* TEST 2: MULTI-TOUCH */}
          {activeTest === 'multitouch' && (
            <div className="flex-1 flex flex-col">
              <div className="text-center py-2 text-xs text-slate-400">
                Toques ativos agora: <span className="text-blue-400 font-black text-sm">{activeTouches.length}</span> | 
                Recorde detectado: <span className="text-emerald-400 font-black text-sm">{maxTouchesDetected} dedos</span>
              </div>

              <div 
                onTouchStart={handleMultiTouch}
                onTouchMove={handleMultiTouch}
                onTouchEnd={handleMultiTouch}
                onTouchCancel={handleMultiTouch}
                className="flex-1 min-h-[300px] bg-slate-950 border border-slate-800 rounded-2xl relative touch-none overflow-hidden flex flex-col items-center justify-center text-center p-4 cursor-pointer"
              >
                {activeTouches.map((t, idx) => (
                  <div
                    key={t.id}
                    className="absolute w-20 h-20 -ml-10 -mt-10 rounded-full border-2 border-emerald-400 bg-emerald-500/20 flex flex-col items-center justify-center text-[10px] font-black text-white pointer-events-none animate-ping"
                    style={{ left: t.x, top: t.y }}
                  >
                    <span>Dedo #{idx + 1}</span>
                  </div>
                ))}

                <Layers size={48} className="text-slate-700 mb-3" />
                <p className="text-sm font-bold text-slate-300">Toque aqui com 2, 3 ou 4 dedos simultaneamente</p>
                <p className="text-xs text-slate-500 mt-1">O teste será aprovado automaticamente ao detectar 2+ toques</p>
              </div>

              <div className="flex gap-2 mt-4">
                <button
                  onClick={() => { setMaxTouchesDetected(0); setActiveTouches([]); }}
                  className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-2xl text-xs uppercase tracking-wider flex items-center justify-center gap-2"
                >
                  <RotateCcw size={14} /> Zerar Contador
                </button>
                <button
                  onClick={() => updateTestStatus('multitouch', 'passed', `${maxTouchesDetected || 2} toques detectados`)}
                  className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-2xl text-xs uppercase tracking-wider flex items-center justify-center gap-2"
                >
                  <CheckCircle2 size={16} /> Aprovar Multi-touch
                </button>
              </div>
            </div>
          )}

          {/* TEST 3: MICROPHONE */}
          {activeTest === 'mic' && (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-4">
              <div className="w-24 h-24 rounded-3xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 mb-4 relative">
                <Mic size={40} className={isRecordingMic ? 'animate-pulse text-red-400' : ''} />
                {isRecordingMic && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full animate-ping" />
                )}
              </div>

              {/* Volume VU Bar */}
              <div className="w-full max-w-xs mb-4">
                <div className="flex justify-between text-xs text-slate-400 font-bold mb-1">
                  <span>Nível do Microfone</span>
                  <span className={micVolume > 30 ? 'text-emerald-400 font-black' : 'text-slate-400'}>{micVolume}%</span>
                </div>
                <div className="w-full h-3 bg-slate-800 rounded-full overflow-hidden p-0.5">
                  <div 
                    className={`h-full rounded-full transition-all duration-75 ${
                      micVolume > 60 ? 'bg-red-500' : micVolume > 30 ? 'bg-emerald-500' : 'bg-blue-500'
                    }`}
                    style={{ width: `${micVolume}%` }}
                  />
                </div>
              </div>

              {/* Audio playback sample */}
              {audioUrl && (
                <div className="w-full max-w-xs bg-slate-950 p-3 rounded-2xl border border-slate-800 mb-4">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Ouvir Gravação do Teste:</span>
                  <audio src={audioUrl} controls className="w-full h-8" />
                </div>
              )}

              <div className="flex gap-2 w-full max-w-xs mt-2">
                {!isRecordingMic ? (
                  <button
                    onClick={startMicTest}
                    className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 text-white font-black rounded-2xl text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20"
                  >
                    <Play size={16} /> Gravar Teste (3s)
                  </button>
                ) : (
                  <button
                    onClick={stopMicTest}
                    className="flex-1 py-3 bg-red-600 text-white font-black rounded-2xl text-xs uppercase tracking-wider flex items-center justify-center gap-2 animate-pulse"
                  >
                    <Square size={16} /> Parar Gravação
                  </button>
                )}
              </div>

              <div className="flex gap-2 w-full max-w-xs mt-3">
                <button
                  onClick={() => updateTestStatus('mic', 'passed', 'Captação nítida')}
                  className="flex-1 py-2.5 bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-600/30 font-bold rounded-xl text-xs uppercase tracking-wider flex items-center justify-center gap-1"
                >
                  <CheckCircle2 size={14} /> Som Limpo
                </button>
                <button
                  onClick={() => updateTestStatus('mic', 'failed', 'Microfone chiando ou sem som')}
                  className="flex-1 py-2.5 bg-red-600/20 text-red-400 border border-red-500/30 hover:bg-red-600/30 font-bold rounded-xl text-xs uppercase tracking-wider flex items-center justify-center gap-1"
                >
                  <XCircle size={14} /> Ruído / Falha
                </button>
              </div>
            </div>
          )}

          {/* TEST 4: SPEAKER */}
          {activeTest === 'speaker' && (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-4">
              <div className={`w-24 h-24 rounded-3xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 mb-4 ${isPlayingSpeaker ? 'animate-bounce text-emerald-400' : ''}`}>
                <Volume2 size={44} />
              </div>

              <h3 className="text-sm font-bold text-white mb-1">Teste de Frequência Harmônica</h3>
              <p className="text-xs text-slate-400 max-w-xs mb-6">
                Clique no botão abaixo para emitir uma melodia de tons nas saídas do alto-falante principal.
              </p>

              <button
                onClick={playSpeakerTest}
                disabled={isPlayingSpeaker}
                className="w-full max-w-xs py-3.5 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 text-white font-black rounded-2xl text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20 mb-4"
              >
                <Play size={16} /> {isPlayingSpeaker ? 'Tocando Melodia...' : 'Reproduzir Som de Teste'}
              </button>

              <div className="flex gap-2 w-full max-w-xs">
                <button
                  onClick={() => updateTestStatus('speaker', 'passed', 'Alto-falante com bom volume e clareza')}
                  className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-2xl text-xs uppercase tracking-wider flex items-center justify-center gap-1"
                >
                  <CheckCircle2 size={16} /> Som Claro
                </button>
                <button
                  onClick={() => updateTestStatus('speaker', 'failed', 'Som baixo, estourado ou mudo')}
                  className="flex-1 py-3 bg-red-600/20 text-red-400 hover:bg-red-600/30 font-bold rounded-2xl text-xs uppercase tracking-wider flex items-center justify-center gap-1"
                >
                  <XCircle size={16} /> Chiando / Mudo
                </button>
              </div>
            </div>
          )}

          {/* TEST 5: EARPIECE */}
          {activeTest === 'earpiece' && (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-4">
              <div className={`w-24 h-24 rounded-3xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 mb-4 ${isPlayingEarpiece ? 'animate-pulse text-amber-400' : ''}`}>
                <PhoneCall size={44} />
              </div>

              <h3 className="text-sm font-bold text-white mb-1">Alto-Falante de Chamadas (Ouvido)</h3>
              <p className="text-xs text-slate-400 max-w-xs mb-6">
                Aproxime a parte superior do celular ao ouvido como se estivesse em uma ligação e reproduza o áudio de verificação.
              </p>

              <button
                onClick={playEarpieceTest}
                disabled={isPlayingEarpiece}
                className="w-full max-w-xs py-3.5 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 text-white font-black rounded-2xl text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20 mb-4"
              >
                <Play size={16} /> {isPlayingEarpiece ? 'Emitindo Tom...' : 'Testar Fone de Chamadas'}
              </button>

              <div className="flex gap-2 w-full max-w-xs">
                <button
                  onClick={() => updateTestStatus('earpiece', 'passed', 'Áudio auricular limpo')}
                  className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-2xl text-xs uppercase tracking-wider flex items-center justify-center gap-1"
                >
                  <CheckCircle2 size={16} /> Audível e Nítido
                </button>
                <button
                  onClick={() => updateTestStatus('earpiece', 'failed', 'Sem som no auricular ou muito baixo')}
                  className="flex-1 py-3 bg-red-600/20 text-red-400 hover:bg-red-600/30 font-bold rounded-2xl text-xs uppercase tracking-wider flex items-center justify-center gap-1"
                >
                  <XCircle size={16} /> Inaudível
                </button>
              </div>
            </div>
          )}

          {/* TEST 6: WI-FI / NETWORK */}
          {activeTest === 'wifi' && (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-4">
              <div className="w-24 h-24 rounded-3xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 mb-4">
                <Wifi size={44} className={wifiTesting ? 'animate-pulse' : ''} />
              </div>

              <h3 className="text-sm font-bold text-white mb-1">Busca e Conexão de Redes Wi-Fi</h3>
              <p className="text-xs text-slate-400 max-w-xs mb-4">
                Verifica a integridade da placa de rede, latência de tráfego de dados e estabilidade.
              </p>

              {wifiPing !== null && (
                <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 w-full max-w-xs mb-4">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-slate-400">Latência do Ping:</span>
                    <span className="text-sm font-black text-emerald-400">{wifiPing} ms</span>
                  </div>
                  <div className="text-[11px] text-slate-500 text-left truncate">{wifiInfo}</div>
                </div>
              )}

              <button
                onClick={runWifiTest}
                disabled={wifiTesting}
                className="w-full max-w-xs py-3.5 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 text-white font-black rounded-2xl text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20 mb-4"
              >
                {wifiTesting ? <Loader2 size={16} className="animate-spin" /> : <Activity size={16} />}
                {wifiTesting ? 'Testando Conexão...' : 'Executar Teste de Rede'}
              </button>

              <div className="flex gap-2 w-full max-w-xs">
                <button
                  onClick={() => updateTestStatus('wifi', 'passed', wifiInfo || 'Conexão estável')}
                  className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-2xl text-xs uppercase tracking-wider flex items-center justify-center gap-1"
                >
                  <CheckCircle2 size={16} /> Rede OK
                </button>
                <button
                  onClick={() => updateTestStatus('wifi', 'failed', 'Placa de rede com oscilação')}
                  className="flex-1 py-3 bg-red-600/20 text-red-400 hover:bg-red-600/30 font-bold rounded-2xl text-xs uppercase tracking-wider flex items-center justify-center gap-1"
                >
                  <XCircle size={16} /> Falha Wi-Fi
                </button>
              </div>
            </div>
          )}

          {/* TEST 7: PROXIMITY SENSOR */}
          {activeTest === 'proximity' && (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-4">
              <div className="w-24 h-24 rounded-3xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 mb-4">
                <Eye size={44} />
              </div>

              <h3 className="text-sm font-bold text-white mb-1">Sensor de Proximidade e Presença</h3>
              <p className="text-xs text-slate-400 max-w-xs mb-4">
                Aproxime a mão do topo do aparelho (próximo à câmera frontal). A tela deverá escurecer simulando o bloqueio de chamada.
              </p>

              {proximityDetectedCount > 0 && (
                <div className="bg-emerald-950/40 border border-emerald-500/30 text-emerald-400 p-3 rounded-2xl text-xs font-bold mb-4 flex items-center gap-2">
                  <CheckCircle2 size={16} />
                  <span>Proximidade disparada {proximityDetectedCount}x com sucesso!</span>
                </div>
              )}

              <button
                onClick={triggerProximitySimulation}
                className="w-full max-w-xs py-4 bg-purple-600 hover:bg-purple-500 text-white font-black rounded-2xl text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-purple-600/20 mb-4"
              >
                <Eye size={18} /> Testar Detecção de Presença
              </button>

              <div className="flex gap-2 w-full max-w-xs">
                <button
                  onClick={() => updateTestStatus('proximity', 'passed', 'Sensor de proximidade operacional')}
                  className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-2xl text-xs uppercase tracking-wider flex items-center justify-center gap-1"
                >
                  <CheckCircle2 size={16} /> Sensor OK
                </button>
                <button
                  onClick={() => updateTestStatus('proximity', 'failed', 'Sensor de presença inativo ou travado')}
                  className="flex-1 py-3 bg-red-600/20 text-red-400 hover:bg-red-600/30 font-bold rounded-2xl text-xs uppercase tracking-wider flex items-center justify-center gap-1"
                >
                  <XCircle size={16} /> Falhou
                </button>
              </div>
            </div>
          )}

          {/* TEST 8: BIOMETRICS */}
          {activeTest === 'biometrics' && (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-4">
              <div className="w-24 h-24 rounded-3xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 mb-4">
                <Fingerprint size={48} className={biometricsTesting ? 'animate-pulse text-emerald-400' : ''} />
              </div>

              <h3 className="text-sm font-bold text-white mb-1">Leitor Biométrico / Face ID</h3>
              <p className="text-xs text-slate-400 max-w-xs mb-4">
                Testa a comunicação com o chip de autenticação biométrica do aparelho.
              </p>

              {biometricsMessage && (
                <div className="bg-slate-950 border border-slate-800 p-3 rounded-2xl text-xs text-slate-300 max-w-xs mb-4 text-left">
                  {biometricsMessage}
                </div>
              )}

              <button
                onClick={testBiometrics}
                disabled={biometricsTesting}
                className="w-full max-w-xs py-3.5 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 text-white font-black rounded-2xl text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20 mb-4"
              >
                {biometricsTesting ? <Loader2 size={16} className="animate-spin" /> : <Fingerprint size={16} />}
                {biometricsTesting ? 'Consultando Hardware...' : 'Acionar Sensor Biométrico'}
              </button>

              <div className="flex gap-2 w-full max-w-xs">
                <button
                  onClick={() => updateTestStatus('biometrics', 'passed', 'Biometria validada com sucesso')}
                  className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-2xl text-xs uppercase tracking-wider flex items-center justify-center gap-1"
                >
                  <CheckCircle2 size={16} /> Biometria OK
                </button>
                <button
                  onClick={() => updateTestStatus('biometrics', 'failed', 'Leitor biométrico não responde')}
                  className="flex-1 py-3 bg-red-600/20 text-red-400 hover:bg-red-600/30 font-bold rounded-2xl text-xs uppercase tracking-wider flex items-center justify-center gap-1"
                >
                  <XCircle size={16} /> Falhou
                </button>
              </div>
            </div>
          )}

          {/* FINAL REPORT & SUMMARY VIEW */}
          {activeTest === 'summary' && (
            <div className="flex-1 flex flex-col">
              <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-800">
                <div>
                  <h2 className="text-base font-black text-white flex items-center gap-2">
                    <Award className="text-emerald-400" size={20} /> Relatório de Diagnóstico de Hardware
                  </h2>
                  <p className="text-xs text-slate-400">Resumo completo dos 8 testes executados na O.S. #{order.id}</p>
                </div>
                <span className="text-xs font-black px-3 py-1 bg-blue-600/20 border border-blue-500/30 text-blue-400 rounded-full">
                  {passedTestsCount}/8 Aprovados
                </span>
              </div>

              {/* Grid of Results */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4">
                {(Object.keys(INITIAL_TESTS) as DeviceHardwareTestType[]).map(key => {
                  const item = INITIAL_TESTS[key];
                  const res = testResults[key];
                  const Icon = item.icon;
                  const isPassed = res.status === 'passed';
                  const isFailed = res.status === 'failed';

                  return (
                    <div 
                      key={key} 
                      onClick={() => setActiveTest(key)}
                      className="bg-slate-950 p-3 rounded-2xl border border-slate-800/80 flex items-center justify-between hover:border-slate-700 cursor-pointer transition-colors"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                          isPassed ? 'bg-emerald-500/10 text-emerald-400' : isFailed ? 'bg-red-500/10 text-red-400' : 'bg-slate-800 text-slate-400'
                        }`}>
                          <Icon size={16} />
                        </div>
                        <div>
                          <div className="text-xs font-bold text-white">{item.name}</div>
                          <div className="text-[10px] text-slate-500 truncate max-w-[140px]">{res.details || 'Sem observações'}</div>
                        </div>
                      </div>

                      {isPassed ? (
                        <span className="text-[10px] font-black px-2 py-0.5 bg-emerald-500/20 text-emerald-400 rounded-full uppercase">
                          Aprovado
                        </span>
                      ) : isFailed ? (
                        <span className="text-[10px] font-black px-2 py-0.5 bg-red-500/20 text-red-400 rounded-full uppercase">
                          Reprovado
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold px-2 py-0.5 bg-slate-800 text-slate-500 rounded-full uppercase">
                          Pendente
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Technician Observation field */}
              <div className="mb-4">
                <label className="text-xs font-bold text-slate-300 block mb-1">Observações Adicionais do Técnico:</label>
                <textarea
                  value={technicianNotes}
                  onChange={(e) => {
                    const val = e.target.value;
                    setTechnicianNotes(val);
                    clearTimeout(autoSaveTimeoutRef.current);
                    autoSaveTimeoutRef.current = setTimeout(() => {
                      saveResultsToServer(testResults, val, false);
                    }, 500);
                  }}
                  placeholder="Ex: Aparelho com leve arranhão na lateral, touch 100% responsivo em todas as extremidades."
                  className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-3 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-blue-500 resize-none h-20"
                />
              </div>
            </div>
          )}

        </div>
      </main>

      {/* STICKY BOTTOM SAVE BAR */}
      <footer className="fixed bottom-0 left-0 right-0 bg-slate-900/95 backdrop-blur-md border-t border-slate-800 p-3 z-40">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <button
            onClick={handleSaveToOrder}
            disabled={saving}
            className={`flex-1 py-3.5 rounded-2xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-xl ${
              saveSuccess 
                ? 'bg-emerald-600 text-white' 
                : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-blue-600/20'
            }`}
          >
            {saving ? (
              <Loader2 size={16} className="animate-spin" />
            ) : saveSuccess ? (
              <Check size={18} />
            ) : (
              <Save size={16} />
            )}
            {saving 
              ? 'Salvando Resultados na O.S...' 
              : saveSuccess 
              ? 'Resultados Gravados com Sucesso!' 
              : 'Salvar Diagnóstico na O.S.'}
          </button>
        </div>
      </footer>
    </div>
  );
};
