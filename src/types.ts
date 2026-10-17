export type LogQuality = 'I' | 'II' | 'III' | 'fűrészrönk' | 'kivágás' | 'raklapfa' | 'rostfa';

export interface LogEntry {
  id: string;
  diameter: number; // Átmérő cm-ben (középátmérő)
  volume: number; // Térfogat m³-ben
  quality: LogQuality; // Minőségi osztály
  pieceCount: number; // Darabszám (alapesetben 1 db)
  timestamp: number; // Rögzítés időpontja
  notes?: string;
}

export interface ScalingSession {
  id: string;
  forestryAssociation: string; // Erdőbirtokosság neve
  depotCode: string; // Lerakóhely / Lerakó jele
  compartment?: string; // Erdőrészlet (pl. 14/C)
  treeSpecies: string; // Fafajta (pl. Kocsánytalan tölgy, Bükk, Akác, Fenyő)
  logLength: number; // Rönkhossz méterben (pl. 4.0 m)
  notes?: string; // Egyéb megjegyzés
  logs: LogEntry[]; // Rögzített rönkök jegyzéke
  createdAt: number;
  updatedAt: number;
}

export interface DiameterStat {
  diameter: number;
  count: number;
  totalVolume: number;
  percentageVolume: number;
  percentageCount: number;
}

export interface SessionTotals {
  totalCount: number;
  totalVolume: number;
  avgDiameter: number;
  minDiameter: number;
  maxDiameter: number;
  diameterStats: DiameterStat[];
  qualityStats: Record<string, { count: number; volume: number }>;
}
