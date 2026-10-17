import React, { useState } from 'react';
import { ScalingSession } from '../types';
import { 
  exportSessionToCsv, 
  downloadFile, 
  generateSummaryText, 
  formatVolume,
  formatLength,
  calculateSessionTotals
} from '../utils/forestryCalculations';
import { 
  exportToPdfBlob, 
  exportToJpgBlob, 
  shareFile, 
  downloadBlob, 
  getExportFilename,
  canShareFiles 
} from '../utils/exportDocument';
import { 
  X, 
  FileSpreadsheet, 
  Printer, 
  Copy, 
  Check, 
  FileText, 
  Image as ImageIcon, 
  Share2, 
  Download, 
  Loader2, 
  Sparkles,
  ExternalLink,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { PrintTallySheet } from './PrintTallySheet';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  session: ScalingSession | null;
}

type ExportFormat = 'pdf' | 'jpg';

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  session
}) => {
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>('pdf');
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingAction, setProcessingAction] = useState<'share' | 'download' | null>(null);
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'success' | 'info' | 'error' } | null>(null);
  const [copied, setCopied] = useState(false);
  const [showMoreOptions, setShowMoreOptions] = useState(false);

  if (!isOpen || !session) return null;

  const totals = calculateSessionTotals(session);
  const isShareSupported = canShareFiles();

  const getTargetElement = (): HTMLElement | null => {
    // Look for the certificate tally sheet element
    const el = document.getElementById('export-tally-sheet') || document.getElementById('export-tally-sheet-capture');
    return el;
  };

  // Handle Share (Viber, Google Drive, Gmail, WhatsApp, etc.)
  const handleShare = async () => {
    setIsProcessing(true);
    setProcessingAction('share');
    setStatusMessage({ text: `${selectedFormat.toUpperCase()} előkészítése megosztáshoz...`, type: 'info' });

    try {
      const element = getTargetElement();
      if (!element) {
        throw new Error('A jegyzőkönyv sablon nem található.');
      }

      let blob: Blob;
      const filename = getExportFilename(session, selectedFormat);

      if (selectedFormat === 'pdf') {
        blob = await exportToPdfBlob(element);
      } else {
        blob = await exportToJpgBlob(element);
      }

      const result = await shareFile(blob, filename, session);

      if (result.success) {
        if (result.fallbackTriggered) {
          setStatusMessage({
            text: `A fájl letöltve (${filename}). Most már feltöltheti Drive-ra vagy megoszthatja Viberen!`,
            type: 'success'
          });
        } else {
          setStatusMessage({
            text: 'Megosztási ablak sikeresen elindítva!',
            type: 'success'
          });
        }
      } else if (result.canceled) {
        setStatusMessage(null);
      } else {
        setStatusMessage({
          text: result.error || 'A megosztás nem sikerült.',
          type: 'error'
        });
      }
    } catch (err: unknown) {
      console.error('Export share error:', err);
      setStatusMessage({
        text: 'Hiba történt az exportálás során. Kérjük, próbálja a letöltés gombot!',
        type: 'error'
      });
    } finally {
      setIsProcessing(false);
      setProcessingAction(null);
    }
  };

  // Handle Direct Download (PDF or JPG)
  const handleDownloadFile = async () => {
    setIsProcessing(true);
    setProcessingAction('download');
    setStatusMessage({ text: `${selectedFormat.toUpperCase()} generálása letöltéshez...`, type: 'info' });

    try {
      const element = getTargetElement();
      if (!element) {
        throw new Error('A jegyzőkönyv sablon nem található.');
      }

      let blob: Blob;
      const filename = getExportFilename(session, selectedFormat);

      if (selectedFormat === 'pdf') {
        blob = await exportToPdfBlob(element);
      } else {
        blob = await exportToJpgBlob(element);
      }

      downloadBlob(blob, filename);

      setStatusMessage({
        text: `Sikeres letöltés: ${filename}`,
        type: 'success'
      });
    } catch (err: unknown) {
      console.error('Download error:', err);
      setStatusMessage({
        text: 'Nem sikerült a fájl letöltése. Kérjük próbálja újra!',
        type: 'error'
      });
    } finally {
      setIsProcessing(false);
      setProcessingAction(null);
    }
  };

  // Download CSV for Excel
  const handleDownloadCsv = () => {
    const csvContent = exportSessionToCsv(session);
    const filename = getExportFilename(session, 'csv');
    downloadFile(csvContent, filename, 'text/csv;charset=utf-8;');
    setStatusMessage({ text: `CSV táblázat letöltve: ${filename}`, type: 'success' });
  };

  // Copy summary to clipboard for quick SMS / Viber text message
  const handleCopySummary = async () => {
    const text = generateSummaryText(session);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
      setStatusMessage({ text: 'Szöveges összefoglaló a vágólapra másolva!', type: 'success' });
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
      setStatusMessage({ text: 'Szöveges összefoglaló a vágólapra másolva!', type: 'success' });
    }
  };

  // Native browser print dialog
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-stone-900/70 backdrop-blur-xs no-print overflow-y-auto">
      <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-stone-200 overflow-hidden my-4 max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 bg-emerald-950 text-white shrink-0">
          <div className="min-w-0 pr-3">
            <h2 className="text-base sm:text-lg font-bold truncate">Köbözési Jegyzőkönyv Exportálása</h2>
            <p className="text-xs text-emerald-300 truncate">
              {session.forestryAssociation || 'Erdőbirtokosság'} · {session.depotCode || 'Lerakó'} · {session.treeSpecies} ({formatLength(session.logLength)} m)
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-emerald-300 hover:text-white rounded-lg transition-colors cursor-pointer shrink-0"
            aria-label="Bezárás"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-5">
          {/* Status Message Toast / Banner */}
          {statusMessage && (
            <div
              className={`p-3 rounded-xl border text-xs font-semibold flex items-center justify-between transition-all ${
                statusMessage.type === 'success'
                  ? 'bg-emerald-50 text-emerald-900 border-emerald-300'
                  : statusMessage.type === 'error'
                  ? 'bg-red-50 text-red-900 border-red-300'
                  : 'bg-blue-50 text-blue-900 border-blue-300'
              }`}
            >
              <div className="flex items-center gap-2">
                {isProcessing ? (
                  <Loader2 className="w-4 h-4 animate-spin text-emerald-700 shrink-0" />
                ) : statusMessage.type === 'success' ? (
                  <Check className="w-4 h-4 text-emerald-700 shrink-0" />
                ) : (
                  <Sparkles className="w-4 h-4 text-blue-600 shrink-0" />
                )}
                <span>{statusMessage.text}</span>
              </div>
              <button
                onClick={() => setStatusMessage(null)}
                className="text-stone-400 hover:text-stone-700 p-1 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Quick Metrics Bar */}
          <div className="p-3.5 bg-stone-50 rounded-xl border border-stone-200 text-xs text-stone-700 flex justify-between items-center">
            <div>
              <span className="font-bold text-stone-900 block text-sm">
                {session.treeSpecies.toUpperCase()} · {formatLength(session.logLength)} méteres rönk
              </span>
              <span className="text-stone-500">
                Rögzített rönkök száma: <strong className="text-stone-800">{totals.totalCount} db</strong> ({totals.diameterStats.length} átmérőcsoport)
              </span>
            </div>
            <div className="text-right">
              <span className="text-[11px] text-stone-500 uppercase tracking-wider block">Összes fatérfogat</span>
              <span className="text-xl font-black text-emerald-800 tabular-numbers">
                {formatVolume(totals.totalVolume)} m³
              </span>
            </div>
          </div>

          {/* FORMAT SELECTOR: PDF or JPG */}
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-stone-500 block mb-2">
              Válasszon export formátumot:
            </label>
            <div className="grid grid-cols-2 gap-3">
              {/* Option 1: PDF */}
              <button
                type="button"
                onClick={() => setSelectedFormat('pdf')}
                className={`p-4 rounded-xl border-2 text-left transition-all cursor-pointer flex flex-col justify-between ${
                  selectedFormat === 'pdf'
                    ? 'border-emerald-600 bg-emerald-50/70 shadow-sm ring-1 ring-emerald-600'
                    : 'border-stone-200 hover:border-stone-300 hover:bg-stone-50'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                    selectedFormat === 'pdf' ? 'bg-emerald-600 text-white' : 'bg-stone-100 text-stone-600'
                  }`}>
                    <FileText className="w-5 h-5" />
                  </div>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                    selectedFormat === 'pdf' ? 'bg-emerald-200 text-emerald-900' : 'bg-stone-100 text-stone-600'
                  }`}>
                    .PDF
                  </span>
                </div>
                <div>
                  <h4 className="text-sm font-bold text-stone-900">PDF Dokumentum</h4>
                  <p className="text-[11px] text-stone-500 mt-0.5 leading-snug">
                    Hivatalos formátumú nyomtatható és archiválható A4-es jegyzőkönyv aláírási rovattal.
                  </p>
                </div>
              </button>

              {/* Option 2: JPG */}
              <button
                type="button"
                onClick={() => setSelectedFormat('jpg')}
                className={`p-4 rounded-xl border-2 text-left transition-all cursor-pointer flex flex-col justify-between ${
                  selectedFormat === 'jpg'
                    ? 'border-emerald-600 bg-emerald-50/70 shadow-sm ring-1 ring-emerald-600'
                    : 'border-stone-200 hover:border-stone-300 hover:bg-stone-50'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                    selectedFormat === 'jpg' ? 'bg-emerald-600 text-white' : 'bg-stone-100 text-stone-600'
                  }`}>
                    <ImageIcon className="w-5 h-5" />
                  </div>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                    selectedFormat === 'jpg' ? 'bg-emerald-200 text-emerald-900' : 'bg-stone-100 text-stone-600'
                  }`}>
                    .JPG
                  </span>
                </div>
                <div>
                  <h4 className="text-sm font-bold text-stone-900">JPG Képformátum</h4>
                  <p className="text-[11px] text-stone-500 mt-0.5 leading-snug">
                    Nagyfelbontású képfájl azonnali Viber, WhatsApp vagy Messenger üzenetben történő küldéshez.
                  </p>
                </div>
              </button>
            </div>
          </div>

          {/* PRIMARY ACTIONS: Megosztás & Letöltés */}
          <div className="space-y-3 pt-1">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Megosztás gomb (Viber, Drive, E-mail stb.) */}
              <button
                type="button"
                onClick={handleShare}
                disabled={isProcessing}
                className="w-full py-3.5 px-4 bg-emerald-600 hover:bg-emerald-500 active:scale-98 text-white font-bold text-sm rounded-xl shadow-md shadow-emerald-900/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-wait"
              >
                {isProcessing && processingAction === 'share' ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Megosztás előkészítése...</span>
                  </>
                ) : (
                  <>
                    <Share2 className="w-5 h-5 shrink-0 stroke-[2.2]" />
                    <span>Megosztás ({selectedFormat.toUpperCase()})</span>
                  </>
                )}
              </button>

              {/* Letöltés gomb */}
              <button
                type="button"
                onClick={handleDownloadFile}
                disabled={isProcessing}
                className="w-full py-3.5 px-4 bg-stone-100 hover:bg-stone-200 active:scale-98 text-stone-800 border border-stone-300 font-bold text-sm rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-wait"
              >
                {isProcessing && processingAction === 'download' ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Letöltés folyamatban...</span>
                  </>
                ) : (
                  <>
                    <Download className="w-5 h-5 shrink-0 text-emerald-700" />
                    <span>Letöltés ({selectedFormat.toUpperCase()})</span>
                  </>
                )}
              </button>
            </div>

            {/* Supported platforms helper info */}
            <div className="px-3 py-2 bg-stone-50 rounded-lg border border-stone-200/80 text-[11px] text-stone-600 flex items-center justify-between flex-wrap gap-1.5">
              <span className="font-semibold text-stone-700">Támogatott megosztási módok:</span>
              <div className="flex items-center gap-1.5 font-medium text-stone-600">
                <span className="bg-purple-100 text-purple-800 px-1.5 py-0.5 rounded-sm font-semibold">Viber</span>
                <span>·</span>
                <span className="bg-amber-100 text-amber-900 px-1.5 py-0.5 rounded-sm font-semibold">Google Drive</span>
                <span>·</span>
                <span className="bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded-sm font-semibold">WhatsApp</span>
                <span>·</span>
                <span className="bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded-sm font-semibold">Gmail</span>
              </div>
            </div>
          </div>

          {/* DOCUMENT PREVIEW (Miniatűr betekintő) */}
          <div className="border border-stone-200 rounded-xl overflow-hidden bg-stone-50">
            <div className="px-4 py-2.5 bg-stone-100 border-b border-stone-200 flex items-center justify-between text-xs">
              <span className="font-bold text-stone-800 flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-emerald-700" />
                Jegyzőkönyv Betekintő
              </span>
              <span className="text-[11px] text-stone-500">
                {selectedFormat === 'pdf' ? 'A4 formátumú előnézet' : 'Nagyfelbontású kép előnézet'}
              </span>
            </div>
            
            {/* Live scaled preview container */}
            <div className="p-3 max-h-56 overflow-y-auto bg-stone-200/60 flex justify-center">
              <div className="bg-white shadow-md border border-stone-300 rounded-md p-4 w-full text-[10px] text-stone-800 space-y-2.5 max-w-lg">
                <div className="border-b border-stone-800 pb-2 flex justify-between items-start">
                  <div>
                    <h5 className="font-bold uppercase tracking-wide text-stone-900 text-[11px]">
                      Erdészeti Köbözési és Faátlalási Jegyzőkönyv
                    </h5>
                    <p className="text-[9px] text-stone-500">
                      A számítás a hivatalos statisztikai adatok alapján történik
                    </p>
                  </div>
                  <span className="text-[9px] font-mono text-stone-500">{session.id}</span>
                </div>

                <div className="grid grid-cols-2 gap-2 bg-stone-50 p-2 rounded border border-stone-200">
                  <div>
                    <span className="text-stone-400 block text-[9px]">Erdőbirtokosság:</span>
                    <strong className="block text-stone-900 truncate">{session.forestryAssociation || '-'}</strong>
                    <span className="text-stone-400 block text-[9px] mt-1">Lerakóhely:</span>
                    <strong className="block text-stone-900 truncate">{session.depotCode || '-'}</strong>
                  </div>
                  <div>
                    <span className="text-stone-400 block text-[9px]">Fafajta és hossz:</span>
                    <strong className="block text-emerald-900">{session.treeSpecies} ({formatLength(session.logLength)} m)</strong>
                    <span className="text-stone-400 block text-[9px] mt-1">Rögzítés ideje:</span>
                    <span className="text-stone-700 block">{new Date(session.updatedAt).toLocaleDateString('hu-HU')}</span>
                  </div>
                </div>

                <div className="bg-emerald-950 text-white p-2 rounded flex justify-between items-center text-center">
                  <div>
                    <span className="text-[8px] uppercase text-emerald-300 block">Darabszám</span>
                    <strong className="text-xs text-white">{totals.totalCount} db</strong>
                  </div>
                  <div>
                    <span className="text-[8px] uppercase text-emerald-300 block">Összes köbméter</span>
                    <strong className="text-xs text-emerald-300">{formatVolume(totals.totalVolume)} m³</strong>
                  </div>
                  <div>
                    <span className="text-[8px] uppercase text-emerald-300 block">Átlagátmérő</span>
                    <strong className="text-xs text-white">{totals.avgDiameter} cm</strong>
                  </div>
                  <div>
                    <span className="text-[8px] uppercase text-emerald-300 block">Mérettartomány</span>
                    <strong className="text-xs text-white">{totals.minDiameter}–{totals.maxDiameter} cm</strong>
                  </div>
                </div>

                {/* Condensed breakdown table */}
                <div className="border border-stone-200 rounded overflow-hidden">
                  <table className="w-full text-[9px]">
                    <thead className="bg-stone-100 font-bold border-b border-stone-200">
                      <tr>
                        <th className="p-1 text-left">Átmérő</th>
                        <th className="p-1 text-right">Darab</th>
                        <th className="p-1 text-right">Térfogat (m³)</th>
                        <th className="p-1 text-right">Arány</th>
                      </tr>
                    </thead>
                    <tbody>
                      {totals.diameterStats.slice(0, 5).map((stat) => (
                        <tr key={stat.diameter} className="border-b border-stone-100">
                          <td className="p-1 font-semibold">{stat.diameter} cm</td>
                          <td className="p-1 text-right">{stat.count} db</td>
                          <td className="p-1 text-right font-medium">{formatVolume(stat.totalVolume)} m³</td>
                          <td className="p-1 text-right text-stone-500">{stat.percentageVolume} %</td>
                        </tr>
                      ))}
                      {totals.diameterStats.length > 5 && (
                        <tr>
                          <td colSpan={4} className="p-1 text-center text-stone-400 italic text-[8px]">
                            ... és további {totals.diameterStats.length - 5} méretosztály a teljes jegyzőkönyvben
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="pt-2 border-t border-stone-200 flex justify-between text-[8px] text-stone-500">
                  <span>Aláírás: ________________ (Átadó)</span>
                  <span>Aláírás: ________________ (Fuvarozó)</span>
                </div>
              </div>
            </div>
          </div>

          {/* MORE EXPORT OPTIONS (CSV, Copy Text, Print) */}
          <div className="border-t border-stone-200 pt-3">
            <button
              type="button"
              onClick={() => setShowMoreOptions(!showMoreOptions)}
              className="w-full flex items-center justify-between text-xs font-bold text-stone-600 hover:text-stone-900 py-1 cursor-pointer"
            >
              <span>További exportálási lehetőségek (Excel táblázat, Szöveg másolása)</span>
              {showMoreOptions ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>

            {showMoreOptions && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-3">
                {/* 1. CSV Download (Excel) */}
                <button
                  type="button"
                  onClick={handleDownloadCsv}
                  className="p-3 rounded-xl border border-stone-200 hover:border-emerald-600 hover:bg-emerald-50/50 flex flex-col justify-between transition text-left cursor-pointer group"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <FileSpreadsheet className="w-4 h-4 text-emerald-700" />
                    <span className="text-xs font-bold text-stone-900 group-hover:text-emerald-950">
                      Excel / CSV
                    </span>
                  </div>
                  <span className="text-[10px] text-stone-500">
                    Táblázat UTF-8 kódolással
                  </span>
                </button>

                {/* 2. Copy Text Summary */}
                <button
                  type="button"
                  onClick={handleCopySummary}
                  className="p-3 rounded-xl border border-stone-200 hover:border-emerald-600 hover:bg-emerald-50/50 flex flex-col justify-between transition text-left cursor-pointer group"
                >
                  <div className="flex items-center gap-2 mb-1">
                    {copied ? <Check className="w-4 h-4 text-emerald-700" /> : <Copy className="w-4 h-4 text-stone-700" />}
                    <span className="text-xs font-bold text-stone-900 group-hover:text-emerald-950">
                      {copied ? 'Kimásolva!' : 'Szöveg másolása'}
                    </span>
                  </div>
                  <span className="text-[10px] text-stone-500">
                    Gyors Viber / SMS szöveghez
                  </span>
                </button>

                {/* 3. Native Print */}
                <button
                  type="button"
                  onClick={handlePrint}
                  className="p-3 rounded-xl border border-stone-200 hover:border-emerald-600 hover:bg-emerald-50/50 flex flex-col justify-between transition text-left cursor-pointer group"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Printer className="w-4 h-4 text-stone-700" />
                    <span className="text-xs font-bold text-stone-900 group-hover:text-emerald-950">
                      Nyomtatás
                    </span>
                  </div>
                  <span className="text-[10px] text-stone-500">
                    Közvetlenül nyomtatóra küldés
                  </span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-stone-50 border-t border-stone-200 flex justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 text-sm font-semibold text-stone-700 hover:bg-stone-200 rounded-xl transition cursor-pointer"
          >
            Bezárás
          </button>
        </div>
      </div>
    </div>
  );
};
