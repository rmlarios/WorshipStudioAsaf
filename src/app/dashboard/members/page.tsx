"use client";

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import * as store from '../../../lib/firebaseStore';
import { User, UserRole } from '../../../lib/types';
import { Users, Plus, Edit2, Save, XCircle, ShieldCheck, ShieldOff, Loader2, Eye, EyeOff, Trash2 } from 'lucide-react';

export default function MembersPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [members, setMembers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  // Form states
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<{name: string, emailOrPhone: string, password: string, role: UserRole}>({
    name: '', emailOrPhone: '', password: '', role: 'CANTOR'
  });
  const [showPassword, setShowPassword] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const userStr = localStorage.getItem('currentUser');
    if (userStr) {
      const parsed = JSON.parse(userStr);
      if (parsed.role !== 'DIRECTOR') {
        router.push('/dashboard');
      } else {
        setCurrentUser(parsed);
      }
    } else {
      router.push('/');
    }
  }, [router]);

  const loadMembers = useCallback(async () => {
    if (!currentUser) return;
    setLoading(true);
    const users = await store.getUsers();
    users.sort((a, b) => a.name.localeCompare(b.name));
    setMembers(users);
    setLoading(false);
  }, [currentUser]);

  // Check if a user is referenced in any service date or library song
  const checkUserDependencies = async (userId: string): Promise<string[]> => {
    const reasons: string[] = [];
    const allDates = await store.getAllServiceDates();
    const library = await store.getLibrary();

    for (const date of allDates) {
      if (date.directorId === userId) {
        reasons.push(`Director en "${date.dayName}" (${date.dateStr})`);
      }
      if (date.acompaniantesIds.includes(userId)) {
        reasons.push(`Acompañante en "${date.dayName}" (${date.dateStr})`);
      }
      for (const song of date.songs) {
        if (song.leadSingerId === userId) {
          reasons.push(`Voz lead de "${song.title}" en ${date.dayName}`);
        }
      }
    }

    for (const song of library) {
      if (song.userPreferredTones && song.userPreferredTones[userId]) {
        reasons.push(`Tono registrado en "${song.title}" (Repertorio)`);
      }
    }

    return reasons;
  };

  const handleDelete = async (member: User) => {
    const reasons = await checkUserDependencies(member.id);
    if (reasons.length > 0) {
      alert(
        `No se puede eliminar a "${member.name}" porque está referenciado en:\n\n` +
        reasons.slice(0, 8).map(r => `• ${r}`).join('\n') +
        (reasons.length > 8 ? `\n...y ${reasons.length - 8} referencias más.` : '') +
        '\n\nDeshabílitalo en su lugar, o elimínalo primero de esos cultos/canciones.'
      );
      return;
    }
    if (confirm(`¿Estás seguro de que deseas ELIMINAR permanentemente a "${member.name}"? Esta acción no se puede deshacer.`)) {
      await store.deleteUser(member.id);
      await loadMembers();
    }
  };

  useEffect(() => {
    loadMembers();
  }, [loadMembers]);

  const handleStartAdd = () => {
    setEditingId('new');
    setFormData({ name: '', emailOrPhone: '', password: '1234', role: 'CANTOR' });
  };

  const handleStartEdit = (user: User) => {
    setEditingId(user.id);
    setFormData({ name: user.name, emailOrPhone: user.emailOrPhone, password: user.password || '', role: user.role });
  };

  const handleSave = async () => {
    if (!formData.name || !formData.emailOrPhone || !formData.password) return;

    if (editingId === 'new') {
      await store.addUser({
        name: formData.name,
        emailOrPhone: formData.emailOrPhone.toLowerCase().trim(),
        password: formData.password,
        role: formData.role,
        active: true
      });
    } else if (editingId) {
      const existing = members.find(m => m.id === editingId);
      if (existing) {
        await store.updateUser({
          ...existing,
          name: formData.name,
          emailOrPhone: formData.emailOrPhone.toLowerCase().trim(),
          password: formData.password,
          role: formData.role
        });
      }
    }

    setEditingId(null);
    await loadMembers();
  };

  const handleToggleActive = async (user: User) => {
    await store.updateUser({ ...user, active: !user.active });
    await loadMembers();
  };

  if (!currentUser) return null;

  const roleColors: Record<UserRole, string> = {
    'DIRECTOR': 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    'CANTOR': 'bg-pink-500/20 text-pink-400 border-pink-500/30',
    'MUSICO': 'bg-blue-500/20 text-blue-400 border-blue-500/30'
  };

  return (
    <div className="space-y-6 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-neutral-800 pb-4 gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center">
             <Users className="w-6 h-6 mr-3 text-pink-500" />
             Miembros del Equipo
          </h2>
          <p className="text-sm text-neutral-400 mt-1">Administra las cuentas de acceso del ministerio de alabanza.</p>
        </div>
        <button onClick={handleStartAdd} className="bg-pink-600 hover:bg-pink-500 text-white px-4 py-2 rounded-lg font-bold text-sm transition-colors shadow flex items-center shrink-0">
          <Plus className="w-4 h-4 mr-2" />
          Nuevo Miembro
        </button>
      </div>

      {loading ? (
        <div className="text-center py-20"><Loader2 className="w-8 h-8 animate-spin text-pink-500 mx-auto" /></div>
      ) : (
        <div className="space-y-3">
          
          {/* Add new member form */}
          {editingId === 'new' && (
            <div className="bg-neutral-900 border border-pink-500/50 rounded-xl p-5 shadow-[0_0_15px_rgba(236,72,153,0.1)]">
              <h4 className="text-sm font-semibold text-pink-400 mb-4 flex items-center"><Plus className="w-4 h-4 mr-2"/> Registrar Nuevo Miembro</h4>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <input value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} type="text" className="bg-neutral-950 border border-neutral-700 rounded-md p-2.5 text-sm text-white focus:border-pink-500" placeholder="Nombre completo *" />
                <input value={formData.emailOrPhone} onChange={e => setFormData({...formData, emailOrPhone: e.target.value})} type="text" className="bg-neutral-950 border border-neutral-700 rounded-md p-2.5 text-sm text-white focus:border-pink-500" placeholder="Nombre de usuario *" />
                <input value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} type="text" className="bg-neutral-950 border border-neutral-700 rounded-md p-2.5 text-sm text-white font-mono focus:border-pink-500" placeholder="Contraseña *" />
                <select value={formData.role} onChange={e => setFormData({...formData, role: e.target.value as UserRole})} className="bg-neutral-950 border border-neutral-700 rounded-md p-2.5 text-sm text-white">
                  <option value="CANTOR">Cantor</option>
                  <option value="MUSICO">Músico</option>
                  <option value="DIRECTOR">Director</option>
                </select>
              </div>
              <div className="flex space-x-2 mt-4 pt-4 border-t border-neutral-800">
                <button onClick={() => setEditingId(null)} className="flex-1 py-2 text-neutral-400 hover:text-white bg-neutral-800 rounded-lg text-sm font-bold transition-colors">Cancelar</button>
                <button onClick={handleSave} className="flex-1 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-bold transition-colors flex items-center justify-center">
                  <Save className="w-4 h-4 mr-2" /> Guardar
                </button>
              </div>
            </div>
          )}

          {members.map(member => {
            const isEditing = editingId === member.id;

            if (isEditing) {
              return (
                <div key={member.id} className="bg-neutral-900 border border-pink-500/50 rounded-xl p-5 shadow-[0_0_15px_rgba(236,72,153,0.1)]">
                  <h4 className="text-sm font-semibold text-pink-400 mb-4 flex items-center"><Edit2 className="w-4 h-4 mr-2"/> Editando: {member.name}</h4>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                    <input value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} type="text" className="bg-neutral-950 border border-neutral-700 rounded-md p-2.5 text-sm text-white focus:border-pink-500" placeholder="Nombre *" />
                    <input value={formData.emailOrPhone} onChange={e => setFormData({...formData, emailOrPhone: e.target.value})} type="text" className="bg-neutral-950 border border-neutral-700 rounded-md p-2.5 text-sm text-white focus:border-pink-500" placeholder="Usuario *" />
                    <input value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} type="text" className="bg-neutral-950 border border-neutral-700 rounded-md p-2.5 text-sm text-white font-mono focus:border-pink-500" placeholder="Contraseña *" />
                    <select value={formData.role} onChange={e => setFormData({...formData, role: e.target.value as UserRole})} className="bg-neutral-950 border border-neutral-700 rounded-md p-2.5 text-sm text-white">
                      <option value="CANTOR">Cantor</option>
                      <option value="MUSICO">Músico</option>
                      <option value="DIRECTOR">Director</option>
                    </select>
                  </div>
                  <div className="flex space-x-2 mt-4 pt-4 border-t border-neutral-800">
                    <button onClick={() => setEditingId(null)} className="flex-1 py-2 text-neutral-400 hover:text-white bg-neutral-800 rounded-lg text-sm font-bold transition-colors">Cancelar</button>
                    <button onClick={handleSave} className="flex-1 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-bold transition-colors flex items-center justify-center">
                      <Save className="w-4 h-4 mr-2" /> Guardar Cambios
                    </button>
                  </div>
                </div>
              );
            }

            return (
              <div key={member.id} className={`bg-neutral-900 border rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 group transition-all ${member.active ? 'border-neutral-800 hover:border-neutral-700' : 'border-red-500/20 opacity-60'}`}>
                <div className="flex items-center space-x-4">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shrink-0 ${member.active ? 'bg-neutral-800 text-white' : 'bg-red-500/10 text-red-400'}`}>
                    {member.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h4 className="text-white font-bold">{member.name}</h4>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span className="text-xs text-neutral-500 font-mono">@{member.emailOrPhone}</span>
                      <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded border ${roleColors[member.role]}`}>{member.role}</span>
                      {!member.active && <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-red-500/20 text-red-400 border border-red-500/30">Deshabilitado</span>}
                    </div>
                    <div className="flex items-center mt-1">
                       <span className="text-xs text-neutral-600 mr-1">Clave:</span>
                       <span className="text-xs text-neutral-400 font-mono">{showPassword[member.id] ? (member.password || '???') : '••••'}</span>
                       <button onClick={() => setShowPassword(p => ({...p, [member.id]: !p[member.id]}))} className="ml-1 text-neutral-600 hover:text-neutral-400">
                         {showPassword[member.id] ? <EyeOff className="w-3 h-3"/> : <Eye className="w-3 h-3"/>}
                       </button>
                    </div>
                  </div>
                </div>
                <div className="flex space-x-2 shrink-0">
                  <button onClick={() => handleStartEdit(member)} title="Editar nombre, usuario, contraseña o rol" className="p-2 text-neutral-400 hover:text-white hover:bg-neutral-800 rounded-lg transition-colors">
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button onClick={() => handleToggleActive(member)} title={member.active ? 'Deshabilitar acceso (no podrá iniciar sesión)' : 'Rehabilitar acceso (podrá entrar de nuevo)'} className={`p-2 rounded-lg transition-colors ${member.active ? 'text-neutral-400 hover:text-red-400 hover:bg-red-500/10' : 'text-green-500 hover:text-green-400 hover:bg-green-500/10'}`}>
                    {member.active ? <ShieldOff className="w-4 h-4" /> : <ShieldCheck className="w-4 h-4" />}
                  </button>
                  <button onClick={() => handleDelete(member)} title="Eliminar permanentemente (solo si no está en cultos ni repertorio)" className="p-2 text-neutral-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
