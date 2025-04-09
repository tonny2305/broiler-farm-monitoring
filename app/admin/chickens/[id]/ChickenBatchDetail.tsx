'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Edit, Trash2, ChevronLeft, Calendar, Users, Clock, AlertTriangle, FileText, Loader2, History, LineChart, ArrowLeft, Pencil } from 'lucide-react';
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
import { Label } from '@/components/ui/label';

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
    <div className="container mx-auto p-4 space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold">Detail Batch Ayam</h1>
          <p className="text-muted-foreground">ID: {batchId}</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          <Button 
            variant="outline" 
            className="w-full sm:w-auto"
            onClick={() => router.push('/admin/chickens')}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Kembali
          </Button>
          <Button 
            className="w-full sm:w-auto"
            onClick={() => router.push(`/admin/chickens/${batchId}/edit`)}
          >
            <Pencil className="mr-2 h-4 w-4" />
            Edit
          </Button>
          <Button 
            variant="destructive" 
            className="w-full sm:w-auto"
                  onClick={handleDelete}
                  disabled={deleting}
                >
                  {deleting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Menghapus...
                    </>
                  ) : (
              <>
                <Trash2 className="mr-2 h-4 w-4" />
                Hapus
              </>
                  )}
          </Button>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
              <CardHeader>
                <CardTitle>Informasi Batch</CardTitle>
              </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label className="text-muted-foreground">Tanggal Tetas</Label>
                <p>{format(new Date(batch.hatchDate), 'dd MMMM yyyy', { locale: id })}</p>
                  </div>
              <div className="space-y-1">
                <Label className="text-muted-foreground">Jumlah Ayam</Label>
                <p>{batch.quantity} ekor</p>
                  </div>
              <div className="space-y-1">
                <Label className="text-muted-foreground">Berat Rata-rata</Label>
                <p>{batch.averageWeight} kg</p>
                    </div>
              <div className="space-y-1">
                <Label className="text-muted-foreground">Kematian</Label>
                <p>{batch.deaths} ekor</p>
                    </div>
                  </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
            <CardTitle>Status Terkini</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label className="text-muted-foreground">Status Pakan</Label>
                <Badge variant={batch.feedType === 'OK' ? 'default' : 'destructive'}>
                  {batch.feedType}
                </Badge>
              </div>
              <div className="space-y-1">
                <Label className="text-muted-foreground">Status Air</Label>
                <Badge 
                  variant="outline"
                  className={batch.waterStatus === 'OK' ? 'bg-green-100 text-green-800 border-green-200' : 'bg-red-100 text-red-800 border-red-200'}
                >
                  {batch.waterStatus}
                </Badge>
              </div>
              <div className="space-y-1">
                <Label className="text-muted-foreground">Jumlah Pakan</Label>
                <p>{batch.feedAmount} kg</p>
              </div>
              <div className="space-y-1">
                <Label className="text-muted-foreground">Jenis Pakan</Label>
                <p>{batch.feedType}</p>
              </div>
            </div>
              </CardContent>
            </Card>
          </div>
        
          <Card>
        <CardHeader>
                <CardTitle>Riwayat Perubahan</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Tanggal</TableHead>
                        <TableHead>Perubahan</TableHead>
                        <TableHead>Nilai Lama</TableHead>
                        <TableHead>Nilai Baru</TableHead>
                        <TableHead>Catatan</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {history.map((entry) => {
                        // Format perubahan untuk setiap field
                        const formatChange = (field: string, oldValue: any, newValue: any) => {
                          switch (field) {
                            case 'quantity':
                              return `${oldValue} ekor → ${newValue} ekor`;
                            case 'averageWeight':
                              return `${oldValue.toFixed(2)} kg → ${newValue.toFixed(2)} kg`;
                            case 'deaths':
                              return `${oldValue} ekor → ${newValue} ekor`;
                            case 'feedAmount':
                              return `${oldValue.toFixed(2)} kg → ${newValue.toFixed(2)} kg`;
                            case 'feedType':
                              return `${oldValue || '-'} → ${newValue || '-'}`;
                            case 'waterStatus':
                              return (
                                <div className="flex items-center gap-2">
                                  <Badge 
                                    variant="outline"
                                    className={oldValue === 'OK' ? 'bg-green-100 text-green-800 border-green-200' : 'bg-red-100 text-red-800 border-red-200'}
                                  >
                                    {oldValue}
                                  </Badge>
                                  <span>→</span>
                                  <Badge 
                                    variant="outline"
                                    className={newValue === 'OK' ? 'bg-green-100 text-green-800 border-green-200' : 'bg-red-100 text-red-800 border-red-200'}
                                  >
                                    {newValue}
                                  </Badge>
                                </div>
                              );
                            case 'hatchDate':
                              return `${format(new Date(oldValue), 'dd MMM yyyy', { locale: id })} → ${format(new Date(newValue), 'dd MMM yyyy', { locale: id })}`;
                            default:
                              return `${oldValue || '-'} → ${newValue || '-'}`;
                          }
                        };

                        // Dapatkan semua field yang berubah
                        const changedFields = Object.keys(entry.current).filter(
                          key => JSON.stringify(entry.current[key]) !== JSON.stringify(entry.previous[key])
                        );

                        return (
                          <TableRow key={entry.id}>
                            <TableCell>
                              {format(new Date(entry.timestamp), 'dd MMM yyyy HH:mm', { locale: id })}
                            </TableCell>
                            <TableCell>
                              <div className="space-y-1">
                                {changedFields.map(field => (
                                  <div key={field} className="flex items-center gap-2">
                                    <span className="font-medium capitalize">
                                      {field === 'averageWeight' ? 'Berat Rata-rata' :
                                       field === 'feedAmount' ? 'Jumlah Pakan' :
                                       field === 'feedType' ? 'Jenis Pakan' :
                                       field === 'waterStatus' ? 'Status Air' :
                                       field === 'hatchDate' ? 'Tanggal Tetas' :
                                       field === 'quantity' ? 'Jumlah Ayam' :
                                       field === 'deaths' ? 'Kematian' :
                                       field}
                                    </span>
                                    <span className="text-muted-foreground">
                                      {formatChange(field, entry.previous[field], entry.current[field])}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="space-y-1">
                                {changedFields.map(field => (
                                  <div key={field}>
                                    {field === 'waterStatus' ? (
                                      <Badge 
                                        variant="outline"
                                        className={entry.previous[field] === 'OK' ? 'bg-green-100 text-green-800 border-green-200' : 'bg-red-100 text-red-800 border-red-200'}
                                      >
                                        {entry.previous[field]}
                                      </Badge>
                                    ) : (
                                      <span className="text-muted-foreground">
                                        {field === 'averageWeight' || field === 'feedAmount' 
                                          ? `${entry.previous[field].toFixed(2)} kg`
                                          : field === 'quantity' || field === 'deaths'
                                            ? `${entry.previous[field]} ekor`
                                            : field === 'hatchDate'
                                              ? format(new Date(entry.previous[field]), 'dd MMM yyyy', { locale: id })
                                              : entry.previous[field] || '-'}
                                      </span>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="space-y-1">
                                {changedFields.map(field => (
                                  <div key={field}>
                                    {field === 'waterStatus' ? (
                                      <Badge 
                                        variant="outline"
                                        className={entry.current[field] === 'OK' ? 'bg-green-100 text-green-800 border-green-200' : 'bg-red-100 text-red-800 border-red-200'}
                                      >
                                        {entry.current[field]}
                                      </Badge>
                                    ) : (
                                      <span className="text-muted-foreground">
                                        {field === 'averageWeight' || field === 'feedAmount' 
                                          ? `${entry.current[field].toFixed(2)} kg`
                                          : field === 'quantity' || field === 'deaths'
                                            ? `${entry.current[field]} ekor`
                                            : field === 'hatchDate'
                                              ? format(new Date(entry.current[field]), 'dd MMM yyyy', { locale: id })
                                              : entry.current[field] || '-'}
                                      </span>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </TableCell>
                            <TableCell className="max-w-[200px]">
                              <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                                {entry.changeNote || '-'}
                              </p>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
            </CardContent>
          </Card>
        
          <Card>
        <CardHeader>
          <CardTitle>Progress Harian</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                  <TableHead>Tanggal</TableHead>
                  <TableHead>Jumlah Ayam</TableHead>
                  <TableHead>Berat Rata-rata</TableHead>
                        <TableHead>Kematian</TableHead>
                  <TableHead>Pakan</TableHead>
                  <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                {dailyProgress.map((progress) => (
                  <TableRow key={progress.dateString}>
                    <TableCell>
                      {format(new Date(progress.dateString), 'dd MMM yyyy', { locale: id })}
                          </TableCell>
                    <TableCell>{progress.quantity || batch.quantity} ekor</TableCell>
                    <TableCell>{progress.averageWeight.toFixed(2)} kg</TableCell>
                    <TableCell>{progress.deaths} ekor</TableCell>
                    <TableCell>{progress.feedAmount.toFixed(2)} kg</TableCell>
                          <TableCell>
                      <Badge 
                        variant="outline"
                        className={progress.waterStatus === 'OK' ? 'bg-green-100 text-green-800 border-green-200' : 'bg-red-100 text-red-800 border-red-200'}
                      >
                        {progress.waterStatus}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
            </CardContent>
          </Card>
    </div>
  );
}