"use client";

import { useState, useMemo } from 'react';
import {
  ChordChart, ChordChartSection, ChordLine, User, ChordNotation
} from '../lib/types';
import {
  transposeChord, transposeLine, getSemitonesBetween, getKeySignatureType,
  chordToSolfege, chartToPlainText,
  ALL_KEYS, SECTION_TYPE_LABELS, SECTION_TYPE_COLORS,
  SECTION_TYPE_BADGE_COLORS, SECTION_TYPE_SHORT
} from '../lib/chordUtils';
import {
  X, ArrowUp, ArrowDown, RotateCcw, Copy, Check,
  Music, ChevronRight, Repeat
} from 'lucide-react';

interface ChordChartViewerProps {
  chart: ChordChart;
  songTitle: string;
  songArtist: string;
  /** If provided, viewer starts in this key instead of the chart's original key */
  initialKey?: string;
  chordNotation: ChordNotation;
  onClose: () => void;
  /** If provided, callback to fix the transposed key for a specific service */
  onFixKey?: (key: string) => void;
}

export default function ChordChartViewer({
  chart,
  songTitle,
  songArtist,
  initialKey,
  chordNotation,
  onClose,
  onFixKey,
}: ChordChartViewerProps) {
  const useSolfege = chordNotation === 'solfege';
  
  const [transposeSemitones, setTransposeSemitones] = useState(() => {
    if (initialKey) {
      return getSemitonesBetween(chart.originalKey, initialKey);
    }
    return 0;
  });
  
  const [copied, setCopied] = useState(false);
  const [activeStructureIdx, setActiveStructureIdx] = useState(0);
  const [viewMode, setViewMode] = useState<'full_flow' | 'unique_sections'>('full_flow');
  
  const useFlats = useMemo(() => {
    const key = transposeSemitones !== 0
      ? transposeChord(chart.originalKey, transposeSemitones, false)
      : chart.originalKey;
    return getKeySignatureType(key) === 'flat';
  }, [chart.originalKey, transposeSemitones]);

  const currentKey = useMemo(() => {
    let key = chart.originalKey;
    if (transposeSemitones !== 0) {
      key = transposeChord(key, transposeSemitones, useFlats);
    }
    if (useSolfege) key = chordToSolfege(key);
    return key;
  }, [chart.originalKey, transposeSemitones, useFlats, useSolfege]);

  const displayChord = (chord: string): string => {
    let displayed = transposeSemitones !== 0
      ? transposeChord(chord, transposeSemitones, useFlats)
      : chord;
    if (useSolfege) displayed = chordToSolfege(displayed);
    return displayed;
  };

  const handleCopyText = () => {
    const text = chartToPlainText(chart, songTitle, transposeSemitones, useSolfege);
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleFixKey = () => {
    if (!onFixKey) return;
    let key = chart.originalKey;
    if (transposeSemitones !== 0) {
      key = transposeChord(key, transposeSemitones, useFlats);
    }
    onFixKey(key);
  };

  // Build ordered sections for unique view vs continuous flow
  const sectionsToRender = useMemo(() => {
    const list: {
      section: ChordChartSection;
      repeats: number;
      structureIdx: number;
      iteration: number;
    }[] = [];

    if (viewMode === 'full_flow') {
      // Unroll full continuous flow following execution order and repeats
      for (let i = 0; i < chart.structure.length; i++) {
        const item = chart.structure[i];
        const section = chart.sections.find(s => s.id === item.sectionId);
        if (section) {
          const count = Math.max(1, item.repeats);
          for (let rep = 1; rep <= count; rep++) {
            list.push({ section, repeats: item.repeats, structureIdx: i, iteration: rep });
          }
        }
      }
    } else {
      // Show unique sections in structure order
      for (let i = 0; i < chart.structure.length; i++) {
        const item = chart.structure[i];
        const section = chart.sections.find(s => s.id === item.sectionId);
        if (section) {
          list.push({ section, repeats: item.repeats, structureIdx: i, iteration: 1 });
        }
      }
    }

    return list;
  }, [chart.sections, chart.structure, viewMode]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/90 backdrop-blur-sm overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-neutral-950 border border-neutral-800 rounded-2xl w-full max-w-2xl my-4 mx-2 shadow-[0_20px_60px_rgba(0,0,0,0.6),0_0_30px_rgba(236,72,153,0.08)] relative animate-scale-in overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div className="relative bg-gradient-to-br from-neutral-800 via-neutral-900 to-neutral-950 px-5 pt-5 pb-4 border-b border-white/5">
          <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-transparent pointer-events-none" />
          
          <button
            onClick={onClose}
            className="absolute top-3 right-3 p-1.5 bg-neutral-800/80 hover:bg-neutral-700 rounded-full z-10 transition-colors"
          >
            <X className="w-4 h-4 text-neutral-400" />
          </button>

          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-1">
              <Music className="w-5 h-5 text-pink-500" />
              <h2 className="text-xl font-black text-white tracking-tight">{songTitle}</h2>
            </div>
            <p className="text-sm text-pink-400/70 font-medium">{songArtist}</p>
            
            {/* Info badges */}
            <div className="flex flex-wrap gap-2 mt-3">
              <span className="text-[10px] bg-neutral-800 border border-neutral-700/50 text-neutral-300 px-2.5 py-1 rounded-full uppercase font-bold tracking-wider">
                Tono: <span className="text-pink-300 font-mono">{currentKey}</span>
              </span>
              {chart.originalKey !== currentKey && (
                <span className="text-[10px] bg-orange-500/10 border border-orange-500/20 text-orange-400 px-2.5 py-1 rounded-full uppercase font-bold tracking-wider">
                  Original: <span className="font-mono">{useSolfege ? chordToSolfege(chart.originalKey) : chart.originalKey}</span>
                </span>
              )}
              {chart.tempo && (
                <span className="text-[10px] bg-neutral-800 border border-neutral-700/50 text-neutral-300 px-2.5 py-1 rounded-full uppercase font-bold tracking-wider">
                  {chart.tempo} BPM
                </span>
              )}
              {chart.timeSignature && (
                <span className="text-[10px] bg-neutral-800 border border-neutral-700/50 text-neutral-300 px-2.5 py-1 rounded-full uppercase font-bold tracking-wider font-mono">
                  {chart.timeSignature}
                </span>
              )}
              {chart.capo && chart.capo > 0 && (
                <span className="text-[10px] bg-neutral-800 border border-neutral-700/50 text-neutral-300 px-2.5 py-1 rounded-full uppercase font-bold tracking-wider">
                  Capo {chart.capo}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* ── Controls Bar ── */}
        <div className="flex items-center justify-between px-4 py-2 bg-neutral-900/80 border-b border-neutral-800/50 gap-2 flex-wrap">
          {/* Transposition */}
          <div className="flex items-center bg-neutral-800/60 rounded-xl border border-neutral-700/50 overflow-hidden">
            <button
              onClick={() => setTransposeSemitones(prev => prev - 1)}
              className="px-2.5 py-1.5 text-neutral-400 hover:text-white hover:bg-neutral-700/50 transition-colors"
              title="Bajar medio tono"
            >
              <ArrowDown className="w-4 h-4" />
            </button>
            <div className="px-3 py-1.5 text-sm font-mono font-bold text-white border-x border-neutral-700/50 min-w-[80px] text-center">
              {currentKey}
            </div>
            <button
              onClick={() => setTransposeSemitones(prev => prev + 1)}
              className="px-2.5 py-1.5 text-neutral-400 hover:text-white hover:bg-neutral-700/50 transition-colors"
              title="Subir medio tono"
            >
              <ArrowUp className="w-4 h-4" />
            </button>
            {transposeSemitones !== 0 && (
              <button
                onClick={() => setTransposeSemitones(0)}
                className="px-2 py-1.5 text-orange-400 hover:text-orange-300 hover:bg-neutral-700/50 transition-colors border-l border-neutral-700/50"
                title="Volver a tonalidad original"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* View Mode Toggle */}
            <div className="flex bg-neutral-800/80 rounded-lg p-0.5 border border-neutral-700/50">
              <button
                onClick={() => setViewMode('full_flow')}
                className={`px-2.5 py-1 text-[11px] font-bold rounded-md transition-all ${
                  viewMode === 'full_flow'
                    ? 'bg-pink-600 text-white shadow-sm'
                    : 'text-neutral-400 hover:text-white'
                }`}
                title="Desplegar canción completa en orden secuencial de ejecución"
              >
                Flujo Continuo
              </button>
              <button
                onClick={() => setViewMode('unique_sections')}
                className={`px-2.5 py-1 text-[11px] font-bold rounded-md transition-all ${
                  viewMode === 'unique_sections'
                    ? 'bg-pink-600 text-white shadow-sm'
                    : 'text-neutral-400 hover:text-white'
                }`}
                title="Mostrar solo secciones únicas"
              >
                Secciones
              </button>
            </div>

            {/* Fix key for service */}
            {onFixKey && transposeSemitones !== 0 && (
              <button
                onClick={handleFixKey}
                className="text-xs font-bold text-green-400 bg-green-500/10 border border-green-500/20 px-3 py-1.5 rounded-lg hover:bg-green-500/20 transition-colors"
              >
                Fijar tono
              </button>
            )}
            
            {/* Copy */}
            <button
              onClick={handleCopyText}
              className="text-xs text-neutral-400 hover:text-white bg-neutral-800/60 hover:bg-neutral-700/60 border border-neutral-700/50 px-2.5 py-1.5 rounded-xl transition-colors flex items-center gap-1.5"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? '¡Copiado!' : 'Copiar'}
            </button>
          </div>
        </div>

        {/* ── Structure Map ── */}
        <div className="px-4 py-2 bg-neutral-900/30 border-b border-neutral-800/30 flex items-center justify-between">
          <div className="flex flex-wrap gap-1 items-center">
            {chart.structure.map((item, idx) => {
              const section = chart.sections.find(s => s.id === item.sectionId);
              if (!section) return null;
              const isActive = activeStructureIdx === idx;
              
              return (
                <div key={`${item.sectionId}-${idx}`} className="flex items-center">
                  {idx > 0 && <ChevronRight className="w-3 h-3 text-neutral-700 mx-0.5" />}
                  <button
                    onClick={() => setActiveStructureIdx(idx)}
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-md border transition-all ${
                      isActive
                        ? SECTION_TYPE_BADGE_COLORS[section.type] + ' ring-1 ring-white/20 scale-110'
                        : 'bg-neutral-800/50 text-neutral-500 border-neutral-700/30 hover:text-neutral-300'
                    }`}
                  >
                    {SECTION_TYPE_SHORT[section.type]}
                    {chart.sections.filter(s => s.type === section.type).length > 1
                      ? (chart.sections.filter(s => s.type === section.type).indexOf(section) + 1)
                      : ''}
                    {item.repeats > 1 && <span className="ml-0.5 opacity-70">×{item.repeats}</span>}
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Chart Content ── */}
        <div className="px-5 py-4 space-y-5 max-h-[55vh] overflow-y-auto custom-scrollbar">
          {sectionsToRender.map(({ section, repeats, structureIdx, iteration }, renderIdx) => (
            <div
              key={`${section.id}-${structureIdx}-${iteration}`}
              id={`section-${structureIdx}`}
              className={`rounded-xl border ${SECTION_TYPE_COLORS[section.type]} p-4 transition-all ${
                activeStructureIdx === structureIdx ? 'ring-1 ring-pink-500/30' : ''
              }`}
              onClick={() => setActiveStructureIdx(structureIdx)}
            >
              {/* Section label */}
              <div className="flex items-center justify-between gap-2 mb-3">
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] font-black tracking-[0.15em] uppercase px-2 py-0.5 rounded border ${SECTION_TYPE_BADGE_COLORS[section.type]}`}>
                    {section.label}
                  </span>
                  {repeats > 1 && viewMode === 'full_flow' && (
                    <span className="flex items-center gap-0.5 text-[10px] text-pink-400 font-bold bg-pink-500/10 px-2 py-0.5 rounded border border-pink-500/20">
                      <Repeat className="w-3 h-3" /> Repetición {iteration} de {repeats}
                    </span>
                  )}
                  {repeats > 1 && viewMode === 'unique_sections' && (
                    <span className="flex items-center gap-0.5 text-[10px] text-neutral-500 font-bold">
                      <Repeat className="w-3 h-3" /> ×{repeats}
                    </span>
                  )}
                </div>
                {viewMode === 'full_flow' && (
                  <span className="text-[10px] font-mono text-neutral-600">
                    Paso {renderIdx + 1} de {sectionsToRender.length}
                  </span>
                )}
              </div>

              {/* Lines */}
              <div className="space-y-1">
                {section.lines.map((line) => (
                  <div key={line.id} className="relative">
                    {/* Chords row */}
                    {line.chords.length > 0 && (
                      <div className="relative h-5 font-mono text-sm select-none">
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
                                className="absolute text-pink-400 font-bold bg-neutral-950/40 px-0.5 rounded"
                                style={{ left: `${posEm}em` }}
                              >
                                {chordText}
                              </span>
                            );
                          });
                        })()}
                      </div>
                    )}
                    
                    {/* Lyrics row */}
                    {line.lyrics.trim() && (
                      <p className="text-white text-sm font-mono leading-relaxed">
                        {line.lyrics}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}

          {/* Notes */}
          {chart.notes && (
            <div className="bg-neutral-900/50 border border-neutral-800 rounded-xl p-3">
              <p className="text-[10px] text-neutral-500 uppercase tracking-wider font-bold mb-1">Notas</p>
              <p className="text-xs text-neutral-400 whitespace-pre-wrap">{chart.notes}</p>
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div className="px-4 py-2 border-t border-neutral-800/50 flex items-center justify-between">
          <span className="text-[9px] text-neutral-600 font-medium">
            {chart.sections.length} secciones · Asaf Worship
          </span>
          <span className="text-[9px] text-neutral-600 font-medium">
            Tonalidad: {currentKey}
          </span>
        </div>
      </div>
    </div>
  );
}
