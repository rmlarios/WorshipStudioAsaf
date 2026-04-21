"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import * as store from '../../../lib/firebaseStore';
import { User, SystemSettings } from '../../../lib/types';
import { Download, AlertTriangle, ShieldCheck, Settings2 } from 'lucide-react';
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
        if (parsedUser.role !== 'DIRECTOR') {
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
                    onClick={() => handleToggleDay(day.value)}
                    className={`px-4 py-2 rounded-lg text-sm font-bold border transition-all ${isSelected ? 'bg-indigo-600 border-indigo-500 text-white shadow-[0_0_15px_rgba(79,70,229,0.3)]' : 'bg-neutral-950 border-neutral-700 text-neutral-400 hover:text-white shadow-none'}`}
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
      </div>
    </div>
  );
}
