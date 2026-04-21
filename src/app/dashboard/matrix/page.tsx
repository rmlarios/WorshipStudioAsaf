"use client";

import { useState, useEffect, useCallback, useMemo, Fragment } from 'react';
import Link from 'next/link';
import * as store from '../../../lib/firebaseStore';
import { User, ServiceDate, Availability } from '../../../lib/types';
import { ChevronLeft, ChevronRight, Check, X, Star, Mic2, Minus, Loader2, AlertTriangle, Music, Badge, Eye } from 'lucide-react';
import { format, addMonths, subMonths, parseISO, startOfMonth } from 'date-fns';
import { es } from 'date-fns/locale';

export default function MatrixView() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [currentMonth, setCurrentMonth] = useState<Date>(startOfMonth(new Date()));
  const [serviceDates, setServiceDates] = useState<ServiceDate[]>([]);
  const [availabilities, setAvailabilities] = useState<Availability[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCell, setSelectedCell] = useState<{ userId: string, dateId: string } | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Bulk Edit States
  interface BulkState {
    availabilities: Record<string, boolean>;
    directorId: string;
    acompaniantesIds: string[];
  }
  const [selectedDateForBulk, setSelectedDateForBulk] = useState<ServiceDate | null>(null);
  const [bulkState, setBulkState] = useState<BulkState | null>(null);
  const [previewDate, setPreviewDate] = useState<ServiceDate | null>(null);

  useEffect(() => {
    const userStr = localStorage.getItem('currentUser');
    if (userStr) {
      setCurrentUser(JSON.parse(userStr));
    }
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const users = await store.getActiveUsers();
      setAllUsers(users);

      const monthStr = format(currentMonth, 'yyyy-MM');
      const dates = await store.getServiceDatesByMonth(monthStr);
      dates.sort((a, b) => a.dateStr.localeCompare(b.dateStr));
      setServiceDates(dates);

      const globalAvails: Availability[] = [];
      for (const d of dates) {
        const dAvail = await store.getAvailabilities(d.id);
        globalAvails.push(...dAvail);
      }
      setAvailabilities(globalAvails);
    } catch (err) {
      console.error('Error loading data:', err);
    }
    setLoading(false);
  }, [currentMonth]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleUpdateRole = async (role: 'LEADER' | 'CHOIR' | 'REMOVE') => {
    if (!selectedCell) return;
    setIsSaving(true);
    try {
      const date = serviceDates.find(d => d.id === selectedCell.dateId);
      if (!date) return;

      const updatedDate = { ...date };
      const userId = selectedCell.userId;

      if (role === 'LEADER') {
        // If they were choir, remove them first
        updatedDate.acompaniantesIds = updatedDate.acompaniantesIds.filter(id => id !== userId);
        updatedDate.directorId = userId;
      } else if (role === 'CHOIR') {
        // If they were leader, clear that
        if (updatedDate.directorId === userId) updatedDate.directorId = '';
        // Add to choir if not already there
        if (!updatedDate.acompaniantesIds.includes(userId)) {
          updatedDate.acompaniantesIds.push(userId);
        }
      } else if (role === 'REMOVE') {
        if (updatedDate.directorId === userId) updatedDate.directorId = '';
        updatedDate.acompaniantesIds = updatedDate.acompaniantesIds.filter(id => id !== userId);
      }

      await store.updateServiceDate(updatedDate);
      await loadData();
      setSelectedCell(null);
    } catch (err) {
      console.error('Error updating role:', err);
    }
    setIsSaving(false);
  };

  const handleToggleAvailability = async (available: boolean) => {
    if (!selectedCell) return;
    setIsSaving(true);
    try {
      await store.setAvailability(selectedCell.dateId, selectedCell.userId, available);

      // Si estamos marcando como NO disponible y el usuario estaba asignado a LIDER o CORO, 
      // limpiamos su asignación automáticamente para mantener consistencia.
      if (!available) {
        const date = serviceDates.find(d => d.id === selectedCell.dateId);
        if (date) {
          let changed = false;
          const updatedDate = { ...date };
          if (updatedDate.directorId === selectedCell.userId) {
            updatedDate.directorId = '';
            changed = true;
          }
          if (updatedDate.acompaniantesIds.includes(selectedCell.userId)) {
            updatedDate.acompaniantesIds = updatedDate.acompaniantesIds.filter(id => id !== selectedCell.userId);
            changed = true;
          }
          if (changed) {
            await store.updateServiceDate(updatedDate);
          }
        }
      }

      await loadData();
      // No cerramos el modal, permitiendo que asigne un rol tras forzar disponibilidad.
    } catch (err) {
      console.error('Error toggling availability:', err);
    }
    setIsSaving(false);
  };

  const handleOpenBulk = (date: ServiceDate) => {
    if (date.locked) return;
    const availsMap: Record<string, boolean> = {};
    allUsers.forEach(u => {
      const myAvail = availabilities.find(a => a.serviceDateId === date.id && a.userId === u.id);
      availsMap[u.id] = myAvail ? myAvail.available : false;
    });

    setBulkState({
      availabilities: availsMap,
      directorId: date.directorId || '',
      acompaniantesIds: [...date.acompaniantesIds]
    });
    setSelectedDateForBulk(date);
  };

  const handleSaveBulk = async () => {
    if (!selectedDateForBulk || !bulkState) return;
    setIsSaving(true);
    try {
      const promises: Promise<void>[] = [];
      allUsers.forEach(u => {
        const myAvailRaw = availabilities.find(a => a.serviceDateId === selectedDateForBulk.id && a.userId === u.id);
        const originalAvail = myAvailRaw ? myAvailRaw.available : undefined;
        const currentAvail = bulkState.availabilities[u.id];

        // Save if changed from original, or if newly defined as essentially taking an action in the UI
        if (originalAvail !== currentAvail) {
          promises.push(store.setAvailability(selectedDateForBulk.id, u.id, currentAvail));
        }
      });
      await Promise.all(promises);

      const updatedDate = { ...selectedDateForBulk };
      updatedDate.directorId = bulkState.directorId;
      updatedDate.acompaniantesIds = bulkState.acompaniantesIds;
      await store.updateServiceDate(updatedDate);

      await loadData();
      setSelectedDateForBulk(null);
      setBulkState(null);
    } catch (err) {
      console.error(err);
    }
    setIsSaving(false);
  };

  const groupedUsers = useMemo(() => {
    const directors = allUsers.filter(u => u.role === 'DIRECTOR');
    const cantores = allUsers.filter(u => u.role === 'CANTOR');
    const musicos = allUsers.filter(u => u.role === 'MUSICO');
    return [
      { role: 'Directores', users: directors },
      { role: 'Cantores', users: cantores },
      { role: 'Músicos', users: musicos }
    ];
  }, [allUsers]);

  if (!currentUser) return null;
  if (currentUser.role !== 'DIRECTOR') {
    return <div className="p-8 text-center text-white">Acceso Denegado. Solo Directores.</div>;
  }

  return (
    <div className="space-y-6 animate-fade-in flex flex-col h-[calc(100vh-80px)] md:h-[calc(100vh-120px)]">
      {/* Header */}
      <div className="flex items-center justify-between bg-neutral-900 p-4 rounded-2xl border border-neutral-800 shrink-0">
        <button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} className="p-2 hover:bg-neutral-800 rounded-full transition-colors">
          <ChevronLeft className="w-6 h-6 text-neutral-400" />
        </button>
        <div className="text-center">
          <h2 className="text-xl font-bold text-white capitalize">
            {format(currentMonth, 'MMMM yyyy', { locale: es })}
          </h2>
          <p className="text-xs text-neutral-400 mt-1 uppercase tracking-widest">Matriz de Planificación</p>
        </div>
        <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} className="p-2 hover:bg-neutral-800 rounded-full transition-colors">
          <ChevronRight className="w-6 h-6 text-neutral-400" />
        </button>
      </div>

      {loading ? (
        <div className="flex-1 flex justify-center items-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-pink-500" />
        </div>
      ) : serviceDates.length === 0 ? (
        <div className="flex-1 flex flex-col justify-center items-center text-center py-20 bg-neutral-900 rounded-2xl border border-neutral-800 border-dashed">
          <h3 className="text-lg font-medium text-white mb-2">No hay cultos programados</h3>
          <p className="text-sm text-neutral-500">Crea cultos desde la pantalla principal para poder visualizarlos en la matriz.</p>
        </div>
      ) : (
        <div className="flex-1 bg-neutral-900 rounded-2xl border border-neutral-800 overflow-hidden flex flex-col shadow-xl">
          <div className="overflow-auto flex-1 custom-scrollbar">
            <table className="w-full text-sm text-left border-collapse">
              <thead className="bg-neutral-950/80 backdrop-blur-md sticky top-0 z-30">
                <tr>
                  <th className="sticky left-0 z-40 bg-neutral-950 p-4 min-w-[150px] border-b border-r border-neutral-800 text-neutral-400 font-semibold uppercase text-xs tracking-wider">
                    Miembro del Equipo
                  </th>
                  {serviceDates.map(date => (
                    <th key={date.id} className="p-0 min-w-[140px] text-center border-b border-neutral-800 whitespace-nowrap bg-neutral-950/90 group hover:bg-neutral-800 transition-colors">
                      <div className="flex flex-col w-full h-full">
                        <button
                          onClick={() => handleOpenBulk(date)}
                          className="flex flex-col items-center justify-center p-3 w-full border-b border-transparent hover:bg-white/5 transition-colors cursor-pointer disabled:opacity-50"
                          disabled={date.locked}
                          title={date.locked ? undefined : "Programar Equipo (Editor Masivo)"}
                        >
                          <span className="text-[10px] text-neutral-500 uppercase font-bold tracking-widest mb-1">{format(parseISO(date.dateStr), 'dd MMM', { locale: es })}</span>
                          <div className="flex items-center space-x-1.5 mb-1.5">
                            <span className="text-white font-medium">{date.dayName.split(' ')[0]}</span>
                            {!date.directorId && <span title="Sin Líder"><AlertTriangle className="w-3.5 h-3.5 text-yellow-500 drop-shadow-[0_0_5px_rgba(234,179,8,0.5)]" /></span>}
                          </div>
                          {date.locked && <span className="text-[9px] bg-red-500/20 text-red-500 px-1.5 py-0.5 rounded font-bold border border-red-500/20 mt-1">CERRADO</span>}
                        </button>

                        <div className="flex bg-neutral-950 border-t border-neutral-800/50">
                          <Link href={`/dashboard/${date.id}`} className={`flex-1 flex items-center justify-center py-2 hover:bg-neutral-800 transition-colors tooltip tooltip-bottom`} title="Ir a Pizarra Musical">
                            <div className={`flex items-center space-x-1.5 px-2 py-0.5 rounded text-[10px] font-bold transition-colors ${date.songs?.length > 0 ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-neutral-800/50 text-neutral-500 border border-neutral-800/50 hover:bg-neutral-800 hover:text-neutral-400'}`}>
                              <Music className="w-3 h-3" />
                              <span>{date.songs?.length || 0}</span>
                            </div>
                          </Link>
                          {date.songs?.length > 0 && (
                            <button
                              onClick={() => setPreviewDate(date)}
                              className="flex items-center justify-center px-3 py-2 border-l border-neutral-800/50 hover:bg-neutral-800 transition-colors"
                              title="Vista Previa (WhatsApp)"
                            >
                              <Eye className="w-4 h-4 text-pink-500" />
                            </button>
                          )}
                        </div>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800 relative z-0">
                {groupedUsers.map(group => (
                  group.users.length > 0 && (
                    <Fragment key={group.role}>
                      <tr>
                        <td colSpan={serviceDates.length + 1} className="bg-neutral-900/90 py-2 px-4 text-xs font-bold text-pink-500 uppercase tracking-widest border-b border-t border-neutral-800 sticky left-0 z-20 backdrop-blur-md">
                          {group.role}
                        </td>
                      </tr>
                      {group.users.map(user => (
                        <tr key={user.id} className="hover:bg-neutral-800/30 transition-colors group">
                          <td className="sticky left-0 z-20 bg-neutral-900/95 backdrop-blur-sm p-4 border-r border-neutral-800 group-hover:bg-neutral-800/95 transition-colors">
                            <div className="flex flex-col">
                              <span className="text-white font-medium text-sm truncate mb-1.5">{user.name}</span>
                              <div className="inline-flex items-center text-[10px] text-neutral-400 space-x-2.5 bg-neutral-800/40 border border-neutral-700/50 rounded-md px-2 py-1 mt-0.5 w-fit">
                                {(() => {
                                  const dispCount = availabilities.filter(a => a.userId === user.id && a.available).length;
                                  const partCount = serviceDates.filter(d => d.directorId === user.id || d.acompaniantesIds.includes(user.id)).length;
                                  return (
                                    <>
                                      <span title="Días Disponible" className="flex items-center font-semibold" aria-label="disponible"><Check className="w-3.5 h-3.5 text-green-400 mr-0.5" />{dispCount}</span>
                                      <span className="w-px h-2.5 bg-neutral-700/50 block"></span>
                                      <span title="Días Asignado" className="flex items-center font-semibold" aria-label="asignado"><Star className="w-3 h-3 text-yellow-500 mr-1" />{partCount}</span>
                                      <span className="w-px h-2.5 bg-neutral-700/50 block"></span>
                                      <span title="Total Cultos" className="opacity-60 font-medium">/ {serviceDates.length}</span>
                                    </>
                                  );
                                })()}
                              </div>
                            </div>
                          </td>
                          {serviceDates.map(date => {
                            const myAvail = availabilities.find(a => a.serviceDateId === date.id && a.userId === user.id);
                            const hasAnswered = !!myAvail;
                            const isAvailable = myAvail?.available === true;

                            const isDirector = date.directorId === user.id;
                            const isAcompaniante = date.acompaniantesIds.includes(user.id);
                            const canAssign = user.role !== 'MUSICO';

                            let cellClass = "p-2 border-r border-neutral-800/50 flex flex-col items-center justify-center h-full min-h-[60px] transition-all";
                            if (canAssign && !date.locked) {
                              cellClass += " cursor-pointer hover:bg-white/10 group/cell";
                              if (!isAvailable) cellClass += " opacity-70 hover:opacity-100";
                            } else {
                              cellClass += " opacity-50";
                            }

                            let content: React.ReactNode = null;

                            if (isDirector) {
                              cellClass += " bg-yellow-500/20 shadow-[inset_0_0_15px_rgba(234,179,8,0.2)]";
                              content = (
                                <div className="flex flex-col items-center">
                                  <Star className="w-5 h-5 text-yellow-500 mb-1 drop-shadow-[0_0_8px_rgba(234,179,8,0.8)]" fill="currentColor" />
                                  <span className="text-[9px] text-yellow-500 font-bold uppercase tracking-widest">Preside</span>
                                </div>
                              );
                            } else if (isAcompaniante) {
                              cellClass += " bg-pink-500/10 shadow-[inset_0_0_10px_rgba(236,72,153,0.1)]";
                              content = (
                                <div className="flex flex-col items-center">
                                  <Mic2 className="w-5 h-5 text-pink-400 mb-1" />
                                  <span className="text-[9px] text-pink-400 font-bold uppercase tracking-widest">Canta</span>
                                </div>
                              );
                            } else if (hasAnswered) {
                              if (isAvailable) {
                                if (user.role === 'MUSICO') {
                                  cellClass += " bg-blue-500/10 shadow-[inset_0_0_10px_rgba(59,130,246,0.1)]";
                                  content = (
                                    <div className="flex flex-col items-center">
                                      <Check className="w-5 h-5 text-blue-400 mb-1" />
                                      <span className="text-[9px] text-blue-400 font-bold uppercase tracking-widest">Músico</span>
                                    </div>
                                  );
                                } else {
                                  cellClass += " bg-green-500/5 hover:bg-green-500/10";
                                  content = (
                                    <div className="flex flex-col items-center">
                                      <Check className="w-5 h-5 text-green-500 mb-1" />
                                      <span className="text-[9px] text-green-500/70 font-bold uppercase tracking-widest">Disp.</span>
                                    </div>
                                  );
                                }
                              } else {
                                cellClass += " bg-red-500/5";
                                content = (
                                  <div className="flex flex-col items-center opacity-70">
                                    <X className="w-5 h-5 text-red-500 mb-1" />
                                    <span className="text-[9px] text-red-500 font-bold uppercase tracking-widest">No Disp.</span>
                                  </div>
                                );
                              }
                            } else {
                              cellClass += " bg-neutral-800/10";
                              content = (
                                <div className="flex flex-col items-center opacity-40">
                                  <Minus className="w-5 h-5 text-neutral-500 mb-1" />
                                  <span className="text-[9px] text-neutral-500 font-bold uppercase tracking-widest">S/R</span>
                                </div>
                              );
                            }

                            return (
                              <td
                                key={date.id}
                                className="p-0 border-b border-neutral-800"
                                onClick={() => {
                                  if (canAssign && !date.locked) setSelectedCell({ userId: user.id, dateId: date.id });
                                }}
                              >
                                <div className={cellClass}>
                                  {content}
                                </div>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </Fragment>
                  )
                ))}
              </tbody>
            </table>
          </div>

          {/* Legend Section */}
          <div className="bg-neutral-950 p-4 border-t border-neutral-800 flex flex-wrap gap-4 items-center justify-center shrink-0">
            <span className="text-xs text-neutral-400 font-bold uppercase tracking-widest mr-2">Leyenda:</span>
            <div className="flex items-center space-x-2 text-xs text-neutral-300">
              <div className="w-6 h-6 rounded bg-yellow-500/20 flex items-center justify-center shadow-[inset_0_0_10px_rgba(234,179,8,0.2)]"><Star className="w-3 h-3 text-yellow-500" fill="currentColor" /></div>
              <span>Director</span>
            </div>
            <div className="flex items-center space-x-2 text-xs text-neutral-300">
              <div className="w-6 h-6 rounded bg-pink-500/10 flex items-center justify-center"><Mic2 className="w-3 h-3 text-pink-400" /></div>
              <span>Coro</span>
            </div>
            <div className="flex items-center space-x-2 text-xs text-neutral-300">
              <div className="w-6 h-6 rounded bg-blue-500/10 flex items-center justify-center"><Check className="w-3 h-3 text-blue-400" /></div>
              <span>Músico (Disp.)</span>
            </div>
            <div className="flex items-center space-x-2 text-xs text-neutral-300">
              <div className="w-6 h-6 rounded flex items-center justify-center"><Check className="w-4 h-4 text-green-500" /></div>
              <span>Cantor (Disp.)</span>
            </div>
            <div className="flex items-center space-x-2 text-xs text-neutral-300">
              <div className="w-6 h-6 rounded flex items-center justify-center bg-red-500/5"><X className="w-4 h-4 text-red-500" /></div>
              <span>No Disp.</span>
            </div>
            <div className="flex items-center space-x-2 text-xs text-neutral-300">
              <div className="w-6 h-6 rounded flex items-center justify-center bg-neutral-800/10"><Minus className="w-4 h-4 text-neutral-500" /></div>
              <span>Sin Responder</span>
            </div>
          </div>
        </div>
      )}

      {/* Assignment Modal */}
      {selectedCell && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-neutral-900 border border-neutral-800 w-full max-w-sm rounded-3xl shadow-2xl overflow-hidden animate-scale-in relative">
            <div className="p-6">
              {(() => {
                const user = allUsers.find(u => u.id === selectedCell.userId);
                const date = serviceDates.find(d => d.id === selectedCell.dateId);
                const avail = availabilities.find(a => a.serviceDateId === selectedCell.dateId && a.userId === selectedCell.userId);
                const isAvailable = avail?.available === true;

                return (
                  <>
                    <div className="mb-6">
                      <h3 className="text-xl font-bold text-white mb-1">Programar Miembro</h3>
                      <p className="text-sm text-neutral-400">
                        {user?.name} &bull; {date?.dayName}
                      </p>
                    </div>

                    {!isAvailable ? (
                      <div className="space-y-4 mb-6">
                        <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-xl flex items-start space-x-3">
                          <X className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                          <div>
                            <p className="text-sm font-bold text-red-400">No Disponible</p>
                            <p className="text-xs text-red-400/70">Este usuario marcó como ausente o no ha respondido.</p>
                          </div>
                        </div>

                        {/* Emergency Adjustment */}
                        <div className="border-t border-neutral-800 pt-4">
                          <p className="text-[10px] text-neutral-500 font-bold tracking-widest uppercase mb-3">Ajuste Administrativo</p>
                          <button
                            disabled={isSaving}
                            onClick={() => handleToggleAvailability(true)}
                            className="w-full flex items-center justify-between p-3 bg-neutral-800 hover:bg-neutral-700 border border-neutral-700/50 rounded-xl transition-all disabled:opacity-50 group"
                          >
                            <div className="flex items-center space-x-3 text-neutral-300">
                              <Check className="w-4 h-4 text-green-500" />
                              <span className="font-medium text-sm">Forzar Disponibilidad</span>
                            </div>
                            <ChevronRight className="w-4 h-4 text-neutral-600 group-hover:translate-x-1 transition-transform" />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-3 mb-6">
                        <button
                          disabled={isSaving}
                          onClick={() => handleUpdateRole('LEADER')}
                          className="w-full flex items-center justify-between p-4 bg-yellow-500/10 hover:bg-yellow-500/20 border border-yellow-500/20 rounded-2xl transition-all group disabled:opacity-50"
                        >
                          <div className="flex items-center space-x-3">
                            <Star className="w-5 h-5 text-yellow-500" fill="currentColor" />
                            <span className="font-bold text-yellow-500">Asignar como Líder</span>
                          </div>
                          <ChevronRight className="w-4 h-4 text-yellow-600 group-hover:translate-x-1 transition-transform" />
                        </button>

                        <button
                          disabled={isSaving}
                          onClick={() => handleUpdateRole('CHOIR')}
                          className="w-full flex items-center justify-between p-4 bg-pink-500/10 hover:bg-pink-500/20 border border-pink-500/20 rounded-2xl transition-all group disabled:opacity-50"
                        >
                          <div className="flex items-center space-x-3">
                            <Mic2 className="w-5 h-5 text-pink-400" />
                            <span className="font-bold text-pink-400">Asignar como Coro</span>
                          </div>
                          <ChevronRight className="w-4 h-4 text-pink-600 group-hover:translate-x-1 transition-transform" />
                        </button>

                        <button
                          disabled={isSaving}
                          onClick={() => handleUpdateRole('REMOVE')}
                          className="w-full flex items-center justify-between p-4 bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 rounded-2xl transition-all disabled:opacity-50"
                        >
                          <div className="flex items-center space-x-3 text-neutral-400">
                            <Minus className="w-5 h-5" />
                            <span className="font-bold">Quitar Asignación</span>
                          </div>
                        </button>

                        {/* Emergency Adjustment for Available */}
                        <div className="border-t border-neutral-800 pt-3 mt-4">
                          <button
                            disabled={isSaving}
                            onClick={() => handleToggleAvailability(false)}
                            className="w-full flex items-center justify-between p-3 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 rounded-xl transition-all disabled:opacity-50"
                          >
                            <div className="flex items-center space-x-3 text-neutral-400">
                              <X className="w-4 h-4 text-red-500" />
                              <span className="text-sm">Marcar como No Disponible</span>
                            </div>
                          </button>
                        </div>
                      </div>
                    )}

                    <button
                      onClick={() => setSelectedCell(null)}
                      className="w-full py-3 text-neutral-500 hover:text-white font-medium transition-colors"
                    >
                      Cancelar
                    </button>
                  </>
                );
              })()}
            </div>
            {isSaving && (
              <div className="absolute inset-0 bg-neutral-950/60 backdrop-blur-[2px] flex items-center justify-center z-40">
                <Loader2 className="w-10 h-10 animate-spin text-pink-500" />
              </div>
            )}
          </div>
        </div>
      )}
      {/* Bulk Editor Modal */}
      {selectedDateForBulk && bulkState && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-neutral-900 border border-neutral-800 w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden animate-scale-in relative flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-neutral-800 shrink-0 flex items-center justify-between bg-neutral-900/90 relative z-20">
              <div>
                <h3 className="text-xl font-bold text-white mb-1">Editor Masivo de Culto</h3>
                <p className="text-sm text-neutral-400 capitalize">
                  {selectedDateForBulk.dayName} &bull; {format(parseISO(selectedDateForBulk.dateStr), 'dd MMM yyyy', { locale: es })}
                </p>
              </div>
              <button
                disabled={isSaving}
                onClick={() => { setSelectedDateForBulk(null); setBulkState(null); }}
                className="p-2 hover:bg-neutral-800 rounded-full transition-colors disabled:opacity-50"
              >
                <X className="w-6 h-6 text-neutral-500 hover:text-white" />
              </button>
            </div>

            <div className="p-0 overflow-y-auto flex-1 custom-scrollbar">
              <table className="w-full text-sm text-left">
                <thead className="bg-[#121212] sticky top-0 z-10 border-b border-neutral-800 shadow-sm">
                  <tr>
                    <th className="p-4 text-neutral-400 font-semibold uppercase text-[10px] tracking-wider">Miembro del Equipo</th>
                    <th className="p-4 text-neutral-400 font-semibold uppercase text-[10px] tracking-wider text-center w-28 border-l border-neutral-800/50">Disponibilidad</th>
                    <th className="p-4 text-neutral-400 font-semibold uppercase text-[10px] tracking-wider text-center w-64 border-l border-neutral-800/50">Asignación Directa</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-800/50 bg-[#171717]">
                  {groupedUsers.map(group => (
                    group.users.length > 0 && (
                      <Fragment key={group.role}>
                        <tr>
                          <td colSpan={3} className="bg-neutral-950/80 py-2.5 px-4 text-[10px] font-bold text-pink-500 uppercase tracking-widest border-b border-neutral-800">
                            {group.role}
                          </td>
                        </tr>
                        {group.users.map(user => {
                          const isAvail = bulkState.availabilities[user.id] || false;
                          const isDirector = bulkState.directorId === user.id;
                          const isChoir = bulkState.acompaniantesIds.includes(user.id);
                          const roleType = isDirector ? 'LIDER' : isChoir ? 'CORO' : 'NONE';

                          return (
                            <tr key={user.id} className="hover:bg-neutral-800/50 transition-colors">
                              <td className="p-4 flex flex-col justify-center">
                                <span className="text-white font-medium text-sm">{user.name}</span>
                              </td>
                              <td className="p-4 text-center align-middle border-l border-neutral-800/50 bg-[#1a1a1a]/40">
                                {/* Toggle Switch */}
                                <button
                                  onClick={() => {
                                    const nowAvail = !isAvail;
                                    const nextAcomp = [...bulkState.acompaniantesIds];
                                    let nextDir = bulkState.directorId;

                                    if (!nowAvail) {
                                      if (nextDir === user.id) nextDir = '';
                                      const idx = nextAcomp.indexOf(user.id);
                                      if (idx !== -1) nextAcomp.splice(idx, 1);
                                    }

                                    setBulkState({
                                      ...bulkState,
                                      availabilities: { ...bulkState.availabilities, [user.id]: nowAvail },
                                      directorId: nextDir,
                                      acompaniantesIds: nextAcomp
                                    });
                                  }}
                                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${isAvail ? 'bg-green-500' : 'bg-neutral-700'}`}
                                >
                                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${isAvail ? 'translate-x-6' : 'translate-x-1'}`} />
                                </button>
                              </td>
                              <td className="p-4 border-l border-neutral-800/50">
                                {user.role !== 'MUSICO' ? (
                                  <div className={`flex items-center space-x-1 bg-neutral-950 p-1 rounded-lg border border-neutral-800 transition-all ${!isAvail ? 'opacity-30 pointer-events-none grayscale' : 'opacity-100'}`}>
                                    <button
                                      onClick={() => {
                                        setBulkState({
                                          ...bulkState,
                                          directorId: user.id,
                                          acompaniantesIds: bulkState.acompaniantesIds.filter(id => id !== user.id)
                                        });
                                      }}
                                      className={`flex-1 flex justify-center items-center py-1.5 px-2 rounded-md text-xs font-bold transition-all ${isDirector ? 'bg-yellow-500/20 text-yellow-500 shadow-sm' : 'text-neutral-500 hover:text-white hover:bg-neutral-800'}`}
                                    >
                                      <Star className="w-3.5 h-3.5 mr-1" fill={isDirector ? "currentColor" : "none"} /> Líder
                                    </button>
                                    <button
                                      onClick={() => {
                                        const nextAcomp = [...bulkState.acompaniantesIds];
                                        if (!nextAcomp.includes(user.id)) nextAcomp.push(user.id);

                                        setBulkState({
                                          ...bulkState,
                                          directorId: bulkState.directorId === user.id ? '' : bulkState.directorId,
                                          acompaniantesIds: nextAcomp
                                        });
                                      }}
                                      className={`flex-1 flex justify-center items-center py-1.5 px-2 rounded-md text-xs font-bold transition-all ${isChoir ? 'bg-pink-500/20 text-pink-400 shadow-sm' : 'text-neutral-500 hover:text-white hover:bg-neutral-800'}`}
                                    >
                                      <Mic2 className="w-3.5 h-3.5 mr-1" /> Coro
                                    </button>
                                    <button
                                      onClick={() => {
                                        setBulkState({
                                          ...bulkState,
                                          directorId: bulkState.directorId === user.id ? '' : bulkState.directorId,
                                          acompaniantesIds: bulkState.acompaniantesIds.filter(id => id !== user.id)
                                        });
                                      }}
                                      className={`p-1.5 rounded-md text-neutral-500 hover:text-white hover:bg-neutral-800 transition-colors ${roleType === 'NONE' ? 'text-white bg-neutral-800' : ''}`}
                                      title="Quitar Asignación"
                                    >
                                      <Minus className="w-4 h-4" />
                                    </button>
                                  </div>
                                ) : (
                                  <div className="flex justify-center items-center opacity-50 h-full">
                                    <span className="text-[10px] text-neutral-500 font-bold uppercase tracking-widest flex items-center"><Check className="w-3 h-3 mr-1" /> Soporte Base</span>
                                  </div>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </Fragment>
                    )
                  ))}
                </tbody>
              </table>
            </div>

            <div className="p-5 border-t border-neutral-800 bg-neutral-900 shrink-0 flex justify-end space-x-3 relative z-20">
              <button
                disabled={isSaving}
                onClick={() => { setSelectedDateForBulk(null); setBulkState(null); }}
                className="px-5 py-2.5 text-sm font-medium text-neutral-300 hover:text-white transition-colors"
              >
                Cancelar
              </button>
              <button
                disabled={isSaving}
                onClick={handleSaveBulk}
                className="px-8 py-2.5 bg-pink-600 hover:bg-pink-500 text-white text-sm font-bold rounded-xl transition-all shadow-[0_0_20px_rgba(219,39,119,0.3)] hover:shadow-[0_0_25px_rgba(219,39,119,0.5)] flex items-center space-x-2 disabled:opacity-50"
              >
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                <span>Guardar Controles</span>
              </button>
            </div>
            {isSaving && (
              <div className="absolute inset-0 bg-neutral-950/40 backdrop-blur-[1px] flex items-center justify-center z-30 flex-col">
                <Loader2 className="w-10 h-10 animate-spin text-pink-500 mb-4" />
                <span className="text-white font-medium text-sm drop-shadow-md">Procesando equipo...</span>
              </div>
            )}
          </div>
        </div>
      )}
      {/* Inline Setlist Preview Modal */}
      {previewDate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/85 backdrop-blur-sm text-white" onClick={() => setPreviewDate(null)}>
          <div className="bg-neutral-950 border border-neutral-800/80 rounded-xl w-full max-w-xs shadow-[0_0_40px_rgba(236,72,153,0.15)] relative overflow-hidden" onClick={e => e.stopPropagation()}>
            {/* Close */}
            <button onClick={() => setPreviewDate(null)} className="absolute top-2 right-2 p-1 bg-neutral-900 hover:bg-neutral-800 rounded-full z-10 transition-colors">
              <X className="w-3.5 h-3.5 text-neutral-400" />
            </button>

            {/* Header */}
            <div className="bg-gradient-to-b from-neutral-900 to-neutral-950 px-4 pt-4 pb-3 border-b border-neutral-800/50">
              <h3 className="text-base font-black tracking-widest text-white uppercase text-center leading-tight">{previewDate.dayName}</h3>
              <p className="text-[10px] text-pink-400/70 font-bold uppercase tracking-widest text-center mt-0.5">{previewDate.dateStr}</p>
              <div className="flex justify-center mt-2">
                <span className="text-[9px] bg-neutral-800 border border-neutral-700/50 text-neutral-400 px-2 py-0.5 rounded-full uppercase font-bold tracking-wider">
                  Preside: <span className="text-pink-300">{allUsers.find(u => u.id === previewDate.directorId)?.name || 'Sin asignar'}</span>
                </span>
              </div>
            </div>

            {/* Song list */}
            <div className="px-3 py-2.5 space-y-3">
              {previewDate.songs?.length === 0 ? (
                <p className="text-center text-neutral-600 text-xs py-4">No hay canciones en este culto.</p>
              ) : (
                [{ id: 'ALABANZAS', label: 'Alabanzas' },
                { id: 'ADORACIÓN', label: 'Adoración' },
                { id: 'OFRENDA', label: 'Ofrenda' },
                { id: 'DESPEDIDA', label: 'Despedida' },
                { id: 'GENERAL', label: 'General' }]
                  .filter(sec => previewDate.songs?.some(s => (s.section || 'GENERAL') === sec.id))
                  .map(section => {
                    const sectionSongs = previewDate.songs?.filter(s => (s.section || 'GENERAL') === section.id) || [];
                    return (
                      <div key={section.id}>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[8px] font-black tracking-[0.15em] text-neutral-600 uppercase shrink-0">{section.label}</span>
                          <div className="h-px bg-neutral-800 flex-1"></div>
                        </div>
                        <div className="space-y-0.5">
                          {sectionSongs.map((song, i) => {
                            const singerName = allUsers.find(u => u.id === song.leadSingerId)?.name;
                            const showSinger = !!song.leadSingerId && song.leadSingerId !== previewDate.directorId;
                            return (
                              <div key={song.id} className="flex items-center justify-between gap-2 px-2 py-1.5 rounded-md hover:bg-neutral-900/60 transition-colors">
                                <div className="flex items-center gap-1.5 min-w-0 flex-1">
                                  <span className="text-[9px] font-bold text-neutral-700 shrink-0 w-3.5 text-right">{i + 1}.</span>
                                  <div className="min-w-0">
                                    <span className="font-semibold text-white text-[11px] leading-none block truncate">{song.title}</span>
                                    {showSinger && (
                                      <span className="text-[10px] text-pink-400/80 font-medium">↳ {singerName}</span>
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
              <span className="text-[9px] text-neutral-600 font-medium">{previewDate.songs?.length || 0} canciones · Asaf</span>
              <Link href={`/dashboard/${previewDate.id}`} className="text-[9px] text-pink-500 hover:text-pink-400 font-bold uppercase tracking-wider transition-colors">Editar →</Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
