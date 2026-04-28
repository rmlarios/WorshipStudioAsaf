"use client";

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { User } from '../../lib/types';
import { LogOut, Calendar, Music, Settings, User as UserIcon, Users, Grid, Bell } from 'lucide-react';
import Link from 'next/link';
import * as store from '../../lib/firebaseStore';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [pendingReviewsCount, setPendingReviewsCount] = useState(0);

  useEffect(() => {
    const userStr = localStorage.getItem('currentUser');
    if (userStr) {
      const user = JSON.parse(userStr) as User;
      setCurrentUser(user);

      // Listen for pending reviews if user is a director
      if (user.role === 'DIRECTOR') {
        const unsubscribe = store.subscribeToPendingReviews((count) => {
          setPendingReviewsCount(count);
        });
        return () => unsubscribe();
      }
    } else {
      router.push('/');
    }
  }, [router]);

  const handleLogout = () => {
    localStorage.removeItem('currentUser');
    router.push('/');
  };

  if (!currentUser) return <div className="min-h-screen bg-neutral-900 flex items-center justify-center text-white">Cargando...</div>;

  return (
    <div className="min-h-screen bg-neutral-950 flex flex-col md:flex-row text-neutral-200">
      {/* Sidebar for Desktop / Bottom Nav for Mobile */}
      <nav className="fixed bottom-0 w-full bg-neutral-900 border-t border-neutral-800 md:relative md:w-64 md:h-screen md:border-r md:border-t-0 z-50">
        <div className="flex justify-between items-center px-6 py-4 md:flex-col md:items-start md:p-6 md:space-y-8">
          <div className="hidden md:block">
            <h1 className="text-xl font-bold text-white tracking-tight">Worship<span className="text-pink-500">Studio</span></h1>
            <p className="text-xs text-neutral-400 mt-1 capitalize">{currentUser.name}</p>
            <span className="inline-block mt-2 px-2 py-1 bg-neutral-800 rounded text-xs text-neutral-300 border border-neutral-700">{currentUser.role}</span>
          </div>

          <div className="flex w-full justify-around md:flex-col md:space-y-4 md:justify-start">
            <Link href="/dashboard" className={`flex flex-col md:flex-row items-center space-y-1 md:space-y-0 md:space-x-3 p-2 rounded-lg transition-colors relative ${pathname === '/dashboard' ? 'text-pink-500 md:bg-pink-500/10' : 'text-neutral-400 hover:text-white hover:bg-neutral-800'}`}>
              <Calendar className="w-5 h-5" />
              <span className="text-xs md:text-sm font-medium">Cultos</span>
              {currentUser.role === 'DIRECTOR' && pendingReviewsCount > 0 && (
                <div className="absolute top-1 right-2 md:relative md:top-0 md:right-0 md:ml-auto flex items-center justify-center bg-red-600 text-white rounded-full p-1 animate-pulse shadow-[0_0_10px_rgba(220,38,38,0.5)]" title={`${pendingReviewsCount} bosquejos por revisar`}>
                  <Bell className="w-3 h-3 fill-white" />
                  <span className="text-[10px] font-black ml-0.5">{pendingReviewsCount}</span>
                </div>
              )}
            </Link>

            <Link href="/dashboard/library" className={`flex flex-col md:flex-row items-center space-y-1 md:space-y-0 md:space-x-3 p-2 rounded-lg transition-colors ${pathname === '/dashboard/library' ? 'text-pink-500 md:bg-pink-500/10' : 'text-neutral-400 hover:text-white hover:bg-neutral-800'}`}>
              <Music className="w-5 h-5" />
              <span className="text-xs md:text-sm font-medium">Repertorio</span>
            </Link>

            {(currentUser.role === 'DIRECTOR' || currentUser.role === 'VISOR') && (
              <>
                <Link href="/dashboard/members" className={`flex flex-col md:flex-row items-center space-y-1 md:space-y-0 md:space-x-3 p-2 rounded-lg transition-colors ${pathname === '/dashboard/members' ? 'text-pink-500 md:bg-pink-500/10' : 'text-neutral-400 hover:text-white hover:bg-neutral-800'}`}>
                  <Users className="w-5 h-5" />
                  <span className="text-xs md:text-sm font-medium">Miembros</span>
                </Link>
                <Link href="/dashboard/matrix" className={`flex flex-col md:flex-row items-center space-y-1 md:space-y-0 md:space-x-3 p-2 rounded-lg transition-colors ${pathname === '/dashboard/matrix' ? 'text-pink-500 md:bg-pink-500/10' : 'text-neutral-400 hover:text-white hover:bg-neutral-800'}`}>
                  <Grid className="w-5 h-5" />
                  <span className="text-xs md:text-sm font-medium">Matriz</span>
                </Link>
                <Link href="/dashboard/settings" className={`flex flex-col md:flex-row items-center space-y-1 md:space-y-0 md:space-x-3 p-2 rounded-lg transition-colors ${pathname === '/dashboard/settings' ? 'text-pink-500 md:bg-pink-500/10' : 'text-neutral-400 hover:text-white hover:bg-neutral-800'}`}>
                  <Settings className="w-5 h-5" />
                  <span className="text-xs md:text-sm font-medium">Ajustes</span>
                </Link>
              </>
            )}

            <button onClick={handleLogout} className="flex flex-col md:flex-row items-center space-y-1 md:space-y-0 md:space-x-3 p-2 rounded-lg text-neutral-400 hover:text-red-400 hover:bg-neutral-800 transition-colors md:mt-auto">
              <LogOut className="w-5 h-5" />
              <span className="text-xs md:text-sm font-medium">Salir</span>
            </button>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-1 w-full pb-20 md:pb-0 overflow-y-auto">
        {/* Mobile Header */}
        <header className="md:hidden bg-neutral-900 border-b border-neutral-800 px-4 py-4 flex justify-between items-center sticky top-0 z-40">
          <div>
            <h1 className="text-lg font-bold text-white tracking-tight">Worship<span className="text-pink-500">Studio</span></h1>
          </div>
          <div className="flex items-center space-x-3">
            {currentUser.role === 'DIRECTOR' && pendingReviewsCount > 0 && (
              <Link href="/dashboard" className="relative p-2 bg-red-600/10 rounded-full border border-red-500/20 animate-pulse">
                <Bell className="w-4 h-4 text-red-500 fill-red-500" />
                <span className="absolute -top-1 -right-1 bg-red-600 text-white text-[8px] font-black w-4 h-4 flex items-center justify-center rounded-full border border-neutral-900">{pendingReviewsCount}</span>
              </Link>
            )}
            <div className="flex items-center space-x-2">
              <div className="text-right">
                <p className="text-sm font-medium text-white leading-none">{currentUser.name}</p>
                <p className="text-[10px] text-pink-400 mt-1 uppercase tracking-wider">{currentUser.role}</p>
              </div>
              <div className="w-8 h-8 rounded-full bg-neutral-800 border border-neutral-700 flex items-center justify-center">
                <UserIcon className="w-4 h-4 text-neutral-400" />
              </div>
            </div>
          </div>
        </header>

        <div className="mx-auto md:p-8 p-4">
          {children}
        </div>
      </main>
    </div>
  );
}
