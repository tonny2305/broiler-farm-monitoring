'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, ChevronLeft } from 'lucide-react';
import { format, parse } from 'date-fns';
import { cn } from '@/lib/utils';
import { onValue, ref, set } from 'firebase/database';
import { getFirebaseDatabase, updateChickenBatch, updateDailyProgress } from '@/lib/firebase';
import { useToast } from '@/components/ui/use-toast';

interface ChickenBatch {
  hatchDate: string;
  quantity: number;
  notes?: string;
  createdAt: number;
  averageWeight?: number;
  deaths?: number;
  feedAmount?: number;
  feedType?: string;
  waterStatus?: 'OK' | 'NOT OK';
  lastUpdated?: number;
}

interface EditChickenBatchFormProps {
  id: string;
}

export default function EditChickenBatchForm({ id }: EditChickenBatchFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  
  const [date, setDate] = useState<string>('');
  const [quantity, setQuantity] = useState<number>(0);
  const [notes, setNotes] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [averageWeight, setAverageWeight] = useState<number>(0);
  const [deaths, setDeaths] = useState<number>(0);
  const [feedAmount, setFeedAmount] = useState<number>(0);
  const [feedType, setFeedType] = useState<string>('');
  const [waterStatus, setWaterStatus] = useState<'OK' | 'NOT OK'>('OK');
  const [batch, setBatch] = useState<ChickenBatch | null>(null);
  const [initialQuantity, setInitialQuantity] = useState<number>(0);
  const [initialDeaths, setInitialDeaths] = useState<number>(0);

  useEffect(() => {
    const fetchBatchData = async () => {
      try {
        console.log('Fetching batch data for edit, ID:', id);
        const database = getFirebaseDatabase();
        const batchRef = ref(database, `chicken_data/${id}`);
        
        onValue(batchRef, (snapshot) => {
          const data = snapshot.val();
          console.log('Edit form received data:', data);
          
          if (data) {
            if (data.hatchDate) {
              setDate(data.hatchDate);
            }
            
            setQuantity(data.quantity || 0);
            setInitialQuantity(data.quantity || 0);
            setInitialDeaths(data.deaths || 0);
            setNotes(data.notes || '');
            setAverageWeight(data.averageWeight || 0);
            setDeaths(data.deaths || 0);
            setFeedAmount(data.feedAmount || 0);
            setFeedType(data.feedType || '');
            setWaterStatus(data.waterStatus || 'OK');
            setBatch(data as ChickenBatch);
            setLoading(false);
          } else {
            console.error('Batch data not found for edit, ID:', id);
            setError('Batch data tidak ditemukan');
            setLoading(false);
            router.push('/admin/chickens');
          }
        }, (error) => {
          console.error('Firebase onValue error in edit form:', error);
          setError('Terjadi kesalahan saat mengambil data');
          setLoading(false);
          router.push('/admin/chickens');
        });
      } catch (error) {
        console.error('Error mengambil data batch untuk edit:', error);
        setError('Gagal mengambil data batch');
        setLoading(false);
        router.push('/admin/chickens');
      }
    };
    
    if (id) {
      fetchBatchData();
    } else {
      setError('ID batch tidak valid');
      setLoading(false);
      router.push('/admin/chickens');
    }
  }, [id, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Validasi tanggal menetas
      if (!date) {
        toast({
          title: "Error",
          description: "Tanggal menetas harus diisi",
          variant: "destructive"
        });
        return;
      }

      // Hitung perubahan kematian
      const currentDeaths = deaths || 0;
      const previousDeaths = initialDeaths;
      const deathChange = currentDeaths - previousDeaths;
      
      // Hitung jumlah ayam yang seharusnya
      const expectedQuantity = initialQuantity - currentDeaths;
      
      // Jika jumlah ayam yang diinput berbeda dengan yang seharusnya, beri peringatan
      if (quantity !== expectedQuantity) {
        const confirmed = window.confirm(
          `Jumlah ayam yang diinput (${quantity}) berbeda dengan perhitungan otomatis (${expectedQuantity}).\n` +
          `Apakah Anda yakin ingin menggunakan jumlah ayam yang diinput?`
        );
        
        if (!confirmed) {
          // Jika tidak dikonfirmasi, gunakan perhitungan otomatis
          setQuantity(expectedQuantity);
        }
      }
      
      // Update data batch
      const updatedBatch = {
        hatchDate: date,
        quantity: quantity,
        deaths: currentDeaths,
        averageWeight: averageWeight,
        feedAmount: feedAmount,
        feedType: feedType,
        waterStatus: waterStatus,
        notes: notes,
        updatedAt: new Date().toISOString()
      };

      // Update data di Firebase
      await updateChickenBatch(id, updatedBatch);

      // Update data progress harian jika ada perubahan kematian
      if (deathChange !== 0) {
        await updateDailyProgress(id, true);
      }

      toast({
        title: "Sukses",
        description: "Data batch ayam berhasil diperbarui"
      });

      router.push(`/admin/chickens/${id}`);
    } catch (error) {
      console.error('Error updating chicken batch:', error);
      toast({
        title: "Error",
        description: "Gagal memperbarui data batch ayam",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  // Tambahkan useEffect untuk mengupdate quantity otomatis saat deaths berubah
  useEffect(() => {
    if (deaths !== initialDeaths) {
      const newQuantity = initialQuantity - deaths;
      setQuantity(newQuantity);
    }
  }, [deaths, initialDeaths, initialQuantity]);

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
      <div className="flex items-center space-x-4">
        <Button variant="outline" size="icon" asChild>
          <Link href={`/admin/chickens/${id}`}>
            <ChevronLeft className="h-4 w-4" />
          </Link>
        </Button>
        <h1 className="text-2xl font-bold tracking-tight">Edit Batch Ayam</h1>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle>Form Edit Batch</CardTitle>
          <CardDescription>
            Edit informasi batch ayam
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
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
                    value={averageWeight || ''}
                    onChange={(e) => setAverageWeight(Number(e.target.value))}
                    className="w-full"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="deaths">Jumlah Kematian (ekor)</Label>
                  <Input
                    id="deaths"
                    type="number"
                    min="0"
                    value={deaths || ''}
                    onChange={(e) => setDeaths(Number(e.target.value))}
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
                    value={feedAmount || ''}
                    onChange={(e) => setFeedAmount(Number(e.target.value))}
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
              <Link href={`/admin/chickens/${id}`}>Batal</Link>
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