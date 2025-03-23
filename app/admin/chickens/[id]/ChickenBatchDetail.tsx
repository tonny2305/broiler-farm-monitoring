'use client';


import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Edit, Trash2, ChevronLeft, Calendar, Users, Clock, AlertTriangle, FileText, Loader2 } from 'lucide-react';
import { format, parse } from 'date-fns';
import { id } from 'date-fns/locale';
import { onValue, ref, remove } from 'firebase/database';
import { getFirebaseDatabase } from '@/lib/firebase';
import { useToast } from '@/components/ui/use-toast';
import { useRouter } from 'next/navigation';
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger 
} from '@/components/ui/alert-dialog';

interface ChickenBatch {
  hatchDate: string;
  quantity: number;
  notes?: string;
  createdAt: number;
  ageInDays: number;
}

export default function ChickenBatchDetail({ params }: { params: { id: string } }) {
  const router = useRouter();
  const { toast } = useToast();
  const { id } = use(Promise.resolve(params));
  
  const [batch, setBatch] = useState<ChickenBatch | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<boolean>(false);

  useEffect(() => {
    const fetchBatchData = async () => {
      try {
        const database = getFirebaseDatabase();
        const batchRef = ref(database, `chicken_data/${id}`);
        
        onValue(batchRef, (snapshot) => {
          const data = snapshot.val();
          if (data) {
            // Hitung usia batch
            const hatchDate = new Date(data.hatchDate);
            const today = new Date();
            const ageInDays = Math.floor((today.getTime() - hatchDate.getTime()) / (1000 * 60 * 60 * 24));
            
            setBatch({
              ...data,
              ageInDays
            });
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

  const handleDelete = async () => {
    setDeleting(true);
    
    try {
      const database = getFirebaseDatabase();
      const batchRef = ref(database, `chicken_data/${id}`);
      
      await remove(batchRef);
      
      toast({
        title: "Berhasil",
        description: "Batch ayam telah dihapus.",
      });
      
      router.push('/admin/chickens');
    } catch (error) {
      console.error('Error saat menghapus batch:', error);
      toast({
        title: "Gagal",
        description: "Terjadi kesalahan saat menghapus batch. Silakan coba lagi.",
        variant: "destructive"
      });
      setDeleting(false);
    }
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

  // Format tanggal
  const formatDate = (dateString: string) => {
    const options: Intl.DateTimeFormatOptions = { 
      day: 'numeric', 
      month: 'long', 
      year: 'numeric' 
    };
    return new Date(dateString).toLocaleDateString('id-ID', options);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (error || !batch) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold tracking-tight">Detail Batch Ayam</h1>
        </div>
        
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-10">
              <p className="text-red-500 mb-4">{error || 'Data tidak tersedia'}</p>
              <Button asChild>
                <Link href="/admin/chickens">Kembali ke Daftar Batch</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const status = getBatchStatus(batch.ageInDays);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Button variant="outline" size="icon" asChild>
            <Link href="/admin/chickens">
              <ChevronLeft className="h-4 w-4" />
            </Link>
          </Button>
          <h1 className="text-2xl font-bold tracking-tight">Detail Batch #{id.slice(-6)}</h1>
        </div>
        
        <div className="flex space-x-2">
          
          
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm">
                <Trash2 className="mr-2 h-4 w-4" />
                Hapus
              </Button>
            </AlertDialogTrigger>
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
                  onClick={handleDelete}
                  className="bg-red-500 hover:bg-red-600"
                  disabled={deleting}
                >
                  {deleting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Menghapus...
                    </>
                  ) : (
                    <>Hapus</>
                  )}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Informasi Batch</CardTitle>
            <CardDescription>
              Informasi detail mengenai batch ayam ini
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="flex flex-col space-y-1">
                <span className="text-sm text-muted-foreground">ID Batch</span>
                <span className="font-medium">{id}</span>
              </div>
              
              <div className="flex flex-col space-y-1">
                <span className="text-sm text-muted-foreground">Status</span>
                <Badge className={`self-start ${getStatusColor(status)}`} variant="outline">
                  {getStatusLabel(status)}
                </Badge>
              </div>
              
              <div className="flex items-start space-x-2">
                <Calendar className="h-5 w-5 text-primary mt-1" />
                <div className="flex flex-col">
                  <span className="text-sm font-medium">Tanggal Menetas</span>
                  <span>{formatDate(batch.hatchDate)}</span>
                </div>
              </div>
              
              <div className="flex items-start space-x-2">
                <Users className="h-5 w-5 text-primary mt-1" />
                <div className="flex flex-col">
                  <span className="text-sm font-medium">Jumlah Ayam</span>
                  <span>{batch.quantity} ekor</span>
                </div>
              </div>
              
              <div className="flex items-start space-x-2">
                <Clock className="h-5 w-5 text-primary mt-1" />
                <div className="flex flex-col">
                  <span className="text-sm font-medium">Usia</span>
                  <span>{batch.ageInDays} hari</span>
                </div>
              </div>
              
              <div className="flex items-start space-x-2">
                <AlertTriangle className="h-5 w-5 text-primary mt-1" />
                <div className="flex flex-col">
                  <span className="text-sm font-medium">Perkiraan Panen</span>
                  <span>
                    {batch.ageInDays >= 35 ? (
                      <span className="text-red-500">Siap panen sekarang</span>
                    ) : (
                      <span>Sekitar {Math.max(0, 35 - batch.ageInDays)} hari lagi</span>
                    )}
                  </span>
                </div>
              </div>
            </div>
            
            {batch.notes && (
              <div className="pt-4 border-t">
                <div className="flex items-start space-x-2">
                  <FileText className="h-5 w-5 text-primary mt-1" />
                  <div className="flex flex-col">
                    <span className="text-sm font-medium">Catatan</span>
                    <p className="mt-1 whitespace-pre-wrap">{batch.notes}</p>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>Aksi</CardTitle>
            <CardDescription>
              Tindakan lanjutan untuk batch ini
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button className="w-full" asChild>
              <Link href={`/admin/export?batch=${id}`}>
                Ekspor Data Batch
              </Link>
            </Button>
            
            <Button variant="outline" className="w-full" asChild>
              <Link href={`/admin/chickens/${id}/edit`}>
                Edit Informasi
              </Link>
            </Button>
            
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" className="w-full">
                  Hapus Batch
                </Button>
              </AlertDialogTrigger>
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
                    onClick={handleDelete}
                    className="bg-red-500 hover:bg-red-600"
                    disabled={deleting}
                  >
                    {deleting ? 'Menghapus...' : 'Hapus'}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardContent>
        </Card>
      </div>
    </div>
  );
} 