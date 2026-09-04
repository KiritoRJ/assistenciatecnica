import { ChecklistTestItem, InteractiveChecklistResult, ServiceOrder, AppSettings } from '../types';

export const DEFAULT_CHECKLIST_TESTS: Omit<ChecklistTestItem, 'status' | 'notes' | 'measuredData'>[] = [
  // 1. TELA & TOQUE
  {
    id: 'touch_screen',
    category: 'screen',
    title: 'Touchscreen / Toque na Tela',
    description: 'Teste de resposta ao toque em toda a extensão do display (Grade 100%).'
  },
  {
    id: 'multitouch',
    category: 'screen',
    title: 'Multi-Toque (2+ Dedos)',
    description: 'Detecção simultânea de múltiplos toques na tela.'
  },
  {
    id: 'dead_pixels',
    category: 'screen',
    title: 'Cores, Brilho & Pixels Mortos',
    description: 'Verificação de manchas, linhas, burn-in e pixels mortos (RGB/Branco/Preto).'
  },

  // 2. CÂMERAS & FLASH
  {
    id: 'rear_camera',
    category: 'camera',
    title: 'Câmera Traseira Principal',
    description: 'Foco, nitidez e captura da câmera traseira.'
  },
  {
    id: 'front_camera',
    category: 'camera',
    title: 'Câmera Frontal (Selfie)',
    description: 'Imagem da câmera frontal e enquadramento.'
  },
  {
    id: 'flashlight',
    category: 'camera',
    title: 'Lanterna / Flash LED',
    description: 'Acendimento da lanterna traseira.'
  },

  // 3. ÁUDIO & MICROFONES
  {
    id: 'main_speaker',
    category: 'audio',
    title: 'Alto-Falante Principal (Música/Mídia)',
    description: 'Reprodução de som estéreo e clareza dos graves/agudos sem chiados.'
  },
  {
    id: 'ear_speaker',
    category: 'audio',
    title: 'Alto-falante Auricular (Chamadas)',
    description: 'Áudio do receptor superior utilizado em chamadas telefônicas.'
  },
  {
    id: 'main_microphone',
    category: 'audio',
    title: 'Microfone Principal (Gravação/Voz)',
    description: 'Captação de áudio, teste de fala e retorno do microfone inferior.'
  },

  // 4. SENSORES & VIBRAÇÃO
  {
    id: 'vibration',
    category: 'sensors',
    title: 'Motor de Vibração (Taptic)',
    description: 'Resposta de vibração e alertas hápticos do aparelho.'
  },
  {
    id: 'gyroscope',
    category: 'sensors',
    title: 'Giroscópio & Acelerômetro',
    description: 'Sensor de inclinação e rotação automática de tela.'
  },
  {
    id: 'proximity_sensor',
    category: 'sensors',
    title: 'Sensor de Proximidade / Luz',
    description: 'Apagamento de tela ao aproximar do rosto em ligações.'
  },

  // 5. BATERIA & CARREGAMENTO
  {
    id: 'battery_status',
    category: 'battery',
    title: 'Nível e Saúde da Bateria',
    description: 'Porcentagem de carga e retenção de energia.'
  },
  {
    id: 'charging_port',
    category: 'battery',
    title: 'Conector de Carga (USB/Tipo-C/Lightning)',
    description: 'Encaixe firme do cabo e reconhecimento de carregamento.'
  },

  // 6. CONECTIVIDADE & REDE
  {
    id: 'wifi_internet',
    category: 'connectivity',
    title: 'Conexão Wi-Fi & Internet',
    description: 'Navegação estável e velocidade de resposta da rede.'
  },
  {
    id: 'bluetooth_gps',
    category: 'connectivity',
    title: 'Bluetooth & Localização (GPS)',
    description: 'Sinal de posicionamento e pareamento sem fio.'
  },
  {
    id: 'cellular_signal',
    category: 'connectivity',
    title: 'Sinal de Chip (Operadora/4G/5G)',
    description: 'Reconhecimento de chip SIM e sinal de dados/ligações.'
  },

  // 7. BOTÕES & BIOMETRIA
  {
    id: 'physical_buttons',
    category: 'buttons',
    title: 'Botões Físicos (Power & Volume)',
    description: 'Clique e acionamento dos botões liga/desliga e volume.'
  },
  {
    id: 'biometrics',
    category: 'buttons',
    title: 'Biometria (Digital / Face ID)',
    description: 'Desbloqueio biométrico facial ou impressão digital.'
  },

  // 8. ESTRUTURA FÍSICA
  {
    id: 'housing_condition',
    category: 'structure',
    title: 'Carcaça, Vidro Traseiro & Lentes',
    description: 'Estado estético, trincados, aro empenado ou tampa traseira.'
  }
];

export function createInitialChecklist(
  order: Partial<ServiceOrder>,
  tenantId: string,
  completedBy: 'cliente' | 'tecnico' = 'cliente'
): InteractiveChecklistResult {
  const tests: ChecklistTestItem[] = DEFAULT_CHECKLIST_TESTS.map(t => ({
    ...t,
    status: 'pending'
  }));

  return {
    id: 'CHK_' + Math.random().toString(36).substring(2, 9).toUpperCase(),
    orderId: order.id || '',
    tenantId: tenantId,
    customerName: order.customerName || 'Cliente',
    phoneNumber: order.phoneNumber || '',
    deviceBrand: order.deviceBrand || '',
    deviceModel: order.deviceModel || '',
    completedAt: new Date().toISOString(),
    completedBy: completedBy,
    totalTests: tests.length,
    passedCount: 0,
    failedCount: 0,
    skippedCount: 0,
    scorePercent: 0,
    tests,
    customerNotes: '',
    customerSignature: ''
  };
}

export function computeChecklistStats(tests: ChecklistTestItem[]) {
  const total = tests.length;
  const passed = tests.filter(t => t.status === 'passed').length;
  const failed = tests.filter(t => t.status === 'failed').length;
  const skipped = tests.filter(t => t.status === 'skipped').length;
  const pending = tests.filter(t => t.status === 'pending').length;

  const validEvaluated = passed + failed;
  const scorePercent = validEvaluated > 0 ? Math.round((passed / validEvaluated) * 100) : 0;

  return {
    total,
    passed,
    failed,
    skipped,
    pending,
    scorePercent
  };
}

export function formatWhatsAppChecklistReport(
  result: InteractiveChecklistResult,
  settings: AppSettings
): string {
  const storeName = settings?.storeName || 'Assistência Técnica';
  const osId = result.orderId ? `#${result.orderId.split('-')[0]}` : '';
  const dateStr = new Date(result.completedAt || Date.now()).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  const passedList = result.tests.filter(t => t.status === 'passed');
  const failedList = result.tests.filter(t => t.status === 'failed');
  const notesList = result.tests.filter(t => t.notes && t.notes.trim().length > 0);

  let text = `📋 *LAUDO TÉCNICO DE CHECKLIST INTERATIVO*\n`;
  text += `🏬 *${storeName}*\n\n`;

  text += `👤 *Cliente:* ${result.customerName || 'Cliente'}\n`;
  if (result.orderId) text += `🔢 *Ordem de Serviço:* ${osId}\n`;
  if (result.deviceBrand || result.deviceModel) {
    text += `📱 *Aparelho:* ${result.deviceBrand || ''} ${result.deviceModel || ''}\n`;
  }
  text += `📅 *Data/Hora do Teste:* ${dateStr}\n`;
  text += `👤 *Realizado por:* ${result.completedBy === 'cliente' ? 'Cliente (Auto-Diagnóstico)' : 'Técnico na Bancada'}\n\n`;

  text += `📊 *RESULTADO GERAL:*\n`;
  text += `🏆 *Índice de Saúde:* ${result.scorePercent}% (${result.passedCount}/${result.totalTests} Aprovados)\n`;
  text += `✅ *Aprovados:* ${result.passedCount}\n`;
  text += `❌ *Com Defeito / Reprovados:* ${result.failedCount}\n`;
  text += `⚪ *Não Testados / Dispensados:* ${result.skippedCount}\n\n`;

  if (failedList.length > 0) {
    text += `⚠️ *ITENS COM DEFEITO / ATENÇÃO (${failedList.length}):*\n`;
    failedList.forEach(item => {
      text += ` ❌ *${item.title}*`;
      if (item.notes) text += ` - _Obs: ${item.notes}_`;
      text += `\n`;
    });
    text += `\n`;
  } else {
    text += `✨ *Todos os itens testados foram 100% APROVADOS! Sem anomalias detectadas.*\n\n`;
  }

  if (passedList.length > 0 && failedList.length > 0) {
    text += `✅ *ITENS APROVADOS (${passedList.length}):*\n`;
    passedList.slice(0, 8).forEach(item => {
      text += ` • ${item.title}\n`;
    });
    if (passedList.length > 8) {
      text += ` • _...e mais ${passedList.length - 8} funções funcionando perfeitamente._\n`;
    }
    text += `\n`;
  }

  if (result.customerNotes && result.customerNotes.trim().length > 0) {
    text += `📝 *Observações Adicionais do Cliente:*\n"${result.customerNotes.trim()}"\n\n`;
  }

  text += `🛡️ *Laudo digital registrado com sucesso no sistema.*`;

  return text;
}

export function generateChecklistShareLink(order: ServiceOrder, tenantId: string): string {
  const token = order.trackingToken || order.id;
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  return `${origin}/checklist/${token}`;
}
