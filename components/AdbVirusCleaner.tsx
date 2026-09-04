import React, { useState, useEffect, useMemo } from 'react';
import {
  ArrowLeft,
  Smartphone,
  Usb,
  Shield,
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  Trash2,
  RefreshCw,
  Search,
  Terminal,
  Download,
  Eye,
  Info,
  HelpCircle,
  Power,
  Battery,
  Layers,
  X,
  Copy,
  Check,
  Ban,
  Sparkles,
  Loader2,
  ChevronRight,
  ExternalLink,
  Clock,
  Activity,
  Flame
} from 'lucide-react';
import { webAdb, DeviceDetails, AdbPackageItem } from '../utils/webAdbService';
import { analyzePackage } from '../utils/adwareDatabase';

interface Props {
  onBack?: () => void;
}

export const AdbVirusCleaner: React.FC<Props> = ({ onBack }) => {
  // Estados de conexão e dispositivo
  const [isSupported, setIsSupported] = useState<boolean>(true);
  const [isInIframe, setIsInIframe] = useState<boolean>(false);
  const [isIframeBlocked, setIsIframeBlocked] = useState<boolean>(false);
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');
  const [deviceInfo, setDeviceInfo] = useState<DeviceDetails | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [loadingMessage, setLoadingMessage] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Lista de aplicativos instalados e escaneados
  const [installedApps, setInstalledApps] = useState<AdbPackageItem[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterTab, setFilterTab] = useState<'all' | 'danger' | 'warning' | 'threats' | 'safe' | 'sideload' | 'recent'>('all');
  const [scanScope, setScanScope] = useState<'user' | 'all'>('user');

  // Modais e gavetas
  const [showGuideModal, setShowGuideModal] = useState<boolean>(false);
  const [guideBrandTab, setGuideBrandTab] = useState<'universal' | 'samsung' | 'motorola' | 'xiaomi'>('universal');
  const [showTerminalModal, setShowTerminalModal] = useState<boolean>(false);
  const [showBatchModal, setShowBatchModal] = useState<boolean>(false);
  const [showAppDetailModal, setShowAppDetailModal] = useState<boolean>(false);
  const [showRecentsModal, setShowRecentsModal] = useState<boolean>(false);
  const [isRefreshingRecents, setIsRefreshingRecents] = useState<boolean>(false);
  const [selectedAppDetail, setSelectedAppDetail] = useState<{
    app: AdbPackageItem;
    permissions: string[];
    raw: string;
    loading: boolean;
  } | null>(null);

  // Modal de Confirmação In-App (substitui window.confirm bloqueado por iframes)
  const [confirmUninstallApp, setConfirmUninstallApp] = useState<AdbPackageItem | null>(null);

  // Modal de Orientação Específica da Xiaomi / Redmi / HyperOS
  const [showXiaomiSecurityModal, setShowXiaomiSecurityModal] = useState<boolean>(false);

  // Notificações Toast In-App
  const [toast, setToast] = useState<{
    id: number;
    type: 'success' | 'error' | 'warning' | 'info';
    title: string;
    message: string;
  } | null>(null);

  const showToast = (type: 'success' | 'error' | 'warning' | 'info', title: string, message: string) => {
    const id = Date.now();
    setToast({ id, type, title, message });
    setTimeout(() => {
      setToast(curr => (curr?.id === id ? null : curr));
    }, 5000);
  };

  // Logs do terminal
  const [logs, setLogs] = useState<Array<{ timestamp: string; type: 'info' | 'cmd' | 'success' | 'error'; text: string }>>([
    { timestamp: new Date().toLocaleTimeString(), type: 'info', text: 'Central de Limpeza ADB pronta para conexão.' }
  ]);

  // Modo Manual (Colar Lista ou Gerar Script)
  const [manualInput, setManualInput] = useState<string>('');
  const [showManualParser, setShowManualParser] = useState<boolean>(false);
  const [copiedPackage, setCopiedPackage] = useState<string | null>(null);

  // Ações de desinstalação em lote
  const [batchProgress, setBatchProgress] = useState<{ current: number; total: number; appName: string } | null>(null);

  const addLog = (type: 'info' | 'cmd' | 'success' | 'error', text: string) => {
    setLogs(prev => [
      { timestamp: new Date().toLocaleTimeString(), type, text },
      ...prev.slice(0, 99)
    ]);
  };

  useEffect(() => {
    setIsSupported(webAdb.isWebUsbSupported());
    setIsInIframe(webAdb.isRunningInIframe());
  }, []);

  // Abrir aplicação em nova aba para liberar porta USB
  const handleOpenInNewTab = () => {
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('tab', 'config');
      url.searchParams.set('view', 'adb-cleaner');
      url.hash = 'adb-cleaner';
      window.open(url.toString(), '_blank', 'noopener,noreferrer');
    } catch (e) {
      window.open(window.location.href, '_blank');
    }
  };

  // Estatísticas calculadas (foco exclusivo em apps instalados pelo usuário)
  const stats = useMemo(() => {
    const danger = installedApps.filter(a => a.riskLevel === 'danger').length;
    const warning = installedApps.filter(a => a.riskLevel === 'warning').length;
    const safe = installedApps.filter(a => a.riskLevel === 'safe').length;
    const sideloaded = installedApps.filter(
      a => !a.installer || a.installer === 'null' || a.installer.includes('packageinstaller')
    ).length;
    const recent = installedApps.filter(
      a => a.isRecent || a.recentOrderIndex !== undefined || a.isForegroundNow
    ).length;
    return {
      total: installedApps.length,
      danger,
      warning,
      safe,
      threats: danger + warning,
      sideloaded,
      recent
    };
  }, [installedApps]);

  // Lista filtrada
  const filteredApps = useMemo(() => {
    const list = installedApps.filter(app => {
      // Filtro de aba
      if (filterTab === 'threats' && app.riskLevel === 'safe') return false;
      if (filterTab === 'danger' && app.riskLevel !== 'danger') return false;
      if (filterTab === 'warning' && app.riskLevel !== 'warning') return false;
      if (filterTab === 'safe' && app.riskLevel !== 'safe') return false;
      if (
        filterTab === 'sideload' &&
        (app.installer === 'com.android.vending' || app.installer?.includes('samsungapps') || app.installer?.includes('mipicks'))
      ) {
        return false;
      }
      if (
        filterTab === 'recent' &&
        !app.isRecent &&
        app.recentOrderIndex === undefined &&
        !app.isForegroundNow
      ) {
        return false;
      }

      // Filtro de pesquisa
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        app.appName.toLowerCase().includes(q) ||
        app.packageName.toLowerCase().includes(q) ||
        app.category.toLowerCase().includes(q) ||
        app.reason.toLowerCase().includes(q) ||
        (app.sourceText && app.sourceText.toLowerCase().includes(q)) ||
        (app.lastUsedFormatted && app.lastUsedFormatted.toLowerCase().includes(q))
      );
    });

    // Se estiver na aba de recentes, ordena pela ordem cronológica (#0 em primeiro)
    if (filterTab === 'recent') {
      return [...list].sort((a, b) => {
        if (a.isForegroundNow && !b.isForegroundNow) return -1;
        if (!a.isForegroundNow && b.isForegroundNow) return 1;
        const orderA = a.recentOrderIndex !== undefined ? a.recentOrderIndex : 9999;
        const orderB = b.recentOrderIndex !== undefined ? b.recentOrderIndex : 9999;
        return orderA - orderB;
      });
    }

    return list;
  }, [installedApps, filterTab, searchQuery]);

  // Atualizar dados de aplicativos recentes em tempo real via ADB
  const handleRefreshRecentActivity = async () => {
    if (!webAdb.isConnected()) return;
    setIsRefreshingRecents(true);
    addLog('cmd', 'dumpsys activity recents && dumpsys usagestats');
    try {
      const recentsMap = await webAdb.getRecentTasksAndUsage();
      setInstalledApps(prev => prev.map(app => {
        const usage = recentsMap.get(app.packageName);
        if (usage) {
          return {
            ...app,
            recentOrderIndex: usage.recentOrderIndex,
            lastUsedFormatted: usage.lastUsedFormatted,
            totalTimeInForeground: usage.totalTimeInForeground,
            isForegroundNow: usage.isForegroundNow,
            isRunning: usage.isRunning,
            isRecent: true
          };
        }
        return {
          ...app,
          isForegroundNow: false
        };
      }));
      showToast('info', 'Atividade Recente Atualizada', 'A lista de apps ativos e ordem de recentes foi sincronizada com o aparelho.');
      addLog('success', `Atividade recente sincronizada: ${recentsMap.size} tarefas identificadas no sistema.`);
    } catch (e: any) {
      addLog('error', `Falha ao sincronizar recentes: ${e.message}`);
      showToast('error', 'Falha ao Ler Recentes', e.message);
    } finally {
      setIsRefreshingRecents(false);
    }
  };

  // Conectar dispositivo via WebUSB
  const handleConnect = async () => {
    setErrorMessage(null);
    setIsIframeBlocked(false);
    setConnectionStatus('connecting');
    setLoadingMessage('Selecione o aparelho na janela e autorize a Depuração USB na tela do celular...');
    addLog('info', 'Iniciando solicitação WebUSB...');

    try {
      await webAdb.connect();
      addLog('success', 'Dispositivo USB conectado com sucesso! Lendo propriedades do sistema...');

      setLoadingMessage('Identificando modelo e versão do Android...');
      const info = await webAdb.getDeviceInfo();
      setDeviceInfo(info);
      setConnectionStatus('connected');
      addLog('info', `Aparelho detectado: ${info.brand} ${info.model} (Android ${info.androidVersion})`);

      // Escaneia os aplicativos instalados
      await handleScanApps();
    } catch (err: any) {
      console.error(err);
      setConnectionStatus('disconnected');
      const msg = (err?.message || String(err)).toLowerCase();
      if (
        msg.includes('permissions policy') ||
        msg.includes('disallowed') ||
        msg.includes('feature "usb"') ||
        err?.name === 'SecurityError'
      ) {
        setIsIframeBlocked(true);
        setErrorMessage(
          'Acesso à porta USB bloqueado pela política de segurança do iframe. Clique no botão "Abrir em Nova Aba" abaixo para conectar o celular diretamente pelo cabo USB!'
        );
        addLog('error', 'Falha de permissão: Navegador bloqueou WebUSB dentro do iframe. Abra em nova aba.');
      } else {
        setErrorMessage(err.message || 'Falha ao conectar via USB. Verifique a Depuração USB no celular.');
        addLog('error', `Erro na conexão: ${err.message || 'Falha desconhecida'}`);
      }
    } finally {
      setLoadingMessage('');
    }
  };

  // Desconectar dispositivo
  const handleDisconnect = async () => {
    await webAdb.disconnect();
    setConnectionStatus('disconnected');
    setDeviceInfo(null);
    setInstalledApps([]);
    addLog('info', 'Dispositivo desconectado.');
  };

  // Escanear aplicativos instalados pelo usuário
  const handleScanApps = async (overrideScope?: 'user' | 'all') => {
    if (!webAdb.isConnected()) return;
    const targetScope = overrideScope || 'user';
    setIsLoading(true);
    setLoadingMessage('Varrendo aplicativos instalados pelo usuário e buscando vírus/adwares...');
    addLog('cmd', `pm list packages -3 -f -i (filtrando 100% dos apps do sistema)`);

    try {
      const apps = await webAdb.listAndAnalyzeInstalledApps(targetScope);
      setInstalledApps(apps);
      const threatsFound = apps.filter(a => a.riskLevel !== 'safe').length;
      const dangerFound = apps.filter(a => a.riskLevel === 'danger').length;
      const warningFound = apps.filter(a => a.riskLevel === 'warning').length;
      addLog(
        'success',
        `Varredura concluída: ${apps.length} aplicativos instalados pelo usuário encontrados. ${dangerFound} com Tarja Vermelha (Vírus/Adware) e ${warningFound} com Tarja Laranja (PUPs)!`
      );

      // Se encontrou ameaças, direciona para a aba de ameaças ou mantém todos
      if (dangerFound > 0) {
        setFilterTab('danger');
      } else if (threatsFound > 0) {
        setFilterTab('threats');
      } else {
        setFilterTab('all');
      }
    } catch (err: any) {
      setErrorMessage(`Erro ao listar aplicativos: ${err.message}`);
      addLog('error', `Falha ao listar apps: ${err.message}`);
    } finally {
      setIsLoading(false);
      setLoadingMessage('');
    }
  };

  // Desinstalar aplicativo individual: abre modal de confirmação in-app
  const handleUninstall = (app: AdbPackageItem) => {
    setConfirmUninstallApp(app);
  };

  // Execução real da desinstalação via ADB
  const executeUninstall = async (app: AdbPackageItem) => {
    setConfirmUninstallApp(null);
    addLog('cmd', `pm uninstall --user 0 ${app.packageName}`);
    setInstalledApps(prev => prev.map(a => a.packageName === app.packageName ? { ...a, isRemoving: true } : a));

    try {
      const res = await webAdb.uninstallPackage(app.packageName, app.isSystemApp);
      if (res.success) {
        const msg = res.userMessage || `✓ Aplicativo "${app.appName}" foi removido com sucesso via ADB!`;
        addLog('success', msg);
        // Remove da lista para manter atualizado em tempo real
        setInstalledApps(prev => prev.filter(a => a.packageName !== app.packageName));
        showToast('success', 'Aplicativo Desinstalado', `"${app.appName}" foi removido com sucesso do celular!`);
      } else {
        const failureMsg = res.userMessage || res.output || 'Falha ao desinstalar aplicativo.';
        addLog('error', `Falha ao remover ${app.appName}: ${failureMsg}`);
        setInstalledApps(prev => prev.map(a => a.packageName === app.packageName ? { ...a, isRemoving: false } : a));

        if (res.isXiaomiRestricted) {
          setShowXiaomiSecurityModal(true);
          showToast('warning', 'Xiaomi / Redmi: Ativação Necessária', 'Ative "Depuração USB (Configurações de Segurança)" no seu Redmi.');
        } else {
          showToast('error', 'Falha ao Desinstalar', `${failureMsg} (Você pode tentar a opção "Congelar" ao lado)`);
        }
      }
    } catch (err: any) {
      addLog('error', `Erro na desinstalação: ${err.message}`);
      setInstalledApps(prev => prev.map(a => a.packageName === app.packageName ? { ...a, isRemoving: false } : a));
      showToast('error', 'Erro de Comunicação ADB', err.message);
    }
  };

  // Desativar / Congelar app
  const handleDisable = async (app: AdbPackageItem) => {
    addLog('cmd', `pm disable-user --user 0 ${app.packageName}`);
    try {
      const out = await webAdb.disablePackage(app.packageName);
      addLog('success', `App congelado/desativado: ${out}`);
      showToast('success', 'Aplicativo Congelado', `"${app.appName}" foi congelado e não rodará mais no aparelho.`);
    } catch (e: any) {
      addLog('error', `Falha ao desativar: ${e.message}`);
      showToast('error', 'Falha ao Congelar', e.message);
    }
  };

  // Limpar cache e dados
  const handleClearData = async (app: AdbPackageItem) => {
    addLog('cmd', `pm clear ${app.packageName}`);
    try {
      const out = await webAdb.clearAppData(app.packageName);
      addLog('success', `Dados limpos (${app.appName}): ${out}`);
      showToast('info', 'Dados Limpos', `Armazenamento e cache de "${app.appName}" foram zerados.`);
    } catch (e: any) {
      addLog('error', `Falha ao limpar dados: ${e.message}`);
      showToast('error', 'Falha ao Limpar Dados', e.message);
    }
  };

  // Forçar parada
  const handleForceStop = async (app: AdbPackageItem) => {
    addLog('cmd', `am force-stop ${app.packageName}`);
    try {
      await webAdb.forceStopApp(app.packageName);
      setInstalledApps(prev => prev.map(a => a.packageName === app.packageName ? {
        ...a,
        isForegroundNow: false,
        isRunning: false
      } : a));
      addLog('success', `Processos de "${app.appName}" interrompidos imediatamente.`);
      showToast('info', 'Processo Interrompido', `"${app.appName}" foi finalizado com sucesso!`);
    } catch (e: any) {
      addLog('error', `Falha ao parar app: ${e.message}`);
      showToast('error', 'Falha ao Parar App', e.message);
    }
  };

  // Abrir tela de detalhes no celular
  const handleOpenOnDevice = async (app: AdbPackageItem) => {
    addLog('cmd', `am start -a APPLICATION_DETAILS_SETTINGS ${app.packageName}`);
    try {
      await webAdb.openAppSettingsOnDevice(app.packageName);
      addLog('info', `Tela de configurações de "${app.appName}" aberta no celular.`);
      showToast('info', 'Tela Aberta no Celular', `Aberto os detalhes de "${app.appName}".`);
    } catch (e: any) {
      addLog('error', `Falha ao abrir no celular: ${e.message}`);
      showToast('error', 'Falha ao Abrir', e.message);
    }
  };

  // Visualizar permissões detalhadas
  const handleViewDetails = async (app: AdbPackageItem) => {
    setSelectedAppDetail({ app, permissions: [], raw: '', loading: true });
    setShowAppDetailModal(true);
    addLog('cmd', `dumpsys package ${app.packageName}`);

    try {
      const details = await webAdb.getAppDetails(app.packageName);
      setSelectedAppDetail({ app, permissions: details.permissions, raw: details.raw, loading: false });
    } catch (e: any) {
      setSelectedAppDetail(prev => prev ? { ...prev, loading: false, raw: e.message } : null);
    }
  };

  // Desinstalação em Lote de Todas as Ameaças
  const handleBatchUninstall = async () => {
    const threatsToUninstall = installedApps.filter(a => a.selected && a.riskLevel !== 'safe');
    if (threatsToUninstall.length === 0) {
      showToast('warning', 'Nenhum App Selecionado', 'Nenhum aplicativo suspeito ou vírus selecionado para remoção.');
      return;
    }

    setShowBatchModal(false);
    setIsLoading(true);
    addLog('info', `Iniciando limpeza em lote de ${threatsToUninstall.length} aplicativos...`);

    let removedCount = 0;
    let xiaomiBlockDetected = false;
    const remainingApps = [...installedApps];

    for (let i = 0; i < threatsToUninstall.length; i++) {
      const target = threatsToUninstall[i];
      setBatchProgress({ current: i + 1, total: threatsToUninstall.length, appName: target.appName });
      addLog('cmd', `[${i + 1}/${threatsToUninstall.length}] Desinstalando ${target.appName} (${target.packageName})...`);

      try {
        const res = await webAdb.uninstallPackage(target.packageName, target.isSystemApp);
        if (res.success) {
          removedCount++;
          addLog('success', `✓ ${target.appName} removido/desativado com sucesso.`);
          const idx = remainingApps.findIndex(a => a.packageName === target.packageName);
          if (idx !== -1) remainingApps.splice(idx, 1);
        } else {
          if (res.isXiaomiRestricted) xiaomiBlockDetected = true;
          addLog('error', `✗ Falha ao remover ${target.appName}: ${res.userMessage || res.output}`);
        }
      } catch (err: any) {
        addLog('error', `Erro em ${target.appName}: ${err.message}`);
      }
    }

    setInstalledApps(remainingApps);
    setBatchProgress(null);
    setIsLoading(false);
    addLog('success', `Limpeza concluída! ${removedCount} de ${threatsToUninstall.length} aplicativos foram removidos.`);

    if (xiaomiBlockDetected) {
      setShowXiaomiSecurityModal(true);
      showToast('warning', 'Aparelho Xiaomi / Redmi', `${removedCount} apps removidos. A Xiaomi bloqueou os demais via USB (veja instruções).`);
    } else {
      showToast('success', 'Limpeza Concluída', `${removedCount} de ${threatsToUninstall.length} aplicativos foram removidos com sucesso!`);
    }
  };

  // Alternar seleção de app
  const toggleSelectApp = (packageName: string) => {
    setInstalledApps(prev => prev.map(a => a.packageName === packageName ? { ...a, selected: !a.selected } : a));
  };

  // Selecionar todos os perigosos
  const selectAllThreats = () => {
    setInstalledApps(prev => prev.map(a => ({
      ...a,
      selected: a.riskLevel === 'danger' || a.riskLevel === 'warning'
    })));
  };

  // Copiar nome do pacote
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedPackage(text);
    setTimeout(() => setCopiedPackage(null), 2000);
  };

  // Analisar lista colada manualmente
  const handleParseManualList = () => {
    if (!manualInput.trim()) return;
    const lines = manualInput.split('\n');
    const parsed: AdbPackageItem[] = [];

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) continue;
      const cleanPkg = line.replace(/^package:/, '').replace(/\s+.*/, '').split('=')[0];
      if (cleanPkg) {
        const analysis = analyzePackage(cleanPkg);
        parsed.push({
          ...analysis,
          selected: analysis.riskLevel === 'danger'
        });
      }
    }

    const riskWeight = { danger: 3, warning: 2, safe: 1 };
    parsed.sort((a, b) => (riskWeight[b.riskLevel] - riskWeight[a.riskLevel]) || a.appName.localeCompare(b.appName));
    setInstalledApps(parsed);
    setShowManualParser(false);
    addLog('info', `${parsed.length} aplicativos importados e analisados manualmente.`);
  };

  // Gerar Script de Limpeza em Lote (.BAT para Windows)
  const downloadBatchScript = () => {
    const toRemove = installedApps.filter(a => a.selected || a.riskLevel === 'danger');
    if (toRemove.length === 0) {
      showToast('warning', 'Nenhum App Selecionado', 'Nenhum aplicativo suspeito marcado para remoção.');
      return;
    }

    let scriptContent = `@echo off\nchcp 65001 > nul\necho ==================================================\necho   LOJAS CLOUD - LIMPEZA DE VÍRUS & ADWARE ANDROID\necho ==================================================\necho.\n`;
    scriptContent += `echo Verificando conexao ADB...\nadb devices\necho.\n`;
    scriptContent += `echo Iniciando remocao forçada de ${toRemove.length} aplicativos...\necho.\n`;

    toRemove.forEach(app => {
      scriptContent += `echo [REMOVENDO] ${app.appName} (${app.packageName})...\n`;
      scriptContent += `adb shell pm uninstall -k --user 0 ${app.packageName}\n`;
      scriptContent += `adb uninstall ${app.packageName}\n`;
      scriptContent += `echo.\n`;
    });

    scriptContent += `echo ==================================================\necho LIMPEZA CONCLUÍDA COM SUCESSO!\necho ==================================================\npause\n`;

    const blob = new Blob([scriptContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `limpar_virus_android_${new Date().toISOString().slice(0, 10)}.bat`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    addLog('info', 'Script .bat gerado e baixado.');
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300 pb-24 max-w-5xl mx-auto">
      {/* Barra de Topo */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
        <div className="flex items-center gap-4">
          {onBack && (
            <button
              onClick={onBack}
              className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-all active:scale-95 flex items-center justify-center shrink-0"
              title="Voltar aos Ajustes"
            >
              <ArrowLeft size={20} />
            </button>
          )}
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1.5 bg-red-100 text-red-600 rounded-lg">
                <ShieldAlert size={18} />
              </span>
              <h1 className="text-lg sm:text-xl font-black text-slate-800 tracking-tight uppercase">
                Limpeza de Vírus & Adware Android (ADB)
              </h1>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Conexão direta via cabo USB para escanear e desinstalar propagandas abusivas e aplicativos invasivos.
            </p>
          </div>
        </div>

        {/* Ações de Conexão no Topo */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleOpenInNewTab}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-xl transition-all border border-blue-200"
            title="Abrir esta ferramenta em uma nova aba do navegador para acesso total e irrestrito à porta USB"
          >
            <ExternalLink size={15} />
            <span>Abrir em Nova Aba</span>
          </button>

          <button
            onClick={() => setShowGuideModal(true)}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all"
          >
            <HelpCircle size={15} />
            <span>Como Ativar USB</span>
          </button>

          <button
            onClick={() => setShowTerminalModal(true)}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all"
            title="Ver logs do ADB"
          >
            <Terminal size={15} />
            <span>Logs ({logs.length})</span>
          </button>

          {connectionStatus === 'connected' ? (
            <button
              onClick={handleDisconnect}
              className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 hover:bg-red-100 rounded-xl font-black text-xs uppercase tracking-wider transition-all"
            >
              <Power size={14} />
              <span>Desconectar</span>
            </button>
          ) : (
            <button
              onClick={handleConnect}
              disabled={connectionStatus === 'connecting'}
              className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-black text-xs uppercase tracking-wider shadow-lg shadow-blue-500/20 active:scale-95 transition-all disabled:opacity-50"
            >
              {connectionStatus === 'connecting' ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>Conectando...</span>
                </>
              ) : (
                <>
                  <Usb size={16} />
                  <span>Conectar Celular USB</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Alerta Crítico: Permissions Policy / Iframe bloqueou WebUSB */}
      {isIframeBlocked && (
        <div className="bg-gradient-to-r from-red-600 via-rose-600 to-amber-600 text-white p-5 rounded-3xl shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-5 animate-in fade-in zoom-in-95">
          <div className="flex items-start gap-3.5">
            <div className="p-3 bg-white/20 rounded-2xl backdrop-blur-sm shrink-0">
              <ShieldAlert size={28} className="text-white" />
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="bg-white/30 text-[10px] font-black uppercase px-2 py-0.5 rounded-md">Bloqueio de Segurança do Navegador</span>
                <h3 className="font-black text-sm sm:text-base uppercase tracking-tight">
                  Porta USB Restrita Dentro do Preview Embutido
                </h3>
              </div>
              <p className="text-xs text-white/90 leading-relaxed max-w-2xl">
                O navegador (Google Chrome/Edge) <strong>bloqueia o uso de portas USB físicas dentro de janelas embutidas (iframes)</strong> por política de segurança da web (Permissions Policy).
                Para conectar o celular via cabo USB e remover os vírus com 1 clique, basta <strong>abrir o sistema em uma Nova Aba</strong>!
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2.5 w-full md:w-auto shrink-0 flex-wrap">
            <button
              onClick={handleOpenInNewTab}
              className="flex-1 md:flex-none px-6 py-3.5 bg-white text-slate-900 hover:bg-slate-100 rounded-xl font-black text-xs uppercase tracking-wider shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2"
            >
              <ExternalLink size={18} className="text-blue-600" />
              <span>Abrir em Nova Aba Agora</span>
            </button>
          </div>
        </div>
      )}

      {/* Dica para quem está no preview do iframe */}
      {isInIframe && !isIframeBlocked && connectionStatus === 'disconnected' && (
        <div className="bg-sky-50 border border-sky-200 p-4 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 animate-in fade-in">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-sky-100 text-sky-700 rounded-xl shrink-0">
              <ExternalLink size={18} />
            </div>
            <div className="text-xs text-sky-900 space-y-0.5">
              <p className="font-bold uppercase tracking-tight">Ambiente de Teste Embutido (Iframe)</p>
              <p>
                Por segurança, o navegador restringe conexões USB dentro de janelas embutidas. Para conectar o celular pelo cabo USB, clique em <strong>Abrir em Nova Aba</strong>.
              </p>
            </div>
          </div>
          <button
            onClick={handleOpenInNewTab}
            className="shrink-0 w-full sm:w-auto px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-xl font-bold text-xs uppercase tracking-wider shadow-sm transition-all flex items-center justify-center gap-1.5"
          >
            <ExternalLink size={14} />
            <span>Abrir em Nova Aba</span>
          </button>
        </div>
      )}

      {/* Alerta de Suporte ao WebUSB se não for Chrome/Edge */}
      {!isSupported && (
        <div className="bg-amber-50 border border-amber-200 p-4 rounded-2xl flex items-start gap-3">
          <AlertTriangle className="text-amber-600 shrink-0 mt-0.5" size={20} />
          <div className="text-xs text-amber-800 space-y-1">
            <p className="font-bold">Aviso de Navegador:</p>
            <p>
              A conexão direta por cabo USB (WebUSB) requer navegadores baseados em Chromium (como <strong>Google Chrome</strong>, <strong>Microsoft Edge</strong>, <strong>Brave</strong> ou <strong>Opera</strong>) em um computador.
            </p>
            <p>
              Caso esteja em outro navegador, você pode utilizar o botão <strong>Importar Lista / Gerar Script .BAT</strong> abaixo para limpar o celular com 1 clique!
            </p>
          </div>
        </div>
      )}

      {/* Mensagem de Erro se houver */}
      {errorMessage && !isIframeBlocked && (
        <div className="bg-red-50 border border-red-200 p-4 rounded-2xl flex items-start justify-between gap-3 animate-in fade-in">
          <div className="flex items-start gap-3">
            <ShieldAlert className="text-red-600 shrink-0 mt-0.5" size={20} />
            <div className="text-xs text-red-800">
              <p className="font-bold">Falha na Operação:</p>
              <p>{errorMessage}</p>
            </div>
          </div>
          <button onClick={() => setErrorMessage(null)} className="text-red-400 hover:text-red-700">
            <X size={16} />
          </button>
        </div>
      )}

      {/* Banner de Carregamento / Progresso */}
      {(loadingMessage || batchProgress) && (
        <div className="bg-blue-50 border border-blue-200 p-4 rounded-2xl flex items-center gap-3">
          <Loader2 className="animate-spin text-blue-600 shrink-0" size={20} />
          <div className="text-xs text-blue-900 flex-1">
            <p className="font-bold">Processando via ADB...</p>
            <p>{batchProgress ? `Removendo [${batchProgress.current}/${batchProgress.total}]: ${batchProgress.appName}` : loadingMessage}</p>
          </div>
          {batchProgress && (
            <span className="text-xs font-black bg-blue-200 text-blue-800 px-2.5 py-1 rounded-full">
              {Math.round((batchProgress.current / batchProgress.total) * 100)}%
            </span>
          )}
        </div>
      )}

      {/* Card do Dispositivo Conectado */}
      {connectionStatus === 'connected' && deviceInfo && (
        <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white p-6 rounded-3xl shadow-xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-white/10 rounded-2xl flex items-center justify-center text-blue-400 border border-white/10 shrink-0">
                <Smartphone size={32} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-[10px] font-black tracking-widest text-emerald-400 uppercase">Aparelho Conectado</span>
                </div>
                <h2 className="text-xl font-black tracking-tight">{deviceInfo.brand} {deviceInfo.model}</h2>
                <p className="text-xs text-slate-400">Android {deviceInfo.androidVersion} • Patch: {deviceInfo.securityPatch}</p>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {deviceInfo.batteryLevel !== undefined && (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-white/10 rounded-xl text-xs font-bold">
                  <Battery size={16} className={deviceInfo.batteryLevel < 20 ? 'text-red-400' : 'text-emerald-400'} />
                  <span>{deviceInfo.batteryLevel}%</span>
                  {deviceInfo.batteryStatus && <span className="text-[10px] text-slate-300">({deviceInfo.batteryStatus})</span>}
                </div>
              )}

              {/* Indicador de Escopo: Apenas Apps do Usuário */}
              <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-500/20 border border-blue-400/30 rounded-xl text-xs font-bold text-blue-200">
                <ShieldCheck size={15} className="text-blue-400 shrink-0" />
                <span>Modo: Apenas Apps do Usuário (Sistema Ocultado)</span>
              </div>

              <button
                onClick={() => handleScanApps()}
                disabled={isLoading}
                className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-xl text-xs font-black uppercase tracking-wider text-white transition-all active:scale-95 disabled:opacity-50 shadow-lg shadow-emerald-600/30"
                title="Executar análise e escaneamento inteligente agora"
              >
                <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
                <span>Escanear Agora</span>
              </button>

              <button
                onClick={async () => {
                  try {
                    addLog('cmd', 'reboot');
                    await webAdb.exec('reboot');
                    showToast('info', 'Reiniciando Aparelho', 'Comando de reinicialização enviado ao celular.');
                    handleDisconnect();
                  } catch (e: any) {
                    showToast('error', 'Falha ao Reiniciar', e.message);
                  }
                }}
                className="flex items-center gap-1.5 px-3 py-2 bg-white/10 hover:bg-white/20 rounded-xl text-xs font-bold text-slate-300 hover:text-white transition-all"
                title="Reiniciar Aparelho"
              >
                <Power size={14} />
                <span>Reiniciar</span>
              </button>
            </div>
          </div>

          {/* Banners Especiais de Orientação por Fabricante (Samsung, Motorola, Xiaomi) */}
          {deviceInfo.brandFlavor === 'samsung' || deviceInfo.brand.includes('SAMSUNG') ? (
            <div className="bg-blue-500/15 border border-blue-400/30 p-3.5 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
              <div className="flex items-start gap-2.5 text-blue-200">
                <CheckCircle2 size={18} className="text-blue-400 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-blue-300 block">Samsung Galaxy ({deviceInfo.systemUiVersion || 'One UI'}):</strong>
                  <span>Otimização One UI ativa. Pacotes essenciais da Samsung e Knox protegidos. Remoção limpa de adwares e popups sem reinicialização.</span>
                </div>
              </div>
              <button
                onClick={() => {
                  setGuideBrandTab('samsung');
                  setShowGuideModal(true);
                }}
                className="shrink-0 px-3.5 py-1.5 bg-blue-500 text-white hover:bg-blue-400 rounded-xl font-black text-[11px] uppercase tracking-wider transition-all"
              >
                Dicas Samsung
              </button>
            </div>
          ) : deviceInfo.brandFlavor === 'motorola' || deviceInfo.brand.includes('MOTOROLA') || deviceInfo.brand.includes('MOTO') ? (
            <div className="bg-emerald-500/15 border border-emerald-400/30 p-3.5 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
              <div className="flex items-start gap-2.5 text-emerald-200">
                <CheckCircle2 size={18} className="text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-emerald-300 block">Motorola Moto ({deviceInfo.systemUiVersion || 'My UX / Hello UI'}):</strong>
                  <span>Otimização Motorola ativa. Desinstalação com permissão de usuário 0 direta. Recursos Moto Actions, Moto Tela e Ready For 100% protegidos.</span>
                </div>
              </div>
              <button
                onClick={() => {
                  setGuideBrandTab('motorola');
                  setShowGuideModal(true);
                }}
                className="shrink-0 px-3.5 py-1.5 bg-emerald-500 text-slate-950 hover:bg-emerald-400 rounded-xl font-black text-[11px] uppercase tracking-wider transition-all"
              >
                Dicas Motorola
              </button>
            </div>
          ) : (deviceInfo.brand.toLowerCase().includes('xiaomi') ||
            deviceInfo.brand.toLowerCase().includes('redmi') ||
            deviceInfo.brand.toLowerCase().includes('poco') ||
            deviceInfo.model.toLowerCase().includes('redmi') ||
            deviceInfo.manufacturer.toLowerCase().includes('xiaomi')) ? (
            <div className="bg-amber-500/15 border border-amber-400/30 p-3.5 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
              <div className="flex items-start gap-2.5 text-amber-200">
                <AlertTriangle size={18} className="text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-amber-300 block">Dica Xiaomi / Redmi (HyperOS / MIUI):</strong>
                  <span>Para desinstalar apps pelo USB no seu Redmi, a opção <em>"Depuração USB (Configurações de Segurança)"</em> precisa estar ligada no celular.</span>
                </div>
              </div>
              <button
                onClick={() => setShowXiaomiSecurityModal(true)}
                className="shrink-0 px-3.5 py-1.5 bg-amber-400 text-slate-950 hover:bg-amber-300 rounded-xl font-black text-[11px] uppercase tracking-wider transition-all"
              >
                Ver Como Ativar
              </button>
            </div>
          ) : null}

          <div className="pt-2 border-t border-white/10 flex items-center justify-between text-[11px] text-slate-400 flex-wrap gap-2">
            <span>Serial: <code className="text-slate-200 font-mono">{deviceInfo.serial}</code></span>
            <span>Fabricante: <strong className="text-slate-200">{deviceInfo.manufacturer || deviceInfo.brand}</strong></span>
          </div>
        </div>
      )}

      {/* Se não estiver conectado, mostra banner de instruções rápidas */}
      {connectionStatus === 'disconnected' && installedApps.length === 0 && (
        <div className="bg-white rounded-3xl p-8 border border-slate-100 shadow-sm text-center space-y-6">
          <div className="w-20 h-20 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
            <Smartphone size={40} />
          </div>
          <div className="max-w-md mx-auto space-y-2">
            <h3 className="text-xl font-black text-slate-800">Conecte o Celular para Limpar Vírus</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Esta ferramenta profissional analisa os aplicativos instalados pelo cliente, detecta adwares geradores de propagandas, falsos limpadores e vírus, e permite a remoção forçada instantânea via ADB.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-2xl mx-auto text-left">
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-1">
              <span className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-black">1</span>
              <h4 className="text-xs font-bold text-slate-700">Ative Depuração USB</h4>
              <p className="text-[11px] text-slate-500">Toque 7x em Número da Versão nas configurações do Android.</p>
            </div>
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-1">
              <span className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-black">2</span>
              <h4 className="text-xs font-bold text-slate-700">Plugue o Cabo USB</h4>
              <p className="text-[11px] text-slate-500">Conecte o celular ao computador e clique em Conectar.</p>
            </div>
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-1">
              <span className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-black">3</span>
              <h4 className="text-xs font-bold text-slate-700">Autorize na Tela</h4>
              <p className="text-[11px] text-slate-500">Marque "Sempre permitir" e confirme o popup no celular.</p>
            </div>
          </div>

          {/* Botões de Ajuda Rápida por Marca (Samsung, Motorola, Xiaomi) */}
          <div className="flex flex-wrap items-center justify-center gap-2 pt-1 max-w-xl mx-auto">
            <span className="text-[11px] font-bold text-slate-400 mr-1">Guias rápidos:</span>
            <button
              onClick={() => {
                setGuideBrandTab('samsung');
                setShowGuideModal(true);
              }}
              className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl text-xs font-bold transition-all border border-blue-200 flex items-center gap-1.5"
            >
              <span>📱 Samsung Galaxy</span>
            </button>
            <button
              onClick={() => {
                setGuideBrandTab('motorola');
                setShowGuideModal(true);
              }}
              className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-xl text-xs font-bold transition-all border border-emerald-200 flex items-center gap-1.5"
            >
              <span>⚡ Motorola Moto</span>
            </button>
            <button
              onClick={() => {
                setGuideBrandTab('xiaomi');
                setShowGuideModal(true);
              }}
              className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 rounded-xl text-xs font-bold transition-all border border-amber-200 flex items-center gap-1.5"
            >
              <span>🛡️ Xiaomi / Redmi</span>
            </button>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <button
              onClick={handleConnect}
              className="w-full sm:w-auto px-8 py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black text-xs uppercase tracking-wider shadow-xl shadow-blue-500/25 active:scale-95 transition-all flex items-center justify-center gap-2"
            >
              <Usb size={18} />
              <span>Conectar Celular via USB</span>
            </button>
            <button
              onClick={() => setShowManualParser(true)}
              className="w-full sm:w-auto px-5 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl font-black text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2"
            >
              <Terminal size={16} />
              <span>Colar Lista ou Modo Manual</span>
            </button>
          </div>
        </div>
      )}

      {/* Métricas e Estatísticas do Scanner Inteligente */}
      {installedApps.length > 0 && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {/* Total Apps Instalados pelo Usuário */}
            <div
              onClick={() => setFilterTab('all')}
              className="bg-white p-3.5 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-2.5 cursor-pointer hover:border-slate-300 transition-all"
            >
              <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl shrink-0">
                <Smartphone size={18} />
              </div>
              <div className="min-w-0">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block truncate">Apps Usuário</span>
                <span className="text-xl font-black text-slate-800">{stats.total}</span>
              </div>
            </div>

            {/* Tarja Vermelha • Adware / Vírus */}
            <div
              onClick={() => setFilterTab('danger')}
              className={`p-3.5 rounded-2xl border shadow-sm flex items-center gap-2.5 cursor-pointer transition-all ${
                stats.danger > 0 ? 'bg-red-50 border-red-300 text-red-900 shadow-red-500/10' : 'bg-white border-slate-100 hover:border-slate-300'
              }`}
            >
              <div className={`p-2.5 rounded-xl shrink-0 ${stats.danger > 0 ? 'bg-red-600 text-white animate-pulse' : 'bg-slate-100 text-slate-400'}`}>
                <ShieldAlert size={18} />
              </div>
              <div className="min-w-0">
                <span className="text-[10px] font-black uppercase tracking-widest block text-red-600 truncate">Tarja Vermelha</span>
                <span className="text-xl font-black text-red-600">{stats.danger}</span>
              </div>
            </div>

            {/* Tarja Laranja • Suspeitos / PUPs */}
            <div
              onClick={() => setFilterTab('warning')}
              className={`p-3.5 rounded-2xl border shadow-sm flex items-center gap-2.5 cursor-pointer transition-all ${
                stats.warning > 0 ? 'bg-amber-50 border-amber-300 text-amber-900 shadow-amber-500/10' : 'bg-white border-slate-100 hover:border-slate-300'
              }`}
            >
              <div className={`p-2.5 rounded-xl shrink-0 ${stats.warning > 0 ? 'bg-amber-500 text-white' : 'bg-slate-100 text-slate-400'}`}>
                <AlertTriangle size={18} />
              </div>
              <div className="min-w-0">
                <span className="text-[10px] font-black uppercase tracking-widest block text-amber-600 truncate">Tarja Laranja</span>
                <span className="text-xl font-black text-amber-600">{stats.warning}</span>
              </div>
            </div>

            {/* Usados Recentemente (Atividade) */}
            <div
              onClick={() => setFilterTab('recent')}
              className={`p-3.5 rounded-2xl border shadow-sm flex items-center gap-2.5 cursor-pointer transition-all ${
                filterTab === 'recent'
                  ? 'bg-indigo-50 border-indigo-300 text-indigo-900 ring-2 ring-indigo-400'
                  : 'bg-white border-slate-100 hover:border-slate-300'
              }`}
            >
              <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl shrink-0">
                <Clock size={18} />
              </div>
              <div className="min-w-0">
                <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest block truncate">Recentes</span>
                <span className="text-xl font-black text-indigo-600">{stats.recent}</span>
              </div>
            </div>

            {/* Seguros / Confiáveis */}
            <div
              onClick={() => setFilterTab('safe')}
              className="bg-white p-3.5 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-2.5 cursor-pointer hover:border-slate-300 transition-all"
            >
              <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl shrink-0">
                <ShieldCheck size={18} />
              </div>
              <div className="min-w-0">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block truncate">Verificados</span>
                <span className="text-xl font-black text-emerald-600">{stats.safe}</span>
              </div>
            </div>

            {/* APKs Externos / Sideload */}
            <div
              onClick={() => setFilterTab('sideload')}
              className="bg-white p-3.5 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-2.5 cursor-pointer hover:border-slate-300 transition-all col-span-2 sm:col-span-1"
            >
              <div className="p-2.5 bg-purple-50 text-purple-600 rounded-xl shrink-0">
                <Download size={18} />
              </div>
              <div className="min-w-0">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block truncate">APKs Externos</span>
                <span className="text-xl font-black text-purple-600">{stats.sideloaded}</span>
              </div>
            </div>
          </div>

          {/* Barra de Ação em Lote (Se houver ameaças) */}
          {stats.threats > 0 && (
            <div className="bg-gradient-to-r from-red-600 to-rose-600 text-white p-4 sm:p-5 rounded-2xl shadow-lg flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-in slide-in-from-top-2">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-white/20 rounded-xl shrink-0">
                  <ShieldAlert size={24} />
                </div>
                <div>
                  <h4 className="font-black text-sm uppercase tracking-wide">
                    {stats.threats} Aplicativo(s) com Tarja Vermelha ou Laranja Detectados!
                  </h4>
                  <p className="text-xs text-red-100">
                    Estes aplicativos costumam exibir propagandas na tela de bloqueio, popups abusivos e consumir bateria.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0 flex-wrap">
                <button
                  onClick={selectAllThreats}
                  className="px-3 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold transition-all"
                >
                  Marcar Todos
                </button>
                <button
                  onClick={() => setShowBatchModal(true)}
                  className="px-5 py-2.5 bg-white text-red-600 hover:bg-red-50 rounded-xl font-black text-xs uppercase tracking-wider shadow-md transition-all active:scale-95 flex items-center gap-2"
                >
                  <Trash2 size={16} />
                  <span>Excluir Ameaças Selecionadas</span>
                </button>
              </div>
            </div>
          )}

          {/* Filtros e Busca */}
          <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              {/* Abas de Filtro de Aplicativos do Usuário */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-thin">
                <button
                  onClick={() => setFilterTab('all')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all whitespace-nowrap ${
                    filterTab === 'all'
                      ? 'bg-slate-900 text-white shadow-sm'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  Todos Instalados ({stats.total})
                </button>
                <button
                  onClick={() => setFilterTab('danger')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all whitespace-nowrap flex items-center gap-1.5 ${
                    filterTab === 'danger'
                      ? 'bg-red-600 text-white shadow-md shadow-red-500/25 ring-2 ring-red-400'
                      : 'bg-red-50 text-red-700 hover:bg-red-100 border border-red-200'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-red-500" />
                  <span>Tarja Vermelha • Vírus ({stats.danger})</span>
                </button>
                <button
                  onClick={() => setFilterTab('warning')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all whitespace-nowrap flex items-center gap-1.5 ${
                    filterTab === 'warning'
                      ? 'bg-amber-500 text-white shadow-md shadow-amber-500/25 ring-2 ring-amber-300'
                      : 'bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-amber-500" />
                  <span>Tarja Laranja • PUPs ({stats.warning})</span>
                </button>
                <button
                  onClick={() => setFilterTab('threats')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all whitespace-nowrap ${
                    filterTab === 'threats'
                      ? 'bg-rose-700 text-white shadow-sm'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  Ameaças Gerais ({stats.threats})
                </button>
                <button
                  onClick={() => setFilterTab('recent')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all whitespace-nowrap flex items-center gap-1.5 ${
                    filterTab === 'recent'
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/25 ring-2 ring-indigo-400'
                      : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200'
                  }`}
                >
                  <Clock size={13} className="text-indigo-500" />
                  <span>Usados Recentemente ({stats.recent})</span>
                </button>
                <button
                  onClick={() => setFilterTab('safe')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all whitespace-nowrap ${
                    filterTab === 'safe'
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  Seguros ({stats.safe})
                </button>
                <button
                  onClick={() => setFilterTab('sideload')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all whitespace-nowrap ${
                    filterTab === 'sideload'
                      ? 'bg-purple-600 text-white shadow-sm'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  APKs Externos ({stats.sideloaded})
                </button>
              </div>

              {/* Ações Rápidas: Linha do Tempo de Recentes e Download de Script */}
              <div className="flex items-center gap-2 shrink-0 self-start sm:self-auto flex-wrap">
                <button
                  onClick={() => setShowRecentsModal(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-xl transition-all shadow-sm"
                  title="Ver linha do tempo cronológica com a ordem exata dos aplicativos usados recentemente"
                >
                  <Clock size={14} className="text-indigo-600" />
                  <span>Linha do Tempo Recente</span>
                </button>

                <button
                  onClick={handleRefreshRecentActivity}
                  disabled={isRefreshingRecents}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all disabled:opacity-50"
                  title="Atualizar dados de aplicativos recentes agora via ADB"
                >
                  <RefreshCw size={13} className={isRefreshingRecents ? 'animate-spin' : ''} />
                  <span>Sincronizar Recentes</span>
                </button>

                {/* Botão de download do script */}
                <button
                  onClick={downloadBatchScript}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all shrink-0"
                  title="Baixar Script .BAT com comandos ADB para Windows"
                >
                  <Download size={14} />
                  <span>Baixar .BAT</span>
                </button>
              </div>
            </div>

            {/* Input de Busca */}
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                type="text"
                placeholder="Buscar por nome do app, pacote, origem (ex: cleaner, com.whatsapp, sideload)..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-blue-500 transition-all font-medium"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </div>

          {/* Lista de Aplicativos do Celular */}
          <div className="space-y-4">
            {filteredApps.length === 0 ? (
              <div className="bg-white p-8 rounded-2xl border border-slate-100 text-center space-y-2">
                <ShieldCheck className="mx-auto text-emerald-500" size={36} />
                <h4 className="font-bold text-slate-700 text-sm">Nenhum aplicativo nesta categoria</h4>
                <p className="text-xs text-slate-400">Tudo limpo ou a pesquisa não encontrou correspondências.</p>
              </div>
            ) : (
              filteredApps.map(app => {
                const isDanger = app.riskLevel === 'danger';
                const isWarning = app.riskLevel === 'warning';
                const isSafe = app.riskLevel === 'safe';

                return (
                  <div
                    key={app.packageName}
                    id={`app-${app.packageName}`}
                    className={`rounded-2xl border transition-all overflow-hidden bg-white shadow-sm ${
                      isDanger
                        ? 'border-2 border-red-500 shadow-md shadow-red-500/10'
                        : isWarning
                        ? 'border-2 border-amber-400 shadow-md shadow-amber-500/10'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    {/* 1. TARJA VERMELHA / TARJA LARANJA NO TOPO DO CARD */}
                    {isDanger && (
                      <div className="bg-red-600 text-white px-4 py-2 flex items-center justify-between font-black text-xs uppercase tracking-wider shadow-inner">
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full bg-white animate-ping" />
                          <ShieldAlert size={16} />
                          <span>TARJA VERMELHA • ADWARE / VÍRUS (ALTO RISCO)</span>
                        </div>
                        <span className="bg-black/25 text-white text-[10px] font-black px-2.5 py-0.5 rounded-full border border-white/20">
                          REMOÇÃO RECOMENDADA
                        </span>
                      </div>
                    )}

                    {isWarning && (
                      <div className="bg-amber-500 text-white px-4 py-2 flex items-center justify-between font-black text-xs uppercase tracking-wider shadow-inner">
                        <div className="flex items-center gap-2">
                          <AlertTriangle size={16} />
                          <span>TARJA LARANJA • SUSPEITO / PUP (POTENCIALMENTE INDESEJADO)</span>
                        </div>
                        <span className="bg-black/25 text-white text-[10px] font-black px-2.5 py-0.5 rounded-full border border-white/20">
                          AVALIAR / DESINSTALAR
                        </span>
                      </div>
                    )}

                    {/* 1.3 App do Sistema (ROM) */}
                    {app.isSystemApp && (
                      <div className="bg-slate-100 text-slate-700 px-4 py-1.5 flex items-center justify-between font-bold text-[11px] border-b border-slate-200">
                        <div className="flex items-center gap-1.5 text-blue-700 font-bold">
                          <Smartphone size={14} />
                          <span>APP DO SISTEMA (ROM) • {app.category}</span>
                        </div>
                        <span className="text-slate-500 text-[10px] hidden sm:inline">
                          Partição Protegida • Suporte a Remoção (User 0) ou Congelamento
                        </span>
                      </div>
                    )}

                    {/* 1.4 App de Usuário Seguro */}
                    {!app.isSystemApp && isSafe && (
                      <div className="bg-slate-100 text-slate-700 px-4 py-1.5 flex items-center justify-between font-bold text-[11px] border-b border-slate-200">
                        <div className="flex items-center gap-1.5 text-emerald-700 font-bold">
                          <ShieldCheck size={14} />
                          <span>VERIFICADO • APLICATIVO CONFIÁVEL</span>
                        </div>
                        <span className="text-slate-500 text-[10px]">
                          Instalado pelo Usuário
                        </span>
                      </div>
                    )}

                    {/* 2. CORPO DO CARD COM DADOS E OPÇÃO AO LADO PARA DESINSTALAR */}
                    <div
                      className={`p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                        isDanger ? 'bg-red-50/25' : isWarning ? 'bg-amber-50/20' : 'bg-white'
                      }`}
                    >
                      {/* Lado Esquerdo: Checkbox, Ícone, Detalhes e Diagnóstico */}
                      <div className="flex items-start gap-3.5 flex-1 min-w-0">
                        {/* Checkbox para lote */}
                        <input
                          type="checkbox"
                          checked={!!app.selected}
                          onChange={() => toggleSelectApp(app.packageName)}
                          className="mt-1 rounded text-red-600 focus:ring-red-500 h-4 w-4 border-slate-300 cursor-pointer shrink-0"
                          title="Selecionar para desinstalação em lote"
                        />

                        {/* Ícone de Risco */}
                        <div
                          className={`p-3 rounded-2xl shrink-0 ${
                            isDanger
                              ? 'bg-red-100 text-red-600 ring-2 ring-red-300'
                              : isWarning
                              ? 'bg-amber-100 text-amber-600 ring-2 ring-amber-300'
                              : app.isSystemApp
                              ? 'bg-blue-50 text-blue-600'
                              : 'bg-emerald-50 text-emerald-600'
                          }`}
                        >
                          {isDanger ? (
                            <ShieldAlert size={22} />
                          ) : isWarning ? (
                            <AlertTriangle size={22} />
                          ) : app.isSystemApp ? (
                            <Smartphone size={22} />
                          ) : (
                            <ShieldCheck size={22} />
                          )}
                        </div>

                        <div className="space-y-1.5 min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="font-black text-slate-900 text-sm sm:text-base tracking-tight truncate">
                              {app.appName}
                            </h4>

                            {/* Badge de Risco */}
                            {isDanger && (
                              <span className="px-2.5 py-0.5 bg-red-600 text-white rounded-md text-[9px] font-black uppercase tracking-wider">
                                Adware / Vírus
                              </span>
                            )}
                            {isWarning && (
                              <span className="px-2.5 py-0.5 bg-amber-500 text-white rounded-md text-[9px] font-black uppercase tracking-wider">
                                Suspeito / PUP
                              </span>
                            )}

                            {/* Categoria */}
                            <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded-md text-[10px] font-bold border border-slate-200">
                              {app.category}
                            </span>

                            {/* Origem da Instalação */}
                            {app.sourceText && (
                              <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded-md text-[10px] font-semibold border border-slate-200">
                                {app.sourceText}
                              </span>
                            )}

                            {app.isSystemApp && (
                              <span className="px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-md text-[10px] font-bold">
                                Sistema
                              </span>
                            )}

                            {/* Badge de Em Uso Agora (Primeiro Plano) */}
                            {app.isForegroundNow && (
                              <span className="px-2.5 py-0.5 bg-emerald-600 text-white rounded-md text-[9px] font-black uppercase tracking-wider flex items-center gap-1 shadow-sm animate-pulse">
                                <Activity size={11} />
                                <span>Em Uso Agora</span>
                              </span>
                            )}

                            {/* Badge de Uso Recente */}
                            {!app.isForegroundNow && (app.recentOrderIndex !== undefined || app.isRecent) && (
                              <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-md text-[10px] font-bold flex items-center gap-1">
                                <Clock size={11} className="text-indigo-600" />
                                <span>{app.lastUsedFormatted || (app.recentOrderIndex !== undefined ? `Recente (#${app.recentOrderIndex + 1})` : 'Recente')}</span>
                              </span>
                            )}

                            {/* Tempo de Tela se disponível */}
                            {app.totalTimeInForeground && (
                              <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded-md text-[10px] font-medium border border-slate-200 hidden sm:inline-flex">
                                Tempo: {app.totalTimeInForeground}
                              </span>
                            )}
                          </div>

                          {/* Nome do Pacote (Monospace) */}
                          <div className="flex items-center gap-2 text-slate-400 text-xs">
                            <code className="font-mono text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 text-[11px] truncate max-w-md">
                              {app.packageName}
                            </code>
                            <button
                              onClick={() => copyToClipboard(app.packageName)}
                              className="text-slate-400 hover:text-slate-600 p-1"
                              title="Copiar nome do pacote"
                            >
                              {copiedPackage === app.packageName ? (
                                <Check size={13} className="text-emerald-500" />
                              ) : (
                                <Copy size={13} />
                              )}
                            </button>
                          </div>

                          {/* Motivo do Diagnóstico Heurístico Inteligente */}
                          <p
                            className={`text-xs leading-relaxed ${
                              isDanger
                                ? 'text-red-800 font-semibold'
                                : isWarning
                                ? 'text-amber-800 font-semibold'
                                : 'text-slate-500'
                            }`}
                          >
                            {app.reason}
                          </p>
                        </div>
                      </div>

                      {/* Lado Direito: A OPÇÃO AO LADO PARA DESINSTALAR + Ferramentas Técnicas */}
                      <div className="flex items-center gap-2 flex-wrap self-end md:self-center shrink-0 pt-3 md:pt-0 border-t md:border-t-0 border-slate-100 w-full md:w-auto justify-end">
                        {/* Se for aplicativo do sistema */}
                        {app.isSystemApp ? (
                          <>
                            {/* Botão Remover (Usuário 0) */}
                            <button
                              onClick={() => handleUninstall(app)}
                              disabled={app.isRemoving || !webAdb.isConnected()}
                              className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider shadow-sm transition-all active:scale-95 disabled:opacity-50 bg-slate-800 hover:bg-slate-900 text-white"
                              title={`Remover este app da partição de sistema para o seu usuário (User 0) via ADB`}
                            >
                              {app.isRemoving ? (
                                <>
                                  <Loader2 size={15} className="animate-spin" />
                                  <span>Removendo...</span>
                                </>
                              ) : (
                                <>
                                  <Trash2 size={15} />
                                  <span>REMOVER (USER 0)</span>
                                </>
                              )}
                            </button>

                            {/* Botão Congelar / Desativar em destaque para app de sistema */}
                            <button
                              onClick={() => handleDisable(app)}
                              disabled={!webAdb.isConnected()}
                              className="flex items-center gap-1.5 px-3 py-2.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 rounded-xl text-xs font-bold transition-all active:scale-95"
                              title="Congelar e desativar este aplicativo do sistema (pm disable-user)"
                            >
                              <Ban size={15} className="text-amber-600" />
                              <span>CONGELAR</span>
                            </button>
                          </>
                        ) : (
                          <>
                            {/* OPÇÃO AO LADO PARA DESINSTALAR (BOTÃO PRINCIPAL DE DESTAQUE) */}
                            <button
                              onClick={() => handleUninstall(app)}
                              disabled={app.isRemoving || !webAdb.isConnected()}
                              className={`flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider shadow-md transition-all active:scale-95 disabled:opacity-50 ${
                                isDanger
                                  ? 'bg-red-600 hover:bg-red-700 text-white shadow-red-500/30 ring-2 ring-red-500'
                                  : isWarning
                                  ? 'bg-amber-600 hover:bg-amber-700 text-white shadow-amber-500/30 ring-2 ring-amber-500'
                                  : 'bg-red-500 hover:bg-red-600 text-white'
                              }`}
                              title={`Desinstalar forçadamente ${app.appName} (${app.packageName}) via ADB`}
                            >
                              {app.isRemoving ? (
                                <>
                                  <Loader2 size={15} className="animate-spin" />
                                  <span>Desinstalando...</span>
                                </>
                              ) : (
                                <>
                                  <Trash2 size={15} />
                                  <span>DESINSTALAR</span>
                                </>
                              )}
                            </button>

                            {/* Desativar / Congelar */}
                            <button
                              onClick={() => handleDisable(app)}
                              disabled={!webAdb.isConnected()}
                              className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl transition-all"
                              title="Congelar / Desativar App"
                            >
                              <Ban size={15} />
                            </button>
                          </>
                        )}

                        {/* Forçar Parada / Matar Processo */}
                        <button
                          onClick={() => handleForceStop(app)}
                          disabled={!webAdb.isConnected()}
                          className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl transition-all"
                          title="Encerrar Processo em Segundo Plano (am force-stop)"
                        >
                          <Power size={15} />
                        </button>

                        {/* Limpar Dados */}
                        <button
                          onClick={() => handleClearData(app)}
                          disabled={!webAdb.isConnected()}
                          className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl transition-all"
                          title="Limpar Cache e Dados do App"
                        >
                          <Sparkles size={15} />
                        </button>

                        {/* Abrir no Celular */}
                        <button
                          onClick={() => handleOpenOnDevice(app)}
                          disabled={!webAdb.isConnected()}
                          className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl transition-all"
                          title="Abrir tela de informações deste app no celular"
                        >
                          <ExternalLink size={15} />
                        </button>

                        {/* Detalhes / Permissões */}
                        <button
                          onClick={() => handleViewDetails(app)}
                          disabled={!webAdb.isConnected()}
                          className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl transition-all"
                          title="Ver permissões e dumpsys"
                        >
                          <Eye size={15} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Modal: Guia de Ativação da Depuração USB por Fabricante */}
      {showGuideModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-in fade-in">
          <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl p-5 sm:p-6 space-y-5 animate-in zoom-in-95 max-h-[92vh] overflow-y-auto">
            {/* Header do Guia */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <span className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                  <Usb size={20} />
                </span>
                <div>
                  <h3 className="font-black text-slate-800 text-base uppercase tracking-tight">
                    Como Ativar a Depuração USB
                  </h3>
                  <p className="text-[11px] text-slate-400">Instruções passo a passo por marca e modelo</p>
                </div>
              </div>
              <button
                onClick={() => setShowGuideModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Abas de Seleção de Fabricante */}
            <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-2xl overflow-x-auto scrollbar-none">
              <button
                onClick={() => setGuideBrandTab('universal')}
                className={`flex-1 min-w-[100px] py-2 px-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all text-center ${
                  guideBrandTab === 'universal'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Android Padrão
              </button>
              <button
                onClick={() => setGuideBrandTab('samsung')}
                className={`flex-1 min-w-[110px] py-2 px-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all text-center ${
                  guideBrandTab === 'samsung'
                    ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/30'
                    : 'text-blue-700 hover:bg-blue-50/50'
                }`}
              >
                Samsung Galaxy
              </button>
              <button
                onClick={() => setGuideBrandTab('motorola')}
                className={`flex-1 min-w-[100px] py-2 px-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all text-center ${
                  guideBrandTab === 'motorola'
                    ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-500/30'
                    : 'text-emerald-700 hover:bg-emerald-50/50'
                }`}
              >
                Motorola
              </button>
              <button
                onClick={() => setGuideBrandTab('xiaomi')}
                className={`flex-1 min-w-[100px] py-2 px-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all text-center ${
                  guideBrandTab === 'xiaomi'
                    ? 'bg-amber-500 text-slate-950 shadow-sm shadow-amber-500/30'
                    : 'text-amber-700 hover:bg-amber-50/50'
                }`}
              >
                Xiaomi / Redmi
              </button>
            </div>

            {/* Conteúdo da Aba Selecionada */}
            <div className="space-y-4 text-xs text-slate-600">
              {guideBrandTab === 'samsung' ? (
                /* GUIA SAMSUNG GALAXY (ONE UI 6 / 5 / 4) */
                <div className="space-y-3 animate-in fade-in duration-200">
                  <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-2xl flex items-start gap-2.5 text-blue-900 text-xs">
                    <Info size={16} className="text-blue-600 shrink-0 mt-0.5" />
                    <div>
                      <strong className="block font-bold">Otimização Samsung Galaxy (One UI):</strong>
                      <span>Suporte testado para linhas Galaxy A, Galaxy S, Galaxy Z Fold/Flip, Galaxy M e Galaxy Tab.</span>
                    </div>
                  </div>

                  <div className="space-y-2.5">
                    <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-xl">
                      <span className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-black shrink-0">1</span>
                      <div>
                        <strong className="text-slate-800 block mb-0.5">Abra as Configurações do Galaxy</strong>
                        <span>Acesse <strong>Configurações &gt; Sobre o telefone &gt; Informações do software</strong>.</span>
                      </div>
                    </div>

                    <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-xl">
                      <span className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-black shrink-0">2</span>
                      <div>
                        <strong className="text-slate-800 block mb-0.5">Toque 7x em "Número de compilação"</strong>
                        <span>Toque rapidamente 7 vezes em <strong>Número de compilação</strong> (digite seu PIN/senha se solicitado pelo Knox) até exibir <em>"O modo de desenvolvedor foi ativado"</em>.</span>
                      </div>
                    </div>

                    <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-xl">
                      <span className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-black shrink-0">3</span>
                      <div>
                        <strong className="text-slate-800 block mb-0.5">Acesse "Opções do desenvolvedor"</strong>
                        <span>Volte para a tela inicial de Configurações, role até o final e toque em <strong>Opções do desenvolvedor</strong>.</span>
                      </div>
                    </div>

                    <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-xl">
                      <span className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-black shrink-0">4</span>
                      <div>
                        <strong className="text-slate-800 block mb-0.5">Ative a "Depuração USB"</strong>
                        <span>Ative o interruptor <strong>Depuração USB</strong> e toque em OK no popup de confirmação.</span>
                      </div>
                    </div>

                    <div className="flex items-start gap-3 p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900">
                      <span className="w-6 h-6 rounded-full bg-amber-600 text-white flex items-center justify-center text-xs font-black shrink-0">5</span>
                      <div>
                        <strong className="block mb-0.5 font-bold">Autorize a Chave RSA na Tela do Galaxy</strong>
                        <span>Conecte o cabo USB ao computador. No celular Samsung, marque a caixinha <strong>"Sempre permitir a partir deste computador"</strong> e toque em <strong>Permitir</strong>.</span>
                      </div>
                    </div>

                    <div className="p-3 bg-slate-100 rounded-xl text-[11px] text-slate-600">
                      <strong>Dica One UI 6 (Auto Blocker):</strong> Caso seu Galaxy tenha o <em>Bloqueador Automático</em> ativado em <em>Configurações &gt; Segurança e Privacidade</em>, desative temporariamente a proteção de cabo para autorizar comandos ADB.
                    </div>
                  </div>
                </div>
              ) : guideBrandTab === 'motorola' ? (
                /* GUIA MOTOROLA (MOTO G / MOTO EDGE / RAZR - MY UX / HELLO UI) */
                <div className="space-y-3 animate-in fade-in duration-200">
                  <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-2xl flex items-start gap-2.5 text-emerald-900 text-xs">
                    <Info size={16} className="text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <strong className="block font-bold">Otimização Motorola (Moto G, Edge, E, Razr):</strong>
                      <span>Suporte direto para My UX e Hello UI. Não exige contas adicionais para desinstalações via ADB.</span>
                    </div>
                  </div>

                  <div className="space-y-2.5">
                    <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-xl">
                      <span className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs font-black shrink-0">1</span>
                      <div>
                        <strong className="text-slate-800 block mb-0.5">Abra as Configurações do Moto</strong>
                        <span>Abra o menu <strong>Configurar (Configurações)</strong> e role até <strong>Sobre o dispositivo</strong> (ou <strong>Sistema &gt; Sobre o telefone</strong>).</span>
                      </div>
                    </div>

                    <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-xl">
                      <span className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs font-black shrink-0">2</span>
                      <div>
                        <strong className="text-slate-800 block mb-0.5">Toque 7x em "Número da versão"</strong>
                        <span>Role até a última opção chamada <strong>Número da versão</strong> e toque 7 vezes seguidas até aparecer: <em>"Você agora é um desenvolvedor!"</em>.</span>
                      </div>
                    </div>

                    <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-xl">
                      <span className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs font-black shrink-0">3</span>
                      <div>
                        <strong className="text-slate-800 block mb-0.5">Acesse Sistema &gt; Opções do desenvolvedor</strong>
                        <span>Volte um nível, toque em <strong>Sistema &gt; Avançado &gt; Opções do desenvolvedor</strong> (ou direto em Opções do desenvolvedor).</span>
                      </div>
                    </div>

                    <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-xl">
                      <span className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs font-black shrink-0">4</span>
                      <div>
                        <strong className="text-slate-800 block mb-0.5">Ligue a "Depuração USB"</strong>
                        <span>Ative o interruptor <strong>Depuração USB</strong> e confirme a mensagem tocando em OK.</span>
                      </div>
                    </div>

                    <div className="flex items-start gap-3 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-900">
                      <span className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs font-black shrink-0">5</span>
                      <div>
                        <strong className="block mb-0.5 font-bold">Confirme a Depuração USB na Tela do Moto</strong>
                        <span>Conecte o cabo USB. Na tela do celular Motorola, marque a opção <strong>"Permitir sempre a partir deste computador"</strong> e toque em <strong>Permitir</strong>.</span>
                      </div>
                    </div>
                  </div>
                </div>
              ) : guideBrandTab === 'xiaomi' ? (
                /* GUIA XIAOMI / REDMI / POCO (HYPEROS / MIUI) */
                <div className="space-y-3 animate-in fade-in duration-200">
                  <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-2xl flex items-start gap-2.5 text-amber-900 text-xs">
                    <AlertTriangle size={16} className="text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <strong className="block font-bold">Aviso Xiaomi / Redmi / POCO (HyperOS / MIUI):</strong>
                      <span>A Xiaomi exige ativar a <em>"Depuração USB (Configurações de Segurança)"</em> para permitir comandos de remoção via USB.</span>
                    </div>
                  </div>

                  <div className="space-y-2.5">
                    <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-xl">
                      <span className="w-6 h-6 rounded-full bg-amber-600 text-white flex items-center justify-center text-xs font-black shrink-0">1</span>
                      <div>
                        <strong className="text-slate-800 block mb-0.5">Toque 7x na "Versão do HyperOS / MIUI"</strong>
                        <span>Vá em <strong>Configurações &gt; Sobre o telefone</strong> e toque 7 vezes na <strong>Versão do HyperOS/MIUI</strong>.</span>
                      </div>
                    </div>

                    <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-xl">
                      <span className="w-6 h-6 rounded-full bg-amber-600 text-white flex items-center justify-center text-xs font-black shrink-0">2</span>
                      <div>
                        <strong className="text-slate-800 block mb-0.5">Abra Configurações Adicionais</strong>
                        <span>Volte e acesse <strong>Configurações Adicionais &gt; Opções do Desenvolvedor</strong>.</span>
                      </div>
                    </div>

                    <div className="flex items-start gap-3 p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900">
                      <span className="w-6 h-6 rounded-full bg-amber-600 text-white flex items-center justify-center text-xs font-black shrink-0">3</span>
                      <div>
                        <strong className="block mb-0.5 font-bold">Ative as 2 Chaves de Depuração:</strong>
                        <span>1) <strong>Depuração USB</strong><br />2) <strong>Depuração USB (Configurações de Segurança)</strong></span>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                /* GUIA UNIVERSAL ANDROID */
                <div className="space-y-3 animate-in fade-in duration-200">
                  <div className="space-y-2.5">
                    <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-xl">
                      <span className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-black shrink-0">1</span>
                      <div>
                        <strong className="text-slate-800 block mb-0.5">Abra as Configurações do Android</strong>
                        <span>Vá até o final e toque em <strong>"Sobre o Telefone"</strong> (ou "Informações do Software").</span>
                      </div>
                    </div>

                    <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-xl">
                      <span className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-black shrink-0">2</span>
                      <div>
                        <strong className="text-slate-800 block mb-0.5">Toque 7 vezes em "Número da Versão"</strong>
                        <span>Toque repetidamente em <strong>"Número da Versão"</strong> (ou "Número de Compilação") até exibir a mensagem: <em>"Você agora é um desenvolvedor!"</em></span>
                      </div>
                    </div>

                    <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-xl">
                      <span className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-black shrink-0">3</span>
                      <div>
                        <strong className="text-slate-800 block mb-0.5">Acesse "Opções do Desenvolvedor"</strong>
                        <span>Volte para a tela inicial de Configurações, entre em <strong>Sistema &gt; Opções do Desenvolvedor</strong>.</span>
                      </div>
                    </div>

                    <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-xl">
                      <span className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-black shrink-0">4</span>
                      <div>
                        <strong className="text-slate-800 block mb-0.5">Ative a chave "Depuração USB"</strong>
                        <span>Ative o interruptor <strong>Depuração USB</strong> e confirme com "OK".</span>
                      </div>
                    </div>

                    <div className="flex items-start gap-3 p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900">
                      <span className="w-6 h-6 rounded-full bg-amber-600 text-white flex items-center justify-center text-xs font-black shrink-0">5</span>
                      <div>
                        <strong className="block mb-0.5 font-bold">Autorize na Tela do Celular (Muito Importante!)</strong>
                        <span>Ao conectar o cabo e clicar em "Conectar Celular via USB", olhe a tela do celular: marque a caixinha <strong>"Sempre permitir a partir deste computador"</strong> e toque em <strong>Permitir (OK)</strong>.</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={() => setShowGuideModal(false)}
              className="w-full py-3.5 bg-blue-600 text-white rounded-xl font-black text-xs uppercase tracking-wider hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/20 active:scale-98"
            >
              Entendido, Conectar Celular USB
            </button>
          </div>
        </div>
      )}

      {/* Modal: Confirmação de Limpeza em Lote */}
      {showBatchModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl p-6 space-y-4 animate-in zoom-in-95">
            <div className="flex items-center gap-3 text-red-600">
              <div className="p-2.5 bg-red-100 rounded-xl">
                <Trash2 size={24} />
              </div>
              <div>
                <h3 className="font-black text-slate-800 text-base uppercase tracking-tight">
                  Excluir Todos os Vírus e Adwares
                </h3>
                <p className="text-xs text-slate-500">Confirmação de desinstalação via ADB</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Você está prestes a remover forçadamente <strong>{installedApps.filter(a => a.selected && a.riskLevel !== 'safe').length} aplicativos maliciosos/suspeitos</strong> do celular conectado:
            </p>

            <div className="max-h-48 overflow-y-auto space-y-1.5 p-3 bg-slate-50 rounded-xl border border-slate-100">
              {installedApps.filter(a => a.selected && a.riskLevel !== 'safe').map(app => (
                <div key={app.packageName} className="flex items-center justify-between text-xs py-1 border-b border-slate-100 last:border-0">
                  <span className="font-bold text-slate-700">{app.appName}</span>
                  <code className="text-[10px] text-slate-400 font-mono">{app.packageName}</code>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setShowBatchModal(false)}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs uppercase"
              >
                Cancelar
              </button>
              <button
                onClick={handleBatchUninstall}
                className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl font-black text-xs uppercase tracking-wider shadow-lg shadow-red-500/25 active:scale-95 transition-all flex items-center gap-2"
              >
                <Trash2 size={16} />
                <span>Sim, Limpar Agora</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Terminal de Logs */}
      {showTerminalModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-950 text-slate-100 w-full max-w-2xl rounded-3xl shadow-2xl p-5 space-y-3 font-mono text-xs animate-in zoom-in-95 border border-slate-800">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <div className="flex items-center gap-2 text-slate-400">
                <Terminal size={16} className="text-emerald-400" />
                <span className="font-bold text-slate-200">Terminal ADB & Atividades</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setLogs([])}
                  className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-[10px] rounded text-slate-300"
                >
                  Limpar
                </button>
                <button
                  onClick={() => setShowTerminalModal(false)}
                  className="p-1 text-slate-400 hover:text-white"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            <div className="h-80 overflow-y-auto space-y-1.5 p-3 bg-slate-900 rounded-xl border border-slate-800/80 text-[11px]">
              {logs.map((log, idx) => (
                <div key={idx} className="flex items-start gap-2 leading-tight">
                  <span className="text-slate-500 shrink-0">{log.timestamp}</span>
                  <span className={`shrink-0 font-bold ${
                    log.type === 'cmd' ? 'text-cyan-400' : log.type === 'success' ? 'text-emerald-400' : log.type === 'error' ? 'text-red-400' : 'text-slate-400'
                  }`}>
                    {log.type === 'cmd' ? '$' : log.type === 'success' ? '✓' : log.type === 'error' ? '✗' : '•'}
                  </span>
                  <span className={`${
                    log.type === 'cmd' ? 'text-cyan-200' : log.type === 'success' ? 'text-emerald-200' : log.type === 'error' ? 'text-red-200' : 'text-slate-300'
                  } break-all`}>
                    {log.text}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Modal: Detalhes e Permissões do App */}
      {showAppDetailModal && selectedAppDetail && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-xl rounded-3xl shadow-2xl p-6 space-y-4 animate-in zoom-in-95 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="font-black text-slate-800 text-base uppercase tracking-tight">
                  {selectedAppDetail.app.appName}
                </h3>
                <code className="text-xs text-slate-400 font-mono">{selectedAppDetail.app.packageName}</code>
              </div>
              <button
                onClick={() => setShowAppDetailModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X size={18} />
              </button>
            </div>

            {selectedAppDetail.loading ? (
              <div className="py-12 flex flex-col items-center justify-center gap-3 text-slate-400">
                <Loader2 size={32} className="animate-spin text-blue-600" />
                <span className="text-xs">Consultando dumpsys do pacote...</span>
              </div>
            ) : (
              <div className="space-y-4 text-xs">
                <div className="p-3 bg-slate-50 rounded-xl space-y-1">
                  <span className="font-bold text-slate-700 block">Classificação de Risco:</span>
                  <p className="text-slate-600">{selectedAppDetail.app.reason}</p>
                  {selectedAppDetail.app.apkPath && (
                    <p className="text-[11px] text-slate-400 font-mono truncate">APK: {selectedAppDetail.app.apkPath}</p>
                  )}
                </div>

                <div>
                  <h4 className="font-bold text-slate-700 mb-2">
                    Permissões Detectadas ({selectedAppDetail.permissions.length}):
                  </h4>
                  <div className="max-h-48 overflow-y-auto space-y-1 p-2 bg-slate-50 rounded-xl border border-slate-100">
                    {selectedAppDetail.permissions.length === 0 ? (
                      <span className="text-slate-400 text-[11px]">Nenhuma permissão especial solicitada.</span>
                    ) : (
                      selectedAppDetail.permissions.map((p, idx) => {
                        const isDangerous = p.includes('ALERT_WINDOW') || p.includes('BOOT_COMPLETED') || p.includes('ACCESSIBILITY') || p.includes('SMS') || p.includes('LOCATION') || p.includes('CAMERA');
                        return (
                          <div
                            key={idx}
                            className={`p-1.5 rounded text-[11px] font-mono flex items-center justify-between ${
                              isDangerous ? 'bg-red-50 text-red-700 font-bold' : 'text-slate-600'
                            }`}
                          >
                            <span>{p.replace('android.permission.', '')}</span>
                            {isDangerous && <span className="text-[9px] uppercase px-1.5 py-0.2 bg-red-200 text-red-800 rounded">Invasiva / Popups</span>}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    onClick={() => {
                      setShowAppDetailModal(false);
                      handleUninstall(selectedAppDetail.app);
                    }}
                    className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold text-xs uppercase flex items-center gap-1.5"
                  >
                    <Trash2 size={14} />
                    <span>Desinstalar este App</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal: Analisador Manual (Colar output de pm list packages) */}
      {showManualParser && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-xl rounded-3xl shadow-2xl p-6 space-y-4 animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Terminal size={18} className="text-blue-600" />
                <h3 className="font-black text-slate-800 text-base uppercase tracking-tight">
                  Análise Manual de Pacotes
                </h3>
              </div>
              <button
                onClick={() => setShowManualParser(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X size={18} />
              </button>
            </div>

            <p className="text-xs text-slate-500 leading-relaxed">
              Se preferir rodar no terminal do seu computador com <code>adb shell pm list packages -3</code>, cole o resultado abaixo para diagnosticar os vírus e gerar o script de remoção:
            </p>

            <textarea
              rows={8}
              value={manualInput}
              onChange={e => setManualInput(e.target.value)}
              placeholder={`package:com.cleanmaster.mguard\npackage:com.super.flashlight.led\npackage:com.whatsapp\npackage:com.android.chrome.update`}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 font-mono text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-blue-500"
            />

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setShowManualParser(false)}
                className="px-4 py-2.5 bg-slate-100 text-slate-700 rounded-xl font-bold text-xs uppercase"
              >
                Cancelar
              </button>
              <button
                onClick={handleParseManualList}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-black text-xs uppercase tracking-wider"
              >
                Analisar Pacotes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE CONFIRMAÇÃO IN-APP: Desinstalação via ADB (Funciona 100% no Iframe) */}
      {confirmUninstallApp && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden border border-slate-100 animate-in zoom-in-95 duration-200">
            {/* Header do Modal */}
            <div className={`p-6 text-white ${
              confirmUninstallApp.riskLevel === 'danger'
                ? 'bg-gradient-to-r from-red-600 to-rose-700'
                : confirmUninstallApp.riskLevel === 'warning'
                ? 'bg-gradient-to-r from-amber-500 to-orange-600'
                : 'bg-gradient-to-r from-slate-800 to-slate-900'
            }`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-white/20 rounded-2xl backdrop-blur-sm">
                    <Trash2 size={24} className="text-white" />
                  </div>
                  <div>
                    <h3 className="text-lg font-black tracking-tight uppercase">
                      Confirmar Desinstalação ADB
                    </h3>
                    <p className="text-xs text-white/80">
                      O comando será enviado diretamente ao seu celular via cabo USB
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setConfirmUninstallApp(null)}
                  className="p-1.5 text-white/70 hover:text-white rounded-xl hover:bg-white/10 transition-all"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Conteúdo Informativo do App */}
            <div className="p-6 space-y-4">
              <div className="flex items-start gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-200/80">
                <div className="p-2.5 bg-white rounded-xl border border-slate-200 shadow-sm shrink-0">
                  {confirmUninstallApp.riskLevel === 'danger' ? (
                    <ShieldAlert size={24} className="text-red-600" />
                  ) : confirmUninstallApp.riskLevel === 'warning' ? (
                    <AlertTriangle size={24} className="text-amber-500" />
                  ) : (
                    <ShieldCheck size={24} className="text-emerald-600" />
                  )}
                </div>
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="font-black text-slate-900 text-base">
                      {confirmUninstallApp.appName}
                    </h4>
                    {confirmUninstallApp.riskLevel === 'danger' && (
                      <span className="px-2 py-0.5 bg-red-600 text-white rounded text-[10px] font-black uppercase">
                        Vírus / Adware
                      </span>
                    )}
                    {confirmUninstallApp.riskLevel === 'warning' && (
                      <span className="px-2 py-0.5 bg-amber-500 text-white rounded text-[10px] font-black uppercase">
                        PUP Suspeito
                      </span>
                    )}
                  </div>
                  <code className="block text-xs font-mono text-slate-600 bg-white px-2 py-1 rounded border border-slate-200 truncate">
                    {confirmUninstallApp.packageName}
                  </code>
                  <p className="text-xs text-slate-600 pt-1">
                    {confirmUninstallApp.reason}
                  </p>
                </div>
              </div>

              {/* Aviso Específico para Xiaomi / Redmi */}
              <div className="p-3.5 bg-blue-50/80 border border-blue-200 rounded-2xl flex items-start gap-2.5 text-xs text-blue-900">
                <Info size={18} className="text-blue-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-bold">Dica para Aparelhos Xiaomi / Redmi:</p>
                  <p className="text-[11px] text-blue-800 leading-relaxed">
                    Se você estiver usando um Xiaomi / Redmi (HyperOS ou MIUI), o aparelho exige que a opção <strong>"Depuração USB (Configurações de Segurança)"</strong> esteja ativada nas <em>Opções do Desenvolvedor</em> para permitir a desinstalação via USB.
                  </p>
                </div>
              </div>

              {/* Botões de Ação */}
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setConfirmUninstallApp(null)}
                  className="px-5 py-3 rounded-xl border border-slate-200 text-slate-700 font-bold text-xs uppercase hover:bg-slate-50 transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => executeUninstall(confirmUninstallApp)}
                  className={`flex items-center gap-2 px-6 py-3 rounded-xl font-black text-xs uppercase tracking-wider shadow-lg transition-all active:scale-95 ${
                    confirmUninstallApp.riskLevel === 'danger'
                      ? 'bg-red-600 hover:bg-red-700 text-white shadow-red-500/25'
                      : confirmUninstallApp.riskLevel === 'warning'
                      ? 'bg-amber-600 hover:bg-amber-700 text-white shadow-amber-500/25'
                      : 'bg-red-600 hover:bg-red-700 text-white shadow-red-500/25'
                  }`}
                >
                  <Trash2 size={16} />
                  <span>SIM, DESINSTALAR AGORA</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE AJUDA: Permissão de Segurança Xiaomi / Redmi (HyperOS / MIUI) */}
      {showXiaomiSecurityModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden border border-slate-100 animate-in zoom-in-95">
            <div className="bg-gradient-to-r from-amber-500 via-orange-500 to-red-600 p-6 text-white">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-white/20 rounded-2xl backdrop-blur-sm">
                    <Smartphone size={24} className="text-white" />
                  </div>
                  <div>
                    <h3 className="text-lg font-black tracking-tight uppercase">
                      Aparelho Xiaomi / Redmi Detectado
                    </h3>
                    <p className="text-xs text-white/80">
                      Instruções para desbloquear a desinstalação via USB no celular
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowXiaomiSecurityModal(false)}
                  className="p-1.5 text-white/70 hover:text-white rounded-xl hover:bg-white/10"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <p className="text-xs text-slate-600 leading-relaxed">
                Por padrão de fábrica, a Xiaomi (MIUI / HyperOS) bloqueia desinstalações feitas por cabo USB até que você autorize a opção de segurança no telefone:
              </p>

              <div className="space-y-3">
                <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-600 text-white font-bold text-xs shrink-0">1</span>
                  <div className="text-xs text-slate-700">
                    <strong className="block text-slate-900">Abra as Configurações</strong>
                    No seu Redmi, acesse <em>Configurações &gt; Configurações Adicionais &gt; Opções do Desenvolvedor</em>.
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 bg-amber-50 rounded-xl border border-amber-200">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-amber-600 text-white font-bold text-xs shrink-0">2</span>
                  <div className="text-xs text-amber-900">
                    <strong className="block text-amber-950">Ative a Permissão de Segurança</strong>
                    Role a tela até a seção Depuração e ative: <strong>"Depuração USB (Configurações de Segurança)"</strong>.
                    <p className="text-[11px] text-amber-800 mt-1">
                      <em>(A Xiaomi exige que o aparelho esteja conectado a uma conta Mi e com chip SIM inserido para confirmar as 3 etapas de aviso de 5 segundos).</em>
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 bg-emerald-50 rounded-xl border border-emerald-200">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-emerald-600 text-white font-bold text-xs shrink-0">3</span>
                  <div className="text-xs text-emerald-900">
                    <strong className="block text-emerald-950">Desinstale com 1 Clique</strong>
                    Após ligar essa opção, volte aqui e clique novamente em <strong>DESINSTALAR</strong>! O app será apagado na hora.
                  </div>
                </div>
              </div>

              <div className="p-3 bg-slate-100 rounded-xl text-xs text-slate-600">
                <strong>Alternativa Imediata:</strong> Caso não queira ativar a opção agora, você pode clicar no botão <strong>"Congelar"</strong> ou <strong>"Limpar Dados"</strong> ao lado do aplicativo na lista. Isso impede que ele rode ou exiba propagandas!
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowXiaomiSecurityModal(false)}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs uppercase shadow-sm"
                >
                  Entendi, vou configurar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE HISTÓRICO DE APLICATIVOS USADOS RECENTEMENTE (ADB DUMPSYS RECENTS) */}
      {showRecentsModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-3xl rounded-3xl shadow-2xl overflow-hidden border border-slate-100 max-h-[92vh] flex flex-col animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="p-5 sm:p-6 bg-gradient-to-r from-indigo-700 via-indigo-800 to-purple-900 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-white/15 rounded-2xl backdrop-blur-sm">
                  <Clock size={24} className="text-indigo-200" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-black tracking-tight uppercase flex items-center gap-2">
                    <span>Histórico de Atividade & Apps Recentes</span>
                    <span className="px-2 py-0.5 bg-white/20 text-white rounded-md text-[10px] font-bold">
                      ADB Live
                    </span>
                  </h3>
                  <p className="text-xs text-indigo-200 mt-0.5">
                    Ordem cronológica das tarefas abertas e processos ativos no {deviceInfo?.model || 'aparelho'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowRecentsModal(false)}
                className="p-2 text-white/70 hover:text-white rounded-xl hover:bg-white/10 transition-all shrink-0"
              >
                <X size={20} />
              </button>
            </div>

            {/* Sub-Header com Ações e Guia */}
            <div className="bg-indigo-50/80 p-4 border-b border-indigo-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
              <div className="flex items-start gap-2.5 text-xs text-indigo-900">
                <Info size={16} className="text-indigo-600 shrink-0 mt-0.5" />
                <p className="leading-relaxed">
                  <strong className="font-bold">Dica Antivírus:</strong> Se o celular está exibindo propagandas repentinas ou travando, o aplicativo causador costuma estar no <span className="underline font-bold">topo desta lista (#1 ou em primeiro plano)</span> no momento do anúncio.
                </p>
              </div>
              <button
                onClick={handleRefreshRecentActivity}
                disabled={isRefreshingRecents || !webAdb.isConnected()}
                className="flex items-center gap-2 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm shrink-0 self-start sm:self-auto disabled:opacity-50"
              >
                <RefreshCw size={13} className={isRefreshingRecents ? 'animate-spin' : ''} />
                <span>{isRefreshingRecents ? 'Sincronizando...' : 'Sincronizar Agora'}</span>
              </button>
            </div>

            {/* Lista Cronológica de Tarefas Recentes */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3">
              {(() => {
                const recentsList = installedApps
                  .filter(a => a.isForegroundNow || a.recentOrderIndex !== undefined || a.isRecent)
                  .sort((a, b) => {
                    if (a.isForegroundNow && !b.isForegroundNow) return -1;
                    if (!a.isForegroundNow && b.isForegroundNow) return 1;
                    const orderA = a.recentOrderIndex !== undefined ? a.recentOrderIndex : 9999;
                    const orderB = b.recentOrderIndex !== undefined ? b.recentOrderIndex : 9999;
                    return orderA - orderB;
                  });

                if (recentsList.length === 0) {
                  return (
                    <div className="text-center py-12 px-4 space-y-4">
                      <div className="w-14 h-14 bg-indigo-50 text-indigo-600 rounded-3xl flex items-center justify-center mx-auto">
                        <Clock size={28} />
                      </div>
                      <div className="space-y-1 max-w-md mx-auto">
                        <h4 className="font-black text-slate-800 text-sm uppercase">
                          Nenhum Registro de Recentes Detectado Ainda
                        </h4>
                        <p className="text-xs text-slate-500 leading-relaxed">
                          Conecte o aparelho e clique em sincronizar para consultar o histórico de tarefas abertas do Android via <code>dumpsys activity recents</code>.
                        </p>
                      </div>
                      <button
                        onClick={handleRefreshRecentActivity}
                        disabled={!webAdb.isConnected()}
                        className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all"
                      >
                        Consultar Recentes Agora
                      </button>
                    </div>
                  );
                }

                return recentsList.map((app, idx) => {
                  const isDanger = app.riskLevel === 'danger';
                  const isWarning = app.riskLevel === 'warning';

                  return (
                    <div
                      key={app.packageName}
                      className={`p-4 rounded-2xl border transition-all ${
                        isDanger
                          ? 'border-red-300 bg-red-50/40 shadow-sm'
                          : isWarning
                          ? 'border-amber-300 bg-amber-50/40 shadow-sm'
                          : app.isForegroundNow
                          ? 'border-emerald-300 bg-emerald-50/30 shadow-sm ring-1 ring-emerald-300'
                          : 'border-slate-200 bg-white hover:border-slate-300'
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        {/* Lado Esquerdo: Badges e Informações */}
                        <div className="space-y-2 min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            {/* Ordem Cronológica */}
                            {app.isForegroundNow ? (
                              <span className="px-2.5 py-1 bg-emerald-600 text-white rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 shadow-sm animate-pulse">
                                <Activity size={12} />
                                <span>Em Uso Agora (Tela Ativa)</span>
                              </span>
                            ) : (
                              <span className="px-2.5 py-1 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 shadow-sm">
                                <Clock size={12} />
                                <span>
                                  #{app.recentOrderIndex !== undefined ? app.recentOrderIndex + 1 : idx + 1} na Fila de Recentes
                                </span>
                              </span>
                            )}

                            {/* Alerta de Vírus / Adware */}
                            {isDanger && (
                              <span className="px-2.5 py-1 bg-red-600 text-white rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center gap-1 shadow-sm">
                                <ShieldAlert size={12} />
                                <span>Tarja Vermelha (Vírus / Adware)</span>
                              </span>
                            )}
                            {isWarning && (
                              <span className="px-2.5 py-1 bg-amber-500 text-white rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center gap-1 shadow-sm">
                                <AlertTriangle size={12} />
                                <span>Tarja Laranja (PUP)</span>
                              </span>
                            )}

                            {/* Origem */}
                            {app.sourceText && (
                              <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded-md text-[10px] font-bold border border-slate-200">
                                {app.sourceText}
                              </span>
                            )}
                          </div>

                          {/* Título e Pacote */}
                          <div>
                            <h4 className="font-black text-slate-900 text-sm tracking-tight truncate">
                              {app.appName}
                            </h4>
                            <div className="flex items-center gap-2 mt-0.5">
                              <code className="font-mono text-slate-600 bg-slate-100 px-2 py-0.5 rounded text-[11px] truncate max-w-sm">
                                {app.packageName}
                              </code>
                              <button
                                onClick={() => copyToClipboard(app.packageName)}
                                className="text-slate-400 hover:text-slate-600 p-0.5"
                                title="Copiar pacote"
                              >
                                {copiedPackage === app.packageName ? (
                                  <Check size={12} className="text-emerald-500" />
                                ) : (
                                  <Copy size={12} />
                                )}
                              </button>
                            </div>
                          </div>

                          {/* Detalhes de Tempo e Diagnóstico */}
                          <div className="flex items-center gap-3 text-xs text-slate-500 flex-wrap">
                            {app.lastUsedFormatted && (
                              <span className="font-medium text-slate-700 flex items-center gap-1">
                                <Clock size={12} className="text-slate-400" />
                                <span>{app.lastUsedFormatted}</span>
                              </span>
                            )}
                            {app.totalTimeInForeground && (
                              <span className="text-slate-600">
                                Tempo de Tela: <strong>{app.totalTimeInForeground}</strong>
                              </span>
                            )}
                          </div>

                          {/* Se for ameaça, aviso em destaque */}
                          {isDanger && (
                            <p className="text-xs text-red-800 font-semibold bg-red-100/70 p-2 rounded-xl border border-red-200">
                              ⚠️ <strong>Atenção:</strong> Este aplicativo recente corresponde ao padrão de adware invasivo. Se anúncios estão pulando na sua tela, desinstale-o agora.
                            </p>
                          )}
                        </div>

                        {/* Lado Direito: Ações Imediatas */}
                        <div className="flex items-center gap-2 shrink-0 self-end sm:self-center flex-wrap">
                          {/* Desinstalar */}
                          <button
                            onClick={() => {
                              setShowRecentsModal(false);
                              handleUninstall(app);
                            }}
                            className="flex items-center gap-1.5 px-3.5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-sm active:scale-95"
                            title="Desinstalar este aplicativo agora"
                          >
                            <Trash2 size={13} />
                            <span>Desinstalar</span>
                          </button>

                          {/* Forçar Parada */}
                          <button
                            onClick={() => handleForceStop(app)}
                            className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all active:scale-95"
                            title="Encerrar processo em segundo plano imediatamente"
                          >
                            <Power size={13} />
                            <span>Parar</span>
                          </button>

                          {/* Limpar Dados */}
                          <button
                            onClick={() => handleClearData(app)}
                            className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl transition-all"
                            title="Limpar dados e cache"
                          >
                            <Sparkles size={14} />
                          </button>

                          {/* Abrir no Celular */}
                          <button
                            onClick={() => handleOpenOnDevice(app)}
                            className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl transition-all"
                            title="Abrir tela de configurações no celular"
                          >
                            <ExternalLink size={14} />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                });
              })()}
            </div>

            {/* Footer do Modal */}
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 shrink-0">
              <span>
                Total de itens com registro de atividade: {installedApps.filter(a => a.isForegroundNow || a.recentOrderIndex !== undefined || a.isRecent).length}
              </span>
              <button
                onClick={() => setShowRecentsModal(false)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl font-bold uppercase transition-all"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* BANNER FLUTUANTE DE TOAST / NOTIFICAÇÃO (Substitui window.alert) */}
      {toast && (
        <div className="fixed top-5 right-5 z-[100] max-w-sm w-full animate-in slide-in-from-top-4 fade-in duration-300">
          <div className={`p-4 rounded-2xl shadow-2xl border flex items-start gap-3 backdrop-blur-md ${
            toast.type === 'success'
              ? 'bg-emerald-900/95 text-white border-emerald-500/50'
              : toast.type === 'error'
              ? 'bg-red-900/95 text-white border-red-500/50'
              : toast.type === 'warning'
              ? 'bg-amber-900/95 text-white border-amber-500/50'
              : 'bg-slate-900/95 text-white border-slate-700/50'
          }`}>
            <div className="shrink-0 mt-0.5">
              {toast.type === 'success' && <CheckCircle2 size={20} className="text-emerald-400" />}
              {toast.type === 'error' && <ShieldAlert size={20} className="text-red-400" />}
              {toast.type === 'warning' && <AlertTriangle size={20} className="text-amber-400" />}
              {toast.type === 'info' && <Info size={20} className="text-blue-400" />}
            </div>
            <div className="flex-1 min-w-0">
              <h5 className="font-bold text-xs uppercase tracking-wider">{toast.title}</h5>
              <p className="text-xs text-white/85 leading-relaxed mt-0.5">{toast.message}</p>
            </div>
            <button
              onClick={() => setToast(null)}
              className="text-white/60 hover:text-white p-1 rounded-lg shrink-0"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdbVirusCleaner;
