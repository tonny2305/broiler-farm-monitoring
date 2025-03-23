'use client';

import { useEffect, useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell } from 'recharts';
import { format, subDays, differenceInDays, isWithinInterval, startOfDay, endOfDay } from 'date-fns';
import { id } from 'date-fns/locale';
import { Download, Loader2, AlertTriangle, FileText, FileSpreadsheet } from 'lucide-react';
import { onValue, get } from 'firebase/database';
import { getSensorDataRef, getChickenDataRef } from '@/lib/firebase';
import { cn } from '@/lib/utils';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useRef } from 'react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useAuth } from '@/hooks/use-auth';

interface SensorData {
  temperature: number;
  humidity: number;
  ammonia: number;
  methane: number;
  h2s: number;
  intensity: number;
  timestamp: number | string;
}

interface ChickenBatch {
  id: string;
  hatchDate: string;
  quantity: number;
  notes?: string;
  ageInDays: number;
  createdAt: number;
}

interface AggregatedData {
  date: string;
  avgTemperature: number;
  avgHumidity: number;
  avgAmmonia: number;
  avgMethane: number;
  avgH2s: number;
  avgIntensity: number;
  count: number;
}

interface AlertCount {
  temperature: number;
  humidity: number;
  ammonia: number;
  methane: number;
  h2s: number;
  intensity: number;
}

// Tambahkan interface untuk parameter ideal berdasarkan umur
interface IdealParameters {
  temperature: { min: number; max: number };
  humidity: { min: number; max: number };
  ammonia: number;
  methane: number;
  h2s: number;
  intensity: { min: number; max: number };
}

// Fungsi untuk mendapatkan parameter ideal berdasarkan umur ayam (dalam hari)
const getIdealParameters = (ageInDays: number): IdealParameters => {
  if (ageInDays <= 7) { // Starter (0-7 hari)
    return {
      temperature: { min: 32, max: 35 },
      humidity: { min: 60, max: 70 },
      ammonia: 10,
      methane: 1.65,
      h2s: 0.1,
      intensity: { min: 20, max: 40 }
    };
  } else if (ageInDays <= 21) { // Grower (8-21 hari)
    return {
      temperature: { min: 28, max: 32 },
      humidity: { min: 50, max: 70 },
      ammonia: 10,
      methane: 1.65,
      h2s: 0.1,
      intensity: { min: 5, max: 10 }
    };
  } else { // Finisher (>21 hari)
    return {
      temperature: { min: 20, max: 28 },
      humidity: { min: 50, max: 70 },
      ammonia: 10,
      methane: 1.65,
      h2s: 0.1,
      intensity: { min: 5, max: 10 }
    };
  }
};

export default function ReportsPage() {
  const { user } = useAuth();
  const [sensorData, setSensorData] = useState<SensorData[]>([]);
  const [chickenBatches, setChickenBatches] = useState<ChickenBatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedBatchId, setSelectedBatchId] = useState<string>('all');
  const [dateRange, setDateRange] = useState<'7days' | '30days' | 'custom'>('7days');
  const [startDate, setStartDate] = useState<Date>(subDays(new Date(), 7));
  const [endDate, setEndDate] = useState<Date>(new Date());
  const [activeTab, setActiveTab] = useState('overview');
  const [isExporting, setIsExporting] = useState(false);
  const [exportFormat, setExportFormat] = useState<'pdf' | 'excel' | null>(null);

  // Ambil data dari Firebase
  useEffect(() => {
    const sensorRef = getSensorDataRef();
    const chickenRef = getChickenDataRef();
    
    const sensorUnsubscribe = onValue(sensorRef, (snapshot) => {
      try {
        const data = snapshot.val();
        if (data) {
          const formattedData: SensorData[] = [];
          
          Object.keys(data).forEach(key => {
            const entry = data[key];
            if (entry) {
              let timestamp = entry.timestamp;
              
              if (typeof timestamp === 'string' && timestamp.includes('-')) {
                timestamp = new Date(timestamp).getTime();
              } else if (typeof timestamp === 'number' && timestamp < 10000000000) {
                timestamp *= 1000;
              }
              
              formattedData.push({
                temperature: Number(entry.temperature) || 0,
                humidity: Number(entry.humidity) || 0,
                ammonia: Number(entry.ammonia) || 0,
                methane: Number(entry.ch4 || entry.methane) || 0,
                h2s: Number(entry.h2s) || 0,
                intensity: Number(entry.intensity) || 0,
                timestamp
              });
            }
          });
          
          // Urutkan berdasarkan timestamp
          formattedData.sort((a, b) => Number(b.timestamp) - Number(a.timestamp));
          setSensorData(formattedData);
        }
      } catch (error) {
        console.error('Error saat memproses data sensor:', error);
        setError('Gagal memuat data sensor');
      }
    });
    
    const chickenUnsubscribe = onValue(chickenRef, (snapshot) => {
      try {
        const data = snapshot.val();
        if (data) {
          const batches = Object.entries(data).map(([id, value]: [string, any]) => {
            const hatchDate = new Date(value.hatchDate);
            const today = new Date();
            const ageInDays = Math.floor((today.getTime() - hatchDate.getTime()) / (1000 * 60 * 60 * 24));
            
            return {
              id,
              hatchDate: value.hatchDate,
              quantity: Number(value.quantity) || 0,
              notes: value.notes || '',
              ageInDays,
              createdAt: value.createdAt || 0
            };
          });
          
          setChickenBatches(batches);
        }
        setLoading(false);
      } catch (error) {
        console.error('Error saat memproses data batch ayam:', error);
        setError('Gagal memuat data batch ayam');
        setLoading(false);
      }
    });
    
    return () => {
      sensorUnsubscribe();
      chickenUnsubscribe();
    };
  }, []);

  // Fungsi untuk mendapatkan data yang difilter berdasarkan rentang waktu
  const getFilteredData = () => {
    const start = startOfDay(startDate).getTime();
    const end = endOfDay(endDate).getTime();
    
    return sensorData.filter(data => {
      const timestamp = Number(data.timestamp);
      return timestamp >= start && timestamp <= end;
    });
  };

  // Hitung data agregat per hari
  const aggregatedData = useMemo(() => {
    const filteredData = getFilteredData();
    const dailyData: { [key: string]: AggregatedData } = {};
    
    filteredData.forEach(data => {
      const date = format(Number(data.timestamp), 'yyyy-MM-dd');
      
      if (!dailyData[date]) {
        dailyData[date] = {
          date,
          avgTemperature: 0,
          avgHumidity: 0,
          avgAmmonia: 0,
          avgMethane: 0,
          avgH2s: 0,
          avgIntensity: 0,
          count: 0
        };
      }
      
      dailyData[date].avgTemperature += data.temperature;
      dailyData[date].avgHumidity += data.humidity;
      dailyData[date].avgAmmonia += data.ammonia;
      dailyData[date].avgMethane += data.methane;
      dailyData[date].avgH2s += data.h2s;
      dailyData[date].avgIntensity += data.intensity;
      dailyData[date].count += 1;
    });
    
    // Hitung rata-rata
    return Object.values(dailyData).map(day => ({
      ...day,
      avgTemperature: day.avgTemperature / day.count,
      avgHumidity: day.avgHumidity / day.count,
      avgAmmonia: day.avgAmmonia / day.count,
      avgMethane: day.avgMethane / day.count,
      avgH2s: day.avgH2s / day.count,
      avgIntensity: day.avgIntensity / day.count
    })).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [sensorData, startDate, endDate]);

  // Modifikasi fungsi untuk menghitung alert
  const alertCounts = useMemo(() => {
    const filteredData = getFilteredData();
    const counts: AlertCount = {
      temperature: 0,
      humidity: 0,
      ammonia: 0,
      methane: 0,
      h2s: 0,
      intensity: 0
    };
    
    filteredData.forEach(data => {
      // Cek semua batch ayam yang aktif
      chickenBatches.forEach(batch => {
        const batchDate = new Date(batch.hatchDate);
        const dataDate = new Date(Number(data.timestamp));
        const ageInDays = Math.floor((dataDate.getTime() - batchDate.getTime()) / (1000 * 60 * 60 * 24));
        
        // Hanya proses jika batch sudah ada pada saat data direkam
        if (ageInDays >= 0) {
          const idealParams = getIdealParameters(ageInDays);
          
          // Cek suhu
          if (data.temperature < idealParams.temperature.min || 
              data.temperature > idealParams.temperature.max) {
            counts.temperature++;
          }
          
          // Cek kelembaban
          if (data.humidity < idealParams.humidity.min || 
              data.humidity > idealParams.humidity.max) {
            counts.humidity++;
          }
          
          // Cek amonia
          if (data.ammonia > idealParams.ammonia) {
            counts.ammonia++;
          }
          
          // Cek metana
          if (data.methane > idealParams.methane) {
            counts.methane++;
          }
          
          // Cek H2S
          if (data.h2s > idealParams.h2s) {
            counts.h2s++;
          }
          
          // Cek intensitas cahaya
          if (data.intensity < idealParams.intensity.min || 
              data.intensity > idealParams.intensity.max) {
            counts.intensity++;
          }
        }
      });
    });
    
    return counts;
  }, [sensorData, startDate, endDate, chickenBatches]);

  // Data untuk pie chart alert
  const alertPieData = useMemo(() => {
    return Object.entries(alertCounts).map(([key, value]) => ({
      name: key.charAt(0).toUpperCase() + key.slice(1),
      value
    }));
  }, [alertCounts]);

  // Warna untuk pie chart
  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

  // Format angka dengan 1 desimal
  const formatNumber = (value: number) => {
    return Number(value).toFixed(1);
  };

  // Fungsi untuk export ke Excel
  const exportToExcel = async () => {
    try {
      setIsExporting(true);
      const filteredData = getFilteredData();
      
      // Data untuk sheet ringkasan
      const summaryData = [
        ['Parameter', 'Min', 'Max', 'Rata-rata'],
        ['Suhu (°C)', 
          Math.min(...filteredData.map(d => d.temperature)).toFixed(1),
          Math.max(...filteredData.map(d => d.temperature)).toFixed(1),
          (filteredData.reduce((sum, d) => sum + d.temperature, 0) / filteredData.length).toFixed(1)
        ],
        ['Kelembaban (%)',
          Math.min(...filteredData.map(d => d.humidity)).toFixed(1),
          Math.max(...filteredData.map(d => d.humidity)).toFixed(1),
          (filteredData.reduce((sum, d) => sum + d.humidity, 0) / filteredData.length).toFixed(1)
        ],
        ['Amonia (ppm)',
          Math.min(...filteredData.map(d => d.ammonia)).toFixed(3),
          Math.max(...filteredData.map(d => d.ammonia)).toFixed(3),
          (filteredData.reduce((sum, d) => sum + d.ammonia, 0) / filteredData.length).toFixed(3)
        ],
        ['Metana (ppm)',
          Math.min(...filteredData.map(d => d.methane)).toFixed(2),
          Math.max(...filteredData.map(d => d.methane)).toFixed(2),
          (filteredData.reduce((sum, d) => sum + d.methane, 0) / filteredData.length).toFixed(2)
        ],
        ['H2S (ppm)',
          Math.min(...filteredData.map(d => d.h2s)).toFixed(4),
          Math.max(...filteredData.map(d => d.h2s)).toFixed(4),
          (filteredData.reduce((sum, d) => sum + d.h2s, 0) / filteredData.length).toFixed(4)
        ],
        ['Intensitas (lux)',
          Math.min(...filteredData.map(d => d.intensity)).toFixed(2),
          Math.max(...filteredData.map(d => d.intensity)).toFixed(2),
          (filteredData.reduce((sum, d) => sum + d.intensity, 0) / filteredData.length).toFixed(2)
        ]
      ];

      // Data untuk sheet detail
      const detailData = filteredData.map(data => ({
        'Waktu': format(Number(data.timestamp), 'dd/MM/yyyy HH:mm:ss'),
        'Suhu (°C)': data.temperature.toFixed(1),
        'Kelembaban (%)': data.humidity.toFixed(1),
        'Amonia (ppm)': data.ammonia.toFixed(3),
        'Metana (ppm)': data.methane.toFixed(2),
        'H2S (ppm)': data.h2s.toFixed(4),
        'Intensitas (lux)': data.intensity.toFixed(2)
      }));

      // Buat workbook
      const wb = XLSX.utils.book_new();
      const ws1 = XLSX.utils.aoa_to_sheet(summaryData);
      const ws2 = XLSX.utils.json_to_sheet(detailData);

      // Set style untuk header
      const headerStyle = { font: { bold: true }, alignment: { horizontal: 'center' } };
      XLSX.utils.sheet_add_aoa(ws1, [['Laporan Monitoring Sensor']], { origin: 'A1' });
      XLSX.utils.sheet_add_aoa(ws1, [[`Periode: ${format(startDate, 'dd/MM/yyyy')} - ${format(endDate, 'dd/MM/yyyy')}`]], { origin: 'A2' });
      XLSX.utils.sheet_add_aoa(ws1, [['']], { origin: 'A3' });

      // Tambahkan sheet ke workbook
      XLSX.utils.book_append_sheet(wb, ws1, 'Ringkasan');
      XLSX.utils.book_append_sheet(wb, ws2, 'Detail Data');

      // Download file
      XLSX.writeFile(wb, `Laporan_Monitoring_${format(new Date(), 'dd-MM-yyyy')}.xlsx`);
    } catch (error) {
      console.error('Error saat export ke Excel:', error);
      setError('Gagal mengekspor data ke Excel');
    } finally {
      setIsExporting(false);
    }
  };

  // Fungsi untuk export ke PDF
  const exportToPDF = async () => {
    try {
      setIsExporting(true);
      const doc = new jsPDF();
      const filteredData = getFilteredData();

      // Judul dan Informasi Admin
      doc.setFontSize(16);
      doc.text('Laporan Monitoring Sensor', 14, 15);
      doc.setFontSize(12);
      doc.text(`Periode: ${format(startDate, 'dd/MM/yyyy')} - ${format(endDate, 'dd/MM/yyyy')}`, 14, 25);
      
      // Informasi Admin
      doc.setFontSize(10);
      doc.text(`Dibuat oleh: ${user?.email || 'Admin'}`, 14, 35);
      doc.text(`Tanggal Export: ${format(new Date(), 'dd/MM/yyyy HH:mm:ss')}`, 14, 42);

      // Ringkasan
      doc.setFontSize(14);
      doc.text('Ringkasan', 14, 55);
      doc.setFontSize(10);

      const summaryData = [
        ['Parameter', 'Min', 'Max', 'Rata-rata'],
        ['Suhu (°C)', 
          Math.min(...filteredData.map(d => d.temperature)).toFixed(1),
          Math.max(...filteredData.map(d => d.temperature)).toFixed(1),
          (filteredData.reduce((sum, d) => sum + d.temperature, 0) / filteredData.length).toFixed(1)
        ],
        ['Kelembaban (%)',
          Math.min(...filteredData.map(d => d.humidity)).toFixed(1),
          Math.max(...filteredData.map(d => d.humidity)).toFixed(1),
          (filteredData.reduce((sum, d) => sum + d.humidity, 0) / filteredData.length).toFixed(1)
        ],
        ['Amonia (ppm)',
          Math.min(...filteredData.map(d => d.ammonia)).toFixed(3),
          Math.max(...filteredData.map(d => d.ammonia)).toFixed(3),
          (filteredData.reduce((sum, d) => sum + d.ammonia, 0) / filteredData.length).toFixed(3)
        ],
        ['Metana (ppm)',
          Math.min(...filteredData.map(d => d.methane)).toFixed(2),
          Math.max(...filteredData.map(d => d.methane)).toFixed(2),
          (filteredData.reduce((sum, d) => sum + d.methane, 0) / filteredData.length).toFixed(2)
        ],
        ['H2S (ppm)',
          Math.min(...filteredData.map(d => d.h2s)).toFixed(4),
          Math.max(...filteredData.map(d => d.h2s)).toFixed(4),
          (filteredData.reduce((sum, d) => sum + d.h2s, 0) / filteredData.length).toFixed(4)
        ],
        ['Intensitas (lux)',
          Math.min(...filteredData.map(d => d.intensity)).toFixed(2),
          Math.max(...filteredData.map(d => d.intensity)).toFixed(2),
          (filteredData.reduce((sum, d) => sum + d.intensity, 0) / filteredData.length).toFixed(2)
        ]
      ];

      autoTable(doc, {
        head: [summaryData[0]],
        body: summaryData.slice(1),
        startY: 60,
        theme: 'grid',
        headStyles: { fillColor: [41, 128, 185], textColor: 255, fontStyle: 'bold' },
        styles: { fontSize: 8 }
      });

      doc.setFontSize(14);
      doc.text('Laporan Alert', 14, (doc as any).lastAutoTable.finalY + 20);
      doc.setFontSize(10);

      // Ringkasan Alert
      const alertSummaryData = [
        ['Parameter', 'Jumlah Alert'],
        ['Suhu', alertCounts.temperature.toString()],
        ['Kelembaban', alertCounts.humidity.toString()],
        ['Amonia', alertCounts.ammonia.toString()],
        ['Metana', alertCounts.methane.toString()],
        ['H2S', alertCounts.h2s.toString()],
        ['Intensitas', alertCounts.intensity.toString()]
      ];

      autoTable(doc, {
        head: [alertSummaryData[0]],
        body: alertSummaryData.slice(1),
        startY: (doc as any).lastAutoTable.finalY + 25,
        theme: 'grid',
        headStyles: { fillColor: [41, 128, 185], textColor: 255, fontStyle: 'bold' },
        styles: { fontSize: 8 }
      });

      // Distribusi Alert
      doc.setFontSize(14);
      doc.text('Distribusi Alert', 14, (doc as any).lastAutoTable.finalY + 20);
      doc.setFontSize(10);

      const alertDistributionData = alertPieData.map(item => [
        item.name,
        item.value.toString(),
        `${(item.value / Object.values(alertCounts).reduce((a, b) => a + b, 0) * 100).toFixed(1)}%`
      ]);

      autoTable(doc, {
        head: [['Parameter', 'Jumlah', 'Persentase']],
        body: alertDistributionData,
        startY: (doc as any).lastAutoTable.finalY + 25,
        theme: 'grid',
        headStyles: { fillColor: [41, 128, 185], textColor: 255, fontStyle: 'bold' },
        styles: { fontSize: 8 }
      });

      // Detail Data
      doc.setFontSize(14);
      doc.text('Detail Data', 14, (doc as any).lastAutoTable.finalY + 20);
      doc.setFontSize(10);

      const detailData = filteredData.map(data => [
        format(Number(data.timestamp), 'dd/MM/yyyy HH:mm:ss'),
        data.temperature.toFixed(1),
        data.humidity.toFixed(1),
        data.ammonia.toFixed(3),
        data.methane.toFixed(2),
        data.h2s.toFixed(4),
        data.intensity.toFixed(2)
      ]);

      autoTable(doc, {
        head: [['Waktu', 'Suhu (°C)', 'Kelembaban (%)', 'Amonia (ppm)', 'Metana (ppm)', 'H2S (ppm)', 'Intensitas (lux)']],
        body: detailData,
        startY: (doc as any).lastAutoTable.finalY + 25,
        theme: 'grid',
        headStyles: { fillColor: [41, 128, 185], textColor: 255, fontStyle: 'bold' },
        styles: { fontSize: 7 }
      });

      // Download PDF
      doc.save(`Laporan_Monitoring_${format(new Date(), 'dd-MM-yyyy')}.pdf`);
    } catch (error) {
      console.error('Error saat export ke PDF:', error);
      setError('Gagal mengekspor data ke PDF');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold tracking-tight">Laporan Monitoring</h1>
        <div className="flex items-center space-x-2">
          <Select value={dateRange} onValueChange={(value: '7days' | '30days' | 'custom') => {
            setDateRange(value);
            if (value === '7days') {
              setStartDate(subDays(new Date(), 7));
              setEndDate(new Date());
            } else if (value === '30days') {
              setStartDate(subDays(new Date(), 30));
              setEndDate(new Date());
            }
          }}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Pilih rentang waktu" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7days">7 Hari Terakhir</SelectItem>
              <SelectItem value="30days">30 Hari Terakhir</SelectItem>
              <SelectItem value="custom">Kustom</SelectItem>
            </SelectContent>
          </Select>

          {dateRange === 'custom' && (
            <div className="flex items-center space-x-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-[180px] justify-start text-left font-normal">
                    <Calendar className="mr-2 h-4 w-4" />
                    {startDate ? format(startDate, 'PPP', { locale: id }) : "Pilih tanggal"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={startDate}
                    onSelect={(date: Date | undefined) => date && setStartDate(date)}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              <span>-</span>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-[180px] justify-start text-left font-normal">
                    <Calendar className="mr-2 h-4 w-4" />
                    {endDate ? format(endDate, 'PPP', { locale: id }) : "Pilih tanggal"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={endDate}
                    onSelect={(date: Date | undefined) => date && setEndDate(date)}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="flex items-center">
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => exportToPDF()}>
                <FileText className="h-4 w-4 mr-2" />
                Export PDF
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => exportToExcel()}>
                <FileSpreadsheet className="h-4 w-4 mr-2" />
                Export Excel
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {isExporting && (
        <Alert>
          <Loader2 className="h-4 w-4 animate-spin" />
          <AlertTitle>Mengekspor Data</AlertTitle>
          <AlertDescription>Mohon tunggu sebentar...</AlertDescription>
        </Alert>
      )}

      <div>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="overview">Ringkasan</TabsTrigger>
            <TabsTrigger value="temperature">Suhu</TabsTrigger>
            <TabsTrigger value="humidity">Kelembaban</TabsTrigger>
            <TabsTrigger value="gases">Gas</TabsTrigger>
            <TabsTrigger value="alerts">Alert</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <Card>
                <CardHeader>
                  <CardTitle>Rata-rata Suhu</CardTitle>
                  <CardDescription>Periode {format(startDate, 'dd/MM/yyyy')} - {format(endDate, 'dd/MM/yyyy')}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {formatNumber(aggregatedData.reduce((acc, curr) => acc + curr.avgTemperature, 0) / aggregatedData.length)}°C
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Rata-rata Kelembaban</CardTitle>
                  <CardDescription>Periode {format(startDate, 'dd/MM/yyyy')} - {format(endDate, 'dd/MM/yyyy')}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {formatNumber(aggregatedData.reduce((acc, curr) => acc + curr.avgHumidity, 0) / aggregatedData.length)}%
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Total Alert</CardTitle>
                  <CardDescription>Jumlah peringatan dalam periode</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {Object.values(alertCounts).reduce((a, b) => a + b, 0)}
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Tren Parameter</CardTitle>
                <CardDescription>Grafik parameter selama periode</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[400px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={aggregatedData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Line type="monotone" dataKey="avgTemperature" name="Suhu (°C)" stroke="#8884d8" />
                      <Line type="monotone" dataKey="avgHumidity" name="Kelembaban (%)" stroke="#82ca9d" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="temperature" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Analisis Suhu</CardTitle>
                <CardDescription>Detail pengukuran suhu selama periode</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[400px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={aggregatedData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis domain={[0, 40]} />
                      <Tooltip />
                      <Legend />
                      <Line type="monotone" dataKey="avgTemperature" name="Suhu (°C)" stroke="#8884d8" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="humidity" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Analisis Kelembaban</CardTitle>
                <CardDescription>Detail pengukuran kelembaban selama periode</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[400px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={aggregatedData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis domain={[0, 100]} />
                      <Tooltip />
                      <Legend />
                      <Line type="monotone" dataKey="avgHumidity" name="Kelembaban (%)" stroke="#82ca9d" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="gases" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Analisis Gas</CardTitle>
                <CardDescription>Detail pengukuran gas-gas selama periode</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[400px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={aggregatedData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Line type="monotone" dataKey="avgAmmonia" name="Amonia (ppm)" stroke="#8884d8" />
                      <Line type="monotone" dataKey="avgMethane" name="Metana (ppm)" stroke="#82ca9d" />
                      <Line type="monotone" dataKey="avgH2s" name="H2S (ppm)" stroke="#ffc658" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="alerts" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Distribusi Alert</CardTitle>
                  <CardDescription>Sebaran alert berdasarkan parameter</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={alertPieData}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="value"
                        >
                          {alertPieData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Ringkasan Alert</CardTitle>
                  <CardDescription>Jumlah alert per parameter</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {Object.entries(alertCounts).map(([key, value]) => (
                      <div key={key} className="flex justify-between items-center">
                        <span className="capitalize">{key}</span>
                        <span className="font-bold">{value}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
