import { db } from './localDb';
import { supabase, isNetworkOrOfflineError, registerApiStatusReporter } from './api';

export type ConnectionStatusType = 'online' | 'db_offline' | 'offline';

export interface ConnectionState {
  status: ConnectionStatusType;
  isOnline: boolean;
  isDbConnected: boolean;
  pendingSyncCount: number;
  lastCheckedAt: number;
  lastError: string | null;
  responseTimeMs?: number;
  isChecking?: boolean;
}

type Listener = (state: ConnectionState) => void;

export class ConnectionStatusManager {
  private static listeners: Set<Listener> = new Set();
  private static checkInterval: any = null;
  private static isChecking = false;

  private static state: ConnectionState = {
    status: typeof navigator !== 'undefined' && !navigator.onLine ? 'offline' : 'online',
    isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
    isDbConnected: true,
    pendingSyncCount: 0,
    lastCheckedAt: Date.now(),
    lastError: null,
    isChecking: false
  };

  static init() {
    if (typeof window === 'undefined') return;

    // Registra gancho em tempo real para capturar falhas ou sucessos nas consultas do Supabase
    registerApiStatusReporter(
      (error) => this.reportError(error),
      () => this.reportSuccess()
    );

    // Atualiza contagem de itens pendentes na fila local
    this.refreshPendingCount();

    const handleNetworkChange = () => {
      const online = navigator.onLine;
      if (!online) {
        this.updateState({
          isOnline: false,
          isDbConnected: false,
          status: 'offline',
          lastError: 'Sem conexão com a internet',
          lastCheckedAt: Date.now()
        });
      } else {
        // Voltou a ter rede; faz checagem imediata do banco
        this.updateState({ isOnline: true });
        this.checkNow();
      }
    };

    window.addEventListener('online', handleNetworkChange);
    window.addEventListener('offline', handleNetworkChange);

    // Checagem periódica a cada 12 segundos quando a aba estiver visível
    if (!this.checkInterval) {
      this.checkInterval = setInterval(() => {
        if (document.visibilityState === 'visible' && navigator.onLine) {
          this.checkNow(true); // background silent check
        }
      }, 12000);
    }

    // Checagem inicial
    if (navigator.onLine) {
      setTimeout(() => this.checkNow(true), 1500);
    }
  }

  static subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => {
      this.listeners.delete(listener);
    };
  }

  static getState(): ConnectionState {
    return this.state;
  }

  static async refreshPendingCount(): Promise<number> {
    try {
      const count = await db.syncQueue.count();
      if (count !== this.state.pendingSyncCount) {
        this.updateState({ pendingSyncCount: count });
      }
      return count;
    } catch {
      return this.state.pendingSyncCount;
    }
  }

  static reportError(error: any) {
    const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;
    const isNetErr = isNetworkOrOfflineError(error);
    const errorMsg = error?.message || (typeof error === 'string' ? error : 'Erro de comunicação');

    const nextStatus: ConnectionStatusType = isOffline ? 'offline' : 'db_offline';

    this.updateState({
      isOnline: !isOffline,
      isDbConnected: false,
      status: nextStatus,
      lastError: errorMsg,
      lastCheckedAt: Date.now(),
      isChecking: false
    });

    this.refreshPendingCount();
  }

  static reportSuccess() {
    if (!this.state.isDbConnected || this.state.status !== 'online') {
      this.updateState({
        isOnline: true,
        isDbConnected: true,
        status: 'online',
        lastError: null,
        lastCheckedAt: Date.now(),
        isChecking: false
      });
    }
    this.refreshPendingCount();
  }

  static async checkNow(isSilent = false): Promise<ConnectionState> {
    if (this.isChecking) return this.state;
    
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      this.updateState({
        isOnline: false,
        isDbConnected: false,
        status: 'offline',
        lastError: 'Dispositivo sem internet',
        lastCheckedAt: Date.now(),
        isChecking: false
      });
      return this.state;
    }

    this.isChecking = true;
    if (!isSilent) {
      this.updateState({ isChecking: true });
    }

    const startTime = Date.now();

    try {
      // Cria uma promessa de ping rápido no Supabase com timeout estrito de 4s
      const timeoutPromise = new Promise<{ error: Error }>((_, reject) =>
        setTimeout(() => reject(new Error('Tempo limite excedido ao comunicar com o banco')), 4000)
      );

      const queryPromise = supabase
        .from('global_settings')
        .select('id')
        .limit(1)
        .maybeSingle();

      const result: any = await Promise.race([queryPromise, timeoutPromise]);
      const duration = Date.now() - startTime;

      if (result && result.error && isNetworkOrOfflineError(result.error)) {
        throw result.error;
      }

      // Se respondeu com sucesso
      this.updateState({
        isOnline: true,
        isDbConnected: true,
        status: 'online',
        lastError: null,
        lastCheckedAt: Date.now(),
        responseTimeMs: duration,
        isChecking: false
      });
      
      await this.refreshPendingCount();
    } catch (err: any) {
      const isNetErr = isNetworkOrOfflineError(err);
      this.updateState({
        isOnline: navigator.onLine,
        isDbConnected: false,
        status: !navigator.onLine ? 'offline' : 'db_offline',
        lastError: err?.message || 'Falha ao responder consulta SQL',
        lastCheckedAt: Date.now(),
        isChecking: false
      });
    } finally {
      this.isChecking = false;
    }

    return this.state;
  }

  private static updateState(partial: Partial<ConnectionState>) {
    this.state = { ...this.state, ...partial };
    this.listeners.forEach(fn => {
      try {
        fn(this.state);
      } catch (e) {
        console.error('Erro no listener de status de conexão:', e);
      }
    });
  }
}
