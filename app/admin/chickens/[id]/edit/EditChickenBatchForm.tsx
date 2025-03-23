'use client';

import { useState, useEffect } from 'react';
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
import { format, parse } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { onValue, ref, set } from 'firebase/database';
import { getFirebaseDatabase } from '@/lib/firebase';
import { useToast } from '@/components/ui/use-toast';

interface ChickenBatch {
  hatchDate: string;
  quantity: number;
  notes?: string;
  createdAt: number;
}

interface EditChickenBatchFormProps {
  id: string;
}

export default function EditChickenBatchForm({ id }: EditChickenBatchFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  
  const [date, setDate] = useState<Date | undefined>();
  const [quantity, setQuantity] = useState<number>(0);
  const [notes, setNotes] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchBatchData = async () => {
      try {
        const database = getFirebaseDatabase();
        const batchRef = ref(database, `chicken_data/${id}`);
        
        onValue(batchRef, (snapshot) => {
          const data = snapshot.val();
          if (data) {
            if (data.hatchDate) {
              const parsedDate = parse(data.hatchDate, 'yyyy-MM-dd', new Date());
              setDate(parsedDate);
            }
            
            setQuantity(data.quantity || 0);
            setNotes(data.notes || '');
            setLoading(false);
          } else {
            setError('Batch data tidak ditemukan');
            setLoading(false);
          }
        }, {
          onlyOnce: true
        });
      } catch (error) {
        console.error('Error mengambil data batch:', error);
        setError('Gagal mengambil data batch');
        setLoading(false);
      }
    };
    
    fetchBatchData();
  }, [id]);

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
    
    setSaving(true);
    
    try {
      const database = getFirebaseDatabase();
      const batchRef = ref(database, `chicken_data/${id}`);
      
      await set(batchRef, {
        hatchDate: format(date, 'yyyy-MM-dd'),
        quantity,
        notes: notes.trim() || null,
        createdAt: Date.now(),
      });
      
      toast({
        title: "Berhasil",
        description: "Data batch ayam berhasil diperbarui.",
      });
      
      router.push('/admin/chickens');
    } catch (error) {
      console.error('Error saat memperbarui batch:', error);
      toast({
        title: "Gagal",
        description: "Terjadi kesalahan saat memperbarui data batch. Silakan coba lagi.",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  const formatDate = (date: Date | undefined) => {
    if (!date) return '';
    try {
      return format(date, 'PPP', { locale: idLocale });
    } catch (error) {
      return '';
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold tracking-tight">Edit Batch Ayam</h1>
        </div>
        
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-10">
              <p className="text-red-500 mb-4">{error}</p>
              <Button asChild>
                <Link href="/admin/chickens">Kembali ke Daftar Batch</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Edit Batch Ayam</h1>
      </div>
      
      <Card>
        <form onSubmit={handleSubmit}>
          <CardHeader>
            <CardTitle>Perbarui Informasi Batch</CardTitle>
            <CardDescription>Edit informasi batch ayam ini</CardDescription>
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
                    {date ? formatDate(date) : "Pilih tanggal"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={date}
                    onSelect={setDate}
                    initialFocus
                    locale={idLocale}
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
                value={quantity}
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
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {saving ? 'Menyimpan...' : 'Simpan Perubahan'}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
} 