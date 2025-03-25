'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { loginWithEmailAndPassword, getCurrentUser, isUserAdmin } from '@/lib/firebase';
import { EyeIcon, EyeOffIcon } from 'lucide-react';
import { toast } from 'sonner';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const router = useRouter();

  // Cek apakah user sudah login saat komponen dimuat
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const user = await getCurrentUser();
        
        // Jika user sudah login, periksa apakah dia admin
        if (user) {
          const admin = await isUserAdmin(user);
          // Jika admin, langsung alihkan ke dashboard
          if (admin) {
            console.log('User sudah login sebagai admin, mengalihkan ke dashboard');
            router.replace('/admin/dashboard');
          }
        }
      } catch (error) {
        console.error('Error saat memeriksa autentikasi:', error);
      }
    };
    
    checkAuth();
  }, [router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const user = await loginWithEmailAndPassword(email, password);
      console.log('Login berhasil dengan user:', user.uid);
      
      // Verifikasi peran admin
      const admin = await isUserAdmin(user);
      
      if (!admin) {
        setError('Akun Anda tidak memiliki akses admin.');
        toast.error('Akun Anda tidak memiliki akses admin.');
        setIsLoading(false);
        return;
      }

      setSuccess('Login berhasil! Mengalihkan ke dashboard admin...');
      toast.success('Login berhasil!');
      
      // Berikan sedikit waktu untuk menampilkan pesan sukses
      setTimeout(() => {
        // Gunakan replace alih-alih push untuk menghindari navigasi kembali
        router.replace('/admin/dashboard');
      }, 1500);
    } catch (err: any) {
      console.error('Error saat login:', err);
      const errorMessage = err.message || 'Gagal login. Silakan coba lagi.';
      setError(errorMessage);
      toast.error('Login gagal: ' + errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container mx-auto flex justify-center items-center min-h-screen p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center">Masuk</CardTitle>
          <CardDescription className="text-center">
            Masukkan email dan password Anda untuk akses dashboard admin
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleLogin}>
          <CardContent className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertTitle>Login Gagal</AlertTitle>
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
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="admin@peternakan.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
              </div>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full px-3"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOffIcon className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-4 mt-4">
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? 'Memproses...' : 'Masuk'}
            </Button>
            <Link href="/" className="text-primary hover:underline text-center text-sm w-full">
              Kembali ke halaman utama
            </Link>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
} 