'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { CalendarIcon, Loader2 } from 'lucide-react';
import { 
  Popover,
  PopoverContent,
  PopoverTrigger 
} from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { addChickenBatch } from '@/lib/firebase';
import { useToast } from '@/components/ui/use-toast';

export default function AddChickenBatchPage() {
  const router = useRouter();
  const { toast } = useToast();
  
  const [date, setDate] = useState<Date | undefined>();
  const [quantity, setQuantity] = useState<number>(0);
  const [notes, setNotes] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!date) {
      toast({
        title: "Kesalahan Input",
        description: "Tanggal menetas harus diisi.",
        variant: "destructive"
      });
      return;
    }
    
    if (quantity <= 0) {
      toast({
        title: "Kesalahan Input",
        description: "Jumlah ayam harus lebih dari 0.",
        variant: "destructive"
      });
      return;
    }
    
    setLoading(true);
    
    try {
      const formattedDate = format(date, 'yyyy-MM-dd');
      
      await addChickenBatch({
        hatchDate: formattedDate,
        quantity,
        notes: notes.trim() || undefined
      });
      
      toast({
        title: "Berhasil",
        description: "Batch ayam baru telah ditambahkan.",
      });
      
      router.push('/admin/chickens');
    } catch (error) {
      console.error('Error saat menambahkan batch:', error);
      toast({
        title: "Gagal",
        description: "Terjadi kesalahan saat menambahkan batch. Silakan coba lagi.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Tambah Batch Ayam Baru</h1>
      </div>
      
      <Card>
        <form onSubmit={handleSubmit}>
          <CardHeader>
            <CardTitle>Informasi Batch</CardTitle>
            <CardDescription>
              Masukkan informasi tentang batch ayam baru
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="hatch-date">Tanggal Menetas</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !date && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {date ? format(date, 'PPP', { locale: id }) : "Pilih tanggal"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={date}
                    onSelect={setDate}
                    initialFocus
                    locale={id}
                  />
                </PopoverContent>
              </Popover>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="quantity">Jumlah Ayam (ekor)</Label>
              <Input
                id="quantity"
                type="number"
                min="1"
                value={quantity || ''}
                onChange={(e) => setQuantity(Number(e.target.value))}
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="notes">Catatan (opsional)</Label>
              <Textarea
                id="notes"
                placeholder="Tambahkan catatan tentang batch ini"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </CardContent>
          <CardFooter className="flex justify-between">
            <Button variant="outline" asChild>
              <Link href="/admin/chickens">Batal</Link>
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {loading ? 'Menyimpan...' : 'Simpan Batch'}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
} 