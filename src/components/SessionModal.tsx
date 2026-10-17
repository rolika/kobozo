import React, { useState, useEffect } from 'react';
import { ScalingSession } from '../types';
import { AVAILABLE_SPECIES, getAvailableLengthsForSpecies, normalizeSpeciesName } from '../data/kobozoData';
import { X, Trees, MapPin, Ruler, Check, FileText } from 'lucide-react';

interface SessionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (sessionData: Omit<ScalingSession, 'id' | 'createdAt' | 'updatedAt' | 'logs'> & { id?: string }) => void;
  initialSession?: ScalingSession | null;
}

const SPECIES_DISPLAY: Record<string, string> = {
  'akác': 'Akác',
  'bükk': 'Bükk',
  'fenyő': 'Fenyő',
  'tölgy': 'Tölgy'
};

export const SessionModal: React.FC<SessionModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialSession
}) => {
  const [forestryAssociation, setForestryAssociation] = useState('');
  const [depotCode, setDepotCode] = useState('');
  const [compartment, setCompartment] = useState('');
  const [treeSpecies, setTreeSpecies] = useState('tölgy');
  const [logLength, setLogLength] = useState<number>(2.0);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');

  // Available lengths for selected species
  const availableLengths = getAvailableLengthsForSpecies(treeSpecies);

  useEffect(() => {
    if (initialSession) {
      setForestryAssociation(initialSession.forestryAssociation || '');
      setDepotCode(initialSession.depotCode || '');
      setCompartment(initialSession.compartment || '');
      const normSpecies = normalizeSpeciesName(initialSession.treeSpecies || 'tölgy');
      setTreeSpecies(normSpecies);
      setLogLength(initialSession.logLength || 2.0);
      setNotes(initialSession.notes || '');
    } else {
      // Default initial state
      setForestryAssociation('');
      setDepotCode('');
      setCompartment('');
      setTreeSpecies('tölgy');
      setLogLength(2.0);
      setNotes('');
    }
    setError('');
  }, [initialSession, isOpen]);

  // If selected length is not among available lengths for the species, default to first available
  useEffect(() => {
    if (!availableLengths.includes(logLength)) {
      setLogLength(availableLengths[0] || 2.0);
    }
  }, [treeSpecies, availableLengths, logLength]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!forestryAssociation.trim()) {
      setError('Kérjük, adja meg az erdőbirtokosság nevét!');
      return;
    }
    if (!depotCode.trim()) {
      setError('Kérjük, adja meg a lerakóhely jelét vagy nevét!');
      return;
    }
    if (isNaN(logLength) || logLength <= 0) {
      setError('Kérjük, válasszon egy érvényes rönkhosszt a hivatalos statisztikai táblázatból (2,0; 2,6; 3,1 vagy 4,1 m)!');
      return;
    }

    onSave({
      id: initialSession?.id,
      forestryAssociation: forestryAssociation.trim(),
      depotCode: depotCode.trim(),
      compartment: compartment.trim(),
      treeSpecies: treeSpecies,
      logLength: Number(logLength.toFixed(1)),
      notes: notes.trim()
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-stone-200 overflow-hidden my-6">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-stone-900 text-white">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-600/40 flex items-center justify-center text-emerald-300">
              <Trees className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold">
                {initialSession ? 'Köbözési tétel szerkesztése' : 'Új köbözési tétel indítása'}
              </h2>
              <p className="text-xs text-stone-300 flex items-center gap-1">
                <FileText className="w-3 h-3 text-emerald-400" />
                <span>Hivatalos statisztikai adatok alapján</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-stone-400 hover:text-white rounded-lg transition-colors cursor-pointer"
            aria-label="Bezárás"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded-xl">
              {error}
            </div>
          )}

          {/* 1. Erdőbirtokosság neve */}
          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">
              Erdőbirtokosság neve *
            </label>
            <input
              type="text"
              required
              autoFocus
              value={forestryAssociation}
              onChange={(e) => setForestryAssociation(e.target.value)}
              placeholder="pl. Pilisi Erdőbirtokosság"
              className="w-full px-3.5 py-2.5 text-sm bg-stone-50 border border-stone-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-transparent transition"
            />
          </div>

          {/* 2. Lerakóhely jele & Erdőrészlet */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1 flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-emerald-700" />
                Lerakóhely jele *
              </label>
              <input
                type="text"
                required
                value={depotCode}
                onChange={(e) => setDepotCode(e.target.value)}
                placeholder="pl. R-14 / Alsó rakodó"
                className="w-full px-3.5 py-2.5 text-sm bg-stone-50 border border-stone-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-transparent transition"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Erdőrészlet (opcionális)
              </label>
              <input
                type="text"
                value={compartment}
                onChange={(e) => setCompartment(e.target.value)}
                placeholder="pl. 14/B vagy 28/A"
                className="w-full px-3.5 py-2.5 text-sm bg-stone-50 border border-stone-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-transparent transition"
              />
            </div>
          </div>

          {/* 3. Fafajta (kobozo.txt: akác, bükk, fenyő, tölgy) */}
          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1.5 flex items-center justify-between">
              <span className="flex items-center gap-1">
                <Trees className="w-3.5 h-3.5 text-emerald-700" />
                Fafajta (hivatalos statisztika) *
              </span>
              <span className="text-[11px] text-stone-400 font-normal">
                4 statisztikai fafaj
              </span>
            </label>
            <div className="grid grid-cols-4 gap-2">
              {AVAILABLE_SPECIES.map((sp) => {
                const isSelected = normalizeSpeciesName(treeSpecies) === sp;
                return (
                  <button
                    type="button"
                    key={sp}
                    onClick={() => setTreeSpecies(sp)}
                    className={`py-2.5 px-2 text-sm font-bold rounded-xl border text-center transition-all cursor-pointer min-h-[44px] flex items-center justify-center ${
                      isSelected
                        ? 'bg-emerald-800 text-white border-emerald-950 shadow-sm ring-2 ring-emerald-500/30'
                        : 'bg-stone-50 text-stone-800 border-stone-200 hover:bg-stone-100'
                    }`}
                  >
                    {SPECIES_DISPLAY[sp] || sp}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 4. Rönkhossz */}
          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1.5 flex items-center justify-between">
              <span className="flex items-center gap-1">
                <Ruler className="w-3.5 h-3.5 text-emerald-700" />
                Elérhető rönkhossz (hivatalos statisztika) *
              </span>
              <span className="text-[11px] text-stone-400 font-normal">
                4 statisztikai hosszméret
              </span>
            </label>
            <div className="grid grid-cols-4 gap-2">
              {availableLengths.map((len) => {
                const isSelected = Math.abs(logLength - len) < 0.05;
                const formattedLen = len.toFixed(1).replace('.', ',');
                return (
                  <button
                    type="button"
                    key={len}
                    onClick={() => setLogLength(len)}
                    className={`py-2.5 px-2 text-sm font-bold rounded-xl border text-center transition-all cursor-pointer tabular-numbers min-h-[44px] flex items-center justify-center ${
                      isSelected
                        ? 'bg-emerald-800 text-white border-emerald-950 shadow-sm ring-2 ring-emerald-500/30'
                        : 'bg-stone-50 text-stone-800 border-stone-200 hover:bg-stone-100'
                    }`}
                  >
                    {formattedLen} m
                  </button>
                );
              })}
            </div>
            <p className="text-[11px] text-stone-500 mt-2">
              Kiválasztva: <strong className="text-stone-800">{SPECIES_DISPLAY[treeSpecies] || treeSpecies}</strong> rönk, <strong className="text-stone-800">{logLength.toFixed(1).replace('.', ',')} m</strong> hosszon (88 db statisztikai köbérték 12–100 cm között, liter / 1000 = m³).
            </p>
          </div>

          {/* 5. Megjegyzés (opcionális) */}
          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">
              Egyéb megjegyzés / Szállító jármű (opcionális)
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="pl. Első osztályú rönk, szállítójegyhez"
              className="w-full px-3.5 py-2 text-sm bg-stone-50 border border-stone-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-transparent transition"
            />
          </div>

          {/* Form Actions */}
          <div className="pt-3 flex items-center justify-end gap-3 border-t border-stone-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-sm font-medium text-stone-600 hover:text-stone-900 hover:bg-stone-100 rounded-xl transition cursor-pointer"
            >
              Mégse
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 text-sm font-semibold text-white bg-emerald-700 hover:bg-emerald-800 active:scale-95 rounded-xl shadow-sm transition flex items-center gap-2 cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>{initialSession ? 'Módosítások mentése' : 'Köbözés indítása'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
