"use client";

import { useState, useCallback, useEffect, useRef } from 'react';
import {
  ChordChart, ChordChartSection, ChordLine, ChordPosition,
  ChordChartSectionType, StructureItem, LibrarySong, User, ChordNotation
} from '../lib/types';
import {
  transposeChord, transposeLine, getSemitonesBetween, getKeySignatureType,
  chordToSolfege, chordFromSolfege, getDiatonicChords,
  ALL_KEYS, SECTION_TYPE_LABELS, SECTION_TYPE_COLORS,
  SECTION_TYPE_BADGE_COLORS, SECTION_TYPE_SHORT,
  parseChordPro, chartToChordPro, createEmptyChart, generateChordId
} from '../lib/chordUtils';
import * as store from '../lib/firebaseStore';
import {
  X, Save, Plus, Trash2, GripVertical, ChevronUp, ChevronDown,
  Copy, FileText, Music, ArrowUp, ArrowDown, Loader2,
  Upload, ClipboardPaste, RotateCcw, Repeat, AlertTriangle
} from 'lucide-react';

interface ChordChartEditorProps {
  librarySong: LibrarySong;
  existingChart: ChordChart | null;
  currentUser: User;
  chordNotation: ChordNotation;
  onClose: () => void;
  onSaved: () => void;
}

export default function ChordChartEditor({
  librarySong,
  existingChart,
  currentUser,
  chordNotation,
  onClose,
  onSaved
}: ChordChartEditorProps) {
  const useSolfege = chordNotation === 'solfege';
  
  const [chart, setChart] = useState<ChordChart>(() => {
    if (existingChart) return JSON.parse(JSON.stringify(existingChart));
    return createEmptyChart(
      librarySong.id,
      librarySong.originalTone || 'C',
      currentUser.id
    );
  });
  
  const [isSaving, setIsSaving] = useState(false);
  const [showChordProImport, setShowChordProImport] = useState(false);
  const [chordProText, setChordProText] = useState('');
  const [showPdfImport, setShowPdfImport] = useState(false);
  const [transposeSemitones, setTransposeSemitones] = useState(0);
  const [editingChordPosition, setEditingChordPosition] = useState<{
    sectionId: string; lineId: string; position: number; existingChord?: string
  } | null>(null);
  const [chordInput, setChordInput] = useState('');
  const chordInputRef = useRef<HTMLInputElement>(null);
  const [draggedSectionId, setDraggedSectionId] = useState<string | null>(null);
  const [draggedStructureIdx, setDraggedStructureIdx] = useState<number | null>(null);
  
  // Focus chord input when it appears
  useEffect(() => {
    if (editingChordPosition && chordInputRef.current) {
      chordInputRef.current.focus();
    }
  }, [editingChordPosition]);

  // ── Save Handler ──────────────────────────────────────────────────
  const handleSave = async () => {
    setIsSaving(true);
    try {
      const chartToSave = { ...chart };
      // Apply transposition if any
      if (transposeSemitones !== 0) {
        const useFlats = getKeySignatureType(chart.originalKey) === 'flat';
        chartToSave.sections = chart.sections.map(section => ({
          ...section,
          lines: section.lines.map(line => ({
            ...line,
            chords: transposeLine(line.chords, transposeSemitones, useFlats)
          }))
        }));
        // Update originalKey to reflect new key
        chartToSave.originalKey = transposeChord(chart.originalKey, transposeSemitones, useFlats);
      }
      
      const savedId = await store.saveChordChart(chartToSave);
      if (!chart.id) {
        setChart(prev => ({ ...prev, id: savedId }));
      }
      onSaved();
    } catch (err) {
      console.error('Error saving chord chart:', err);
      alert('Error al guardar la tablatura.');
    } finally {
      setIsSaving(false);
    }
  };

  // ── Section CRUD ──────────────────────────────────────────────────
  const addSection = (type: ChordChartSectionType = 'verse') => {
    const id = generateChordId();
    const count = chart.sections.filter(s => s.type === type).length + 1;
    const label = `${SECTION_TYPE_LABELS[type]}${type === 'chorus' || type === 'intro' || type === 'outro' ? '' : ' ' + count}`;
    
    const newSection: ChordChartSection = {
      id,
      type,
      label,
      lines: [{ id: generateChordId(), lyrics: '', chords: [] }]
    };
    
    setChart(prev => ({
      ...prev,
      sections: [...prev.sections, newSection],
      structure: [...prev.structure, { sectionId: id, repeats: 1 }]
    }));
  };

  const removeSection = (sectionId: string) => {
    if (chart.sections.length <= 1) return;
    setChart(prev => ({
      ...prev,
      sections: prev.sections.filter(s => s.id !== sectionId),
      structure: prev.structure.filter(s => s.sectionId !== sectionId)
    }));
  };

  const duplicateSection = (sectionId: string) => {
    const original = chart.sections.find(s => s.id === sectionId);
    if (!original) return;
    
    const newId = generateChordId();
    const count = chart.sections.filter(s => s.type === original.type).length + 1;
    const newSection: ChordChartSection = {
      ...JSON.parse(JSON.stringify(original)),
      id: newId,
      label: `${SECTION_TYPE_LABELS[original.type]} ${count}`,
      lines: original.lines.map(l => ({
        ...l,
        id: generateChordId(),
        chords: [...l.chords]
      }))
    };
    
    const idx = chart.sections.findIndex(s => s.id === sectionId);
    const newSections = [...chart.sections];
    newSections.splice(idx + 1, 0, newSection);
    
    const structIdx = chart.structure.findIndex(s => s.sectionId === sectionId);
    const newStructure = [...chart.structure];
    newStructure.splice(structIdx + 1, 0, { sectionId: newId, repeats: 1 });
    
    setChart(prev => ({ ...prev, sections: newSections, structure: newStructure }));
  };

  const moveSectionInList = (sectionId: string, direction: 'up' | 'down') => {
    const idx = chart.sections.findIndex(s => s.id === sectionId);
    if (idx === -1) return;
    if (direction === 'up' && idx === 0) return;
    if (direction === 'down' && idx === chart.sections.length - 1) return;

    const newSections = [...chart.sections];
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    [newSections[idx], newSections[swapIdx]] = [newSections[swapIdx], newSections[idx]];
    setChart(prev => ({ ...prev, sections: newSections }));
  };

  const updateSectionType = (sectionId: string, type: ChordChartSectionType) => {
    setChart(prev => ({
      ...prev,
      sections: prev.sections.map(s =>
        s.id === sectionId ? { ...s, type, label: SECTION_TYPE_LABELS[type] } : s
      )
    }));
  };

  const updateSectionLabel = (sectionId: string, label: string) => {
    setChart(prev => ({
      ...prev,
      sections: prev.sections.map(s =>
        s.id === sectionId ? { ...s, label } : s
      )
    }));
  };

  // ── Line CRUD ─────────────────────────────────────────────────────
  const addLine = (sectionId: string) => {
    setChart(prev => ({
      ...prev,
      sections: prev.sections.map(s =>
        s.id === sectionId
          ? { ...s, lines: [...s.lines, { id: generateChordId(), lyrics: '', chords: [] }] }
          : s
      )
    }));
  };

  const removeLine = (sectionId: string, lineId: string) => {
    setChart(prev => ({
      ...prev,
      sections: prev.sections.map(s => {
        if (s.id !== sectionId) return s;
        if (s.lines.length <= 1) return s;
        return { ...s, lines: s.lines.filter(l => l.id !== lineId) };
      })
    }));
  };

  const updateLineLyrics = (sectionId: string, lineId: string, lyrics: string) => {
    setChart(prev => ({
      ...prev,
      sections: prev.sections.map(s =>
        s.id === sectionId
          ? {
              ...s,
              lines: s.lines.map(l =>
                l.id === lineId ? { ...l, lyrics } : l
              )
            }
          : s
      )
    }));
  };

  // ── Chord CRUD ────────────────────────────────────────────────────
  const handleLyricClick = (sectionId: string, lineId: string, clickPosition: number) => {
    // Find existing chord at this position
    const section = chart.sections.find(s => s.id === sectionId);
    const line = section?.lines.find(l => l.id === lineId);
    const existing = line?.chords.find(c => Math.abs(c.position - clickPosition) <= 1);
    
    setEditingChordPosition({
      sectionId,
      lineId,
      position: existing ? existing.position : clickPosition,
      existingChord: existing?.chord
    });
    setChordInput(existing?.chord || '');
  };

  const saveChordAtPosition = () => {
    if (!editingChordPosition) return;
    const { sectionId, lineId, position, existingChord } = editingChordPosition;
    
    setChart(prev => ({
      ...prev,
      sections: prev.sections.map(s => {
        if (s.id !== sectionId) return s;
        return {
          ...s,
          lines: s.lines.map(l => {
            if (l.id !== lineId) return l;
            let newChords = l.chords.filter(c => c.position !== position);
            if (chordInput.trim()) {
              newChords.push({ chord: chordInput.trim(), position });
              newChords.sort((a, b) => a.position - b.position);
            }
            return { ...l, chords: newChords };
          })
        };
      })
    }));
    
    setEditingChordPosition(null);
    setChordInput('');
  };

  const removeChordAtPosition = () => {
    if (!editingChordPosition) return;
    const { sectionId, lineId, position } = editingChordPosition;
    
    setChart(prev => ({
      ...prev,
      sections: prev.sections.map(s => {
        if (s.id !== sectionId) return s;
        return {
          ...s,
          lines: s.lines.map(l => {
            if (l.id !== lineId) return l;
            return { ...l, chords: l.chords.filter(c => c.position !== position) };
          })
        };
      })
    }));
    
    setEditingChordPosition(null);
    setChordInput('');
  };

  // ── Structure ─────────────────────────────────────────────────────
  const addToStructure = (sectionId: string) => {
    setChart(prev => ({
      ...prev,
      structure: [...prev.structure, { sectionId, repeats: 1 }]
    }));
  };

  const removeFromStructure = (index: number) => {
    if (chart.structure.length <= 1) return;
    setChart(prev => ({
      ...prev,
      structure: prev.structure.filter((_, i) => i !== index)
    }));
  };

  const updateStructureRepeats = (index: number, repeats: number) => {
    setChart(prev => ({
      ...prev,
      structure: prev.structure.map((s, i) =>
        i === index ? { ...s, repeats: Math.max(1, Math.min(10, repeats)) } : s
      )
    }));
  };

  const moveStructureItem = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === chart.structure.length - 1) return;
    
    const newStructure = [...chart.structure];
    const swapIdx = direction === 'up' ? index - 1 : index + 1;
    [newStructure[index], newStructure[swapIdx]] = [newStructure[swapIdx], newStructure[index]];
    setChart(prev => ({ ...prev, structure: newStructure }));
  };

  // ── ChordPro Import ───────────────────────────────────────────────
  const handleImportChordPro = () => {
    if (!chordProText.trim()) return;
    try {
      const imported = parseChordPro(chordProText, librarySong.id, currentUser.id);
      if (chart.id) imported.id = chart.id;
      setChart(imported);
      setShowChordProImport(false);
      setChordProText('');
    } catch (err) {
      alert('Error al parsear el texto ChordPro. Verifica el formato.');
    }
  };

  // ── PDF Import ────────────────────────────────────────────────────
  const handlePdfImport = async (file: File) => {
    try {
      const pdfjsLib = await import('pdfjs-dist');
      pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;
      
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      let fullText = '';
      
      for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        const page = await pdf.getPage(pageNum);
        const textContent = await page.getTextContent();
        
        // Group text items by Y coordinate to reconstruct lines
        const itemsByLine: Map<number, Array<{ x: number; str: string }>> = new Map();
        
        for (const item of textContent.items) {
          if (!('str' in item) || !item.str.trim()) continue;
          const y = Math.round(item.transform[5]); // Round Y to group nearby items
          if (!itemsByLine.has(y)) itemsByLine.set(y, []);
          itemsByLine.get(y)!.push({ x: item.transform[4], str: item.str });
        }
        
        // Sort lines by Y (descending since PDF coords are bottom-up)
        const sortedLines = [...itemsByLine.entries()]
          .sort((a, b) => b[0] - a[0]);
        
        for (const [, items] of sortedLines) {
          items.sort((a, b) => a.x - b.x);
          fullText += items.map(i => i.str).join(' ') + '\n';
        }
        
        if (pageNum < pdf.numPages) fullText += '\n';
      }
      
      // Try to parse as ChordPro first
      if (fullText.includes('[') && fullText.includes(']')) {
        const imported = parseChordPro(fullText, librarySong.id, currentUser.id);
        if (chart.id) imported.id = chart.id;
        setChart(imported);
      } else {
        // Parse as plain text with chord detection
        const imported = parsePlainTextPdf(fullText);
        setChart(prev => ({ ...prev, ...imported }));
      }
      
      setShowPdfImport(false);
    } catch (err) {
      console.error('PDF import error:', err);
      alert('Error al importar el PDF. Asegúrate de que el PDF contiene texto (no es una imagen escaneada).');
    }
  };

  // Simple plain text PDF parser
  const parsePlainTextPdf = (text: string): Partial<ChordChart> => {
    const lines = text.split('\n');
    const sections: ChordChartSection[] = [];
    let currentSection: ChordChartSection | null = null;
    
    const chordRegex = /^([A-G][#b]?(m|maj|min|dim|aug|sus|add|7|9|11|13|M)?[0-9]*(\/[A-G][#b]?)?\s*)+$/;
    const sectionKeywords = /^(intro|verso|verse|estrofa|pre.?coro|pre.?chorus|coro|chorus|puente|bridge|interludio|interlude|outro|final|instrumental|tag)/i;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      // Check if this is a section header
      const sectionMatch = line.match(sectionKeywords);
      if (sectionMatch) {
        if (currentSection && currentSection.lines.length > 0) {
          sections.push(currentSection);
        }
        const { detectSectionType } = require('../lib/chordUtils');
        const type = detectSectionType(line) || 'custom';
        currentSection = {
          id: generateChordId(),
          type,
          label: line.replace(/:$/, '').trim(),
          lines: []
        };
        continue;
      }
      
      if (!currentSection) {
        currentSection = {
          id: generateChordId(),
          type: 'verse',
          label: 'Verso 1',
          lines: []
        };
      }
      
      // Check if this line is chords
      if (chordRegex.test(line)) {
        // Next line is probably lyrics
        const nextLine = (i + 1 < lines.length) ? lines[i + 1].trim() : '';
        const isNextLineChords = chordRegex.test(nextLine);
        
        if (!isNextLineChords && nextLine) {
          // Map chord positions
          const chords: ChordPosition[] = [];
          let pos = 0;
          for (const part of line.split(/\s+/)) {
            const idx = lines[i].indexOf(part, pos);
            chords.push({ chord: part, position: idx >= 0 ? idx : chords.length * 8 });
            pos = idx + part.length;
          }
          
          currentSection.lines.push({
            id: generateChordId(),
            lyrics: nextLine,
            chords
          });
          i++; // Skip the lyrics line
        } else {
          // Chord-only line
          const chords: ChordPosition[] = [];
          let cPos = 0;
          for (const part of line.split(/\s+/)) {
            chords.push({ chord: part, position: cPos });
            cPos += part.length + 4;
          }
          currentSection.lines.push({
            id: generateChordId(),
            lyrics: '',
            chords
          });
        }
      } else {
        // Pure lyrics line
        currentSection.lines.push({
          id: generateChordId(),
          lyrics: line,
          chords: []
        });
      }
    }
    
    if (currentSection && currentSection.lines.length > 0) {
      sections.push(currentSection);
    }
    
    return {
      sections: sections.length > 0 ? sections : undefined,
      structure: sections.length > 0 ? sections.map(s => ({ sectionId: s.id, repeats: 1 })) : undefined,
    };
  };

  // ── Render helpers ────────────────────────────────────────────────
  const displayChord = (chord: string): string => {
    let displayed = transposeSemitones !== 0
      ? transposeChord(chord, transposeSemitones, getKeySignatureType(chart.originalKey) === 'flat')
      : chord;
    if (useSolfege) displayed = chordToSolfege(displayed);
    return displayed;
  };

  const displayKey = (): string => {
    let key = chart.originalKey;
    if (transposeSemitones !== 0) {
      key = transposeChord(key, transposeSemitones, getKeySignatureType(key) === 'flat');
    }
    if (useSolfege) key = chordToSolfege(key);
    return key;
  };

  // ── Render ────────────────────────────────────────────────────────
  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/90 backdrop-blur-sm overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-neutral-950 border border-neutral-800 rounded-2xl w-full max-w-4xl my-4 mx-2 shadow-[0_20px_60px_rgba(0,0,0,0.6),0_0_30px_rgba(236,72,153,0.08)] relative animate-scale-in"
        onClick={e => e.stopPropagation()}
      >
        {/* ── Header Bar ── */}
        <div className="bg-gradient-to-r from-neutral-900 via-neutral-900 to-neutral-950 border-b border-neutral-800 px-4 py-3 rounded-t-2xl">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-black text-white truncate flex items-center gap-2">
                <Music className="w-5 h-5 text-pink-500 shrink-0" />
                {librarySong.title}
              </h2>
              <p className="text-xs text-neutral-400 mt-0.5">{librarySong.artist} · Editor de Tablatura</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="bg-pink-600 hover:bg-pink-500 text-white px-4 py-2 rounded-xl text-sm font-bold transition-all shadow-[0_0_15px_rgba(236,72,153,0.3)] flex items-center gap-2 disabled:opacity-50"
              >
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Guardar
              </button>
              <button
                onClick={onClose}
                className="p-2 text-neutral-400 hover:text-white hover:bg-neutral-800 rounded-xl transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
          
          {/* ── Toolbar ── */}
          <div className="flex items-center gap-3 mt-3 flex-wrap">
            {/* Key & Transpose */}
            <div className="flex items-center bg-neutral-800/60 rounded-xl border border-neutral-700/50 overflow-hidden">
              <span className="text-[10px] text-neutral-500 uppercase tracking-wider font-bold px-2">Tono</span>
              <select
                value={chart.originalKey}
                onChange={e => setChart(prev => ({ ...prev, originalKey: e.target.value }))}
                className="bg-transparent text-white text-sm font-mono font-bold py-1.5 px-1 focus:outline-none cursor-pointer"
              >
                {ALL_KEYS.map(k => (
                  <option key={k} value={k} className="bg-neutral-900">{useSolfege ? chordToSolfege(k) : k}</option>
                ))}
              </select>
              <div className="flex border-l border-neutral-700/50">
                <button
                  onClick={() => setTransposeSemitones(prev => prev - 1)}
                  className="px-2 py-1.5 text-neutral-400 hover:text-white hover:bg-neutral-700/50 transition-colors"
                  title="Bajar medio tono"
                >
                  <ArrowDown className="w-3.5 h-3.5" />
                </button>
                <span className="text-xs text-neutral-400 font-mono px-1 flex items-center min-w-[30px] justify-center">
                  {transposeSemitones > 0 ? `+${transposeSemitones}` : transposeSemitones}
                </span>
                <button
                  onClick={() => setTransposeSemitones(prev => prev + 1)}
                  className="px-2 py-1.5 text-neutral-400 hover:text-white hover:bg-neutral-700/50 transition-colors"
                  title="Subir medio tono"
                >
                  <ArrowUp className="w-3.5 h-3.5" />
                </button>
              </div>
              {transposeSemitones !== 0 && (
                <button
                  onClick={() => setTransposeSemitones(0)}
                  className="px-2 py-1.5 text-orange-400 hover:text-orange-300 hover:bg-neutral-700/50 transition-colors border-l border-neutral-700/50"
                  title="Resetear transposición"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            
            {transposeSemitones !== 0 && (
              <span className="text-xs text-orange-400 font-medium bg-orange-500/10 border border-orange-500/20 px-2 py-1 rounded-lg">
                Visualizando en {displayKey()}
              </span>
            )}
            
            {/* BPM */}
            <div className="flex items-center bg-neutral-800/60 rounded-xl border border-neutral-700/50 overflow-hidden">
              <span className="text-[10px] text-neutral-500 uppercase tracking-wider font-bold px-2">BPM</span>
              <input
                type="number"
                value={chart.tempo || ''}
                onChange={e => setChart(prev => ({ ...prev, tempo: parseInt(e.target.value) || undefined }))}
                className="bg-transparent text-white text-sm font-mono w-14 py-1.5 px-1 focus:outline-none text-center"
                placeholder="—"
                min={30}
                max={300}
              />
            </div>
            
            {/* Time Signature */}
            <div className="flex items-center bg-neutral-800/60 rounded-xl border border-neutral-700/50 overflow-hidden">
              <span className="text-[10px] text-neutral-500 uppercase tracking-wider font-bold px-2">Compás</span>
              <select
                value={chart.timeSignature || '4/4'}
                onChange={e => setChart(prev => ({ ...prev, timeSignature: e.target.value }))}
                className="bg-transparent text-white text-sm font-mono py-1.5 px-1 focus:outline-none cursor-pointer"
              >
                <option value="4/4" className="bg-neutral-900">4/4</option>
                <option value="3/4" className="bg-neutral-900">3/4</option>
                <option value="6/8" className="bg-neutral-900">6/8</option>
                <option value="2/4" className="bg-neutral-900">2/4</option>
              </select>
            </div>
            
            {/* Capo */}
            <div className="flex items-center bg-neutral-800/60 rounded-xl border border-neutral-700/50 overflow-hidden">
              <span className="text-[10px] text-neutral-500 uppercase tracking-wider font-bold px-2">Capo</span>
              <select
                value={chart.capo || 0}
                onChange={e => setChart(prev => ({ ...prev, capo: parseInt(e.target.value) || undefined }))}
                className="bg-transparent text-white text-sm font-mono py-1.5 px-1 focus:outline-none cursor-pointer"
              >
                {Array.from({ length: 12 }, (_, i) => (
                  <option key={i} value={i} className="bg-neutral-900">{i === 0 ? 'Sin capo' : `Traste ${i}`}</option>
                ))}
              </select>
            </div>
            
            {/* Import Buttons */}
            <div className="flex gap-1 ml-auto">
              <button
                onClick={() => setShowChordProImport(!showChordProImport)}
                className="text-xs text-neutral-400 hover:text-white bg-neutral-800/60 hover:bg-neutral-700/60 border border-neutral-700/50 px-2.5 py-1.5 rounded-xl transition-colors flex items-center gap-1.5"
              >
                <ClipboardPaste className="w-3.5 h-3.5" />
                ChordPro
              </button>
              <button
                onClick={() => setShowPdfImport(!showPdfImport)}
                className="text-xs text-neutral-400 hover:text-white bg-neutral-800/60 hover:bg-neutral-700/60 border border-neutral-700/50 px-2.5 py-1.5 rounded-xl transition-colors flex items-center gap-1.5"
              >
                <Upload className="w-3.5 h-3.5" />
                PDF
              </button>
            </div>
          </div>

          {/* ── Diatonic Quick-Bar ── */}
          <div className="mt-3 pt-2.5 border-t border-neutral-800/60 flex items-center gap-1.5 overflow-x-auto custom-scrollbar pb-1">
            <span className="text-[10px] text-pink-400 uppercase tracking-wider font-extrabold shrink-0 mr-1 flex items-center gap-1">
              ⚡ Acordes {chart.originalKey}:
            </span>
            {getDiatonicChords(chart.originalKey, useSolfege).map(chord => (
              <button
                key={chord}
                onClick={() => {
                  if (editingChordPosition) {
                    setChordInput(chord);
                  } else {
                    // Auto-insert in first line of first section if active
                    const firstSec = chart.sections[0];
                    const firstLine = firstSec?.lines[0];
                    if (firstSec && firstLine) {
                      setEditingChordPosition({
                        sectionId: firstSec.id,
                        lineId: firstLine.id,
                        position: firstLine.lyrics.length
                      });
                      setChordInput(chord);
                    }
                  }
                }}
                className="text-xs font-mono font-bold text-pink-300 bg-pink-950/40 hover:bg-pink-900/60 border border-pink-500/30 hover:border-pink-400 px-2.5 py-1 rounded-lg transition-all hover:scale-105 shrink-0 shadow-sm"
                title={`Insertar ${chord} en 1-clic`}
              >
                {chord}
              </button>
            ))}
          </div>
        </div>

        {/* ── ChordPro Import Panel ── */}
        {showChordProImport && (
          <div className="border-b border-neutral-800 bg-neutral-900/80 p-4 animate-fade-in">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                <ClipboardPaste className="w-4 h-4 text-pink-400" />
                Importar desde ChordPro
              </h4>
              <button onClick={() => setShowChordProImport(false)} className="text-neutral-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-neutral-500 mb-2">
              Pega el texto en formato ChordPro. Ejemplo: <code className="bg-neutral-800 px-1 rounded font-mono text-pink-300">[Am]Letra con [G]acordes</code>
            </p>
            <textarea
              value={chordProText}
              onChange={e => setChordProText(e.target.value)}
              className="w-full bg-neutral-950 border border-neutral-700 rounded-xl p-3 text-sm text-white font-mono resize-y min-h-[120px] focus:outline-none focus:ring-1 focus:ring-pink-500"
              placeholder={`{title: Nombre de la Canción}\n{key: G}\n\n{start_of_verse: Verso 1}\n[G]Digno eres [Em]Señor de [C]gloria\n{end_of_verse}`}
            />
            <div className="flex gap-2 mt-2 justify-end">
              <button
                onClick={() => { setShowChordProImport(false); setChordProText(''); }}
                className="px-3 py-1.5 text-sm text-neutral-400 hover:text-white transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleImportChordPro}
                disabled={!chordProText.trim()}
                className="px-4 py-1.5 bg-pink-600 hover:bg-pink-500 text-white text-sm font-bold rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                <FileText className="w-4 h-4" /> Importar
              </button>
            </div>
          </div>
        )}

        {/* ── PDF Import Panel ── */}
        {showPdfImport && (
          <div className="border-b border-neutral-800 bg-neutral-900/80 p-4 animate-fade-in">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                <Upload className="w-4 h-4 text-pink-400" />
                Importar desde PDF
              </h4>
              <button onClick={() => setShowPdfImport(false)} className="text-neutral-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-neutral-500 mb-3">
              Sube un PDF con cifrado/tablatura (como los de Secuencias.com). El PDF debe contener texto seleccionable, no imágenes escaneadas.
            </p>
            <label className="flex flex-col items-center justify-center w-full h-28 border-2 border-dashed border-neutral-700 hover:border-pink-500/50 rounded-xl cursor-pointer transition-colors bg-neutral-950/50 hover:bg-neutral-900/50">
              <Upload className="w-6 h-6 text-neutral-500 mb-2" />
              <span className="text-sm text-neutral-400">Haz clic o arrastra un archivo PDF</span>
              <input
                type="file"
                accept=".pdf"
                className="hidden"
                onChange={e => {
                  const file = e.target.files?.[0];
                  if (file) handlePdfImport(file);
                  e.target.value = '';
                }}
              />
            </label>
          </div>
        )}

        {/* ── Main Editor Area ── */}
        <div className="p-4 space-y-4 max-h-[60vh] overflow-y-auto custom-scrollbar">
          {chart.sections.map((section, sectionIdx) => (
            <div
              key={section.id}
              className={`rounded-xl border ${SECTION_TYPE_COLORS[section.type]} p-4 transition-all group/section`}
            >
              {/* Section Header */}
              <div className="flex items-center gap-2 mb-3 flex-wrap">
                <select
                  value={section.type}
                  onChange={e => updateSectionType(section.id, e.target.value as ChordChartSectionType)}
                  className="bg-neutral-900/80 border border-neutral-700/50 text-white text-xs font-bold rounded-lg px-2 py-1.5 focus:outline-none cursor-pointer"
                >
                  {Object.entries(SECTION_TYPE_LABELS).map(([val, label]) => (
                    <option key={val} value={val} className="bg-neutral-900">{label}</option>
                  ))}
                </select>
                <input
                  value={section.label}
                  onChange={e => updateSectionLabel(section.id, e.target.value)}
                  className="bg-transparent text-white text-sm font-bold border-b border-transparent hover:border-neutral-600 focus:border-pink-500 focus:outline-none px-1 py-0.5 flex-1 min-w-[100px]"
                  placeholder="Nombre de la sección"
                />
                <div className="flex gap-0.5 opacity-0 group-hover/section:opacity-100 transition-opacity">
                  <button onClick={() => moveSectionInList(section.id, 'up')} disabled={sectionIdx === 0}
                    className="p-1 text-neutral-500 hover:text-white hover:bg-neutral-800 rounded transition-colors disabled:opacity-30">
                    <ChevronUp className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => moveSectionInList(section.id, 'down')} disabled={sectionIdx === chart.sections.length - 1}
                    className="p-1 text-neutral-500 hover:text-white hover:bg-neutral-800 rounded transition-colors disabled:opacity-30">
                    <ChevronDown className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => duplicateSection(section.id)}
                    className="p-1 text-neutral-500 hover:text-white hover:bg-neutral-800 rounded transition-colors" title="Duplicar sección">
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => removeSection(section.id)} disabled={chart.sections.length <= 1}
                    className="p-1 text-neutral-500 hover:text-red-400 hover:bg-neutral-800 rounded transition-colors disabled:opacity-30" title="Eliminar sección">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Lines */}
              <div className="space-y-1">
                {section.lines.map((line, lineIdx) => (
                  <div key={line.id} className="group/line relative">
                    {/* Chord display row */}
                    <div className="relative h-6 font-mono text-sm select-none">
                      {(() => {
                        let minPosEm = 0;
                        return line.chords.map((cp, ci) => {
                          const rawPosEm = cp.position * 0.6;
                          const posEm = Math.max(rawPosEm, minPosEm);
                          const chordText = displayChord(cp.chord);
                          minPosEm = posEm + (chordText.length * 0.65) + 1.2;
                          return (
                            <span
                              key={ci}
                              className="absolute text-pink-400 font-bold cursor-pointer hover:text-pink-300 transition-colors bg-neutral-900/40 px-0.5 rounded"
                              style={{ left: `${posEm}em` }}
                              onClick={() => handleLyricClick(section.id, line.id, cp.position)}
                              title="Clic para editar acorde"
                            >
                              {chordText}
                            </span>
                          );
                        });
                      })()}
                    </div>
                    
                    {/* Lyrics input row */}
                    <div className="relative flex items-center gap-1">
                      <input
                        value={line.lyrics}
                        onChange={e => updateLineLyrics(section.id, line.id, e.target.value)}
                        className="w-full bg-transparent text-white text-sm font-mono border-b border-neutral-800/50 hover:border-neutral-600 focus:border-pink-500/50 focus:outline-none py-1 px-0 transition-colors"
                        placeholder="Escribe la letra aquí... (clic arriba para agregar acordes)"
                        onClick={e => {
                          const input = e.target as HTMLInputElement;
                          const pos = input.selectionStart || 0;
                          // Show chord add on double click or shift+click
                          if (e.shiftKey) {
                            handleLyricClick(section.id, line.id, pos);
                          }
                        }}
                      />
                      <button
                        onClick={() => handleLyricClick(section.id, line.id, line.lyrics.length)}
                        className="p-1 text-neutral-600 hover:text-pink-400 transition-colors shrink-0 opacity-0 group-hover/line:opacity-100"
                        title="Agregar acorde al final"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                      {section.lines.length > 1 && (
                        <button
                          onClick={() => removeLine(section.id, line.id)}
                          className="p-1 text-neutral-600 hover:text-red-400 transition-colors shrink-0 opacity-0 group-hover/line:opacity-100"
                          title="Eliminar línea"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </div>

                    {/* Chord edit popover */}
                    {editingChordPosition &&
                     editingChordPosition.sectionId === section.id &&
                     editingChordPosition.lineId === line.id && (
                      <div
                        className="absolute z-20 top-0 bg-neutral-800 border border-pink-500/30 rounded-lg p-2 shadow-xl flex items-center gap-1.5 animate-fade-in"
                        style={{ left: `${editingChordPosition.position * 0.6}em` }}
                      >
                        <input
                          ref={chordInputRef}
                          value={chordInput}
                          onChange={e => setChordInput(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') saveChordAtPosition();
                            if (e.key === 'Escape') { setEditingChordPosition(null); setChordInput(''); }
                          }}
                          className="w-20 bg-neutral-900 border border-neutral-600 rounded px-2 py-1 text-sm text-white font-mono focus:outline-none focus:border-pink-500"
                          placeholder="Am7"
                        />
                        <button onClick={saveChordAtPosition}
                          className="p-1 bg-green-600 hover:bg-green-500 text-white rounded transition-colors">
                          <Save className="w-3.5 h-3.5" />
                        </button>
                        {editingChordPosition.existingChord && (
                          <button onClick={removeChordAtPosition}
                            className="p-1 bg-red-600/20 hover:bg-red-600/40 text-red-400 rounded transition-colors">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button onClick={() => { setEditingChordPosition(null); setChordInput(''); }}
                          className="p-1 text-neutral-400 hover:text-white rounded transition-colors">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Add line button */}
              <button
                onClick={() => addLine(section.id)}
                className="mt-2 text-xs text-neutral-500 hover:text-pink-400 flex items-center gap-1 transition-colors"
              >
                <Plus className="w-3 h-3" /> Agregar línea
              </button>
            </div>
          ))}

          {/* Add Section */}
          <div className="flex flex-wrap gap-2 pt-2">
            {(Object.entries(SECTION_TYPE_LABELS) as [ChordChartSectionType, string][]).map(([type, label]) => (
              <button
                key={type}
                onClick={() => addSection(type)}
                className={`text-xs font-medium px-3 py-1.5 rounded-lg border transition-all hover:scale-105 ${SECTION_TYPE_BADGE_COLORS[type]}`}
              >
                + {label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Structure Panel ── */}
        <div className="border-t border-neutral-800 bg-neutral-900/50 px-4 py-3 rounded-b-2xl">
          <div className="flex items-center gap-2 mb-2">
            <h4 className="text-xs font-bold text-neutral-400 uppercase tracking-widest">Estructura de Ejecución</h4>
            <span className="text-[10px] text-neutral-600">(arrastra para reordenar)</span>
          </div>
          
          <div className="flex flex-wrap gap-1.5 items-center">
            {chart.structure.map((item, idx) => {
              const section = chart.sections.find(s => s.id === item.sectionId);
              if (!section) return null;
              
              return (
                <div key={`${item.sectionId}-${idx}`} className="flex items-center group/pill">
                  {idx > 0 && <span className="text-neutral-700 mx-0.5 text-xs">→</span>}
                  <div className={`flex items-center gap-1 px-2.5 py-1 rounded-lg border text-xs font-bold transition-all cursor-pointer hover:scale-105 ${SECTION_TYPE_BADGE_COLORS[section.type]}`}>
                    <span title={section.label}>
                      {SECTION_TYPE_SHORT[section.type]}{chart.sections.filter(s => s.type === section.type).length > 1
                        ? (chart.sections.filter(s => s.type === section.type).indexOf(section) + 1)
                        : ''}
                    </span>
                    {item.repeats > 1 && (
                      <span className="bg-white/10 rounded px-1 text-[10px]">×{item.repeats}</span>
                    )}
                    
                    {/* Controls on hover */}
                    <div className="hidden group-hover/pill:flex items-center gap-0.5 ml-1">
                      <button onClick={() => updateStructureRepeats(idx, item.repeats + 1)}
                        className="hover:text-white transition-colors" title="Más repeticiones">
                        <Repeat className="w-3 h-3" />
                      </button>
                      {item.repeats > 1 && (
                        <button onClick={() => updateStructureRepeats(idx, item.repeats - 1)}
                          className="hover:text-white transition-colors text-[9px] font-black" title="Menos repeticiones">
                          −1
                        </button>
                      )}
                      <button onClick={() => moveStructureItem(idx, 'up')} disabled={idx === 0}
                        className="hover:text-white transition-colors disabled:opacity-30" title="Mover antes">
                        <ChevronUp className="w-3 h-3" />
                      </button>
                      <button onClick={() => moveStructureItem(idx, 'down')} disabled={idx === chart.structure.length - 1}
                        className="hover:text-white transition-colors disabled:opacity-30" title="Mover después">
                        <ChevronDown className="w-3 h-3" />
                      </button>
                      <button onClick={() => removeFromStructure(idx)} disabled={chart.structure.length <= 1}
                        className="hover:text-red-400 transition-colors disabled:opacity-30" title="Quitar">
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
            
            {/* Add to structure dropdown */}
            <div className="relative group/add">
              <button className="text-xs text-neutral-500 hover:text-pink-400 bg-neutral-800/50 hover:bg-neutral-800 border border-neutral-700/50 px-2 py-1 rounded-lg transition-colors flex items-center gap-1">
                <Plus className="w-3 h-3" /> Agregar
              </button>
              <div className="absolute bottom-full left-0 mb-1 hidden group-hover/add:flex flex-col bg-neutral-800 border border-neutral-700 rounded-lg shadow-xl z-20 min-w-[140px] py-1 animate-fade-in">
                {chart.sections.map(s => (
                  <button
                    key={s.id}
                    onClick={() => addToStructure(s.id)}
                    className="text-left px-3 py-1.5 text-xs text-neutral-300 hover:bg-pink-600 hover:text-white transition-colors"
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Notes */}
          <div className="mt-3">
            <textarea
              value={chart.notes || ''}
              onChange={e => setChart(prev => ({ ...prev, notes: e.target.value }))}
              className="w-full bg-neutral-950/50 border border-neutral-800 rounded-xl p-2.5 text-xs text-neutral-300 resize-none focus:outline-none focus:ring-1 focus:ring-pink-500/50 placeholder-neutral-600"
              placeholder="Notas para el equipo (dinámicas, indicaciones, etc.)..."
              rows={2}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
