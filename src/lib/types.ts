export type UserRole = 'DIRECTOR' | 'CANTOR' | 'MUSICO' | 'VISOR';

export interface User {
  id: string;
  name: string;
  role: UserRole;
  emailOrPhone: string;
  password: string;
  active: boolean;
  visibleInRoles?: boolean;
}

export interface SectionDef {
  id: string;
  name: string;
  active: boolean;
}
export interface Song {
  id: string;
  title: string;
  artist: string;
  tone: string; // Tono asignado para ese culto específico
  version: string;
  youtubeUrl: string;
  leadSingerId?: string; // Voice assigned to sing
  section?: string;
}

// Global Library Song
export interface LibrarySong {
  id: string;
  title: string;
  artist: string;
  youtubeUrl: string;
  
  // Guardaremos el tono orgininal general
  originalTone: string;
  
  // Guardaremos un historial de qué tono le acomoda a qué cantante { userId: tone }
  userPreferredTones: Record<string, string>;
  
  // Cuántas veces se ha cantado (popularidad)
  playCount: number;

  // Indica si tiene tablatura/chord chart asociado
  hasChordChart?: boolean;
}

export type SongsStatus = 'DRAFT' | 'REVIEW' | 'APPROVED';

export interface ServiceDate {
  id: string;
  month: string;           // e.g., '2026-03'
  dateStr: string;         // e.g., '2026-03-01'
  dayName: string;         // e.g., 'Domingo 1'
  locked: boolean;
  directorId?: string;     // Single Cantor to lead (Amarillo)
  acompaniantesIds: string[]; // Multiple Cantores to support (Rosado)
  songs: Song[];
  songsStatus?: SongsStatus; 
  playlistUrl?: string;
  wasRejected?: boolean;
}

export interface Availability {
  serviceDateId: string;
  userId: string;
  available: boolean;
}

export interface SongSuggestion {
  id: string;
  serviceDateId: string;
  userId: string;          // who suggested it
  title: string;
  artist: string;
  category: string; // ID of the section
  createdAt: string;       // ISO timestamp
}

export type ChordNotation = 'letters' | 'solfege';

export interface SystemSettings {
  defaultServiceDays: number[]; // 0 for Sunday, 1 for Monday, etc. Use JS Date day indices.
  sections?: SectionDef[];
  defaultMonth?: string; // e.g., '2026-04'
  chordNotation?: ChordNotation; // 'letters' = A,B,C | 'solfege' = Do,Re,Mi
}

export interface DatabaseSchema {
  users: User[];
  serviceDates: ServiceDate[];
  availabilities: Availability[];
  settings: SystemSettings;
  library: LibrarySong[];
  suggestions: SongSuggestion[];
  chordCharts: ChordChart[];
}

// --- Chord Chart / Tablatura Types ---

export type ChordChartSectionType = 
  | 'intro' | 'verse' | 'pre_chorus' | 'chorus' | 'bridge'
  | 'interlude' | 'outro' | 'tag' | 'instrumental' | 'custom';

// Posición de un acorde sobre la letra
export interface ChordPosition {
  chord: string;    // "Am7", "G/B", "Csus4"
  position: number; // Índice del carácter en lyrics donde va el acorde
}

// Una línea con letra y acordes posicionados
export interface ChordLine {
  id: string;
  lyrics: string;          // "Digno eres Señor de gloria"
  chords: ChordPosition[]; // Acordes posicionados sobre la letra
}

// Representa una sección individual del chord chart
export interface ChordChartSection {
  id: string;
  type: ChordChartSectionType;
  label: string;       // Ej: "Verso 1", "Coro", "Puente Instrumental"
  lines: ChordLine[];
}

// Elemento de la estructura de ejecución
export interface StructureItem {
  sectionId: string;   // Referencia al id de ChordChartSection
  repeats: number;     // Cantidad de veces (default: 1)
}

// El documento completo del chord chart
export interface ChordChart {
  id: string;
  librarySongId: string;   // Vinculado a la canción en Library
  originalKey: string;     // Tonalidad original: "G", "Am", etc.
  tempo?: number;          // BPM opcional
  timeSignature?: string;  // "4/4", "3/4", "6/8"
  capo?: number;           // Posición del capo (0-11)
  sections: ChordChartSection[];
  structure: StructureItem[];  // Orden de ejecución
  notes?: string;          // Notas generales del director
  chordProSource?: string; // Fuente ChordPro original (si se importó)
  createdBy: string;       // userId del creador
  updatedAt: string;       // ISO timestamp
  createdAt: string;       // ISO timestamp
}
