'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Edit, Trash2, ChevronLeft, Calendar, Users, Clock, AlertTriangle, FileText, Loader2, History, LineChart } from 'lucide-react';
import { format, parse } from 'date-fns';
import { id } from 'date-fns/locale';
import { onValue, ref, remove } from 'firebase/database';
import { 
  getFirebaseDatabase, 
  getChickenHistory, 
  getDailyChickenProgress, 
  backfillDailyProgress, 
  updateDailyProgress,
  checkAndCreateDailyEntry,
  checkAndBackfillMissingDays
} from '@/lib/firebase';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface ChickenBatch {
  hatchDate: string;
  quantity: number;
  notes?: string;
  createdAt: number;
  ageInDays: number;
  averageWeight?: number;
  deaths?: number;
  feedAmount?: number;
  feedType?: string;
  waterStatus?: 'OK' | 'NOT OK';
  lastUpdated?: number;
}

interface HistoryEntry {
  id: string;
  timestamp: number;
  previous: {
    averageWeight: number;
    deaths: number;
    feedAmount: number;
    feedType: string;
    waterStatus: string;
    notes?: string;
    quantity?: number;
  };
  current: {
    averageWeight: number;
    deaths: number;
    feedAmount: number;
    feedType: string;
    waterStatus: string;
    notes?: string;
    quantity?: number;
  };
  changeNote: string;
}

interface DailyProgressEntry {
  dateString: string;
  timestamp: number;
  ageInDays: number;
  averageWeight: number;
  deaths: number;
  feedAmount: number;
  feedType: string;
  waterStatus: string;
  notes: string;
  quantity: number;
  manualUpdate: boolean;
  autoBackfilled?: boolean;
}

export default function ChickenBatchDetail({ batchId }: { batchId: string }) {
  const router = useRouter();
  const { toast } = useToast();
  
  console.log('ChickenBatchDetail rendered with ID:', batchId);
  
  const [batch, setBatch] = useState<ChickenBatch | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<boolean>(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loadingHistory, setLoadingHistory] = useState<boolean>(false);
  const [dailyProgress, setDailyProgress] = useState<DailyProgressEntry[]>([]);
  const [loadingDailyProgress, setLoadingDailyProgress] = useState<boolean>(false);
  const [backfilling, setBackfilling] = useState<boolean>(false);
  const [updatingDaily, setUpdatingDaily] = useState<boolean>(false);
  const [redirecting, setRedirecting] = useState<boolean>(false);

  useEffect(() => {
    let isMounted = true;
    
    const fetchBatchData = async () => {
      try {
        const database = getFirebaseDatabase();
        const batchRef = ref(database, `chicken_data/${batchId}`);
        
        console.log('Fetching batch data for ID:', batchId);
        
        onValue(batchRef, (snapshot) => {
          if (!isMounted) return;
          
          const data = snapshot.val();
          console.log('Batch data from Firebase:', data);
          
          if (data) {
            // Hitung usia batch
            const hatchDate = new Date(data.hatchDate);
            const today = new Date();
            const ageInDays = Math.floor((today.getTime() - hatchDate.getTime()) / (1000 * 60 * 60 * 24));
            
            console.log('Setting batch data with age:', ageInDays);
            
            setBatch({
              ...data,
              ageInDays
            });
            setLoading(false);
            
            // Setelah mendapatkan data batch, ambil history
            fetchBatchHistory(batchId);
          } else {
            console.error('Batch data not found for ID:', batchId);
            setError('Batch data tidak ditemukan');
            setLoading(false);
            
            // Data tidak ditemukan, mungkin telah dihapus, redirect ke daftar ayam setelah jeda singkat
            if (isMounted && !redirecting) {
              setRedirecting(true);
              
              toast({
                title: "Batch Tidak Ditemukan",
                description: "Data batch yang Anda cari mungkin telah dihapus. Mengarahkan ke daftar batch...",
                variant: "destructive"
              });
              
              setTimeout(() => {
                if (isMounted) {
                  router.replace('/admin/chickens');
                }
              }, 2000);
            }
          }
        }, (error) => {
          if (!isMounted) return;
          
          console.error('Firebase onValue error:', error);
          setError('Terjadi kesalahan saat mengambil data');
          setLoading(false);
        });
      } catch (error) {
        if (!isMounted) return;
        
        console.error('Error mengambil data batch:', error);
        setError('Gagal mengambil data batch');
        setLoading(false);
      }
    };
    
    const fetchBatchHistory = async (batchId: string) => {
      if (!isMounted) return;
      
      try {
        setLoadingHistory(true);
        console.log('Fetching history for batch:', batchId);
        
        const historyData = await getChickenHistory(batchId);
        console.log('History data received:', historyData?.length || 0, 'entries');
        
        if (isMounted) {
          if (historyData && historyData.length > 0) {
            console.log('Setting history data to state');
            setHistory(historyData);
          } else {
            console.log('No history data found');
            setHistory([]);
          }
          setLoadingHistory(false);
        }
      } catch (error) {
        if (!isMounted) return;
        
        console.error('Error fetching batch history:', error);
        setLoadingHistory(false);
        setHistory([]);
      }
    };

    const fetchDailyProgress = async (batchId: string) => {
      if (!isMounted) return;
      
      try {
        setLoadingDailyProgress(true);
        console.log('Fetching daily progress for batch:', batchId);
        
        // Otomatis membuat entry untuk hari ini jika belum ada
        await checkAndCreateDailyEntry(batchId);
        
        // Otomatis isi 7 hari terakhir (jika ada yang kosong)
        await checkAndBackfillMissingDays(batchId, 7);
        
        // Ambil data progress harian
        const progressData = await getDailyChickenProgress(batchId);
        console.log('Daily progress data received:', progressData?.length || 0, 'entries');
        
        if (isMounted) {
          if (progressData && progressData.length > 0) {
            console.log('Setting daily progress data to state');
            setDailyProgress(progressData);
          } else {
            console.log('No daily progress data found');
            setDailyProgress([]);
          }
          
          setLoadingDailyProgress(false);
        }
      } catch (error) {
        if (!isMounted) return;
        
        console.error('Error fetching daily progress:', error);
        setLoadingDailyProgress(false);
        setDailyProgress([]);
      }
    };
    
    if (batchId) {
      fetchBatchData();
      fetchDailyProgress(batchId);
    } else {
      setError('ID batch tidak valid');
      setLoading(false);
    }
    
    return () => {
      isMounted = false;
    };
  }, [batchId, router]);

  // Fungsi untuk format timestamp
  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp).toLocaleString('id-ID', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Format nilai perubahan
  const formatChangeValue = (prev: number, curr: number) => {
    const diff = curr - prev;
    if (diff === 0) return <span>Tidak ada perubahan</span>;
    return (
      <span className={`font-medium ${diff > 0 ? 'text-green-600' : 'text-red-600'}`}>
        {diff > 0 ? '+' : ''}{diff.toFixed(2)}
      </span>
    );
  };

  const handleDelete = async () => {
    setDeleting(true);
    
    try {
      const database = getFirebaseDatabase();
      const batchRef = ref(database, `chicken_data/${batchId}`);
      
      await remove(batchRef);
      
      toast({
        title: "Berhasil",
        description: "Batch ayam telah dihapus.",
      });
      
      router.replace('/admin/chickens');
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

  const handleBackfill = async () => {
    setBackfilling(true);
    try {
      // Backfill dari tanggal menetas hingga hari ini
      const result = await checkAndBackfillMissingDays(batchId, 365); // 365 hari maksimum
      
      if (result) {
        toast({
          title: "Berhasil",
          description: "Data harian telah diperbarui, dimulai dari tanggal penetasan.",
        });
        // Refresh data harian
        const progressData = await getDailyChickenProgress(batchId);
        setDailyProgress(progressData);
      } else {
        toast({
          title: "Gagal",
          description: "Terjadi kesalahan saat memperbarui data harian.",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Error saat backfill:', error);
      toast({
        title: "Gagal",
        description: "Terjadi kesalahan saat memperbarui data harian.",
        variant: "destructive"
      });
    } finally {
      setBackfilling(false);
    }
  };

  const handleUpdateToday = async () => {
    setUpdatingDaily(true);
    try {
      const result = await updateDailyProgress(batchId, true);
      if (result) {
        toast({
          title: "Berhasil",
          description: "Data harian untuk hari ini telah diperbarui.",
        });
        // Refresh data harian
        const progressData = await getDailyChickenProgress(batchId);
        setDailyProgress(progressData);
      } else {
        toast({
          title: "Gagal",
          description: "Terjadi kesalahan saat memperbarui data harian.",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Error saat update daily:', error);
      toast({
        title: "Gagal",
        description: "Terjadi kesalahan saat memperbarui data harian.",
        variant: "destructive"
      });
    } finally {
      setUpdatingDaily(false);
    }
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

  if (loadingHistory) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <div className="flex flex-col items-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Memuat riwayat perubahan...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Button variant="outline" size="icon" asChild>
            <Link href="/admin/chickens">
              <ChevronLeft className="h-4 w-4" />
            </Link>
          </Button>
          <h1 className="text-2xl font-bold tracking-tight">Detail Batch #{batchId.slice(-6)}</h1>
        </div>
        
        <div className="flex space-x-2">
          <Button variant="outline" size="sm" asChild>
            <Link href={`/admin/chickens/${batchId}/edit`}>
              <Edit className="mr-2 h-4 w-4" />
              Edit
            </Link>
          </Button>
          
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
      
      <Tabs defaultValue="info">
        <TabsList className="grid grid-cols-3 w-[450px]">
          <TabsTrigger value="info">Informasi</TabsTrigger>
          <TabsTrigger value="history">Riwayat Perubahan</TabsTrigger>
          <TabsTrigger value="daily">Perkembangan Harian</TabsTrigger>
        </TabsList>
        
        <TabsContent value="info">
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
                    <span className="font-medium">{batchId}</span>
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

                  {batch.averageWeight !== undefined && (
                    <div className="flex items-start space-x-2">
                      <div className="h-5 w-5 text-primary mt-1 flex items-center justify-center">⚖️</div>
                      <div className="flex flex-col">
                        <span className="text-sm font-medium">Berat Rata-rata</span>
                        <span>{batch.averageWeight} kg</span>
                      </div>
                    </div>
                  )}

                  {batch.deaths !== undefined && (
                    <div className="flex items-start space-x-2">
                      <div className="h-5 w-5 text-primary mt-1 flex items-center justify-center">💀</div>
                      <div className="flex flex-col">
                        <span className="text-sm font-medium">Jumlah Kematian</span>
                        <span>{batch.deaths} ekor</span>
                      </div>
                    </div>
                  )}

                  {batch.feedAmount !== undefined && (
                    <div className="flex items-start space-x-2">
                      <div className="h-5 w-5 text-primary mt-1 flex items-center justify-center">🌾</div>
                      <div className="flex flex-col">
                        <span className="text-sm font-medium">Jumlah Pakan</span>
                        <span>{batch.feedAmount} kg</span>
                      </div>
                    </div>
                  )}

                  {batch.feedType && (
                    <div className="flex items-start space-x-2">
                      <div className="h-5 w-5 text-primary mt-1 flex items-center justify-center">🥫</div>
                      <div className="flex flex-col">
                        <span className="text-sm font-medium">Jenis Pakan</span>
                        <span>{batch.feedType}</span>
                      </div>
                    </div>
                  )}

                  {batch.waterStatus && (
                    <div className="flex items-start space-x-2">
                      <div className="h-5 w-5 text-primary mt-1 flex items-center justify-center">💧</div>
                      <div className="flex flex-col">
                        <span className="text-sm font-medium">Status Air</span>
                        <Badge variant="outline" className={batch.waterStatus === 'OK' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>
                          {batch.waterStatus}
                        </Badge>
                      </div>
                    </div>
                  )}
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

                {batch.lastUpdated && (
                  <div className="pt-4 border-t text-sm text-muted-foreground">
                    <p>Terakhir diperbarui: {formatTimestamp(batch.lastUpdated)}</p>
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
                  <Link href={`/admin/export?batch=${batchId}`}>
                    Ekspor Data Batch
                  </Link>
                </Button>
                
                <Button variant="outline" className="w-full" asChild>
                  <Link href={`/admin/chickens/${batchId}/edit`}>
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
        </TabsContent>
        
        <TabsContent value="history">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Riwayat Perubahan</CardTitle>
                <CardDescription>
                  Catatan perubahan data monitoring ayam
                </CardDescription>
              </div>
              <History className="h-5 w-5 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {loadingHistory ? (
                <div className="flex justify-center items-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : history.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <History className="h-12 w-12 text-muted-foreground mb-2 opacity-20" />
                  <p className="text-muted-foreground">Belum ada catatan perubahan untuk batch ini</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[180px]">Tanggal</TableHead>
                        <TableHead>Berat (kg)</TableHead>
                        <TableHead>Kematian</TableHead>
                        <TableHead>Jumlah Ayam</TableHead>
                        <TableHead>Pakan (kg)</TableHead>
                        <TableHead>Jenis Pakan</TableHead>
                        <TableHead>Air</TableHead>
                        <TableHead className="text-right">Catatan</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {history.map((entry) => (
                        <TableRow key={entry.id}>
                          <TableCell className="font-medium">{formatTimestamp(entry.timestamp)}</TableCell>
                          <TableCell>
                            {entry.current.averageWeight.toFixed(2)} 
                            {' '}
                            {formatChangeValue(entry.previous.averageWeight, entry.current.averageWeight)}
                          </TableCell>
                          <TableCell>
                            {entry.current.deaths} 
                            {' '}
                            {formatChangeValue(entry.previous.deaths, entry.current.deaths)}
                          </TableCell>
                          <TableCell>
                            {entry.current.quantity || batch.quantity} 
                            {' '}
                            {entry.current.quantity !== undefined && entry.previous.quantity !== undefined && 
                              formatChangeValue(entry.previous.quantity, entry.current.quantity)}
                          </TableCell>
                          <TableCell>
                            {entry.current.feedAmount.toFixed(2)} 
                            {' '}
                            {formatChangeValue(entry.previous.feedAmount, entry.current.feedAmount)}
                          </TableCell>
                          <TableCell>
                            {entry.current.feedType || '-'}
                            {entry.previous.feedType !== entry.current.feedType && (
                              <span className="text-xs text-blue-600 block">
                                (sebelumnya: {entry.previous.feedType || '-'})
                              </span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={entry.current.waterStatus === 'OK' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>
                              {entry.current.waterStatus}
                            </Badge>
                            {entry.previous.waterStatus !== entry.current.waterStatus && (
                              <span className="text-xs text-blue-600 block">
                                Perubahan status
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="text-right whitespace-pre-wrap max-w-[200px]">
                            {entry.changeNote || '-'}
                            {entry.previous.notes !== entry.current.notes && (
                              <span className="text-xs text-blue-600 block mt-1">
                                Catatan diperbarui
                              </span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="daily">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Perkembangan Harian Batch Ayam</CardTitle>
                <CardDescription>
                  Rekaman perkembangan harian batch ayam ini sejak tanggal penetasan ({formatDate(batch.hatchDate)})
                </CardDescription>
              </div>
              <div className="flex space-x-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handleUpdateToday}
                  disabled={updatingDaily}
                >
                  {updatingDaily ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Memperbarui...
                    </>
                  ) : (
                    <>Update Hari Ini</>
                  )}
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handleBackfill}
                  disabled={backfilling}
                >
                  {backfilling ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Proses...
                    </>
                  ) : (
                    <>Perbarui Semua Data</>
                  )}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {loadingDailyProgress ? (
                <div className="flex justify-center items-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : dailyProgress.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <LineChart className="h-12 w-12 text-muted-foreground mb-2 opacity-20" />
                  <p className="text-muted-foreground">Belum ada data perkembangan harian</p>
                  <Button 
                    className="mt-4" 
                    variant="outline" 
                    onClick={handleUpdateToday}
                    disabled={updatingDaily}
                  >
                    {updatingDaily ? 'Memperbarui...' : 'Buat Data Hari Ini'}
                  </Button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[120px]">Tanggal</TableHead>
                        <TableHead>Usia (hari)</TableHead>
                        <TableHead>Berat (kg)</TableHead>
                        <TableHead>Kematian</TableHead>
                        <TableHead>Jumlah Ayam</TableHead>
                        <TableHead>Pakan (kg)</TableHead>
                        <TableHead>Jenis Pakan</TableHead>
                        <TableHead>Air</TableHead>
                        <TableHead className="text-right">Catatan</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {dailyProgress.map((entry) => (
                        <TableRow key={entry.dateString}>
                          <TableCell className="font-medium">
                            {new Date(entry.dateString).toLocaleDateString('id-ID', { 
                              day: 'numeric', 
                              month: 'short', 
                              year: 'numeric' 
                            })}
                            {entry.manualUpdate && (
                              <span className="text-xs text-blue-600 block">
                                Manual
                              </span>
                            )}
                            {entry.autoBackfilled && (
                              <span className="text-xs text-gray-500 block">
                                Auto
                              </span>
                            )}
                          </TableCell>
                          <TableCell>{entry.ageInDays}</TableCell>
                          <TableCell>{entry.averageWeight.toFixed(2)} kg</TableCell>
                          <TableCell>{entry.deaths} ekor</TableCell>
                          <TableCell>{entry.quantity || batch.quantity} ekor</TableCell>
                          <TableCell>{entry.feedAmount.toFixed(2)} kg</TableCell>
                          <TableCell>{entry.feedType || '-'}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className={entry.waterStatus === 'OK' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>
                              {entry.waterStatus}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right whitespace-pre-wrap max-w-[200px]">
                            {entry.notes || '-'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}