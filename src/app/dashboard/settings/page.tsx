"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import * as store from '../../../lib/firebaseStore';
import { User, SystemSettings, SectionDef } from '../../../lib/types';
import { Download, AlertTriangle, ShieldCheck, Settings2, ListPlus, Edit2, Trash2, ShieldOff, Plus, Save, ArrowUp, ArrowDown } from 'lucide-react';
import { format, startOfMonth, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { exportMonthToPDF, exportMonthToExcel } from '../../../lib/exportUtils';

const DAYS_OF_WEEK = [
  { value: 0, label: 'Domingo' },
  { value: 1, label: 'Lunes' },
  { value: 2, label: 'Martes' },
  { value: 3, label: 'Miércoles' },
  { value: 4, label: 'Jueves' },
  { value: 5, label: 'Viernes' },
  { value: 6, label: 'Sábado' },
];

export default function SettingsPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [currentMonthStr, setCurrentMonthStr] = useState(format(startOfMonth(new Date()), 'yyyy-MM'));
  const [availableMonths, setAvailableMonths] = useState<string[]>([]);
  const [settings, setSettings] = useState<SystemSettings>({ defaultServiceDays: [] });

  useEffect(() => {
    const init = async () => {
      const userStr = localStorage.getItem('currentUser');
      if (userStr) {
        const parsedUser = JSON.parse(userStr);
        if (parsedUser.role !== 'DIRECTOR' && parsedUser.role !== 'VISOR') {
          router.push('/dashboard');
        } else {
          setCurrentUser(parsedUser);
          const s = await store.getSettings();
          setSettings(s);

          const allDates = await store.getAllServiceDates();
          const months = Array.from(new Set(allDates.map(d => d.month))).sort().reverse();
          setAvailableMonths(months.length > 0 ? months : [format(new Date(), 'yyyy-MM')]);
          if (months.length > 0) setCurrentMonthStr(months[0]);
        }
      } else {
        router.push('/');
      }
    };
    init();
  }, [router]);

  const handleExportMonth = async () => {
    await exportMonthToExcel(currentMonthStr);
  };

  const handleExportPDF = async () => {
    await exportMonthToPDF(currentMonthStr);
  };

  const handleToggleDay = async (dayIndex: number) => {
    const newDays = settings.defaultServiceDays.includes(dayIndex)
      ? settings.defaultServiceDays.filter(d => d !== dayIndex)
      : [...settings.defaultServiceDays, dayIndex];

    const newSettings = { ...settings, defaultServiceDays: newDays.sort() };
    await store.updateSettings(newSettings);
    setSettings(newSettings);
  };

  // --- SECTIONS ---
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null);
  const [sectionForm, setSectionForm] = useState({ id: '', name: '', active: true });

  const handleAddSection = () => {
    setEditingSectionId('new');
    setSectionForm({ id: `SEC_${Date.now()}`, name: '', active: true });
  };

  const handleEditSection = (sec: SectionDef) => {
    setEditingSectionId(sec.id);
    setSectionForm({ ...sec });
  };

  const handleSaveSection = async () => {
    if (!sectionForm.name.trim()) return;
    const currentSections = settings.sections || [];
    let newSections: SectionDef[];

    if (editingSectionId === 'new') {
      newSections = [...currentSections, { ...sectionForm, name: sectionForm.name.trim() }];
    } else {
      newSections = currentSections.map(s => s.id === editingSectionId ? { ...s, name: sectionForm.name.trim(), active: sectionForm.active } : s);
    }
    const newSettings = { ...settings, sections: newSections };
    await store.updateSettings(newSettings);
    setSettings(newSettings);
    setEditingSectionId(null);
  };

  const handleToggleSectionActive = async (sec: SectionDef) => {
    const currentSections = settings.sections || [];
    const newSections = currentSections.map(s => s.id === sec.id ? { ...s, active: !s.active } : s);
    const newSettings = { ...settings, sections: newSections };
    await store.updateSettings(newSettings);
    setSettings(newSettings);
  };

  const handleDeleteSection = async (sec: SectionDef) => {
    const inUse = await store.isSectionInUse(sec.id);
    if (inUse) {
      alert(`No se puede eliminar la sección "${sec.name}" porque ya tiene canciones asignadas en algún culto. En su lugar, puedes desactivarla.`);
      return;
    }
    if (confirm(`¿Estás seguro de que deseas eliminar la sección "${sec.name}"?`)) {
      const currentSections = settings.sections || [];
      const newSections = currentSections.filter(s => s.id !== sec.id);
      const newSettings = { ...settings, sections: newSections };
      await store.updateSettings(newSettings);
      setSettings(newSettings);
    }
  };

  const handleMoveSection = async (index: number, direction: 'up' | 'down') => {
    const currentSections = [...(settings.sections || [])];
    if (direction === 'up' && index > 0) {
      [currentSections[index - 1], currentSections[index]] = [currentSections[index], currentSections[index - 1]];
    } else if (direction === 'down' && index < currentSections.length - 1) {
      [currentSections[index + 1], currentSections[index]] = [currentSections[index], currentSections[index + 1]];
    } else {
      return;
    }
    const newSettings = { ...settings, sections: currentSections };
    await store.updateSettings(newSettings);
    setSettings(newSettings);
  };

  if (!currentUser) return null;

  return (
    <div className="space-y-6">
      <div className="border-b border-neutral-800 pb-4">
        <h2 className="text-2xl font-bold text-white">Ajustes Generales</h2>
        <p className="text-sm text-neutral-400 mt-1">Configura la cuenta y el comportamiento del sistema.</p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Settings Module */}
        <div className="bg-neutral-900 border border-neutral-800 p-6 rounded-2xl space-y-4">
          <div className="flex items-center space-x-3 mb-2">
            <div className="p-3 bg-indigo-500/10 text-indigo-500 rounded-lg">
              <Settings2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Cultos Predeterminados</h3>
              <p className="text-sm text-neutral-400">Días base para los nuevos meses.</p>
            </div>
          </div>

          <div className="pt-4 border-t border-neutral-800">
            <p className="text-sm text-neutral-300 mb-4">Selecciona los días de la semana en los que usualmente tienen servicios. Esto facilitará la creación automática de meses.</p>
            <div className="flex flex-wrap gap-3">
              {DAYS_OF_WEEK.map(day => {
                const isSelected = settings.defaultServiceDays.includes(day.value);
                return (
                  <button
                    key={day.value}
                    onClick={() => { if (currentUser.role === 'DIRECTOR') handleToggleDay(day.value); }}
                    className={`px-4 py-2 rounded-lg text-sm font-bold border transition-all ${isSelected ? 'bg-indigo-600 border-indigo-500 text-white shadow-[0_0_15px_rgba(79,70,229,0.3)]' : 'bg-neutral-950 border-neutral-700 text-neutral-400 hover:text-white shadow-none'} ${currentUser.role !== 'DIRECTOR' ? 'opacity-70 cursor-not-allowed' : ''}`}
                  >
                    {day.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Generador de Reportes */}
        <div className="bg-neutral-900 border border-neutral-800 p-6 rounded-2xl space-y-4">
          <div className="flex items-center space-x-3 mb-2">
            <div className="p-3 bg-pink-500/10 text-pink-500 rounded-lg">
              <Download className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Exportador de Reportes</h3>
              <p className="text-sm text-neutral-400">Descarga la planificación oficial mes a mes.</p>
            </div>
          </div>

          <div className="pt-4 border-t border-neutral-800">
            <label className="block text-sm font-medium text-neutral-300 mb-2">Selecciona el mes con datos</label>
            <select
              value={currentMonthStr}
              onChange={e => setCurrentMonthStr(e.target.value)}
              className="w-full bg-neutral-950 border border-neutral-700 text-white rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-pink-500 mb-6 capitalize"
            >
              {availableMonths.map(m => (
                <option key={m} value={m}>{format(parseISO(m + '-01'), 'MMMM yyyy', { locale: es })}</option>
              ))}
              {!availableMonths.includes(currentMonthStr) && (
                <option value={currentMonthStr}>{format(parseISO(currentMonthStr + '-01'), 'MMMM yyyy', { locale: es })}</option>
              )}
            </select>

            <div className="grid grid-cols-2 gap-3">
              <button onClick={handleExportPDF} className="flex flex-col items-center justify-center py-4 px-4 rounded-xl font-bold text-white bg-pink-600 hover:bg-pink-700 transition-colors shadow">
                <span className="mb-1 uppercase text-[10px] tracking-widest opacity-80">Recomendado</span>
                PDF (Cards)
              </button>
              <button onClick={handleExportMonth} className="flex flex-col items-center justify-center py-4 px-4 rounded-xl font-bold text-white bg-green-700 hover:bg-green-600 transition-colors">
                <span className="mb-1 uppercase text-[10px] tracking-widest opacity-80">Datos</span>
                EXCEL
              </button>
            </div>
          </div>
        </div>

        {/* Catálogo de Secciones Module */}
        <div className="bg-neutral-900 border border-neutral-800 p-6 rounded-2xl space-y-4 md:col-span-2">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center space-x-3">
              <div className="p-3 bg-pink-500/10 text-pink-500 rounded-lg">
                <ListPlus className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Catálogo de Secciones</h3>
                <p className="text-sm text-neutral-400">Administra las secciones estructurales del culto.</p>
              </div>
            </div>
            {currentUser.role === 'DIRECTOR' && (
              <button onClick={handleAddSection} className="bg-pink-600 hover:bg-pink-500 text-white px-3 py-2 rounded-lg font-bold text-sm transition-colors shadow flex items-center">
                <Plus className="w-4 h-4 mr-1" />
                <span className="hidden sm:inline">Añadir Sección</span>
              </button>
            )}
          </div>

          <div className="pt-4 border-t border-neutral-800 space-y-3">
            {editingSectionId === 'new' && (
              <div className="bg-neutral-950 border border-pink-500/50 p-4 rounded-xl flex flex-col sm:flex-row items-center gap-3">
                <input value={sectionForm.name} onChange={e => setSectionForm({...sectionForm, name: e.target.value})} type="text" className="flex-1 w-full bg-neutral-900 border border-neutral-700 rounded-md p-2 text-sm text-white focus:border-pink-500" placeholder="Nombre de la sección..." autoFocus />
                <div className="flex gap-2 w-full sm:w-auto">
                  <button onClick={() => setEditingSectionId(null)} className="flex-1 sm:flex-none px-3 py-2 text-neutral-400 hover:text-white bg-neutral-800 rounded-lg text-sm font-bold">Cancelar</button>
                  <button onClick={handleSaveSection} disabled={!sectionForm.name.trim()} className="flex-1 sm:flex-none px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-bold flex items-center justify-center disabled:opacity-50"><Save className="w-4 h-4 mr-1"/> Guardar</button>
                </div>
              </div>
            )}
            
            {(settings.sections || []).map((sec, index) => {
              if (editingSectionId === sec.id) {
                return (
                  <div key={sec.id} className="bg-neutral-950 border border-pink-500/50 p-4 rounded-xl flex flex-col sm:flex-row items-center gap-3">
                    <input value={sectionForm.name} onChange={e => setSectionForm({...sectionForm, name: e.target.value})} type="text" className="flex-1 w-full bg-neutral-900 border border-neutral-700 rounded-md p-2 text-sm text-white focus:border-pink-500" />
                    <div className="flex gap-2 w-full sm:w-auto">
                       <button onClick={() => setEditingSectionId(null)} className="flex-1 sm:flex-none px-3 py-2 text-neutral-400 hover:text-white bg-neutral-800 rounded-lg text-sm font-bold">Cancelar</button>
                       <button onClick={handleSaveSection} disabled={!sectionForm.name.trim()} className="flex-1 sm:flex-none px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-bold flex items-center justify-center disabled:opacity-50"><Save className="w-4 h-4 mr-1"/> Guardar</button>
                    </div>
                  </div>
                );
              }

              return (
                <div key={sec.id} className={`flex items-center justify-between p-3 rounded-xl border transition-all ${sec.active ? 'bg-neutral-950 border-neutral-800' : 'bg-red-500/5 border-red-500/20 opacity-70'}`}>
                  <div className="flex items-center gap-3 flex-1">
                    <div className="flex flex-col gap-1 mr-2">
                      <button disabled={index === 0 || currentUser.role !== 'DIRECTOR'} onClick={() => handleMoveSection(index, 'up')} className="text-neutral-500 hover:text-white disabled:opacity-30"><ArrowUp className="w-3 h-3"/></button>
                      <button disabled={index === (settings.sections?.length || 0) - 1 || currentUser.role !== 'DIRECTOR'} onClick={() => handleMoveSection(index, 'down')} className="text-neutral-500 hover:text-white disabled:opacity-30"><ArrowDown className="w-3 h-3"/></button>
                    </div>
                    <div>
                      <h4 className="text-white font-bold">{sec.name}</h4>
                      {!sec.active && <span className="text-[10px] text-red-400 uppercase font-bold tracking-widest">Desactivada</span>}
                    </div>
                  </div>
                  {currentUser.role === 'DIRECTOR' && (
                    <div className="flex items-center gap-2">
                      <button onClick={() => handleEditSection(sec)} className="p-2 text-neutral-400 hover:text-white hover:bg-neutral-800 rounded-lg"><Edit2 className="w-4 h-4"/></button>
                      <button onClick={() => handleToggleSectionActive(sec)} className={`p-2 rounded-lg ${sec.active ? 'text-neutral-400 hover:text-red-400 hover:bg-red-500/10' : 'text-green-500 hover:text-green-400 hover:bg-green-500/10'}`}>
                        {sec.active ? <ShieldOff className="w-4 h-4"/> : <ShieldCheck className="w-4 h-4"/>}
                      </button>
                      <button onClick={() => handleDeleteSection(sec)} className="p-2 text-neutral-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg"><Trash2 className="w-4 h-4"/></button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
