import React from 'react';
import { Trees, Download, Plus } from 'lucide-react';

interface HeaderProps {
  onNewSession: () => void;
  onExportAll?: () => void;
  hasSessions: boolean;
}

export const Header: React.FC<HeaderProps> = ({ onNewSession, onExportAll, hasSessions }) => {
  return (
    <header className="sticky top-0 z-30 bg-emerald-950 text-white border-b border-emerald-900 shadow-sm no-print">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-2 sm:gap-4">
        {/* Zone 1: Brand wordmark (with min-w-0 and truncation so it never overflows) */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-emerald-600/30 border border-emerald-500/40 flex items-center justify-center text-emerald-300 shrink-0">
            <Trees className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <span className="text-base sm:text-lg font-bold tracking-tight text-white block leading-tight truncate">
              Erdészeti Köböző
            </span>
            <span className="text-[10px] sm:text-[11px] text-emerald-300/80 font-medium tracking-wide truncate block">
              Hivatalos statisztikai adatok
            </span>
          </div>
        </div>

        {/* Zone 3: Primary Actions (properly sized for mobile screens) */}
        <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
          {hasSessions && onExportAll && (
            <button
              onClick={onExportAll}
              className="inline-flex items-center justify-center gap-1.5 p-2 sm:px-3 sm:py-2 text-xs font-semibold text-emerald-100 bg-emerald-900/80 hover:bg-emerald-800 border border-emerald-700/60 rounded-lg transition-colors shrink-0"
              title="Összes tétel exportálása"
              aria-label="Összes tétel exportálása"
            >
              <Download className="w-4 h-4 text-emerald-300 shrink-0" />
              <span className="hidden md:inline">Összes exportálása</span>
            </button>
          )}
          <button
            onClick={onNewSession}
            className="inline-flex items-center justify-center gap-1.5 px-3 py-2 sm:px-4 text-xs font-semibold text-emerald-950 bg-emerald-400 hover:bg-emerald-300 active:scale-95 transition-all rounded-lg shadow-sm shrink-0 cursor-pointer"
          >
            <Plus className="w-4 h-4 text-emerald-950 stroke-[2.5] shrink-0" />
            <span className="whitespace-nowrap">Új köbözés</span>
          </button>
        </div>
      </div>
    </header>
  );
};
