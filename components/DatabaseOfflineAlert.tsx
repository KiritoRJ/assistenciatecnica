import React, { useState, useEffect } from 'react';
import { 
  Database, 
  Wifi, 
  WifiOff, 
  AlertTriangle, 
  RefreshCw, 
  CheckCircle2, 
  CloudOff, 
  HardDrive, 
  X, 
  Info,
  ChevronDown,
  ChevronUp,
  ShieldAlert
} from 'lucide-react';
import { ConnectionStatusManager, ConnectionState, ConnectionStatusType } from '../utils/connectionStatus';
import { OfflineSync } from '../utils/offlineSync';

export interface DatabaseOfflineAlertProps {
  onForceSync?: () => Promise<void> | void;
}

// 1. Tag / Badge Compacta para Cabeçalho Mobile e Desktop
export const ConnectionStatusTag: React.FC<{
  className?: string;
  onClickDetail?: () => void;
}> = ({ className = '', onClickDetail }) => {
  const [state, setState] = useState<ConnectionState>(ConnectionStatusManager.getState());
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    return ConnectionStatusManager.subscribe((newState) => {
      setState(newState);
    });
  }, []);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onClickDetail) {
      onClickDetail();
    } else {
      setIsModalOpen(true);
    }
  };

  const isOnline = state.status === 'online';
  const isDbOffline = state.status === 'db_offline';
  const isTotalOffline = state.status === 'offline';

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        title={
          isOnline 
            ? `Banco de Dados SQL Online (${state.responseTimeMs ? `${state.responseTimeMs}ms` : 'Conectado'})`
            : isDbOffline
            ? 'Banco SQL em nuvem offline! O app está funcionando em modo local.'
            : 'Dispositivo sem conexão de internet.'
        }
        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all select-none cursor-pointer active:scale-95 ${
          isOnline
            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/80 hover:bg-emerald-100 shadow-xs'
            : isDbOffline
            ? 'bg-amber-500 text-white border border-amber-600 shadow-md shadow-amber-500/20 animate-pulse'
            : 'bg-rose-600 text-white border border-rose-700 shadow-md shadow-rose-600/20 animate-pulse'
        } ${className}`}
      >
        {isOnline && (
          <>
            <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0"></span>
            <Database size={12} className="shrink-0" />
            <span className="hidden sm:inline">Banco SQL Online</span>
            <span className="sm:hidden">SQL ON</span>
          </>
        )}

        {isDbOffline && (
          <>
            <span className="w-2 h-2 rounded-full bg-white animate-ping shrink-0"></span>
            <Database size={12} className="shrink-0" />
            <span className="font-black">SQL OFFLINE (MODO LOCAL)</span>
          </>
        )}

        {isTotalOffline && (
          <>
            <WifiOff size={12} className="shrink-0" />
            <span className="font-black">SEM INTERNET</span>
          </>
        )}

        {state.pendingSyncCount > 0 && (
          <span className="ml-0.5 bg-black/20 text-white px-1.5 py-0.2 rounded-full text-[8px] font-black">
            {state.pendingSyncCount}
          </span>
        )}
      </button>

      {/* Modal explicativo detalhado quando clica na tag */}
      {isModalOpen && (
        <ConnectionStatusDetailModal 
          state={state} 
          onClose={() => setIsModalOpen(false)} 
        />
      )}
    </>
  );
};

// 2. Banner de Alerta Superior para quando o Banco SQL estiver Offline ou sem Internet
export const DatabaseOfflineBanner: React.FC<{
  tenantId?: string;
  onRefreshData?: () => void;
}> = ({ tenantId, onRefreshData }) => {
  const [state, setState] = useState<ConnectionState>(ConnectionStatusManager.getState());
  const [isDismissed, setIsDismissed] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const [retryMessage, setRetryMessage] = useState<string | null>(null);

  useEffect(() => {
    return ConnectionStatusManager.subscribe((newState) => {
      setState(newState);
      if (newState.status === 'online') {
        setIsDismissed(false);
      }
    });
  }, []);

  if (state.status === 'online' || isDismissed) {
    return null;
  }

  const handleRetry = async () => {
    setIsRetrying(true);
    setRetryMessage(null);
    try {
      const result = await ConnectionStatusManager.checkNow();
      if (result.status === 'online') {
        setRetryMessage('Banco SQL conectado com sucesso!');
        await OfflineSync.processQueue();
        if (onRefreshData) onRefreshData();
      } else {
        setRetryMessage('Ainda offline. O sistema continuará salvando tudo localmente.');
      }
    } catch {
      setRetryMessage('Falha na tentativa. Modo local segue ativo.');
    } finally {
      setIsRetrying(false);
      setTimeout(() => setRetryMessage(null), 4000);
    }
  };

  const isDbOffline = state.status === 'db_offline';

  return (
    <div className="w-full bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 text-white px-4 py-3 shadow-lg border-b border-amber-600 relative z-30 animate-in slide-in-from-top-3 duration-300">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center shrink-0 border border-white/30 shadow-inner mt-0.5 md:mt-0">
            {isDbOffline ? <Database size={20} className="animate-pulse" /> : <WifiOff size={20} />}
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="bg-white text-orange-700 px-2 py-0.5 rounded-md font-black text-[9px] uppercase tracking-wider shadow-xs">
                {isDbOffline ? 'AVISO: BANCO SQL OFFLINE' : 'AVISO: SEM INTERNET'}
              </span>
              <span className="font-black text-xs uppercase tracking-tight text-white drop-shadow-xs">
                Sistema operando em Modo Local (Offline)
              </span>
            </div>
            <p className="text-[11px] text-amber-100 font-medium leading-relaxed mt-0.5 max-w-3xl">
              {isDbOffline 
                ? 'O banco de dados em nuvem está inacessível no momento. Você pode continuar emitindo Ordens de Serviço, vendas e cadastros normalmente. Seus dados estão 100% seguros na memória local do seu navegador e serão sincronizados automaticamente assim que o banco voltar.'
                : 'Seu dispositivo perdeu a conexão com a internet. O app continuará funcionando localmente sem interrupção.'}
            </p>
            {state.pendingSyncCount > 0 && (
              <div className="mt-1 flex items-center gap-1.5 text-[10px] font-black text-amber-100 uppercase">
                <HardDrive size={12} />
                <span>{state.pendingSyncCount} alteraç{state.pendingSyncCount === 1 ? 'ão' : 'ões'} salva{state.pendingSyncCount === 1 ? '' : 's'} localmente aguardando envio</span>
              </div>
            )}
            {retryMessage && (
              <p className="text-[11px] font-black text-white bg-black/20 px-2 py-0.5 rounded-md inline-block mt-1 animate-in fade-in">
                {retryMessage}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto justify-end shrink-0 pt-1 md:pt-0">
          <button
            type="button"
            onClick={handleRetry}
            disabled={isRetrying}
            className="flex-1 md:flex-initial flex items-center justify-center gap-1.5 bg-white text-slate-900 hover:bg-slate-100 active:scale-95 px-3.5 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider shadow-md transition-all disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw size={13} className={isRetrying ? 'animate-spin text-orange-600' : 'text-slate-600'} />
            <span>{isRetrying ? 'Verificando...' : 'Testar Conexão Agora'}</span>
          </button>
          
          <button
            type="button"
            onClick={() => setIsDismissed(true)}
            className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-xl transition-all"
            title="Minimizar aviso (a tag continuará no topo)"
          >
            <X size={18} />
          </button>
        </div>
      </div>
    </div>
  );
};

// 3. Notificação Toast Instantânea quando o status do Banco SQL mudar
export const ConnectionStatusToast: React.FC = () => {
  const [toast, setToast] = useState<{
    type: 'offline' | 'db_offline' | 'online';
    message: string;
    subMessage: string;
  } | null>(null);

  const prevStatusRef = React.useRef<ConnectionStatusType>(ConnectionStatusManager.getState().status);

  useEffect(() => {
    return ConnectionStatusManager.subscribe((newState) => {
      const prev = prevStatusRef.current;
      prevStatusRef.current = newState.status;

      if (prev === 'online' && newState.status === 'db_offline') {
        setToast({
          type: 'db_offline',
          message: 'Banco SQL Offline!',
          subMessage: 'O sistema ativou o Modo Local. Suas alterações estão salvas neste dispositivo.'
        });
      } else if (prev === 'online' && newState.status === 'offline') {
        setToast({
          type: 'offline',
          message: 'Conexão Perdida',
          subMessage: 'Você está offline. O sistema continua gravando dados localmente.'
        });
      } else if ((prev === 'db_offline' || prev === 'offline') && newState.status === 'online') {
        setToast({
          type: 'online',
          message: 'Banco SQL Reconectado!',
          subMessage: 'Conexão restabelecida. Sincronizando dados pendentes com a nuvem...'
        });
        OfflineSync.processQueue();
      }
    });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 6000);
    return () => clearTimeout(timer);
  }, [toast]);

  if (!toast) return null;

  return (
    <div className="fixed top-4 right-4 z-[9999] max-w-sm w-full animate-in slide-in-from-top-4 duration-300 pointer-events-auto">
      <div className={`p-4 rounded-2xl shadow-2xl border flex items-start gap-3.5 backdrop-blur-xl ${
        toast.type === 'online'
          ? 'bg-emerald-950/90 text-white border-emerald-500/40 shadow-emerald-500/20'
          : toast.type === 'db_offline'
          ? 'bg-amber-950/95 text-white border-amber-500/50 shadow-amber-500/30'
          : 'bg-slate-950/95 text-white border-rose-500/40 shadow-rose-500/20'
      }`}>
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
          toast.type === 'online'
            ? 'bg-emerald-500 text-white'
            : toast.type === 'db_offline'
            ? 'bg-amber-500 text-white'
            : 'bg-rose-500 text-white'
        }`}>
          {toast.type === 'online' ? (
            <CheckCircle2 size={20} />
          ) : toast.type === 'db_offline' ? (
            <Database size={20} className="animate-pulse" />
          ) : (
            <WifiOff size={20} />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="font-black text-xs uppercase tracking-tight">{toast.message}</h4>
          <p className="text-[11px] text-slate-300 font-medium leading-tight mt-0.5">{toast.subMessage}</p>
        </div>
        <button 
          onClick={() => setToast(null)}
          className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
};

// 4. Modal de Diagnóstico Completo de Conexão
export const ConnectionStatusDetailModal: React.FC<{
  state: ConnectionState;
  onClose: () => void;
}> = ({ state, onClose }) => {
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);

  const handleTest = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const res = await ConnectionStatusManager.checkNow();
      if (res.status === 'online') {
        setTestResult(`Conexão restabelecida com sucesso! (${res.responseTimeMs || 0}ms)`);
        await OfflineSync.processQueue();
      } else {
        setTestResult('Banco de dados ainda indisponível. Modo local segue ativo.');
      }
    } catch (e: any) {
      setTestResult('Falha no teste de conexão.');
    } finally {
      setIsTesting(false);
    }
  };

  const isOnline = state.status === 'online';
  const isDbOffline = state.status === 'db_offline';

  return (
    <div className="fixed inset-0 bg-slate-950/80 z-[400] flex items-center justify-center p-4 backdrop-blur-md animate-in fade-in">
      <div className="bg-white w-full max-w-md rounded-3xl p-6 shadow-2xl border border-slate-100 text-slate-900 animate-in zoom-in-95">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-white ${
              isOnline ? 'bg-emerald-600' : isDbOffline ? 'bg-amber-500' : 'bg-rose-600'
            }`}>
              <Database size={20} />
            </div>
            <div>
              <h3 className="font-black text-sm uppercase tracking-tight">Status do Banco SQL</h3>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Diagnóstico de Conexão</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-800 rounded-xl">
            <X size={20} />
          </button>
        </div>

        <div className="py-5 space-y-4">
          {/* Card de Estado Geral */}
          <div className={`p-4 rounded-2xl border ${
            isOnline 
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : isDbOffline
              ? 'bg-amber-50 border-amber-200 text-amber-950'
              : 'bg-rose-50 border-rose-200 text-rose-950'
          }`}>
            <div className="flex items-center justify-between font-black text-xs uppercase mb-1">
              <span>Estado Atual:</span>
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] ${
                isOnline ? 'bg-emerald-600 text-white' : isDbOffline ? 'bg-amber-500 text-white' : 'bg-rose-600 text-white'
              }`}>
                {isOnline ? 'Nuvem Conectada' : isDbOffline ? 'Banco SQL Offline (Modo Local)' : 'Sem Conexão'}
              </span>
            </div>
            <p className="text-xs font-medium leading-relaxed mt-2">
              {isOnline
                ? 'O banco de dados SQL na nuvem está online e respondendo perfeitamente em tempo real.'
                : isDbOffline
                ? 'O banco SQL em nuvem está inacessível. O aplicativo está utilizando o banco de dados local (IndexedDB) para garantir que nenhuma operação seja perdida.'
                : 'O seu dispositivo está desconectado da internet. As funções locais continuam operando normalmente.'}
            </p>
          </div>

          {/* Métricas de Diagnóstico */}
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-2 text-xs">
            <div className="flex justify-between items-center text-slate-600">
              <span className="font-bold">Internet do Dispositivo:</span>
              <span className="font-black text-slate-800">{state.isOnline ? '🟢 Conectado' : '🔴 Desconectado'}</span>
            </div>
            <div className="flex justify-between items-center text-slate-600">
              <span className="font-bold">Banco de Dados Cloud (Supabase):</span>
              <span className="font-black text-slate-800">{state.isDbConnected ? '🟢 Respondendo' : '🟠 Inacessível (Modo Local)'}</span>
            </div>
            <div className="flex justify-between items-center text-slate-600">
              <span className="font-bold">Itens na Fila de Sincronização:</span>
              <span className="font-black text-slate-800">{state.pendingSyncCount} registros</span>
            </div>
            {state.responseTimeMs && isOnline && (
              <div className="flex justify-between items-center text-slate-600">
                <span className="font-bold">Latência / Ping:</span>
                <span className="font-black text-emerald-600">{state.responseTimeMs} ms</span>
              </div>
            )}
          </div>

          {testResult && (
            <div className="p-3 bg-slate-100 rounded-xl text-xs font-bold text-center animate-in fade-in">
              {testResult}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-2 pt-2 border-t border-slate-100">
          <button
            type="button"
            onClick={handleTest}
            disabled={isTesting}
            className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-black uppercase text-[10px] tracking-widest shadow-lg shadow-blue-500/20 active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <RefreshCw size={16} className={isTesting ? 'animate-spin' : ''} />
            {isTesting ? 'Testando Conexão...' : 'Testar Conexão com o Banco SQL'}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="w-full py-3 text-slate-400 font-black uppercase text-[10px] tracking-widest hover:text-slate-600 transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
