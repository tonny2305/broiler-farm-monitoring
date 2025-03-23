'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import AdminNavbar from '@/components/admin/AdminNavbar';
import { getCurrentUser, isUserAdmin } from '@/lib/firebase';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const checkAuth = async () => {
      try {
        console.log('Memeriksa autentikasi dalam AdminLayout...');
        const user = await getCurrentUser();
        
        if (!user) {
          console.log('User tidak ditemukan, mengalihkan ke login');
          router.replace('/login');
          return;
        }
        
        console.log('User ditemukan, memeriksa status admin');
        const admin = await isUserAdmin(user);
        
        if (!admin) {
          console.log('User bukan admin, mengalihkan ke login');
          router.replace('/login');
          return;
        }
        
        console.log('User adalah admin, menampilkan halaman admin');
        setAuthorized(true);
      } catch (error) {
        console.error('Error saat memeriksa autentikasi:', error);
        router.replace('/login');
      } finally {
        setLoading(false);
      }
    };
    
    checkAuth();
  }, [router]);

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <p className="text-lg">Memuat...</p>
      </div>
    );
  }

  if (!authorized) {
    return null; // Router akan mengalihkan, jadi tidak perlu menampilkan apa pun
  }

  return (
    <div className="min-h-screen flex flex-col">
      <AdminNavbar />
      <main className="flex-1 container mx-auto px-4 py-6">
        {children}
      </main>
      <footer className="bg-card border-t py-4">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          &copy; {new Date().getFullYear()} Admin Peternakan Ayam Broiler
        </div>
      </footer>
    </div>
  );
} 