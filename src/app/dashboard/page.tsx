"use client";

import { useState, useEffect, useCallback } from 'react';
import * as store from '../../lib/firebaseStore';
import { User, ServiceDate, Availability } from '../../lib/types';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, CheckCircle2, Circle, CalendarPlus, CalendarDays, Trash2, Loader2, Eye, FileText, MessageCircle } from 'lucide-react';
import { format, addMonths, subMonths, parseISO, startOfMonth, endOfMonth, eachDayOfInterval, getDay } from 'date-fns';
import { es } from 'date-fns/locale';
import SetlistPreview from '../../components/SetlistPreview';
import { exportMonthToPDF } from '../../lib/exportUtils';

export default function Dashboard() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [currentMonth, setCurrentMonth] = useState<Date>(startOfMonth(new Date()));
  const [serviceDates, setServiceDates] = useState<ServiceDate[]>([]);
  const [availabilities, setAvailabilities] = useState<Availability[]>([]);
  const [allAvailabilities, setAllAvailabilities] = useState<Availability[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [refresh, setRefresh] = useState(0);
  const [loading, setLoading] = useState(true);

  // States for Batch Saving Availability
  const [pendingChanges, setPendingChanges] = useState<Record<string, boolean>>({});
  const [isSaving, setIsSaving] = useState(false);

  // States for Admin Date Generator
  const [isGenerating, setIsGenerating] = useState(false);
  const [showManualAdd, setShowManualAdd] = useState(false);
  const [manualDate, setManualDate] = useState('');
  const [manualName, setManualName] = useState('');
  const [previewDate, setPreviewDate] = useState<ServiceDate | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    const userStr = localStorage.getItem('currentUser');
    if (userStr) {
      setCurrentUser(JSON.parse(userStr));
    }
  }, []);

  const loadData = useCallback(async () => {
    if (!currentUser) return;
    setLoading(true);
    try {
      const users = await store.getActiveUsers();
      setAllUsers(users);

      const monthStr = format(currentMonth, 'yyyy-MM');
      const dates = await store.getServiceDatesByMonth(monthStr);
      dates.sort((a, b) => a.dateStr.localeCompare(b.dateStr));
      setServiceDates(dates);

      const myAvails: Availability[] = [];
      const globalAvails: Availability[] = [];
      for (const d of dates) {
        const dAvail = await store.getAvailabilities(d.id);
        globalAvails.push(...dAvail);
        const myAvail = dAvail.find(a => a.userId === currentUser.id);
        if (myAvail) myAvails.push(myAvail);
      }
      setAvailabilities(myAvails);
      setAllAvailabilities(globalAvails);
    } catch (err) {
      console.error('Error loading data:', err);
    }
    setLoading(false);
  }, [currentMonth, currentUser]);

  useEffect(() => {
    loadData();
  }, [loadData, refresh]);

  const toggleAvailability = (serviceDateId: string, currentStatus: boolean, locked: boolean) => {
    if (locked || !currentUser) return;
    setPendingChanges(prev => ({
      ...prev,
      [serviceDateId]: !currentStatus
    }));
  };

  const saveAllAvailabilities = async () => {
    if (!currentUser || Object.keys(pendingChanges).length === 0) return;
    setIsSaving(true);
    try {
      const promises = Object.entries(pendingChanges).map(([dateId, available]) =>
        store.setAvailability(dateId, currentUser.id, available)
      );
      await Promise.all(promises);
      setPendingChanges({});
      setRefresh(r => r + 1);
    } catch (err) {
      console.error("Error saving availabilities:", err);
      alert("Hubo un error al guardar los cambios.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleGenerateMonthDates = async () => {
    setIsGenerating(true);
    const settings = await store.getSettings();
    if (settings.defaultServiceDays.length === 0) {
      alert("Por favor configura los días de culto predeterminados (Ej. Martes/Domingos) en Ajustes primero.");
      setIsGenerating(false);
      return;
    }

    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);
    const monthStr = format(currentMonth, 'yyyy-MM');
    const allDaysInMonth = eachDayOfInterval({ start, end });

    const existingDateStrs = serviceDates.map(d => d.dateStr);

    let addedCount = 0;
    for (const day of allDaysInMonth) {
      const wDay = getDay(day);
      const dayStr = format(day, 'yyyy-MM-dd');

      if (settings.defaultServiceDays.includes(wDay) && !existingDateStrs.includes(dayStr)) {
        await store.addServiceDate({
          month: monthStr,
          dateStr: dayStr,
          dayName: format(day, 'EEEE d', { locale: es }).replace(/^\w/, c => c.toUpperCase()),
          locked: false,
          acompaniantesIds: [],
          songs: [],
          songsStatus: 'DRAFT'
        });
        addedCount++;
      }
    }

    setRefresh(r => r + 1);
    setIsGenerating(false);
    if (addedCount > 0) alert(`Se generaron exitosamente ${addedCount} cultos para este mes.`);
  };

  const handleNotifyWhatsApp = () => {
    const monthName = format(currentMonth, 'MMMM yyyy', { locale: es });
    const appUrl = window.location.origin + '/dashboard';
    const message = `¡Hola equipo de Alabanza! 🎵\n\nYa están habilitadas las fechas para el mes de *${monthName.toUpperCase()}*.\n\nPor favor, ingresen a la plataforma y marquen su disponibilidad lo antes posible para que podamos organizar los cultos.\n\n👉 ${appUrl}`;
    
    const waLink = `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(waLink, '_blank');
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

  const handleManualAddDate = async () => {
    if (!manualDate) return;
    const parsed = parseISO(manualDate);
    const dayName = manualName || format(parsed, 'EEEE d', { locale: es }).replace(/^\w/, c => c.toUpperCase());

    await store.addServiceDate({
      month: format(parsed, 'yyyy-MM'),
      dateStr: manualDate,
      dayName: dayName,
      locked: false,
      acompaniantesIds: [],
      songs: [],
      songsStatus: 'DRAFT'
    });
    setRefresh(r => r + 1);
    setShowManualAdd(false);
    setManualName('');
    setManualDate('');
  };

  const handleDeleteDate = async (id: string) => {
    if (confirm("¿Estás seguro de que deseas eliminar este culto?")) {
      await store.deleteServiceDate(id);
      setRefresh(r => r + 1);
    }
  };

  if (!currentUser) return null;

  return (
    <div className="space-y-6">
      {/* Month Selector */}
      <div className="flex items-center justify-between bg-neutral-900 p-4 rounded-2xl border border-neutral-800">
        <button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} className="p-2 hover:bg-neutral-800 rounded-full transition-colors">
          <ChevronLeft className="w-6 h-6 text-neutral-400" />
        </button>
        <div className="flex flex-col items-center">
          <h2 className="text-xl font-bold text-white capitalize leading-tight">
            {format(currentMonth, 'MMMM yyyy', { locale: es })}
          </h2>
          <button 
            onClick={handleExportPDF} 
            disabled={isExporting}
            className="flex items-center space-x-1 text-[10px] text-pink-500 hover:text-pink-400 font-bold uppercase tracking-widest mt-1 transition-all disabled:opacity-50"
          >
            {isExporting ? <Loader2 className="w-3 h-3 animate-spin" /> : <FileText className="w-3 h-3" />}
            <span>Exportar PDF</span>
          </button>
        </div>
        <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} className="p-2 hover:bg-neutral-800 rounded-full transition-colors">
          <ChevronRight className="w-6 h-6 text-neutral-400" />
        </button>
      </div>

      {currentUser.role === 'DIRECTOR' && (
        <div className="flex flex-col md:flex-row md:items-center space-y-3 md:space-y-0 md:space-x-3 bg-indigo-500/10 border border-indigo-500/20 p-4 rounded-xl">
          <button
            onClick={handleGenerateMonthDates}
            disabled={isGenerating}
            className="flex-1 flex justify-center items-center py-2 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold text-sm transition-colors shadow-[0_0_15px_rgba(79,70,229,0.3)] disabled:opacity-50"
          >
            {isGenerating ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <CalendarDays className="w-5 h-5 mr-2" />}
            Auto-Generar
          </button>
          <button
            onClick={handleNotifyWhatsApp}
            className="flex-1 flex justify-center items-center py-2 px-4 bg-green-600 hover:bg-green-700 text-white rounded-lg font-bold text-sm transition-colors shadow-[0_0_15px_rgba(22,163,74,0.3)]"
          >
            <MessageCircle className="w-5 h-5 mr-2" />
            Avisar Equipo
          </button>
          <button
            onClick={() => setShowManualAdd(!showManualAdd)}
            className="flex-1 flex justify-center items-center py-2 px-4 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700 rounded-lg font-bold text-sm transition-colors"
          >
            <CalendarPlus className="w-5 h-5 mr-2" />
            Día Extra
          </button>
        </div>
      )}

      {showManualAdd && (
        <div className="bg-neutral-900 border border-neutral-700 p-5 rounded-2xl animate-fade-in grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="text-sm text-neutral-400 block mb-1">Fecha exacta</label>
            <input type="date" value={manualDate} onChange={e => setManualDate(e.target.value)} className="w-full bg-neutral-950 border border-neutral-700 text-white rounded-lg p-2" />
          </div>
          <div>
            <label className="text-sm text-neutral-400 block mb-1">Nombre (Opcional)</label>
            <input type="text" placeholder="Ej. Ayuno General" value={manualName} onChange={e => setManualName(e.target.value)} className="w-full bg-neutral-950 border border-neutral-700 text-white rounded-lg p-2" />
          </div>
          <div className="flex items-end">
            <button onClick={handleManualAddDate} disabled={!manualDate} className="w-full py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-lg font-bold text-sm disabled:opacity-50 transition-colors">
              Ingresar Fecha
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-center py-20"><Loader2 className="w-8 h-8 animate-spin text-pink-500 mx-auto" /></div>
      ) : serviceDates.length === 0 ? (
        <div className="text-center py-20 bg-neutral-900 rounded-2xl border border-neutral-800 border-dashed">
          <CalendarDays className="w-12 h-12 text-neutral-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-white mb-2">No hay cultos programados</h3>
          <p className="text-sm text-neutral-500 mb-6">El director general aún no ha programado días para {format(currentMonth, 'MMMM yyyy', { locale: es })}.</p>
        </div>
      ) : (
        <div className="space-y-4">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-neutral-500 ml-1">Cultos Agendados</h3>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {serviceDates.map(date => {
              const myAvail = availabilities.find(a => a.serviceDateId === date.id);
              const pendingAvail = pendingChanges[date.id];
              const isAvailable = pendingAvail !== undefined ? pendingAvail : myAvail?.available === true;
              const hasAnswered = pendingAvail !== undefined ? true : !!myAvail;

              const isDirectorDia = date.directorId === currentUser.id;
              const isAcompaniante = date.acompaniantesIds.includes(currentUser.id);
              const isStatusApproved = date.songsStatus === 'APPROVED';

              const availableInThisDate = allAvailabilities.filter(a => a.serviceDateId === date.id && a.available);
              const otherAvailableNames = availableInThisDate
                .filter(a => a.userId !== currentUser.id)
                .map(a => allUsers.find(u => u.id === a.userId && u.role !== 'MUSICO')?.name)
                .filter(Boolean);

              return (
                <div key={date.id} className="bg-neutral-900 border border-neutral-800 rounded-2xl flex flex-col items-start relative overflow-hidden group hover:border-neutral-700 transition-colors">

                  {date.locked && (
                    <div className="absolute top-0 right-0 bg-red-500 text-white text-[10px] uppercase font-bold px-3 py-1 rounded-bl-lg shadow-md z-10">
                      Cerrado
                    </div>
                  )}
                  {isStatusApproved && (
                    <div className="absolute top-0 right-0 bg-green-500 text-white text-[10px] uppercase font-bold px-3 py-1 rounded-bl-lg shadow-md z-10">
                      Aprobado
                    </div>
                  )}

                  <div className="w-full p-5 flex-1">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-neutral-400 text-sm">{format(parseISO(date.dateStr), 'dd/MMM/yyyy', { locale: es })}</p>
                        <h4 className="text-xl font-bold text-white mt-1">{date.dayName}</h4>
                      </div>
                      {currentUser.role === 'DIRECTOR' && !date.locked && (
                        <button onClick={() => handleDeleteDate(date.id)} className="text-neutral-600 hover:text-red-500 hover:bg-neutral-800 p-2 rounded-lg transition-colors opacity-0 group-hover:opacity-100 hidden md:block">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-2 mt-3 -mx-1">
                      {isDirectorDia && <span className="bg-yellow-500/20 text-yellow-500 text-xs font-semibold px-2 py-1 rounded">Director del Día</span>}
                      {isAcompaniante && <span className="bg-pink-500/20 text-pink-400 text-xs font-semibold px-2 py-1 rounded">Acompañante</span>}
                      {currentUser.role === 'MUSICO' && isAvailable && <span className="bg-blue-500/20 text-blue-400 text-xs font-semibold px-2 py-1 rounded">Músico Conv.</span>}
                      {(date.songsStatus === 'REVIEW' && currentUser.role === 'DIRECTOR') && (
                        <span className="bg-indigo-500/20 border border-indigo-500/50 text-indigo-400 animate-pulse text-xs font-semibold px-2 py-1 rounded">Revisar Canciones...</span>
                      )}
                    </div>

                    <div className="mt-3 text-[11px] text-neutral-400 bg-neutral-950/50 p-2 rounded-lg border border-neutral-800/50 leading-tight">
                      {otherAvailableNames.length > 0 ? (
                        <span><strong className="text-neutral-500">Compañeros Disponibles: </strong> {otherAvailableNames.join(', ')}</span>
                      ) : (
                        <span className="italic text-neutral-600">Nadie más ha marcado disponible aún</span>
                      )}
                    </div>
                  </div>

                  <div className="w-full mt-auto px-5 pb-5">
                    <div className="flex items-center justify-between border-t border-neutral-800 pt-4">
                      <button
                        disabled={date.locked}
                        onClick={() => toggleAvailability(date.id, isAvailable, date.locked)}
                        className={`flex items-center space-x-2 text-sm font-medium transition-colors ${date.locked ? 'opacity-50 cursor-not-allowed' : 'hover:scale-105 active:scale-95'} ${isAvailable ? 'text-green-500' : hasAnswered ? 'text-neutral-500' : 'text-neutral-400'}`}
                      >
                        {isAvailable ? <CheckCircle2 className="w-5 h-5" /> : <Circle className="w-5 h-5" />}
                        <span>{isAvailable ? 'Disponible' : hasAnswered ? 'No Disp.' : 'Marcar Disp.'}</span>
                      </button>

                      <div className="flex items-center space-x-2">
                        {date.songs?.length > 0 && (
                          <button
                            onClick={() => setPreviewDate(date)}
                            className="bg-neutral-800 hover:bg-neutral-700 text-pink-400 p-1.5 rounded-lg transition-colors border border-neutral-700"
                            title="Vista Previa de Canciones"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        )}
                        <Link href={`/dashboard/${date.id}`} className="bg-neutral-800 hover:bg-neutral-700 text-white text-xs px-3 py-1.5 rounded-lg font-medium transition-colors border border-neutral-700">
                          {currentUser.role === 'DIRECTOR' ? 'Administrar' : isDirectorDia ? 'Bosquejo' : 'Ver Detalles'}
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Sticky Save Bar for Batch Availabilities */}
      {Object.keys(pendingChanges).length > 0 && (
        <div className="fixed bottom-24 md:bottom-8 left-1/2 -translate-x-1/2 z-50 animate-bounce-in">
          <button
            onClick={saveAllAvailabilities}
            disabled={isSaving}
            className="bg-pink-600 hover:bg-pink-700 text-white px-6 py-3 rounded-full shadow-lg shadow-pink-500/30 font-bold flex items-center space-x-2 transition-all hover:scale-105 active:scale-95 disabled:opacity-50"
          >
            {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
            <span>Guardar {Object.keys(pendingChanges).length} Cambio{Object.keys(pendingChanges).length > 1 ? 's' : ''}</span>
          </button>
        </div>
      )}

      <SetlistPreview
        serviceDate={previewDate}
        allUsers={allUsers}
        onClose={() => setPreviewDate(null)}
      />
    </div>
  );
}
