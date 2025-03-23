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
import { getSensorDataRef, getChickenDataRef, getFirebaseDatabase } from '@/lib/firebase';
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

export default function ExportPage() {
  const { toast } = useToast();
  const [sensorData, setSensorData] = useState<SensorData[]>([]);
  const [chickenBatches, setChickenBatches] = useState<ChickenBatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [exportFormat, setExportFormat] = useState<string>('json');
  const [dateRange, setDateRange] = useState<string>('last7days');
  const [startDate, setStartDate] = useState<Date | undefined>(subDays(new Date(), 7));
  const [endDate, setEndDate] = useState<Date | undefined>(new Date());
  const [selectedBatchId, setSelectedBatchId] = useState<string>('all');
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

  // Fungsi untuk mengekspor data
  const exportData = (type: 'sensor' | 'chicken') => {
    try {
      setIsExporting(true);
      console.log(`Memulai ekspor data ${type}`, { sensorData, chickenBatches });
      
      // 1. Siapkan data yang akan diekspor
      let exportData: any[] = [];
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
        const dataToExport = sensorData;
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
            exportData.push({
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
      } else {
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
        exportData = batchesToExport.map(b => ({
          id: b.id,
          tanggal_menetas: format(new Date(b.hatchDate), 'dd/MM/yyyy'),
          jumlah: b.quantity,
          umur: b.ageInDays,
          catatan: b.notes || '-'
        }));
        
        // Buat nama file untuk data ayam
        filename = `data_ayam_${format(new Date(), 'yyyyMMdd')}`;
      }
      
      // Cek apakah ada data yang akan diekspor
      if (exportData.length === 0) {
        toast({
          variant: "destructive",
          title: "Ekspor Gagal",
          description: "Tidak ada data untuk diekspor"
        });
        setIsExporting(false);
        return;
      }
      
      console.log(`Mengekspor ${exportData.length} entri data ke ${filename}`);
      
      // 2. Konversi data ke format yang dipilih
      let content = '';
      
      if (exportFormat === 'json') {
        // Format JSON
        content = JSON.stringify(exportData, null, 2);
        filename += '.json';
      } else {
        // Format CSV
        // Buat header CSV dengan satuan (hanya di header)
        const baseHeaders = Object.keys(exportData[0]);
        const headersWithUnits = [...baseHeaders];
        
        // Tambahkan satuan pada header jika diperlukan
        if (type === 'sensor') {
          headersWithUnits[1] = 'suhu (°C)';
          headersWithUnits[2] = 'kelembaban (%)';
          headersWithUnits[3] = 'amonia (ppm)';
          headersWithUnits[4] = 'metana (ppm)';
          headersWithUnits[5] = 'h2s (ppm)';
          headersWithUnits[6] = 'intensitas (lux)';
        }
        
        // Buat baris-baris CSV
        const rows = [
          headersWithUnits.join(','),
          ...exportData.map(item => 
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
      
      // 3. Unduh file dengan metode alternatif
      try {
        // Metode 1: Menggunakan Blob API
        const blob = new Blob([content], { 
          type: exportFormat === 'json' ? 'application/json' : 'text/csv;charset=utf-8' 
        });
        
        // Untuk browser modern (hapus kode untuk IE yang menyebabkan linter error)
        const url = URL.createObjectURL(blob);
        console.log("Blob URL created:", url);
        
        // Buat elemen <a> untuk unduhan
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.style.display = 'none';
        
        // Tambahkan ke dokumen, klik, dan hapus
        document.body.appendChild(a);
        console.log("Link element appended to body");
        
        // Tambahkan delay kecil sebelum klik untuk browser tertentu
        setTimeout(() => {
          console.log("Clicking download link");
          a.click();
          
          // Bersihkan
          setTimeout(() => {
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            console.log("Cleanup completed");
          }, 500);
        }, 100);
      } catch (downloadError) {
        console.error("Error saat download dengan metode 1:", downloadError);
        
        // Metode 2: Gunakan data URI sebagai fallback
        try {
          const dataUri = `data:${exportFormat === 'json' ? 'application/json' : 'text/csv'};charset=utf-8,${encodeURIComponent(content)}`;
          const a = document.createElement('a');
          a.href = dataUri;
          a.download = filename;
          a.style.display = 'none';
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
        } catch (fallbackError) {
          console.error("Error saat download dengan metode 2:", fallbackError);
          throw new Error("Gagal mengunduh file dengan kedua metode");
        }
      }
      
      toast({
        title: "Ekspor Berhasil",
        description: `Data berhasil diekspor ke file ${filename}`
      });
    } catch (error) {
      console.error('Error saat mengekspor data:', error);
      toast({
        variant: "destructive",
        title: "Ekspor Gagal",
        description: "Terjadi kesalahan saat mengekspor data: " + (error instanceof Error ? error.message : String(error))
      });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Ekspor Data</h1>
      
      <Tabs defaultValue="sensor">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="sensor">Data Sensor</TabsTrigger>
          <TabsTrigger value="chickens">Data Ayam</TabsTrigger>
        </TabsList>
        
        <TabsContent value="sensor" className="mt-4 space-y-4">
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
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal",
                            !startDate && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {startDate ? format(startDate, 'PPP', { locale: id }) : "Pilih tanggal"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar
                          mode="single"
                          selected={startDate}
                          onSelect={setStartDate}
                          initialFocus
                          locale={id}
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="end-date">Tanggal Akhir</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal",
                            !endDate && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {endDate ? format(endDate, 'PPP', { locale: id }) : "Pilih tanggal"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar
                          mode="single"
                          selected={endDate}
                          onSelect={setEndDate}
                          initialFocus
                          locale={id}
                        />
                      </PopoverContent>
                    </Popover>
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
        
        <TabsContent value="chickens" className="mt-4 space-y-4">
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
      </Tabs>
    </div>
  );
} 