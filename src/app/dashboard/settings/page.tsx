"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import * as store from '../../../lib/firebaseStore';
import { User, SystemSettings } from '../../../lib/types';
import { Download, AlertTriangle, ShieldCheck, Settings2 } from 'lucide-react';
import { format, startOfMonth } from 'date-fns';
import { es } from 'date-fns/locale';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

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
    const dates = await store.getServiceDatesByMonth(currentMonthStr);
    dates.sort((a, b) => a.dateStr.localeCompare(b.dateStr));
    const allUsers = await store.getActiveUsers();

    const rows: any[] = [];
    rows.push(["Rol del mes de " + format(new Date(currentMonthStr + '-01'), 'MMMM yyyy', { locale: es })]);
    rows.push([]);

    dates.forEach(date => {
        rows.push([date.dayName]);
        rows.push(["Rol", "Nombre", "Canción", "Tono", "Youtube", "Versión"]);
        
        const dirName = allUsers.find(u => u.id === date.directorId)?.name || 'Sin Asignar';
        const acompNames = date.acompaniantesIds.map(id => allUsers.find(u => u.id === id)?.name).filter(Boolean);
        
        let cCount = Math.max(date.songs.length, 1 + acompNames.length);

        for (let i = 0; i < cCount; i++) {
            const roleLabel = i === 0 ? "Director" : (i <= acompNames.length ? "Acompañante" : "");
            const nameLabel = i === 0 ? dirName : (i <= acompNames.length ? acompNames[i-1] : "");
            const song = date.songs[i] || {title: '', tone: '', youtubeUrl: '', version: ''};
            
            rows.push([
                roleLabel, 
                nameLabel, 
                song.title, 
                song.tone, 
                song.youtubeUrl, 
                song.version
            ]);
        }
        rows.push([]);
    });

    const worksheet = XLSX.utils.aoa_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Rol");
    XLSX.writeFile(workbook, `Rol_${currentMonthStr}.xlsx`);
  };

  const handleExportPDF = async () => {
    const dates = await store.getServiceDatesByMonth(currentMonthStr);
    dates.sort((a, b) => a.dateStr.localeCompare(b.dateStr));
    if(dates.length === 0) return alert("No hay cultos agendados en este mes.");

    const allUsers = await store.getActiveUsers();
    
    // Config jsPDF
    const doc = new jsPDF('p', 'pt', 'a4');
    let yPos = 40;
    
    doc.setFontSize(22);
    doc.setTextColor(236, 72, 153); // pink-500
    doc.text("Planificación WorshipStudio", 40, yPos);
    
    yPos += 20;
    doc.setFontSize(14);
    doc.setTextColor(100, 100, 100);
    const monthName = format(new Date(currentMonthStr + '-01'), 'MMMM yyyy', { locale: es }).toUpperCase();
    doc.text(`MES: ${monthName}`, 40, yPos);
    
    yPos += 30;

    dates.forEach((date, i) => {
      // Revisa si necesitamos nueva pagina
      if (yPos > 700) {
        doc.addPage();
        yPos = 50;
      }

      // Card Header
      doc.setFillColor(30, 30, 30); // Dark BG for header
      doc.rect(40, yPos, 515, 30, 'F');
      
      doc.setFontSize(14);
      doc.setTextColor(255, 255, 255);
      doc.text(date.dayName, 50, yPos + 20);

      const dirName = allUsers.find(u => u.id === date.directorId)?.name || 'Nadie';
      doc.setFontSize(10);
      doc.setTextColor(250, 204, 21); // yellow 400
      doc.text(`Lead: ${dirName.toUpperCase()}`, 350, yPos + 20);

      yPos += 30;

      // Table mapping
      const songsData = date.songs.map((s, idx) => {
         const lead = allUsers.find(u => u.id === s.leadSingerId)?.name || 'Coro Unísono';
         return [
           (idx + 1).toString(),
           s.title,
           s.artist || '-',
           s.tone || '-',
           lead
         ];
      });

      if (songsData.length === 0) {
         doc.setTextColor(150, 150, 150);
         doc.setFontSize(10);
         doc.text("Sin canciones agendadas.", 50, yPos + 20);
         yPos += 45;
      } else {
         autoTable(doc, {
            startY: yPos,
            head: [['#', 'Canción', 'Artista', 'Tono', 'Voz Asignada']],
            body: songsData,
            margin: { left: 40, right: 40 },
            theme: 'grid',
            headStyles: { fillColor: [236, 72, 153], textColor: 255 },
            styles: { fontSize: 9, cellPadding: 4 },
            alternateRowStyles: { fillColor: [245, 245, 250] }
         });
         // @ts-ignore
         yPos = doc.lastAutoTable.finalY + 30;
      }
    });

    doc.save(`Bosquejos_${currentMonthStr}.pdf`);
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
                 <option key={m} value={m}>{format(new Date(m + '-01'), 'MMMM yyyy', {locale: es})}</option>
               ))}
               {!availableMonths.includes(currentMonthStr) && (
                 <option value={currentMonthStr}>{format(new Date(currentMonthStr + '-01'), 'MMMM yyyy', {locale: es})}</option>
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
