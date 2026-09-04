// Base de dados e heurísticas de detecção de Adware, Vírus, PUPs (Programas Potencialmente Indesejados) e Bloatware para Android

export interface AppThreatAnalysis {
  packageName: string;
  appName: string;
  riskLevel: 'danger' | 'warning' | 'safe';
  category: string;
  reason: string;
  threatType?: string;
  threatTag: 'tarja-vermelha' | 'tarja-laranja' | 'seguro';
  isWhitelisted?: boolean;
  isSystemApp?: boolean;
  recommendedAction: 'uninstall' | 'disable' | 'keep';
  apkPath?: string;
  installer?: string;
}

// 1. Pacotes Maliciosos / Adwares Conhecidos mundialmente em bancadas técnicas
export const KNOWN_MALICIOUS_PACKAGES: Record<string, { name: string; category: string; reason: string }> = {
  // Fake Cleaners / Boosters conhecidos por gerar popup
  'com.cleanmaster.mguard': { name: 'Clean Master', category: 'Adware & Bloatware', reason: 'Coleta excessiva de dados e exibição contínua de anúncios agressivos.' },
  'com.cleanmaster.security': { name: 'CM Security', category: 'Falso Antivírus', reason: 'Falso antivírus com anúncios abusivos e alertas falsos de infecção.' },
  'com.speed.booster.cleaner': { name: 'Speed Booster Cleaner', category: 'Adware', reason: 'Exibe anúncios invasivos fora do app e consome bateria em segundo plano.' },
  'com.phone.cleaner.booster.virus': { name: 'Super Phone Cleaner', category: 'Falso Antivírus / Adware', reason: 'Simula falsas infecções para forçar cliques em propagandas.' },
  'com.ram.booster.speed': { name: 'RAM Booster Pro', category: 'Adware Agressivo', reason: 'Injeta popups em tela cheia e notificações indesejadas.' },
  'com.battery.saver.fastcharge': { name: 'Ultra Battery Saver', category: 'Falso Economizador', reason: 'Não economiza bateria; roda processos ocultos de mineração/anúncios.' },
  'com.cpu.cooler.master': { name: 'CPU Cooler Master', category: 'Adware', reason: 'Exibe anúncios na tela de bloqueio e simula resfriamento falso.' },
  'com.super.cleaner.antivirus': { name: 'Super Antivirus Cleaner', category: 'Rogue Antivirus', reason: 'Bloqueia o uso do aparelho com avisos falsos de vírus.' },
  'com.antivirus.cleaner.booster': { name: 'Security & Antivirus Booster', category: 'Adware', reason: 'Inunda o celular com notificações de spam.' },
  'com.clean.boost.phone': { name: 'Phone Cleaner & Booster', category: 'Adware', reason: 'Executa serviços de publicidade mesmo após fechar.' },
  'com.junk.cleaner.speed': { name: 'Junk Cleaner & Speed', category: 'Adware', reason: 'Exibe banners sobrepostos sobre outros aplicativos.' },
  'com.noxgroup.app.cleaner': { name: 'Nox Cleaner', category: 'PUP / Adware', reason: 'Exibe notificações comerciais invasivas e anúncios em tela cheia.' },
  'com.dianxinos.optimizer.duplay': { name: 'DU Speed Booster', category: 'Adware Agressivo', reason: 'Histórico de empurrar propagandas e serviços ocultos.' },
  'com.dianxinos.dxbs': { name: 'DU Battery Saver', category: 'Adware Agressivo', reason: 'Injeta popups na tela inicial e consome tráfego de dados.' },
  'com.piriform.ccleaner.rogue': { name: 'Fake CCleaner Clone', category: 'Falso Limpador', reason: 'Cópia não oficial que injeta anúncios invasivos.' },
  'com.max.cleaner.speed': { name: 'Max Cleaner Pro', category: 'Adware', reason: 'Bloqueia a tela de bloqueio com falsas análises de lixo.' },
  'com.smart.cleaner.booster': { name: 'Smart Cleaner Booster', category: 'Adware', reason: 'Dispara notificações com links suspeitos.' },

  // Fake Updates & Spoofing (Se passam por Google ou Sistema)
  'com.android.system.service.update': { name: 'System Service Update', category: 'Trojan / Spoofing', reason: 'App malicioso se passando por atualização do sistema Android.' },
  'com.google.service.framework.update': { name: 'Google Framework Update', category: 'Trojan / Spoofing', reason: 'Tentativa de se passar pelo Google Play Services.' },
  'com.android.chrome.update': { name: 'Chrome Update', category: 'Malware / Phishing', reason: 'App falso se passando pelo navegador Chrome para roubar dados.' },
  'com.whatsapp.update.service': { name: 'WhatsApp Update', category: 'Trojan / Fake Update', reason: 'Falsa atualização do WhatsApp usada para distribuir spyware.' },
  'com.android.setting.service': { name: 'Settings Service', category: 'Trojan / Backdoor', reason: 'Falso aplicativo de configurações oculto no sistema.' },
  'com.system.device.care.opt': { name: 'Device Care Optimizer', category: 'Adware / Spyware', reason: 'App oculto que injeta propagandas contínuas.' },
  'com.google.android.gms.system': { name: 'Fake Google Services', category: 'Malware / Dropper', reason: 'Falso pacote do Google Services instalado externamente.' },
  'com.android.facetime.update': { name: 'FaceTime Update', category: 'Malware / Scam', reason: 'Golpe falso de atualização prometendo recursos inexistentes.' },
  'com.samsung.system.opt.service': { name: 'Samsung Opt Fake Service', category: 'Adware / Spoofing', reason: 'App não oficial tentando imitar o suporte da Samsung.' },

  // Adware de Notificações / Push Spammers / Hidden Ads
  'com.push.notification.ad': { name: 'Push Ads Service', category: 'Push Adware', reason: 'Spam contínuo na barra de notificações com golpes e ofertas falsas.' },
  'com.airpush.optout': { name: 'AirPush Adware', category: 'Adware Framework', reason: 'Injeta anúncios na barra de status e tela inicial.' },
  'com.leadbolt.service': { name: 'LeadBolt Adware', category: 'Adware Framework', reason: 'Rede de anúncios invasivos não solicitados.' },
  'com.startapp.service': { name: 'StartApp Push', category: 'Adware Framework', reason: 'Gera popups e redireciona links no navegador.' },
  'com.hiddenads.service.runner': { name: 'HiddenAds Engine', category: 'Hidden Adware', reason: 'Oculta o ícone na gaveta de apps e roda anúncios invisíveis.' },
  'com.hiddapp.overlay.ad': { name: 'HiddApp Overlay', category: 'Adware Agressivo', reason: 'Exibe janelas de propaganda sobre qualquer outro aplicativo.' },

  // Apps de Lanterna / Utilidades Falsas / Câmeras com Adware
  'com.super.flashlight.led': { name: 'Super Flashlight HD', category: 'Adware', reason: 'Lanterna com permissões abusivas e anúncios a cada clique.' },
  'com.bright.torch.flashlight': { name: 'Brightest LED Torch', category: 'Adware', reason: 'Carrega propagandas invisíveis consumindo dados móveis.' },
  'com.beauty.camera.selfie.hd': { name: 'Beauty Camera HD', category: 'Adware / Bloatware', reason: 'Instala atalhos de publicidade na área de trabalho.' },
  'com.qr.code.scanner.reader.pro': { name: 'QR Code Reader Pro', category: 'Adware', reason: 'Leitor de QR com múltiplos ad-servers agressivos.' },
  'com.mirror.zoom.hd': { name: 'HD Pocket Mirror', category: 'Adware', reason: 'Aplicativo simples inundado de popups.' },
  'com.magnifier.glass.zoom': { name: 'Magnifier Glass HD', category: 'Adware', reason: 'Exibe anúncios sobrepostos (overlay) na tela.' },
  'com.horoscope.daily.fortune': { name: 'Daily Horoscope Fortune', category: 'Push Adware', reason: 'Spam diário de notificações e popups de tela cheia.' },
  'com.compass.digital.free': { name: 'Digital Compass Free', category: 'Adware', reason: 'Exibe anúncios de vídeos forçados ao abrir.' },
  'com.fast.charging.speed2024': { name: 'Fast Charging 2024', category: 'Falso Otimizador', reason: 'Afirma acelerar o carregamento mas apenas exibe propagandas.' },

  // Mods Não Oficiais / APKs Modificados com Risco
  'com.gbwhatsapp': { name: 'GBWhatsApp', category: 'Mod Não Oficial / Risco', reason: 'Versão modificada do WhatsApp que pode comprometer privacidade e banir a conta.' },
  'com.yowhatsapp': { name: 'YoWhatsApp', category: 'Mod Não Oficial / Risco', reason: 'Mod com código de terceiros e risco de envio de spam.' },
  'com.whatsapp.plus': { name: 'WhatsApp Plus', category: 'Mod Não Oficial / Risco', reason: 'Versão modificada não verificada pelo desenvolvedor oficial.' },
  'com.fmwhatsapp': { name: 'FMWhatsApp', category: 'Mod Não Oficial / Risco', reason: 'Mod com risco de interceptação de mensagens e Trojan Triada.' },
  'com.happymod.apk': { name: 'HappyMod', category: 'Loja Não Oficial / Pirataria', reason: 'Baixa outros APKs modificados sem verificação de segurança.' },
  'com.snaptube.premium': { name: 'SnapTube', category: 'Adware / Coletor de Dados', reason: 'Conhecido por carregar anúncios invisíveis em segundo plano.' },
  'com.vidmate.app': { name: 'VidMate', category: 'Adware / Sideload', reason: 'Injeta notificações constantes e roda webviews ocultas.' },
  'com.chelpus.luckypatcher': { name: 'Lucky Patcher', category: 'Ferramenta de Modificação', reason: 'Modificador de sistema; pode desestabilizar outros apps.' }
};

// 2. Apps Seguros Conhecidos (Whitelist) - Para não alarmar o técnico com apps legítimos
export const KNOWN_SAFE_PACKAGES: Set<string> = new Set([
  // Google
  'com.google.android.gms',
  'com.google.android.gsf',
  'com.android.vending',
  'com.google.android.googlequicksearchbox',
  'com.google.android.youtube',
  'com.google.android.apps.maps',
  'com.google.android.gm',
  'com.google.android.apps.photos',
  'com.google.android.apps.docs',
  'com.google.android.keep',
  'com.google.android.calendar',
  'com.google.android.calculator',
  'com.google.android.deskclock',
  'com.google.android.contacts',
  'com.google.android.dialer',
  'com.google.android.apps.messaging',
  'com.android.chrome',
  'com.google.android.apps.tachyon', // Meet
  'com.google.android.apps.nbu.files', // Files do Google
  
  // Meta / Redes Sociais Populares
  'com.whatsapp',
  'com.whatsapp.w4b', // WhatsApp Business
  'com.instagram.android',
  'com.facebook.katana',
  'com.facebook.orca', // Messenger
  'com.facebook.lite',
  'com.facebook.mlite',
  'org.telegram.messenger',
  'org.thunderdog.challegram',
  'com.twitter.android',
  'com.zhiliaoapp.musically', // TikTok
  'com.zhiliaoapp.musically.go',
  'com.snapchat.android',
  'com.linkedin.android',
  'com.pinterest',
  'com.kwai.video',

  // Bancos e Finanças Brasileiros
  'com.nu.production', // Nubank
  'br.com.bb.android', // Banco do Brasil
  'br.com.caixa.atendimento', // Caixa
  'br.com.caixa.tem', // Caixa Tem
  'com.itau', // Itaú
  'com.itau.pers',
  'com.bradesco', // Bradesco
  'com.santander.app', // Santander
  'br.com.intermedium', // Banco Inter
  'br.com.original.bank',
  'com.c6bank.app', // C6 Bank
  'com.mercadopago.wallet', // Mercado Pago
  'com.picpay', // PicPay
  'com.pagseguro', // PagBank
  'br.com.neon', // Neon
  'com.willfinance',

  // Comércio & Delivery
  'com.mercadolibre', // Mercado Livre
  'com.shopee.br', // Shopee
  'com.alibaba.aliexpresshd', // AliExpress
  'com.magazineluiza.adg', // Magalu
  'com.b2w.submarino',
  'com.b2w.americanas',
  'com.amazon.mShop.android.shopping', // Amazon
  'com.shein.mobile', // Shein
  'br.com.brainweb.ifood', // iFood
  'com.ubercab', // Uber
  'com.ubercab.driver',
  'com.taxis99', // 99
  'com.waze',

  // Streaming & Lazer
  'com.netflix.mediaclient',
  'com.spotify.music',
  'com.disney.disneyplus',
  'com.hbo.hbonow',
  'com.globo.globoplay',
  'com.amazon.avod.thirdpartyclient', // Prime Video
  'tv.pluto.android',
  'com.max.app',

  // Fabricantes - Samsung Oficial (Galaxy / One UI)
  'com.sec.android.app.sbrowser',
  'com.sec.android.app.sbrowser.beta',
  'com.sec.android.app.camera',
  'com.sec.android.gallery3d',
  'com.sec.android.app.myfiles',
  'com.sec.android.app.clockpackage',
  'com.sec.android.app.popupcalculator',
  'com.sec.android.app.voicenote',
  'com.sec.android.easyMover',
  'com.sec.android.app.shealth',
  'com.samsung.android.app.notes',
  'com.samsung.android.app.notes.addons',
  'com.samsung.android.oneconnect',
  'com.samsung.android.voc',
  'com.samsung.android.lool',
  'com.samsung.android.spay',
  'com.samsung.android.spaymini',
  'com.samsung.android.app.reminder',
  'com.samsung.android.calendar',
  'com.samsung.android.dialer',
  'com.samsung.android.messaging',
  'com.samsung.android.contacts',
  'com.samsung.android.game.gamehome',
  'com.samsung.android.game.gametools',
  'com.samsung.android.app.cocktailbarservice',
  'com.samsung.android.bixby.agent',
  'com.samsung.android.sm.devicesecurity',
  'com.samsung.android.aremoji',
  'com.samsung.android.arzone',
  'com.samsung.android.galaxycontinuity',

  // Fabricantes - Motorola Oficial (Moto G / Edge / My UX)
  'com.motorola.camera2',
  'com.motorola.camera3',
  'com.motorola.moto',
  'com.motorola.motodisplay',
  'com.motorola.actions',
  'com.motorola.gamemode',
  'com.motorola.launcher3',
  'com.motorola.genie',
  'com.motorola.fmplayer',
  'com.motorola.audiomonitor',
  'com.motorola.ccc.notification',
  'com.motorola.ccc.ota',
  'com.motorola.help',
  'com.motorola.timeweatherwidget',
  'com.motorola.brapps',
  'com.motorola.stylus',
  'com.motorola.mobiledesktop',
  'com.motorola.motosignature.app',

  // Fabricantes - Xiaomi Oficial (MIUI / HyperOS)
  'com.miui.calculator',
  'com.miui.gallery',
  'com.miui.cleanmaster',
  'com.miui.securitycenter',
  'com.miui.notes',
  'com.miui.weather2',
  'com.mi.android.globalminusscreen'
]);

// 3. Palavras-chave de alto risco no nome do pacote (Apenas se não for do sistema oficial)
const HIGH_RISK_KEYWORDS = [
  'adware', 'trojan', 'spyware', 'airpush', 'leadbolt',
  'system.service.update', 'chrome.update', 'hiddapp', 'dropper',
  'virus.cleaner', 'battery.saver.ultra', 'phone.cleaner.speed', 'ram.booster.pro'
];

const SUSPICIOUS_KEYWORDS = [
  'booster', 'ramcleaner', 'speedbooster',
  'cooler.master', 'junk.cleaner', 'phoneclean',
  'flashlight.pro', 'supervpn', 'fastcharge', 'torch.led.bright',
  'beauty.cam', 'qr.scanner.pro', 'videodownloader', 'whatsapp.gb',
  'mod.apk', 'hack', 'patcher'
];

/**
 * Detecta de forma robusta e precisa se um pacote é nativo do sistema operacional ou da ROM do fabricante
 */
export function isSystemOrVendorPackage(packageName: string, apkPath?: string): boolean {
  if (apkPath) {
    const p = apkPath.toLowerCase();

    // Se o aplicativo está localizado na partição de dados do usuário (/data/app),
    // ele foi explicitamente instalado pelo usuário ou baixado de lojas de aplicativos!
    if (p.startsWith('/data/app/') || p.startsWith('/data/app-private/') || p.startsWith('/data/user/')) {
      // Apenas componentes internos de infraestrutura do Play Services não devem ser listados
      const coreInfrastructureOnly = [
        'com.google.android.gms',
        'com.google.android.gsf'
      ];
      if (coreInfrastructureOnly.includes(packageName.toLowerCase())) {
        return true;
      }
      // Qualquer outro app em /data/app é um app do usuário
      return false;
    }

    // Partições de fábrica e do sistema operacional da ROM (somente leitura)
    if (
      p.startsWith('/system/') ||
      p.startsWith('/system_ext/') ||
      p.startsWith('/product/') ||
      p.startsWith('/vendor/') ||
      p.startsWith('/apex/') ||
      p.startsWith('/oem/') ||
      p.startsWith('/odm/') ||
      p.startsWith('/cust/') ||
      p.startsWith('/preload/') ||
      p.startsWith('/data/preload/') ||
      p.startsWith('/data/system/') ||
      p.startsWith('/vendor_dlkm/') ||
      p.startsWith('/odm_dlkm/') ||
      p.startsWith('/system_dlkm/')
    ) {
      return true;
    }
  }

  const pkg = packageName.toLowerCase();

  // Core do Sistema Operacional Android (quando apkPath não estiver disponível)
  const coreOsPackages = new Set([
    'android',
    'com.android.systemui',
    'com.android.keyguard',
    'com.android.phone',
    'com.android.server.telecom',
    'com.android.shell',
    'com.android.settings',
    'com.android.keychain',
    'com.android.bluetooth',
    'com.android.nfc',
    'com.android.providers.telephony',
    'com.android.providers.media',
    'com.android.providers.calendar',
    'com.android.providers.contacts',
    'com.android.providers.downloads',
    'com.android.providers.settings',
    'com.google.android.gms',
    'com.google.android.gsf',
    'com.google.android.ext.services',
    'com.google.android.ext.shared',
    'com.google.android.modulemetadata'
  ]);

  if (coreOsPackages.has(pkg) || pkg.includes('.overlay') || pkg.includes('.auto_generated_rro')) {
    return true;
  }

  // Chipset e baixo nível
  if (
    pkg.startsWith('com.qualcomm.') ||
    pkg.startsWith('com.qti.') ||
    pkg.startsWith('org.codeaurora.') ||
    pkg.startsWith('com.mediatek.') ||
    pkg.startsWith('com.unisoc.')
  ) {
    return true;
  }

  return false;
}

/**
 * Identifica a marca/ecossistema do aplicativo de sistema
 */
function getVendorCategory(packageName: string): string {
  const pkg = packageName.toLowerCase();
  if (pkg.startsWith('com.samsung.') || pkg.startsWith('com.sec.')) return 'Sistema Samsung (One UI)';
  if (pkg.startsWith('com.miui.') || pkg.startsWith('com.xiaomi.') || pkg.startsWith('com.mi.')) return 'Sistema Xiaomi (HyperOS / MIUI)';
  if (pkg.startsWith('com.motorola.') || pkg.startsWith('com.moto.')) return 'Sistema Motorola';
  if (pkg.startsWith('com.google.android.') || pkg.startsWith('com.android.') || pkg === 'android') return 'Sistema Android / Google';
  if (pkg.startsWith('com.oppo.') || pkg.startsWith('com.coloros.') || pkg.startsWith('com.oplus.')) return 'Sistema Oppo / ColorOS';
  if (pkg.startsWith('com.realme.')) return 'Sistema Realme';
  if (pkg.startsWith('com.oneplus.') || pkg.startsWith('net.oneplus.')) return 'Sistema OnePlus';
  if (pkg.startsWith('com.vivo.') || pkg.startsWith('com.bbk.')) return 'Sistema Vivo';
  if (pkg.startsWith('com.transsion.') || pkg.startsWith('com.infinix.') || pkg.startsWith('com.tecno.')) return 'Sistema Transsion / Infinix / Tecno';
  if (pkg.startsWith('com.huawei.') || pkg.startsWith('com.honor.')) return 'Sistema Huawei / Honor';
  if (pkg.startsWith('com.qualcomm.') || pkg.startsWith('com.qti.') || pkg.startsWith('com.mediatek.')) return 'Driver de Hardware / Chipset';
  return 'Aplicativo do Sistema / Fabricante';
}

/**
 * Analisa um pacote instalado e classifica o nível de risco e motivo
 */
export function analyzePackage(
  packageName: string,
  extraInfo?: { apkPath?: string; installer?: string }
): AppThreatAnalysis {
  const pkgLower = packageName.toLowerCase();
  const apkPath = extraInfo?.apkPath || '';
  const isSystemApp = isSystemOrVendorPackage(packageName, apkPath);

  // 1. Checa Whitelist Exata de Apps Populares Confiáveis
  if (KNOWN_SAFE_PACKAGES.has(packageName)) {
    return {
      packageName,
      appName: formatAppName(packageName),
      riskLevel: 'safe',
      threatTag: 'seguro',
      category: isSystemApp ? getVendorCategory(packageName) : 'App Seguro / Verificado',
      reason: isSystemApp 
        ? 'Aplicativo oficial integrado da ROM do fabricante ou Android.' 
        : 'Aplicativo verificado e seguro de desenvolvedor confiável.',
      isWhitelisted: true,
      isSystemApp,
      recommendedAction: 'keep',
      apkPath: extraInfo?.apkPath,
      installer: extraInfo?.installer
    };
  }

  // 2. Checa Lista Negra Conhecida de Trojans e Falsificadores (Mesmo se tentar imitar o sistema)
  if (KNOWN_MALICIOUS_PACKAGES[packageName]) {
    const known = KNOWN_MALICIOUS_PACKAGES[packageName];
    return {
      packageName,
      appName: known.name,
      riskLevel: 'danger',
      threatTag: 'tarja-vermelha',
      category: known.category,
      reason: known.reason,
      isSystemApp,
      recommendedAction: 'uninstall',
      apkPath: extraInfo?.apkPath,
      installer: extraInfo?.installer
    };
  }

  // 3. SE FOR APLICATIVO DO SISTEMA OU FABRICANTE:
  // IMPORTANTE: Aplicativos nativos da ROM (Samsung, Xiaomi, Motorola, Google, etc.)
  // NUNCA devem ser marcados com Tarja Laranja (PUP) nem confundidos com adwares!
  if (isSystemApp) {
    // Checa apenas se não for um pacote de nome de trojan explícito
    const isExplicitTrojan = ['trojan', 'spyware', 'dropper', 'hiddapp'].some(kw => pkgLower.includes(kw));
    if (!isExplicitTrojan) {
      return {
        packageName,
        appName: formatAppName(packageName),
        riskLevel: 'safe',
        threatTag: 'seguro',
        category: getVendorCategory(packageName),
        reason: 'Aplicativo oficial integrado ao sistema operacional ou fabricante do aparelho.',
        isWhitelisted: true,
        isSystemApp: true,
        recommendedAction: 'keep',
        apkPath: extraInfo?.apkPath,
        installer: extraInfo?.installer
      };
    }
  }

  // 4. Checa Palavras-chave de Alto Risco em Apps de Terceiros (Vírus / Adware Agressivo -> Tarja Vermelha)
  for (const kw of HIGH_RISK_KEYWORDS) {
    if (pkgLower.includes(kw)) {
      return {
        packageName,
        appName: formatAppName(packageName),
        riskLevel: 'danger',
        threatTag: 'tarja-vermelha',
        category: 'Ameaça Crítica / Adware',
        reason: `Padrão de nomenclatura associado a adware agressivo ou falsificação de sistema (${kw}).`,
        isSystemApp: false,
        recommendedAction: 'uninstall',
        apkPath: extraInfo?.apkPath,
        installer: extraInfo?.installer
      };
    }
  }

  // 5. Checa Palavras-chave Suspeitas em Apps de Usuário (Falsos limpadores, boosters, lanternas com ads -> Tarja Laranja)
  // Ignora pacotes de fabricantes oficiais para evitar falsos positivos em apps como Samsung Gaming Hub ou Moto Gametime
  const isOfficialVendorPrefix =
    pkgLower.startsWith('com.samsung.') ||
    pkgLower.startsWith('com.sec.') ||
    pkgLower.startsWith('com.motorola.') ||
    pkgLower.startsWith('com.moto.') ||
    pkgLower.startsWith('com.miui.') ||
    pkgLower.startsWith('com.xiaomi.') ||
    pkgLower.startsWith('com.google.android.');

  if (!isOfficialVendorPrefix) {
    for (const kw of SUSPICIOUS_KEYWORDS) {
      if (pkgLower.includes(kw)) {
        const isSideloaded = extraInfo?.installer === 'null' || !extraInfo?.installer || extraInfo?.installer.includes('packageinstaller');
        return {
          packageName,
          appName: formatAppName(packageName),
          riskLevel: 'warning',
          threatTag: 'tarja-laranja',
          category: 'Potencialmente Indesejado (PUP / Adware)',
          reason: isSideloaded 
            ? `Aplicativo de terceiros com características de anúncios e otimizador duvidoso instalado por APK (${kw}).`
            : `Aplicativo de terceiros com características de gerador de propagandas (${kw}).`,
          isSystemApp: false,
          recommendedAction: 'uninstall',
          apkPath: extraInfo?.apkPath,
          installer: extraInfo?.installer
        };
      }
    }
  }

  // 6. Apps instalados exclusivamente em /data/app via APK externo (Sideload) sem loja oficial
  const isDataApp = apkPath.startsWith('/data/app');
  const isSideloadWithoutStore = isDataApp && (extraInfo?.installer === 'null' || !extraInfo?.installer || extraInfo?.installer.includes('packageinstaller'));

  if (isSideloadWithoutStore && !KNOWN_SAFE_PACKAGES.has(packageName)) {
    // Se não tiver nome amigável ou parecer app suspeito
    const hasOddName = pkgLower.split('.').length < 3 || pkgLower.includes('fake') || pkgLower.includes('mod');
    if (hasOddName) {
      return {
        packageName,
        appName: formatAppName(packageName),
        riskLevel: 'warning',
        threatTag: 'tarja-laranja',
        category: 'Instalação Externa (Sideload)',
        reason: 'Instalado via APK externo fora da Google Play Store com identificação não padrão.',
        isSystemApp: false,
        recommendedAction: 'uninstall',
        apkPath: extraInfo?.apkPath,
        installer: extraInfo?.installer
      };
    }
  }

  // 7. App Comum Verificado / Seguro
  return {
    packageName,
    appName: formatAppName(packageName),
    riskLevel: 'safe',
    threatTag: 'seguro',
    category: isSystemApp ? getVendorCategory(packageName) : 'Aplicativo do Usuário',
    reason: isSystemApp 
      ? 'Componente interno ou pré-instalado do sistema operacional Android.' 
      : 'Nenhum comportamento malicioso ou assinatura de adware detectada.',
    isSystemApp,
    recommendedAction: 'keep',
    apkPath: extraInfo?.apkPath,
    installer: extraInfo?.installer
  };
}

/**
 * Converte um package name (ex: com.super.cleaner.pro) em um nome amigável legível
 */
export function formatAppName(packageName: string): string {
  if (KNOWN_MALICIOUS_PACKAGES[packageName]) {
    return KNOWN_MALICIOUS_PACKAGES[packageName].name;
  }
  const parts = packageName.split('.');
  const last = parts[parts.length - 1];
  const secondLast = parts.length > 2 ? parts[parts.length - 2] : '';
  
  if (last && last.length > 2 && !['android', 'app', 'service', 'mobile', 'client'].includes(last)) {
    return capitalize(last);
  }
  if (secondLast && secondLast.length > 2) {
    return `${capitalize(secondLast)} ${capitalize(last)}`;
  }
  return packageName;
}

function capitalize(s: string): string {
  if (!s) return '';
  return s.charAt(0).toUpperCase() + s.slice(1);
}
