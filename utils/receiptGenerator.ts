import { ServiceOrder, AppSettings } from '../types';
import { formatCurrency, formatDate } from '../utils';

export interface GeneratedReceipt {
  dataUrl: string;
  blob: Blob;
  file: File;
}

export async function generateReceiptCanvasImage(
  order: ServiceOrder,
  settings: AppSettings
): Promise<GeneratedReceipt> {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Não foi possível obter o contexto 2D do canvas.');
  }

  const scale = 2;
  const width = 380 * scale;
  const dynamicHeight = 8500 * scale;
  canvas.width = width;
  canvas.height = dynamicHeight;

  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, width, dynamicHeight);

  // Função para quebra de texto por largura (maxWidth)
  const wrapText = (
    text: string,
    x: number,
    y: number,
    maxWidth: number,
    lineHeight: number,
    bold: boolean = false,
    color: string = '#000',
    align: 'left' | 'center' = 'left'
  ) => {
    ctx.font = `${bold ? '900' : '500'} ${9 * scale}px "Inter", sans-serif`;
    ctx.fillStyle = color;
    ctx.textAlign = align;

    const words = (text || '').split(' ');
    let line = '';
    let currentY = y;
    const posX = align === 'center' ? width / 2 : x;

    for (let n = 0; n < words.length; n++) {
      const testLine = line + words[n] + ' ';
      const metrics = ctx.measureText(testLine);
      const testWidth = metrics.width;
      if (testWidth > maxWidth && n > 0) {
        ctx.fillText(line, posX, currentY);
        line = words[n] + ' ';
        currentY += lineHeight;
      } else {
        line = testLine;
      }
    }
    ctx.fillText(line, posX, currentY);
    return currentY + lineHeight;
  };

  // Função para quebra de texto inteligente
  const wrapTextByChars = (
    text: string,
    x: number,
    y: number,
    charLimit: number,
    lineHeight: number,
    color: string = '#444'
  ) => {
    ctx.font = `500 ${9 * scale}px "Inter", sans-serif`;
    ctx.fillStyle = color;
    ctx.textAlign = 'left';

    const words = (text || '').split(' ');
    let currentLine = '';
    let currentY = y;

    words.forEach((word, index) => {
      const testLine = currentLine === '' ? word : `${currentLine} ${word}`;
      if (testLine.length > charLimit && index > 0) {
        ctx.fillText(currentLine, x, currentY);
        currentLine = word;
        currentY += lineHeight;
      } else {
        currentLine = testLine;
      }
    });

    if (currentLine) {
      ctx.fillText(currentLine, x, currentY);
      currentY += lineHeight;
    }
    return currentY;
  };

  // Desenha linhas tracejadas separadoras
  const drawSeparator = (y: number) => {
    ctx.strokeStyle = '#DDD';
    ctx.lineWidth = 1 * scale;
    ctx.setLineDash([4 * scale, 2 * scale]);
    ctx.beginPath();
    ctx.moveTo(20 * scale, y);
    ctx.lineTo(width - 20 * scale, y);
    ctx.stroke();
    ctx.setLineDash([]);
    return y + 15 * scale;
  };

  let currentY = 50 * scale;

  // 1. Cabeçalho
  ctx.font = `900 ${16 * scale}px "Inter", sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillStyle = '#000';
  ctx.fillText((settings?.storeName || 'ASSISTÊNCIA TÉCNICA').toUpperCase(), width / 2, currentY);
  currentY += 25 * scale;

  ctx.font = `700 ${10 * scale}px "Inter", sans-serif`;
  ctx.fillText(`ORDEM DE SERVIÇO: #${order.id}`, width / 2, currentY);
  currentY += 16 * scale;
  ctx.font = `500 ${9 * scale}px "Inter", sans-serif`;
  ctx.fillText(`REGISTRO: ${formatDate(order.date || new Date().toISOString())}`, width / 2, currentY);
  currentY += 25 * scale;

  currentY = drawSeparator(currentY);

  // 2. Dados do Cliente
  ctx.font = `900 ${10 * scale}px "Inter", sans-serif`;
  ctx.textAlign = 'left';
  ctx.fillText("DADOS DO CLIENTE", 25 * scale, currentY);
  currentY += 18 * scale;
  currentY = wrapText(`Nome: ${order.customerName || 'Não informado'}`, 25 * scale, currentY, width - 50 * scale, 14 * scale);
  currentY = wrapText(`Telefone: ${order.phoneNumber || 'Não informado'}`, 25 * scale, currentY, width - 50 * scale, 14 * scale);
  currentY = wrapText(`Endereço: ${order.address || 'Não informado'}`, 25 * scale, currentY, width - 50 * scale, 14 * scale);
  currentY += 10 * scale;
  currentY = drawSeparator(currentY);

  // 3. Dados do Aparelho
  ctx.font = `900 ${10 * scale}px "Inter", sans-serif`;
  ctx.fillText("DADOS DO APARELHO", 25 * scale, currentY);
  currentY += 18 * scale;
  currentY = wrapText(`Marca: ${order.deviceBrand || '-'}`, 25 * scale, currentY, width - 50 * scale, 14 * scale);
  currentY = wrapText(`Modelo: ${order.deviceModel || '-'}`, 25 * scale, currentY, width - 50 * scale, 14 * scale);
  currentY += 14 * scale;

  ctx.font = `700 ${9 * scale}px "Inter", sans-serif`;
  ctx.fillText(`DATA DE ENTRADA: ${order.entryDate || '-'}`, 25 * scale, currentY);
  currentY += 14 * scale;
  if (order.status === 'Concluído' || order.status === 'Entregue') {
    ctx.fillText(`DATA DE SAÍDA: ${order.exitDate || '-'}`, 25 * scale, currentY);
    currentY += 14 * scale;
  }

  currentY += 8 * scale;
  ctx.font = `900 ${9 * scale}px "Inter", sans-serif`;
  ctx.fillText("Defeito informado:", 25 * scale, currentY);
  currentY += 14 * scale;
  currentY = wrapTextByChars(order.defect || '-', 25 * scale, currentY, 60, 12 * scale);
  currentY += 10 * scale;
  currentY = drawSeparator(currentY);

  // 3.5 Checklist
  if (order.checklist && order.checklist.length > 0) {
    ctx.font = `900 ${10 * scale}px "Inter", sans-serif`;
    ctx.textAlign = 'left';
    ctx.fillText("CHECKLIST DE DEFEITOS", 25 * scale, currentY);
    currentY += 18 * scale;
    ctx.font = `500 ${9 * scale}px "Inter", sans-serif`;
    const checklistText = order.checklist.join(', ');
    currentY = wrapTextByChars(checklistText, 25 * scale, currentY, 60, 12 * scale);
    currentY += 10 * scale;
    currentY = drawSeparator(currentY);
  }

  // 4. Reparo Efetuado
  ctx.font = `900 ${10 * scale}px "Inter", sans-serif`;
  ctx.fillText("REPARO EFETUADO", 25 * scale, currentY);
  currentY += 18 * scale;
  currentY = wrapTextByChars(order.repairDetails || 'Serviço em andamento.', 25 * scale, currentY, 60, 12 * scale);
  currentY += 10 * scale;
  currentY = drawSeparator(currentY);

  // Fotos de Entrada
  ctx.font = `900 ${10 * scale}px "Inter", sans-serif`;
  ctx.fillText("FOTOS DE ENTRADA", 25 * scale, currentY);
  currentY += 20 * scale;
  if (order.photos && order.photos.length > 0) {
    const thumbSize = 100 * scale;
    const gap = 10 * scale;
    for (let i = 0; i < order.photos.length; i++) {
      try {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.src = order.photos[i];
        await new Promise((resolve) => {
          img.onload = resolve;
          img.onerror = resolve;
        });
        ctx.drawImage(img, 25 * scale + (i % 3 * (thumbSize + gap)), currentY + (Math.floor(i / 3) * (thumbSize + gap)), thumbSize, thumbSize);
      } catch (e) {
        console.warn('Erro ao desenhar foto de entrada:', e);
      }
    }
    currentY += (Math.ceil(order.photos.length / 3) * (thumbSize + gap)) + 15 * scale;
  } else {
    ctx.font = `500 ${8 * scale}px "Inter", sans-serif`;
    ctx.fillText("Nenhuma foto anexada.", 25 * scale, currentY);
    currentY += 15 * scale;
  }

  // Fotos de Saída
  if (order.status === 'Concluído' || order.status === 'Entregue') {
    currentY = drawSeparator(currentY);
    ctx.font = `900 ${10 * scale}px "Inter", sans-serif`;
    ctx.fillText("FOTOS DO SERVIÇO PRONTO", 25 * scale, currentY);
    currentY += 20 * scale;
    if (order.finishedPhotos && order.finishedPhotos.length > 0) {
      const thumbSize = 100 * scale;
      const gap = 10 * scale;
      for (let i = 0; i < order.finishedPhotos.length; i++) {
        try {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.src = order.finishedPhotos[i];
          await new Promise((resolve) => {
            img.onload = resolve;
            img.onerror = resolve;
          });
          ctx.drawImage(img, 25 * scale + (i % 3 * (thumbSize + gap)), currentY + (Math.floor(i / 3) * (thumbSize + gap)), thumbSize, thumbSize);
        } catch (e) {
          console.warn('Erro ao desenhar foto de saída:', e);
        }
      }
      currentY += (Math.ceil(order.finishedPhotos.length / 3) * (thumbSize + gap)) + 15 * scale;
    } else {
      ctx.font = `500 ${8 * scale}px "Inter", sans-serif`;
      ctx.fillText("Nenhuma foto de saída.", 25 * scale, currentY);
      currentY += 15 * scale;
    }
  }

  // 5. Totalizador
  currentY = drawSeparator(currentY);
  currentY += 10 * scale;
  ctx.font = `900 ${12 * scale}px "Inter", sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillText("TOTAL DO SERVIÇO", width / 2, currentY);
  currentY += 22 * scale;
  ctx.font = `900 ${22 * scale}px "Inter", sans-serif`;
  ctx.fillText(formatCurrency(order.total || 0), width / 2, currentY);
  currentY += 40 * scale;

  if (order.paymentMethod) {
    ctx.font = `900 ${10 * scale}px "Inter", sans-serif`;
    ctx.textAlign = 'center';
    const methodText = order.paymentMethod === 'Cartão' && order.paymentInstallments && order.paymentInstallments > 1
      ? `PAGAMENTO: CARTÃO DE CRÉDITO (${order.paymentInstallments}X)`
      : `PAGAMENTO: ${order.paymentMethod.toUpperCase()}`;
    ctx.fillText(methodText, width / 2, currentY);
    currentY += 20 * scale;
  }

  currentY = drawSeparator(currentY);

  // 6. Garantia e Rodapé
  ctx.font = `900 ${10 * scale}px "Inter", sans-serif`;
  ctx.textAlign = 'left';
  ctx.fillText("TERMO DE GARANTIA", 25 * scale, currentY);
  currentY += 18 * scale;
  const rawWarranty = settings?.pdfWarrantyText || 'Garantia legal conforme CDC para serviços realizados.';
  const cleanWarranty = rawWarranty.replace(/\[\/?(B|C|J|COLOR.*?|U)\]/g, '');
  currentY = wrapText(cleanWarranty, 25 * scale, currentY, width - 50 * scale, 12 * scale, false, '#666');

  currentY += 45 * scale;

  // 6.5 Assinatura
  if (order.signature) {
    try {
      ctx.font = `900 ${10 * scale}px "Inter", sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText("ASSINATURA DO CLIENTE", width / 2, currentY);
      currentY += 10 * scale;
      const sigImg = new Image();
      sigImg.crossOrigin = 'anonymous';
      sigImg.src = order.signature;
      await new Promise((resolve) => {
        sigImg.onload = resolve;
        sigImg.onerror = resolve;
      });
      const sigWidth = 200 * scale;
      const sigHeight = 64 * scale;
      ctx.drawImage(sigImg, (width - sigWidth) / 2, currentY, sigWidth, sigHeight);
      currentY += sigHeight + 20 * scale;
    } catch (e) {
      console.warn('Erro ao desenhar assinatura:', e);
    }
  }

  ctx.font = `900 ${10 * scale}px "Inter", sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillText("OBRIGADO PELA PREFERÊNCIA!", width / 2, currentY);

  // Processamento final do canvas recortado
  const finalCanvas = document.createElement('canvas');
  finalCanvas.width = width;
  finalCanvas.height = currentY + 80 * scale;
  const finalCtx = finalCanvas.getContext('2d');
  if (!finalCtx) {
    throw new Error('Não foi possível criar o canvas final recortado.');
  }

  finalCtx.drawImage(canvas, 0, 0);

  const fileName = `OS_${order.id || 'comprovante'}.jpg`;
  const dataUrl = finalCanvas.toDataURL('image/jpeg', 0.92);

  const blob: Blob = await new Promise((resolve, reject) => {
    finalCanvas.toBlob((b) => {
      if (b) resolve(b);
      else reject(new Error('Erro ao converter canvas em Blob'));
    }, 'image/jpeg', 0.92);
  });

  const file = new File([blob], fileName, { type: 'image/jpeg' });

  return {
    dataUrl,
    blob,
    file
  };
}

/**
 * Compartilha ou envia a imagem do comprovante direto para o WhatsApp ou Share sheet
 */
export async function shareReceiptDirectly(
  order: ServiceOrder,
  settings: AppSettings
): Promise<{ method: 'native-share' | 'android-bridge' | 'download-whatsapp' | 'copied-whatsapp' }> {
  const { dataUrl, file, blob } = await generateReceiptCanvasImage(order, settings);
  const cleanPhone = (order.phoneNumber || '').replace(/\D/g, '');
  const phoneWithCountry = cleanPhone.length <= 11 && !cleanPhone.startsWith('55') ? `55${cleanPhone}` : cleanPhone;
  const fileName = `OS_${order.id}.jpg`;

  // 1. AndroidBridge (se for aplicativo instalado)
  if ((window as any).AndroidBridge?.shareFile) {
    (window as any).AndroidBridge.shareFile(dataUrl.split(',')[1], fileName, 'image/jpeg');
    return { method: 'android-bridge' };
  }

  // 2. Web Share API nativa com arquivo (Mobile Chrome, Safari iOS, Android)
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({
        files: [file],
        title: `Comprovante O.S. #${order.id}`,
        text: `Comprovante da Ordem de Serviço #${order.id} - ${settings?.storeName || 'Assistência Técnica'}`
      });
      return { method: 'native-share' };
    } catch (e: any) {
      if (e.name === 'AbortError') {
        return { method: 'native-share' };
      }
      console.warn('Erro ao compartilhar arquivo via Web Share:', e);
    }
  }

  // 3. Tenta copiar imagem para a Área de Transferência (para colar com Ctrl+V no WhatsApp Web)
  let copiedToClipboard = false;
  try {
    if (navigator.clipboard && (window as any).ClipboardItem) {
      // Converte para PNG para compatibilidade com clipboard
      const pngBlob = await new Promise<Blob | null>((resolve) => {
        const img = new Image();
        img.onload = () => {
          const c = document.createElement('canvas');
          c.width = img.width;
          c.height = img.height;
          const ctx = c.getContext('2d');
          ctx?.drawImage(img, 0, 0);
          c.toBlob(resolve, 'image/png');
        };
        img.src = dataUrl;
      });

      if (pngBlob) {
        await navigator.clipboard.write([
          new (window as any).ClipboardItem({ 'image/png': pngBlob })
        ]);
        copiedToClipboard = true;
      }
    }
  } catch (clipErr) {
    console.warn('Clipboard write image failed:', clipErr);
  }

  // Baixa o arquivo para o dispositivo
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);

  // Abre a conversa do WhatsApp
  const targetUrl = phoneWithCountry ? `https://wa.me/${phoneWithCountry}` : `https://wa.me/`;
  window.open(targetUrl, '_blank');

  return { method: copiedToClipboard ? 'copied-whatsapp' : 'download-whatsapp' };
}
