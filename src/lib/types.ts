export type UserRole = 'DIRECTOR' | 'CANTOR' | 'MUSICO';

export interface User {
  id: string;
  name: string;
  role: UserRole;
  emailOrPhone: string;
  password: string;
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
}

export interface Availability {
  serviceDateId: string;
  userId: string;
  available: boolean;
}

export interface SystemSettings {
  defaultServiceDays: number[]; // 0 for Sunday, 1 for Monday, etc. Use JS Date day indices.
}

export interface DatabaseSchema {
  users: User[];
  serviceDates: ServiceDate[];
  availabilities: Availability[];
  settings: SystemSettings;
  library: LibrarySong[];
}
