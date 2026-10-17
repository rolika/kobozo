import React from 'react';
import { ScalingSession } from '../types';
import { calculateSessionTotals, formatVolume, formatHungarianDate, formatLength } from '../utils/forestryCalculations';
import { Edit2, Trash2, Download, ArrowRight, TreePine, MapPin, Ruler, Layers } from 'lucide-react';

interface SessionWidgetProps {
  session: ScalingSession;
  onOpen: (sessionId: string) => void;
  onEdit: (session: ScalingSession) => void;
  onDelete: (sessionId: string) => void;
  onExport: (session: ScalingSession) => void;
}

export const SessionWidget: React.FC<SessionWidgetProps> = ({
  session,
  onOpen,
  onEdit,
  onDelete,
  onExport,
}) => {
  const totals = calculateSessionTotals(session);

  const handleEditClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onEdit(session);
  };

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete(session.id);
  };

  const handleExportClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onExport(session);
  };

  return (
    <div
      onClick={() => onOpen(session.id)}
      className="group relative bg-white rounded-2xl border border-stone-200 hover:border-emerald-500 shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer overflow-hidden flex flex-col justify-between"
    >
      {/* Top section: Header & Quick action buttons */}
      <div className="p-5 pb-3">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs text-stone-500 mb-1">
              <span>Rögzítve: {formatHungarianDate(session.updatedAt)}</span>
              {session.compartment && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="font-medium text-stone-700">Részlet: {session.compartment}</span>
                </>
              )}
            </div>
            {/* Erdőbirtokosság neve */}
            <h3 className="text-lg font-bold text-stone-900 tracking-tight group-hover:text-emerald-800 transition-colors truncate">
              {session.forestryAssociation || 'Névtelen erdőbirtokosság'}
            </h3>
          </div>

          {/* Quick Action Buttons (Edit & Delete & Export) */}
          <div className="flex items-center gap-1 shrink-0 -mt-1 -mr-1">
            <button
              onClick={handleExportClick}
              title="Tétel exportálása (PDF / JPG / Megosztás)"
              className="p-2 text-stone-500 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer min-h-[40px] min-w-[40px] flex items-center justify-center"
              aria-label="Exportálás (PDF, JPG, Megosztás)"
            >
              <Download className="w-4 h-4" />
            </button>
            <button
              onClick={handleEditClick}
              title="Adatok szerkesztése"
              className="p-2 text-stone-500 hover:text-stone-900 hover:bg-stone-100 rounded-lg transition-colors cursor-pointer min-h-[40px] min-w-[40px] flex items-center justify-center"
              aria-label="Szerkesztés"
            >
              <Edit2 className="w-4 h-4" />
            </button>
            <button
              onClick={handleDeleteClick}
              title="Köbözés törlése"
              className="p-2 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer min-h-[40px] min-w-[40px] flex items-center justify-center"
              aria-label="Törlés"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Forest Lot Details / Meta: Lerakóhely, Fafajta, Rönkhossz */}
        <div className="grid grid-cols-3 gap-2 py-2.5 px-3 bg-stone-50 rounded-xl text-xs text-stone-700 border border-stone-100">
          <div className="flex items-center gap-1.5 truncate">
            <MapPin className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
            <div className="truncate">
              <span className="text-[10px] text-stone-400 block leading-tight">Lerakó:</span>
              <span className="font-semibold text-stone-900 truncate block">{session.depotCode || '-'}</span>
            </div>
          </div>
          <div className="flex items-center gap-1.5 truncate">
            <TreePine className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
            <div className="truncate">
              <span className="text-[10px] text-stone-400 block leading-tight">Fafaj:</span>
              <span className="font-semibold text-stone-900 truncate block">{session.treeSpecies || '-'}</span>
            </div>
          </div>
          <div className="flex items-center gap-1.5 truncate">
            <Ruler className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
            <div className="truncate">
              <span className="text-[10px] text-stone-400 block leading-tight">Hossz:</span>
              <span className="font-semibold text-stone-900 tabular-numbers truncate block">{formatLength(session.logLength)} m</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main KPI Stats: Darabszám & Térfogat (Required) */}
      <div className="px-5 py-3 border-t border-stone-100">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <span className="text-xs font-medium text-stone-500 flex items-center gap-1">
              <Layers className="w-3.5 h-3.5 text-stone-400" />
              Darabszám
            </span>
            <div className="mt-1 flex items-baseline gap-1">
              <span className="text-2xl font-bold text-stone-900 tabular-numbers">
                {totals.totalCount}
              </span>
              <span className="text-xs font-semibold text-stone-500">db</span>
            </div>
          </div>

          <div>
            <span className="text-xs font-medium text-stone-500">
              Összes térfogat
            </span>
            <div className="mt-1 flex items-baseline gap-1">
              <span className="text-2xl font-bold text-emerald-700 tabular-numbers">
                {formatVolume(totals.totalVolume)}
              </span>
              <span className="text-xs font-semibold text-emerald-800">m³</span>
            </div>
          </div>
        </div>

        {/* Secondary metrics */}
        {totals.totalCount > 0 && (
          <div className="mt-2.5 pt-2 border-t border-stone-100 flex items-center justify-between text-[11px] text-stone-500">
            <span>Átlagátmérő: <strong className="text-stone-700 tabular-numbers">{totals.avgDiameter} cm</strong></span>
            <span>Tartomány: <strong className="text-stone-700 tabular-numbers">{totals.minDiameter} – {totals.maxDiameter} cm</strong></span>
          </div>
        )}
      </div>

      {/* Footer trigger button for entering scaling */}
      <div className="px-5 py-2.5 bg-stone-50/80 border-t border-stone-100 flex items-center justify-between text-xs font-semibold text-emerald-700 group-hover:bg-emerald-50/70 transition-colors">
        <span>Köbözés megnyitása & rögzítés</span>
        <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
      </div>
    </div>
  );
};
