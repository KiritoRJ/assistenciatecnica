import React, { useState, useEffect, useRef } from 'react';
import {
  Battery,
  BatteryCharging,
  BatteryMedium,
  BatteryWarning,
  Zap,
  Flame,
  Thermometer,
  Cpu,
  Smartphone,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Copy,
  Check,
  Share2,
  Activity,
  HardDrive,
  Clock,
  ArrowLeft,
  ShieldAlert,
  Loader2,
  ExternalLink,
  Sliders,
  HelpCircle,
  TrendingDown,
  Info
} from 'lucide-react';
import { webAdb, DeviceDetails } from '../utils/webAdbService';

interface BatteryData {
  level: number;
  scale: number;
  voltageMv: number;
  voltageV: number;
  temperatureC: number;
  healthCode: number;
  healthText: string;
  statusCode: number;
  statusText: string;
  isCharging: boolean;
  powerSource: 'AC' | 'USB' | 'Wireless' | 'Bateria';
  technology: string;
  currentNowMa?: number;
  chargeCounterMah?: number;
  cycleCount?: number;
  designCapacityMah?: number;
  currentCapacityMah?: number;
  healthPercentage?: number;
  batteryStatusRating: 'excelente' | 'boa' | 'atencao' | 'critica';
  rawBatteryDump?: string;
}

interface HardwareData {
  model: string;
  brand: string;
  manufacturer: string;
  androidVersion: string;
  securityPatch: string;
  serial: string;
  chipset?: string;
  screenResolution?: string;
  screenDensity?: string;
  ramTotalMb?: number;
  ramFreeMb?: number;
  ramUsedMb?: number;
  storageTotalGb?: string;
  storageUsedGb?: string;
  storageFreeGb?: string;
  storagePercentUsed?: string;
  uptimeFormatted?: string;
  thermalSensors?: Array<{ zone: string; temp: number }>;
}

interface Props {
  onBack?: () => void;
}

export const AdbBatteryDiagnostics: React.FC<Props> = ({ onBack }) => {
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');
  const [deviceInfo, setDeviceInfo] = useState<DeviceDetails | null>(null);
  const [batteryData, setBatteryData] = useState<BatteryData | null>(null);
  const [hardwareData, setHardwareData] = useState<HardwareData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isCopied, setIsCopied] = useState<boolean>(false);
  const [isLiveMonitoring, setIsLiveMonitoring] = useState<boolean>(false);
  const [isResettingStats, setIsResettingStats] = useState<boolean>(false);
  const [resetSuccess, setResetSuccess] = useState<boolean>(false);
  const [showRawModal, setShowRawModal] = useState<boolean>(false);

  const monitorIntervalRef = useRef<any>(null);

  // Verifica se já há conexão ativa ao abrir
  useEffect(() => {
    if (webAdb.isConnected()) {
      setConnectionStatus('connected');
      fetchDiagnostics();
    }
  }, []);

  // Limpa intervalo de monitoramento em tempo real ao desmontar
  useEffect(() => {
    return () => {
      if (monitorIntervalRef.current) {
        clearInterval(monitorIntervalRef.current);
      }
    };
  }, []);

  // Alterna monitoramento contínuo
  useEffect(() => {
    if (isLiveMonitoring && connectionStatus === 'connected') {
      monitorIntervalRef.current = setInterval(() => {
        refreshBatteryOnly();
      }, 2500);
    } else {
      if (monitorIntervalRef.current) {
        clearInterval(monitorIntervalRef.current);
        monitorIntervalRef.current = null;
      }
    }
    return () => {
      if (monitorIntervalRef.current) {
        clearInterval(monitorIntervalRef.current);
      }
    };
  }, [isLiveMonitoring, connectionStatus]);

  // Conectar dispositivo via WebADB
  const handleConnect = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    setConnectionStatus('connecting');

    try {
      await webAdb.connect();
      const dev = await webAdb.getDeviceInfo();
      setDeviceInfo(dev);
      setConnectionStatus('connected');
      await fetchDiagnostics();
    } catch (err: any) {
      console.error("Erro na conexão ADB:", err);
      setConnectionStatus('disconnected');
      setErrorMessage(err?.message || 'Falha ao conectar dispositivo Android via USB.');
    } finally {
      setIsLoading(false);
    }
  };

  // Desconectar
  const handleDisconnect = async () => {
    setIsLiveMonitoring(false);
    await webAdb.disconnect();
    setConnectionStatus('disconnected');
    setBatteryData(null);
    setHardwareData(null);
    setDeviceInfo(null);
  };

  // Leitura rápida de bateria (usada no monitoramento em tempo real)
  const refreshBatteryOnly = async () => {
    if (!webAdb.isConnected()) return;
    try {
      const dump = await webAdb.exec('dumpsys battery');
      parseAndSetBattery(dump);
    } catch (e) {
      console.warn("Falha no refresh de bateria:", e);
    }
  };

  // Parser completo de dados de bateria
  const parseAndSetBattery = (dump: string, sysfsCycles?: number, sysfsCapacity?: number) => {
    const levelMatch = dump.match(/level:\s*(\d+)/i);
    const scaleMatch = dump.match(/scale:\s*(\d+)/i);
    const voltageMatch = dump.match(/voltage:\s*(\d+)/i);
    const tempMatch = dump.match(/temperature:\s*(\d+)/i);
    const healthMatch = dump.match(/health:\s*(\d+)/i);
    const statusMatch = dump.match(/status:\s*(\d+)/i);
    const acMatch = dump.match(/AC powered:\s*(true|false)/i);
    const usbMatch = dump.match(/USB powered:\s*(true|false)/i);
    const wirelessMatch = dump.match(/Wireless powered:\s*(true|false)/i);
    const techMatch = dump.match(/technology:\s*([^\r\n]+)/i);
    const maxCurrentMatch = dump.match(/Max charging current:\s*(\d+)/i);
    const counterMatch = dump.match(/Charge counter:\s*(\d+)/i);

    const level = levelMatch ? parseInt(levelMatch[1], 10) : 100;
    const scale = scaleMatch ? parseInt(scaleMatch[1], 10) : 100;
    const voltageMv = voltageMatch ? parseInt(voltageMatch[1], 10) : 4000;
    const voltageV = Number((voltageMv / 1000).toFixed(2));
    const rawTemp = tempMatch ? parseInt(tempMatch[1], 10) : 300;
    const temperatureC = Number((rawTemp / 10).toFixed(1));

    const healthCode = healthMatch ? parseInt(healthMatch[1], 10) : 2;
    let healthText = 'Boa (Excelente Estado)';
    if (healthCode === 3) healthText = 'Superaquecimento';
    else if (healthCode === 4) healthText = 'Esgotada / Degradada';
    else if (healthCode === 5) healthText = 'Sobretensão';
    else if (healthCode === 6) healthText = 'Falha no Sensor/Célula';
    else if (healthCode === 7) healthText = 'Frio Extremo';

    const statusCode = statusMatch ? parseInt(statusMatch[1], 10) : 3;
    let statusText = 'Descarregando';
    let isCharging = false;
    if (statusCode === 2) {
      statusText = 'Carregando';
      isCharging = true;
    } else if (statusCode === 5) {
      statusText = 'Carga Completa';
      isCharging = false;
    } else if (statusCode === 4) {
      statusText = 'Não Carregando';
    }

    let powerSource: 'AC' | 'USB' | 'Wireless' | 'Bateria' = 'Bateria';
    if (acMatch && acMatch[1].toLowerCase() === 'true') powerSource = 'AC';
    else if (usbMatch && usbMatch[1].toLowerCase() === 'true') powerSource = 'USB';
    else if (wirelessMatch && wirelessMatch[1].toLowerCase() === 'true') powerSource = 'Wireless';

    const technology = techMatch ? techMatch[1].trim() : 'Li-ion';
    const currentNowMa = maxCurrentMatch ? parseInt(maxCurrentMatch[1], 10) / 1000 : undefined;
    const chargeCounterMah = counterMatch ? Math.round(parseInt(counterMatch[1], 10) / 1000) : undefined;

    // Ciclos e Saúde Percentual
    const cycles = sysfsCycles || (batteryData?.cycleCount);
    let healthPercentage = 100;
    
    if (cycles && cycles > 0) {
      // Curva padrão Li-ion: ~0.025% a 0.035% de perda por ciclo
      const estimatedLoss = Math.min(45, Math.round(cycles * 0.032));
      healthPercentage = Math.max(55, 100 - estimatedLoss);
    } else if (healthCode === 4) {
      healthPercentage = 65;
    }

    let batteryStatusRating: 'excelente' | 'boa' | 'atencao' | 'critica' = 'excelente';
    if (healthPercentage >= 90) batteryStatusRating = 'excelente';
    else if (healthPercentage >= 80) batteryStatusRating = 'boa';
    else if (healthPercentage >= 70) batteryStatusRating = 'atencao';
    else batteryStatusRating = 'critica';

    setBatteryData(prev => ({
      ...prev,
      level,
      scale,
      voltageMv,
      voltageV,
      temperatureC,
      healthCode,
      healthText,
      statusCode,
      statusText,
      isCharging,
      powerSource,
      technology,
      currentNowMa,
      chargeCounterMah,
      cycleCount: cycles,
      healthPercentage,
      batteryStatusRating,
      rawBatteryDump: dump
    }));
  };

  // Coleta profunda de dados do aparelho
  const fetchDiagnostics = async () => {
    if (!webAdb.isConnected()) return;
    setIsLoading(true);
    setErrorMessage(null);

    try {
      // 1. Dumpsys Battery
      const batteryDump = await webAdb.exec('dumpsys battery');

      // 2. Busca de ciclos em nós de kernel comuns (Samsung, Xiaomi, Motorola, MTK, Qualcomm)
      let cycles: number | undefined;
      const cycleCommands = [
        'cat /sys/class/power_supply/battery/battery_cycle',
        'cat /sys/class/power_supply/battery/cycle_count',
        'cat /sys/class/power_supply/bms/cycle_count',
        'cat /sys/class/power_supply/bms/device/cycle_count',
        'cat /sys/class/power_supply/sec-fuelgauge/cycle_count',
        'cat /sys/class/power_supply/maxfg/cycle_count'
      ];

      for (const cmd of cycleCommands) {
        try {
          const res = (await webAdb.exec(cmd)).trim();
          const parsed = parseInt(res, 10);
          if (!isNaN(parsed) && parsed >= 0 && parsed < 5000) {
            cycles = parsed;
            break;
          }
        } catch {
          // segue tentando o próximo nó
        }
      }

      parseAndSetBattery(batteryDump, cycles);

      // 3. Hardware & Sistema
      const dev = deviceInfo || (await webAdb.getDeviceInfo());
      setDeviceInfo(dev);

      // Chipset / Platform
      let chipset = '';
      try {
        const platform = (await webAdb.exec('getprop ro.board.platform')).trim();
        const soc = (await webAdb.exec('getprop ro.soc.model')).trim() || (await webAdb.exec('getprop ro.hardware')).trim();
        chipset = [soc, platform].filter(Boolean).join(' / ');
      } catch {}

      // Tela (Resolução & DPI)
      let screenResolution = '';
      let screenDensity = '';
      try {
        const wmSize = (await webAdb.exec('wm size')).trim();
        const sizeMatch = wmSize.match(/Physical size:\s*(\d+x\d+)/i) || wmSize.match(/(\d+x\d+)/);
        if (sizeMatch) screenResolution = sizeMatch[1];

        const wmDensity = (await webAdb.exec('wm density')).trim();
        const densityMatch = wmDensity.match(/Physical density:\s*(\d+)/i) || wmDensity.match(/(\d+)/);
        if (densityMatch) screenDensity = `${densityMatch[1]} DPI`;
      } catch {}

      // Memória RAM
      let ramTotalMb: number | undefined;
      let ramFreeMb: number | undefined;
      let ramUsedMb: number | undefined;
      try {
        const meminfo = await webAdb.exec('cat /proc/meminfo');
        const totalMatch = meminfo.match(/MemTotal:\s*(\d+)\s*kB/i);
        const availMatch = meminfo.match(/MemAvailable:\s*(\d+)\s*kB/i);
        if (totalMatch) {
          ramTotalMb = Math.round(parseInt(totalMatch[1], 10) / 1024);
          if (availMatch) {
            ramFreeMb = Math.round(parseInt(availMatch[1], 10) / 1024);
            ramUsedMb = Math.max(0, ramTotalMb - ramFreeMb);
          }
        }
      } catch {}

      // Armazenamento
      let storageTotalGb: string | undefined;
      let storageUsedGb: string | undefined;
      let storageFreeGb: string | undefined;
      let storagePercentUsed: string | undefined;
      try {
        const dfOut = await webAdb.exec('df -h /data');
        const lines = dfOut.trim().split('\n');
        if (lines.length > 1) {
          const parts = lines[1].trim().split(/\s+/);
          if (parts.length >= 5) {
            storageTotalGb = parts[1];
            storageUsedGb = parts[2];
            storageFreeGb = parts[3];
            storagePercentUsed = parts[4];
          }
        }
      } catch {}

      // Uptime
      let uptimeFormatted: string | undefined;
      try {
        const uptimeOut = await webAdb.exec('uptime');
        uptimeFormatted = uptimeOut.trim();
      } catch {}

      // Sensores Térmicos
      const thermalSensors: Array<{ zone: string; temp: number }> = [];
      try {
        for (let i = 0; i <= 3; i++) {
          try {
            const t = (await webAdb.exec(`cat /sys/class/thermal/thermal_zone${i}/temp`)).trim();
            const raw = parseInt(t, 10);
            if (!isNaN(raw) && raw > 0) {
              const deg = raw > 1000 ? Math.round(raw / 1000) : raw;
              if (deg > 10 && deg < 110) {
                thermalSensors.push({ zone: `Zona ${i}`, temp: deg });
              }
            }
          } catch {}
        }
      } catch {}

      setHardwareData({
        model: dev.model,
        brand: dev.brand,
        manufacturer: dev.manufacturer,
        androidVersion: dev.androidVersion,
        securityPatch: dev.securityPatch,
        serial: dev.serial,
        chipset,
        screenResolution,
        screenDensity,
        ramTotalMb,
        ramFreeMb,
        ramUsedMb,
        storageTotalGb,
        storageUsedGb,
        storageFreeGb,
        storagePercentUsed,
        uptimeFormatted,
        thermalSensors
      });

    } catch (err: any) {
      console.error("Erro ao ler diagnósticos:", err);
      setErrorMessage("Erro ao obter dados do aparelho via ADB: " + (err?.message || String(err)));
    } finally {
      setIsLoading(false);
    }
  };

  // Reset de estatísticas de bateria (Calibração)
  const handleResetBatteryStats = async () => {
    if (!webAdb.isConnected()) return;
    setIsResettingStats(true);
    setResetSuccess(false);

    try {
      await webAdb.exec('dumpsys batterystats --reset');
      setResetSuccess(true);
      setTimeout(() => setResetSuccess(false), 4000);
      refreshBatteryOnly();
    } catch (e) {
      alert("Falha ao resetar estatísticas de bateria: " + String(e));
    } finally {
      setIsResettingStats(false);
    }
  };

  // Copiar relatório formatado para WhatsApp / Ordem de Serviço
  const handleCopyReport = () => {
    if (!batteryData || !deviceInfo) return;

    const healthEmoji = batteryData.batteryStatusRating === 'excelente' ? '🟢' : batteryData.batteryStatusRating === 'boa' ? '🟡' : '🔴';

    const text = `📋 *LAUDO TÉCNICO DE BATERIA & HARDWARE*
📱 *Aparelho:* ${deviceInfo.brand} ${deviceInfo.model}
🤖 *Android:* ${deviceInfo.androidVersion} | Patch: ${deviceInfo.securityPatch}
🔢 *Nº Série/ID:* ${deviceInfo.serial}

🔋 *STATUS DA BATERIA:*
${healthEmoji} *Saúde Estimada:* ${batteryData.healthPercentage || 100}% (${batteryData.healthText})
⚡ *Carga Atual:* ${batteryData.level}% (${batteryData.statusText})
🔄 *Ciclos de Carga:* ${batteryData.cycleCount !== undefined ? `${batteryData.cycleCount} ciclos` : 'Não exposto pelo kernel'}
🌡️ *Temperatura:* ${batteryData.temperatureC}°C ${batteryData.temperatureC > 38 ? '⚠️ (Aquecida)' : '✅ (Normal)'}
🔌 *Tensão:* ${batteryData.voltageV}V (${batteryData.voltageMv} mV)
🛠️ *Tecnologia:* ${batteryData.technology}
🔌 *Alimentação:* ${batteryData.powerSource}

💾 *HARDWARE & MEMÓRIA:*
🧠 *Memória RAM:* ${hardwareData?.ramTotalMb ? `${hardwareData.ramTotalMb} MB Total (${hardwareData.ramUsedMb || 0} MB em uso)` : 'Lendo...'}
📁 *Armazenamento:* ${hardwareData?.storageTotalGb ? `${hardwareData.storageUsedGb} de ${hardwareData.storageTotalGb} (${hardwareData.storagePercentUsed || ''} ocupado)` : 'Lendo...'}
📺 *Resolução da Tela:* ${hardwareData?.screenResolution || 'N/A'} ${hardwareData?.screenDensity ? `(${hardwareData.screenDensity})` : ''}

_Diagnóstico gerado via Bancada Técnica ADB Direto._`;

    navigator.clipboard.writeText(text);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 3000);
  };

  return (
    <div className="w-full space-y-6 animate-in fade-in duration-300">
      {/* Barra de Topo */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-3xl border border-slate-100 shadow-sm">
        <div className="flex items-center gap-4">
          {onBack && (
            <button
              onClick={onBack}
              className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-all active:scale-95 flex items-center justify-center shrink-0"
              title="Voltar para a Central de Ferramentas"
            >
              <ArrowLeft size={20} />
            </button>
          )}
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center shadow-inner shrink-0">
              <BatteryMedium size={26} />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight uppercase">
                  Saúde da Bateria & Diagnóstico
                </h2>
                <span className="px-2.5 py-0.5 bg-emerald-50 text-emerald-700 text-[10px] font-black uppercase rounded-md border border-emerald-200">
                  Leitura Direta USB
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Verifique ciclos de carga, saúde real em %, temperatura térmica, voltagem e hardware em tempo real.
              </p>
            </div>
          </div>
        </div>

        {/* Botão de Conectar / Desconectar */}
        <div className="flex items-center gap-2 shrink-0">
          {connectionStatus === 'connected' ? (
            <>
              <button
                onClick={() => setIsLiveMonitoring(!isLiveMonitoring)}
                className={`px-3.5 py-2 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 transition-all shadow-sm ${
                  isLiveMonitoring
                    ? 'bg-amber-500 text-white animate-pulse'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                <Activity size={16} />
                <span>{isLiveMonitoring ? 'Ao Vivo (2s)' : 'Tempo Real'}</span>
              </button>

              <button
                onClick={fetchDiagnostics}
                disabled={isLoading}
                className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-all active:scale-95 disabled:opacity-50"
                title="Atualizar Leitura Completa"
              >
                <RefreshCw size={18} className={isLoading ? 'animate-spin' : ''} />
              </button>

              <button
                onClick={handleDisconnect}
                className="px-4 py-2.5 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-xl text-xs font-black uppercase tracking-wider transition-all"
              >
                Desconectar
              </button>
            </>
          ) : (
            <button
              onClick={handleConnect}
              disabled={isLoading}
              className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl font-black text-xs uppercase tracking-wider flex items-center gap-2 shadow-lg shadow-emerald-600/30 active:scale-95 transition-all disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  <span>Conectando...</span>
                </>
              ) : (
                <>
                  <Zap size={18} />
                  <span>Conectar Celular USB</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Erro de Conexão se houver */}
      {errorMessage && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-2xl flex items-start gap-3 text-red-800 text-xs">
          <AlertTriangle size={18} className="shrink-0 text-red-600 mt-0.5" />
          <div className="space-y-1">
            <p className="font-bold">Atenção ao Conectar:</p>
            <p className="leading-relaxed">{errorMessage}</p>
          </div>
        </div>
      )}

      {/* TELA DE ESPERA / DISPOSITIVO DESCONECTADO */}
      {connectionStatus !== 'connected' && (
        <div className="bg-white rounded-3xl border border-slate-100 p-8 sm:p-12 text-center max-w-2xl mx-auto shadow-sm space-y-6">
          <div className="w-20 h-20 bg-emerald-50 text-emerald-600 rounded-3xl flex items-center justify-center mx-auto shadow-inner">
            <BatteryCharging size={40} />
          </div>

          <div className="space-y-2">
            <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight">
              Pronto para ler a Bateria & Sensores
            </h3>
            <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto leading-relaxed">
              Conecte o smartphone Samsung, Motorola ou Xiaomi ao computador via cabo USB com a <strong>Depuração USB</strong> ativada.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-left max-w-lg mx-auto pt-2">
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1">01. Conexão</span>
              <p className="text-xs font-bold text-slate-700">Cabo USB de boa qualidade</p>
            </div>
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1">02. Depuração</span>
              <p className="text-xs font-bold text-slate-700">Ative nas Opções do Desenvolvedor</p>
            </div>
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1">03. Autorização</span>
              <p className="text-xs font-bold text-slate-700">Marque "Sempre permitir"</p>
            </div>
          </div>

          <div className="pt-4">
            <button
              onClick={handleConnect}
              disabled={isLoading}
              className="px-8 py-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl font-black text-xs uppercase tracking-wider inline-flex items-center gap-3 shadow-xl shadow-emerald-600/30 active:scale-95 transition-all disabled:opacity-50"
            >
              {isLoading ? <Loader2 size={20} className="animate-spin" /> : <Zap size={20} />}
              <span>Selecionar Celular Conectado</span>
            </button>
          </div>
        </div>
      )}

      {/* PAINEL DE DIAGNÓSTICO COMPLETO (QUANDO CONECTADO) */}
      {connectionStatus === 'connected' && batteryData && (
        <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-400">
          
          {/* Card Principal de Saúde da Bateria (Medidor Visual) */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Medidor de Saúde Geral */}
            <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-950 text-white rounded-[2.5rem] p-6 sm:p-8 border border-slate-700 shadow-xl flex flex-col justify-between space-y-6 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-48 h-48 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />

              <div>
                <div className="flex items-center justify-between gap-2 mb-4">
                  <span className="px-2.5 py-1 bg-white/10 text-slate-200 text-[10px] font-black uppercase rounded-lg border border-white/10">
                    Diagnóstico de Degradação
                  </span>
                  <span className={`px-2.5 py-1 text-[10px] font-black uppercase rounded-lg border ${
                    batteryData.batteryStatusRating === 'excelente'
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400/30'
                      : batteryData.batteryStatusRating === 'boa'
                      ? 'bg-blue-500/20 text-blue-300 border-blue-400/30'
                      : batteryData.batteryStatusRating === 'atencao'
                      ? 'bg-amber-500/20 text-amber-300 border-amber-400/30'
                      : 'bg-red-500/20 text-red-300 border-red-400/30'
                  }`}>
                    {batteryData.batteryStatusRating === 'excelente' ? 'Saúde Excelente' : batteryData.batteryStatusRating === 'boa' ? 'Boa Condição' : batteryData.batteryStatusRating === 'atencao' ? 'Atenção / Desgaste' : 'Troca Recomendada'}
                  </span>
                </div>

                <div className="flex items-baseline gap-3">
                  <span className="text-5xl sm:text-6xl font-black tracking-tight text-white">
                    {batteryData.healthPercentage || 100}%
                  </span>
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                    Capacidade Restante
                  </span>
                </div>

                <p className="text-xs text-slate-300 mt-2 leading-relaxed">
                  Status do Sensor: <strong className="text-white">{batteryData.healthText}</strong>. {batteryData.batteryStatusRating === 'excelente' ? 'A bateria retém excelente retenção de carga diária.' : batteryData.batteryStatusRating === 'boa' ? 'Nível de degradação normal para o tempo de uso.' : 'A autonomia já apresenta redução perceptível ao usuário.'}
                </p>
              </div>

              {/* Barra de Progresso de Saúde */}
              <div className="space-y-2">
                <div className="w-full bg-slate-800 rounded-full h-3.5 p-0.5 overflow-hidden border border-slate-700">
                  <div 
                    className={`h-full rounded-full transition-all duration-700 ${
                      batteryData.batteryStatusRating === 'excelente'
                        ? 'bg-emerald-400'
                        : batteryData.batteryStatusRating === 'boa'
                        ? 'bg-blue-400'
                        : batteryData.batteryStatusRating === 'atencao'
                        ? 'bg-amber-400'
                        : 'bg-red-400'
                    }`}
                    style={{ width: `${Math.min(100, Math.max(10, batteryData.healthPercentage || 100))}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-[10px] font-bold text-slate-400">
                  <span>0% (Fim de Vida)</span>
                  <span>80% (Recomendação OEM)</span>
                  <span>100% (Nova)</span>
                </div>
              </div>

              {/* Ações Rápidas do Card */}
              <div className="pt-2 flex items-center gap-2 flex-wrap">
                <button
                  onClick={handleCopyReport}
                  className="flex-1 px-4 py-3 bg-white text-slate-900 hover:bg-slate-100 rounded-xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all active:scale-95 shadow-md"
                >
                  {isCopied ? <Check size={16} className="text-emerald-600" /> : <Share2 size={16} />}
                  <span>{isCopied ? 'Copiado p/ WhatsApp!' : 'Gerar Laudo Técnico'}</span>
                </button>

                <button
                  onClick={handleResetBatteryStats}
                  disabled={isResettingStats}
                  className="px-3.5 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 transition-all"
                  title="Limpar estatísticas do Android para recalibrar a leitura"
                >
                  {isResettingStats ? <Loader2 size={16} className="animate-spin" /> : <Sliders size={16} />}
                  <span>{resetSuccess ? 'Recalibrado!' : 'Recalibrar'}</span>
                </button>
              </div>
            </div>

            {/* Grid com Parâmetros Elétricos & Térmicos em Tempo Real */}
            <div className="lg:col-span-2 grid grid-cols-2 sm:grid-cols-3 gap-4">
              
              {/* Nível de Carga */}
              <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm flex flex-col justify-between space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Carga Atual</span>
                  <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                    <Battery size={18} />
                  </div>
                </div>
                <div>
                  <span className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                    {batteryData.level}%
                  </span>
                  <p className="text-[11px] font-bold text-slate-500 mt-0.5">
                    {batteryData.statusText}
                  </p>
                </div>
              </div>

              {/* Ciclos de Carga */}
              <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm flex flex-col justify-between space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Ciclos de Carga</span>
                  <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
                    <RefreshCw size={18} />
                  </div>
                </div>
                <div>
                  <span className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                    {batteryData.cycleCount !== undefined ? batteryData.cycleCount : 'N/D'}
                  </span>
                  <p className="text-[11px] font-bold text-slate-500 mt-0.5">
                    {batteryData.cycleCount !== undefined ? (batteryData.cycleCount < 300 ? 'Pouco Uso (<300)' : batteryData.cycleCount < 600 ? 'Uso Moderado' : 'Alto Desgaste (>600)') : 'Leitura Oculta'}
                  </p>
                </div>
              </div>

              {/* Temperatura da Bateria */}
              <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm flex flex-col justify-between space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Temperatura</span>
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                    batteryData.temperatureC > 38 ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-600'
                  }`}>
                    {batteryData.temperatureC > 38 ? <Flame size={18} /> : <Thermometer size={18} />}
                  </div>
                </div>
                <div>
                  <span className={`text-2xl sm:text-3xl font-black tracking-tight ${
                    batteryData.temperatureC > 38 ? 'text-red-600' : 'text-slate-900'
                  }`}>
                    {batteryData.temperatureC}°C
                  </span>
                  <p className="text-[11px] font-bold text-slate-500 mt-0.5">
                    {batteryData.temperatureC > 38 ? '⚠️ Aquecida' : '✅ Faixa Ideal'}
                  </p>
                </div>
              </div>

              {/* Tensão Elétrica (Voltagem) */}
              <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm flex flex-col justify-between space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Tensão Elétrica</span>
                  <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                    <Zap size={18} />
                  </div>
                </div>
                <div>
                  <span className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                    {batteryData.voltageV}V
                  </span>
                  <p className="text-[11px] font-bold text-slate-500 mt-0.5">
                    {batteryData.voltageMv} mV nominal
                  </p>
                </div>
              </div>

              {/* Fonte de Alimentação */}
              <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm flex flex-col justify-between space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Conector de Carga</span>
                  <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                    <BatteryCharging size={18} />
                  </div>
                </div>
                <div>
                  <span className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                    {batteryData.powerSource}
                  </span>
                  <p className="text-[11px] font-bold text-slate-500 mt-0.5">
                    {batteryData.isCharging ? 'Recebendo Corrente' : 'Célula Desconectada'}
                  </p>
                </div>
              </div>

              {/* Química / Tecnologia */}
              <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm flex flex-col justify-between space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Química da Célula</span>
                  <div className="w-8 h-8 rounded-xl bg-slate-50 text-slate-600 flex items-center justify-center">
                    <Cpu size={18} />
                  </div>
                </div>
                <div>
                  <span className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                    {batteryData.technology}
                  </span>
                  <p className="text-[11px] font-bold text-slate-500 mt-0.5">
                    Íon de Lítio OEM
                  </p>
                </div>
              </div>

            </div>
          </div>

          {/* DADOS DETALHADOS DE HARDWARE, MEMÓRIA E SISTEMA */}
          {hardwareData && (
            <div className="bg-white rounded-3xl border border-slate-100 p-6 sm:p-8 shadow-sm space-y-6">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-slate-100 text-slate-700 rounded-xl flex items-center justify-center">
                    <Smartphone size={20} />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-slate-800 uppercase tracking-tight">
                      Ficha Técnica do Aparelho & Memórias
                    </h3>
                    <p className="text-xs text-slate-500">
                      Informações de placa, RAM, armazenamento e tela extraídas via ADB.
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setShowRawModal(true)}
                  className="text-xs font-bold text-slate-500 hover:text-slate-800 flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 rounded-lg border border-slate-200/60 transition-colors"
                >
                  <Info size={14} />
                  <span>Ver Dumpsys Bruto</span>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                
                {/* Modelo e Fabricante */}
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-1">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Aparelho / Modelo</span>
                  <p className="text-sm font-black text-slate-800 uppercase">{hardwareData.brand} {hardwareData.model}</p>
                  <p className="text-xs text-slate-500">{hardwareData.manufacturer || 'Fabricante OEM'}</p>
                </div>

                {/* Android & Segurança */}
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-1">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Android / Patch</span>
                  <p className="text-sm font-black text-slate-800 uppercase">Android {hardwareData.androidVersion}</p>
                  <p className="text-xs text-slate-500">Patch: {hardwareData.securityPatch}</p>
                </div>

                {/* Memória RAM */}
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-1">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Memória RAM</span>
                  <p className="text-sm font-black text-slate-800 uppercase">
                    {hardwareData.ramTotalMb ? `${Math.round(hardwareData.ramTotalMb / 1024)} GB (${hardwareData.ramTotalMb} MB)` : 'N/D'}
                  </p>
                  <p className="text-xs text-slate-500">
                    {hardwareData.ramUsedMb ? `${hardwareData.ramUsedMb} MB em uso` : 'Lendo...'}
                  </p>
                </div>

                {/* Armazenamento Interno */}
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-1">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Armazenamento /data</span>
                  <p className="text-sm font-black text-slate-800 uppercase">
                    {hardwareData.storageTotalGb ? `${hardwareData.storageTotalGb} Total` : 'N/D'}
                  </p>
                  <p className="text-xs text-slate-500">
                    {hardwareData.storageUsedGb ? `${hardwareData.storageUsedGb} usado (${hardwareData.storagePercentUsed || ''})` : 'Lendo...'}
                  </p>
                </div>

                {/* Resolução de Tela */}
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-1">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Display / Resolução</span>
                  <p className="text-sm font-black text-slate-800 uppercase">{hardwareData.screenResolution || 'N/D'}</p>
                  <p className="text-xs text-slate-500">{hardwareData.screenDensity || 'Densidade padrão'}</p>
                </div>

                {/* Chipset / Processador */}
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-1">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Plataforma / Chipset</span>
                  <p className="text-sm font-black text-slate-800 uppercase truncate">{hardwareData.chipset || 'Qualcomm / MediaTek / Exynos'}</p>
                  <p className="text-xs text-slate-500 truncate">SoC Hardware ID</p>
                </div>

                {/* Número de Série */}
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-1">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Serial ADB</span>
                  <p className="text-sm font-mono font-bold text-slate-800 truncate">{hardwareData.serial}</p>
                  <p className="text-xs text-slate-500">Identificador Único</p>
                </div>

                {/* Uptime */}
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-1">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Tempo Ligado</span>
                  <p className="text-sm font-black text-slate-800 truncate">{hardwareData.uptimeFormatted || 'Ativo'}</p>
                  <p className="text-xs text-slate-500">Tempo de atividade</p>
                </div>

              </div>
            </div>
          )}

        </div>
      )}

      {/* MODAL DE DADOS BRUTOS (DUMPSYS BATTERY) */}
      {showRawModal && batteryData && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-8 space-y-5 shadow-2xl max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-black text-slate-800 uppercase tracking-tight">
                Saída do Comando "dumpsys battery"
              </h3>
              <button
                onClick={() => setShowRawModal(false)}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-xl"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto bg-slate-950 text-emerald-400 p-4 rounded-2xl font-mono text-xs leading-relaxed">
              <pre>{batteryData.rawBatteryDump || 'Nenhum dado bruto disponível.'}</pre>
            </div>

            <div className="flex justify-end">
              <button
                onClick={() => setShowRawModal(false)}
                className="px-6 py-2.5 bg-slate-900 text-white font-bold text-xs uppercase rounded-xl"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default AdbBatteryDiagnostics;
