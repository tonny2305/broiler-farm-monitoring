'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { getFirebaseDatabase, getFirebaseAuth, getUsersRef } from '@/lib/firebase';
import { ref, set } from 'firebase/database';
import { toast } from 'sonner';

export default function AdminSetupPage() {
  const [uid, setUid] = useState('');
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSetupAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setSuccess(null);

    if (!uid || !email || !displayName) {
      setError('Semua field harus diisi');
      setIsLoading(false);
      return;
    }

    try {
      // Simpan info admin ke database
      await set(ref(getFirebaseDatabase(), `users/${uid}`), {
        email,
        displayName,
        role: 'admin',
        createdAt: Date.now()
      });
      
      setSuccess(`Akun ${email} berhasil ditetapkan sebagai admin!`);
      toast.success('Setup admin berhasil!');
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
          <CardTitle className="text-2xl font-bold text-center">Setup Admin</CardTitle>
          <CardDescription className="text-center">
            Tetapkan peran admin untuk akun yang sudah ada
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSetupAdmin}>
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
            <div className="space-y-2">
              <Label htmlFor="uid">User ID (UID)</Label>
              <Input
                id="uid"
                placeholder="User ID dari Firebase Authentication"
                value={uid}
                onChange={(e) => setUid(e.target.value)}
                required
              />
              <p className="text-xs text-muted-foreground">
                UID dapat dilihat di Firebase Console &gt; Authentication &gt; Users
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="Email pengguna"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="displayName">Nama Admin</Label>
              <Input
                id="displayName"
                placeholder="Nama yang ditampilkan"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                required
              />
            </div>
          </CardContent>
          <CardFooter className="flex flex-col space-y-4">
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? 'Memproses...' : 'Tetapkan Sebagai Admin'}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
} 