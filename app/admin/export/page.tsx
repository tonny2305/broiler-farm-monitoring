'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { CalendarIcon, Download, Loader2 } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format, subDays } from 'date-fns';
import { id } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { onValue, get, ref as dbRef } from 'firebase/database';
import { getSensorDataRef, getChickenDataRef, getFirebaseDatabase, getDailyChickenProgress } from '@/lib/firebase';
import { useToast } from '@/components/ui/use-toast';

interface SensorData {
  timestamp: number | string;
  temperature: number;
  humidity: number;
  ammonia: number;
  methane: number;
  h2s: number;
  intensity: number;
}

interface ChickenBatch {
  id: string;
  hatchDate: string;
  quantity: number;
  notes?: string;
  createdAt: number;
  ageInDays: number;
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
  manualUpdate: boolean;
  autoBackfilled?: boolean;
  quantity?: number;
}

export default function ExportPage() {
  const { toast } = useToast();
  const [sensorData, setSensorData] = useState<SensorData[]>([]);
  const [chickenBatches, setChickenBatches] = useState<ChickenBatch[]>([]);
  const [dailyProgress, setDailyProgress] = useState<Record<string, DailyProgressEntry[]>>({});
  const [loading, setLoading] = useState(true);
  const [loadingDaily, setLoadingDaily] = useState(false);
  const [exportFormat, setExportFormat] = useState<string>('json');
  const [dateRange, setDateRange] = useState<string>('last7days');
  const [startDate, setStartDate] = useState<Date | undefined>(subDays(new Date(), 7));
  const [endDate, setEndDate] = useState<Date | undefined>(new Date());
  const [startDateInput, setStartDateInput] = useState("");
  const [endDateInput, setEndDateInput] = useState("");
  const [selectedBatchId, setSelectedBatchId] = useState<string>('all');
  const [exportType, setExportType] = useState<string>('data');
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    // Ambil data sensor
    const sensorRef = getSensorDataRef();
    const db = getFirebaseDatabase();
    
    // Tambahkan monitoring untuk useEffect
    console.log("Memulai useEffect untuk mengambil data sensor dan batch ayam");
    
    // Periksa data sensor sekali menggunakan get untuk debugging
    get(sensorRef).then((snapshot) => {
      const rawData = snapshot.val();
      console.log("RAW DATA dari Firebase:", rawData);
      console.log("Keys dari data:", rawData ? Object.keys(rawData) : "tidak ada");
      
      if (rawData) {
        // Cek struktur data
        const sampleKeys = Object.keys(rawData).slice(0, 3);
        sampleKeys.forEach(key => {
          console.log(`Sample data [${key}]:`, rawData[key]);
          if (rawData[key]) {
            console.log(`Timestamp type: ${typeof rawData[key].timestamp}, Value: ${rawData[key].timestamp}`);
          }
        });
      }
    }).catch(error => {
      console.error("Error saat memeriksa data sensor:", error);
    });
    
    const sensorUnsubscribe = onValue(sensorRef, (snapshot) => {
      try {
        const data = snapshot.val();
        console.log("Data sensor dari Firebase:", data ? `ditemukan (${Object.keys(data).length} items)` : "kosong");
        
        if (data) {
          const formattedData: SensorData[] = [];
          
          Object.keys(data).forEach(key => {
            // PERUBAHAN: Hapus filter berdasarkan nama key untuk menerima semua data
            const sensorEntry = data[key];
            if (sensorEntry) {
              // Log entry asli untuk debugging
              console.log(`Raw entry for ${key}:`, sensorEntry);
              
              // Konversi timestamp ke format yang konsisten (millisekon)
              let timestamp;

              // Cek format timestamp
              if (typeof sensorEntry.timestamp === 'string' && sensorEntry.timestamp.includes('-')) {
                // Format "YYYY-M-D H:M:S", simpan format string asli
                timestamp = sensorEntry.timestamp;
                console.log(`Timestamp string format: ${sensorEntry.timestamp}`);
              } else {
                // Format numerik (detik atau milidetik)
                const numTimestamp = Number(sensorEntry.timestamp) || 0;
                
                // Jika timestamp dalam detik (kurang dari tahun 2000 dalam milidetik), konversi ke millisekon
                if (numTimestamp > 0 && numTimestamp < 10000000000) { // Gunakan 10 miliar sebagai batas
                  console.log(`Timestamp detik: ${numTimestamp} -> ${numTimestamp * 1000}`);
                  timestamp = numTimestamp * 1000;
                } else {
                  timestamp = numTimestamp;
                }
              }
              
              // Pastikan semua nilai numerik
              // PERUBAHAN: Cek keberadaan field, jika tidak ada, gunakan 0
              const temperature = Number(sensorEntry.temperature) || 0;
              const humidity = Number(sensorEntry.humidity) || 0;
              const ammonia = Number(sensorEntry.ammonia) || 0;
              
              // PERUBAHAN: Periksa berbagai kemungkinan nama field untuk methane (ch4/methane)
              const methane = Number(sensorEntry.ch4 || sensorEntry.methane) || 0;
              
              const h2s = Number(sensorEntry.h2s) || 0;
              const intensity = Number(sensorEntry.intensity) || 0;
              
              // PERUBAHAN: Tambahkan entri tanpa cek timestamp
              formattedData.push({
                timestamp: timestamp || Date.now(), // Fallback ke waktu sekarang jika tidak ada timestamp
                temperature: temperature,
                humidity: humidity,
                ammonia: ammonia,
                methane: methane,
                h2s: h2s,
                intensity: intensity
              });
            }
          });
          
          // Urutkan berdasarkan timestamp (terbaru di atas)
          formattedData.sort((a, b) => {
            const timestampA = typeof a.timestamp === 'number' ? a.timestamp : Number(new Date(a.timestamp).getTime()) || 0;
            const timestampB = typeof b.timestamp === 'number' ? b.timestamp : Number(new Date(b.timestamp).getTime()) || 0;
            return timestampB - timestampA;
          });
          console.log('Data sensor berhasil diproses:', formattedData.length, 'entri');
          
          // Dump first and last entry for debugging
          if (formattedData.length > 0) {
            console.log('First entry:', formattedData[0]);
            
            if (formattedData.length > 1) {
              console.log('Last entry:', formattedData[formattedData.length - 1]);
            }
          }
          
          setSensorData(formattedData);
        } else {
          console.log('Data sensor kosong pada halaman ekspor');
          
          // PERUBAHAN: Tambahkan data dummy untuk debugging jika tidak ada data
          const dummyData: SensorData[] = [];
          for (let i = 0; i < 5; i++) {
            const now = Date.now() - i * 3600000; // Setiap jam ke belakang
            dummyData.push({
              timestamp: now,
              temperature: 25 + Math.random() * 5,
              humidity: 60 + Math.random() * 10,
              ammonia: 0.01 + Math.random() * 0.05,
              methane: 0.1 + Math.random() * 0.2,
              h2s: 0.005 + Math.random() * 0.01,
              intensity: 100 + Math.random() * 50
            });
          }
          console.log('Menggunakan data dummy untuk testing:', dummyData);
          setSensorData(dummyData);
        }
      } catch (error) {
        console.error('Error saat memproses data sensor (halaman ekspor):', error);
        setSensorData([]);
      }
    });
    
    // Ambil data batch ayam
    const chickenRef = getChickenDataRef();
    const chickenUnsubscribe = onValue(chickenRef, (snapshot) => {
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
      }
      
      setLoading(false);
    });
    
    return () => {
      sensorUnsubscribe();
      chickenUnsubscribe();
    };
  }, []);

  // Efek untuk mengatur rentang tanggal berdasarkan pilihan
  useEffect(() => {
    const now = new Date();
    
    switch (dateRange) {
      case 'today':
        setStartDate(new Date(now.setHours(0, 0, 0, 0)));
        setEndDate(new Date());
        break;
      case 'yesterday':
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        setStartDate(new Date(yesterday.setHours(0, 0, 0, 0)));
        setEndDate(new Date(yesterday.setHours(23, 59, 59, 999)));
        break;
      case 'last7days':
        setStartDate(subDays(now, 7));
        setEndDate(now);
        break;
      case 'last30days':
        setStartDate(subDays(now, 30));
        setEndDate(now);
        break;
      case 'custom':
        // Pertahankan tanggal yang sudah dipilih
        break;
    }
  }, [dateRange]);

  // Format tanggal untuk input
  useEffect(() => {
    if (startDate) {
      setStartDateInput(format(startDate, "dd/MM/yyyy"));
    }
    if (endDate) {
      setEndDateInput(format(endDate, "dd/MM/yyyy"));
    }
  }, [startDate, endDate]);

  // Fungsi untuk memformat input tanggal
  const formatDateInput = (value: string) => {
    // Hapus semua karakter non-digit
    const numbers = value.replace(/\D/g, '');
    
    // Format dengan menambahkan slash
    if (numbers.length <= 2) return numbers;
    if (numbers.length <= 4) return numbers.slice(0, 2) + '/' + numbers.slice(2);
    return numbers.slice(0, 2) + '/' + numbers.slice(2, 4) + '/' + numbers.slice(4, 8);
  };

  // Fungsi untuk memvalidasi dan mengupdate tanggal
  const validateAndUpdateDate = (dateStr: string, setDate: (date: Date) => void) => {
    if (dateStr.length === 10) {
      const [day, month, year] = dateStr.split('/');
      const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      if (!isNaN(date.getTime())) {
        setDate(date);
      }
    }
  };

  // Fungsi untuk mengambil data harian batch ayam
  const fetchDailyProgress = async (batchId: string) => {
    try {
      setLoadingDaily(true);
      console.log('Fetching daily progress for batch:', batchId);
      
      const progressData = await getDailyChickenProgress(batchId);
      console.log('Daily progress data received:', progressData?.length || 0, 'entries');
      
      return progressData || [];
    } catch (error) {
      console.error('Error fetching daily progress:', error);
      return [];
    } finally {
      setLoadingDaily(false);
    }
  };

  // Memperbarui useEffect untuk mengambil batch data dan juga mengambil data harian
  useEffect(() => {
    // ... existing code ...

    // Tambahkan efek untuk mengambil data harian ketika batch dipilih
    if (selectedBatchId && selectedBatchId !== 'all') {
      fetchDailyProgress(selectedBatchId).then(data => {
        setDailyProgress({
          ...dailyProgress,
          [selectedBatchId]: data
        });
      });
    }
  }, [selectedBatchId]);

  // Fungsi untuk mengekspor data
  const exportData = (type: 'sensor' | 'chicken' | 'daily') => {
    try {
      setIsExporting(true);
      console.log(`Memulai ekspor data ${type}`, { sensorData, chickenBatches, dailyProgress });
      
      // 1. Siapkan data yang akan diekspor
      let dataToExport: any[] = [];
      let filename = '';
      
      if (type === 'sensor') {
        // Log debugging
        console.log(`Data sensor tersedia: ${sensorData.length} entri`);
        console.log(`Rentang waktu: ${startDate?.toISOString()} sampai ${endDate?.toISOString()}`);
        
        // Validasi data dasar
        if (!startDate || !endDate) {
          toast({
            variant: "destructive",
            title: "Ekspor Gagal",
            description: "Rentang tanggal tidak valid"
          });
          setIsExporting(false);
          return;
        }
        
        if (sensorData.length === 0) {
          toast({
            variant: "destructive",
            title: "Ekspor Gagal",
            description: "Tidak ada data sensor untuk diekspor"
          });
          setIsExporting(false);
          return;
        }
        
        // Format data untuk ekspor tanpa filter (sementara untuk testing)
        dataToExport = sensorData;
        console.log("Data untuk ekspor:", dataToExport.length, "entri");
        
        // Format data untuk ekspor
        for (const entry of dataToExport) {
          try {
            // Format timestamp untuk tampilan
            let formattedTime: string;
            
            if (typeof entry.timestamp === 'string' && entry.timestamp.includes('-')) {
              // Jika dalam format string tanggal
              formattedTime = entry.timestamp;
            } else {
              // Konversi timestamp numerik ke string tanggal
              let dateObj: Date;
              
              if (typeof entry.timestamp === 'number') {
                dateObj = new Date(entry.timestamp);
              } else {
                dateObj = new Date();
              }
              
              // Format tanggal
              try {
                formattedTime = dateObj.toLocaleString('id-ID');
              } catch (e) {
                formattedTime = 'Format tanggal error';
                console.error("Error format tanggal:", e);
              }
            }
            
            // Tambahkan entri yang sudah diformat ke data ekspor
            dataToExport.push({
              waktu: formattedTime,
              suhu: entry.temperature.toFixed(1),
              kelembaban: entry.humidity.toFixed(1),
              amonia: entry.ammonia.toFixed(3),
              metana: entry.methane.toFixed(3),
              h2s: entry.h2s.toFixed(3),
              intensitas: entry.intensity.toFixed(1)
            });
          } catch (error) {
            console.error('Error saat memformat data:', error);
            // Skip entri yang bermasalah
          }
        }
        
        // Buat nama file untuk data sensor
        filename = `data_sensor_${format(startDate, 'yyyyMMdd')}_${format(endDate, 'yyyyMMdd')}`;
      } else if (type === 'chicken') {
        // Ekspor data ayam
        if (chickenBatches.length === 0) {
          toast({
            variant: "destructive",
            title: "Ekspor Gagal",
            description: "Tidak ada data batch ayam untuk diekspor"
          });
          return;
        }
        
        // Filter batch jika diperlukan
        const batchesToExport = selectedBatchId === 'all' 
          ? chickenBatches 
          : chickenBatches.filter(b => b.id === selectedBatchId);
        
        // Format data ayam untuk ekspor
        dataToExport = batchesToExport.map(b => ({
          id: b.id,
          tanggal_menetas: format(new Date(b.hatchDate), 'dd/MM/yyyy'),
          jumlah: b.quantity,
          umur: b.ageInDays,
          catatan: b.notes || '-'
        }));
        
        // Buat nama file untuk data ayam
        filename = `data_ayam_${format(new Date(), 'yyyyMMdd')}`;
      } else if (type === 'daily') {
        // Ekspor data perkembangan harian ayam
        if (selectedBatchId === 'all') {
          toast({
            variant: "destructive",
            title: "Ekspor Gagal",
            description: "Pilih batch ayam tertentu untuk mengekspor data perkembangan harian"
          });
          setIsExporting(false);
          return;
        }
        
        const batchInfo = chickenBatches.find(b => b.id === selectedBatchId);
        const batchDailyData = dailyProgress[selectedBatchId];
        
        if (!batchDailyData || batchDailyData.length === 0) {
          // Jika data belum diambil, ambil dulu
          toast({
            title: "Mengambil Data",
            description: "Sedang mengambil data perkembangan harian..."
          });
          
          fetchDailyProgress(selectedBatchId).then(data => {
            if (data && data.length > 0) {
              setDailyProgress({
                ...dailyProgress,
                [selectedBatchId]: data
              });
              
              // Ulangi ekspor setelah data diambil
              setTimeout(() => exportData('daily'), 500);
            } else {
              toast({
                variant: "destructive",
                title: "Ekspor Gagal",
                description: "Tidak ada data perkembangan harian untuk batch ini"
              });
            }
          });
          
          setIsExporting(false);
          return;
        }
        
        // Format data perkembangan harian untuk ekspor
        dataToExport = batchDailyData.map(entry => ({
          tanggal: entry.dateString,
          usia_hari: entry.ageInDays,
          berat_rata_rata_kg: entry.averageWeight.toFixed(2),
          kematian: entry.deaths,
          jumlah_ayam: entry.quantity || (batchInfo ? batchInfo.quantity : 0),
          jumlah_pakan_kg: entry.feedAmount.toFixed(2),
          jenis_pakan: entry.feedType || '-',
          status_air: entry.waterStatus,
          catatan: entry.notes || '-',
          jenis_update: entry.manualUpdate ? 'Manual' : (entry.autoBackfilled ? 'Auto Backfill' : 'Auto')
        }));
        
        // Urutkan berdasarkan tanggal (terlama ke terbaru)
        dataToExport.sort((a, b) => new Date(a.tanggal).getTime() - new Date(b.tanggal).getTime());
        
        // Nama file untuk data perkembangan harian
        const batchName = batchInfo ? batchInfo.id.split('-').pop() : selectedBatchId;
        filename = `perkembangan_harian_batch_${batchName}_${format(new Date(), 'yyyyMMdd')}`;
      }
      
      // Cek apakah ada data yang akan diekspor
      if (dataToExport.length === 0) {
        toast({
          variant: "destructive",
          title: "Ekspor Gagal",
          description: "Tidak ada data untuk diekspor"
        });
        setIsExporting(false);
        return;
      }
      
      console.log(`Mengekspor ${dataToExport.length} entri data ke ${filename}`);
      
      // 2. Konversi data ke format yang dipilih
      let content = '';
      
      if (exportFormat === 'json') {
        // Format JSON
        content = JSON.stringify(dataToExport, null, 2);
        filename += '.json';
      } else {
        // Format CSV
        // Buat header CSV dengan satuan (hanya di header)
        const baseHeaders = Object.keys(dataToExport[0]);
        const headersWithUnits = [...baseHeaders];
        
        // Tambahkan satuan pada header jika diperlukan
        if (type === 'sensor') {
          headersWithUnits[1] = 'suhu (°C)';
          headersWithUnits[2] = 'kelembaban (%)';
          headersWithUnits[3] = 'amonia (ppm)';
          headersWithUnits[4] = 'metana (ppm)';
          headersWithUnits[5] = 'h2s (ppm)';
          headersWithUnits[6] = 'intensitas (lux)';
        } else if (type === 'daily') {
          // Tambahkan satuan untuk data perkembangan harian
          const headerMap: Record<string, string> = {
            tanggal: 'tanggal',
            usia_hari: 'usia (hari)',
            berat_rata_rata_kg: 'berat rata-rata (kg)',
            kematian: 'kematian (ekor)',
            jumlah_ayam: 'jumlah ayam',
            jumlah_pakan_kg: 'jumlah pakan (kg)',
            jenis_pakan: 'jenis pakan',
            status_air: 'status air',
            catatan: 'catatan',
            jenis_update: 'jenis update'
          };
          
          // Ganti header dengan label yang lebih baik
          baseHeaders.forEach((header, index) => {
            if (headerMap[header]) {
              headersWithUnits[index] = headerMap[header];
            }
          });
        }
        
        // Buat baris-baris CSV
        const rows = [
          headersWithUnits.join(','),
          ...dataToExport.map(item => 
            baseHeaders.map(header => {
              const value = String(item[header] || '');
              // Escape nilai yang mengandung koma
              return value.includes(',') ? `"${value}"` : value;
            }).join(',')
          )
        ];
        
        content = rows.join('\n');
        filename += '.csv';
      }
      
      // Debug content
      console.log("Content preview:", content.substring(0, 100) + "...");
      console.log("Content length:", content.length);
      
      // 3. Unduh file dengan Blob API
      const blob = new Blob([content], { 
        type: exportFormat === 'json' ? 'application/json' : 'text/csv;charset=utf-8' 
      });
      
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      
      // Bersihkan
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        // Tampilkan pesan sukses
        toast({
          title: "Ekspor Berhasil",
          description: `Data berhasil diekspor ke ${filename}`
        });
        
        setIsExporting(false);
      }, 100);
      
    } catch (error) {
      console.error('Error saat ekspor data:', error);
      toast({
        variant: "destructive",
        title: "Ekspor Gagal",
        description: "Terjadi kesalahan saat mengekspor data"
      });
      setIsExporting(false);
    }
  };

  return (
    <div className="container mx-auto py-10 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Ekspor Data</h1>
      </div>
      
      <Tabs defaultValue="sensor" onValueChange={(value) => setExportType(value)}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="sensor">Data Sensor</TabsTrigger>
          <TabsTrigger value="chicken">Data Batch Ayam</TabsTrigger>
          <TabsTrigger value="daily">Perkembangan Harian</TabsTrigger>
        </TabsList>
        
        <TabsContent value="sensor">
          <Card>
            <CardHeader>
              <CardTitle>Ekspor Data Sensor</CardTitle>
              <CardDescription>
                Pilih format dan rentang waktu untuk mengekspor data sensor
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="export-format">Format Ekspor</Label>
                  <Select
                    value={exportFormat}
                    onValueChange={setExportFormat}
                  >
                    <SelectTrigger id="export-format">
                      <SelectValue placeholder="Pilih format" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="json">JSON</SelectItem>
                      <SelectItem value="csv">CSV</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="date-range">Rentang Waktu</Label>
                  <Select
                    value={dateRange}
                    onValueChange={setDateRange}
                  >
                    <SelectTrigger id="date-range">
                      <SelectValue placeholder="Pilih rentang waktu" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="today">Hari Ini</SelectItem>
                      <SelectItem value="yesterday">Kemarin</SelectItem>
                      <SelectItem value="last7days">7 Hari Terakhir</SelectItem>
                      <SelectItem value="last30days">30 Hari Terakhir</SelectItem>
                      <SelectItem value="custom">Kustom</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              {dateRange === 'custom' && (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 mt-2">
                  <div className="space-y-2">
                    <Label htmlFor="start-date">Tanggal Mulai</Label>
                    <Input
                      id="start-date"
                      type="text"
                      placeholder="DD/MM/YYYY"
                      value={startDateInput}
                      onChange={(e) => {
                        const formatted = formatDateInput(e.target.value);
                        if (formatted.length <= 10) {
                          setStartDateInput(formatted);
                          validateAndUpdateDate(formatted, setStartDate);
                        }
                      }}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="end-date">Tanggal Akhir</Label>
                    <Input
                      id="end-date"
                      type="text"
                      placeholder="DD/MM/YYYY"
                      value={endDateInput}
                      onChange={(e) => {
                        const formatted = formatDateInput(e.target.value);
                        if (formatted.length <= 10) {
                          setEndDateInput(formatted);
                          validateAndUpdateDate(formatted, setEndDate);
                        }
                      }}
                    />
                  </div>
                </div>
              )}
            </CardContent>
            <CardFooter>
              <Button 
                className="ml-auto" 
                onClick={() => exportData('sensor')}
                disabled={isExporting}
                type="button"
              >
                {isExporting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isExporting ? 'Mengekspor...' : (
                  <>
                    <Download className="mr-2 h-4 w-4" />
                    Ekspor Data Sensor
                  </>
                )}
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>
        
        <TabsContent value="chicken">
          <Card>
            <CardHeader>
              <CardTitle>Ekspor Data Ayam</CardTitle>
              <CardDescription>
                Pilih format dan batch ayam untuk mengekspor data
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="export-format-chicken">Format Ekspor</Label>
                  <Select
                    value={exportFormat}
                    onValueChange={setExportFormat}
                  >
                    <SelectTrigger id="export-format-chicken">
                      <SelectValue placeholder="Pilih format" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="json">JSON</SelectItem>
                      <SelectItem value="csv">CSV</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="batch-id">Batch Ayam</Label>
                  <Select
                    value={selectedBatchId}
                    onValueChange={setSelectedBatchId}
                  >
                    <SelectTrigger id="batch-id">
                      <SelectValue placeholder="Pilih batch" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Semua Batch</SelectItem>
                      {chickenBatches.map(batch => (
                        <SelectItem key={batch.id} value={batch.id}>
                          Batch {batch.id.slice(-6)} ({new Date(batch.hatchDate).toLocaleDateString('id-ID')})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
            <CardFooter>
              <Button 
                className="ml-auto" 
                onClick={() => exportData('chicken')}
                disabled={isExporting}
                type="button"
              >
                {isExporting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isExporting ? 'Mengekspor...' : (
                  <>
                    <Download className="mr-2 h-4 w-4" />
                    Ekspor Data Ayam
                  </>
                )}
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>
        
        <TabsContent value="daily">
          <Card>
            <CardHeader>
              <CardTitle>Ekspor Data Perkembangan Harian</CardTitle>
              <CardDescription>
                Download data perkembangan harian batch ayam lengkap
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="daily-batch">Pilih Batch Ayam</Label>
                    <Select 
                      value={selectedBatchId} 
                      onValueChange={setSelectedBatchId}
                    >
                      <SelectTrigger id="daily-batch">
                        <SelectValue placeholder="Pilih batch ayam" />
                      </SelectTrigger>
                      <SelectContent>
                        {chickenBatches.map((batch) => (
                          <SelectItem key={batch.id} value={batch.id}>
                            {batch.id} - {format(new Date(batch.hatchDate), 'dd/MM/yyyy')}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="daily-format">Format File</Label>
                    <Select 
                      value={exportFormat} 
                      onValueChange={setExportFormat}
                    >
                      <SelectTrigger id="daily-format">
                        <SelectValue placeholder="Pilih format file" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="csv">CSV</SelectItem>
                        <SelectItem value="json">JSON</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                <div className="bg-muted/50 p-4 rounded-md">
                  <h3 className="font-medium mb-2">Informasi Ekspor</h3>
                  <p className="text-sm text-muted-foreground">
                    Data perkembangan harian mencakup berat rata-rata, kematian, pakan, dan parameter lainnya yang tercatat untuk setiap hari sejak batch ditetaskan.
                  </p>
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex justify-between">
              <div>
                {loadingDaily && (
                  <div className="flex items-center">
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    <span className="text-sm text-muted-foreground">Memuat data...</span>
                  </div>
                )}
              </div>
              <Button 
                onClick={() => exportData('daily')} 
                disabled={isExporting || !selectedBatchId || selectedBatchId === 'all'}
              >
                {isExporting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Memproses...
                  </>
                ) : (
                  <>
                    <Download className="mr-2 h-4 w-4" />
                    Download Data
                  </>
                )}
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
} 