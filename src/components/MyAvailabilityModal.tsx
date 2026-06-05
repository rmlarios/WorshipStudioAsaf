"use client";

import { useState, useMemo } from 'react';
import { User, ServiceDate, Availability } from '../lib/types';
import * as store from '../lib/firebaseStore';
import { X, Loader2, Calendar, Check } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

interface MyAvailabilityModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User;
  serviceDates: ServiceDate[];
  availabilities: Availability[];
  onSaveSuccess: () => Promise<void>;
}

export default function MyAvailabilityModal({
  isOpen,
  onClose,
  currentUser,
  serviceDates,
  availabilities,
  onSaveSuccess,
}: MyAvailabilityModalProps) {
  const [localAvails, setLocalAvails] = useState<Record<string, boolean>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [wasOpen, setWasOpen] = useState(false);

  // Derive initial availabilities from props (no effect needed)
  const initialAvails = useMemo(() => {
    const avails: Record<string, boolean> = {};
    serviceDates.forEach(date => {
      const myAvail = availabilities.find(
        a => a.serviceDateId === date.id && a.userId === currentUser.id
      );
      avails[date.id] = myAvail ? myAvail.available : false;
    });
    return avails;
  }, [serviceDates, availabilities, currentUser.id]);

  // React-recommended pattern: adjust state during render when prop changes
  if (isOpen && !wasOpen) {
    setLocalAvails(initialAvails);
    setWasOpen(true);
  }
  if (!isOpen && wasOpen) {
    setWasOpen(false);
  }

  const handleToggle = (dateId: string) => {
    setLocalAvails(prev => ({ ...prev, [dateId]: !prev[dateId] }));
  };

  const hasChanges = Object.keys(localAvails).some(
    key => localAvails[key] !== initialAvails[key]
  );

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const promises: Promise<void>[] = [];

      for (const dateId of Object.keys(localAvails)) {
        if (localAvails[dateId] !== initialAvails[dateId]) {
          const newAvail = localAvails[dateId];
          promises.push(store.setAvailability(dateId, currentUser.id, newAvail));

          // If user set to unavailable and had a role, unassign
          if (!newAvail) {
            const date = serviceDates.find(d => d.id === dateId);
            if (date) {
              let changed = false;
              const updatedDate = { ...date };
              if (updatedDate.directorId === currentUser.id) {
                updatedDate.directorId = '';
                changed = true;
              }
              if (updatedDate.acompaniantesIds.includes(currentUser.id)) {
                updatedDate.acompaniantesIds = updatedDate.acompaniantesIds.filter(
                  id => id !== currentUser.id
                );
                changed = true;
              }
              if (changed) {
                promises.push(store.updateServiceDate(updatedDate));
              }
            }
          }
        }
      }

      await Promise.all(promises);
      await onSaveSuccess();
      onClose();
    } catch (err) {
      console.error('Error saving availability:', err);
    }
    setIsSaving(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div
        className="w-full max-w-md rounded-3xl shadow-2xl overflow-hidden animate-scale-in relative flex flex-col max-h-[85vh]"
        style={{
          background: '#121212',
          border: '1px solid rgba(255,255,255,0.07)',
          boxShadow: '0 0 60px rgba(236,72,153,0.15), 0 25px 60px rgba(0,0,0,0.8)',
        }}
      >
        {/* Header */}
        <div
          className="p-5 border-b border-neutral-800/60 shrink-0 flex items-center justify-between"
          style={{ background: 'rgba(15,15,15,0.9)', backdropFilter: 'blur(12px)' }}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-pink-500/15 border border-pink-500/20 flex items-center justify-center">
              <Calendar className="w-5 h-5 text-pink-400" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white leading-tight">Mi Disponibilidad</h3>
              <p className="text-xs text-neutral-500 mt-0.5">{currentUser.name}</p>
            </div>
          </div>
          <button
            disabled={isSaving}
            onClick={onClose}
            className="p-2 hover:bg-neutral-800 rounded-full transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5 text-neutral-500 hover:text-white" />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 custom-scrollbar">
          {serviceDates.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-neutral-500 text-sm">No hay cultos programados para este mes.</p>
            </div>
          ) : (
            <div className="divide-y divide-neutral-800/40">
              {serviceDates.map(date => {
                const isAvail = localAvails[date.id] ?? false;
                const wasChanged = localAvails[date.id] !== initialAvails[date.id];

                return (
                  <div
                    key={date.id}
                    className={`flex items-center justify-between px-5 py-4 transition-colors ${
                      date.locked ? 'opacity-40 pointer-events-none' : 'hover:bg-white/[0.03]'
                    } ${wasChanged ? 'bg-pink-500/5' : ''}`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                          isAvail
                            ? 'bg-green-500/15 border border-green-500/25'
                            : 'bg-neutral-800 border border-neutral-700/50'
                        }`}
                      >
                        <span
                          className={`text-xs font-black ${
                            isAvail ? 'text-green-400' : 'text-neutral-500'
                          }`}
                        >
                          {format(parseISO(date.dateStr), 'dd')}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-white truncate">{date.dayName}</p>
                        <p className="text-[11px] text-neutral-500 capitalize">
                          {format(parseISO(date.dateStr), 'EEEE dd MMM', { locale: es })}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      {date.locked && (
                        <span className="text-[8px] bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded font-bold border border-red-500/20 uppercase tracking-widest">
                          Cerrado
                        </span>
                      )}
                      <button
                        onClick={() => handleToggle(date.id)}
                        disabled={date.locked}
                        className={`relative inline-flex h-7 w-12 items-center rounded-full transition-all duration-200 ${
                          isAvail
                            ? 'bg-green-500 shadow-[0_0_12px_rgba(34,197,94,0.3)]'
                            : 'bg-neutral-700'
                        }`}
                      >
                        <span
                          className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition-transform duration-200 ${
                            isAvail ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          className="p-4 border-t border-neutral-800/60 shrink-0 flex items-center justify-between gap-3"
          style={{ background: 'rgba(10,10,10,0.9)', backdropFilter: 'blur(8px)' }}
        >
          <p className="text-[10px] text-neutral-600 font-medium">
            {hasChanges ? (
              <span className="text-pink-400">
                Hay cambios sin guardar
              </span>
            ) : (
              'Sin cambios'
            )}
          </p>
          <div className="flex gap-2">
            <button
              disabled={isSaving}
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-neutral-400 hover:text-white transition-colors rounded-xl"
            >
              Cancelar
            </button>
            <button
              disabled={isSaving || !hasChanges}
              onClick={handleSave}
              className="px-6 py-2 text-white text-sm font-bold rounded-xl transition-all flex items-center gap-2 disabled:opacity-40 glow-pink"
              style={{
                background: 'linear-gradient(135deg, #db2777, #9d174d)',
                boxShadow: hasChanges ? '0 0 20px rgba(219,39,119,0.3)' : 'none',
              }}
            >
              {isSaving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Check className="w-4 h-4" />
              )}
              <span>Guardar</span>
            </button>
          </div>
        </div>

        {/* Saving overlay */}
        {isSaving && (
          <div className="absolute inset-0 bg-neutral-950/50 backdrop-blur-[2px] flex items-center justify-center z-30 flex-col gap-3">
            <Loader2 className="w-10 h-10 animate-spin text-pink-500 icon-glow-pink" />
            <span className="text-white font-semibold text-sm">Guardando disponibilidad...</span>
          </div>
        )}
      </div>
    </div>
  );
}
