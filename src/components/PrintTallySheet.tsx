import React from 'react';
import { ScalingSession } from '../types';
import { calculateSessionTotals, formatVolume, formatHungarianDate, formatLength } from '../utils/forestryCalculations';

interface PrintTallySheetProps {
  session: ScalingSession;
  forCapture?: boolean;
}

export const PrintTallySheet: React.FC<PrintTallySheetProps> = ({ session, forCapture = false }) => {
  const totals = calculateSessionTotals(session);

  return (
    <div
      id="export-tally-sheet"
      className={`bg-white text-stone-900 text-sm font-sans p-8 ${
        forCapture ? 'w-[800px] block' : 'print:block print:p-8 max-w-4xl mx-auto'
      }`}
      style={{
        fontFamily: "'Plus Jakarta Sans', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif"
      }}
    >
      {/* Official Header */}
      <div className="border-b-2 border-stone-900 pb-4 mb-6">
        <div className="flex justify-between items-start">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-bold tracking-widest uppercase bg-stone-900 text-white px-2 py-0.5 rounded-xs">
                Hivatalos bizonylat
              </span>
              <span className="text-xs text-stone-500 font-medium">
                Erdészeti Fatérfogat-számítás
              </span>
            </div>
            <h1 className="text-xl font-black uppercase tracking-wide text-stone-900">
              Erdészeti Köbözési és Faátlalási Jegyzőkönyv
            </h1>
            <p className="text-xs text-stone-600 mt-1">
              A számítás a hivatalos statisztikai adatok alapján történik (liter / 1000 = m³)
            </p>
          </div>
          <div className="text-right text-xs">
            <p className="font-bold text-stone-900">Jegyzőkönyv azonosító:</p>
            <p className="font-mono text-stone-600">{session.id}</p>
            <p className="mt-1 font-semibold text-stone-800">
              Kiállítás: {formatHungarianDate(session.updatedAt || Date.now())}
            </p>
          </div>
        </div>
      </div>

      {/* Compartment & Lot Details Table */}
      <div className="grid grid-cols-2 gap-4 border border-stone-300 rounded-lg p-4 mb-6 bg-stone-50/50 text-xs">
        <div className="space-y-2.5">
          <div>
            <span className="font-semibold text-stone-500 uppercase text-[10px] tracking-wider block">
              Erdőbirtokosság / Tulajdonos:
            </span>
            <p className="text-sm font-bold text-stone-900">{session.forestryAssociation || '-'}</p>
          </div>
          <div>
            <span className="font-semibold text-stone-500 uppercase text-[10px] tracking-wider block">
              Lerakóhely jele:
            </span>
            <p className="text-sm font-bold text-stone-900">{session.depotCode || '-'}</p>
          </div>
          {session.compartment && (
            <div>
              <span className="font-semibold text-stone-500 uppercase text-[10px] tracking-wider block">
                Erdőrészlet azonosító:
              </span>
              <p className="text-sm font-bold text-stone-900">{session.compartment}</p>
            </div>
          )}
        </div>

        <div className="space-y-2.5">
          <div>
            <span className="font-semibold text-stone-500 uppercase text-[10px] tracking-wider block">
              Fafajta:
            </span>
            <p className="text-sm font-bold text-emerald-950 uppercase">{session.treeSpecies || '-'}</p>
          </div>
          <div>
            <span className="font-semibold text-stone-500 uppercase text-[10px] tracking-wider block">
              Szabványos rönkhossz:
            </span>
            <p className="text-sm font-bold text-stone-900">{formatLength(session.logLength)} méter</p>
          </div>
          {session.notes && (
            <div>
              <span className="font-semibold text-stone-500 uppercase text-[10px] tracking-wider block">
                Megjegyzés / Jármű / Fuvar:
              </span>
              <p className="text-xs text-stone-700">{session.notes}</p>
            </div>
          )}
        </div>
      </div>

      {/* Summary KPI Cards Box */}
      <div className="bg-emerald-950 text-white rounded-lg p-4 mb-6 shadow-xs">
        <div className="flex items-center justify-between border-b border-emerald-800 pb-2 mb-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-emerald-300">
            Tétel Összesített Mutatói
          </h2>
          <span className="text-[10px] text-emerald-400">
            {totals.diameterStats.length} különböző rönkátmérő méretcsoport
          </span>
        </div>
        <div className="grid grid-cols-4 gap-4 text-center">
          <div className="p-2 bg-emerald-900/60 rounded-md">
            <span className="text-[10px] uppercase tracking-wider text-emerald-300 block">Összes darab</span>
            <span className="text-xl font-black tabular-numbers text-white">{totals.totalCount} db</span>
          </div>
          <div className="p-2 bg-emerald-900/60 rounded-md">
            <span className="text-[10px] uppercase tracking-wider text-emerald-300 block">Összes térfogat</span>
            <span className="text-xl font-black tabular-numbers text-emerald-300">{formatVolume(totals.totalVolume)} m³</span>
          </div>
          <div className="p-2 bg-emerald-900/60 rounded-md">
            <span className="text-[10px] uppercase tracking-wider text-emerald-300 block">Átlagos átmérő</span>
            <span className="text-xl font-black tabular-numbers text-white">{totals.avgDiameter} cm</span>
          </div>
          <div className="p-2 bg-emerald-900/60 rounded-md">
            <span className="text-[10px] uppercase tracking-wider text-emerald-300 block">Mérettartomány</span>
            <span className="text-xl font-black tabular-numbers text-white">{totals.minDiameter} – {totals.maxDiameter} cm</span>
          </div>
        </div>
      </div>

      {/* Diameter Distribution Table */}
      <div className="mb-6">
        <h2 className="text-xs font-bold uppercase tracking-wider mb-2 text-stone-800">
          Faátlalási Jegyzék (Átmérő és térfogat szerinti részletes megoszlás)
        </h2>
        <table className="w-full text-xs border-collapse border border-stone-300 rounded-md overflow-hidden">
          <thead>
            <tr className="bg-stone-200 border-b border-stone-300 text-stone-800">
              <th className="border border-stone-300 p-2 text-left font-bold">Középátmérő (cm)</th>
              <th className="border border-stone-300 p-2 text-right font-bold">Darabszám (db)</th>
              <th className="border border-stone-300 p-2 text-right font-bold">Térfogat (m³)</th>
              <th className="border border-stone-300 p-2 text-right font-bold">Térfogat arány (%)</th>
            </tr>
          </thead>
          <tbody>
            {totals.diameterStats.length === 0 ? (
              <tr>
                <td colSpan={4} className="border border-stone-300 p-4 text-center text-stone-500 italic">
                  Ehhez a tételhez még nem rögzítettek rönkátmérőket.
                </td>
              </tr>
            ) : (
              totals.diameterStats.map((stat) => (
                <tr key={stat.diameter} className="border-b border-stone-200 hover:bg-stone-50">
                  <td className="border border-stone-300 p-2 font-bold text-stone-900">{stat.diameter} cm</td>
                  <td className="border border-stone-300 p-2 text-right tabular-numbers">{stat.count} db</td>
                  <td className="border border-stone-300 p-2 text-right font-bold tabular-numbers text-stone-900">
                    {formatVolume(stat.totalVolume)} m³
                  </td>
                  <td className="border border-stone-300 p-2 text-right tabular-numbers text-stone-600">
                    {stat.percentageVolume} %
                  </td>
                </tr>
              ))
            )}
          </tbody>
          <tfoot>
            <tr className="bg-stone-100 font-black border-t-2 border-stone-900 text-stone-900">
              <td className="border border-stone-300 p-2.5 uppercase tracking-wide">ÖSSZESEN:</td>
              <td className="border border-stone-300 p-2.5 text-right tabular-numbers">{totals.totalCount} db</td>
              <td className="border border-stone-300 p-2.5 text-right tabular-numbers text-emerald-950 font-black text-sm">
                {formatVolume(totals.totalVolume)} m³
              </td>
              <td className="border border-stone-300 p-2.5 text-right tabular-numbers">100.0 %</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Official Signatures */}
      <div className="mt-10 pt-6 border-t border-stone-300 grid grid-cols-2 gap-10 text-xs">
        <div>
          <p className="font-bold text-stone-800 mb-8">Köbözést végezte / Átadó fél:</p>
          <div className="border-b border-stone-400 w-56 mb-1"></div>
          <p className="text-[11px] text-stone-500">cégszerű aláírás / névbélyegző</p>
        </div>
        <div>
          <p className="font-bold text-stone-800 mb-8">Faanyag átvevő / Szállító fél:</p>
          <div className="border-b border-stone-400 w-56 mb-1"></div>
          <p className="text-[11px] text-stone-500">átvevő aláírása / rendszám</p>
        </div>
      </div>

      {/* Watermark / system note */}
      <div className="mt-8 pt-3 border-t border-stone-200 flex justify-between items-center text-[10px] text-stone-400">
        <span>Erdészeti Köböző Rendszer · Hivatalos Statisztikai Számítás</span>
        <span>Generálva: {new Date().toLocaleString('hu-HU')}</span>
      </div>
    </div>
  );
};
