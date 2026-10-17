import { LogEntry, ScalingSession, SessionTotals, DiameterStat } from '../types';
import { getStatisticalLogVolume } from '../data/kobozoData';

/**
 * Fatérfogat számítás a kobozo.txt statisztikai köbértékei alapján
 * A literben megadott értékek 1000-rel vannak osztva, így m3-t kapunk.
 * @param diameterCm Átmérő cm-ben (12..100 cm)
 * @param lengthM Rönkhossz méterben (2.0, 2.6, 3.1, 4.1 m)
 * @param species Fafajta (akác, bükk, fenyő, tölgy)
 */
export function calculateLogVolume(
  diameterCm: number, 
  lengthM: number, 
  species: string = 'tölgy'
): number {
  if (diameterCm <= 0 || lengthM <= 0) return 0;
  return getStatisticalLogVolume(species, lengthM, diameterCm);
}

/**
 * Számított statisztikák és összesítések egy köbözési tételhez
 */
export function calculateSessionTotals(session: ScalingSession): SessionTotals {
  const logs = session.logs || [];
  
  let totalCount = 0;
  let totalVolume = 0;
  let sumWeightedDiameter = 0;
  let minDiameter = logs.length > 0 ? Infinity : 0;
  let maxDiameter = 0;

  const diameterMap = new Map<number, { count: number; volume: number }>();
  const qualityStats: Record<string, { count: number; volume: number }> = {};

  for (const log of logs) {
    const count = log.pieceCount || 1;
    // Always calculate volume from statistical table if not stored or to ensure synchronization
    const volPerUnit = log.volume !== undefined && log.volume > 0 
      ? log.volume 
      : calculateLogVolume(log.diameter, session.logLength, session.treeSpecies);
    const vol = volPerUnit * count;
    
    totalCount += count;
    totalVolume += vol;
    sumWeightedDiameter += log.diameter * count;

    if (log.diameter < minDiameter) minDiameter = log.diameter;
    if (log.diameter > maxDiameter) maxDiameter = log.diameter;

    // Átmérőcsoport
    const currentDiam = diameterMap.get(log.diameter) || { count: 0, volume: 0 };
    diameterMap.set(log.diameter, {
      count: currentDiam.count + count,
      volume: Number((currentDiam.volume + vol).toFixed(3))
    });

    // Minőségi csoport
    const qKey = log.quality || 'fűrészrönk';
    if (!qualityStats[qKey]) {
      qualityStats[qKey] = { count: 0, volume: 0 };
    }
    qualityStats[qKey].count += count;
    qualityStats[qKey].volume = Number((qualityStats[qKey].volume + vol).toFixed(3));
  }

  const avgDiameter = totalCount > 0 ? Number((sumWeightedDiameter / totalCount).toFixed(1)) : 0;
  if (minDiameter === Infinity) minDiameter = 0;

  const diameterStats: DiameterStat[] = Array.from(diameterMap.entries())
    .map(([diameter, data]) => ({
      diameter,
      count: data.count,
      totalVolume: Number(data.volume.toFixed(3)),
      percentageVolume: totalVolume > 0 ? Number(((data.volume / totalVolume) * 100).toFixed(1)) : 0,
      percentageCount: totalCount > 0 ? Number(((data.count / totalCount) * 100).toFixed(1)) : 0,
    }))
    .sort((a, b) => a.diameter - b.diameter);

  return {
    totalCount,
    totalVolume: Number(totalVolume.toFixed(3)),
    avgDiameter,
    minDiameter,
    maxDiameter,
    diameterStats,
    qualityStats
  };
}

/**
 * Szép magyar dátum formázó
 */
export function formatHungarianDate(timestamp: number): string {
  const d = new Date(timestamp);
  return d.toLocaleDateString('hu-HU', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}

/**
 * Térfogat formázása 3 tizedesjegyre
 */
export function formatVolume(vol: number): string {
  return Number(vol || 0).toLocaleString('hu-HU', {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3
  });
}

/**
 * Rönkhossz formázása magyar írásmód szerint tizedesvesszővel (pl. 2,0 m, 2,6 m)
 */
export function formatLength(len: number): string {
  return Number(len || 0).toFixed(1).replace('.', ',');
}

/**
 * CSV Export generálása Excel kompatibilis BOM-mal és pontos magyar táblázattal
 */
export function exportSessionToCsv(session: ScalingSession): string {
  const totals = calculateSessionTotals(session);
  const rows: string[] = [];

  // Fejléc adatok
  rows.push('ERDÉSZETI KÖBÖZÉSI ÉS FAÁTLALÁSI JEGYZŐKÖNYV');
  rows.push('Számítás: Hivatalos statisztikai köbözőtábla (m3)');
  rows.push(`Erdőbirtokosság neve;${session.forestryAssociation || '-'}`);
  rows.push(`Lerakóhely jele;${session.depotCode || '-'}`);
  rows.push(`Erdőrészlet;${session.compartment || '-'}`);
  rows.push(`Fafajta;${session.treeSpecies || '-'}`);
  rows.push(`Rönkhossz;${formatLength(session.logLength)} m`);
  rows.push(`Készítés ideje;${formatHungarianDate(session.createdAt)}`);
  rows.push(`Utolsó módosítás;${formatHungarianDate(session.updatedAt)}`);
  rows.push('');

  // Összesítés
  rows.push('ÖSSZESÍTÉS');
  rows.push(`Összes darabszám;${totals.totalCount} db`);
  rows.push(`Összes térfogat;${totals.totalVolume.toString().replace('.', ',')} m3`);
  rows.push(`Átlagos átmérő;${totals.avgDiameter.toString().replace('.', ',')} cm`);
  rows.push(`Legkisebb átmérő;${totals.minDiameter} cm`);
  rows.push(`Legnagyobb átmérő;${totals.maxDiameter} cm`);
  rows.push('');

  // Vastagsági osztályozás / átmérő jegyzék
  rows.push('ÁTMÉRŐ SZERINTI ÖSSZESÍTÉS (FAÁTLALÁS)');
  rows.push('Átmérő (cm);Darabszám (db);Térfogat (m3);Térfogat arány (%);Darab arány (%)');
  totals.diameterStats.forEach((stat) => {
    rows.push(
      `${stat.diameter};${stat.count};${stat.totalVolume.toString().replace('.', ',')};${stat.percentageVolume.toString().replace('.', ',')}%;${stat.percentageCount.toString().replace('.', ',')}%`
    );
  });
  rows.push('');

  // Tételes rönklista
  rows.push('TÉTELES RÖNKJEGYZÉK');
  rows.push('Sorszám;Átmérő (cm);Darab;Hossz (m);Térfogat (m3);Minőség;Időbélyeg');
  session.logs.forEach((log, index) => {
    const volPerUnit = log.volume || calculateLogVolume(log.diameter, session.logLength, session.treeSpecies);
    const rowVol = (volPerUnit * (log.pieceCount || 1)).toFixed(3).replace('.', ',');
    rows.push(
      `${index + 1};${log.diameter};${log.pieceCount || 1};${session.logLength};${rowVol};${log.quality || 'fűrészrönk'};${formatHungarianDate(log.timestamp)}`
    );
  });

  // BOM hozzáadása az ékezetek helyes megjelenítéséhez Excelben
  return '\uFEFF' + rows.join('\r\n');
}

/**
 * Fájl letöltése a böngészőben
 */
export function downloadFile(content: string, filename: string, mimeType: string = 'text/csv;charset=utf-8;'): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Szöveges összefoglaló másoláshoz
 */
export function generateSummaryText(session: ScalingSession): string {
  const totals = calculateSessionTotals(session);
  return `🌲 ERDÉSZETI KÖBÖZÉSI ÉRTESÍTŐ
Birtokosság: ${session.forestryAssociation}
Lerakóhely: ${session.depotCode}
Fafaj: ${session.treeSpecies} | Rönkhossz: ${formatLength(session.logLength)} m (hivatalos statisztikai adatok)
${session.compartment ? `Erdőrészlet: ${session.compartment}\n` : ''}
📊 ÖSSZESÍTÉS:
• Rönkök darabszáma: ${totals.totalCount} db
• Összes térfogat: ${formatVolume(totals.totalVolume)} m³
• Átlagos átmérő: ${totals.avgDiameter} cm (min: ${totals.minDiameter} cm, max: ${totals.maxDiameter} cm)
• Dátum: ${formatHungarianDate(session.updatedAt)}`;
}
