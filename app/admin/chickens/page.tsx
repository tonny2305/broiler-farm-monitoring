'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Edit, Plus, Trash2 } from 'lucide-react';
import { onValue, remove, ref } from 'firebase/database';
import { getChickenDataRef, getFirebaseDatabase } from '@/lib/firebase';
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@/components/ui/alert-dialog';

interface ChickenBatch {
  id: string;
  hatchDate: string;
  quantity: number;
  notes?: string;
  createdAt: number;
  ageInDays: number;
}

export default function ChickensPage() {
  const [chickenBatches, setChickenBatches] = useState<ChickenBatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [batchToDelete, setBatchToDelete] = useState<string | null>(null);

  useEffect(() => {
    const chickenRef = getChickenDataRef();
    const unsubscribe = onValue(chickenRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const batches: ChickenBatch[] = [];
        Object.keys(data).forEach(key => {
          const batch = data[key];
          const hatchDate = new Date(batch.hatchDate);
          const today = new Date();
          const ageInDays = Math.floor((today.getTime() - hatchDate.getTime()) / (1000 * 60 * 60 * 24));
          
          batches.push({
            id: key,
            hatchDate: batch.hatchDate,
            quantity: batch.quantity,
            notes: batch.notes,
            createdAt: batch.createdAt || 0,
            ageInDays
          });
        });
        
        // Urutkan berdasarkan tanggal menetas (terbaru di atas)
        batches.sort((a, b) => new Date(b.hatchDate).getTime() - new Date(a.hatchDate).getTime());
        setChickenBatches(batches);
      } else {
        setChickenBatches([]);
      }
      setLoading(false);
    });
    
    return () => unsubscribe();
  }, []);

  // Fungsi untuk menghapus batch ayam
  const handleDeleteBatch = async () => {
    if (!batchToDelete) return;
    
    try {
      const database = getFirebaseDatabase();
      const batchRef = ref(database, `chicken_data/${batchToDelete}`);
      await remove(batchRef);
      setBatchToDelete(null);
      setDeleteDialogOpen(false);
    } catch (error) {
      console.error('Error menghapus batch:', error);
    }
  };

  // Fungsi untuk membuka dialog konfirmasi penghapusan
  const openDeleteDialog = (batchId: string) => {
    setBatchToDelete(batchId);
    setDeleteDialogOpen(true);
  };

  // Fungsi untuk format tanggal Indonesia
  const formatDate = (dateString: string) => {
    const options: Intl.DateTimeFormatOptions = { 
      day: 'numeric', 
      month: 'long', 
      year: 'numeric' 
    };
    return new Date(dateString).toLocaleDateString('id-ID', options);
  };

  // Fungsi untuk mendapatkan status batch berdasarkan usia
  const getBatchStatus = (ageInDays: number) => {
    if (ageInDays < 0) return 'pending';
    if (ageInDays < 7) return 'starter';
    if (ageInDays < 21) return 'grower';
    if (ageInDays < 35) return 'finisher';
    return 'ready';
  };

  // Fungsi untuk mendapatkan label status
  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'pending':
        return 'Belum Menetas';
      case 'starter':
        return 'Starter (0-7 hari)';
      case 'grower':
        return 'Grower (8-21 hari)';
      case 'finisher':
        return 'Finisher (22-35 hari)';
      case 'ready':
        return 'Siap Panen (>35 hari)';
      default:
        return 'Tidak Diketahui';
    }
  };

  // Fungsi untuk mendapatkan warna status
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-gray-200 text-gray-800';
      case 'starter':
        return 'bg-blue-100 text-blue-800';
      case 'grower':
        return 'bg-green-100 text-green-800';
      case 'finisher':
        return 'bg-yellow-100 text-yellow-800';
      case 'ready':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold tracking-tight">Data Batch Ayam</h1>
        <Button asChild>
          <Link href="/admin/chickens/add">
            <Plus className="mr-2 h-4 w-4" /> Tambah Batch Baru
          </Link>
        </Button>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle>Daftar Batch</CardTitle>
          <CardDescription>
            Menampilkan semua batch ayam yang telah ditambahkan
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-8 text-center">
              <p>Memuat data...</p>
            </div>
          ) : chickenBatches.length === 0 ? (
            <div className="py-8 text-center">
              <p>Belum ada data batch ayam yang ditambahkan</p>
              <Button asChild className="mt-4">
                <Link href="/admin/chickens/add">
                  <Plus className="mr-2 h-4 w-4" /> Tambah Batch Baru
                </Link>
              </Button>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID Batch</TableHead>
                    <TableHead>Tanggal Menetas</TableHead>
                    <TableHead>Jumlah Ayam</TableHead>
                    <TableHead>Usia</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {chickenBatches.map((batch) => {
                    const status = getBatchStatus(batch.ageInDays);
                    return (
                      <TableRow key={batch.id}>
                        <TableCell className="font-medium">
                          <Link href={`/admin/chickens/${batch.id}`} className="hover:underline">
                            {batch.id.slice(-6)}
                          </Link>
                        </TableCell>
                        <TableCell>{formatDate(batch.hatchDate)}</TableCell>
                        <TableCell>{batch.quantity} ekor</TableCell>
                        <TableCell>{batch.ageInDays} hari</TableCell>
                        <TableCell>
                          <Badge className={getStatusColor(status)} variant="outline">
                            {getStatusLabel(status)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end space-x-2">
                            <Button variant="ghost" size="icon" asChild>
                              <Link href={`/admin/chickens/${batch.id}/edit`}>
                                <Edit className="h-4 w-4" />
                              </Link>
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon"
                              onClick={() => openDeleteDialog(batch.id)}
                            >
                              <Trash2 className="h-4 w-4 text-red-500" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* Dialog konfirmasi hapus */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus batch ayam?</AlertDialogTitle>
            <AlertDialogDescription>
              Tindakan ini tidak dapat dibatalkan. Data batch ini akan dihapus secara permanen.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteBatch}
              className="bg-red-500 hover:bg-red-600"
            >
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
} 