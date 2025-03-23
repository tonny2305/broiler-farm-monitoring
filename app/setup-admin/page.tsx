'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { getFirebaseDatabase } from '@/lib/firebase';
import { ref, set } from 'firebase/database';
import { toast } from 'sonner';
import Link from 'next/link';

export default function PublicAdminSetupPage() {
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSettingUpTonny, setIsSettingUpTonny] = useState(false);
  const [isSettingUpYobel, setIsSettingUpYobel] = useState(false);

  const setupTonny = async () => {
    setIsSettingUpTonny(true);
    setIsLoading(true);
    setError(null);
    setSuccess(null);
    
    try {
      // Simpan info admin Tonny ke database
      await set(ref(getFirebaseDatabase(), `users/f8Hx0UxpbpUmwr2QwoFAs7ZxWGE2`), {
        email: "tonny.wahyu.aji.student@stmkg.ac.id",
        displayName: "Tonny Wahyu Aji",
        role: "admin",
        createdAt: Date.now()
      });
      
      setSuccess(`Akun Tonny berhasil ditetapkan sebagai admin!`);
      toast.success('Setup admin Tonny berhasil!');
    } catch (err: any) {
      console.error('Error saat setup admin:', err);
      const errorMessage = err.message || 'Gagal setup admin. Silakan coba lagi.';
      setError(errorMessage);
      toast.error('Setup gagal: ' + errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const setupYobel = async () => {
    setIsSettingUpYobel(true);
    setIsLoading(true);
    setError(null);
    setSuccess(null);
    
    try {
      // Simpan info admin Yobel ke database
      await set(ref(getFirebaseDatabase(), `users/6HDawhhbJiUO0G2AxlxgJqrjuPj2`), {
        email: "yobel.em69@gmail.com",
        displayName: "Yobel",
        role: "admin",
        createdAt: Date.now()
      });
      
      setSuccess(`Akun Yobel berhasil ditetapkan sebagai admin!`);
      toast.success('Setup admin Yobel berhasil!');
    } catch (err: any) {
      console.error('Error saat setup admin:', err);
      const errorMessage = err.message || 'Gagal setup admin. Silakan coba lagi.';
      setError(errorMessage);
      toast.error('Setup gagal: ' + errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container mx-auto flex justify-center items-center min-h-screen p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center">Setup Admin Pengguna</CardTitle>
          <CardDescription className="text-center">
            Tetapkan peran admin untuk akun yang sudah ada
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertTitle>Setup Gagal</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          {success && (
            <Alert variant="default" className="bg-green-50 text-green-800 border-green-200">
              <AlertTitle>Berhasil</AlertTitle>
              <AlertDescription>{success}</AlertDescription>
            </Alert>
          )}
          
          <div className="space-y-4">
            <div className="border p-4 rounded-lg">
              <h3 className="font-medium mb-2">Akun Tonny</h3>
              <p className="text-sm text-muted-foreground mb-2">UID: f8Hx0UxpbpUmwr2QwoFAs7ZxWGE2</p>
              <p className="text-sm text-muted-foreground mb-4">Email: tonny.wahyu.aji.student@stmkg.ac.id</p>
              <Button 
                onClick={setupTonny} 
                disabled={isLoading || isSettingUpTonny && success}
                className="w-full"
              >
                {isLoading && isSettingUpTonny ? 'Memproses...' : isSettingUpTonny && success ? 'Berhasil' : 'Tetapkan Sebagai Admin'}
              </Button>
            </div>
            
            <div className="border p-4 rounded-lg">
              <h3 className="font-medium mb-2">Akun Yobel</h3>
              <p className="text-sm text-muted-foreground mb-2">UID: 6HDawhhbJiUO0G2AxlxgJqrjuPj2</p>
              <p className="text-sm text-muted-foreground mb-4">Email: yobel.em69@gmail.com</p>
              <Button 
                onClick={setupYobel} 
                disabled={isLoading || isSettingUpYobel && success}
                className="w-full"
              >
                {isLoading && isSettingUpYobel ? 'Memproses...' : isSettingUpYobel && success ? 'Berhasil' : 'Tetapkan Sebagai Admin'}
              </Button>
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex flex-col space-y-4">
          <Button asChild variant="outline" className="w-full">
            <Link href="/login">
              Kembali ke Login
            </Link>
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
} 