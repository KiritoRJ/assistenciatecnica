import { Adb, AdbDaemonTransport } from '@yume-chan/adb';
import { AdbDaemonWebUsbDeviceManager } from '@yume-chan/adb-daemon-webusb';
import AdbWebCredentialStore from '@yume-chan/adb-credential-web';
import { analyzePackage, AppThreatAnalysis, isSystemOrVendorPackage } from './adwareDatabase';

export interface DeviceDetails {
  model: string;
  brand: string;
  manufacturer: string;
  androidVersion: string;
  securityPatch: string;
  serial: string;
  batteryLevel?: number;
  batteryStatus?: string;
  isRooted?: boolean;
  brandFlavor?: 'samsung' | 'motorola' | 'xiaomi' | 'android';
  systemUiVersion?: string;
  brandOptimizationText?: string;
}

export interface AdbPackageItem extends AppThreatAnalysis {
  selected?: boolean;
  isRemoving?: boolean;
  isUninstalled?: boolean;
  statusText?: string;
  sourceText?: string;
  // Informações de Uso Recente e Atividade
  recentOrderIndex?: number;
  lastUsedFormatted?: string;
  totalTimeInForeground?: string;
  isForegroundNow?: boolean;
  isRunning?: boolean;
  isRecent?: boolean;
}

class WebAdbService {
  private adb: Adb | null = null;
  private currentDevice: any = null;
  private credentialStore = new AdbWebCredentialStore();

  /**
   * Verifica se o navegador atual tem suporte à API WebUSB
   */
  public isWebUsbSupported(): boolean {
    return typeof navigator !== 'undefined' && 'usb' in navigator && !!AdbDaemonWebUsbDeviceManager.BROWSER;
  }

  /**
   * Verifica se há um dispositivo atualmente conectado e ativo
   */
  public isConnected(): boolean {
    return this.adb !== null;
  }

  /**
   * Verifica se a página está sendo executada dentro de um iframe
   */
  public isRunningInIframe(): boolean {
    try {
      return typeof window !== 'undefined' && window.self !== window.top;
    } catch (e) {
      return true;
    }
  }

  /**
   * Inicia o fluxo de conexão USB via WebADB
   */
  public async connect(): Promise<{ adb: Adb; device: any }> {
    const manager = AdbDaemonWebUsbDeviceManager.BROWSER;
    if (!manager) {
      throw new Error('Seu navegador não possui suporte a WebUSB. Utilize o Google Chrome, Edge, Brave ou Opera em um computador.');
    }

    // Solicita ao usuário selecionar o aparelho Android via janela nativa do navegador
    let device: any;
    try {
      device = await manager.requestDevice();
    } catch (err: any) {
      const msg = (err?.message || String(err)).toLowerCase();
      if (
        msg.includes('permissions policy') ||
        msg.includes('disallowed') ||
        msg.includes('feature "usb"') ||
        err?.name === 'SecurityError'
      ) {
        throw new Error(
          'O navegador bloqueou o acesso à porta USB porque a aplicação está em um painel/iframe de visualização. Clique no botão "Abrir em Nova Aba" para liberar a conexão USB!'
        );
      }
      throw err;
    }

    if (!device) {
      throw new Error('Nenhum dispositivo Android foi selecionado na janela.');
    }

    // Conecta a camada de transporte USB
    const connection = await device.connect();

    // Autentica via chaves RSA do WebCrypto
    const transport = await AdbDaemonTransport.authenticate({
      serial: device.serial,
      connection,
      credentialStore: this.credentialStore
    });

    this.adb = new Adb(transport);
    this.currentDevice = device;

    return { adb: this.adb, device };
  }

  /**
   * Desconecta o dispositivo ativo
   */
  public async disconnect(): Promise<void> {
    try {
      if (this.adb) {
        await this.adb.close();
      }
    } catch (e) {
      console.warn('Erro ao fechar conexão ADB:', e);
    } finally {
      this.adb = null;
      this.currentDevice = null;
    }
  }

  /**
   * Executa um comando no shell do Android e retorna a saída em texto
   */
  public async exec(command: string): Promise<string> {
    if (!this.adb) {
      throw new Error('Nenhum dispositivo Android conectado no momento.');
    }

    try {
      if (this.adb.subprocess.shellProtocol) {
        const res = await this.adb.subprocess.shellProtocol.spawnWaitText(command);
        return res.stdout || res.stderr || '';
      } else {
        const text = await this.adb.subprocess.noneProtocol.spawnWaitText(command);
        return text || '';
      }
    } catch (err: any) {
      console.error(`Erro ao executar comando ADB [${command}]:`, err);
      throw err;
    }
  }

  /**
   * Obtém informações detalhadas do aparelho conectado
   */
  public async getDeviceInfo(): Promise<DeviceDetails> {
    const brandRaw = (await this.exec('getprop ro.product.brand')).trim() || 'Android';
    const model = (await this.exec('getprop ro.product.model')).trim() || 'Dispositivo';
    const manufacturer = (await this.exec('getprop ro.product.manufacturer')).trim() || '';
    const androidVersion = (await this.exec('getprop ro.build.version.release')).trim() || '10+';
    const securityPatch = (await this.exec('getprop ro.build.version.security_patch')).trim() || 'Desconhecido';
    const serial = this.currentDevice?.serial || (await this.exec('getprop ro.serialno')).trim() || 'USB-Device';

    let brandFlavor: 'samsung' | 'motorola' | 'xiaomi' | 'android' = 'android';
    const brandLower = brandRaw.toLowerCase();
    const modelLower = model.toLowerCase();
    const mfgLower = manufacturer.toLowerCase();

    if (brandLower.includes('samsung') || mfgLower.includes('samsung') || modelLower.includes('galaxy') || modelLower.startsWith('sm-')) {
      brandFlavor = 'samsung';
    } else if (brandLower.includes('motorola') || mfgLower.includes('motorola') || brandLower.includes('moto') || modelLower.includes('moto') || mfgLower.includes('lenovo')) {
      brandFlavor = 'motorola';
    } else if (brandLower.includes('xiaomi') || brandLower.includes('redmi') || brandLower.includes('poco') || mfgLower.includes('xiaomi')) {
      brandFlavor = 'xiaomi';
    }

    let systemUiVersion: string | undefined;
    let brandOptimizationText: string | undefined;

    if (brandFlavor === 'samsung') {
      try {
        const oneUi = (await this.exec('getprop ro.build.version.oneui')).trim() || (await this.exec('getprop ro.build.version.sep')).trim();
        if (oneUi) {
          systemUiVersion = `One UI ${oneUi}`;
        } else {
          systemUiVersion = 'Samsung One UI';
        }
      } catch {
        systemUiVersion = 'Samsung One UI';
      }
      brandOptimizationText = 'Samsung Galaxy detectado: Otimização One UI / Knox ativa. Proteção contra falsos positivos em serviços essenciais da Samsung e comandos de remoção instantânea sem reinicialização.';
    } else if (brandFlavor === 'motorola') {
      try {
        const motoDisp = (await this.exec('getprop ro.build.display.id')).trim();
        systemUiVersion = motoDisp ? `Motorola (${motoDisp})` : 'Motorola My UX / Hello UI';
      } catch {
        systemUiVersion = 'Motorola My UX';
      }
      brandOptimizationText = 'Motorola Moto detectado: Otimização nativa Moto Actions & Ready For ativa. Desinstalação direta sem bloqueios adicionais de conta.';
    } else if (brandFlavor === 'xiaomi') {
      try {
        const miuiVer = (await this.exec('getprop ro.miui.ui.version.name')).trim() || (await this.exec('getprop ro.build.version.incremental')).trim();
        systemUiVersion = miuiVer ? `MIUI/HyperOS ${miuiVer}` : 'Xiaomi HyperOS / MIUI';
      } catch {
        systemUiVersion = 'Xiaomi HyperOS';
      }
      brandOptimizationText = 'Xiaomi/Redmi detectado: Requer "Depuração USB (Configurações de Segurança)" ativada nas Opções do Desenvolvedor para autorizar desinstalações.';
    }

    let batteryLevel: number | undefined;
    let batteryStatus: string | undefined;

    try {
      const batteryInfo = await this.exec('dumpsys battery');
      const levelMatch = batteryInfo.match(/level:\s*(\d+)/i);
      if (levelMatch) {
        batteryLevel = parseInt(levelMatch[1], 10);
      }
      const statusMatch = batteryInfo.match(/status:\s*(\d+)/i);
      if (statusMatch) {
        const st = parseInt(statusMatch[1], 10);
        batteryStatus = st === 2 ? 'Carregando' : st === 5 ? 'Cheia' : 'Na bateria';
      }
    } catch {
      // Ignora falha em obter bateria
    }

    return {
      brand: brandRaw.toUpperCase(),
      model,
      manufacturer,
      androidVersion,
      securityPatch,
      serial,
      batteryLevel,
      batteryStatus,
      brandFlavor,
      systemUiVersion,
      brandOptimizationText
    };
  }

  /**
   * Lista e analisa os aplicativos instalados pelo usuário.
   * Suporta nativamente Android 10, 11, 12, 13, 14, 15, 16 e Xiaomi / HyperOS / MIUI.
   * Filtra rigorosamente qualquer aplicativo nativo do sistema operacional ou da ROM do fabricante.
   */
  public async listAndAnalyzeInstalledApps(scope: 'user' | 'all' = 'user'): Promise<AdbPackageItem[]> {
    let output = '';

    // Comandos em cascata para cobrir todas as peculiaridades de fabricantes e versões do Android
    if (scope === 'user') {
      const thirdPartyCommands = [
        'pm list packages -3 -f -i',
        'pm list packages -3 -f -i --user 0',
        'pm list packages -3 -f',
        'pm list packages -3 -f --user 0',
        'cmd package list packages -3 -f -i',
        'cmd package list packages -3 -f',
        'pm list packages -3 -i',
        'pm list packages -3',
        'pm list packages -3 --user 0',
        'cmd package list packages -3'
      ];

      for (const cmd of thirdPartyCommands) {
        try {
          const res = await this.exec(cmd);
          if (res && res.includes('package:')) {
            output = res;
            break;
          }
        } catch {
          // Tenta o próximo comando na cadeia
        }
      }

      // Se mesmo após todas as tentativas com -3 nenhuma lista foi retornada
      // (comum em Xiaomi / Redmi Note quando opções de segurança da MIUI/HyperOS restringem a flag -3),
      // busca a lista com os caminhos dos APKs (-f) e filtra pela partição do usuário (/data/app/)
      if (!output || !output.includes('package:')) {
        const allAppCommands = [
          'pm list packages -f -i',
          'pm list packages -f -i --user 0',
          'pm list packages -f',
          'pm list packages -f --user 0',
          'cmd package list packages -f -i',
          'cmd package list packages -f',
          'pm list packages'
        ];

        for (const cmd of allAppCommands) {
          try {
            const res = await this.exec(cmd);
            if (res && res.includes('package:')) {
              output = res;
              break;
            }
          } catch {
            // Continua tentativa
          }
        }
      }
    } else {
      // Escopo all (todos os aplicativos)
      const allAppCommands = [
        'pm list packages -f -i',
        'pm list packages -f -i --user 0',
        'pm list packages -f',
        'pm list packages -f --user 0',
        'cmd package list packages -f -i',
        'cmd package list packages -f',
        'pm list packages'
      ];

      for (const cmd of allAppCommands) {
        try {
          const res = await this.exec(cmd);
          if (res && res.includes('package:')) {
            output = res;
            break;
          }
        } catch {
          // Continua tentativa
        }
      }
    }

    const lines = output.split('\n');
    const items: AdbPackageItem[] = [];
    const seenPackages = new Set<string>();

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line || !line.includes('package:')) continue;

      // Localiza 'package:' e pega o conteúdo posterior
      const pkgIndex = line.indexOf('package:');
      let cleanLine = line.substring(pkgIndex + 'package:'.length).trim();

      // 1. Extrai instalador (se presente no formato installer=...)
      let installer = '';
      const installerMatch = cleanLine.match(/\s+installer=([^\s]+)/);
      if (installerMatch) {
        installer = installerMatch[1];
        cleanLine = cleanLine.replace(/\s+installer=[^\s]+/, '').trim();
      }

      // 2. Extrai apkPath e packageName utilizando o ÚLTIMO sinal '='
      // (pois caminhos em /data/app/~~HASH==/ contêm hashes codificados em Base64 com '==')
      let packageName = '';
      let apkPath = '';
      const lastEquals = cleanLine.lastIndexOf('=');
      if (lastEquals !== -1) {
        apkPath = cleanLine.substring(0, lastEquals).trim();
        packageName = cleanLine.substring(lastEquals + 1).trim();
      } else {
        packageName = cleanLine.trim();
      }

      // Remove aspas ou espaços residuais se houver
      packageName = packageName.replace(/['"]/g, '').trim();

      // Validação: ignora vazios, duplicados ou linhas de erro do shell
      if (!packageName || seenPackages.has(packageName)) continue;
      if (packageName.includes(' ') || !packageName.includes('.')) continue;

      seenPackages.add(packageName);

      // Se o escopo for apps de usuário, descarta qualquer pacote de sistema ou fabricante
      if (scope === 'user' && isSystemOrVendorPackage(packageName, apkPath)) {
        continue;
      }

      const analysis = analyzePackage(packageName, { apkPath, installer });

      // Se a análise marcou como app de sistema, garante que não seja exibido no modo usuário
      if (scope === 'user' && analysis.isSystemApp) {
        continue;
      }

      // Determina texto amigável de origem
      let sourceText = 'Instalação Externa';
      if (installer === 'com.android.vending') {
        sourceText = 'Google Play Store';
      } else if (installer.includes('samsungapps')) {
        sourceText = 'Samsung Galaxy Store';
      } else if (installer.includes('mipicks') || installer.includes('xiaomi')) {
        sourceText = 'Xiaomi GetApps';
      } else if (analysis.isSystemApp) {
        sourceText = 'Sistema Android';
      } else if (installer === 'null' || !installer || installer.includes('packageinstaller')) {
        sourceText = 'Instalação Externa / APK (Sideload)';
      }

      items.push({
        ...analysis,
        sourceText,
        selected: analysis.riskLevel === 'danger' // Pré-seleciona os vírus/adware
      });
    }

    // Enriquece os aplicativos com dados de uso recente (dumpsys activity recents e usagestats)
    try {
      const recentsMap = await this.getRecentTasksAndUsage();
      for (const item of items) {
        const usage = recentsMap.get(item.packageName);
        if (usage) {
          item.recentOrderIndex = usage.recentOrderIndex;
          item.lastUsedFormatted = usage.lastUsedFormatted;
          item.totalTimeInForeground = usage.totalTimeInForeground;
          item.isForegroundNow = usage.isForegroundNow;
          item.isRunning = usage.isRunning;
          item.isRecent = true;
        }
      }
    } catch {
      // Continua caso o dumpsys não esteja acessível
    }

    // Ordena por nível de risco: Tarja Vermelha (danger) primeiro, depois Tarja Laranja (warning), depois seguros
    const riskWeight = { danger: 3, warning: 2, safe: 1 };
    items.sort((a, b) => {
      const diff = riskWeight[b.riskLevel] - riskWeight[a.riskLevel];
      if (diff !== 0) return diff;
      return a.appName.localeCompare(b.appName);
    });

    return items;
  }

  /**
   * Desinstala ou desativa um pacote forçadamente via ADB (com suporte avançado a apps de sistema, Xiaomi HyperOS e bloatwares)
   */
  public async uninstallPackage(
    packageName: string,
    isSystemApp?: boolean
  ): Promise<{
    success: boolean;
    output: string;
    actionTaken: 'uninstalled' | 'uninstalled_user' | 'disabled' | 'suspended' | 'failed';
    userMessage?: string;
    isXiaomiRestricted?: boolean;
  }> {
    try {
      // 1. Interrompe a execução do app para evitar bloqueios de processo ativo
      try {
        await this.exec(`am force-stop ${packageName}`);
      } catch {}

      // 2. Lista de comandos de desinstalação a tentar em ordem
      const commandsToTry: string[] = [];

      if (!isSystemApp) {
        commandsToTry.push(`pm uninstall ${packageName}`);
        commandsToTry.push(`cmd package uninstall ${packageName}`);
      }

      commandsToTry.push(`pm uninstall --user 0 ${packageName}`);
      commandsToTry.push(`cmd package uninstall --user 0 ${packageName}`);

      let lastOutput = '';
      let isXiaomiRestricted = false;

      for (const cmd of commandsToTry) {
        try {
          const res = await this.exec(cmd);
          lastOutput = res;
          const low = res.toLowerCase();

          if (low.includes('success')) {
            return {
              success: true,
              output: res.trim(),
              actionTaken: isSystemApp ? 'uninstalled_user' : 'uninstalled',
              userMessage: isSystemApp
                ? 'Aplicativo do sistema removido com sucesso para o usuário principal (User 0).'
                : 'Aplicativo desinstalado com sucesso do dispositivo via ADB.'
            };
          }

          if (
            res.includes('INSTALL_FAILED_USER_RESTRICTED') ||
            res.includes('Permission Denial') ||
            res.includes('SecurityException') ||
            res.includes('MANAGE_USERS')
          ) {
            isXiaomiRestricted = true;
          }
        } catch (err: any) {
          lastOutput = err?.message || lastOutput;
          if (
            lastOutput.includes('INSTALL_FAILED_USER_RESTRICTED') ||
            lastOutput.includes('Permission Denial') ||
            lastOutput.includes('SecurityException')
          ) {
            isXiaomiRestricted = true;
          }
        }
      }

      // Se a Xiaomi / HyperOS / MIUI bloqueou a remoção via USB:
      if (isXiaomiRestricted) {
        // Tenta pelo menos congelar / limpar dados para neutralizar o adware
        try {
          await this.exec(`pm clear ${packageName}`);
          await this.exec(`am force-stop ${packageName}`);
        } catch {}

        return {
          success: false,
          output: lastOutput.trim(),
          actionTaken: 'failed',
          isXiaomiRestricted: true,
          userMessage:
            'Aparelho Xiaomi / Redmi bloqueou a desinstalação via USB. No celular, acesse: Configurações > Configurações Adicionais > Opções do Desenvolvedor e ative "Depuração USB (Configurações de Segurança)".'
        };
      }

      // Detecta se é app protegido com privilégios de Administrador do Dispositivo
      if (lastOutput.includes('DELETE_FAILED_DEVICE_POLICY_MANAGER')) {
        try {
          await this.exec(`pm clear ${packageName}`);
          await this.exec(`am force-stop ${packageName}`);
        } catch {}
      }

      // 3. Se for app nativo protegido da ROM ou falhou a desinstalação, tenta DESATIVAR/CONGELAR (pm disable-user)
      let disableOut = '';
      try {
        disableOut = await this.exec(`pm disable-user --user 0 ${packageName}`);
        const low = disableOut.toLowerCase();
        if (low.includes('disabled') || low.includes('new state')) {
          return {
            success: true,
            output: disableOut.trim(),
            actionTaken: 'disabled',
            userMessage:
              'O aplicativo foi CONGELADO e DESATIVADO com sucesso pelo ADB. Ele não aparecerá mais no celular nem consumirá bateria.'
          };
        }
      } catch (e: any) {
        disableOut = e?.message || '';
      }

      // 4. Tentativa alternativa com cmd package suspend
      try {
        const suspendOut = await this.exec(`cmd package suspend --user 0 ${packageName}`);
        if (suspendOut.toLowerCase().includes('true') || suspendOut.toLowerCase().includes('success')) {
          return {
            success: true,
            output: suspendOut.trim(),
            actionTaken: 'suspended',
            userMessage: 'Aplicativo suspenso com sucesso via ADB.'
          };
        }
      } catch {}

      // 5. Tentativa com pm hide
      try {
        const hideOut = await this.exec(`pm hide ${packageName}`);
        if (hideOut.toLowerCase().includes('true') || hideOut.toLowerCase().includes('hidden')) {
          return {
            success: true,
            output: hideOut.trim(),
            actionTaken: 'disabled',
            userMessage: 'Aplicativo ocultado e desativado com sucesso via ADB.'
          };
        }
      } catch {}

      return {
        success: false,
        output: lastOutput || disableOut || 'Falha ao desinstalar pacote.',
        actionTaken: 'failed',
        isXiaomiRestricted,
        userMessage: isSystemApp
          ? 'Este aplicativo é um componente crítico protegido na ROM do aparelho.'
          : 'Não foi possível desinstalar. Verifique as permissões de segurança USB no seu dispositivo.'
      };
    } catch (err: any) {
      return {
        success: false,
        output: err?.message || 'Erro inesperado na execução ADB.',
        actionTaken: 'failed',
        userMessage: `Erro na comunicação ADB: ${err?.message || 'Desconhecido'}`
      };
    }
  }

  /**
   * Desativa (congela) o pacote
   */
  public async disablePackage(packageName: string): Promise<string> {
    return (await this.exec(`pm disable-user --user 0 ${packageName}`)).trim();
  }

  /**
   * Reativa o pacote
   */
  public async enablePackage(packageName: string): Promise<string> {
    return (await this.exec(`pm enable ${packageName}`)).trim();
  }

  /**
   * Limpa dados e cache do aplicativo
   */
  public async clearAppData(packageName: string): Promise<string> {
    return (await this.exec(`pm clear ${packageName}`)).trim();
  }

  /**
   * Força a parada do aplicativo
   */
  public async forceStopApp(packageName: string): Promise<string> {
    return (await this.exec(`am force-stop ${packageName}`)).trim();
  }

  /**
   * Abre a tela de detalhes/desinstalação do app no próprio celular
   */
  public async openAppSettingsOnDevice(packageName: string): Promise<void> {
    await this.exec(`am start -a android.settings.APPLICATION_DETAILS_SETTINGS package:${packageName}`);
  }

  /**
   * Obtém informações sobre aplicativos usados recentemente e tarefas ativas via ADB
   */
  public async getRecentTasksAndUsage(): Promise<Map<string, {
    recentOrderIndex?: number;
    lastUsedFormatted?: string;
    isForegroundNow?: boolean;
    isRunning?: boolean;
    totalTimeInForeground?: string;
  }>> {
    const result = new Map<string, {
      recentOrderIndex?: number;
      lastUsedFormatted?: string;
      isForegroundNow?: boolean;
      isRunning?: boolean;
      totalTimeInForeground?: string;
    }>();

    if (!this.isConnected()) return result;

    // 1. Identifica o aplicativo atualmente ativo em primeiro plano (na tela do celular agora)
    let foregroundPackage = '';
    try {
      const windowDump = await this.exec('dumpsys window');
      const fgMatch = windowDump.match(/(?:mCurrentFocus|mFocusedApp)[^\n]*?\s+([a-zA-Z0-9_.]+)\//);
      if (fgMatch && fgMatch[1] && fgMatch[1].includes('.')) {
        foregroundPackage = fgMatch[1].trim();
      }
    } catch {
      try {
        const actDump = await this.exec('dumpsys activity activities');
        const actMatch = actDump.match(/(?:mResumedActivity|topResumedActivity)[^\n]*?\s+([a-zA-Z0-9_.]+)\//);
        if (actMatch && actMatch[1] && actMatch[1].includes('.')) {
          foregroundPackage = actMatch[1].trim();
        }
      } catch {}
    }

    // 2. Extrai a ordem exata da pilha de recentes (dumpsys activity recents)
    try {
      let recentsRaw = '';
      try {
        recentsRaw = await this.exec('dumpsys activity recents');
      } catch {
        recentsRaw = await this.exec('cmd activity recents');
      }

      if (recentsRaw) {
        const lines = recentsRaw.split('\n');
        let currentRecentIndex = -1;
        let seenPackages = new Set<string>();

        for (const line of lines) {
          const recentMatch = line.match(/\*\s*Recent\s*#(\d+):/i);
          if (recentMatch) {
            currentRecentIndex = parseInt(recentMatch[1], 10);
            continue;
          }

          if (currentRecentIndex >= 0) {
            let pkg = '';
            const realActMatch = line.match(/(?:realActivity|cmp|origActivity)=([a-zA-Z0-9_.]+)\//);
            if (realActMatch) {
              pkg = realActMatch[1].trim();
            } else {
              const affinityMatch = line.match(/(?:affinity|A)=([a-zA-Z0-9_.]+)/);
              if (affinityMatch && affinityMatch[1].includes('.')) {
                pkg = affinityMatch[1].trim();
              }
            }

            if (pkg && pkg.includes('.') && !seenPackages.has(pkg)) {
              seenPackages.add(pkg);
              const isFg = pkg === foregroundPackage;
              result.set(pkg, {
                recentOrderIndex: currentRecentIndex,
                isForegroundNow: isFg,
                lastUsedFormatted: isFg
                  ? 'Em uso agora (Tela ativa)'
                  : currentRecentIndex === 0
                  ? 'Aberto recentemente (#1 na fila)'
                  : `Aberto recentemente (#${currentRecentIndex + 1} na fila)`
              });
            }
          }
        }
      }
    } catch (err) {
      console.warn('Erro ao obter dumpsys activity recents:', err);
    }

    // 3. Consulta dumpsys usagestats para extrair horários e tempos de execução
    try {
      const usageRaw = await this.exec('dumpsys usagestats');
      if (usageRaw) {
        const lines = usageRaw.split('\n');
        for (const line of lines) {
          const pkgMatch = line.match(/package=([a-zA-Z0-9_.]+)/i) || line.match(/Package:\s*([a-zA-Z0-9_.]+)/i);
          if (pkgMatch && pkgMatch[1].includes('.')) {
            const pkg = pkgMatch[1].trim();
            const timeMatch = line.match(/lastTime(?:Active)?="?([^"\n,]+)"?/i);
            const totalMatch = line.match(/total(?:TimeActive)?="?([^"\n,]+)"?/i);

            const existing = result.get(pkg);
            if (existing) {
              if (totalMatch) existing.totalTimeInForeground = totalMatch[1].trim();
              if (timeMatch && !existing.isForegroundNow) {
                const rawTime = timeMatch[1].trim();
                if (rawTime && rawTime !== 'null' && rawTime !== '0') {
                  existing.lastUsedFormatted = `Último uso: ${rawTime}`;
                }
              }
            } else if (timeMatch || totalMatch) {
              const rawTime = timeMatch ? timeMatch[1].trim() : '';
              result.set(pkg, {
                lastUsedFormatted: rawTime && rawTime !== 'null' && rawTime !== '0' ? `Último uso: ${rawTime}` : 'Ativo recentemente',
                totalTimeInForeground: totalMatch ? totalMatch[1].trim() : undefined,
                isForegroundNow: pkg === foregroundPackage
              });
            }
          }
        }
      }
    } catch {}

    // 4. Identifica processos atualmente ativos em memória
    try {
      let psOutput = '';
      try {
        psOutput = await this.exec('ps -A -o NAME');
      } catch {
        psOutput = await this.exec('ps');
      }
      if (psOutput) {
        for (const [pkg, info] of result.entries()) {
          if (psOutput.includes(pkg)) {
            info.isRunning = true;
          }
        }
      }
    } catch {}

    // 5. Garante que o app em primeiro plano esteja marcado
    if (foregroundPackage) {
      const existing = result.get(foregroundPackage);
      if (existing) {
        existing.isForegroundNow = true;
        existing.lastUsedFormatted = 'Em uso agora (Tela ativa)';
      } else {
        result.set(foregroundPackage, {
          recentOrderIndex: 0,
          isForegroundNow: true,
          isRunning: true,
          lastUsedFormatted: 'Em uso agora (Tela ativa)'
        });
      }
    }

    return result;
  }

  /**
   * Obtém detalhes e permissões de um aplicativo via dumpsys
   */
  public async getAppDetails(packageName: string): Promise<{ permissions: string[]; raw: string }> {
    try {
      const dump = await this.exec(`dumpsys package ${packageName}`);
      const permMatches = dump.match(/android\.permission\.[A-Z_0-9]+/g) || [];
      const uniquePerms = Array.from(new Set(permMatches));
      return { permissions: uniquePerms, raw: dump };
    } catch (e: any) {
      return { permissions: [], raw: e.message || 'Falha ao obter dumpsys' };
    }
  }
}

export const webAdb = new WebAdbService();
