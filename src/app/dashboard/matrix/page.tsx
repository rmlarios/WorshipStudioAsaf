"use client";

import { useState, useEffect, useCallback, useMemo, Fragment } from 'react';
import Link from 'next/link';
import * as store from '../../../lib/firebaseStore';
import { User, ServiceDate, Availability } from '../../../lib/types';
import { ChevronLeft, ChevronRight, Check, X, Crown, Mic2, Minus, Loader2, AlertTriangle, Music, Eye, FileText, CheckCircle2 } from 'lucide-react';
import { format, addMonths, subMonths, parseISO, startOfMonth } from 'date-fns';
import { es } from 'date-fns/locale';
import SetlistPreview from '../../../components/SetlistPreview';
import { exportMonthToPDF } from '../../../lib/exportUtils';

// --- Helpers ---
function getInitials(name: string): string {
  return name.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase();
}

function Avatar({ name, size = 'md' }: { name: string; size?: 'sm' | 'md' }) {
  const initials = getInitials(name);
  const colors: Record<string, string> = {
    A: 'bg-pink-600', B: 'bg-purple-600', C: 'bg-indigo-600', D: 'bg-blue-600',
    E: 'bg-cyan-600', F: 'bg-teal-600', G: 'bg-green-600', H: 'bg-yellow-600',
    I: 'bg-orange-600', J: 'bg-red-600', K: 'bg-rose-600', L: 'bg-fuchsia-600',
    M: 'bg-violet-600', N: 'bg-sky-600', O: 'bg-amber-600', P: 'bg-lime-600',
    Q: 'bg-emerald-600', R: 'bg-pink-700', S: 'bg-purple-700', T: 'bg-indigo-700',
    U: 'bg-blue-700', V: 'bg-cyan-700', W: 'bg-teal-700', X: 'bg-green-700',
    Y: 'bg-yellow-700', Z: 'bg-orange-700',
  };
  const bg = colors[initials[0]] ?? 'bg-neutral-600';
  const sz = size === 'sm' ? 'w-7 h-7 text-[10px]' : 'w-9 h-9 text-xs';
  return (
    <div className={`${sz} ${bg} rounded-full flex items-center justify-center font-bold text-white shrink-0 ring-2 ring-neutral-900`}>
      {initials}
    </div>
  );
}

export default function MatrixView() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [currentMonth, setCurrentMonth] = useState<Date>(startOfMonth(new Date()));
  const [serviceDates, setServiceDates] = useState<ServiceDate[]>([]);
  const [availabilities, setAvailabilities] = useState<Availability[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCell, setSelectedCell] = useState<{ userId: string, dateId: string } | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  interface BulkState {
    availabilities: Record<string, boolean>;
    directorId: string;
    acompaniantesIds: string[];
  }
  const [selectedDateForBulk, setSelectedDateForBulk] = useState<ServiceDate | null>(null);
  const [bulkState, setBulkState] = useState<BulkState | null>(null);
  const [previewDate, setPreviewDate] = useState<ServiceDate | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    const userStr = localStorage.getItem('currentUser');
    if (userStr) setCurrentUser(JSON.parse(userStr));
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

  useEffect(() => { loadData(); }, [loadData]);

  const handleUpdateRole = async (role: 'LEADER' | 'CHOIR' | 'REMOVE') => {
    if (!selectedCell) return;
    setIsSaving(true);
    try {
      const date = serviceDates.find(d => d.id === selectedCell.dateId);
      if (!date) return;
      const updatedDate = { ...date };
      const userId = selectedCell.userId;
      if (role === 'LEADER') {
        updatedDate.acompaniantesIds = updatedDate.acompaniantesIds.filter(id => id !== userId);
        updatedDate.directorId = userId;
      } else if (role === 'CHOIR') {
        if (updatedDate.directorId === userId) updatedDate.directorId = '';
        if (!updatedDate.acompaniantesIds.includes(userId)) updatedDate.acompaniantesIds.push(userId);
      } else {
        if (updatedDate.directorId === userId) updatedDate.directorId = '';
        updatedDate.acompaniantesIds = updatedDate.acompaniantesIds.filter(id => id !== userId);
      }
      await store.updateServiceDate(updatedDate);
      await loadData();
      setSelectedCell(null);
    } catch (err) { console.error(err); }
    setIsSaving(false);
  };

  const handleToggleAvailability = async (available: boolean) => {
    if (!selectedCell) return;
    setIsSaving(true);
    try {
      await store.setAvailability(selectedCell.dateId, selectedCell.userId, available);
      if (!available) {
        const date = serviceDates.find(d => d.id === selectedCell.dateId);
        if (date) {
          let changed = false;
          const updatedDate = { ...date };
          if (updatedDate.directorId === selectedCell.userId) { updatedDate.directorId = ''; changed = true; }
          if (updatedDate.acompaniantesIds.includes(selectedCell.userId)) {
            updatedDate.acompaniantesIds = updatedDate.acompaniantesIds.filter(id => id !== selectedCell.userId);
            changed = true;
          }
          if (changed) await store.updateServiceDate(updatedDate);
        }
      }
      await loadData();
    } catch (err) { console.error(err); }
    setIsSaving(false);
  };

  const handleOpenBulk = (date: ServiceDate) => {
    if (date.locked) return;
    const availsMap: Record<string, boolean> = {};
    allUsers.forEach(u => {
      const myAvail = availabilities.find(a => a.serviceDateId === date.id && a.userId === u.id);
      availsMap[u.id] = myAvail ? myAvail.available : false;
    });
    setBulkState({ availabilities: availsMap, directorId: date.directorId || '', acompaniantesIds: [...date.acompaniantesIds] });
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
        if (originalAvail !== currentAvail) promises.push(store.setAvailability(selectedDateForBulk.id, u.id, currentAvail));
      });
      await Promise.all(promises);
      const updatedDate = { ...selectedDateForBulk, directorId: bulkState.directorId, acompaniantesIds: bulkState.acompaniantesIds };
      await store.updateServiceDate(updatedDate);
      await loadData();
      setSelectedDateForBulk(null);
      setBulkState(null);
    } catch (err) { console.error(err); }
    setIsSaving(false);
  };

  const handleExportPDF = async () => {
    setIsExporting(true);
    try {
      const monthStr = format(currentMonth, 'yyyy-MM');
      await exportMonthToPDF(monthStr);
    } catch (err) {
      console.error(err);
      alert("Error al exportar PDF");
    }
    setIsExporting(false);
  };

  const groupedUsers = useMemo(() => {
    return [
      { role: 'Directores', users: allUsers.filter(u => u.role === 'DIRECTOR') },
      { role: 'Cantores', users: allUsers.filter(u => u.role === 'CANTOR') },
      { role: 'Músicos', users: allUsers.filter(u => u.role === 'MUSICO') },
    ];
  }, [allUsers]);

  if (!currentUser) return null;
  if (currentUser.role !== 'DIRECTOR' && currentUser.role !== 'VISOR') {
    return <div className="p-8 text-center text-white">Acceso Denegado.</div>;
  }

  return (
    <div className="space-y-4 animate-fade-in flex flex-col h-[calc(100vh-80px)] md:h-[calc(100vh-120px)]">

      {/* ── Header ── */}
      <div className="flex items-center justify-between shrink-0 px-1">
        <button
          onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
          className="p-2.5 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 rounded-xl transition-colors"
        >
          <ChevronLeft className="w-5 h-5 text-neutral-400" />
        </button>

        <div className="text-center">
          <h2 className="text-xl font-extrabold text-white capitalize tracking-tight">
            {format(currentMonth, 'MMMM yyyy', { locale: es })}
          </h2>
          <div className="flex items-center justify-center gap-3 mt-1">
            <p className="text-neutral-500 uppercase tracking-widest font-semibold">Matriz de Planificación</p>
            <span className="w-1 h-1 bg-neutral-700 rounded-full" />
            <button
              onClick={handleExportPDF}
              disabled={isExporting}
              className="flex items-center gap-1 text-pink-500 hover:text-pink-300 font-bold uppercase tracking-widest transition-all disabled:opacity-50"
            >
              {isExporting ? <Loader2 className="w-3 h-3 animate-spin" /> : <FileText className="w-3 h-3" />}
              <span>Exportar PDF</span>
            </button>
          </div>
        </div>

        <button
          onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
          className="p-2.5 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 rounded-xl transition-colors"
        >
          <ChevronRight className="w-5 h-5 text-neutral-400" />
        </button>
      </div>

      {/* ── Body ── */}
      {loading ? (
        <div className="flex-1 flex justify-center items-center">
          <Loader2 className="w-8 h-8 animate-spin text-pink-500" />
        </div>
      ) : serviceDates.length === 0 ? (
        <div className="flex-1 flex flex-col justify-center items-center text-center py-20 bg-neutral-900 rounded-2xl border border-dashed border-neutral-800">
          <h3 className="text-lg font-medium text-white mb-2">No hay cultos programados</h3>
          <p className="text-sm text-neutral-500">Crea cultos desde la pantalla principal para visualizarlos en la matriz.</p>
        </div>
      ) : (
        <div className="flex-1 rounded-2xl border border-neutral-800 overflow-hidden flex flex-col shadow-2xl"
          style={{ background: 'linear-gradient(160deg, #131313 0%, #0d0d0d 100%)' }}>

          <div className="overflow-auto flex-1 custom-scrollbar">
            <table className="w-full text-sm text-left border-collapse">

              {/* ── Column Headers ── */}
              <thead className="sticky top-0 z-30" style={{ background: 'rgba(10,10,10,0.9)', backdropFilter: 'blur(12px)' }}>
                <tr>
                  <th className="sticky left-0 z-40 p-4 min-w-[180px] border-b border-r border-neutral-800/60 text-neutral-500 font-semibold uppercase text-[10px] tracking-widest"
                    style={{ background: 'rgba(10,10,10,0.98)' }}>
                    Equipo de Producción
                  </th>
                  {serviceDates.map(date => (
                    <th key={date.id} className="p-0 min-w-[130px] text-center border-b border-neutral-800/60 whitespace-nowrap group">
                      <div className="flex flex-col w-full h-full">
                        {/* Date header button → opens bulk editor */}
                        <button
                          onClick={() => handleOpenBulk(date)}
                          disabled={date.locked || currentUser.role !== 'DIRECTOR'}
                          title={date.locked || currentUser.role !== 'DIRECTOR' ? undefined : 'Editor Masivo'}
                          className="flex flex-col items-center justify-center px-3 py-2.5 w-full border-b border-neutral-800/40 hover:bg-white/5 transition-colors disabled:opacity-50"
                        >
                          <span className="text-[11px] text-neutral-600 uppercase font-bold tracking-widest mb-1">
                            {format(parseISO(date.dateStr), 'dd MMM', { locale: es })}
                          </span>
                          <div className="flex items-center gap-1.5">
                            <span className="text-white font-bold text-sm">{date.dayName.split(' ')[0]}</span>
                            {!date.directorId && (
                              <AlertTriangle className="w-3 h-3 text-yellow-500 icon-glow-yellow" />
                            )}
                          </div>
                          {date.locked && (
                            <span className="text-[8px] bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded font-bold border border-red-500/20 mt-1 uppercase tracking-widest">
                              Cerrado
                            </span>
                          )}
                        </button>

                        {/* Song count + preview */}
                        <div className="flex" style={{ background: 'rgba(8,8,8,0.7)' }}>
                          <Link
                            href={`/dashboard/${date.id}`}
                            className="flex-1 flex items-center justify-center py-1.5 hover:bg-white/5 transition-colors"
                            title="Pizarra Musical"
                          >
                            <div className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold transition-colors ${date.songs?.length > 0 ? 'text-green-400' : 'text-neutral-600'}`}>
                              <Music className="w-3.5 h-3.5" />
                              <span>{date.songs?.length || 0}</span>
                            </div>
                          </Link>
                          {date.songs?.length > 0 && (
                            <button
                              onClick={() => setPreviewDate(date)}
                              className="flex items-center justify-center px-2.5 border-l border-neutral-800/30 hover:bg-white/5 transition-colors"
                              title="Vista Previa"
                            >
                              <Eye className="w-3.5 h-3.5 text-pink-500 icon-glow-pink" />
                            </button>
                          )}
                        </div>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>

              {/* ── Rows ── */}
              <tbody className="divide-y divide-neutral-800/30 relative z-0">
                {groupedUsers.map(group => (
                  group.users.length > 0 && (
                    <Fragment key={group.role}>
                      {/* Group header row */}
                      <tr>
                        <td
                          colSpan={serviceDates.length + 1}
                          className="sticky left-0 z-20 py-2 px-5 text-[9px] font-black text-pink-500 uppercase tracking-[0.2em] border-b border-t border-neutral-800/40"
                          style={{ background: 'rgba(6,6,6,0.95)', backdropFilter: 'blur(8px)' }}
                        >
                          {group.role}
                        </td>
                      </tr>

                      {group.users.map(user => (
                        <tr key={user.id} className="hover:bg-white/[0.02] transition-colors group">

                          {/* ── Member column ── */}
                          <td
                            className="sticky left-0 z-20 p-3 border-r border-neutral-800/40 group-hover:bg-white/[0.025] transition-colors"
                            style={{ background: 'rgba(10,10,10,0.97)', backdropFilter: 'blur(8px)' }}
                          >
                            <div className="flex items-center gap-3">
                              <Avatar name={user.name} />
                              <div className="flex flex-col min-w-0">
                                <span className="text-white font-semibold text-sm truncate leading-tight">{user.name}</span>
                                {/* Availability stats */}
                                <div className="flex items-center gap-2 mt-1">
                                  {(() => {
                                    const dispCount = availabilities.filter(a => a.userId === user.id && a.available).length;
                                    const partCount = serviceDates.filter(d => d.directorId === user.id || d.acompaniantesIds.includes(user.id)).length;
                                    return (
                                      <div className="flex items-center gap-1.5 font-bold text-neutral-600">
                                        <span className="flex items-center gap-0.5 text-green-500/70">
                                          <Check className="w-2.5 h-2.5" />{dispCount}
                                        </span>
                                        <span className="text-neutral-700">·</span>
                                        <span className="flex items-center gap-0.5 text-yellow-500/70">
                                          <Crown className="w-2.5 h-2.5" />{partCount}
                                        </span>
                                        <span className="text-neutral-700">/ {serviceDates.length}</span>
                                      </div>
                                    );
                                  })()}
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* ── Role cells ── */}
                          {serviceDates.map(date => {
                            const myAvail = availabilities.find(a => a.serviceDateId === date.id && a.userId === user.id);
                            const hasAnswered = !!myAvail;
                            const isAvailable = myAvail?.available === true;
                            const isDirector = date.directorId === user.id;
                            const isAcompaniante = date.acompaniantesIds.includes(user.id);
                            const canAssign = user.role !== 'MUSICO';

                            // Build the cell appearance
                            let wrapperClass = "relative flex flex-col items-center justify-center h-full min-h-[64px] transition-all duration-150 rounded-sm";
                            let bgStyle: React.CSSProperties = {};
                            let content: React.ReactNode;

                            if (isDirector) {
                              wrapperClass += " glow-yellow cursor-pointer";
                              bgStyle = { background: 'rgba(250,204,21,0.12)' };
                              content = (
                                <div className="flex flex-col items-center gap-0.5">
                                  <Crown className="w-5 h-5 text-yellow-400 icon-glow-yellow" fill="currentColor" />
                                  <span className="text-[8px] text-yellow-400 font-black uppercase tracking-widest">Encargado</span>
                                </div>
                              );
                            } else if (isAcompaniante) {
                              wrapperClass += " glow-pink cursor-pointer";
                              bgStyle = { background: 'rgba(236,72,153,0.12)' };
                              content = (
                                <div className="flex flex-col items-center gap-0.5">
                                  <Mic2 className="w-5 h-5 text-pink-400 icon-glow-pink" />
                                  <span className="text-[8px] text-pink-400 font-black uppercase tracking-widest">Coro</span>
                                </div>
                              );
                            } else if (hasAnswered && isAvailable) {
                              if (user.role === 'MUSICO') {
                                wrapperClass += " glow-blue";
                                bgStyle = { background: 'rgba(59,130,246,0.08)' };
                                content = (
                                  <div className="flex flex-col items-center gap-0.5">
                                    <Music className="w-5 h-5 text-blue-400 icon-glow-blue" />
                                    <span className="text-[8px] text-blue-400 font-black uppercase tracking-widest">Músico</span>
                                  </div>
                                );
                              } else {
                                wrapperClass += " glow-green cursor-pointer";
                                bgStyle = { background: 'rgba(16,185,129,0.07)' };
                                content = (
                                  <div className="flex flex-col items-center gap-0.5">
                                    <CheckCircle2 className="w-5 h-5 text-emerald-400 icon-glow-green" />
                                    <span className="text-[8px] text-emerald-400 font-black uppercase tracking-widest">Disponible</span>
                                  </div>
                                );
                              }
                            } else if (hasAnswered && !isAvailable) {
                              wrapperClass += " cursor-pointer opacity-60 hover:opacity-90";
                              bgStyle = { background: 'rgba(239,68,68,0.05)' };
                              content = (
                                <div className="flex flex-col items-center gap-0.5">
                                  <X className="w-5 h-5 text-red-500" />
                                  <span className="text-[8px] text-red-500/70 font-black uppercase tracking-widest">No Disp.</span>
                                </div>
                              );
                            } else {
                              wrapperClass += " opacity-60";
                              bgStyle = { background: 'rgba(239,68,68,0.05)' };
                              content = (
                                <div className="flex flex-col items-center gap-0.5">
                                  <X className="w-5 h-5 text-red-500" />
                                  <span className="text-[8px] text-red-500/70 font-black uppercase tracking-widest">No Disp.</span>
                                </div>
                              );
                            }
                            
                            const isEditable = canAssign && !date.locked && currentUser.role === 'DIRECTOR';
                            if (isEditable) wrapperClass += " cursor-pointer hover:brightness-125 group/cell";
                            
                            return (
                              <td
                                key={date.id}
                                className="p-1 border-r border-neutral-800/20"
                                onClick={() => { if (isEditable) setSelectedCell({ userId: user.id, dateId: date.id }); }}
                              >
                                <div className={wrapperClass} style={bgStyle}>
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

          {/* ── Legend ── */}
          <div className="shrink-0 px-5 py-3 border-t border-neutral-800/60 flex flex-wrap gap-4 items-center justify-center"
            style={{ background: 'rgba(8,8,8,0.9)', backdropFilter: 'blur(8px)' }}>
            <span className="text-[9px] text-neutral-600 font-black uppercase tracking-[0.2em]">Leyenda</span>
            {[
              { icon: <Crown className="w-3 h-3 text-yellow-400 icon-glow-yellow" fill="currentColor" />, bg: 'rgba(250,204,21,0.15)', label: 'Encargado', cls: 'glow-yellow' },
              { icon: <Mic2 className="w-3 h-3 text-pink-400 icon-glow-pink" />, bg: 'rgba(236,72,153,0.12)', label: 'Coro', cls: 'glow-pink' },
              { icon: <Music className="w-3 h-3 text-blue-400 icon-glow-blue" />, bg: 'rgba(59,130,246,0.10)', label: 'Músico Disp.', cls: 'glow-blue' },
              { icon: <CheckCircle2 className="w-3 h-3 text-emerald-400 icon-glow-green" />, bg: 'rgba(16,185,129,0.08)', label: 'Cantor Disp.', cls: 'glow-green' },
              { icon: <X className="w-3 h-3 text-red-500" />, bg: 'rgba(239,68,68,0.06)', label: 'No Disp.', cls: '' },
              { icon: <Minus className="w-3 h-3 text-neutral-600" />, bg: 'transparent', label: 'Sin Respuesta', cls: '' },
            ].map(({ icon, bg, label, cls }) => (
              <div key={label} className={`flex items-center gap-1.5 ${cls}`}>
                <div className="w-5 h-5 rounded flex items-center justify-center" style={{ background: bg }}>
                  {icon}
                </div>
                <span className="text-[10px] text-neutral-500 font-semibold">{label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Assignment Modal ── */}
      {selectedCell && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="bg-neutral-900 border border-neutral-700/60 w-full max-w-sm rounded-3xl shadow-2xl overflow-hidden animate-scale-in relative"
            style={{ boxShadow: '0 0 40px rgba(236,72,153,0.12), 0 25px 50px rgba(0,0,0,0.7)' }}>
            <div className="p-6">
              {(() => {
                const user = allUsers.find(u => u.id === selectedCell.userId);
                const date = serviceDates.find(d => d.id === selectedCell.dateId);
                const avail = availabilities.find(a => a.serviceDateId === selectedCell.dateId && a.userId === selectedCell.userId);
                const isAvailable = avail?.available === true;

                return (
                  <>
                    <div className="flex items-center gap-3 mb-6">
                      {user && <Avatar name={user.name} />}
                      <div>
                        <h3 className="text-lg font-bold text-white leading-tight">Programar Miembro</h3>
                        <p className="text-sm text-neutral-400">{user?.name} · {date?.dayName}</p>
                      </div>
                    </div>

                    {!isAvailable ? (
                      <div className="space-y-4 mb-6">
                        <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-xl flex items-start gap-3">
                          <X className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                          <div>
                            <p className="text-sm font-bold text-red-400">No Disponible</p>
                            <p className="text-xs text-red-400/70">Este usuario marcó ausencia o no ha respondido.</p>
                          </div>
                        </div>
                        <div className="border-t border-neutral-800 pt-4">
                          <p className="text-[9px] text-neutral-500 font-black tracking-widest uppercase mb-3">Ajuste Administrativo</p>
                          <button
                            disabled={isSaving}
                            onClick={() => handleToggleAvailability(true)}
                            className="w-full flex items-center justify-between p-3 bg-neutral-800 hover:bg-neutral-700 border border-neutral-700/50 rounded-xl transition-all disabled:opacity-50 group"
                          >
                            <div className="flex items-center gap-3 text-neutral-300">
                              <Check className="w-4 h-4 text-green-500" />
                              <span className="font-medium text-sm">Forzar Disponibilidad</span>
                            </div>
                            <ChevronRight className="w-4 h-4 text-neutral-600 group-hover:translate-x-1 transition-transform" />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2.5 mb-5">
                        <button
                          disabled={isSaving}
                          onClick={() => handleUpdateRole('LEADER')}
                          className="w-full flex items-center justify-between p-4 rounded-2xl transition-all group disabled:opacity-50 glow-yellow hover:brightness-110"
                          style={{ background: 'rgba(250,204,21,0.12)', border: '1px solid rgba(250,204,21,0.25)' }}
                        >
                          <div className="flex items-center gap-3">
                            <Crown className="w-5 h-5 text-yellow-400 icon-glow-yellow" fill="currentColor" />
                            <span className="font-bold text-yellow-400">Asignar como Encargado</span>
                          </div>
                          <ChevronRight className="w-4 h-4 text-yellow-600 group-hover:translate-x-1 transition-transform" />
                        </button>

                        <button
                          disabled={isSaving}
                          onClick={() => handleUpdateRole('CHOIR')}
                          className="w-full flex items-center justify-between p-4 rounded-2xl transition-all group disabled:opacity-50 glow-pink hover:brightness-110"
                          style={{ background: 'rgba(236,72,153,0.12)', border: '1px solid rgba(236,72,153,0.25)' }}
                        >
                          <div className="flex items-center gap-3">
                            <Mic2 className="w-5 h-5 text-pink-400 icon-glow-pink" />
                            <span className="font-bold text-pink-400">Asignar como Coro</span>
                          </div>
                          <ChevronRight className="w-4 h-4 text-pink-600 group-hover:translate-x-1 transition-transform" />
                        </button>

                        <button
                          disabled={isSaving}
                          onClick={() => handleUpdateRole('REMOVE')}
                          className="w-full flex items-center justify-between p-4 bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 rounded-2xl transition-all disabled:opacity-50"
                        >
                          <div className="flex items-center gap-3 text-neutral-400">
                            <Minus className="w-5 h-5" />
                            <span className="font-bold">Quitar Asignación</span>
                          </div>
                        </button>

                        <div className="border-t border-neutral-800 pt-3 mt-2">
                          <button
                            disabled={isSaving}
                            onClick={() => handleToggleAvailability(false)}
                            className="w-full flex items-center gap-3 p-3 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 rounded-xl transition-all disabled:opacity-50 text-neutral-400"
                          >
                            <X className="w-4 h-4 text-red-500" />
                            <span className="text-sm">Marcar como No Disponible</span>
                          </button>
                        </div>
                      </div>
                    )}

                    <button
                      onClick={() => setSelectedCell(null)}
                      className="w-full py-2.5 text-neutral-500 hover:text-white font-medium transition-colors text-sm"
                    >
                      Cancelar
                    </button>
                  </>
                );
              })()}
            </div>
            {isSaving && (
              <div className="absolute inset-0 bg-neutral-950/60 backdrop-blur-[2px] flex items-center justify-center z-40">
                <Loader2 className="w-10 h-10 animate-spin text-pink-500 icon-glow-pink" />
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Bulk Editor Modal ── */}
      {selectedDateForBulk && bulkState && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden animate-scale-in relative flex flex-col max-h-[90vh]"
            style={{ background: '#121212', border: '1px solid rgba(255,255,255,0.07)', boxShadow: '0 0 60px rgba(236,72,153,0.15), 0 25px 60px rgba(0,0,0,0.8)' }}>

            <div className="p-5 border-b border-neutral-800/60 shrink-0 flex items-center justify-between relative z-20"
              style={{ background: 'rgba(15,15,15,0.9)', backdropFilter: 'blur(12px)' }}>
              <div>
                <h3 className="text-xl font-bold text-white mb-0.5">Editor Masivo</h3>
                <p className="text-sm text-neutral-400 capitalize">
                  {selectedDateForBulk.dayName} · {format(parseISO(selectedDateForBulk.dateStr), 'dd MMM yyyy', { locale: es })}
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

            <div className="overflow-y-auto flex-1 custom-scrollbar">
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-10 border-b border-neutral-800/60"
                  style={{ background: 'rgba(10,10,10,0.95)', backdropFilter: 'blur(8px)' }}>
                  <tr>
                    <th className="p-4 text-[9px] text-neutral-500 font-black uppercase tracking-widest text-left">Miembro</th>
                    <th className="p-4 text-[9px] text-neutral-500 font-black uppercase tracking-widest text-center w-32 border-l border-neutral-800/40">Disponibilidad</th>
                    <th className="p-4 text-[9px] text-neutral-500 font-black uppercase tracking-widest text-center w-64 border-l border-neutral-800/40">Rol</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-800/30">
                  {groupedUsers.map(group => (
                    group.users.length > 0 && (
                      <Fragment key={group.role}>
                        <tr>
                          <td colSpan={3} className="py-2 px-5 text-[9px] font-black text-pink-500 uppercase tracking-[0.2em] border-b border-neutral-800/40"
                            style={{ background: 'rgba(5,5,5,0.8)' }}>
                            {group.role}
                          </td>
                        </tr>
                        {group.users.map(user => {
                          const isAvail = bulkState.availabilities[user.id] || false;
                          const isDirector = bulkState.directorId === user.id;
                          const isChoir = bulkState.acompaniantesIds.includes(user.id);

                          return (
                            <tr key={user.id} className="hover:bg-white/[0.02] transition-colors">
                              <td className="p-4">
                                <div className="flex items-center gap-3">
                                  <Avatar name={user.name} size="sm" />
                                  <span className="text-white font-semibold text-sm">{user.name}</span>
                                </div>
                              </td>
                              <td className="p-4 text-center align-middle border-l border-neutral-800/30">
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
                                    setBulkState({ ...bulkState, availabilities: { ...bulkState.availabilities, [user.id]: nowAvail }, directorId: nextDir, acompaniantesIds: nextAcomp });
                                  }}
                                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${isAvail ? 'bg-green-500' : 'bg-neutral-700'}`}
                                >
                                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${isAvail ? 'translate-x-6' : 'translate-x-1'}`} />
                                </button>
                              </td>
                              <td className="p-4 border-l border-neutral-800/30">
                                {user.role !== 'MUSICO' ? (
                                  <div className={`flex items-center gap-1 p-1 rounded-xl border transition-all ${!isAvail ? 'opacity-25 pointer-events-none' : 'opacity-100'}`}
                                    style={{ background: 'rgba(5,5,5,0.5)', borderColor: 'rgba(255,255,255,0.06)' }}>
                                    <button
                                      onClick={() => setBulkState({ ...bulkState, directorId: user.id, acompaniantesIds: bulkState.acompaniantesIds.filter(id => id !== user.id) })}
                                      className={`flex-1 flex justify-center items-center gap-1 py-1.5 px-2 rounded-lg text-xs font-bold transition-all ${isDirector ? 'glow-yellow text-yellow-400' : 'text-neutral-500 hover:text-white hover:bg-white/5'}`}
                                      style={isDirector ? { background: 'rgba(250,204,21,0.15)' } : {}}
                                    >
                                      <Crown className="w-3 h-3" fill={isDirector ? "currentColor" : "none"} /> Líder
                                    </button>
                                    <button
                                      onClick={() => {
                                        const nextAcomp = [...bulkState.acompaniantesIds];
                                        if (!nextAcomp.includes(user.id)) nextAcomp.push(user.id);
                                        setBulkState({ ...bulkState, directorId: bulkState.directorId === user.id ? '' : bulkState.directorId, acompaniantesIds: nextAcomp });
                                      }}
                                      className={`flex-1 flex justify-center items-center gap-1 py-1.5 px-2 rounded-lg text-xs font-bold transition-all ${isChoir ? 'glow-pink text-pink-400' : 'text-neutral-500 hover:text-white hover:bg-white/5'}`}
                                      style={isChoir ? { background: 'rgba(236,72,153,0.13)' } : {}}
                                    >
                                      <Mic2 className="w-3 h-3" /> Coro
                                    </button>
                                    <button
                                      onClick={() => setBulkState({ ...bulkState, directorId: bulkState.directorId === user.id ? '' : bulkState.directorId, acompaniantesIds: bulkState.acompaniantesIds.filter(id => id !== user.id) })}
                                      className="p-1.5 rounded-lg text-neutral-500 hover:text-white hover:bg-white/5 transition-colors"
                                      title="Quitar Asignación"
                                    >
                                      <Minus className="w-4 h-4" />
                                    </button>
                                  </div>
                                ) : (
                                  <div className="flex justify-center opacity-40">
                                    <span className="text-[9px] text-neutral-500 font-black uppercase tracking-widest flex items-center gap-1">
                                      <Music className="w-3 h-3" /> Soporte Base
                                    </span>
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

            <div className="p-5 border-t border-neutral-800/60 shrink-0 flex justify-end gap-3 relative z-20"
              style={{ background: 'rgba(10,10,10,0.9)', backdropFilter: 'blur(8px)' }}>
              <button
                disabled={isSaving}
                onClick={() => { setSelectedDateForBulk(null); setBulkState(null); }}
                className="px-5 py-2.5 text-sm font-medium text-neutral-400 hover:text-white transition-colors"
              >
                Cancelar
              </button>
              <button
                disabled={isSaving}
                onClick={handleSaveBulk}
                className="px-8 py-2.5 text-white text-sm font-bold rounded-xl transition-all flex items-center gap-2 disabled:opacity-50 glow-pink"
                style={{ background: 'linear-gradient(135deg, #db2777, #9d174d)', boxShadow: '0 0 20px rgba(219,39,119,0.3)' }}
              >
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                <span>Guardar Controles</span>
              </button>
            </div>

            {isSaving && (
              <div className="absolute inset-0 bg-neutral-950/50 backdrop-blur-[2px] flex items-center justify-center z-30 flex-col gap-3">
                <Loader2 className="w-10 h-10 animate-spin text-pink-500 icon-glow-pink" />
                <span className="text-white font-semibold text-sm">Procesando equipo...</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Setlist Preview ── */}
      <SetlistPreview serviceDate={previewDate} allUsers={allUsers} onClose={() => setPreviewDate(null)} />
    </div>
  );
}
