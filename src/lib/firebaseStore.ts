import { firestore } from './firebase';
import { 
  collection, doc, getDocs, getDoc, setDoc, updateDoc, deleteDoc,
  query, where, writeBatch, addDoc
} from 'firebase/firestore';
import { User, ServiceDate, Availability, Song, LibrarySong, SystemSettings, SectionDef } from './types';

const DEFAULT_SECTIONS: SectionDef[] = [
  { id: 'ALABANZAS', name: 'Alabanzas', active: true },
  { id: 'ADORACIÓN', name: 'Adoración', active: true },
  { id: 'OFRENDA', name: 'Ofrenda', active: true },
  { id: 'DESPEDIDA', name: 'Despedida', active: true }
];

// Colecciones de Firestore
const USERS_COL = 'users';
const SERVICE_DATES_COL = 'serviceDates';
const AVAILABILITIES_COL = 'availabilities';
const LIBRARY_COL = 'library';
const SETTINGS_DOC = 'settings/global';

// --- USERS ---

export async function getUsers(): Promise<User[]> {
  const snap = await getDocs(collection(firestore, USERS_COL));
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as User));
}

export async function getActiveUsers(): Promise<User[]> {
  const q = query(collection(firestore, USERS_COL), where('active', '==', true));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as User));
}

export async function getUserByUsername(username: string): Promise<User | null> {
  const q = query(collection(firestore, USERS_COL), where('emailOrPhone', '==', username));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const docSnap = snap.docs[0];
  return { id: docSnap.id, ...docSnap.data() } as User;
}

export async function addUser(user: Omit<User, 'id'>): Promise<string> {
  const docRef = await addDoc(collection(firestore, USERS_COL), user);
  return docRef.id;
}

export async function updateUser(user: User): Promise<void> {
  const { id, ...data } = user;
  await updateDoc(doc(firestore, USERS_COL, id), data as Record<string, unknown>);
}

export async function deleteUser(userId: string): Promise<void> {
  await deleteDoc(doc(firestore, USERS_COL, userId));
}

// --- SERVICE DATES ---

export async function getAllServiceDates(): Promise<ServiceDate[]> {
  const snap = await getDocs(collection(firestore, SERVICE_DATES_COL));
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as ServiceDate));
}

export async function getServiceDatesByMonth(month: string): Promise<ServiceDate[]> {
  const q = query(collection(firestore, SERVICE_DATES_COL), where('month', '==', month));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as ServiceDate));
}

export async function addServiceDate(serviceDate: Omit<ServiceDate, 'id'>): Promise<string> {
  const docRef = await addDoc(collection(firestore, SERVICE_DATES_COL), serviceDate);
  return docRef.id;
}

export async function updateServiceDate(serviceDate: ServiceDate): Promise<void> {
  const { id, ...data } = serviceDate;
  await setDoc(doc(firestore, SERVICE_DATES_COL, id), data);
}

export async function deleteServiceDate(serviceDateId: string): Promise<void> {
  await deleteDoc(doc(firestore, SERVICE_DATES_COL, serviceDateId));
  // Also delete associated availabilities
  const q = query(collection(firestore, AVAILABILITIES_COL), where('serviceDateId', '==', serviceDateId));
  const snap = await getDocs(q);
  const batch = writeBatch(firestore);
  snap.docs.forEach(d => batch.delete(d.ref));
  await batch.commit();
}

// --- AVAILABILITIES ---

export async function getAvailabilities(serviceDateId: string): Promise<Availability[]> {
  const q = query(collection(firestore, AVAILABILITIES_COL), where('serviceDateId', '==', serviceDateId));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ ...d.data(), _docId: d.id } as Availability & { _docId: string }));
}

export async function getAvailabilitiesByDateIds(dateIds: string[]): Promise<Availability[]> {
  if (dateIds.length === 0) return [];
  
  // Firestore 'in' operator supports up to 30 values.
  const chunks: string[][] = [];
  for (let i = 0; i < dateIds.length; i += 30) {
    chunks.push(dateIds.slice(i, i + 30));
  }

  const results: Availability[] = [];
  for (const chunk of chunks) {
    const q = query(collection(firestore, AVAILABILITIES_COL), where('serviceDateId', 'in', chunk));
    const snap = await getDocs(q);
    results.push(...snap.docs.map(d => ({ ...d.data(), _docId: d.id } as Availability & { _docId: string })));
  }
  return results;
}

export async function setAvailability(serviceDateId: string, userId: string, available: boolean): Promise<void> {
  const q = query(
    collection(firestore, AVAILABILITIES_COL),
    where('serviceDateId', '==', serviceDateId),
    where('userId', '==', userId)
  );
  const snap = await getDocs(q);
  
  if (!snap.empty) {
    await updateDoc(snap.docs[0].ref, { available });
  } else {
    await addDoc(collection(firestore, AVAILABILITIES_COL), { serviceDateId, userId, available });
  }
}

// --- LIBRARY ---

export async function getLibrary(): Promise<LibrarySong[]> {
  const snap = await getDocs(collection(firestore, LIBRARY_COL));
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as LibrarySong));
}

export async function addOrUpdateLibrarySong(song: Song): Promise<void> {
  const allLibrary = await getLibrary();
  const searchTitle = song.title.trim().toLowerCase();
  const existing = allLibrary.find(l => l.title.trim().toLowerCase() === searchTitle);
  
  if (existing) {
    const updates: Record<string, unknown> = {
      playCount: (existing.playCount || 0) + 1
    };
    if (song.leadSingerId && song.tone) {
      updates[`userPreferredTones.${song.leadSingerId}`] = song.tone;
    }
    if (song.youtubeUrl && !existing.youtubeUrl) updates.youtubeUrl = song.youtubeUrl;
    if (song.artist && (!existing.artist || existing.artist === 'Desconocido')) updates.artist = song.artist;
    await updateDoc(doc(firestore, LIBRARY_COL, existing.id), updates);
  } else {
    await addDoc(collection(firestore, LIBRARY_COL), {
      title: song.title.trim(),
      artist: song.artist || 'Desconocido',
      youtubeUrl: song.youtubeUrl || '',
      originalTone: (song.tone && song.tone !== 'Desconocido') ? song.tone : 'Desconocido',
      userPreferredTones: (song.leadSingerId && song.tone) ? { [song.leadSingerId]: song.tone } : {},
      playCount: 1
    });
  }
}

export async function addLibrarySongDirectly(newSong: Omit<LibrarySong, 'id'>): Promise<void> {
  await addDoc(collection(firestore, LIBRARY_COL), newSong);
}

export async function updateLibrarySongDirectly(updatedSong: LibrarySong): Promise<void> {
  const { id, ...data } = updatedSong;
  await setDoc(doc(firestore, LIBRARY_COL, id), data);
}

export async function deleteLibrarySong(songId: string): Promise<void> {
  await deleteDoc(doc(firestore, LIBRARY_COL, songId));
}

export async function syncAllSongsToLibrary(): Promise<void> {
  const allDates = await getAllServiceDates();
  const allLibrary = await getLibrary();
  
  const libraryMap = new Map<string, LibrarySong>();
  allLibrary.forEach(l => libraryMap.set(l.title.trim().toLowerCase(), l));

  const batch = writeBatch(firestore);
  let modified = false;

  const newSongs: Record<string, unknown>[] = [];

  allDates.forEach(date => {
    date.songs.forEach(song => {
      const titleKey = song.title.trim().toLowerCase();
      const libSong = libraryMap.get(titleKey);

      if (!libSong) {
        const newLibSong: Omit<LibrarySong, 'id'> = {
          title: song.title.trim(),
          artist: song.artist || 'Desconocido',
          youtubeUrl: song.youtubeUrl || '',
          originalTone: (song.tone && song.tone !== 'Desconocido') ? song.tone : 'Desconocido',
          userPreferredTones: (song.leadSingerId && song.tone && song.tone !== 'Desconocido')
               ? { [song.leadSingerId]: song.tone }
               : {},
          playCount: 1
        };
        newSongs.push(newLibSong);
        // Add to map so we don't double-add
        libraryMap.set(titleKey, { id: 'pending', ...newLibSong } as LibrarySong);
        modified = true;
      } else {
        let needsUpdate = false;
        if (song.leadSingerId && song.tone && song.tone !== 'Desconocido') {
          if (libSong.userPreferredTones[song.leadSingerId] !== song.tone) {
            libSong.userPreferredTones[song.leadSingerId] = song.tone;
            needsUpdate = true;
          }
        }
        if (song.youtubeUrl && !libSong.youtubeUrl) {
          libSong.youtubeUrl = song.youtubeUrl;
          needsUpdate = true;
        }
        if (song.artist && libSong.artist === 'Desconocido') {
          libSong.artist = song.artist;
          needsUpdate = true;
        }
        if (needsUpdate && libSong.id !== 'pending') {
          const { id, ...data } = libSong;
          batch.update(doc(firestore, LIBRARY_COL, id), data as Record<string, unknown>);
          modified = true;
        }
      }
    });
  });

  // Commit batch updates for existing songs
  if (modified) {
    await batch.commit();
  }
  // Add brand new songs
  for (const ns of newSongs) {
    await addDoc(collection(firestore, LIBRARY_COL), ns);
  }
}

// --- SETTINGS ---

export async function getSettings(): Promise<SystemSettings> {
  const docSnap = await getDoc(doc(firestore, 'settings', 'global'));
  if (docSnap.exists()) {
    const data = docSnap.data() as SystemSettings;
    if (!data.sections || data.sections.length === 0) {
      data.sections = DEFAULT_SECTIONS;
      await updateSettings(data);
    }
    return data;
  }
  const defaultSettings: SystemSettings = { defaultServiceDays: [0, 2], sections: DEFAULT_SECTIONS };
  await setDoc(doc(firestore, 'settings', 'global'), defaultSettings);
  return defaultSettings;
}

export async function updateSettings(settings: SystemSettings): Promise<void> {
  await setDoc(doc(firestore, 'settings', 'global'), settings);
}

export async function isSectionInUse(sectionId: string): Promise<boolean> {
  const allDates = await getAllServiceDates();
  for (const date of allDates) {
    if (date.songs.some(s => s.section === sectionId)) {
      return true;
    }
  }
  return false;
}

// --- INTELLIGENCE QUERIES ---

export async function checkSongInMonth(month: string, searchTitle: string): Promise<string[]> {
  const serviceDates = await getServiceDatesByMonth(month);
  const uses: string[] = [];
  const searchLow = searchTitle.trim().toLowerCase();

  serviceDates.forEach(sd => {
    const found = sd.songs.find(s => s.title.trim().toLowerCase() === searchLow);
    if (found) {
      uses.push(sd.dayName);
    }
  });

  return uses;
}

// --- SEED INITIAL DATA ---

export async function seedInitialData(): Promise<void> {
  // Check si ya existe data
  const usersSnap = await getDocs(collection(firestore, USERS_COL));
  if (!usersSnap.empty) return; // Ya tiene datos, no sobrescribir

  const initialUsers: Omit<User, 'id'>[] = [
    { name: 'Director General', role: 'DIRECTOR', emailOrPhone: 'admin', password: 'admin123', active: true },
    { name: 'Sayda', role: 'CANTOR', emailOrPhone: 'sayda', password: '1234', active: true },
    { name: 'Maryin', role: 'CANTOR', emailOrPhone: 'maryin', password: '1234', active: true },
    { name: 'Valeria', role: 'CANTOR', emailOrPhone: 'valeria', password: '1234', active: true },
    { name: 'Miguel', role: 'CANTOR', emailOrPhone: 'miguel', password: '1234', active: true },
    { name: 'Ervin', role: 'CANTOR', emailOrPhone: 'ervin', password: '1234', active: true },
    { name: 'Músico 1', role: 'MUSICO', emailOrPhone: 'musico1', password: '1234', active: true },
  ];

  for (const u of initialUsers) {
    await addDoc(collection(firestore, USERS_COL), u);
  }

  // Settings por defecto
  await setDoc(doc(firestore, 'settings', 'global'), { defaultServiceDays: [0, 2], sections: DEFAULT_SECTIONS });
}
