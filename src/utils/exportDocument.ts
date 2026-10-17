import { toCanvas } from 'html-to-image';
import { jsPDF } from 'jspdf';
import { ScalingSession } from '../types';
import { formatLength, formatVolume } from './forestryCalculations';

/**
 * Check if the browser supports sharing files via Web Share API
 */
export function canShareFiles(): boolean {
  if (typeof navigator === 'undefined' || typeof navigator.share !== 'function') {
    return false;
  }
  if (typeof navigator.canShare !== 'function') {
    return false;
  }
  try {
    const testFile = new File(['test'], 'test.txt', { type: 'text/plain' });
    return navigator.canShare({ files: [testFile] });
  } catch {
    return false;
  }
}

/**
 * Generate high-resolution HTML Canvas from certificate element
 * Uses html-to-image to fully support modern CSS color functions (like oklch)
 * without parsing errors.
 */
export async function generateTallyCanvas(element: HTMLElement): Promise<HTMLCanvasElement> {
  // Wait a moment to ensure fonts and layout have settled
  await new Promise((resolve) => setTimeout(resolve, 80));

  if (typeof document !== 'undefined' && document.fonts && document.fonts.ready) {
    try {
      await document.fonts.ready;
    } catch {
      // Continue if FontFaceSet API throws
    }
  }

  // If the outer container was passed, prefer the inner sheet element
  const targetElement = (element.id === 'export-tally-sheet-capture'
    ? (element.querySelector('#export-tally-sheet') as HTMLElement)
    : element) || element;

  const canvas = await toCanvas(targetElement, {
    pixelRatio: 2, // 2x scale for sharp high-DPI rendering
    backgroundColor: '#ffffff',
    cacheBust: true,
    style: {
      position: 'static',
      left: '0',
      top: '0',
      margin: '0',
      opacity: '1',
      visibility: 'visible',
      display: 'block'
    }
  });

  return canvas;
}

/**
 * Export certificate as JPG Blob with high visual quality
 */
export async function exportToJpgBlob(element: HTMLElement): Promise<Blob> {
  const canvas = await generateTallyCanvas(element);
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          try {
            // Fallback via data URL if toBlob returns null
            const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
            const byteString = atob(dataUrl.split(',')[1]);
            const mimeString = dataUrl.split(',')[0].split(':')[1].split(';')[0];
            const ab = new ArrayBuffer(byteString.length);
            const ia = new Uint8Array(ab);
            for (let i = 0; i < byteString.length; i++) {
              ia[i] = byteString.charCodeAt(i);
            }
            resolve(new Blob([ab], { type: mimeString }));
          } catch {
            reject(new Error('Nem sikerült a JPG kép előállítása.'));
          }
        }
      },
      'image/jpeg',
      0.95
    );
  });
}

/**
 * Export certificate as PDF Blob formatted for A4
 */
export async function exportToPdfBlob(element: HTMLElement): Promise<Blob> {
  const canvas = await generateTallyCanvas(element);
  const imgData = canvas.toDataURL('image/jpeg', 0.95);

  // A4 dimensions in mm: 210 x 297
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pdfWidth = pdf.internal.pageSize.getWidth();
  const pdfHeight = pdf.internal.pageSize.getHeight();

  const margin = 10;
  const availableWidth = pdfWidth - margin * 2;
  const availableHeight = pdfHeight - margin * 2;

  const imgWidth = canvas.width;
  const imgHeight = canvas.height;
  const renderedHeight = (imgHeight * availableWidth) / imgWidth;

  if (renderedHeight <= availableHeight) {
    // Fits nicely on a single page
    pdf.addImage(imgData, 'JPEG', margin, margin, availableWidth, renderedHeight, undefined, 'FAST');
  } else if (renderedHeight <= availableHeight * 1.25) {
    // If it only slightly exceeds 1 page (up to ~25%), scale to keep it on one clean sheet
    const scale = availableHeight / renderedHeight;
    const fitWidth = availableWidth * scale;
    const offsetX = margin + (availableWidth - fitWidth) / 2;
    pdf.addImage(imgData, 'JPEG', offsetX, margin, fitWidth, availableHeight, undefined, 'FAST');
  } else {
    // Multiple pages slicing
    let heightLeft = renderedHeight;
    let position = margin;
    let page = 1;

    pdf.addImage(imgData, 'JPEG', margin, position, availableWidth, renderedHeight, undefined, 'FAST');
    heightLeft -= availableHeight;

    while (heightLeft > 0) {
      position = margin - (page * availableHeight);
      pdf.addPage();
      pdf.addImage(imgData, 'JPEG', margin, position, availableWidth, renderedHeight, undefined, 'FAST');
      heightLeft -= availableHeight;
      page++;
    }
  }

  return pdf.output('blob');
}

/**
 * Trigger file download for a blob
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 3000);
}

/**
 * Safe filename generator based on session data
 */
export function getExportFilename(session: ScalingSession, format: 'pdf' | 'jpg' | 'csv'): string {
  const safeName = (session.forestryAssociation || 'kobozes')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .toLowerCase()
    .replace(/_+/g, '_')
    .slice(0, 30);

  const lengthStr = formatLength(session.logLength).replace(',', '_');
  const dateStr = new Date(session.updatedAt || Date.now()).toISOString().slice(0, 10);
  return `kobozesi_jegyzokonyv_${safeName}_${lengthStr}m_${dateStr}.${format}`;
}

/**
 * Share file using Web Share API (Viber, Google Drive, Gmail, WhatsApp, Telegram, etc.)
 * Returns status object with details.
 */
export async function shareFile(
  blob: Blob,
  filename: string,
  session: ScalingSession
): Promise<{ success: boolean; fallbackTriggered?: boolean; canceled?: boolean; error?: string }> {
  const mimeType = filename.endsWith('.pdf') ? 'application/pdf' : 'image/jpeg';
  const totalCount = session.logs.reduce((acc, l) => acc + (l.pieceCount || 1), 0);
  const totalVolume = session.logs.reduce((acc, l) => acc + (l.volume * (l.pieceCount || 1)), 0);

  const title = `Erdészeti Köbözési Jegyzőkönyv - ${session.forestryAssociation || 'Erdőbirtokosság'}`;
  const text = `Erdészeti Köbözési Jegyzőkönyv: ${session.forestryAssociation || ''} (${session.depotCode || ''}) - ${session.treeSpecies || ''} ${formatLength(session.logLength)} m. Összesen: ${totalCount} db, ${formatVolume(totalVolume)} m³.`;

  // 1. Try Native Web Share API with file support
  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try {
      const file = new File([blob], filename, { type: mimeType });
      if (typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
        await navigator.share({
          title,
          text,
          files: [file]
        });
        return { success: true };
      }
    } catch (err: unknown) {
      const errorObj = err as Error;
      // AbortError indicates user simply closed the share sheet
      if (errorObj && errorObj.name === 'AbortError') {
        return { success: false, canceled: true, error: 'A megosztás megszakítva.' };
      }
      console.warn('Native share with file failed:', err);
    }
  }

  // 2. Fallback: If Web Share API files is not supported (e.g. desktop browser, iframe permissions)
  downloadBlob(blob, filename);
  return { success: true, fallbackTriggered: true };
}
