'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LogOut, Home, Calendar, Database, BarChart, MoonIcon, SunIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { logout } from '@/lib/firebase';
import { useState, useEffect } from 'react';
import { useTheme } from 'next-themes';

export default function AdminNavbar() {
  const pathname = usePathname();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [mounted, setMounted] = useState(false);
  const { theme, setTheme } = useTheme();

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await logout();
      window.location.href = '/login';
    } catch (error) {
      console.error('Error saat logout:', error);
    } finally {
      setIsLoggingOut(false);
    }
  };

  const navItems = [
    { path: '/admin/dashboard', label: 'Dashboard', icon: <Home className="w-4 h-4 mr-2" /> },
    { path: '/admin/chickens', label: 'Data Ayam', icon: <Calendar className="w-4 h-4 mr-2" /> },
    { path: '/admin/export', label: 'Ekspor Data', icon: <Database className="w-4 h-4 mr-2" /> },
    { path: '/admin/reports', label: 'Laporan', icon: <BarChart className="w-4 h-4 mr-2" /> },
  ];

  return (
    <nav className="bg-card shadow-sm">
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-center h-16">
          <div className="flex">
            <Link href="/admin/dashboard" className="flex items-center font-bold text-lg">
              Admin Peternakan
            </Link>
          </div>
          <div className="hidden md:flex space-x-2">
            {navItems.map((item) => (
              <Link 
                key={item.path} 
                href={item.path}
                className={`px-3 py-2 rounded-md text-sm font-medium flex items-center ${
                  pathname === item.path 
                    ? 'bg-primary text-primary-foreground' 
                    : 'text-foreground hover:bg-muted'
                }`}
              >
                {item.icon}
                {item.label}
              </Link>
            ))}
          </div>
          <div className="flex items-center space-x-2">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="rounded-full"
            >
              {mounted && (theme === 'dark' ? <SunIcon className="h-5 w-5" /> : <MoonIcon className="h-5 w-5" />)}
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleLogout}
              disabled={isLoggingOut}
              className="flex items-center"
            >
              <LogOut className="w-4 h-4 mr-2" />
              {isLoggingOut ? 'Keluar...' : 'Keluar'}
            </Button>
          </div>
        </div>
      </div>
      <div className="md:hidden border-t">
        <div className="container mx-auto px-4 py-2 flex justify-between">
          {navItems.map((item) => (
            <Link 
              key={item.path} 
              href={item.path}
              className={`p-2 rounded-md text-xs font-medium flex flex-col items-center ${
                pathname === item.path 
                  ? 'bg-primary text-primary-foreground' 
                  : 'text-foreground hover:bg-muted'
              }`}
            >
              {item.icon}
              <span className="mt-1">{item.label}</span>
            </Link>
          ))}
        </div>
      </div>
    </nav>
  );
} 