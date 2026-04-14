"use client";

import { useEffect, useState, useCallback } from 'react';
import * as store from '../../../lib/firebaseStore';
import { LibrarySong, User } from '../../../lib/types';
import { Search, Music, Music2, Download, User2, ExternalLink, Edit2, Trash2, Plus, Save, LayoutGrid, TableProperties, Loader2 } from 'lucide-react';
import * as XLSX from 'xlsx';

export default function LibraryPage() {
  const [library, setLibrary] = useState<LibrarySong[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');
  const [loading, setLoading] = useState(true);
  
  // States for CRUD
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState<Partial<LibrarySong>>({});
  const [isAddingNew, setIsAddingNew] = useState(false);
  
  const [inlineEditingCell, setInlineEditingCell] = useState<{songId: string, userId: string} | null>(null);
  const [inlineToneInput, setInlineToneInput] = useState('');

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
      
      await store.syncAllSongsToLibrary();
      
      const libs = await store.getLibrary();
      libs.sort((a, b) => a.title.localeCompare(b.title));
      setLibrary(libs);
    } catch (err) {
      console.error('Error loading library:', err);
    }
    setLoading(false);
  }, [currentUser]);

  useEffect(() => {
    loadData();
  }, [loadData]);
  
  const refreshLibrary = async () => {
     const libs = await store.getLibrary();
     libs.sort((a, b) => a.title.localeCompare(b.title));
     setLibrary(libs);
  };

  const handleStartEdit = (song: LibrarySong) => {
    setEditingId(song.id);
    setEditData(song);
  };

  const handleSaveEdit = async () => {
    if (!editingId || !editData.title) return;
    
    if (editingId === 'new') {
       await store.addLibrarySongDirectly({
         title: editData.title,
         artist: editData.artist || 'Desconocido',
         youtubeUrl: editData.youtubeUrl || '',
         originalTone: editData.originalTone || 'Desconocido',
         userPreferredTones: {},
         playCount: 0
       });
       setIsAddingNew(false);
    } else {
       await store.updateLibrarySongDirectly(editData as LibrarySong);
    }
    
    setEditingId(null);
    await refreshLibrary();
  };

  const handleDelete = async (id: string) => {
    if(confirm("¿Seguro que deseas eliminar esta canción de la Biblioteca permanentemente?")) {
       await store.deleteLibrarySong(id);
       await refreshLibrary();
    }
  };

  const handleSaveInlineTone = async (song: LibrarySong, userId: string) => {
     const updated = { ...song };
     if (inlineToneInput.trim() === '') {
        delete updated.userPreferredTones[userId];
     } else {
        updated.userPreferredTones[userId] = inlineToneInput.trim();
     }
     await store.updateLibrarySongDirectly(updated);
     setInlineEditingCell(null);
     await refreshLibrary();
  };

  const handleSearchWeb = (title: string, artist: string) => {
     const query = encodeURIComponent(`Acordes ${title} ${artist !== 'Desconocido' ? artist : ''}`);
     window.open(`https://www.google.com/search?q=${query}`, '_blank');
  };

  const handleExportLib = () => {
     const rows = [["Título", "Artista", "Tono Original", "Músicos y Tonos"]];
     library.forEach(song => {
        let vocals = "";
        Object.entries(song.userPreferredTones).forEach(([userId, tone]) => {
           const u = allUsers.find(x => x.id === userId);
           if (u) vocals += `${u.name} (${tone}), `;
        });
        rows.push([song.title, song.artist, song.originalTone, vocals]);
     });
     
     const worksheet = XLSX.utils.aoa_to_sheet(rows);
     const workbook = XLSX.utils.book_new();
     XLSX.utils.book_append_sheet(workbook, worksheet, "Repertorio");
     XLSX.writeFile(workbook, `WorshipStudio_Repertorio.xlsx`);
  };

  const filteredLibrary = library.filter(s => 
     s.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
     s.artist.toLowerCase().includes(searchTerm.toLowerCase())
  );
  
  const cantores = allUsers.filter(u => u.role === 'CANTOR');

  if (!currentUser) return null;

  return (
    <div className="space-y-6 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-neutral-800 pb-4 gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center">
             <Music className="w-6 h-6 mr-3 text-pink-500" />
             Repertorio Asaf
          </h2>
          <p className="text-sm text-neutral-400 mt-1">Acervo global de canciones y métricas vocales de todo el equipo.</p>
        </div>
        <div className="flex space-x-2 shrink-0">
           {currentUser?.role === 'DIRECTOR' && (
              <button onClick={() => { setIsAddingNew(true); setEditingId('new'); setEditData({ title: '', artist: '', originalTone: '' }); }} className="bg-pink-600 hover:bg-pink-500 text-white px-3 py-2 rounded-lg font-bold text-sm transition-colors shadow flex items-center">
                <Plus className="w-4 h-4 mr-1" />
                <span className="hidden sm:inline">Añadir Canción</span>
              </button>
           )}
           <button onClick={handleExportLib} className="bg-green-600 hover:bg-green-500 text-white px-3 py-2 rounded-lg font-bold text-sm transition-colors shadow flex items-center">
             <Download className="w-4 h-4 mr-1" />
             <span className="hidden sm:inline">Exportar</span>
           </button>
           
           <div className="flex bg-neutral-800 rounded-lg p-1 ml-2">
             <button onClick={() => setViewMode('cards')} className={`p-1.5 rounded-md ${viewMode === 'cards' ? 'bg-neutral-600 text-white shadow' : 'text-neutral-400 hover:text-white'}`}><LayoutGrid className="w-4 h-4"/></button>
             <button onClick={() => setViewMode('table')} className={`p-1.5 rounded-md ${viewMode === 'table' ? 'bg-neutral-600 text-white shadow' : 'text-neutral-400 hover:text-white'}`}><TableProperties className="w-4 h-4"/></button>
           </div>
        </div>
      </div>

      <div className="bg-neutral-900 border border-neutral-800 p-5 rounded-2xl relative">
         <div className="relative mb-6">
            <Search className="w-5 h-5 absolute left-3 top-3 text-neutral-500" />
            <input 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              type="text" 
              placeholder="Buscar título o artista..." 
              className="w-full bg-neutral-950 border border-neutral-700 rounded-xl pl-10 pr-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-pink-500 transition-shadow"
            />
         </div>

         {loading ? (
            <div className="text-center py-20"><Loader2 className="w-8 h-8 animate-spin text-pink-500 mx-auto" /></div>
         ) : library.length === 0 && !isAddingNew ? (
            <div className="text-center py-20 border-2 border-neutral-800 border-dashed rounded-xl m-2">
              <Music2 className="w-12 h-12 text-neutral-700 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-white mb-2">Biblioteca Vacía</h3>
              <p className="text-sm text-neutral-500 mb-6">La biblioteca se llenará automáticamente a medida que los directores agreguen canciones a los bosquejos.</p>
            </div>
         ) : filteredLibrary.length === 0 && !isAddingNew ? (
            <div className="text-center py-10 text-neutral-500">No se encontraron resultados.</div>
         ) : viewMode === 'cards' ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              
              {isAddingNew && editingId === 'new' && (
                 <div className="bg-neutral-900 border border-pink-500/50 hover:border-pink-500 rounded-xl p-4 transition-all group flex flex-col justify-between h-full shadow-[0_0_15px_rgba(236,72,153,0.1)]">
                    <div>
                       <h4 className="text-sm font-semibold text-pink-400 mb-3 flex items-center"><Plus className="w-4 h-4 mr-2"/> Nueva Canción Directa</h4>
                       <div className="space-y-3">
                         <input value={editData.title} onChange={e => setEditData({...editData, title: e.target.value})} type="text" className="w-full bg-neutral-950 border border-neutral-700 rounded-md p-2 text-sm text-white focus:border-pink-500" placeholder="Título *" />
                         <input value={editData.artist} onChange={e => setEditData({...editData, artist: e.target.value})} type="text" className="w-full bg-neutral-950 border border-neutral-700 rounded-md p-2 text-sm text-white" placeholder="Artista" />
                         <input value={editData.originalTone} onChange={e => setEditData({...editData, originalTone: e.target.value})} type="text" className="w-full bg-neutral-950 border border-neutral-700 rounded-md p-2 text-sm text-white font-mono" placeholder="Tono Oríginal" />
                         <input value={editData.youtubeUrl} onChange={e => setEditData({...editData, youtubeUrl: e.target.value})} type="text" className="w-full bg-neutral-950 border border-neutral-700 rounded-md p-2 text-sm text-white" placeholder="URL Youtube" />
                       </div>
                    </div>
                    <div className="flex space-x-2 mt-4 pt-4 border-t border-neutral-800">
                      <button onClick={() => { setIsAddingNew(false); setEditingId(null); }} className="flex-1 py-2 text-neutral-400 hover:text-white bg-neutral-800 rounded-lg text-sm font-bold transition-colors">Cancelar</button>
                      <button onClick={handleSaveEdit} className="flex-1 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-bold transition-colors">Guardar</button>
                    </div>
                 </div>
              )}

              {filteredLibrary.map(song => {
                 const isEditing = editingId === song.id;

                 if (isEditing) {
                    return (
                      <div key={song.id} className="bg-neutral-900 border border-pink-500/50 hover:border-pink-500 rounded-xl p-4 transition-all group flex flex-col justify-between h-full shadow-[0_0_15px_rgba(236,72,153,0.1)]">
                         <div>
                            <h4 className="text-sm font-semibold text-pink-400 mb-3 flex items-center"><Edit2 className="w-4 h-4 mr-2"/> Editando Global</h4>
                            <div className="space-y-3">
                              <input value={editData.title} onChange={e => setEditData({...editData, title: e.target.value})} type="text" className="w-full bg-neutral-950 border border-neutral-700 rounded-md p-2 text-sm text-white focus:border-pink-500" placeholder="Título *" />
                              <input value={editData.artist} onChange={e => setEditData({...editData, artist: e.target.value})} type="text" className="w-full bg-neutral-950 border border-neutral-700 rounded-md p-2 text-sm text-white" placeholder="Artista" />
                              <input value={editData.originalTone} onChange={e => setEditData({...editData, originalTone: e.target.value})} type="text" className="w-full bg-neutral-950 border border-neutral-700 rounded-md p-2 text-sm text-white font-mono" placeholder="Tono Oríginal" />
                            </div>
                         </div>
                         <div className="flex space-x-2 mt-4 pt-4 border-t border-neutral-800">
                           <button onClick={() => setEditingId(null)} className="flex-1 py-2 text-neutral-400 hover:text-white bg-neutral-800 rounded-lg text-sm font-bold transition-colors">Cancelar</button>
                           <button onClick={handleSaveEdit} className="flex-1 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-bold transition-colors">Guardar</button>
                         </div>
                      </div>
                    )
                 }

                 return (
                 <div key={song.id} className="bg-neutral-950 border border-neutral-800 hover:border-neutral-700 rounded-xl p-4 transition-all group flex flex-col justify-between h-full relative">
                    
                    {currentUser?.role === 'DIRECTOR' && (
                       <div className="absolute top-3 right-3 hidden group-hover:flex space-x-1 z-10 bg-neutral-950/80 p-1 rounded-lg backdrop-blur">
                          <button onClick={() => handleStartEdit(song)} className="p-1.5 text-neutral-400 hover:text-white hover:bg-neutral-800 rounded transition-colors"><Edit2 className="w-4 h-4"/></button>
                          <button onClick={() => handleDelete(song.id)} className="p-1.5 text-neutral-400 hover:text-red-400 hover:bg-neutral-800 rounded transition-colors"><Trash2 className="w-4 h-4"/></button>
                       </div>
                    )}

                    <div>
                       <div className="flex justify-between items-start mb-2 pr-12">
                         <h4 className="text-lg font-bold text-white leading-tight">{song.title}</h4>
                         <span className="bg-neutral-800 text-neutral-400 text-xs px-2 py-0.5 rounded-full font-medium ml-2 shrink-0">{song.playCount} {song.playCount === 1 ? 'vez' : 'veces'}</span>
                       </div>
                       
                       <p className="text-sm text-pink-400 font-medium mb-4">{song.artist}</p>
                       
                       <div className="flex items-center text-sm mb-4 bg-neutral-900 border border-neutral-800 p-2 rounded-lg relative overflow-hidden">
                          <div className={`w-1 h-full absolute left-0 top-0 ${song.originalTone === 'Desconocido' ? 'bg-orange-500' : 'bg-neutral-600'}`}></div>
                          <span className="text-neutral-500 ml-2 mr-2">Tono Pista Base:</span> 
                          <span className="font-bold font-mono text-white tracking-widest">{song.originalTone}</span>
                          
                          {song.originalTone === 'Desconocido' && (
                             <button
                               onClick={() => handleSearchWeb(song.title, song.artist)} 
                               className="ml-auto text-[10px] bg-orange-500/20 text-orange-400 px-2 py-1 rounded hover:bg-orange-500/40 transition-colors flex items-center text-nowrap"
                               title="Buscar el tono original"
                             >
                                <ExternalLink className="w-3 h-3 mr-1" />
                                Buscar en Web
                             </button>
                          )}
                       </div>
                       
                       <div className="space-y-1 mt-1">
                          {Object.keys(song.userPreferredTones).length > 0 ? (
                             Object.entries(song.userPreferredTones).map(([userId, tone]) => {
                                const userName = allUsers.find(u => u.id === userId)?.name || 'Vocalista';
                                return (
                                   <div key={userId} className="flex justify-between text-xs py-1 border-b border-neutral-800/50 last:border-0 pl-1 pr-1">
                                      <span className="text-neutral-400 flex items-center"><User2 className="w-3 h-3 mr-1.5 opacity-50"/> {userName}</span>
                                      <span className="text-pink-300 font-mono font-semibold">{tone}</span>
                                   </div>
                                )
                             })
                          ) : (
                             <p className="text-xs text-neutral-600 italic pl-1">No hay registros vocales aún.</p>
                          )}
                       </div>
                    </div>
                 </div>
              )})}
            </div>
         ) : (
            <div className="overflow-x-auto bg-neutral-950 rounded-xl border border-neutral-800">
               <table className="w-full text-left text-sm text-neutral-300">
                  <thead className="bg-neutral-900 text-xs uppercase text-neutral-500">
                     <tr>
                        <th className="px-4 py-3 font-bold border-b border-neutral-800">Título</th>
                        <th className="px-4 py-3 font-bold border-b border-neutral-800">Artista</th>
                        <th className="px-4 py-3 font-bold border-b border-neutral-800 border-r text-center">Tono Base</th>
                        {cantores.map(c => (
                          <th key={c.id} className="px-4 py-3 font-bold border-b border-neutral-800 text-center truncate max-w-[80px]" title={c.name}>{c.name}</th>
                        ))}
                     </tr>
                  </thead>
                  <tbody>
                     {filteredLibrary.map(song => (
                        <tr key={song.id} className="border-b border-neutral-800/50 hover:bg-neutral-900/50 transition-colors">
                           <td className="px-4 py-3 text-white font-medium">{song.title}</td>
                           <td className="px-4 py-3 text-pink-400">{song.artist}</td>
                           <td className="px-4 py-3 font-mono font-bold text-center border-r border-neutral-800/50">
                             <div className={`inline-block px-2 py-0.5 rounded text-xs ${song.originalTone === 'Desconocido' ? 'bg-orange-500/20 text-orange-400' : 'bg-neutral-800 text-white'}`}>
                               {song.originalTone}
                             </div>
                           </td>
                           {cantores.map(c => {
                              const vocalTone = song.userPreferredTones[c.id];
                              const isMyColumn = currentUser?.id === c.id || currentUser?.role === 'DIRECTOR';
                              const isEditingThisCell = inlineEditingCell?.songId === song.id && inlineEditingCell?.userId === c.id;

                              return (
                                <td key={c.id} className="px-4 py-3 text-center font-mono">
                                   {isEditingThisCell ? (
                                      <div className="flex items-center justify-center animate-fade-in">
                                         <input 
                                            autoFocus
                                            value={inlineToneInput} 
                                            onChange={e => setInlineToneInput(e.target.value)} 
                                            className="w-12 bg-neutral-900 border border-pink-500 rounded text-center text-white py-0.5 text-xs focus:outline-none" 
                                            onKeyDown={e => e.key === 'Enter' && handleSaveInlineTone(song, c.id)}
                                         />
                                         <button onClick={() => handleSaveInlineTone(song, c.id)} className="ml-1 text-green-400 hover:text-green-300"><Save className="w-3.5 h-3.5"/></button>
                                      </div>
                                   ) : (
                                      <div className="group relative flex justify-center items-center w-full min-h-[24px]">
                                         {vocalTone ? <span className="text-pink-200">{vocalTone}</span> : <span className="text-neutral-700">-</span>}
                                         
                                         {isMyColumn && (
                                            <button 
                                              onClick={() => { setInlineEditingCell({songId: song.id, userId: c.id}); setInlineToneInput(vocalTone || ''); }}
                                              className="absolute -right-2 opacity-0 group-hover:opacity-100 p-1 text-neutral-400 hover:text-white transition-opacity bg-neutral-800 rounded shadow-md"
                                            >
                                               <Edit2 className="w-3 h-3"/>
                                            </button>
                                         )}
                                      </div>
                                   )}
                                </td>
                              )
                           })}
                        </tr>
                     ))}
                  </tbody>
               </table>
            </div>
         )}
      </div>
    </div>
  );
}
