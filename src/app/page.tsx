"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getUserByUsername, seedInitialData } from '../lib/firebaseStore';
import { User2, Lock, ArrowRight, Loader2 } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const loggedIn = localStorage.getItem('currentUser');
    if (loggedIn) {
      router.push('/dashboard');
      return;
    }
    // Seed initial data in Firestore if empty
    seedInitialData();
  }, [router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const foundUser = await getUserByUsername(username.trim().toLowerCase());

      if (!foundUser) {
        setError('Usuario no encontrado.');
        setLoading(false);
        return;
      }
      if (!foundUser.active) {
        setError('Tu cuenta ha sido deshabilitada. Contacta al director.');
        setLoading(false);
        return;
      }
      if (foundUser.password !== password) {
        setError('Contraseña incorrecta.');
        setLoading(false);
        return;
      }

      // No almacenamos la contraseña en la sesión local
      const { password: _pw, ...safeUser } = foundUser;
      localStorage.setItem('currentUser', JSON.stringify(safeUser));
      if (foundUser.role === 'DIRECTOR') {
        router.push('/dashboard/matrix');
      } else {
        router.push('/dashboard');
      }
    } catch (err) {
      setError('Error de conexión. Intenta de nuevo.');
      setLoading(false);
    }
  };

  if (!mounted) return null;

  return (
    <div className="min-h-screen bg-neutral-900 flex flex-col justify-center py-12 sm:px-6 lg:px-8 text-neutral-100 font-sans">
      <div className="sm:mx-auto sm:w-full sm:max-w-md mt-[-80px]">
        <h2 className="mt-6 text-center text-4xl font-extrabold tracking-tight text-white mb-2">
          Worship<span className="text-pink-500">Studio</span> Asaf
        </h2>
        <p className="text-center text-sm text-neutral-400">
          Plataforma de asignación musical
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-neutral-800 py-8 px-4 shadow sm:rounded-lg sm:px-10 border border-neutral-700">
          <form className="space-y-5" onSubmit={handleLogin}>
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-neutral-300">
                Nombre de Usuario
              </label>
              <div className="mt-1 relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <User2 className="h-5 w-5 text-neutral-500" />
                </div>
                <input
                  id="username"
                  name="username"
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="appearance-none block w-full pl-10 pr-3 py-3 border border-neutral-600 rounded-md shadow-sm placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-pink-500 sm:text-sm bg-neutral-900 text-white"
                  placeholder="Ej. admin, sayda..."
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-neutral-300">
                Contraseña
              </label>
              <div className="mt-1 relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-neutral-500" />
                </div>
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="appearance-none block w-full pl-10 pr-3 py-3 border border-neutral-600 rounded-md shadow-sm placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-pink-500 sm:text-sm bg-neutral-900 text-white"
                  placeholder="Tu contraseña"
                />
              </div>
            </div>

            {error && <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 p-3 rounded-lg">{error}</p>}

            <div>
              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-bold text-white bg-pink-600 hover:bg-pink-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-pink-500 transition-colors disabled:opacity-50"
              >
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>Entrar a la plataforma <ArrowRight className="ml-2 h-5 w-5" /></>
                )}
              </button>
            </div>

            <div className="mt-4 text-center">
              <p className="text-xs text-neutral-500">Credenciales gestionadas por tu Director</p>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
