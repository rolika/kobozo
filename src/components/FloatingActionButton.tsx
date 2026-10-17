import React from 'react';
import { Plus } from 'lucide-react';

interface FloatingActionButtonProps {
  onClick: () => void;
  label?: string;
  isInitial?: boolean;
}

export const FloatingActionButton: React.FC<FloatingActionButtonProps> = ({
  onClick,
  label = 'Új köbözés indítása',
  isInitial = false
}) => {
  return (
    <div className="fixed bottom-5 right-4 sm:bottom-8 sm:right-8 z-40 no-print flex flex-col items-end max-w-[calc(100vw-2rem)]">
      {isInitial && (
        <div className="mb-2 px-3 py-1.5 bg-emerald-950 text-emerald-100 text-xs font-medium rounded-lg shadow-lg border border-emerald-800 animate-bounce flex items-center gap-1.5 max-w-[220px] text-center">
          <span>Koppintson ide új köbözéshez!</span>
        </div>
      )}
      <button
        onClick={onClick}
        aria-label={label}
        title={label}
        className="group flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white p-3.5 sm:px-5 sm:py-4 rounded-2xl shadow-xl shadow-emerald-950/25 border border-emerald-400/30 transition-all cursor-pointer min-h-[52px] min-w-[52px] sm:min-h-[56px] sm:min-w-[56px]"
      >
        <div className="w-6 h-6 sm:w-7 sm:h-7 flex items-center justify-center shrink-0">
          <Plus className="w-6 h-6 sm:w-7 sm:h-7 transition-transform group-hover:rotate-90 duration-300 stroke-[2.5]" />
        </div>
        <span className="font-semibold text-sm hidden sm:inline-block pr-1 whitespace-nowrap">
          {label}
        </span>
      </button>
    </div>
  );
};
