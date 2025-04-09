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
  
  const [date, setDate] = useState<string>('');
  const [quantity, setQuantity] = useState<number>(0);
  const [notes, setNotes] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [averageWeight, setAverageWeight] = useState<number | null>(null);
  const [deaths, setDeaths] = useState<number | null>(null);
  const [feedAmount, setFeedAmount] = useState<number | null>(null);
  const [feedType, setFeedType] = useState<string>('');
  const [waterStatus, setWaterStatus] = useState<'OK' | 'NOT OK'>('OK');

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
      // Persiapkan data batch, hanya sertakan field yang memiliki nilai (tidak null)
      const batchData: any = {
        hatchDate: date,
        quantity,
        lastUpdated: Date.now()
      };
      
      // Tambahkan field opsional hanya jika memiliki nilai
      if (notes.trim()) batchData.notes = notes.trim();
      if (averageWeight !== null) batchData.averageWeight = averageWeight;
      if (deaths !== null) batchData.deaths = deaths;
      if (feedAmount !== null) batchData.feedAmount = feedAmount;
      if (feedType.trim()) batchData.feedType = feedType.trim();
      batchData.waterStatus = waterStatus;
      
      console.log("Mencoba menambahkan batch baru dengan data:", batchData);
      
      const batchId = await addChickenBatch(batchData);
      
      console.log("Batch berhasil ditambahkan dengan ID:", batchId);
      
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
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Kolom Kiri */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="hatch-date">Tanggal Menetas</Label>
                  <Input
                    id="hatch-date"
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    required
                    className="w-full"
                  />
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
                    className="w-full"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="averageWeight">Berat Rata-rata (kg)</Label>
                  <Input
                    id="averageWeight"
                    type="number"
                    step="0.1"
                    min="0"
                    value={averageWeight === null ? '' : averageWeight.toString()}
                    onChange={(e) => setAverageWeight(e.target.value ? Number(e.target.value) : null)}
                    className="w-full"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="deaths">Jumlah Kematian (ekor)</Label>
                  <Input
                    id="deaths"
                    type="number"
                    min="0"
                    value={deaths === null ? '' : deaths.toString()}
                    onChange={(e) => setDeaths(e.target.value ? Number(e.target.value) : null)}
                    className="w-full"
                  />
                </div>
              </div>

              {/* Kolom Kanan */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="feedAmount">Jumlah Pakan (kg)</Label>
                  <Input
                    id="feedAmount"
                    type="number"
                    step="0.1"
                    min="0"
                    value={feedAmount === null ? '' : feedAmount.toString()}
                    onChange={(e) => setFeedAmount(e.target.value ? Number(e.target.value) : null)}
                    className="w-full"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="feedType">Jenis Pakan</Label>
                  <Input
                    id="feedType"
                    type="text"
                    value={feedType}
                    onChange={(e) => setFeedType(e.target.value)}
                    placeholder="Contoh: BR1, BR2, dll"
                    className="w-full"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="waterStatus">Status Air</Label>
                  <select
                    id="waterStatus"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    value={waterStatus}
                    onChange={(e) => setWaterStatus(e.target.value as 'OK' | 'NOT OK')}
                  >
                    <option value="OK">OK</option>
                    <option value="NOT OK">NOT OK</option>
                  </select>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="notes">Catatan (opsional)</Label>
                  <Textarea
                    id="notes"
                    placeholder="Tambahkan catatan tentang batch ini"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full min-h-[100px]"
                  />
                </div>
              </div>
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