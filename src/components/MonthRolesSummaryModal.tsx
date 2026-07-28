"use client";

import { useState, useMemo } from 'react';
import { User, ServiceDate } from '../lib/types';
import { X, Clipboard, Check, MessageSquare, Share2, LayoutGrid, FileText } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

interface MonthRolesSummaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentMonth: Date;
  serviceDates: ServiceDate[];
  allUsers: User[];
}

export default function MonthRolesSummaryModal({
  isOpen,
  onClose,
  currentMonth,
  serviceDates,
  allUsers,
}: MonthRolesSummaryModalProps) {
  const [activeTab, setActiveTab] = useState<'visual' | 'text'>('visual');
  const [includeDayName, setIncludeDayName] = useState(true);
  const [hideUnassigned, setHideUnassigned] = useState(true);
  const [copied, setCopied] = useState(false);

  // Group assignments by user
  const assignmentsByMember = useMemo(() => {
    const members: {
      user: User;
      assignments: { date: ServiceDate; role: 'Presidir' | 'Coro' }[];
    }[] = [];

    // Filter out users who shouldn't be visible in roles
    const activeMembers = allUsers.filter(u => u.visibleInRoles !== false);

    activeMembers.forEach(user => {
      const userAssignments: { date: ServiceDate; role: 'Presidir' | 'Coro' }[] = [];
      
      serviceDates.forEach(date => {
        if (date.directorId === user.id) {
          userAssignments.push({ date, role: 'Presidir' });
        }
        if (date.acompaniantesIds && date.acompaniantesIds.includes(user.id)) {
          userAssignments.push({ date, role: 'Coro' });
        }
      });

      if (userAssignments.length > 0 || !hideUnassigned) {
        // Sort assignments by dateStr
        userAssignments.sort((a, b) => a.date.dateStr.localeCompare(b.date.dateStr));
        members.push({
          user,
          assignments: userAssignments
        });
      }
    });

    // Sort members by name
    members.sort((a, b) => a.user.name.localeCompare(b.user.name));
    return members;
  }, [serviceDates, allUsers, hideUnassigned]);

  // Format date helper: "Domingo 02/08/2026" or "02/08/2026"
  const formatAssignmentDate = (dateStr: string, withDayName: boolean) => {
    try {
      const parsedDate = parseISO(dateStr);
      if (withDayName) {
        const formatted = format(parsedDate, "EEEE dd/MM/yyyy", { locale: es });
        return formatted.replace(/^\w/, c => c.toUpperCase());
      } else {
        return format(parsedDate, "dd/MM/yyyy");
      }
    } catch (err) {
      return dateStr;
    }
  };

  // Generate preformatted WhatsApp message
  const whatsappMessage = useMemo(() => {
    const monthName = format(currentMonth, 'MMMM yyyy', { locale: es }).toUpperCase();
    let text = `📢 *RESUMEN DE ROLES - ${monthName}* 📅\n`;
    text += `━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

    if (assignmentsByMember.length === 0) {
      text += `No hay asignaciones programadas para este mes.\n`;
    } else {
      assignmentsByMember.forEach(item => {
        text += `👤 *${item.user.name}*\n`;
        if (item.assignments.length === 0) {
          text += `_Sin asignaciones asignadas_\n`;
        } else {
          item.assignments.forEach(assign => {
            const dateText = formatAssignmentDate(assign.date.dateStr, includeDayName);
            text += `• ${assign.role}: ${dateText}\n`;
          });
        }
        text += `\n`;
      });
    }

    text += `━━━━━━━━━━━━━━━━━━━━━━━\n`;
    text += `👉 _Worship Studio Asaf_`;
    return text;
  }, [assignmentsByMember, currentMonth, includeDayName]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(whatsappMessage);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy text:', err);
    }
  };

  const handleShareWhatsApp = () => {
    const waLink = `https://wa.me/?text=${encodeURIComponent(whatsappMessage)}`;
    window.open(waLink, '_blank');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
      <div
        className="w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden animate-scale-in relative flex flex-col max-h-[85vh]"
        style={{
          background: '#121212',
          border: '1px solid rgba(255,255,255,0.07)',
          boxShadow: '0 0 60px rgba(16,185,129,0.15), 0 25px 60px rgba(0,0,0,0.8)',
        }}
      >
        {/* Header */}
        <div
          className="p-5 border-b border-neutral-800/60 shrink-0 flex items-center justify-between"
          style={{ background: 'rgba(15,15,15,0.9)', backdropFilter: 'blur(12px)' }}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/20 flex items-center justify-center">
              <Share2 className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white leading-tight">Resumen de Asignaciones</h3>
              <p className="text-xs text-neutral-500 mt-0.5 capitalize">
                {format(currentMonth, 'MMMM yyyy', { locale: es })}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-neutral-800 rounded-full transition-colors"
          >
            <X className="w-5 h-5 text-neutral-500 hover:text-white" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-neutral-800/40 bg-neutral-950/40 p-1 m-3 rounded-xl border border-neutral-850 shrink-0">
          <button
            onClick={() => setActiveTab('visual')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'visual'
                ? 'bg-emerald-600 text-white shadow-[0_0_10px_rgba(16,185,129,0.3)]'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            <LayoutGrid className="w-4 h-4" />
            <span>Vista Visual</span>
          </button>
          <button
            onClick={() => setActiveTab('text')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'text'
                ? 'bg-emerald-600 text-white shadow-[0_0_10px_rgba(16,185,129,0.3)]'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Texto WhatsApp</span>
          </button>
        </div>

        {/* Body Content */}
        <div className="overflow-y-auto flex-1 px-5 pb-5 custom-scrollbar">
          {activeTab === 'visual' ? (
            <div className="space-y-4">
              {assignmentsByMember.length === 0 ? (
                <div className="py-12 text-center">
                  <p className="text-neutral-500 text-sm italic">No hay asignaciones este mes.</p>
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-1">
                  {assignmentsByMember.map(({ user, assignments }) => (
                    <div
                      key={user.id}
                      className="bg-neutral-900/40 border border-neutral-800/60 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-emerald-500/20 transition-all"
                    >
                      <div className="flex items-center gap-3">
                        {/* Avatar */}
                        <div
                          className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-white uppercase text-sm shadow-inner shrink-0"
                          style={{
                            background: `linear-gradient(135deg, ${
                              user.role === 'DIRECTOR' ? '#f59e0b, #d97706' : '#ec4899, #be185d'
                            })`,
                          }}
                        >
                          {user.name.slice(0, 2)}
                        </div>
                        <div>
                          <h4 className="font-bold text-white text-sm">{user.name}</h4>
                          <p className="text-[10px] text-neutral-500 uppercase tracking-wider font-semibold">
                            {user.role === 'DIRECTOR' ? 'Director' : 'Cantor / Músico'}
                          </p>
                        </div>
                      </div>

                      {/* User Assignments List */}
                      <div className="flex flex-wrap gap-2 sm:justify-end max-w-full sm:max-w-[60%]">
                        {assignments.length === 0 ? (
                          <span className="text-xs text-neutral-650 italic">Sin asignaciones</span>
                        ) : (
                          assignments.map((assign, idx) => (
                            <div
                              key={idx}
                              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium border bg-neutral-950/80 border-neutral-800"
                            >
                              <span
                                className={`w-1.5 h-1.5 rounded-full ${
                                  assign.role === 'Presidir' ? 'bg-amber-400' : 'bg-pink-400'
                                }`}
                              />
                              <span className="text-neutral-400 font-semibold">{assign.role}</span>
                              <span className="text-neutral-300">
                                {format(parseISO(assign.date.dateStr), 'dd/MM')}
                              </span>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {/* Controls */}
              <div className="flex flex-wrap gap-4 bg-neutral-950/50 border border-neutral-850 p-4 rounded-2xl">
                <label className="flex items-center space-x-3 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={includeDayName}
                    onChange={(e) => setIncludeDayName(e.target.checked)}
                    className="accent-emerald-500 w-4 h-4 cursor-pointer"
                  />
                  <span className="text-xs text-neutral-300 font-medium">Incluir nombre del día</span>
                </label>
                <label className="flex items-center space-x-3 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={hideUnassigned}
                    onChange={(e) => setHideUnassigned(e.target.checked)}
                    className="accent-emerald-500 w-4 h-4 cursor-pointer"
                  />
                  <span className="text-xs text-neutral-300 font-medium">Omitir sin asignación</span>
                </label>
              </div>

              {/* Text Area Output */}
              <div className="relative">
                <textarea
                  readOnly
                  value={whatsappMessage}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-2xl p-4 text-xs text-neutral-300 font-mono resize-none focus:outline-none min-h-[250px]"
                />
                <button
                  onClick={handleCopy}
                  className="absolute bottom-3 right-3 px-3 py-1.5 bg-neutral-800/80 hover:bg-neutral-800 text-[10px] text-white border border-neutral-700 rounded-lg flex items-center gap-1.5 transition-colors font-sans font-bold shadow"
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400 animate-fade-in" />
                      <span className="text-emerald-400">¡Copiado!</span>
                    </>
                  ) : (
                    <>
                      <Clipboard className="w-3.5 h-3.5 text-neutral-450" />
                      <span>Copiar</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          className="p-4 border-t border-neutral-800/60 shrink-0 flex items-center justify-between gap-3"
          style={{ background: 'rgba(10,10,10,0.9)', backdropFilter: 'blur(8px)' }}
        >
          <span className="text-[10px] text-neutral-600 font-medium">
            {assignmentsByMember.length} miembros listados
          </span>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-neutral-400 hover:text-white transition-colors rounded-xl"
            >
              Cerrar
            </button>
            <button
              onClick={handleShareWhatsApp}
              className="px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-650 hover:from-emerald-500 hover:to-teal-550 text-white text-sm font-bold rounded-xl transition-all flex items-center gap-2 shadow-[0_0_15px_rgba(16,185,129,0.25)] hover:scale-[1.02] active:scale-[0.98]"
            >
              <MessageSquare className="w-4 h-4" />
              <span>Enviar a WhatsApp</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
