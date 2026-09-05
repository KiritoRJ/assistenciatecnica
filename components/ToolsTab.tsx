import React, { useState } from 'react';
import { 
  Wrench, 
  ShieldAlert, 
  Cpu, 
  Sparkles, 
  Smartphone, 
  Terminal, 
  RefreshCw, 
  Zap, 
  ArrowLeft, 
  ChevronRight, 
  ShieldCheck, 
  HardDrive, 
  BatteryMedium, 
  Lock,
  Layers,
  CheckCircle2
} from 'lucide-react';
import AdbVirusCleaner from './AdbVirusCleaner';
import AdbBatteryDiagnostics from './AdbBatteryDiagnostics';
import { AppSettings, User } from '../types';

interface Props {
  settings?: AppSettings | null;
  currentUser?: User | null;
  tenantId?: string;
}

type ToolId = 'virus-cleaner' | 'battery-diagnostics' | null;

const ToolsTab: React.FC<Props> = ({ settings, currentUser, tenantId }) => {
  const [selectedTool, setSelectedTool] = useState<ToolId>(null);

  // Se a ferramenta de remoção de vírus estiver selecionada
  if (selectedTool === 'virus-cleaner') {
    return (
      <div className="w-full max-w-7xl mx-auto space-y-4 animate-in fade-in duration-300 pb-12">
        {/* Barra Superior de Navegação */}
        <div className="flex items-center justify-between bg-white p-4 sm:p-5 rounded-2xl border border-slate-100 shadow-sm">
          <button
            onClick={() => setSelectedTool(null)}
            className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl font-bold text-xs uppercase tracking-wider transition-all active:scale-95 shadow-sm"
          >
            <ArrowLeft size={18} />
            <span>Voltar para Ferramentas</span>
          </button>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 bg-red-50 text-red-700 text-[10px] font-black uppercase rounded-lg border border-red-200">
              Ferramenta Ativa
            </span>
          </div>
        </div>

        {/* Ferramenta ADB */}
        <div className="bg-white rounded-3xl border border-slate-100 p-3 sm:p-6 shadow-sm">
          <AdbVirusCleaner onBack={() => setSelectedTool(null)} />
        </div>
      </div>
    );
  }

  // Se a ferramenta de saúde da bateria estiver selecionada
  if (selectedTool === 'battery-diagnostics') {
    return (
      <div className="w-full max-w-7xl mx-auto space-y-4 animate-in fade-in duration-300 pb-12">
        {/* Barra Superior de Navegação */}
        <div className="flex items-center justify-between bg-white p-4 sm:p-5 rounded-2xl border border-slate-100 shadow-sm">
          <button
            onClick={() => setSelectedTool(null)}
            className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl font-bold text-xs uppercase tracking-wider transition-all active:scale-95 shadow-sm"
          >
            <ArrowLeft size={18} />
            <span>Voltar para Ferramentas</span>
          </button>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 text-[10px] font-black uppercase rounded-lg border border-emerald-200">
              Diagnóstico de Bateria Ativo
            </span>
          </div>
        </div>

        {/* Ferramenta de Bateria ADB */}
        <div className="bg-white rounded-3xl border border-slate-100 p-3 sm:p-6 shadow-sm">
          <AdbBatteryDiagnostics onBack={() => setSelectedTool(null)} />
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6 animate-in fade-in duration-300 pb-12">
      {/* Header da Central de Ferramentas */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 sm:p-8 rounded-3xl border border-slate-100 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 sm:w-14 sm:h-14 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center shadow-inner shrink-0">
            <Wrench size={28} />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight uppercase">
                Central de Ferramentas
              </h1>
              <span className="px-2.5 py-0.5 bg-blue-50 text-blue-700 text-[10px] font-black uppercase tracking-wider rounded-md border border-blue-100">
                Bancada Técnica
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Selecione uma ferramenta técnica abaixo para executar manutenções, diagnósticos e limpezas via USB.
            </p>
          </div>
        </div>

        {/* Badges de Fabricantes Homologados */}
        <div className="flex items-center gap-2 flex-wrap text-[11px] font-bold text-slate-600">
          <span className="px-3 py-1.5 bg-slate-50 border border-slate-200/80 rounded-xl flex items-center gap-1.5 shadow-sm">
            <span className="w-2 h-2 rounded-full bg-blue-500"></span>
            Samsung Galaxy
          </span>
          <span className="px-3 py-1.5 bg-slate-50 border border-slate-200/80 rounded-xl flex items-center gap-1.5 shadow-sm">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            Motorola Moto
          </span>
          <span className="px-3 py-1.5 bg-slate-50 border border-slate-200/80 rounded-xl flex items-center gap-1.5 shadow-sm">
            <span className="w-2 h-2 rounded-full bg-amber-500"></span>
            Xiaomi / Redmi
          </span>
        </div>
      </div>

      {/* Grid de Ferramentas */}
      <div className="space-y-6">
        <div>
          <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest px-2 mb-3">
            Ferramenta em Destaque
          </h2>

          {/* CARD EM DESTAQUE: REMOÇÃO DE VÍRUS & ADWARE */}
          <div 
            onClick={() => setSelectedTool('virus-cleaner')}
            className="group relative overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 text-white rounded-[2.5rem] p-6 sm:p-8 border border-slate-800 shadow-xl hover:shadow-2xl hover:border-slate-700 transition-all cursor-pointer"
          >
            {/* Efeito sutil de iluminação */}
            <div className="absolute top-0 right-0 w-96 h-96 bg-red-600/10 rounded-full blur-3xl pointer-events-none group-hover:bg-red-600/15 transition-all" />
            <div className="absolute bottom-0 left-1/3 w-64 h-64 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />

            <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
              <div className="flex items-start gap-5">
                <div className="w-16 h-16 sm:w-20 sm:h-20 bg-red-500/15 border border-red-500/30 text-red-400 rounded-3xl flex items-center justify-center shrink-0 shadow-inner group-hover:scale-105 group-hover:bg-red-500/20 transition-all">
                  <ShieldAlert size={36} className="text-red-400" />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="px-2.5 py-1 bg-red-600 text-white text-[10px] font-black uppercase tracking-wider rounded-lg shadow-sm">
                      Destaque • Conexão USB
                    </span>
                    <span className="px-2.5 py-1 bg-white/10 text-slate-200 text-[10px] font-bold rounded-lg border border-white/10">
                      WebADB Direto
                    </span>
                    <span className="px-2.5 py-1 bg-emerald-500/20 text-emerald-300 text-[10px] font-bold rounded-lg border border-emerald-400/20 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                      Pronto para Uso
                    </span>
                  </div>

                  <h3 className="text-xl sm:text-2xl font-black text-white uppercase tracking-tight group-hover:text-red-300 transition-colors">
                    Remoção de Vírus & Adware Android
                  </h3>

                  <p className="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed">
                    Conecte aparelhos via cabo USB com Depuração ativada. Escaneie e remova malwares, falsos limpadores de memória, apps espiões e propagandas abusivas sem precisar formatar o celular do cliente.
                  </p>

                  <div className="flex flex-wrap items-center gap-2 pt-2 text-[11px] text-slate-300 font-bold">
                    <span className="px-2.5 py-1 bg-blue-500/20 text-blue-300 rounded-lg border border-blue-400/20">
                      ✓ Samsung One UI
                    </span>
                    <span className="px-2.5 py-1 bg-emerald-500/20 text-emerald-300 rounded-lg border border-emerald-400/20">
                      ✓ Motorola My UX / Hello UI
                    </span>
                    <span className="px-2.5 py-1 bg-amber-500/20 text-amber-300 rounded-lg border border-amber-400/20">
                      ✓ Xiaomi / Redmi
                    </span>
                    <span className="px-2.5 py-1 bg-purple-500/20 text-purple-300 rounded-lg border border-purple-400/20">
                      ✓ Desinstalação Forçada de Usuário 0
                    </span>
                  </div>
                </div>
              </div>

              {/* Botão de Ação do Card */}
              <div className="shrink-0 flex sm:self-start lg:self-center">
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedTool('virus-cleaner');
                  }}
                  className="w-full sm:w-auto px-6 py-4 bg-red-600 hover:bg-red-500 text-white rounded-2xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-3 shadow-lg shadow-red-600/30 group-hover:scale-105 active:scale-95 transition-all"
                >
                  <span>Abrir Ferramenta</span>
                  <ChevronRight size={18} />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* PRÓXIMAS FERRAMENTAS / CATEGORIAS ADICIONAIS */}
        <div className="pt-2">
          <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest px-2 mb-3">
            Outras Ferramentas de Bancada
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Card Otimização & Limpeza de Cache */}
            <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm relative overflow-hidden flex flex-col justify-between space-y-4 hover:border-slate-200 transition-all">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center">
                    <Zap size={24} />
                  </div>
                  <span className="px-2.5 py-0.5 bg-slate-100 text-slate-500 text-[10px] font-black uppercase rounded-md">
                    Em Breve
                  </span>
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-800 uppercase tracking-tight">
                    Otimização de Desempenho
                  </h3>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                    Limpeza profunda de pacotes de cache, desativação de bloatwares pesados de fábrica e aceleração de animações do sistema.
                  </p>
                </div>
              </div>
              <div className="pt-2 border-t border-slate-50 flex items-center justify-between text-[11px] font-bold text-slate-400">
                <span>Modo Rápido ADB</span>
                <span>Módulo 02</span>
              </div>
            </div>

            {/* Card Diagnóstico de Hardware & Bateria */}
            <div 
              onClick={() => setSelectedTool('battery-diagnostics')}
              className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm relative overflow-hidden flex flex-col justify-between space-y-4 hover:border-emerald-200 hover:shadow-md transition-all cursor-pointer group"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center group-hover:scale-105 group-hover:bg-emerald-100 transition-all shadow-inner">
                    <BatteryMedium size={24} />
                  </div>
                  <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 text-[10px] font-black uppercase rounded-lg border border-emerald-200 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                    Disponível
                  </span>
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-800 uppercase tracking-tight group-hover:text-emerald-700 transition-colors">
                    Saúde da Bateria & Sensores
                  </h3>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                    Leitura de ciclos de carga reais, temperatura de bateria, status do sensor térmico e relatório de degradação.
                  </p>
                </div>
              </div>
              <div className="pt-2 border-t border-slate-50 flex items-center justify-between text-[11px] font-bold text-slate-500 group-hover:text-emerald-600 transition-colors">
                <span>Abrir Diagnóstico</span>
                <ChevronRight size={16} />
              </div>
            </div>

            {/* Card Backup Completo de APKs & Dados */}
            <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm relative overflow-hidden flex flex-col justify-between space-y-4 hover:border-slate-200 transition-all">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center">
                    <HardDrive size={24} />
                  </div>
                  <span className="px-2.5 py-0.5 bg-slate-100 text-slate-500 text-[10px] font-black uppercase rounded-md">
                    Em Breve
                  </span>
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-800 uppercase tracking-tight">
                    Extração & Backup de APKs
                  </h3>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                    Extraia os instaladores originais (.apk) dos aplicativos do cliente direto para o computador antes de reparos.
                  </p>
                </div>
              </div>
              <div className="pt-2 border-t border-slate-50 flex items-center justify-between text-[11px] font-bold text-slate-400">
                <span>Backup USB</span>
                <span>Módulo 04</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ToolsTab;
