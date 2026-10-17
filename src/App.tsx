import { useState, useEffect } from 'react';
import { ScalingSession } from './types';
import { Header } from './components/Header';
import { SessionWidget } from './components/SessionWidget';
import { SessionModal } from './components/SessionModal';
import { ScalingSessionView } from './components/ScalingSessionView';
import { ExportModal } from './components/ExportModal';
import { FloatingActionButton } from './components/FloatingActionButton';
import { PrintTallySheet } from './components/PrintTallySheet';
import { calculateLogVolume, exportSessionToCsv, downloadFile } from './utils/forestryCalculations';
import { Trees, Plus, Sparkles, AlertTriangle } from 'lucide-react';

const STORAGE_KEY = 'ERDESZETI_KOBOZO_SESSIONS_V1';

// Sample demonstration session for quick exploration
const createSampleSession = (): ScalingSession => {
  const sampleSessionId = `session-${Date.now()}`;
  const lengthM = 4.1;
  const sampleSpecies = 'tölgy';
  const sampleDiameters = [
    22, 24, 24, 26, 26, 26, 28, 28, 30, 30, 32, 34, 34, 36, 38, 40, 24, 26, 28, 32
  ];

  const logs = sampleDiameters.map((d, idx) => ({
    id: `sample-log-${idx}-${Date.now()}`,
    diameter: d,
    volume: calculateLogVolume(d, lengthM, sampleSpecies),
    quality: (d >= 30 ? 'fűrészrönk' : d >= 24 ? 'II' : 'raklapfa') as any,
    pieceCount: 1,
    timestamp: Date.now() - (sampleDiameters.length - idx) * 45000
  }));

  return {
    id: sampleSessionId,
    forestryAssociation: 'Pilisi Parkerdő Erdőbirtokosság',
    depotCode: 'R-14 / Vöröskő rakodó',
    compartment: '24/B',
    treeSpecies: sampleSpecies,
    logLength: lengthM,
    notes: 'Hivatalos statisztikai köbözőtábla, tölgy 4,1 m tétel',
    logs,
    createdAt: Date.now() - 3600000,
    updatedAt: Date.now()
  };
};

export default function App() {
  const [sessions, setSessions] = useState<ScalingSession[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (e) {
      console.error('Failed to parse stored sessions', e);
    }
    return [];
  });

  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSession, setEditingSession] = useState<ScalingSession | null>(null);
  const [exportSession, setExportSession] = useState<ScalingSession | null>(null);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [sessionToDelete, setSessionToDelete] = useState<string | null>(null);

  // Sync to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
    } catch (e) {
      console.error('Failed to save sessions to localStorage', e);
    }
  }, [sessions]);

  // Active session object
  const activeSession = sessions.find((s) => s.id === activeSessionId);

  // Start new scaling session
  const handleOpenNewModal = () => {
    setEditingSession(null);
    setIsModalOpen(true);
  };

  // Open edit modal for an existing session
  const handleOpenEditModal = (session: ScalingSession) => {
    setEditingSession(session);
    setIsModalOpen(true);
  };

  // Save new or edited session
  const handleSaveSession = (data: Omit<ScalingSession, 'id' | 'createdAt' | 'updatedAt' | 'logs'> & { id?: string }) => {
    if (data.id) {
      // Edit existing
      setSessions((prev) =>
        prev.map((s) =>
          s.id === data.id
            ? {
                ...s,
                forestryAssociation: data.forestryAssociation,
                depotCode: data.depotCode,
                compartment: data.compartment,
                treeSpecies: data.treeSpecies,
                logLength: data.logLength,
                notes: data.notes,
                updatedAt: Date.now()
              }
            : s
        )
      );
    } else {
      // Create new session
      const newSession: ScalingSession = {
        id: `session-${Date.now()}`,
        forestryAssociation: data.forestryAssociation,
        depotCode: data.depotCode,
        compartment: data.compartment,
        treeSpecies: data.treeSpecies,
        logLength: data.logLength,
        notes: data.notes,
        logs: [],
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
      setSessions((prev) => [newSession, ...prev]);
      // Return to title screen so widget is visible, or user can click it
    }
  };

  // Delete session
  const confirmDeleteSession = () => {
    if (!sessionToDelete) return;
    setSessions((prev) => prev.filter((s) => s.id !== sessionToDelete));
    if (activeSessionId === sessionToDelete) {
      setActiveSessionId(null);
    }
    setSessionToDelete(null);
  };

  // Update session logs from ScalingSessionView
  const handleUpdateSession = (updated: ScalingSession) => {
    setSessions((prev) =>
      prev.map((s) => (s.id === updated.id ? updated : s))
    );
  };

  // Trigger export modal
  const handleOpenExport = (session: ScalingSession) => {
    setExportSession(session);
    setIsExportModalOpen(true);
  };

  // Export all sessions batch
  const handleExportAll = () => {
    if (sessions.length === 0) return;
    const allRows: string[] = [];
    allRows.push('ERDÉSZETI KÖBÖZÉSI ÖSSZESÍTŐ - MINDEN TÉTEL');
    allRows.push(`Export ideje;${new Date().toLocaleString('hu-HU')}`);
    allRows.push('');

    sessions.forEach((sess, idx) => {
      allRows.push(`--- ${idx + 1}. TÉTEL: ${sess.forestryAssociation} ---`);
      const csv = exportSessionToCsv(sess);
      // Remove BOM for joined content
      allRows.push(csv.replace(/^\uFEFF/, ''));
      allRows.push('');
      allRows.push('========================================');
      allRows.push('');
    });

    downloadFile(
      '\uFEFF' + allRows.join('\r\n'),
      `osszes_erdeszeti_kobozes_${new Date().toISOString().slice(0, 10)}.csv`,
      'text/csv;charset=utf-8;'
    );
  };

  // Load sample session for testing
  const handleLoadSample = () => {
    const sample = createSampleSession();
    setSessions((prev) => [sample, ...prev]);
  };

  return (
    <div className="min-h-screen bg-stone-50/60 text-stone-900 flex flex-col font-sans selection:bg-emerald-200 w-full max-w-full overflow-x-hidden">
      {/* Top Bar Header */}
      <Header
        onNewSession={handleOpenNewModal}
        onExportAll={sessions.length > 0 ? handleExportAll : undefined}
        hasSessions={sessions.length > 0}
      />

      {/* Main View Area */}
      <main className="flex-1 pb-24">
        {activeSession ? (
          /* Active Scaling View */
          <ScalingSessionView
            session={activeSession}
            onBack={() => setActiveSessionId(null)}
            onUpdateSession={handleUpdateSession}
            onEditMetadata={() => handleOpenEditModal(activeSession)}
            onExport={() => handleOpenExport(activeSession)}
          />
        ) : (
          /* Title / Dashboard Screen */
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
            {/* Hero / Forest Landing Banner */}
            <div className="relative rounded-3xl overflow-hidden border border-stone-200 bg-emerald-950 text-white shadow-sm">
              <div className="absolute inset-0">
                <img
                  src="/src/assets/images/forestry_timber_logs_1791979060148.jpg"
                  alt="Erdészeti rönkök lerakóhelyen"
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover opacity-25"
                  onError={(e) => {
                    // Fallback to dark gradient if image fails
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                />
                <div className="absolute inset-0 bg-gradient-to-r from-emerald-950 via-emerald-950/85 to-transparent" />
              </div>

              <div className="relative p-6 sm:p-10 max-w-2xl">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-emerald-900/60 border border-emerald-700/50 text-emerald-300 text-xs font-semibold mb-3">
                  <Trees className="w-3.5 h-3.5" />
                  <span>Erdészeti Fatérfogat-számítás & Faátlalás</span>
                </div>
                <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-white mb-6 leading-tight">
                  Köbözési Jegyzék Kezelő
                </h1>

                <div className="flex flex-wrap items-center gap-3">
                  <button
                    onClick={handleOpenNewModal}
                    className="px-5 py-3 bg-emerald-400 hover:bg-emerald-300 active:scale-95 text-emerald-950 font-bold text-sm rounded-xl shadow-md transition flex items-center gap-2 cursor-pointer"
                  >
                    <Plus className="w-4 h-4 text-emerald-950 stroke-[2.5]" />
                    <span>Új köbözés indítása</span>
                  </button>

                  {sessions.length === 0 && (
                    <button
                      onClick={handleLoadSample}
                      className="px-4 py-3 bg-white/10 hover:bg-white/20 text-white font-medium text-xs rounded-xl border border-white/20 transition flex items-center gap-1.5 cursor-pointer"
                    >
                      <Sparkles className="w-4 h-4 text-emerald-300" />
                      <span>Minta tölgy tétel betöltése</span>
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Session Widgets Grid or Empty State */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-lg font-bold text-stone-900">
                    Köbözési Tételek ({sessions.length})
                  </h2>
                  <p className="text-xs text-stone-500">
                    Kattintson egy widgetre a köbözés és rönkméret rögzítés folytatásához
                  </p>
                </div>

                {sessions.length > 0 && (
                  <button
                    onClick={handleExportAll}
                    className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 flex items-center gap-1 cursor-pointer"
                  >
                    Minden adat exportálása (.csv)
                  </button>
                )}
              </div>

              {sessions.length === 0 ? (
                /* Empty state when no sessions exist */
                <div className="bg-white rounded-3xl border-2 border-dashed border-stone-200 p-8 sm:p-14 text-center">
                  <div className="w-16 h-16 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center mx-auto mb-4 border border-emerald-100">
                    <Trees className="w-8 h-8" />
                  </div>
                  <h3 className="text-lg font-bold text-stone-900 mb-1">
                    Még nincs rögzített köbözési tétel
                  </h3>
                  <p className="text-sm text-stone-500 max-w-md mx-auto mb-6">
                    Első indításkor kattintson a lenti lebegő <strong className="text-stone-800">+</strong> gombra vagy az alábbi gombra új köbözési tétel megadásához!
                  </p>
                  <div className="flex items-center justify-center gap-3">
                    <button
                      onClick={handleOpenNewModal}
                      className="px-6 py-3 bg-emerald-700 hover:bg-emerald-800 active:scale-95 text-white font-bold text-sm rounded-xl shadow-sm transition flex items-center gap-2 cursor-pointer"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Új köbözés indítása</span>
                    </button>
                    <button
                      onClick={handleLoadSample}
                      className="px-4 py-3 bg-stone-100 hover:bg-stone-200 text-stone-700 font-semibold text-xs rounded-xl transition cursor-pointer"
                    >
                      Minta betöltése
                    </button>
                  </div>
                </div>
              ) : (
                /* Grid of Session Widgets */
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {sessions.map((session) => (
                    <SessionWidget
                      key={session.id}
                      session={session}
                      onOpen={(id) => setActiveSessionId(id)}
                      onEdit={handleOpenEditModal}
                      onDelete={(id) => setSessionToDelete(id)}
                      onExport={handleOpenExport}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Floating Action Button (FAB) greeting the user on initial launch and home screen */}
      {!activeSession && (
        <FloatingActionButton
          onClick={handleOpenNewModal}
          label="Új köbözés"
          isInitial={sessions.length === 0}
        />
      )}

      {/* Modal for Creating & Editing Sessions */}
      <SessionModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveSession}
        initialSession={editingSession}
      />

      {/* Modal for Exporting Data */}
      <ExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        session={exportSession}
      />

      {/* Dedicated Offscreen Template for HTML Canvas capture (PDF/JPG) & Print */}
      {(exportSession || activeSession) && (
        <div
          id="export-tally-sheet-capture"
          aria-hidden="true"
          style={{
            position: 'fixed',
            left: '-9999px',
            top: 0,
            width: '850px',
            backgroundColor: '#ffffff',
            zIndex: -9999,
            pointerEvents: 'none',
            opacity: 1
          }}
        >
          <PrintTallySheet session={exportSession || activeSession!} forCapture={true} />
        </div>
      )}

      {/* Confirmation Dialog for Deleting a Session */}
      {sessionToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6 text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-stone-900">
                Biztosan törli ezt a köbözési tételt?
              </h3>
              <p className="text-xs text-stone-500 mt-1">
                A tételhez rögzített összes rönkméret és számítás véglegesen törlődik.
              </p>
            </div>
            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={() => setSessionToDelete(null)}
                className="flex-1 py-2.5 text-xs font-semibold text-stone-700 bg-stone-100 hover:bg-stone-200 rounded-xl transition cursor-pointer"
              >
                Mégse
              </button>
              <button
                onClick={confirmDeleteSession}
                className="flex-1 py-2.5 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-xl transition cursor-pointer shadow-xs"
              >
                Igen, törlés
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
