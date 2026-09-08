
export const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
};

export const parseCurrencyString = (str: string): number => {
  const cleanStr = str.replace(/[^\d]/g, '');
  return parseInt(cleanStr || '0', 10) / 100;
};

export const formatDate = (date: string | Date): string => {
  return new Date(date).toLocaleDateString('pt-BR');
};

export const formatDateTime = (date: string | Date): string => {
  return new Date(date).toLocaleString('pt-BR');
};

export const playBeepSound = () => {
  try {
    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    oscillator.type = 'square';
    oscillator.frequency.setValueAtTime(2000, audioCtx.currentTime);
    
    gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.1);

    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    oscillator.start();
    oscillator.stop(audioCtx.currentTime + 0.1);
  } catch (e) {
    console.error("Audio playback failed", e);
  }
};

export const generateRandomNumericCode = (length: number = 5): string => {
  return Math.floor(Math.random() * Math.pow(10, length)).toString().padStart(length, '0');
};

/**
 * Retorna a URL base do sistema para links externos (como Teste de Hardware e Acompanhamento de O.S.).
 * Se a loja configurou um domínio customizado em Configurações, prioriza essa URL.
 * Caso contrário, utiliza dinamicamente o window.location.origin atual do navegador,
 * garantindo que funcione perfeitamente mesmo que o domínio seja trocado ou migrado.
 */
export const getAppBaseUrl = (settings?: { customDomain?: string } | null): string => {
  const custom = settings?.customDomain?.trim();
  if (custom) {
    let clean = custom.replace(/\/+$/, '');
    if (!clean.startsWith('http://') && !clean.startsWith('https://')) {
      clean = `https://${clean}`;
    }
    return clean;
  }

  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin;
  }

  return '';
};

/**
 * Gera o link completo para o teste de hardware de celular
 */
export const getHardwareTestUrl = (tokenOrId: string, settings?: { customDomain?: string } | null): string => {
  const base = getAppBaseUrl(settings);
  const clean = encodeURIComponent(String(tokenOrId || '').trim().replace(/^#/, ''));
  return `${base}/teste-hardware/${clean}`;
};

/**
 * Gera o link completo para o acompanhamento público de O.S.
 */
export const getTrackingUrl = (tokenOrId: string, settings?: { customDomain?: string } | null): string => {
  const base = getAppBaseUrl(settings);
  const clean = encodeURIComponent(String(tokenOrId || '').trim().replace(/^#/, ''));
  return `${base}/acompanhamento/${clean}`;
};

