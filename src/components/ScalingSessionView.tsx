import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { ScalingSession, LogEntry, LogQuality } from '../types';
import { calculateLogVolume, calculateLogVolumeLiters, calculateSessionTotals, formatVolume, formatHungarianDate, formatLength } from '../utils/forestryCalculations';
import { playSuccessSound, playDeleteSound } from '../utils/soundFeedback';
import { useVoiceScalingControl } from '../hooks/useVoiceScalingControl';
import { 
  ArrowLeft, 
  Download, 
  RotateCcw, 
  Volume2, 
  VolumeX, 
  Trash2, 
  TreePine, 
  Ruler, 
  MapPin, 
  Edit2,
  Table,
  ListOrdered,
  Zap,
  CheckCircle2,
  Share2,
  Mic,
  MicOff,
  AlertCircle,
  RefreshCw
} from 'lucide-react';

interface ScalingSessionViewProps {
  session: ScalingSession;
  onBack: () => void;
  onUpdateSession: (updatedSession: ScalingSession) => void;
  onEditMetadata: () => void;
  onExport: () => void;
}

const QUALITY_OPTIONS: { value: LogQuality; label: string }[] = [
  { value: 'fűrészrönk', label: 'Fűrészrönk' },
  { value: 'I', label: 'I. osztály' },
  { value: 'II', label: 'II. osztály' },
  { value: 'III', label: 'III. osztály' },
  { value: 'kivágás', label: 'Kivágás' },
  { value: 'raklapfa', label: 'Raklapfa' },
  { value: 'rostfa', label: 'Rostfa' },
];

export const ScalingSessionView: React.FC<ScalingSessionViewProps> = ({
  session,
  onBack,
  onUpdateSession,
  onEditMetadata,
  onExport,
}) => {
  const [pieceMultiplier, setPieceMultiplier] = useState<number>(1);
  const [selectedQuality, setSelectedQuality] = useState<LogQuality>('fűrészrönk');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [activeTab, setActiveTab] = useState<'tally' | 'list'>('tally');
  const [orderMode, setOrderMode] = useState<'row' | 'col'>('row');
  const [searchTerm, setSearchTerm] = useState('');
  const [lastActionMessage, setLastActionMessage] = useState<{ text: string; type: 'add' | 'undo' } | null>(null);

  const totals = useMemo(() => calculateSessionTotals(session), [session]);

  // Create count map per diameter for fast badge lookup on buttons
  const countsByDiameter = useMemo(() => {
    const map = new Map<number, number>();
    for (const log of session.logs) {
      const current = map.get(log.diameter) || 0;
      map.set(log.diameter, current + (log.pieceCount || 1));
    }
    return map;
  }, [session.logs]);

  // Generate all diameters from 12 to 100 cm (89 items)
  // In 4 columns and 22 rows: 12..99 fill the 22 rows (88 buttons), and 100 cm is in the 23rd row
  const diameters = useMemo(() => {
    const list: number[] = [];
    for (let d = 12; d <= 100; d++) {
      list.push(d);
    }
    return list;
  }, []);

  // Ordered list if user prefers column-first layout (Col 1: 12-33, Col 2: 34-55, Col 3: 56-77, Col 4: 78-99, then 100)
  const displayDiameters = useMemo(() => {
    if (orderMode === 'row') {
      return diameters;
    }
    // Column-wise distribution across 22 rows & 4 columns
    // 22 items per column for 12..99:
    // col 0: 12..33, col 1: 34..55, col 2: 56..77, col 3: 78..99
    const colOrdered: number[] = [];
    const rows = 22;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < 4; c++) {
        const val = 12 + c * rows + r;
        if (val <= 99) {
          colOrdered.push(val);
        }
      }
    }
    // Add 100 at the end
    colOrdered.push(100);
    return colOrdered;
  }, [diameters, orderMode]);

  // Last added log for undo preview
  const lastLog = session.logs.length > 0 ? session.logs[0] : null;

  const [voiceActiveDiameter, setVoiceActiveDiameter] = useState<number | null>(null);

  // Ref to voiceControl.speakVolume to allow handleQuickLog to invoke voice feedback without circular dependencies
  const speakVolumeRef = useRef<(liters: number) => void>(() => {});

  // QUICK RECORD: Triggered immediately when any diameter button is pressed
  const handleQuickLog = useCallback((diameter: number, fromVoice = false) => {
    const unitVol = calculateLogVolume(diameter, session.logLength, session.treeSpecies);
    const unitLiters = calculateLogVolumeLiters(diameter, session.logLength, session.treeSpecies);
    const newEntry: LogEntry = {
      id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      diameter,
      volume: unitVol,
      pieceCount: pieceMultiplier,
      quality: selectedQuality,
      timestamp: Date.now()
    };

    const updatedLogs = [newEntry, ...session.logs];
    onUpdateSession({
      ...session,
      logs: updatedLogs,
      updatedAt: Date.now()
    });

    // Ha a felhasználó a gombon kattint/érint és a hangjelzés aktív,
    // a hangalapú feedback tárgya a rönkhöz tartozó statisztikai űrmérték adat literben kifejezve
    if (!fromVoice && soundEnabled) {
      speakVolumeRef.current(unitLiters);
    }

    const totalAddedVol = (unitVol * pieceMultiplier).toFixed(3);
    setLastActionMessage({
      text: `+ ${diameter} cm (${pieceMultiplier} db · ${unitLiters} l · ${totalAddedVol} m³) rögzítve`,
      type: 'add'
    });

    // Reset multiplier to 1 after entry if multi was selected
    if (pieceMultiplier > 1) {
      setPieceMultiplier(1);
    }
  }, [session, pieceMultiplier, selectedQuality, onUpdateSession, soundEnabled]);

  // VOICE CONTROL: When a valid diameter (12-100 cm) is recognized via voice
  const handleVoiceRecognized = useCallback((diameter: number) => {
    // 1. Highlight the button visually
    setVoiceActiveDiameter(diameter);
    setTimeout(() => {
      setVoiceActiveDiameter((curr) => (curr === diameter ? null : curr));
    }, 1100);

    // 2. Smoothly scroll button into view on small screens
    const btnEl = document.getElementById(`diam-btn-${diameter}`);
    if (btnEl) {
      btnEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    // 3. Trigger quick log entry (increments counter) - fromVoice=true prevents double speaking
    handleQuickLog(diameter, true);
  }, [handleQuickLog]);

  // Provide statistical volume in liters to voice control for speech readout
  const getDiameterVolumeLiters = useCallback(
    (diameter: number) => {
      return calculateLogVolumeLiters(diameter, session.logLength, session.treeSpecies);
    },
    [session.logLength, session.treeSpecies]
  );

  const voiceControl = useVoiceScalingControl({
    onDiameterRecognized: handleVoiceRecognized,
    getDiameterVolumeLiters,
    enabled: true
  });

  useEffect(() => {
    speakVolumeRef.current = voiceControl.speakVolume;
  }, [voiceControl.speakVolume]);

  // UNDO LAST LOG: "Utolsó visszavonása"
  const handleUndoLast = () => {
    if (session.logs.length === 0) return;
    const removedLog = session.logs[0];
    const updatedLogs = session.logs.slice(1);
    
    onUpdateSession({
      ...session,
      logs: updatedLogs,
      updatedAt: Date.now()
    });

    if (soundEnabled) {
      playDeleteSound();
    }

    setLastActionMessage({
      text: `Visszavonva: ${removedLog.diameter} cm (${removedLog.pieceCount || 1} db)`,
      type: 'undo'
    });
  };

  // Delete individual log from table
  const handleDeleteLog = (id: string) => {
    const logToDelete = session.logs.find(l => l.id === id);
    const updatedLogs = session.logs.filter((l) => l.id !== id);
    onUpdateSession({
      ...session,
      logs: updatedLogs,
      updatedAt: Date.now()
    });
    if (soundEnabled) {
      playDeleteSound();
    }
    if (logToDelete) {
      setLastActionMessage({
        text: `Törölve: ${logToDelete.diameter} cm rönk`,
        type: 'undo'
      });
    }
  };

  // Filtered logs for detailed list
  const filteredLogs = useMemo(() => {
    if (!searchTerm) return session.logs;
    const term = searchTerm.toLowerCase();
    return session.logs.filter(
      (log) =>
        log.diameter.toString().includes(term) ||
        log.quality.toLowerCase().includes(term)
    );
  }, [session.logs, searchTerm]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Top Session Breadcrumb Bar */}
      <div className="bg-white rounded-2xl border border-stone-200 p-4 sm:p-5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start sm:items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 sm:px-3 sm:py-2 text-stone-600 hover:text-stone-900 hover:bg-stone-100 rounded-xl transition flex items-center gap-1.5 cursor-pointer shrink-0 font-medium text-sm min-h-[44px]"
            aria-label="Vissza a főoldalra"
          >
            <ArrowLeft className="w-5 h-5 text-stone-500" />
            <span className="hidden sm:inline">Vissza</span>
          </button>

          <div className="border-l border-stone-200 pl-3">
            <div className="flex items-center gap-2 text-xs text-stone-500">
              <span>Erdészeti Köbözés</span>
              <span aria-hidden="true">·</span>
              <span>{formatHungarianDate(session.updatedAt)}</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-stone-900 tracking-tight flex items-center gap-2">
              <span>{session.forestryAssociation}</span>
            </h1>
          </div>
        </div>

        {/* Action buttons: Voice Control (Mikrofon), Sound, Edit & Export */}
        <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
          {/* HANGVEZÉRLÉS (Mikrofon) Ki-Be kapcsoló gomb */}
          <button
            onClick={voiceControl.toggleListening}
            title={
              voiceControl.isListening
                ? 'Hangvezérlés KIKAPCSOLÁSA (Mikrofon aktív)'
                : 'Hangvezérlés BEKAPCSOLÁSA (Beszéljen átmérőt: 12-100 cm)'
            }
            className={`p-2.5 sm:px-3 sm:py-2 rounded-xl border transition-all cursor-pointer min-h-[44px] flex items-center justify-center gap-1.5 font-bold text-xs ${
              voiceControl.isListening
                ? 'bg-rose-600 hover:bg-rose-700 border-rose-700 text-white shadow-md ring-2 ring-rose-400 animate-pulse'
                : 'bg-stone-50 hover:bg-stone-100 border-stone-200 text-stone-700'
            }`}
            aria-label="Hangvezérlés ki-be kapcsolása"
          >
            {voiceControl.isListening ? (
              <>
                <Mic className="w-4 h-4 text-white animate-bounce" />
                <span className="hidden sm:inline font-bold">Figyelés...</span>
              </>
            ) : (
              <>
                <Mic className="w-4 h-4 text-stone-600" />
                <span className="hidden sm:inline font-medium">Hangvezérlés</span>
              </>
            )}
          </button>

          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            title={soundEnabled ? 'Hangjelzés bekapcsolva' : 'Hangjelzés kikapcsolva'}
            className={`p-2.5 rounded-xl border transition cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center ${
              soundEnabled
                ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                : 'bg-stone-50 border-stone-200 text-stone-400'
            }`}
          >
            {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>

          <button
            onClick={onEditMetadata}
            className="px-3.5 py-2 text-xs font-semibold text-stone-700 bg-stone-100 hover:bg-stone-200 rounded-xl transition flex items-center gap-1.5 cursor-pointer min-h-[44px]"
          >
            <Edit2 className="w-3.5 h-3.5" />
            <span>Adatok</span>
          </button>

          <button
            onClick={onExport}
            className="px-4 py-2 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-xl shadow-sm transition flex items-center gap-1.5 cursor-pointer min-h-[44px]"
            title="Jegyzőkönyv exportálása (PDF / JPG) és megosztása (Viber, Drive stb.)"
          >
            <Share2 className="w-4 h-4" />
            <span>Export & Megosztás</span>
          </button>
        </div>
      </div>

      {/* Voice Control Active Status Strip */}
      {voiceControl.isListening && (
        <div className="bg-rose-50 border-2 border-rose-300 rounded-2xl p-4 shadow-sm flex flex-col gap-3 text-stone-800 animate-fadeIn">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="relative flex items-center justify-center w-11 h-11 rounded-full bg-rose-600 text-white shrink-0 shadow-sm">
                <Mic className="w-5 h-5 animate-pulse" />
                <span className="absolute -top-0.5 -right-0.5 flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-500"></span>
                </span>
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-rose-950 text-sm">
                    Hangvezérlés aktív (Magyar beszéd)
                  </span>
                  <span className="text-[10px] bg-rose-200 text-rose-900 font-bold px-2 py-0.5 rounded-full uppercase">
                    12 – 100 cm
                  </span>

                  {/* Live Speech & Sound Activity Visualizer */}
                  <div
                    className={`flex items-end gap-1 h-5 px-2 py-0.5 rounded-md border transition-colors ${
                      voiceControl.isHearingSpeech 
                        ? 'bg-emerald-100 border-emerald-300' 
                        : voiceControl.isHearingSound 
                          ? 'bg-amber-100 border-amber-300' 
                          : 'bg-rose-100/90 border-rose-200'
                    }`}
                    title={
                      voiceControl.isHearingSpeech 
                        ? 'Beszéd észlelve' 
                        : voiceControl.isHearingSound 
                          ? 'Hang észlelve' 
                          : 'Mikrofon figyel'
                    }
                  >
                    <span className="text-[10px] font-mono text-rose-900 mr-1">
                      {voiceControl.isHearingSpeech ? 'Beszéd:' : 'Mic:'}
                    </span>
                    {[1, 2, 3, 4, 5].map((idx) => {
                      const isHigh = voiceControl.isHearingSpeech;
                      const isMed = voiceControl.isHearingSound;
                      const heights = isHigh 
                        ? [14, 18, 12, 16, 10] 
                        : isMed 
                          ? [8, 10, 6, 9, 7] 
                          : [4, 5, 4, 6, 4];
                      return (
                        <span
                          key={idx}
                          className={`w-1 rounded-full transition-all duration-150 ${
                            isHigh 
                              ? 'bg-emerald-600 animate-pulse' 
                              : isMed 
                                ? 'bg-amber-500' 
                                : 'bg-rose-400'
                          }`}
                          style={{ height: `${heights[idx - 1]}px` }}
                        />
                      );
                    })}
                  </div>

                  {voiceControl.isSpeaking && (
                    <span className="text-[11px] bg-emerald-100 text-emerald-800 font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1 shadow-2xs">
                      <Volume2 className="w-3.5 h-3.5 animate-pulse text-emerald-700" />
                      Visszamondás...
                    </span>
                  )}
                </div>

                <p className="text-xs text-rose-850 mt-1">
                  Mondja be a rönk átmérőjét (pl. <em>„harminckettő”</em>, <em>„ötven”</em>, <em>„száz”</em>). A rendszer visszamondja a statisztikai űrmértéket literben, egy rövid rezgéssel nyugtázza és rögzíti a tételt.
                </p>

                {/* Real-time status text */}
                <div className="text-xs text-rose-900 mt-1 flex items-center gap-1.5 font-medium flex-wrap">
                  <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
                  <span>{voiceControl.statusText}</span>
                  {voiceControl.statusText.includes('indítása') && (
                    <button
                      type="button"
                      onClick={voiceControl.startListening}
                      className="ml-1 inline-flex items-center gap-1 text-[11px] font-bold text-rose-700 hover:text-rose-900 underline cursor-pointer"
                    >
                      <RefreshCw className="w-3 h-3" />
                      Újrapróbálás
                    </button>
                  )}
                </div>

                {/* Live Heard Transcript Feed */}
                {voiceControl.lastTranscript && (
                  <div className="mt-1.5 flex items-center gap-1.5 flex-wrap text-xs">
                    <span className="text-rose-900 font-semibold">Hallott beszéd:</span>
                    <span className="font-mono bg-white border border-rose-300 text-rose-950 px-2 py-0.5 rounded-md font-bold shadow-2xs">
                      „{voiceControl.lastTranscript}”
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
              {voiceControl.lastRecognizedDiameter && (
                <div className="bg-white border border-emerald-400 px-3 py-1.5 rounded-xl shadow-2xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span className="text-xs text-stone-600 font-medium">Utolsó:</span>
                  <div className="flex items-baseline gap-1.5">
                    <strong className="text-base font-black text-emerald-800 tabular-numbers">
                      {voiceControl.lastRecognizedDiameter} cm
                    </strong>
                    {voiceControl.lastRecognizedLiters && (
                      <span className="text-xs font-bold text-emerald-600 tabular-numbers">
                        ({voiceControl.lastRecognizedLiters} l)
                      </span>
                    )}
                  </div>
                </div>
              )}
              <button
                type="button"
                onClick={voiceControl.startListening}
                className="px-3 py-2 text-xs font-semibold bg-white hover:bg-rose-100 border border-rose-300 text-rose-950 rounded-xl transition cursor-pointer flex items-center gap-1.5 shadow-2xs active:scale-95"
                title="Hangfelismerés mikrofon újraindítása"
              >
                <RefreshCw className="w-3.5 h-3.5 text-rose-700" />
                <span>Újraindítás</span>
              </button>
              <button
                type="button"
                onClick={voiceControl.stopListening}
                className="px-3.5 py-2 text-xs font-semibold bg-rose-200 hover:bg-rose-300 text-rose-950 rounded-xl transition cursor-pointer"
              >
                Kikapcsolás
              </button>
            </div>
          </div>

          {/* Diagnostic quick simulation buttons */}
          <div className="mt-1 pt-2.5 border-t border-rose-200/90 flex items-center gap-2 flex-wrap text-[11px] text-stone-600">
            <span className="font-semibold text-rose-950">Azonnali tesztgombok (hang, rezgés & számláló próba):</span>
            <button
              type="button"
              onClick={() => voiceControl.simulateVoiceInput('harmincöt')}
              className="px-2.5 py-1 bg-white hover:bg-stone-100 border border-stone-300 rounded-lg text-stone-850 font-medium shadow-2xs cursor-pointer transition active:scale-95"
            >
              „harmincöt” (35 cm)
            </button>
            <button
              type="button"
              onClick={() => voiceControl.simulateVoiceInput('ötvenkettő')}
              className="px-2.5 py-1 bg-white hover:bg-stone-100 border border-stone-300 rounded-lg text-stone-850 font-medium shadow-2xs cursor-pointer transition active:scale-95"
            >
              „ötvenkettő” (52 cm)
            </button>
            <button
              type="button"
              onClick={() => voiceControl.simulateVoiceInput('száz')}
              className="px-2.5 py-1 bg-white hover:bg-stone-100 border border-stone-300 rounded-lg text-stone-850 font-medium shadow-2xs cursor-pointer transition active:scale-95"
            >
              „száz” (100 cm)
            </button>
            <button
              type="button"
              onClick={() => voiceControl.simulateVoiceInput('nyolc')}
              className="px-2.5 py-1 bg-rose-100 hover:bg-rose-200 border border-rose-300 text-rose-900 font-medium shadow-2xs cursor-pointer transition active:scale-95"
              title="Nem engedélyezett átmérő (<12) tesztelése: két hosszú rezgés kiváltása"
            >
              „nyolc” (2x rezgés hiba)
            </button>
          </div>
        </div>
      )}

      {/* Voice Error Notice */}
      {voiceControl.lastError && (
        <div className="bg-amber-50 border-2 border-amber-300 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-amber-950 shadow-2xs">
          <div className="flex items-start sm:items-center gap-2.5">
            <AlertCircle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5 sm:mt-0" />
            <div>
              <span className="font-bold block text-sm text-amber-950">{voiceControl.lastError}</span>
              <span className="text-[11px] text-amber-850 block mt-0.5">
                Kérjük, engedélyezze a mikrofont a böngésző címsorában (lakat vagy mikrofon ikon). Ha beágyazott előnézetet használ, nyissa meg közvetlen új lapon a teljes mikrofon-hozzáféréshez!
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
            {typeof window !== 'undefined' && window.self !== window.top && (
              <a
                href={window.location.href}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1.5 bg-white hover:bg-stone-50 border border-amber-300 text-stone-850 font-bold rounded-lg transition text-xs shadow-2xs"
              >
                Megnyitás új lapon
              </a>
            )}
            <button
              type="button"
              onClick={voiceControl.startListening}
              className="px-3 py-1.5 bg-amber-200 hover:bg-amber-300 text-amber-950 font-bold rounded-lg transition shrink-0 cursor-pointer flex items-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Újraindítás</span>
            </button>
          </div>
        </div>
      )}

      {/* Lot metadata strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-stone-100/80 p-3.5 rounded-xl text-xs text-stone-700 border border-stone-200">
        <div className="flex items-center gap-2">
          <MapPin className="w-4 h-4 text-emerald-700 shrink-0" />
          <div>
            <span className="text-[10px] text-stone-400 uppercase tracking-wider block">Lerakóhely:</span>
            <span className="font-semibold text-stone-900 truncate block">{session.depotCode}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <TreePine className="w-4 h-4 text-emerald-700 shrink-0" />
          <div>
            <span className="text-[10px] text-stone-400 uppercase tracking-wider block">Fafaj:</span>
            <span className="font-semibold text-stone-900 truncate block capitalize">{session.treeSpecies}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Ruler className="w-4 h-4 text-emerald-700 shrink-0" />
          <div>
            <span className="text-[10px] text-stone-400 uppercase tracking-wider block">Rönkhossz:</span>
            <span className="font-semibold text-stone-900 tabular-numbers">{formatLength(session.logLength)} m</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-full bg-emerald-200 text-emerald-800 flex items-center justify-center font-bold text-[10px]">
            S
          </div>
          <div>
            <span className="text-[10px] text-stone-400 uppercase tracking-wider block">Számítás:</span>
            <span className="font-semibold text-stone-900">Hivatalos statisztika (m³)</span>
          </div>
        </div>
      </div>

      {/* Main KPI Bar with Sticky Undo capability */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Total volume */}
        <div className="bg-emerald-950 text-white rounded-2xl p-5 shadow-sm border border-emerald-900">
          <span className="text-xs font-medium text-emerald-300">Összes térfogat</span>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-3xl sm:text-4xl font-extrabold tabular-numbers tracking-tight text-white">
              {formatVolume(totals.totalVolume)}
            </span>
            <span className="text-sm font-bold text-emerald-400">m³</span>
          </div>
          <span className="mt-1 block text-[11px] text-emerald-400/80">
            {totals.totalCount > 0
              ? `Átlag: ${formatVolume(totals.totalVolume / totals.totalCount)} m³/rönk`
              : 'Még nincs rögzített rönk'}
          </span>
        </div>

        {/* Piece count */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-stone-200">
          <span className="text-xs font-medium text-stone-500">Rönkök száma</span>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-3xl sm:text-4xl font-extrabold tabular-numbers text-stone-900 tracking-tight">
              {totals.totalCount}
            </span>
            <span className="text-sm font-semibold text-stone-500">db</span>
          </div>
          <span className="mt-1 block text-[11px] text-stone-400">
            {session.logs.length} bejegyzés
          </span>
        </div>

        {/* Average diameter */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-stone-200">
          <span className="text-xs font-medium text-stone-500">Átlagos átmérő</span>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-3xl sm:text-4xl font-extrabold tabular-numbers text-stone-900 tracking-tight">
              {totals.avgDiameter}
            </span>
            <span className="text-sm font-semibold text-stone-500">cm</span>
          </div>
          <span className="mt-1 block text-[11px] text-stone-400">
            Súlyozott középátmérő
          </span>
        </div>

        {/* Min / Max diameter range */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-stone-200">
          <span className="text-xs font-medium text-stone-500">Mérettartomány</span>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-2xl sm:text-3xl font-bold tabular-numbers text-stone-900 tracking-tight">
              {totals.minDiameter} – {totals.maxDiameter}
            </span>
            <span className="text-xs font-semibold text-stone-500">cm</span>
          </div>
          <span className="mt-1 block text-[11px] text-stone-400">
            {totals.diameterStats.length} különböző átmérő
          </span>
        </div>
      </div>

      {/* QUICK LOGGING PANEL: 4 columns x 22 rows (12 cm - 100 cm) */}
      <div className="bg-white rounded-2xl border-2 border-emerald-600/30 shadow-md p-4 sm:p-6 space-y-4">
        {/* Panel Header & Options */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-stone-200">
          <div>
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-emerald-600 text-white flex items-center justify-center">
                <Zap className="w-4 h-4 fill-white" />
              </div>
              <h2 className="text-base sm:text-lg font-bold text-stone-900">
                Gyorsrögzítő billentyűzet (12 cm – 100 cm)
              </h2>
            </div>
            <p className="text-xs text-stone-500 mt-0.5">
              A rögzítéshez egyszerűen nyomja meg a kívánt átmérő gombot. 1 kattintás = 1 rönk rögzítése!
            </p>
          </div>

          {/* Quick controls: Undo button, piece multiplier, quality */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Prominent Undo Button */}
            <button
              onClick={handleUndoLast}
              disabled={session.logs.length === 0}
              className={`px-4 py-2 text-xs font-bold rounded-xl transition flex items-center gap-2 cursor-pointer shadow-sm min-h-[44px] ${
                session.logs.length > 0
                  ? 'bg-amber-100 hover:bg-amber-200 text-amber-950 border border-amber-300 active:scale-95'
                  : 'bg-stone-100 text-stone-400 border border-stone-200 opacity-60 cursor-not-allowed'
              }`}
              title="Legutóbb rögzített rönk törlése a listából"
            >
              <RotateCcw className="w-4 h-4" />
              <span>
                {lastLog ? `Utolsó visszavonása (${lastLog.diameter} cm)` : 'Utolsó visszavonása'}
              </span>
            </button>

            {/* Layout order toggle */}
            <div className="flex items-center bg-stone-100 p-0.5 rounded-lg border border-stone-200 text-[11px] font-semibold text-stone-600">
              <button
                onClick={() => setOrderMode('row')}
                className={`px-2.5 py-1.5 rounded-md transition ${orderMode === 'row' ? 'bg-white text-stone-900 shadow-2xs font-bold' : 'hover:text-stone-900'}`}
                title="Sorfolytonos: 12, 13, 14, 15..."
              >
                Sorok szerint
              </button>
              <button
                onClick={() => setOrderMode('col')}
                className={`px-2.5 py-1.5 rounded-md transition ${orderMode === 'col' ? 'bg-white text-stone-900 shadow-2xs font-bold' : 'hover:text-stone-900'}`}
                title="Oszlopfolytonos: 12-33, 34-55..."
              >
                Oszlopok szerint
              </button>
            </div>
          </div>
        </div>

        {/* Action feedback banner */}
        {lastActionMessage && (
          <div className={`p-3 rounded-xl border flex items-center justify-between text-xs font-semibold animate-fade-in ${
            lastActionMessage.type === 'add'
              ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
              : 'bg-amber-50 text-amber-900 border-amber-200'
          }`}>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{lastActionMessage.text}</span>
            </div>
            <span className="text-[11px] text-stone-500 font-normal">
              Összes: {totals.totalCount} db ({formatVolume(totals.totalVolume)} m³)
            </span>
          </div>
        )}

        {/* Secondary options: Piece count multiplier & Quality class */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-2.5 bg-stone-50 rounded-xl border border-stone-200 text-xs text-stone-700">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-stone-600">Darabszám szorzó:</span>
            <div className="flex items-center gap-1">
              {[1, 2, 3, 5, 10].map((cnt) => (
                <button
                  key={cnt}
                  type="button"
                  onClick={() => setPieceMultiplier(cnt)}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition tabular-numbers cursor-pointer min-h-[36px] ${
                    pieceMultiplier === cnt
                      ? 'bg-emerald-800 text-white shadow-xs'
                      : 'bg-white text-stone-700 hover:bg-stone-200 border border-stone-200'
                  }`}
                >
                  {cnt} db
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="font-semibold text-stone-600">Minőségi osztály:</span>
            <select
              value={selectedQuality}
              onChange={(e) => setSelectedQuality(e.target.value as LogQuality)}
              className="py-1 px-2.5 bg-white border border-stone-200 rounded-lg font-medium text-xs focus:ring-2 focus:ring-emerald-600 focus:outline-none"
            >
              {QUALITY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* 4 COLUMNS X 22 ROWS GRID (12 to 100 cm) */}
        <div>
          <div className="grid grid-cols-4 gap-1.5 sm:gap-2">
            {displayDiameters.map((diam) => {
              const unitVol = calculateLogVolume(diam, session.logLength, session.treeSpecies);
              const unitLiters = calculateLogVolumeLiters(diam, session.logLength, session.treeSpecies);
              const loggedCount = countsByDiameter.get(diam) || 0;
              const isDecile = diam % 10 === 0;

              const isVoiceActive = voiceActiveDiameter === diam;

              return (
                <button
                  key={diam}
                  id={`diam-btn-${diam}`}
                  type="button"
                  onClick={() => handleQuickLog(diam)}
                  className={`group relative p-2 sm:p-2.5 rounded-xl border text-center transition-all cursor-pointer min-h-[52px] sm:min-h-[56px] flex flex-col items-center justify-center select-none active:scale-95 active:bg-emerald-800 active:text-white ${
                    isVoiceActive
                      ? 'bg-emerald-600 text-white border-emerald-700 ring-4 ring-emerald-400 scale-105 z-10 shadow-lg animate-pulse'
                      : loggedCount > 0
                      ? 'bg-emerald-50/90 border-emerald-400/80 shadow-xs ring-1 ring-emerald-400/40'
                      : isDecile
                      ? 'bg-stone-100/90 border-stone-300 font-bold hover:bg-emerald-100 hover:border-emerald-500'
                      : 'bg-white border-stone-200 hover:bg-emerald-50 hover:border-emerald-400'
                  }`}
                  title={`${diam} cm: ${unitLiters} liter (${formatVolume(unitVol)} m³)`}
                >
                  {/* Diameter in big bold text */}
                  <div className="flex items-baseline gap-0.5">
                    <span
                      className={`text-base sm:text-lg font-black tabular-numbers leading-none ${
                        isVoiceActive
                          ? 'text-white'
                          : 'text-stone-900 group-hover:text-emerald-950'
                      }`}
                    >
                      {diam}
                    </span>
                    <span
                      className={`text-[10px] font-semibold ${
                        isVoiceActive
                          ? 'text-emerald-200'
                          : 'text-stone-400 group-hover:text-emerald-800'
                      }`}
                    >
                      cm
                    </span>
                  </div>

                  {/* Volume subtext: shows both liter and m3 */}
                  <span
                    className={`text-[10px] tabular-numbers font-medium leading-tight mt-0.5 ${
                      isVoiceActive
                        ? 'text-emerald-100'
                        : 'text-stone-500 group-hover:text-emerald-900'
                    }`}
                  >
                    <span className="font-bold text-stone-700 group-hover:text-emerald-950">{unitLiters} l</span> · {formatVolume(unitVol)} m³
                  </span>

                  {/* Count badge if already logged in this session */}
                  {loggedCount > 0 && (
                    <span
                      className={`absolute top-1 right-1 sm:top-1.5 sm:right-1.5 text-[9px] sm:text-[10px] font-black px-1.5 py-0.2 rounded-full tabular-numbers shadow-2xs ${
                        isVoiceActive
                          ? 'bg-white text-emerald-900'
                          : 'bg-emerald-700 text-white'
                      }`}
                    >
                      {loggedCount}
                    </span>
                  )}
                </button>
              );
            })}

            {/* In the 23rd row alongside 100 cm: Wide "Utolsó visszavonása" button taking remaining 3 columns */}
            <button
              type="button"
              onClick={handleUndoLast}
              disabled={session.logs.length === 0}
              className={`col-span-3 p-2 sm:p-2.5 rounded-xl border transition-all flex items-center justify-center gap-2 font-bold text-sm min-h-[52px] sm:min-h-[56px] shadow-xs cursor-pointer active:scale-98 ${
                session.logs.length > 0
                  ? 'bg-amber-100 hover:bg-amber-200 text-amber-950 border-amber-300'
                  : 'bg-stone-100 text-stone-400 border-stone-200 opacity-60 cursor-not-allowed'
              }`}
            >
              <RotateCcw className="w-4 h-4" />
              <span>
                {lastLog ? `Utolsó rönk visszavonása (${lastLog.diameter} cm)` : 'Utolsó visszavonása'}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Tally & Data section */}
      <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
        {/* Tab switch header */}
        <div className="flex items-center justify-between px-6 pt-4 pb-3 border-b border-stone-200">
          <div className="flex items-center gap-1 p-1 bg-stone-100 rounded-xl">
            <button
              onClick={() => setActiveTab('tally')}
              className={`px-4 py-2 text-xs font-semibold rounded-lg transition-colors flex items-center gap-2 cursor-pointer ${
                activeTab === 'tally'
                  ? 'bg-white text-stone-900 shadow-xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              <Table className="w-4 h-4 text-emerald-700" />
              <span>Faátlalási jegyzék (Átmérő szerint)</span>
              <span className="text-[11px] font-bold bg-stone-100 text-stone-600 px-1.5 py-0.5 rounded-md">
                {totals.diameterStats.length} méret
              </span>
            </button>

            <button
              onClick={() => setActiveTab('list')}
              className={`px-4 py-2 text-xs font-semibold rounded-lg transition-colors flex items-center gap-2 cursor-pointer ${
                activeTab === 'list'
                  ? 'bg-white text-stone-900 shadow-xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              <ListOrdered className="w-4 h-4 text-emerald-700" />
              <span>Tételes rönklista</span>
              <span className="text-[11px] font-bold bg-stone-100 text-stone-600 px-1.5 py-0.5 rounded-md">
                {session.logs.length} bejegyzés
              </span>
            </button>
          </div>

          {activeTab === 'list' && (
            <input
              type="text"
              placeholder="Keresés átmérőre..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="text-xs px-3 py-1.5 bg-stone-50 border border-stone-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-600 w-36 sm:w-48"
            />
          )}
        </div>

        {/* Tab 1: Vastagsági jegyzék / Diameter distribution */}
        {activeTab === 'tally' && (
          <div className="p-6">
            {totals.diameterStats.length === 0 ? (
              <div className="text-center py-12 text-stone-400">
                <p className="text-sm">Még nincs rögzített adat ebben a köbözésben.</p>
                <p className="text-xs text-stone-400 mt-1">
                  Kattintson a fenti 4 oszlopos billentyűzet bármelyik átmérő gombjára a gyorsrögzítéshez.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-stone-200 text-stone-500 text-xs font-semibold uppercase tracking-wider">
                      <th className="py-3 px-4">Átmérő</th>
                      <th className="py-3 px-4 text-right">Darabszám</th>
                      <th className="py-3 px-4 text-right">1 db térfogata</th>
                      <th className="py-3 px-4 text-right">Összes térfogat</th>
                      <th className="py-3 px-4 text-right">Térfogat arány</th>
                      <th className="py-3 px-4">Eloszlás</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {totals.diameterStats.map((stat) => {
                      const unitVol = calculateLogVolume(stat.diameter, session.logLength, session.treeSpecies);
                      return (
                        <tr key={stat.diameter} className="hover:bg-stone-50/70 transition-colors">
                          <td className="py-3 px-4 font-bold text-stone-900 tabular-numbers">
                            {stat.diameter} cm
                          </td>
                          <td className="py-3 px-4 text-right font-semibold text-stone-900 tabular-numbers">
                            {stat.count} db
                          </td>
                          <td className="py-3 px-4 text-right text-stone-500 tabular-numbers">
                            {formatVolume(unitVol)} m³
                          </td>
                          <td className="py-3 px-4 text-right font-bold text-emerald-800 tabular-numbers">
                            {formatVolume(stat.totalVolume)} m³
                          </td>
                          <td className="py-3 px-4 text-right text-stone-600 font-medium tabular-numbers">
                            {stat.percentageVolume} %
                          </td>
                          <td className="py-3 px-4 w-44">
                            <div className="w-full bg-stone-100 rounded-full h-2 overflow-hidden">
                              <div
                                className="bg-emerald-600 h-2 rounded-full transition-all duration-300"
                                style={{ width: `${Math.min(100, stat.percentageVolume)}%` }}
                              />
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-stone-300 font-bold text-stone-900 bg-stone-50">
                      <td className="py-3 px-4">ÖSSZESEN:</td>
                      <td className="py-3 px-4 text-right tabular-numbers text-base">
                        {totals.totalCount} db
                      </td>
                      <td className="py-3 px-4 text-right text-stone-500 text-xs">
                        Átlag: {totals.avgDiameter} cm
                      </td>
                      <td className="py-3 px-4 text-right tabular-numbers text-base text-emerald-800">
                        {formatVolume(totals.totalVolume)} m³
                      </td>
                      <td className="py-3 px-4 text-right tabular-numbers">100.0 %</td>
                      <td className="py-3 px-4"></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Detailed logs list */}
        {activeTab === 'list' && (
          <div className="p-6">
            {filteredLogs.length === 0 ? (
              <div className="text-center py-12 text-stone-400">
                <p className="text-sm">Nem található rönk a keresési feltételek alapján.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-stone-200 text-stone-500 text-xs font-semibold uppercase tracking-wider">
                      <th className="py-3 px-4">#</th>
                      <th className="py-3 px-4">Átmérő</th>
                      <th className="py-3 px-4 text-right">Darab</th>
                      <th className="py-3 px-4 text-right">Térfogat</th>
                      <th className="py-3 px-4">Minőség</th>
                      <th className="py-3 px-4">Időpont</th>
                      <th className="py-3 px-4 text-right">Művelet</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {filteredLogs.map((log, index) => {
                      const totalEntryVol = (log.volume || 0) * (log.pieceCount || 1);
                      return (
                        <tr key={log.id} className="hover:bg-stone-50/70 transition-colors">
                          <td className="py-3 px-4 text-stone-400 font-mono text-xs">
                            {session.logs.length - index}
                          </td>
                          <td className="py-3 px-4 font-bold text-stone-900 tabular-numbers">
                            {log.diameter} cm
                          </td>
                          <td className="py-3 px-4 text-right font-semibold text-stone-800 tabular-numbers">
                            {log.pieceCount || 1} db
                          </td>
                          <td className="py-3 px-4 text-right font-bold text-emerald-800 tabular-numbers">
                            {formatVolume(totalEntryVol)} m³
                          </td>
                          <td className="py-3 px-4 text-stone-600 text-xs capitalize">
                            {log.quality || 'fűrészrönk'}
                          </td>
                          <td className="py-3 px-4 text-stone-400 text-xs">
                            {formatHungarianDate(log.timestamp)}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <button
                              onClick={() => handleDeleteLog(log.id)}
                              className="p-1.5 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition cursor-pointer min-h-[36px] min-w-[36px] inline-flex items-center justify-center"
                              title="Tétel törlése"
                              aria-label="Törlés"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Floating / Sticky bottom undo pill for effortless one-handed thumb reach */}
      {session.logs.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-30 no-print">
          <button
            onClick={handleUndoLast}
            className="flex items-center gap-2 px-5 py-3 bg-amber-950 text-amber-100 hover:bg-amber-900 rounded-full shadow-2xl border border-amber-500/50 text-xs font-bold transition active:scale-95 cursor-pointer backdrop-blur-md"
          >
            <RotateCcw className="w-4 h-4 text-amber-400" />
            <span>Utolsó visszavonása ({lastLog?.diameter} cm)</span>
          </button>
        </div>
      )}
    </div>
  );
};
