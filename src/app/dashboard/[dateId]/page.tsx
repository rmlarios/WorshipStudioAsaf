"use client";

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import * as store from '../../../lib/firebaseStore';
import { User, ServiceDate, Availability, Song, LibrarySong } from '../../../lib/types';
import { ArrowLeft, Lock, Unlock, Play, Save, Plus, Trash2, Send, CheckCircle, XCircle, Edit2, AlertTriangle, Loader2, Eye, Smartphone, X } from 'lucide-react';
import Link from 'next/link';

export default function DateDetails() {
  const router = useRouter();
  const params = useParams();
  const dateId = params.dateId as string;

  const [dateInfo, setDateInfo] = useState<ServiceDate | null>(null);
  const [monthDates, setMonthDates] = useState<ServiceDate[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [availabilities, setAvailabilities] = useState<Availability[]>([]);
  const [librarySongs, setLibrarySongs] = useState<LibrarySong[]>([]);
  const [refresh, setRefresh] = useState(0);
  const [loading, setLoading] = useState(true);

  // New Song form
  const [newSong, setNewSong] = useState<Partial<Song>>({ title: '', artist: '', tone: '', version: '', youtubeUrl: '', leadSingerId: '', section: 'GENERAL' });
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [duplicationWarning, setDuplicationWarning] = useState<string[]>([]);
  
  // Edit Song form
  const [editingSongId, setEditingSongId] = useState<string | null>(null);
  const [editSongData, setEditSongData] = useState<Partial<Song>>({});
  
  // Drag and Drop
  const [draggedSongId, setDraggedSongId] = useState<string | null>(null);

  useEffect(() => {
    const userStr = localStorage.getItem('currentUser');
    if (userStr) {
      setCurrentUser(JSON.parse(userStr));
    }
    
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('preview') === 'true') {
         // Pequeno timeout para que la animación se vea bien cuando carga la data
         setTimeout(() => setShowPreviewModal(true), 300);
      }
    }
  }, []);

  const loadData = useCallback(async () => {
    if (!currentUser) return;
    setLoading(true);
    try {
      const users = await store.getActiveUsers();
      setAllUsers(users);
      
      const dates = await store.getAllServiceDates();
      const current = dates.find(d => d.id === dateId);
      if (current) {
        if (!current.songsStatus) current.songsStatus = 'DRAFT';
        setDateInfo(current);
        setMonthDates(dates.filter(d => d.month === current.month));
        const avails = await store.getAvailabilities(dateId);
        setAvailabilities(avails);
        const libs = await store.getLibrary();
        setLibrarySongs(libs);
      } else {
        router.push('/dashboard');
      }
    } catch (err) {
      console.error('Error loading date details:', err);
    }
    setLoading(false);
  }, [currentUser, dateId, router]);

  useEffect(() => {
    loadData();
  }, [loadData, refresh]);

  if (!currentUser || !dateInfo) return <div className="flex items-center justify-center p-20"><Loader2 className="w-8 h-8 animate-spin text-pink-500" /></div>;

  const isDirectorGeneral = currentUser.role === 'DIRECTOR';
  const isDirectorDia = dateInfo.directorId === currentUser.id;
  
  // Can edit only if not locked, and depending on status
  // Directores Generales always can edit if not locked
  // Director del dia can edit ONLY if status is DRAFT (or not set)
  const isStatusReviewOrApproved = dateInfo.songsStatus === 'REVIEW' || dateInfo.songsStatus === 'APPROVED';
  const canEditSongs = !dateInfo.locked && (isDirectorGeneral || (isDirectorDia && !isStatusReviewOrApproved));

  const handleToggleLock = async () => {
    if (!isDirectorGeneral) return;
    const updated = { ...dateInfo, locked: !dateInfo.locked };
    await store.updateServiceDate(updated);
    setDateInfo(updated);
  };

  const handleChangeStatus = async (newStatus: 'DRAFT' | 'REVIEW' | 'APPROVED') => {
    const updated = { ...dateInfo, songsStatus: newStatus };
    await store.updateServiceDate(updated);
    setDateInfo(updated);
  };

  const handleAssignDirector = async (userId: string) => {
    if (!isDirectorGeneral || dateInfo.locked) return;
    const updated = { ...dateInfo, directorId: userId };
    await store.updateServiceDate(updated);
    setDateInfo(updated);
  };

  const handleToggleAcompaniante = async (userId: string) => {
    if (!isDirectorGeneral || dateInfo.locked) return;
    let newAcomps = [...dateInfo.acompaniantesIds];
    if (newAcomps.includes(userId)) {
      newAcomps = newAcomps.filter(id => id !== userId);
    } else {
      newAcomps.push(userId);
    }
    const updated = { ...dateInfo, acompaniantesIds: newAcomps };
    await store.updateServiceDate(updated);
    setDateInfo(updated);
  };

  const handleAddSong = async () => {
    if (!newSong.title) return;
    const song: Song = {
      id: Math.random().toString(),
      title: newSong.title || '',
      artist: newSong.artist || '',
      tone: newSong.tone || 'Desconocido',
      version: newSong.version || '',
      youtubeUrl: newSong.youtubeUrl || '',
      leadSingerId: newSong.leadSingerId || '',
      section: newSong.section as any || 'GENERAL'
    };
    
    const updated = { ...dateInfo, songs: [...dateInfo.songs, song] };
    await store.updateServiceDate(updated);
    setDateInfo(updated);
    
    await store.addOrUpdateLibrarySong(song);
    
    setNewSong({ title: '', artist: '', tone: '', version: '', youtubeUrl: '', leadSingerId: '', section: 'GENERAL' });
    setDuplicationWarning([]);
    setShowSuggestions(false);
  };

  const handleTitleChange = async (val: string) => {
    setNewSong({...newSong, title: val});
    setShowSuggestions(val.length > 1);
    
    if (val.length > 2) {
      const uses = await store.checkSongInMonth(dateInfo.month, val);
      const otherUses = uses.filter(u => u !== dateInfo.dayName);
      setDuplicationWarning(otherUses);
    } else {
      setDuplicationWarning([]);
    }
  };

  const selectSuggestion = async (libSong: LibrarySong) => {
     setNewSong({
       ...newSong,
       title: libSong.title,
       artist: libSong.artist !== 'Desconocido' ? libSong.artist : '',
       youtubeUrl: libSong.youtubeUrl,
       tone: libSong.originalTone !== 'Desconocido' ? libSong.originalTone : ''
     });
     setShowSuggestions(false);
     
     const uses = await store.checkSongInMonth(dateInfo.month, libSong.title);
     const otherUses = uses.filter(u => u !== dateInfo.dayName);
     setDuplicationWarning(otherUses);
  };

  const handleStartEdit = (song: Song) => {
    setEditingSongId(song.id);
    setEditSongData(song); // Copy current data into staging
  };

  const handleSaveEdit = async () => {
    if (!editingSongId || !editSongData.title) return;
    
    const newSongs = dateInfo.songs.map(s => {
      if (s.id === editingSongId) return editSongData as Song;
      return s;
    });

    const updated = { ...dateInfo, songs: newSongs };
    await store.updateServiceDate(updated);
    setDateInfo(updated);
    
    await store.addOrUpdateLibrarySong(editSongData as Song);
    
    setEditingSongId(null);
    setEditSongData({});
  };

  const handleDragStart = (e: React.DragEvent, id: string) => {
    if (!canEditSongs) return;
    setDraggedSongId(id);
    e.dataTransfer.effectAllowed = 'move';
    // Trick to make the ghost look better or hide default. We keep default.
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = async (e: React.DragEvent, dropTargetId: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (!draggedSongId || draggedSongId === dropTargetId || !canEditSongs) {
      setDraggedSongId(null);
      return;
    }
    
    const newSongs = [...dateInfo.songs];
    const dragIndex = newSongs.findIndex(s => s.id === draggedSongId);
    const dropIndex = newSongs.findIndex(s => s.id === dropTargetId);
    
    // Update section to match target
    newSongs[dragIndex].section = newSongs[dropIndex].section || 'GENERAL';
    
    // Swap or Move (Move is usually better for reordering)
    const [movedElement] = newSongs.splice(dragIndex, 1);
    newSongs.splice(dropIndex, 0, movedElement);
    
    const updated = { ...dateInfo, songs: newSongs };
    await store.updateServiceDate(updated);
    setDateInfo(updated);
    setDraggedSongId(null);
  };

  const handleDropOnSection = async (e: React.DragEvent, sectionId: any) => {
    e.preventDefault();
    if (!draggedSongId || !canEditSongs) {
      setDraggedSongId(null);
      return;
    }
    const newSongs = [...dateInfo.songs];
    const dragIndex = newSongs.findIndex(s => s.id === draggedSongId);
    
    if (newSongs[dragIndex].section === sectionId) {
       // Dragged to same section but not on a specific element, do nothing or move to end
       setDraggedSongId(null);
       return;
    }
    
    const [movedElement] = newSongs.splice(dragIndex, 1);
    movedElement.section = sectionId;
    newSongs.push(movedElement);
    
    const updated = { ...dateInfo, songs: newSongs };
    await store.updateServiceDate(updated);
    setDateInfo(updated);
    setDraggedSongId(null);
  };

  const handleDeleteSong = async (songId: string) => {
    const updated = { ...dateInfo, songs: dateInfo.songs.filter(s => s.id !== songId) };
    await store.updateServiceDate(updated);
    setDateInfo(updated);
  };

  // Get available cantores
  const availableUsers = allUsers.filter(u => {
    const av = availabilities.find(a => a.userId === u.id);
    return av?.available === true;
  });
  const cantoresDisponibles = availableUsers.filter(u => u.role === 'CANTOR');

  // Cantores that are either the director of the day OR one of the acompanantes
  const singingTeam = !dateInfo ? [] : allUsers.filter(u => 
    u.id === dateInfo.directorId || 
    dateInfo.acompaniantesIds.includes(u.id)
  );

  const checkOtherMonthUses = (songTitle: string) => {
    const searchLow = songTitle.trim().toLowerCase();
    const uses: string[] = [];
    monthDates.forEach(sd => {
      if (sd.id !== dateId) {
        if (sd.songs.some(s => s.title.trim().toLowerCase() === searchLow)) {
          uses.push(sd.dayName);
        }
      }
    });
    return uses;
  };

  return (
    <div className="space-y-6 pb-20">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-neutral-800 pb-4 gap-4">
        <div className="flex items-center space-x-4">
          <Link href="/dashboard" className="p-2 hover:bg-neutral-800 rounded-full transition-colors shrink-0">
            <ArrowLeft className="w-5 h-5 text-neutral-400" />
          </Link>
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h2 className="text-2xl font-bold text-white leading-none flex items-center flex-wrap gap-2">
                 {dateInfo.dayName}
                 {dateInfo.songsStatus === 'REVIEW' && <span className="text-xs bg-orange-500/20 text-orange-400 px-2 py-0.5 rounded font-medium border border-orange-500/20">En Revisión</span>}
                 {dateInfo.songsStatus === 'APPROVED' && <span className="text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded font-medium border border-green-500/20">Bosquejo Aprobado</span>}
              </h2>
              <button 
                 onClick={() => setShowPreviewModal(true)}
                 className="bg-neutral-800 hover:bg-neutral-700 text-white p-1.5 rounded-lg transition-colors tooltip tooltip-right shadow-sm border border-neutral-700" 
                 title="Vista Previa Compacta (WhatsApp)"
              >
                  <Eye className="w-4 h-4 text-pink-400" />
              </button>
            </div>
            <p className="text-sm text-neutral-400">{dateInfo.dateStr}</p>
          </div>
        </div>
        
        {isDirectorGeneral && (
          <button 
            onClick={handleToggleLock}
            className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-bold transition-colors w-fit ${dateInfo.locked ? 'bg-red-500/20 text-red-500 border border-red-500/50 hover:bg-red-500/30' : 'bg-neutral-800 text-neutral-300 border border-neutral-700 hover:bg-neutral-700'}`}
          >
            {dateInfo.locked ? <><Lock className="w-4 h-4"/> <span>Restringir Toda Edición</span></> : <><Unlock className="w-4 h-4"/> <span>Permitir Edición</span></>}
          </button>
        )}
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        
        {/* Asignaciones Column */}
        <div className="md:col-span-1 space-y-4">
          <div className="bg-neutral-900 border border-neutral-800 p-5 rounded-2xl relative overflow-hidden">
            {/* Decors */}
            <div className="absolute top-0 right-0 w-20 h-20 bg-pink-500/5 rounded-full -mr-10 -mt-10 blur-xl"></div>
            
            <h3 className="text-lg font-bold text-white mb-4 relative z-10">Voces Designadas</h3>
            
            <div className="space-y-4 relative z-10">
              <div>
                <p className="text-xs text-neutral-500 uppercase tracking-wider font-semibold mb-2">Director de Día (Líder)</p>
                {isDirectorGeneral && !dateInfo.locked ? (
                  <select 
                    value={dateInfo.directorId || ''} 
                    onChange={(e) => handleAssignDirector(e.target.value)}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-lg p-2 text-yellow-500 font-medium focus:outline-none focus:ring-1 focus:ring-yellow-500"
                  >
                    <option value="">-- Seleccionar Disponible --</option>
                    {cantoresDisponibles.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                ) : (
                  <div className="bg-yellow-500/10 border border-yellow-500/20 text-yellow-500 p-3 rounded-lg font-bold shadow-inner">
                    {dateInfo.directorId ? allUsers.find(u => u.id === dateInfo.directorId)?.name : 'Sin asignar'}
                  </div>
                )}
              </div>

              <div>
                <p className="text-xs text-neutral-500 uppercase tracking-wider font-semibold mb-2">Acompañantes (Coros)</p>
                {isDirectorGeneral && !dateInfo.locked ? (
                  <div className="space-y-2 bg-neutral-950 border border-neutral-800 p-2 rounded-xl max-h-60 overflow-y-auto">
                    {cantoresDisponibles.filter(c => c.id !== dateInfo.directorId).length === 0 && (
                      <p className="text-xs text-neutral-600 p-2 text-center">Nadie más disponible aún</p>
                    )}
                    {cantoresDisponibles.filter(c => c.id !== dateInfo.directorId).map(c => (
                      <label key={c.id} className="flex items-center space-x-3 hover:bg-neutral-900 p-2 rounded-lg cursor-pointer transition-colors">
                        <input 
                          type="checkbox" 
                          checked={dateInfo.acompaniantesIds.includes(c.id)}
                          onChange={() => handleToggleAcompaniante(c.id)}
                          className="accent-pink-500 w-4 h-4 cursor-pointer"
                        />
                        <span className="text-neutral-300 font-medium">{c.name}</span>
                      </label>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {dateInfo.acompaniantesIds.length > 0 ? dateInfo.acompaniantesIds.map(id => (
                      <div key={id} className="bg-pink-500/10 border border-pink-500/20 text-pink-400 px-3 py-1.5 rounded-lg font-medium text-sm">
                        {allUsers.find(u => u.id === id)?.name || id}
                      </div>
                    )) : <p className="text-neutral-500 text-sm italic border border-dashed border-neutral-800 p-3 rounded-lg w-full">No se han definido acompañantes</p>}
                  </div>
                )}
              </div>
              
            </div>
          </div>
        </div>

        {/* Canciones Column */}
        <div className="md:col-span-2 space-y-4">
          <div className="bg-neutral-900 border border-neutral-800 p-5 rounded-2xl min-h-[400px] flex flex-col">
             
             {/* Admin Approval Header Banner */}
             {isDirectorGeneral && dateInfo.songsStatus === 'REVIEW' && (
                <div className="mb-6 bg-indigo-500/10 border border-indigo-500/30 rounded-xl p-4 flex flex-col sm:flex-row justify-between items-center gap-4">
                   <div>
                     <h4 className="text-indigo-400 font-bold mb-1 flex items-center"><CheckCircle className="w-5 h-5 mr-2"/> Revisión Pendiente</h4>
                     <p className="text-sm text-indigo-300/70">El director del día te solicita aprobar este setlist musical.</p>
                   </div>
                   <div className="flex space-x-2 w-full sm:w-auto">
                     <button onClick={() => handleChangeStatus('APPROVED')} className="flex-1 sm:flex-none bg-green-600 hover:bg-green-500 text-white px-4 py-2 rounded-lg font-bold text-sm transition-colors shadow">Aprobar</button>
                     <button onClick={() => handleChangeStatus('DRAFT')} className="flex-1 sm:flex-none bg-neutral-800 hover:bg-neutral-700 text-white px-4 py-2 rounded-lg font-bold text-sm transition-colors border border-neutral-700">Devolver</button>
                   </div>
                </div>
             )}

             <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-bold text-white">Bosquejo Musical</h3>
                
                {/* Submit for Review Button (Only for Director del Dia) */}
                {isDirectorDia && dateInfo.songsStatus === 'DRAFT' && dateInfo.songs.length > 0 && !isDirectorGeneral && (
                   <button onClick={() => handleChangeStatus('REVIEW')} className="bg-pink-600 hover:bg-pink-500 text-white px-4 py-2 rounded-lg font-bold flex items-center text-sm transition-colors shadow-[0_0_15px_rgba(236,72,153,0.3)]">
                     <Send className="w-4 h-4 mr-2" />
                     Enviar a Revisión
                   </button>
                )}
             </div>

             {/* General Playlist Link */}
             <div className="mb-6 bg-neutral-950 p-4 rounded-xl border border-neutral-800 flex flex-col sm:flex-row items-center gap-3">
                <div className="flex-1 w-full">
                  <label className="block text-xs text-neutral-500 mb-1 font-medium">Enlace de Playlist (YouTube, Spotify, etc.)</label>
                  {canEditSongs ? (
                     <div className="flex gap-2 w-full">
                       <input 
                         value={dateInfo.playlistUrl || ''} 
                         onChange={(e) => setDateInfo({...dateInfo, playlistUrl: e.target.value})}
                         onKeyDown={(e) => { if(e.key === 'Enter') store.updateServiceDate(dateInfo) }}
                         onBlur={() => store.updateServiceDate(dateInfo)}
                         type="url" 
                         className="w-full bg-neutral-900 border border-neutral-700 rounded-md p-2 text-sm text-white focus:outline-none focus:border-pink-500" 
                         placeholder="https://youtube.com/playlist?list=..." 
                       />
                       <button onClick={() => store.updateServiceDate(dateInfo)} className="bg-neutral-800 hover:bg-neutral-700 text-white px-3 rounded-md text-xs font-bold transition-colors border border-neutral-700"><Save className="w-4 h-4" /></button>
                     </div>
                  ) : (
                     <div className="bg-neutral-900 border border-neutral-800 rounded-md p-2 text-sm text-neutral-400 italic">
                        {dateInfo.playlistUrl || 'No se ha configurado un enlace general'}
                     </div>
                  )}
                </div>
                {dateInfo.playlistUrl && (
                  <a href={dateInfo.playlistUrl} target="_blank" rel="noreferrer" className="w-full sm:w-auto bg-red-600/10 hover:bg-red-600/20 text-red-500 border border-red-500/20 px-4 py-2 rounded-lg font-bold flex items-center justify-center text-sm transition-colors shrink-0">
                    <Play className="w-4 h-4 mr-2" />
                    Abrir Playlist
                  </a>
                )}
             </div>
             
             {dateInfo.songs.length === 0 ? (
               <div className="text-center py-16 border-2 border-neutral-800 border-dashed rounded-xl m-2">
                 <Play className="w-10 h-10 text-neutral-700 mx-auto mb-3" />
                 <p className="text-neutral-400 font-medium tracking-wide">Aún no se añaden canciones a este servicio.</p>
               </div>
             ) : (
               <div className="space-y-6 flex-1">
                 {[
                   {id: 'ALABANZAS', label: 'Alabanzas'},
                   {id: 'ADORACIÓN', label: 'Adoración'},
                   {id: 'OFRENDA', label: 'Ofrenda'},
                   {id: 'DESPEDIDA', label: 'Despedida'},
                   {id: 'GENERAL', label: 'General (Sin clasificar)'}
                 ].map(section => {
                   const sectionSongs = dateInfo.songs.filter(s => (s.section || 'GENERAL') === section.id);
                   if (sectionSongs.length === 0 && section.id === 'GENERAL') return null;

                   return (
                     <div 
                       key={section.id} 
                       onDragOver={handleDragOver}
                       onDrop={(e) => handleDropOnSection(e, section.id)}
                       className="bg-neutral-900/50 p-4 rounded-2xl border border-neutral-800 border-dashed"
                     >
                       <h4 className="text-sm font-bold text-neutral-400 mb-3 uppercase tracking-widest">{section.label}</h4>
                       
                       {sectionSongs.length === 0 ? (
                         <div className="py-4 text-center text-xs text-neutral-600 bg-neutral-950/50 rounded-lg">Arrastra canciones aquí</div>
                       ) : (
                         <div className="space-y-3">
                           {sectionSongs.map((song) => {
                             const globalIndex = dateInfo.songs.findIndex(s => s.id === song.id);
                             const leadSingerName = allUsers.find(u => u.id === song.leadSingerId)?.name;
                             const isEditing = editingSongId === song.id;
                             const isDragging = draggedSongId === song.id;
                             
                             if (isEditing) {
                               return (
                                 <div key={song.id} className="bg-neutral-900 border border-pink-500/50 rounded-xl p-4 animate-fade-in shadow-[0_0_15px_rgba(236,72,153,0.1)]">
                                   <h4 className="text-sm font-semibold text-pink-400 mb-3 flex items-center"><Edit2 className="w-4 h-4 mr-2"/> Editando Canción</h4>
                                   <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                     <div className="col-span-2">
                                       <label className="text-[10px] uppercase text-neutral-500 font-bold mb-1 block">Título</label>
                                       <input value={editSongData.title} onChange={e => setEditSongData({...editSongData, title: e.target.value})} type="text" className="w-full bg-neutral-950 border border-neutral-700 rounded-md p-2 text-sm text-white focus:border-pink-500" placeholder="Título *" />
                                     </div>
                                     <div className="col-span-2 md:col-span-1">
                                       <label className="text-[10px] uppercase text-pink-500 font-bold mb-1 block">Sección</label>
                                       <select value={editSongData.section || 'GENERAL'} onChange={e => setEditSongData({...editSongData, section: e.target.value as any})} className="w-full bg-neutral-950 border border-pink-500/30 rounded-md p-2 text-sm text-pink-100 focus:border-pink-500">
                                         <option value="GENERAL">General</option>
                                         <option value="ALABANZAS">Alabanzas</option>
                                         <option value="ADORACIÓN">Adoración</option>
                                         <option value="OFRENDA">Ofrenda</option>
                                         <option value="DESPEDIDA">Despedida</option>
                                       </select>
                                     </div>
                                     <div className="col-span-2 md:col-span-1">
                                       <label className="text-[10px] uppercase text-neutral-500 font-bold mb-1 block">Líder / Solo</label>
                                       <select value={editSongData.leadSingerId || ''} onChange={e => setEditSongData({...editSongData, leadSingerId: e.target.value})} className="w-full bg-neutral-950 border border-neutral-700 rounded-md p-2 text-sm text-pink-200">
                                         <option value="">-- Coro Unísono --</option>
                                         {singingTeam.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                                       </select>
                                     </div>
                                     <div className="col-span-1 md:col-span-1">
                                       <label className="text-[10px] uppercase text-neutral-500 font-bold mb-1 block">Tono</label>
                                       <input value={editSongData.tone} onChange={e => setEditSongData({...editSongData, tone: e.target.value})} type="text" className="w-full bg-neutral-950 border border-neutral-700 rounded-md p-2 text-sm text-white font-mono" placeholder="Tono" />
                                     </div>
                                     <div className="col-span-1 md:col-span-1">
                                       <label className="text-[10px] uppercase text-neutral-500 font-bold mb-1 block">Artista</label>
                                       <input value={editSongData.artist} onChange={e => setEditSongData({...editSongData, artist: e.target.value})} type="text" className="w-full bg-neutral-950 border border-neutral-700 rounded-md p-2 text-sm text-white" placeholder="Artista" />
                                     </div>
                                     <div className="col-span-1 md:col-span-1 border-t border-neutral-800 md:border-0 pt-2 md:pt-0 col-start-2 md:col-start-4">
                                       <button onClick={() => setEditingSongId(null)} className="w-full mr-2 py-2 text-neutral-400 hover:text-white hover:bg-neutral-800 rounded-lg text-sm font-bold transition-colors">Cancelar</button>
                                     </div>
                                     <div className="col-span-1 md:col-span-4 flex">
                                       <button onClick={handleSaveEdit} className="w-full py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-bold transition-colors flex items-center justify-center"><Save className="w-4 h-4 mr-2"/> Guardar Cambios</button>
                                     </div>
                                   </div>
                                 </div>
                               );
                             }

                             return (
                             <div 
                               key={song.id} 
                               draggable={canEditSongs && !editingSongId}
                               onDragStart={(e) => handleDragStart(e, song.id)}
                               onDragOver={handleDragOver}
                               onDrop={(e) => { e.stopPropagation(); handleDrop(e, song.id); }}
                               className={`flex flex-col sm:flex-row sm:items-stretch justify-between bg-neutral-950 border rounded-xl overflow-hidden group transition-all duration-200 ${canEditSongs && !editingSongId ? 'cursor-grab active:cursor-grabbing hover:border-pink-500/50' : ''} ${isDragging ? 'opacity-50 ring-2 ring-pink-500 border-pink-500 scale-[0.98]' : 'border-neutral-800'}`}
                             >
                                <div className="flex flex-1">
                                  {/* Number */}
                                  <div className="bg-neutral-900 border-r border-neutral-800 w-12 flex items-center justify-center font-black text-neutral-600 text-lg shrink-0">
                                    {globalIndex + 1}
                                  </div>
                                  
                                  {/* Song Info */}
                                  <div className="p-4 flex-1">
                                    <h4 className="text-white font-bold text-xl leading-tight mb-1 flex flex-wrap items-center gap-2">
                                      {song.title}
                                      {(() => {
                                        const otherUses = checkOtherMonthUses(song.title);
                                        if (otherUses.length > 0) {
                                          return (
                                            <span className="text-[10px] font-medium bg-yellow-500/10 text-yellow-500 border border-yellow-500/20 px-2 py-0.5 rounded flex items-center shadow-sm mt-1 sm:mt-0" title="Canción repetida en el mes">
                                              <AlertTriangle className="w-3 h-3 mr-1 shrink-0" />
                                              {otherUses.length > 1 ? 'Usada en: ' : 'En '} {otherUses.join(', ')}
                                            </span>
                                          )
                                        }
                                        return null;
                                      })()}
                                    </h4>
                                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-2">
                                       {/* Solista Badge */}
                                       <div className="bg-pink-900/40 border border-pink-500/30 text-pink-300 text-xs font-bold px-2.5 py-1 rounded-md flex items-center shadow-inner">
                                          <span className="opacity-70 mr-1.5 uppercase text-[9px] tracking-wider">Voz Lead:</span> {leadSingerName || 'Todos (Coro)'}
                                       </div>
                                       
                                       <span className="text-xs bg-neutral-800 text-neutral-300 px-2 py-1 rounded font-mono font-semibold">Tono: <span className="text-white text-sm ml-1">{song.tone}</span></span>
                                       
                                       <span className="text-sm text-neutral-500 flex items-center"><span className="w-1.5 h-1.5 rounded-full bg-neutral-700 mr-2"></span>{song.artist}</span>
                                       {song.version && <span className="text-sm text-neutral-500 flex items-center"><span className="w-1.5 h-1.5 rounded-full bg-neutral-700 mr-2"></span>{song.version}</span>}
                                    </div>
                                  </div>
                                </div>
                                
                                {/* Actions */}
                                <div className="flex items-center sm:border-l border-t sm:border-t-0 p-3 sm:p-4 border-neutral-800 justify-end bg-neutral-950/50 sm:bg-transparent">
                                  {song.youtubeUrl && (
                                    <a href={song.youtubeUrl} target="_blank" rel="noreferrer" className="w-10 h-10 flex items-center justify-center bg-red-500/10 text-red-500 rounded-lg hover:bg-red-500/20 transition-colors shrink-0">
                                       <Play className="w-5 h-5 ml-0.5" /> 
                                    </a>
                                  )}
                                  {canEditSongs && (
                                    <>
                                      <button onClick={() => handleStartEdit(song)} className="w-10 h-10 ml-2 flex items-center justify-center text-neutral-500 hover:text-white hover:bg-neutral-800 rounded-lg transition-colors shrink-0 tooltip">
                                        <Edit2 className="w-4 h-4" />
                                      </button>
                                      <button onClick={() => handleDeleteSong(song.id)} className="w-10 h-10 ml-2 flex items-center justify-center text-neutral-500 hover:text-red-400 hover:bg-neutral-800 rounded-lg transition-colors shrink-0">
                                        <Trash2 className="w-5 h-5" />
                                      </button>
                                    </>
                                  )}
                                </div>
                             </div>
                           )})}
                         </div>
                       )}
                     </div>
                   );
                 })}
               </div>
             )}

             {/* Form to add new song */}
             {canEditSongs && (
               <div className="mt-8 pt-6 border-t border-neutral-800">
                  <h4 className="text-sm font-semibold text-pink-400 mb-4 flex items-center"><Plus className="w-4 h-4 mr-1"/> Añadir Canción</h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-neutral-950 p-4 rounded-xl border border-neutral-800 shadow-inner">
                    <div className="col-span-2 relative">
                       <label className="block text-xs text-neutral-500 mb-1 font-medium">Nombre de la Canción *</label>
                       <input 
                          value={newSong.title} 
                          onChange={e => handleTitleChange(e.target.value)} 
                          onFocus={() => setShowSuggestions(newSong?.title ? newSong.title.length > 1 : false)}
                          onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                          type="text" 
                          className="w-full bg-neutral-900 border border-neutral-700 rounded-md p-2 text-sm text-white focus:outline-none focus:border-pink-500 focus:bg-neutral-950 transition-colors relative z-10" 
                          placeholder="Ej. Digno" 
                       />
                       
                       {/* Sugerencias Menu */}
                       {showSuggestions && (
                          <div className="absolute top-full mt-1 w-full max-h-48 overflow-y-auto bg-neutral-800 border border-neutral-700 rounded-lg shadow-xl z-20 flex flex-col">
                             {librarySongs.filter(s => s.title.toLowerCase().includes(newSong.title?.toLowerCase() || '')).map(sugg => (
                                <button
                                  key={sugg.id}
                                  onClick={(e) => { e.preventDefault(); selectSuggestion(sugg); }}
                                  className="text-left px-3 py-2 text-sm text-white hover:bg-pink-600 transition-colors border-b border-neutral-700/50 last:border-0 flex justify-between items-center"
                                >
                                  <span className="font-bold">{sugg.title}</span>
                                  <span className="text-[10px] text-pink-200 capitalize opacity-70">{sugg.artist}</span>
                                </button>
                             ))}
                          </div>
                       )}
                       
                       {duplicationWarning.length > 0 && (
                          <div className="mt-2 text-xs text-yellow-500 bg-yellow-500/10 p-2 rounded relative z-0 flex items-start">
                             <AlertTriangle className="w-3 h-3 mr-1 mt-0.5 shrink-0" />
                             <span>Advertencia: Ya se usó este mes en: <strong>{duplicationWarning.join(', ')}</strong></span>
                          </div>
                       )}
                    </div>
                    
                    <div className="col-span-2 md:col-span-1">
                       <label className="block text-xs text-pink-500 mb-1 font-medium bg-pink-500/5 px-2 rounded-t w-fit">Sección Musical</label>
                       <select 
                         value={newSong.section || 'GENERAL'} 
                         onChange={e => setNewSong({...newSong, section: e.target.value as any})} 
                         className="w-full bg-neutral-900 border border-neutral-700 rounded-md p-2 text-sm text-white focus:outline-none focus:border-pink-500 focus:bg-neutral-950 transition-colors"
                       >
                         <option value="GENERAL">General</option>
                         <option value="ALABANZAS">Alabanzas</option>
                         <option value="ADORACIÓN">Adoración</option>
                         <option value="OFRENDA">Ofrenda</option>
                         <option value="DESPEDIDA">Despedida</option>
                       </select>
                    </div>

                    <div className="col-span-2 md:col-span-1">
                       <label className="block text-xs text-neutral-400 mb-1 font-medium">Voz Principal</label>
                       <select 
                         value={newSong.leadSingerId || ''} 
                         onChange={e => setNewSong({...newSong, leadSingerId: e.target.value})} 
                         className="w-full bg-neutral-900 border border-neutral-700 rounded-md p-2 text-sm text-white focus:outline-none focus:border-pink-500 focus:bg-neutral-950 transition-colors text-pink-100"
                       >
                         <option value="">-- Coro Unísono --</option>
                         {singingTeam.map(u => (
                            <option key={u.id} value={u.id}>{u.name} {u.id === dateInfo.directorId ? '(Director)' : ''}</option>
                         ))}
                       </select>
                    </div>

                    <div className="col-span-2 md:col-span-1">
                       <label className="block text-xs text-neutral-500 mb-1 font-medium">Artista Original</label>
                       <input value={newSong.artist} onChange={e => setNewSong({...newSong, artist: e.target.value})} type="text" className="w-full bg-neutral-900 border border-neutral-700 rounded-md p-2 text-sm text-white focus:outline-none focus:border-pink-500 focus:bg-neutral-950" placeholder="Ej. Marcos Brunet" />
                    </div>
                    
                    <div className="col-span-1 md:col-span-1">
                       <label className="block text-xs text-neutral-500 mb-1 font-medium">Tono Base</label>
                       <input value={newSong.tone} onChange={e => setNewSong({...newSong, tone: e.target.value})} type="text" className="w-full bg-neutral-900 border border-neutral-700 rounded-md p-2 text-sm text-white focus:outline-none focus:border-pink-500 font-mono font-bold" placeholder="Ej. A#" />
                    </div>

                    <div className="col-span-1 md:col-span-2">
                       <label className="block text-xs text-neutral-500 mb-1 font-medium">Versión Músical (Live, Studio)</label>
                       <input value={newSong.version} onChange={e => setNewSong({...newSong, version: e.target.value})} type="text" className="w-full bg-neutral-900 border border-neutral-700 rounded-md p-2 text-sm text-white focus:outline-none focus:border-pink-500 focus:bg-neutral-950" placeholder="Ej. Acústica" />
                    </div>
                    
                    <div className="col-span-2 md:col-span-3 mt-1">
                       <label className="block text-xs text-neutral-500 mb-1 font-medium">URL YouTube de la Canción</label>
                       <input value={newSong.youtubeUrl} onChange={e => setNewSong({...newSong, youtubeUrl: e.target.value})} type="url" className="w-full bg-neutral-900 border border-neutral-700 rounded-md p-2 text-sm text-white focus:outline-none focus:border-pink-500 focus:bg-neutral-950 text-red-100" placeholder="https://youtube.com/..." />
                    </div>
                    
                    <div className="col-span-2 md:col-span-1 flex items-end mt-1">
                       <button onClick={handleAddSong} disabled={!newSong.title} className="w-full py-2 bg-pink-600 hover:bg-pink-700 text-white rounded-lg text-sm font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                         Añadir
                       </button>
                    </div>
                  </div>
               </div>
             )}
           </div>
        </div>
      </div>
     
      {/* WhatsApp Compact Preview Modal */}
      {showPreviewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/85 backdrop-blur-sm text-white">
          <div className="bg-neutral-950 border border-neutral-800/80 rounded-xl w-full max-w-xs shadow-[0_0_40px_rgba(236,72,153,0.12)] relative overflow-hidden">
            {/* Close */}
            <button
              onClick={() => setShowPreviewModal(false)}
              className="absolute top-2 right-2 p-1 bg-neutral-900 hover:bg-neutral-800 rounded-full z-10 transition-colors"
            >
              <X className="w-3.5 h-3.5 text-neutral-400" />
            </button>

            {/* Header */}
            <div className="bg-gradient-to-b from-neutral-900 to-neutral-950 px-4 pt-4 pb-3 border-b border-neutral-800/50">
              <h3 className="text-base font-black tracking-widest text-white uppercase text-center leading-tight">{dateInfo.dayName}</h3>
              <p className="text-[10px] text-pink-400/70 font-bold uppercase tracking-widest text-center mt-0.5">{dateInfo.dateStr}</p>
              <div className="flex justify-center mt-2">
                <span className="text-[9px] bg-neutral-800 border border-neutral-700/50 text-neutral-400 px-2 py-0.5 rounded-full uppercase font-bold tracking-wider">
                  Líder: <span className="text-pink-300">{allUsers.find(u => u.id === dateInfo.directorId)?.name || 'Sin asignar'}</span>
                </span>
              </div>
            </div>

            {/* Song list */}
            <div className="px-3 py-2.5 space-y-3">
              {[
                { id: 'ALABANZAS', label: 'Alabanzas' },
                { id: 'ADORACIÓN', label: 'Adoración' },
                { id: 'OFRENDA', label: 'Ofrenda' },
                { id: 'DESPEDIDA', label: 'Despedida' },
                { id: 'GENERAL', label: 'General' }
              ]
                .filter(sec => dateInfo.songs.some(s => (s.section || 'GENERAL') === sec.id))
                .map(section => {
                  const sectionSongs = dateInfo.songs.filter(s => (s.section || 'GENERAL') === section.id);
                  return (
                    <div key={section.id}>
                      {/* Section label */}
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[8px] font-black tracking-[0.15em] text-neutral-600 uppercase shrink-0">{section.label}</span>
                        <div className="h-px bg-neutral-800 flex-1"></div>
                      </div>
                      {/* Songs */}
                      <div className="space-y-0.5">
                        {sectionSongs.map((song, i) => {
                          const singerName = allUsers.find(u => u.id === song.leadSingerId)?.name;
                          const showSinger = !!song.leadSingerId && song.leadSingerId !== dateInfo.directorId;
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
                })}
            </div>

            {/* Footer count */}
            <div className="px-4 py-2 border-t border-neutral-800/50 text-center">
              <span className="text-[9px] text-neutral-600 font-medium">{dateInfo.songs.length} canciones · Asaf Worship</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
