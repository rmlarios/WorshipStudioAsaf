"use client";

import { ServiceDate, User } from '../lib/types';
import { X } from 'lucide-react';
import Link from 'next/link';

const SECTIONS = [
  { id: 'ALABANZAS', label: 'Alabanzas' },
  { id: 'ADORACIÓN', label: 'Adoración' },
  { id: 'OFRENDA', label: 'Ofrenda' },
  { id: 'DESPEDIDA', label: 'Despedida' },
  { id: 'GENERAL', label: 'General' },
] as const;

interface SetlistPreviewProps {
  serviceDate: ServiceDate | null;
  allUsers: User[];
  onClose: () => void;
  /** If true, shows "Editar →" link in footer. Defaults to true. */
  showEditLink?: boolean;
}

export default function SetlistPreview({ serviceDate, allUsers, onClose, showEditLink = true }: SetlistPreviewProps) {
  if (!serviceDate) return null;

  const directorName = allUsers.find(u => u.id === serviceDate.directorId)?.name || 'Sin asignar';
  const activeSections = SECTIONS.filter(sec =>
    serviceDate.songs?.some(s => (s.section || 'GENERAL') === sec.id)
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/85 backdrop-blur-sm text-white"
      onClick={onClose}
    >
      <div style={{ zoom: 1.25 }}
        className="bg-neutral-950 border border-neutral-800/80 rounded-xl w-full max-w-xs shadow-[0_0_40px_rgba(236,72,153,0.12)] relative overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-2 right-2 p-1 bg-neutral-900 hover:bg-neutral-800 rounded-full z-10 transition-colors"
        >
          <X className="w-3.5 h-3.5 text-neutral-400" />
        </button>

        {/* Header */}
        <div className="bg-gradient-to-b from-neutral-900 to-neutral-950 px-4 pt-4 pb-3 border-b border-neutral-800/50">
          <h3 className="text-base font-black tracking-widest text-white uppercase text-center leading-tight">
            {serviceDate.dayName}
          </h3>
          <p className="text-[10px] text-pink-400/70 font-bold uppercase tracking-widest text-center mt-0.5">
            {serviceDate.dateStr}
          </p>
          <div className="flex justify-center mt-2">
            <span className="text-[9px] bg-neutral-800 border border-neutral-700/50 text-neutral-400 px-2 py-0.5 rounded-full uppercase font-bold tracking-wider">
              Preside: <span className="text-pink-300">{directorName}</span>
            </span>
          </div>
        </div>

        {/* Song list */}
        <div className="px-3 py-2.5 space-y-3">
          {(!serviceDate.songs || serviceDate.songs.length === 0) ? (
            <p className="text-center text-neutral-600 text-xs py-4">No hay canciones en este culto.</p>
          ) : (
            activeSections.map(section => {
              const sectionSongs = serviceDate.songs.filter(
                s => (s.section || 'GENERAL') === section.id
              );
              return (
                <div key={section.id}>
                  {/* Section label */}
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[8px] font-black tracking-[0.15em] text-neutral-600 uppercase shrink-0">
                      {section.label}
                    </span>
                    <div className="h-px bg-neutral-800 flex-1"></div>
                  </div>
                  {/* Songs */}
                  <div className="space-y-0.5">
                    {sectionSongs.map((song, i) => {
                      const singerName = allUsers.find(u => u.id === song.leadSingerId)?.name;
                      const showSinger = !!song.leadSingerId && song.leadSingerId !== serviceDate.directorId;
                      return (
                        <div
                          key={song.id}
                          className="flex items-center justify-between gap-2 px-2 py-1.5 rounded-md hover:bg-neutral-900/60 transition-colors"
                        >
                          <div className="flex items-center gap-1.5 min-w-0 flex-1">
                            <span className="text-[9px] font-bold text-neutral-700 shrink-0 w-3.5 text-right">
                              {i + 1}.
                            </span>
                            <div className="min-w-0">
                              <span className="font-semibold text-white text-[11px] leading-none block truncate">
                                {song.title}
                              </span>
                              {showSinger && (
                                <span className="text-[10px] text-pink-400/80 font-medium">
                                  ↳ {singerName}
                                </span>
                              )}
                            </div>
                          </div>
                          <span className="text-[10px] font-mono font-bold text-pink-400 shrink-0 bg-pink-950/40 px-1.5 py-0.5 rounded border border-pink-900/40">
                            {song.tone}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2 border-t border-neutral-800/50 flex items-center justify-between">
          <span className="text-[9px] text-neutral-600 font-medium">
            {serviceDate.songs?.length || 0} canciones · Asaf Worship
          </span>
          {showEditLink && (
            <Link
              href={`/dashboard/${serviceDate.id}`}
              className="text-[9px] text-pink-500 hover:text-pink-400 font-bold uppercase tracking-wider transition-colors"
            >
              Editar →
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
