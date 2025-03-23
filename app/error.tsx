'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
      <h2 className="text-xl font-semibold">Terjadi Kesalahan</h2>
      <p className="text-muted-foreground">Maaf, terjadi kesalahan saat memuat halaman.</p>
      <Button onClick={reset}>Coba Lagi</Button>
    </div>
  );
} 