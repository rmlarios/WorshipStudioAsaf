import {
  ChordChart, ChordChartSection, ChordLine, ChordPosition,
  ChordChartSectionType, StructureItem
} from './types';

// ── Chromatic Scales ──────────────────────────────────────────────────
const SHARPS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const FLATS  = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

// Solfege equivalents
const SOLFEGE_SHARPS = ['Do', 'Do#', 'Re', 'Re#', 'Mi', 'Fa', 'Fa#', 'Sol', 'Sol#', 'La', 'La#', 'Si'];
const SOLFEGE_FLATS  = ['Do', 'Reb', 'Re', 'Mib', 'Mi', 'Fa', 'Solb', 'Sol', 'Lab', 'La', 'Sib', 'Si'];

// Keys that conventionally use flats
const FLAT_KEYS = new Set(['F', 'Bb', 'Eb', 'Ab', 'Db', 'Gb',
  'Dm', 'Gm', 'Cm', 'Fm', 'Bbm', 'Ebm']);

// Solfege ↔ Letter mappings
const SOLFEGE_TO_LETTER: Record<string, string> = {
  'Do': 'C', 'Re': 'D', 'Mi': 'E', 'Fa': 'F',
  'Sol': 'G', 'La': 'A', 'Si': 'B'
};
const LETTER_TO_SOLFEGE: Record<string, string> = {
  'C': 'Do', 'D': 'Re', 'E': 'Mi', 'F': 'Fa',
  'G': 'Sol', 'A': 'La', 'B': 'Si'
};

// ── Note Parsing ──────────────────────────────────────────────────────

/**
 * Parse a note name (e.g. "C#", "Bb", "Sol#", "Mib") to its chromatic index (0-11).
 * Returns -1 if the note cannot be parsed.
 */
function noteToIndex(note: string): number {
  // Normalize solfege to letters first
  const normalized = solfegeNoteToLetter(note);
  let idx = SHARPS.indexOf(normalized);
  if (idx !== -1) return idx;
  idx = FLATS.indexOf(normalized);
  return idx;
}

/**
 * Convert a single solfege root to its letter equivalent.
 * "Sol#" → "G#", "Reb" → "Db", "La" → "A"
 */
function solfegeNoteToLetter(note: string): string {
  // Try matching the longest solfege root first ("Sol" before "Si")
  const solfegeRoots = ['Sol', 'Do', 'Re', 'Mi', 'Fa', 'La', 'Si'];
  for (const s of solfegeRoots) {
    if (note.startsWith(s)) {
      const suffix = note.slice(s.length); // "#", "b", or ""
      return (SOLFEGE_TO_LETTER[s] || s) + suffix;
    }
  }
  return note;
}

/**
 * Convert a letter root to solfege. "G#" → "Sol#", "Db" → "Reb"
 */
function letterNoteToSolfege(note: string): string {
  // Match letter root (A-G) + optional accidental (#, b)
  const match = note.match(/^([A-G])(#|b)?$/);
  if (!match) return note;
  const [, letter, accidental = ''] = match;
  return (LETTER_TO_SOLFEGE[letter] || letter) + accidental;
}

// ── Chord Parsing ─────────────────────────────────────────────────────

/**
 * Parse a chord string into root, quality, and optional bass note.
 * "Am7/G" → { root: "A", quality: "m7", bass: "G" }
 * "C#sus4" → { root: "C#", quality: "sus4", bass: undefined }
 * "Solm" → { root: "Sol", quality: "m", bass: undefined }
 */
interface ParsedChord {
  root: string;
  quality: string;
  bass?: string;
}

function parseChord(chord: string): ParsedChord | null {
  if (!chord || chord.trim() === '') return null;
  
  const trimmed = chord.trim();
  
  // Handle bass note first (split by /)
  let mainPart = trimmed;
  let bass: string | undefined;
  const slashIdx = trimmed.lastIndexOf('/');
  if (slashIdx > 0) {
    mainPart = trimmed.substring(0, slashIdx);
    bass = trimmed.substring(slashIdx + 1);
  }
  
  // Try solfege roots first (longer matches)
  const solfegeRoots = ['Sol', 'Do', 'Re', 'Mi', 'Fa', 'La', 'Si'];
  for (const s of solfegeRoots) {
    if (mainPart.startsWith(s)) {
      const afterRoot = mainPart.slice(s.length);
      let root = s;
      let quality = afterRoot;
      if (afterRoot.startsWith('#') || afterRoot.startsWith('b')) {
        root = s + afterRoot[0];
        quality = afterRoot.slice(1);
      }
      return { root, quality, bass };
    }
  }
  
  // Try letter roots (A-G)
  const letterMatch = mainPart.match(/^([A-G])(#|b)?(.*)/);
  if (letterMatch) {
    const [, letter, accidental = '', quality] = letterMatch;
    return { root: letter + accidental, quality, bass };
  }
  
  return null;
}

// ── Transposition ─────────────────────────────────────────────────────

/**
 * Determine whether a key conventionally uses flats or sharps.
 */
export function getKeySignatureType(key: string): 'sharp' | 'flat' {
  const letterKey = solfegeNoteToLetter(key);
  // Strip minor suffix
  const normalized = letterKey.replace(/m$/, '') + (letterKey.endsWith('m') ? 'm' : '');
  return FLAT_KEYS.has(normalized) ? 'flat' : 'sharp';
}

/**
 * Get the number of semitones between two keys.
 */
export function getSemitonesBetween(fromKey: string, toKey: string): number {
  // Strip minor indicator for both
  const fromNote = fromKey.replace(/m$/, '');
  const toNote = toKey.replace(/m$/, '');
  const fromIdx = noteToIndex(fromNote);
  const toIdx = noteToIndex(toNote);
  if (fromIdx === -1 || toIdx === -1) return 0;
  return ((toIdx - fromIdx) + 12) % 12;
}

/**
 * Transpose a single note by a number of semitones.
 */
function transposeNote(note: string, semitones: number, useFlats: boolean, useSolfege: boolean): string {
  const letterNote = solfegeNoteToLetter(note);
  const idx = noteToIndex(letterNote);
  if (idx === -1) return note;
  
  const newIdx = ((idx + semitones) % 12 + 12) % 12;
  
  if (useSolfege) {
    return useFlats ? SOLFEGE_FLATS[newIdx] : SOLFEGE_SHARPS[newIdx];
  }
  return useFlats ? FLATS[newIdx] : SHARPS[newIdx];
}

/**
 * Transpose a full chord string preserving quality and bass.
 */
export function transposeChord(
  chord: string,
  semitones: number,
  useFlats = false,
  useSolfege = false
): string {
  if (semitones === 0 && !useSolfege) return chord;
  
  const parsed = parseChord(chord);
  if (!parsed) return chord;
  
  const newRoot = transposeNote(parsed.root, semitones, useFlats, useSolfege);
  let result = newRoot + parsed.quality;
  
  if (parsed.bass) {
    const newBass = transposeNote(parsed.bass, semitones, useFlats, useSolfege);
    result += '/' + newBass;
  }
  
  return result;
}

/**
 * Transpose all chords in a line.
 */
export function transposeLine(
  chords: ChordPosition[],
  semitones: number,
  useFlats = false,
  useSolfege = false
): ChordPosition[] {
  return chords.map(cp => ({
    ...cp,
    chord: transposeChord(cp.chord, semitones, useFlats, useSolfege)
  }));
}

/**
 * Transpose an entire chord chart to a new key.
 * Returns a new chart object (does not mutate the original).
 */
export function transposeChart(
  chart: ChordChart,
  targetKey: string
): ChordChart {
  const semitones = getSemitonesBetween(chart.originalKey, targetKey);
  if (semitones === 0) return chart;
  
  const useFlats = getKeySignatureType(targetKey) === 'flat';
  
  return {
    ...chart,
    originalKey: targetKey,
    sections: chart.sections.map(section => ({
      ...section,
      lines: section.lines.map(line => ({
        ...line,
        chords: transposeLine(line.chords, semitones, useFlats)
      }))
    }))
  };
}

// ── Solfege Conversion ────────────────────────────────────────────────

/**
 * Convert a chord from letter notation to solfege. "Am7/G" → "Lam7/Sol"
 */
export function chordToSolfege(chord: string): string {
  const parsed = parseChord(chord);
  if (!parsed) return chord;
  
  const root = letterNoteToSolfege(solfegeNoteToLetter(parsed.root));
  let result = root + parsed.quality;
  if (parsed.bass) {
    result += '/' + letterNoteToSolfege(solfegeNoteToLetter(parsed.bass));
  }
  return result;
}

/**
 * Convert a chord from solfege to letter notation. "Lam7/Sol" → "Am7/G"
 */
export function chordFromSolfege(chord: string): string {
  const parsed = parseChord(chord);
  if (!parsed) return chord;
  
  const root = solfegeNoteToLetter(parsed.root);
  let result = root + parsed.quality;
  if (parsed.bass) {
    result += '/' + solfegeNoteToLetter(parsed.bass);
  }
  return result;
}

// ── All Keys List ─────────────────────────────────────────────────────

export const ALL_KEYS = [
  'C', 'C#', 'Db', 'D', 'D#', 'Eb', 'E', 'F',
  'F#', 'Gb', 'G', 'G#', 'Ab', 'A', 'A#', 'Bb', 'B',
  'Cm', 'C#m', 'Dm', 'D#m', 'Ebm', 'Em', 'Fm',
  'F#m', 'Gm', 'G#m', 'Am', 'A#m', 'Bbm', 'Bm'
];

export const ALL_KEYS_SOLFEGE = [
  'Do', 'Do#', 'Reb', 'Re', 'Re#', 'Mib', 'Mi', 'Fa',
  'Fa#', 'Solb', 'Sol', 'Sol#', 'Lab', 'La', 'La#', 'Sib', 'Si',
  'Dom', 'Do#m', 'Rem', 'Re#m', 'Mibm', 'Mim', 'Fam',
  'Fa#m', 'Solm', 'Sol#m', 'Lam', 'La#m', 'Sibm', 'Sim'
];

// ── Section Type Helpers ──────────────────────────────────────────────

export const SECTION_TYPE_LABELS: Record<ChordChartSectionType, string> = {
  intro: 'Intro',
  verse: 'Verso',
  pre_chorus: 'Pre-Coro',
  chorus: 'Coro',
  bridge: 'Puente',
  interlude: 'Interludio',
  outro: 'Outro / Final',
  tag: 'Tag',
  instrumental: 'Instrumental',
  custom: 'Personalizado'
};

export const SECTION_TYPE_COLORS: Record<ChordChartSectionType, string> = {
  intro: 'border-cyan-500/40 bg-cyan-500/5',
  verse: 'border-neutral-500/40 bg-neutral-500/5',
  pre_chorus: 'border-amber-500/40 bg-amber-500/5',
  chorus: 'border-pink-500/40 bg-pink-500/5',
  bridge: 'border-purple-500/40 bg-purple-500/5',
  interlude: 'border-teal-500/40 bg-teal-500/5',
  outro: 'border-orange-500/40 bg-orange-500/5',
  tag: 'border-lime-500/40 bg-lime-500/5',
  instrumental: 'border-blue-500/40 bg-blue-500/5',
  custom: 'border-neutral-600/40 bg-neutral-600/5'
};

export const SECTION_TYPE_BADGE_COLORS: Record<ChordChartSectionType, string> = {
  intro: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
  verse: 'bg-neutral-500/20 text-neutral-300 border-neutral-500/30',
  pre_chorus: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  chorus: 'bg-pink-500/20 text-pink-400 border-pink-500/30',
  bridge: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  interlude: 'bg-teal-500/20 text-teal-400 border-teal-500/30',
  outro: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  tag: 'bg-lime-500/20 text-lime-400 border-lime-500/30',
  instrumental: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  custom: 'bg-neutral-600/20 text-neutral-400 border-neutral-600/30'
};

// Short labels for structure pills
export const SECTION_TYPE_SHORT: Record<ChordChartSectionType, string> = {
  intro: 'I',
  verse: 'V',
  pre_chorus: 'PC',
  chorus: 'C',
  bridge: 'P',
  interlude: 'Int',
  outro: 'O',
  tag: 'T',
  instrumental: 'Inst',
  custom: '?'
};

// ── ChordPro Parser ───────────────────────────────────────────────────

/**
 * Parse a ChordPro formatted string into a ChordChart object.
 */
export function parseChordPro(
  source: string,
  librarySongId: string,
  userId: string
): ChordChart {
  const lines = source.split('\n');
  const sections: ChordChartSection[] = [];
  let currentSection: ChordChartSection | null = null;
  let title = '';
  let artist = '';
  let key = '';
  let tempo: number | undefined;
  let timeSignature: string | undefined;
  let capo: number | undefined;
  
  const genId = () => Math.random().toString(36).substring(2, 9);
  
  for (const rawLine of lines) {
    const line = rawLine.trim();
    
    // Skip empty lines
    if (!line) continue;
    
    // Skip comments
    if (line.startsWith('#')) continue;
    
    // Parse directives {key: value}
    const directiveMatch = line.match(/^\{(\w+)(?::?\s*(.*))?\}$/);
    if (directiveMatch) {
      const [, directive, value = ''] = directiveMatch;
      const dir = directive.toLowerCase();
      const val = value.trim();
      
      switch (dir) {
        case 'title': case 't':
          title = val;
          break;
        case 'artist': case 'a': case 'subtitle': case 'st':
          artist = val;
          break;
        case 'key': case 'k':
          key = val;
          break;
        case 'tempo':
          tempo = parseInt(val) || undefined;
          break;
        case 'time':
          timeSignature = val || undefined;
          break;
        case 'capo':
          capo = parseInt(val) || undefined;
          break;
        case 'start_of_chorus': case 'soc':
          currentSection = {
            id: genId(), type: 'chorus',
            label: val || 'Coro', lines: []
          };
          break;
        case 'end_of_chorus': case 'eoc':
          if (currentSection) { sections.push(currentSection); currentSection = null; }
          break;
        case 'start_of_verse': case 'sov':
          currentSection = {
            id: genId(), type: 'verse',
            label: val || `Verso ${sections.filter(s => s.type === 'verse').length + 1}`,
            lines: []
          };
          break;
        case 'end_of_verse': case 'eov':
          if (currentSection) { sections.push(currentSection); currentSection = null; }
          break;
        case 'start_of_bridge': case 'sob':
          currentSection = {
            id: genId(), type: 'bridge',
            label: val || 'Puente', lines: []
          };
          break;
        case 'end_of_bridge': case 'eob':
          if (currentSection) { sections.push(currentSection); currentSection = null; }
          break;
        case 'start_of_tab': case 'sot':
          currentSection = {
            id: genId(), type: 'instrumental',
            label: val || 'Tab', lines: []
          };
          break;
        case 'end_of_tab': case 'eot':
          if (currentSection) { sections.push(currentSection); currentSection = null; }
          break;
        case 'comment': case 'c': {
          // Comments like {c: Intro} can define a section
          const sectionType = detectSectionType(val);
          if (sectionType) {
            if (currentSection && currentSection.lines.length > 0) {
              sections.push(currentSection);
            }
            currentSection = {
              id: genId(), type: sectionType,
              label: val, lines: []
            };
          }
          break;
        }
        default:
          break;
      }
      continue;
    }
    
    // Check if the line is a section header in brackets, e.g. [Intro], [Verso], [Coro], [Puente / Modulación], [Final]
    const bracketSectionMatch = line.match(/^\[([^\]]+)\]$/);
    if (bracketSectionMatch) {
      const labelText = bracketSectionMatch[1].trim();
      const detectedType = detectSectionType(labelText);
      if (detectedType) {
        if (currentSection && currentSection.lines.length > 0) {
          sections.push(currentSection);
        }
        currentSection = {
          id: genId(),
          type: detectedType,
          label: labelText,
          lines: []
        };
        continue;
      }
    }

    // Parse content lines with inline chords: [Am]Hello [G]world
    if (!currentSection) {
      // Auto-create a section if needed
      currentSection = {
        id: genId(), type: 'verse',
        label: `Verso ${sections.filter(s => s.type === 'verse').length + 1}`,
        lines: []
      };
    }
    
    const { lyrics, chords } = parseChordProLine(line);
    currentSection.lines.push({
      id: genId(),
      lyrics,
      chords
    });
  }
  
  // Push last section
  if (currentSection && currentSection.lines.length > 0) {
    sections.push(currentSection);
  }
  
  // Build structure (default: each section once, in order)
  const structure: StructureItem[] = sections.map(s => ({
    sectionId: s.id,
    repeats: 1
  }));
  
  const now = new Date().toISOString();
  
  return {
    id: '',
    librarySongId,
    originalKey: key || 'C',
    tempo,
    timeSignature,
    capo,
    sections,
    structure,
    notes: '',
    chordProSource: source,
    createdBy: userId,
    updatedAt: now,
    createdAt: now
  };
}

/**
 * Parse a single ChordPro line: "[Am]Hello [G]world" →
 * { lyrics: "Hello world", chords: [{ chord: "Am", position: 0 }, { chord: "G", position: 6 }] }
 * Automatically skips section header tokens if encountered inline.
 */
function parseChordProLine(line: string): { lyrics: string; chords: ChordPosition[] } {
  const chords: ChordPosition[] = [];
  let lyrics = '';
  let i = 0;
  let virtualPos = 0;
  
  while (i < line.length) {
    if (line[i] === '[') {
      const end = line.indexOf(']', i);
      if (end !== -1) {
        const token = line.substring(i + 1, end).trim();
        // Check if token is a section header or a chord
        if (detectSectionType(token) !== null && !parseChord(token)) {
          // Skip section token inside a line
          i = end + 1;
        } else {
          // Ensure non-overlapping position if lyrics between chords are short/empty
          let pos = lyrics.length;
          if (chords.length > 0) {
            const lastChord = chords[chords.length - 1];
            const minPos = lastChord.position + Math.max(lastChord.chord.length + 2, 8);
            if (pos < minPos && lyrics.trim() === '') {
              pos = Math.max(pos, virtualPos);
            }
          }
          chords.push({ chord: token, position: pos });
          virtualPos = pos + token.length + 3;
          i = end + 1;
        }
      } else {
        lyrics += line[i];
        i++;
      }
    } else {
      lyrics += line[i];
      i++;
    }
  }
  
  return { lyrics, chords };
}

// ── Diatonic Chord Generator for Quick-Bar ────────────────────────────

/**
 * Generate common diatonic and slash chords for a given key.
 * For G Major: G, Am, Bm, C, D, Em, D/F#, G/B, Gmaj7, Cadd9, Am7, Em7
 */
export function getDiatonicChords(key: string, useSolfege = false): string[] {
  const normKey = solfegeNoteToLetter(key.replace(/m$/, ''));
  const isMinor = key.endsWith('m');
  const semitones = getSemitonesBetween('C', normKey);
  const useFlats = getKeySignatureType(key) === 'flat';
  
  let baseChords: string[];
  if (!isMinor) {
    // Major key diatonic degrees: I, ii, iii, IV, V, vi, V/iii, slash chords
    baseChords = [
      'C', 'Dm', 'Em', 'F', 'G', 'Am',
      'G/B', 'C/E', 'F/A',
      'Cmaj7', 'Cadd9', 'Dm7', 'Em7', 'Fmaj7', 'G7', 'Gsus4', 'Am7'
    ];
  } else {
    // Minor key degrees: i, ii°, III, iv, v/V, VI, VII
    baseChords = [
      'Am', 'Bdim', 'C', 'Dm', 'Em', 'E7', 'F', 'G',
      'C/E', 'G/B',
      'Am7', 'Dm7', 'Em7', 'Fmaj7', 'G7', 'Asus4'
    ];
  }

  const transposed = baseChords.map(c => transposeChord(c, semitones, useFlats, useSolfege));
  // Remove duplicates while keeping order
  return Array.from(new Set(transposed));
}

/**
 * Detect section type from a label string (Spanish and English).
 * Supports strings like "[Intro]", "[Verso]", "[Puente / Modulación]", "Coro", etc.
 */
export function detectSectionType(label: string): ChordChartSectionType | null {
  const clean = label.replace(/^\[+|\]+$/g, '').trim();
  const lower = clean.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  
  if (/^(intro|introduccion)/.test(lower)) return 'intro';
  if (/^(verso|estrofa|verse|stanza)/.test(lower)) return 'verse';
  if (/^(pre.?coro|pre.?chorus)/.test(lower)) return 'pre_chorus';
  if (/^(coro|chorus|estribillo)/.test(lower)) return 'chorus';
  if (/^(puente|bridge)/.test(lower)) return 'bridge';
  if (/^(interludio|interlude)/.test(lower)) return 'interlude';
  if (/^(outro|final|ending|cierre)/.test(lower)) return 'outro';
  if (/^(tag|coletilla)/.test(lower)) return 'tag';
  if (/^(instrumental|solo|tab)/.test(lower)) return 'instrumental';
  
  return null;
}

/**
 * Check if a bracketed token like "[Intro]" or "[Puente / Modulación]" is a section header rather than a chord.
 */
export function isSectionHeaderToken(token: string): boolean {
  const clean = token.replace(/^\[+|\]+$/g, '').trim();
  return detectSectionType(clean) !== null;
}

// ── Chart to ChordPro Export ──────────────────────────────────────────

/**
 * Export a ChordChart to ChordPro format string.
 */
export function chartToChordPro(chart: ChordChart, title?: string, artist?: string): string {
  const lines: string[] = [];
  
  if (title) lines.push(`{title: ${title}}`);
  if (artist) lines.push(`{artist: ${artist}}`);
  if (chart.originalKey) lines.push(`{key: ${chart.originalKey}}`);
  if (chart.tempo) lines.push(`{tempo: ${chart.tempo}}`);
  if (chart.timeSignature) lines.push(`{time: ${chart.timeSignature}}`);
  if (chart.capo) lines.push(`{capo: ${chart.capo}}`);
  
  lines.push('');
  
  for (const section of chart.sections) {
    const typeToDirective: Record<string, [string, string]> = {
      chorus: ['start_of_chorus', 'end_of_chorus'],
      verse: ['start_of_verse', 'end_of_verse'],
      bridge: ['start_of_bridge', 'end_of_bridge'],
      instrumental: ['start_of_tab', 'end_of_tab'],
    };
    
    const dirPair = typeToDirective[section.type];
    if (dirPair) {
      lines.push(`{${dirPair[0]}: ${section.label}}`);
    } else {
      lines.push(`{comment: ${section.label}}`);
    }
    
    for (const chordLine of section.lines) {
      lines.push(lineToChordPro(chordLine));
    }
    
    if (dirPair) {
      lines.push(`{${dirPair[1]}}`);
    }
    
    lines.push('');
  }
  
  return lines.join('\n');
}

/**
 * Convert a ChordLine to a ChordPro formatted string.
 */
function lineToChordPro(line: ChordLine): string {
  if (line.chords.length === 0) return line.lyrics;
  
  // Sort chords by position descending so we can insert right-to-left
  const sortedChords = [...line.chords].sort((a, b) => b.position - a.position);
  let result = line.lyrics;
  
  for (const cp of sortedChords) {
    const pos = Math.min(cp.position, result.length);
    result = result.slice(0, pos) + `[${cp.chord}]` + result.slice(pos);
  }
  
  return result;
}

// ── Chart to Plain Text ───────────────────────────────────────────────

/**
 * Render a chord chart as readable plain text (for WhatsApp / printing).
 */
export function chartToPlainText(
  chart: ChordChart,
  title?: string,
  semitones = 0,
  useSolfege = false
): string {
  const useFlats = chart.originalKey ? getKeySignatureType(chart.originalKey) === 'flat' : false;
  const lines: string[] = [];
  
  if (title) {
    lines.push(title.toUpperCase());
    lines.push('─'.repeat(title.length));
  }
  
  if (chart.originalKey) {
    const displayKey = semitones !== 0
      ? transposeChord(chart.originalKey, semitones, useFlats, useSolfege)
      : (useSolfege ? chordToSolfege(chart.originalKey) : chart.originalKey);
    lines.push(`Tonalidad: ${displayKey}`);
  }
  
  if (chart.tempo) lines.push(`BPM: ${chart.tempo}`);
  if (chart.capo) lines.push(`Capo: ${chart.capo}`);
  lines.push('');
  
  // Render according to structure order
  for (const item of chart.structure) {
    const section = chart.sections.find(s => s.id === item.sectionId);
    if (!section) continue;
    
    const repeatSuffix = item.repeats > 1 ? ` (×${item.repeats})` : '';
    lines.push(`── ${section.label}${repeatSuffix} ──`);
    
    for (const chordLine of section.lines) {
      // Build chord line above lyrics
      const chords = semitones !== 0 || useSolfege
        ? transposeLine(chordLine.chords, semitones, useFlats, useSolfege)
        : chordLine.chords;
      
      if (chords.length > 0) {
        let chordStr = '';
        const sortedChords = [...chords].sort((a, b) => a.position - b.position);
        for (const cp of sortedChords) {
          while (chordStr.length < cp.position) chordStr += ' ';
          chordStr += cp.chord;
        }
        lines.push(chordStr);
      }
      
      if (chordLine.lyrics.trim()) {
        lines.push(chordLine.lyrics);
      }
    }
    
    lines.push('');
  }
  
  return lines.join('\n');
}

// ── Helper: Create empty chart ────────────────────────────────────────

export function createEmptyChart(
  librarySongId: string,
  originalKey: string,
  userId: string
): ChordChart {
  const genId = () => Math.random().toString(36).substring(2, 9);
  const now = new Date().toISOString();
  
  const introSection: ChordChartSection = {
    id: genId(), type: 'intro', label: 'Intro',
    lines: [{ id: genId(), lyrics: '', chords: [] }]
  };
  const verseSection: ChordChartSection = {
    id: genId(), type: 'verse', label: 'Verso 1',
    lines: [{ id: genId(), lyrics: '', chords: [] }]
  };
  const chorusSection: ChordChartSection = {
    id: genId(), type: 'chorus', label: 'Coro',
    lines: [{ id: genId(), lyrics: '', chords: [] }]
  };
  
  const sections = [introSection, verseSection, chorusSection];
  
  return {
    id: '',
    librarySongId,
    originalKey: originalKey || 'C',
    sections,
    structure: sections.map(s => ({ sectionId: s.id, repeats: 1 })),
    createdBy: userId,
    updatedAt: now,
    createdAt: now
  };
}

// ── Helper: generate unique ID ────────────────────────────────────────
export function generateChordId(): string {
  return Math.random().toString(36).substring(2, 9);
}
