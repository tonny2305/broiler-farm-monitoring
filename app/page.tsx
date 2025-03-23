'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Badge } from '@/components/ui/badge';
import { Progress } from "@/components/ui/progress"
import { onValue, get } from 'firebase/database';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { MoonIcon, SunIcon, AlertTriangleIcon, UserCogIcon, CalendarDaysIcon, LogOutIcon } from 'lucide-react';
import { useTheme } from 'next-themes';
import { getSensorDataRef, getChickenDataRef } from '@/lib/firebase';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';

// Tipe data untuk sensor (setelah diproses)
interface SensorData {
  ammonia: number;
  humidity: number;
  intensity: number;
  temperature: number;
  methane: number;
  h2s: number;
  timestamp: number | string;
}

// Tipe data dari Firebase (mentah)
interface FirebaseSensorData {
  ammonia: number;
  humidity: number;
  intensity: number;
  temperature: number;
  ch4: number; // Data dari Firebase menggunakan ch4
  h2s: number;
  timestamp: number | string;
}

// Tipe data untuk data firebase
interface FirebaseData {
  [key: string]: {
    [key: string]: any;
  };
}

// Tipe data untuk batch ayam
interface ChickenBatch {
  id: string;
  hatchDate: string;
  quantity: number;
  notes?: string;
  createdAt: number;
  ageInDays: number;
}

export default function DashboardPage() {
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const router = useRouter();
  // State untuk menyimpan data sensor
  const [sensorData, setSensorData] = useState<SensorData[]>([]);
  const [chickenBatches, setChickenBatches] = useState<ChickenBatch[]>([]);
  const [selectedBatchId, setSelectedBatchId] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTimeRange, setSelectedTimeRange] = useState<string>('24h');
  const [mounted, setMounted] = useState(false);
  const { theme, setTheme } = useTheme();
  // Ubah default parameter yang dipilih menjadi hanya suhu
  const [selectedParameters, setSelectedParameters] = useState<string[]>(['temperature']);

  // Fungsi untuk menangani perubahan parameter yang dipilih
  const handleParameterChange = (parameter: string) => {
    setSelectedParameters(prev => {
      if (prev.includes(parameter)) {
        return prev.filter(p => p !== parameter);
      } else {
        return [...prev, parameter];
      }
    });
  };

  // Fungsi untuk mendapatkan warna parameter
  const getParameterColor = (parameter: string) => {
    switch (parameter) {
      case 'temperature':
        return '#f59e0b';
      case 'humidity':
        return '#3b82f6';
      case 'ammonia':
        return '#10b981';
      case 'methane':
        return '#6366f1';
      case 'h2s':
        return '#8b5cf6';
      case 'intensity':
        return '#ec4899';
      default:
        return '#000000';
    }
  };

  // Fungsi untuk mendapatkan label parameter
  const getParameterLabel = (parameter: string) => {
    switch (parameter) {
      case 'temperature':
        return 'Suhu';
      case 'humidity':
        return 'Kelembaban';
      case 'ammonia':
        return 'Amonia';
      case 'methane':
        return 'Metana';
      case 'h2s':
        return 'H2S';
      case 'intensity':
        return 'Intensitas';
      default:
        return parameter;
    }
  };

  // Fungsi untuk mendapatkan unit parameter
  const getParameterUnit = (parameter: string) => {
    switch (parameter) {
      case 'temperature':
        return '°C';
      case 'humidity':
        return '%';
      case 'ammonia':
      case 'methane':
      case 'h2s':
        return 'ppm';
      case 'intensity':
        return 'lux';
      default:
        return '';
    }
  };

  // Fungsi untuk konversi timestamp ke format waktu
  const formatTimestamp = (timestamp: number | string) => {
    if (!timestamp) return 'Tidak tersedia';
    try {
      // Jika timestamp adalah string dengan format "YYYY-M-D H:M:S"
      if (typeof timestamp === 'string' && timestamp.includes('-')) {
        return new Date(timestamp).toLocaleString('id-ID', {
          hour: '2-digit',
          minute: '2-digit'
        });
      }
      
      // Jika timestamp berupa angka
      const numTimestamp = Number(timestamp);
      // Jika timestamp dalam format detik (Unix timestamp)
      if (numTimestamp < 10000000000) {
        const date = new Date(numTimestamp * 1000);
        return date.toLocaleString('id-ID', {
          hour: '2-digit',
          minute: '2-digit'
        });
      } else {
        // Jika timestamp dalam format milidetik
        const date = new Date(numTimestamp);
        return date.toLocaleString('id-ID', {
          hour: '2-digit',
          minute: '2-digit'
        });
      }
    } catch (error) {
      console.error('Error saat memformat timestamp:', error, timestamp);
      return 'Format waktu error';
    }
  };

  // Fungsi untuk format timestamp lengkap (tanggal dan waktu)
  const formatDetailedTimestamp = (timestamp: number | string) => {
    if (!timestamp) return 'Tidak tersedia';
    try {
      // Jika timestamp adalah string dengan format "YYYY-M-D H:M:S"
      if (typeof timestamp === 'string' && timestamp.includes('-')) {
        return new Date(timestamp).toLocaleString('id-ID', {
          day: '2-digit',
          month: 'long',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          timeZoneName: 'short'
        });
      }
      
      // Jika timestamp berupa angka
      const numTimestamp = Number(timestamp);
      // Jika timestamp dalam format detik (Unix timestamp)
      if (numTimestamp < 10000000000) {
        const date = new Date(numTimestamp * 1000);
        return date.toLocaleString('id-ID', {
          day: '2-digit',
          month: 'long',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          timeZoneName: 'short'
        });
      } else {
        // Jika timestamp dalam format milidetik
        const date = new Date(numTimestamp);
        return date.toLocaleString('id-ID', {
          day: '2-digit',
          month: 'long',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          timeZoneName: 'short'
        });
      }
    } catch (error) {
      console.error('Error saat memformat timestamp lengkap:', error, timestamp);
      return 'Format waktu error';
    }
  };

  // Inisialisasi Firebase dan baca data sensor dan batch ayam
  useEffect(() => {
    try {
      // Ambil data sensor
      const sensorRef = getSensorDataRef();

      onValue(sensorRef, (snapshot) => {
        try {
          const data: FirebaseData = snapshot.val() || {};
          const formattedData: SensorData[] = [];

          // Memproses data dari Firebase
          Object.keys(data).forEach(key => {
            // Periksa apakah key dimulai dengan "data_ke_"
            if (key.startsWith('data_ke_')) {
              const entry = data[key];
              if (entry) {
                // Konversi timestamp ke format yang benar
                let timestamp: string | number;
                
                // Jika timestamp adalah string dengan format "YYYY-M-D H:M:S"
                if (typeof entry.timestamp === 'string' && entry.timestamp.includes('-')) {
                  // Timestamp sudah dalam format yang benar, gunakan timestamp string
                  timestamp = entry.timestamp;
                } else {
                  // Konversi ke angka
                  timestamp = Number(entry.timestamp) || 0;
                  // Jika timestamp tidak valid, skip data ini
                  if (timestamp < 1000) {
                    console.warn('Timestamp tidak valid:', entry.timestamp);
                    return; // Skip data ini dan lanjut ke iterasi berikutnya
                  }
                }

                // Pastikan semua nilai numerik valid
                const processedEntry: SensorData = {
                  ammonia: Number(entry.ammonia) || 0,
                  humidity: Number(entry.humidity) || 0,
                  intensity: Number(entry.intensity) || 0,
                  temperature: Number(entry.temperature) || 0,
                  methane: Number(entry.ch4) || 0,
                  h2s: Number(entry.h2s) || 0,
                  timestamp: timestamp
                };

                // Hanya tambahkan data jika setidaknya satu sensor memiliki nilai
                if (Object.values(processedEntry).some(val => typeof val === 'number' && val > 0)) {
                  formattedData.push(processedEntry);
                }
              }
            }
          });
          // Mengurutkan data berdasarkan timestamp
          formattedData.sort((a, b) => {
            const timestampA = typeof a.timestamp === 'string' ? new Date(a.timestamp).getTime() : Number(a.timestamp);
            const timestampB = typeof b.timestamp === 'string' ? new Date(b.timestamp).getTime() : Number(b.timestamp);
            return timestampB - timestampA;
          });

          if (formattedData.length > 0) {
            setSensorData(formattedData);
            setLoading(false);
          } else {
            setError('Tidak ada data sensor yang tersedia');
            setLoading(false);
          }
        } catch (err) {
          console.error('Error processing sensor data:', err);
          setError('Terjadi kesalahan saat memproses data sensor');
          setLoading(false);
        }
      }, (err) => {
        setError('Terjadi kesalahan saat membaca data.');
        setLoading(false);
      });

      // Ambil data batch ayam
      const chickenRef = getChickenDataRef();
      onValue(chickenRef, (snapshot) => {
        try {
          const data = snapshot.val();
          if (data) {
            const batches: ChickenBatch[] = [];
            Object.keys(data).forEach(key => {
              const batch = data[key];
              if (batch.hatchDate) {
                const hatchDate = new Date(batch.hatchDate);
                const today = new Date();
                const ageInDays = Math.floor((today.getTime() - hatchDate.getTime()) / (1000 * 60 * 60 * 24));
                
                batches.push({
                  id: key,
                  hatchDate: batch.hatchDate,
                  quantity: batch.quantity || 0,
                  notes: batch.notes,
                  createdAt: batch.createdAt || 0,
                  ageInDays: ageInDays
                });
              }
            });
            
            // Urutkan berdasarkan tanggal menetas (terbaru di atas)
            batches.sort((a, b) => new Date(b.hatchDate).getTime() - new Date(a.hatchDate).getTime());
            setChickenBatches(batches);
            
            // Atur batch terbaru sebagai default batch yang dipilih
            if (batches.length > 0 && !selectedBatchId) {
              setSelectedBatchId(batches[0].id);
            }
          }
        } catch (err) {
          // Logging kesalahan tanpa memblokir tampilan utama
        }
      });
    } catch (err) {
      setError('Terjadi kesalahan saat menginisialisasi Firebase.');
      setLoading(false);
    }
  }, []);

  // Setelah komponen dimount (di sisi client), set mounted ke true
  useEffect(() => {
    setMounted(true);
  }, []);

  // Filter data berdasarkan rentang waktu yang dipilih
  const getFilteredData = () => {
    if (!sensorData || sensorData.length === 0) return [];
    
    // Gunakan timestamp dari data sensor terbaru (dari Firebase) sebagai referensi waktu saat ini
    const latestDataTimestamp = sensorData[0].timestamp;
    let referenceTimestamp: number;
    
    if (typeof latestDataTimestamp === 'string' && latestDataTimestamp.includes('-')) {
      referenceTimestamp = new Date(latestDataTimestamp).getTime();
    } else {
      const numTimestamp = Number(latestDataTimestamp);
      referenceTimestamp = numTimestamp < 10000000000 ? 
        numTimestamp * 1000 : numTimestamp;
    }
    
    let timeFilter: number;
    
    switch (selectedTimeRange) {
      case '1h':
        timeFilter = 60 * 60 * 1000;
        break;
      case '6h':
        timeFilter = 6 * 60 * 60 * 1000;
        break;
      case '24h':
        timeFilter = 24 * 60 * 60 * 1000;
        break;
      case '7d':
        timeFilter = 7 * 24 * 60 * 60 * 1000;
        break;
      case '30d':
        timeFilter = 30 * 24 * 60 * 60 * 1000;
        break;
      default:
        timeFilter = 24 * 60 * 60 * 1000;
    }
    
    // Filter dan format data
    return sensorData
      .filter(data => {
        let dataTimestamp: number;
        
        if (typeof data.timestamp === 'string' && data.timestamp.includes('-')) {
          dataTimestamp = new Date(data.timestamp).getTime();
        } else {
          const numTimestamp = Number(data.timestamp);
          dataTimestamp = numTimestamp < 10000000000 ? 
            numTimestamp * 1000 : numTimestamp;
        }
        
        // Bandingkan dengan timestamp data terakhir, bukan waktu saat ini
        return Math.abs(referenceTimestamp - dataTimestamp) <= timeFilter;
      })
      .map(data => ({
        ...data,
        time: formatTimestamp(data.timestamp),
        temperature: Number(data.temperature) || 0,
        humidity: Number(data.humidity) || 0,
        ammonia: Number(data.ammonia) || 0,
        methane: Number(data.methane) || 0,
        h2s: Number(data.h2s) || 0,
        intensity: Number(data.intensity) || 0
      }))
      .sort((a, b) => {
        // Sorting berdasarkan timestamp
        let timestampA: number, timestampB: number;
        
        if (typeof a.timestamp === 'string' && a.timestamp.includes('-')) {
          timestampA = new Date(a.timestamp).getTime();
        } else {
          const numTimestampA = Number(a.timestamp);
          timestampA = numTimestampA < 10000000000 ? 
            numTimestampA * 1000 : numTimestampA;
        }
        
        if (typeof b.timestamp === 'string' && b.timestamp.includes('-')) {
          timestampB = new Date(b.timestamp).getTime();
        } else {
          const numTimestampB = Number(b.timestamp);
          timestampB = numTimestampB < 10000000000 ? 
            numTimestampB * 1000 : numTimestampB;
        }
        
        return timestampA - timestampB; // Urutkan dari yang lama ke baru untuk grafik
      });
  };

  // Mengambil data terbaru
  const getLatestData = () => {
    if (!sensorData || sensorData.length === 0) return null;
    
    // Data sudah diurutkan dari yang terbaru di atas
    const latest = sensorData[0];
    return {
      ...latest,
      temperature: Number(latest.temperature) || 0,
      humidity: Number(latest.humidity) || 0,
      ammonia: Number(latest.ammonia) || 0,
      methane: Number(latest.methane) || 0,
      h2s: Number(latest.h2s) || 0,
      intensity: Number(latest.intensity) || 0
    };
  };

  // Format angka dengan desimal yang tepat
  const formatValue = (value: number | undefined | null, decimal: number = 1): string => {
    if (value === undefined || value === null) return '0';
    return Number(value).toFixed(decimal);
  };

  // Membuat data untuk grafik
  const chartData = getFilteredData();

  // Data terbaru untuk kartu status
  const latestData = getLatestData();

  // Tambahkan fungsi untuk mendapatkan batch yang dipilih
  const getSelectedBatch = () => {
    if (!selectedBatchId && chickenBatches.length > 0) {
      return chickenBatches[0];
    }
    return chickenBatches.find(batch => batch.id === selectedBatchId) || null;
  };

  // Tambahkan fungsi untuk mendapatkan umur ayam dari batch yang dipilih
  const getSelectedBatchAge = () => {
    const selectedBatch = getSelectedBatch();
    if (!selectedBatch) return 14; // Default jika tidak ada batch
    return selectedBatch.ageInDays;
  };
  
  // Ganti fungsi getLatestBatchAge dengan getSelectedBatchAge untuk konsistensi
  const getLatestBatchAge = getSelectedBatchAge;

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

  // Fungsi untuk mendapatkan label status batch
  const getBatchStatusLabel = (status: string) => {
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

  // Fungsi untuk mendapatkan warna status batch
  const getBatchStatusColor = (status: string) => {
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

  // Fungsi untuk mengecek status parameter
  const getParameterStatus = (value: number, type: keyof SensorData) => {
    // Dapatkan umur ayam terbaru (dalam hari)
    const chickenAge = getLatestBatchAge();
    
    switch (type) {
      case 'temperature':
        // Kategori berdasarkan suhu dan umur ayam sesuai dengan tabel
        if (chickenAge <= 7) {
          // Minggu pertama (1-7 hari)
          return value >= 32 && value <= 35 ? 'aman' : 
                 (value >= 30 && value < 32) || (value > 35 && value <= 37) ? 'berisiko' : 'bahaya';
        } else if (chickenAge <= 14) {
          // Minggu kedua (8-14 hari)
          return value >= 28 && value <= 30 ? 'aman' : 
                 (value >= 26 && value < 28) || (value > 30 && value <= 32) ? 'berisiko' : 'bahaya';
        } else if (chickenAge <= 21) {
          // Minggu ketiga (15-21 hari)
          return value >= 24 && value <= 26 ? 'aman' : 
                 (value >= 22 && value < 24) || (value > 26 && value <= 28) ? 'berisiko' : 'bahaya';
        } else if (chickenAge <= 42) {
          // Minggu keempat dan seterusnya (22-42 hari)
          return value >= 18 && value <= 24 ? 'aman' : 
                 (value >= 16 && value < 18) || (value > 24 && value <= 26) ? 'berisiko' : 'bahaya';
        } else {
          // Ayam broiler dewasa (>42 hari)
          return value >= 18 && value <= 24 ? 'aman' : 
                 (value >= 16 && value < 18) || (value > 24 && value <= 26) ? 'berisiko' : 'bahaya';
        }
        
      case 'humidity':
        // Kategori berdasarkan kelembaban - tetap 50-70% sebagai nilai ideal untuk semua umur
        return value >= 50 && value <= 70 ? 'aman' : 
               (value >= 40 && value < 50) || (value > 70 && value <= 80) ? 'berisiko' : 'bahaya';
        
      case 'intensity':
        // Kategori berdasarkan intensitas cahaya dan umur ayam
        if (chickenAge <= 7) {
          // 1-7 hari
          return value >= 20 && value <= 40 ? 'aman' : value < 20 ? 'berisiko' : 'bahaya';
        } else if (chickenAge <= 21) {
          // 8-21 hari
          return value >= 10 && value <= 20 ? 'aman' : value < 10 ? 'berisiko' : 'bahaya';
        } else {
          // >21 hari (Dewasa)
          return value >= 5 && value <= 10 ? 'aman' : value < 5 ? 'berisiko' : 'bahaya';
        }
        
      case 'ammonia':
        // Kategori berdasarkan amonia (ppm)
        return value < 10 ? 'aman' : value >= 10 && value <= 25 ? 'berisiko' : 'bahaya';
        
      case 'methane':
        // Kategori berdasarkan metana (ppm)
        return value < 1.65 ? 'aman' : value >= 1.65 && value <= 2.5 ? 'berisiko' : 'bahaya';
        
      case 'h2s':
        // Kategori berdasarkan hidrogen sulfida (ppm)
        return value < 0.1 ? 'aman' : value >= 0.1 && value <= 2 ? 'berisiko' : 'bahaya';
        
      default:
        return 'aman';
    }
  };

  // Fungsi untuk mendapatkan warna status
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'aman':
        return 'text-green-500';
      case 'berisiko':
        return 'text-amber-500';
      case 'bahaya':
        return 'text-red-500';
      default:
        return 'text-green-500';
    }
  };

  // Fungsi untuk mendapatkan warna latar progress bar
  const getProgressBarColor = (status: string) => {
    switch (status) {
      case 'aman':
        return '[&>div]:bg-green-500';
      case 'berisiko':
        return '[&>div]:bg-amber-500';
      case 'bahaya':
        return '[&>div]:bg-red-500';
      default:
        return '[&>div]:bg-green-500';
    }
  };

  // Fungsi untuk mendapatkan label status
  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'aman':
        return 'Aman';
      case 'berisiko':
        return 'Berisiko';
      case 'bahaya':
        return 'Bahaya';
      default:
        return 'Aman';
    }
  };

  // Fungsi untuk menghitung nilai progress bar berdasarkan parameter
  const getProgressValue = (value: number, type: keyof SensorData) => {
    switch (type) {
      case 'temperature':
        return ((value / 40) * 100);
      case 'humidity':
        return value; // Kelembaban sudah dalam persentase
      case 'ammonia':
        return ((value / 30) * 100); // Maksimal 30 ppm
      case 'methane':
        return ((value / 3) * 100); // Maksimal 3 ppm
      case 'h2s':
        return ((value / 3) * 100); // Maksimal 3 ppm
      case 'intensity':
        return ((value / 50) * 100); // Maksimal 50 lux
      default:
        return 0;
    }
  };

  // Fungsi untuk mendapatkan rentang nilai ideal
  const getIdealRange = (type: keyof SensorData) => {
    const chickenAge = getLatestBatchAge();
    
    switch (type) {
      case 'temperature':
        if (chickenAge <= 7) return "32°C - 35°C";
        else if (chickenAge <= 14) return "28°C - 30°C";
        else if (chickenAge <= 21) return "24°C - 26°C";
        else return "18°C - 24°C";
      case 'humidity':
        return "50% - 70%";
      case 'ammonia':
        return "< 10 ppm";
      case 'methane':
        return "< 1.65 ppm";
      case 'h2s':
        return "< 0.1 ppm";
      case 'intensity':
        if (chickenAge <= 7) return "20 - 40 lux";
        else if (chickenAge <= 21) return "10 - 20 lux";
        else return "5 - 10 lux";
      default:
        return "";
    }
  };

  // Fungsi untuk logout
  const handleLogout = async () => {
    try {
      const auth = getAuth();
      await auth.signOut();
      router.push('/login');
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  // Cek status login
  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setIsAdmin(!!user);
    });

    return () => unsubscribe();
  }, []);

  return (
    <div className="container mx-auto p-2">
      <div className="flex justify-between items-center mb-2 rounded-2xl bg-gradient-to-r from-amber-600 via-amber-400 to-orange-400 p-6 shadow-lg border border-amber-200/50">
        <h1 className="text-3xl font-bold text-white bg-clip-text dark:text-amber-950">Monitoring Peternakan Ayam Broiler</h1>
        <div className="flex space-x-2">
          {!isAdmin ? (
            <Button variant="default" className="bg-gradient-to-r  hover:from-amber-600 hover:to-orange-500 text-white  transition-all duration-300 dark:text-amber-950" asChild>
              <Link href="/login" className="flex items-center">
                <UserCogIcon className="h-5 w-5 mr-2" />
                <span className="hidden md:inline">Admin</span>
              </Link>
            </Button>
          ) : (
            <Button 
              variant="default" 
              className="bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white dark:text-amber-950  transition-all duration-300"
              onClick={handleLogout}
            >
              <LogOutIcon className="h-5 w-5 mr-2" />
              <span className="hidden md:inline">Logout</span>
            </Button>
          )}
          <Button 
            variant="default" 
            size="icon" 
            className="bg-gradient-to-r  hover:from-amber-600 hover:to-orange-500 text-white dark:text-amber-950 transition-all duration-300 rounded-full" 
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          >
            {mounted && (theme === 'dark' ? <SunIcon className="h-5 w-5" /> : <MoonIcon className="h-5 w-5" />)}
          </Button>
        </div>
      </div>

      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertTriangleIcon className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {!mounted ? (
        <Card>
          <CardContent className="pt-6">
            <div className="flex justify-center items-center h-40">
              <p>Memuat aplikasi...</p>
            </div>
          </CardContent>
        </Card>
      ) : loading ? (
        <Card>
          <CardContent className="pt-6">
            <div className="flex justify-center items-center h-40">
              <p>Memuat data sensor...</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Informasi Batch Ayam (Ringkas) */}
          {chickenBatches.length > 0 && (
            <div className="flex flex-col gap-2 rounded-lg p-2 mt-1 mb-2">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
  <h2 className="text-lg font-semibold">Batch Ayam Aktif</h2>
  <Badge
    className={cn(
      "rounded-md px-2 py-1",
      getBatchStatusColor(getBatchStatus(getSelectedBatchAge()))
    )}
  >
    {getBatchStatusLabel(getBatchStatus(getSelectedBatchAge()))}
  </Badge>
  <p className="text-sm text-muted-foreground">
    {getSelectedBatch()?.quantity || 0} ekor • Umur {getSelectedBatchAge() || 0} hari
  </p> {chickenBatches.map(batch => (
                  <Button
                    key={batch.id}
                    variant={selectedBatchId === batch.id ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSelectedBatchId(batch.id)}
                  >
                    {batch.id}
                  </Button>
                ))}
                </div>

                {getLatestData() && (
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">
                      Pembaruan data terakhir:
                    </p>
                    <p className="text-sm font-medium">
                      {formatDetailedTimestamp(getLatestData()?.timestamp ?? '')}
                    </p>
                  </div>
                )}
              </div>
             
             
            </div>
          )}

          <div className="flex flex-col lg:flex-row gap-4">
            <div className="lg:w-1/2">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-4 mb-2">
                <Card>
                  <CardHeader className="">
                    <CardTitle>Temperature</CardTitle> 
                    
                  </CardHeader>
                  <CardContent>
                    <div className="flex gap-1">
                      <p className="text-2xl font-bold">{formatValue(latestData?.temperature, 1)}<span className="text-xl"> °C</span></p>
                      {latestData && (
                        <div className="flex flex-col gap-1">
                          <Badge 
                            className={`self-center ${getStatusColor(getParameterStatus(latestData?.temperature ?? 0, 'temperature'))}`} 
                            variant="outline"
                          >
                            {getStatusLabel(getParameterStatus(latestData?.temperature ?? 0, 'temperature'))}
                          </Badge>
                          
                          
                        </div>
                      )}
                    </div>
                    <Progress 
                            value={getProgressValue(latestData?.temperature ?? 0, 'temperature')} 
                            className={`h-2 mt-1 ${getProgressBarColor(getParameterStatus(latestData?.temperature ?? 0, 'temperature'))}`}
                          />
                    <p className="text-xs text-muted-foreground mt-1">Nilai ideal: {getIdealRange('temperature')}</p>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader className="pb-1">
                    <CardTitle>Humidity</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex gap-1">
                      <p className="text-2xl font-bold">{formatValue(latestData?.humidity, 1)}<span className="text-xl"> %</span></p>
                      {latestData && (
                        <div className="flex flex-col gap-1">
                          <Badge 
                            className={`self-center ${getStatusColor(getParameterStatus(latestData?.humidity ?? 0, 'humidity'))}`} 
                            variant="outline"
                          >
                            {getStatusLabel(getParameterStatus(latestData?.humidity ?? 0, 'humidity'))}
                          </Badge>
                          
                          
                        </div>
                      )}
                    </div>
                    <Progress 
                            value={getProgressValue(latestData?.humidity ?? 0, 'humidity')} 
                            className={`h-2 mt-1 ${getProgressBarColor(getParameterStatus(latestData?.humidity ?? 0, 'humidity'))}`}
                          />
                    <p className="text-xs text-muted-foreground mt-1">Nilai ideal: {getIdealRange('humidity')}</p>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader className="pb-1">
                    <CardTitle>Ammonia (NH₃)</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex gap-1">
                      <p className="text-2xl font-bold">{formatValue(latestData?.ammonia, 3)}<span className="text-xl"> ppm</span></p>
                      {latestData && (
                        <div className="flex flex-col gap-1">
                          <Badge 
                            className={`self-center ${getStatusColor(getParameterStatus(latestData?.ammonia ?? 0, 'ammonia'))}`} 
                            variant="outline"
                          >
                            {getStatusLabel(getParameterStatus(latestData?.ammonia ?? 0, 'ammonia'))}
                          </Badge>
                          
                         
                        </div>
                      )}
                    </div>
                    <Progress 
                            value={getProgressValue(latestData?.ammonia ?? 0, 'ammonia')} 
                            className={`h-2 mt-1 ${getProgressBarColor(getParameterStatus(latestData?.ammonia ?? 0, 'ammonia'))}`}
                          />
                    <p className="text-xs text-muted-foreground mt-1">Nilai ideal: {getIdealRange('ammonia')}</p>
                  </CardContent>
                </Card>
              
                <Card>
                  <CardHeader className="pb-1">
                    <CardTitle>Methane (CH₄)</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex gap-1">
                      <p className="text-2xl font-bold">{formatValue(latestData?.methane, 2)}<span className="text-xl"> ppm</span></p>
                      {latestData && (
                        <div className="flex flex-col gap-1">
                          <Badge 
                            className={`self-center ${getStatusColor(getParameterStatus(latestData?.methane ?? 0, 'methane'))}`} 
                            variant="outline"
                          >
                            {getStatusLabel(getParameterStatus(latestData?.methane ?? 0, 'methane'))}
                          </Badge>
                          
                          
                        </div>
                      )}
                    </div>
                    <Progress 
                            value={getProgressValue(latestData?.methane ?? 0, 'methane')} 
                            className={`h-2 mt-1 ${getProgressBarColor(getParameterStatus(latestData?.methane ?? 0, 'methane'))}`}
                          />
                    <p className="text-xs text-muted-foreground mt-1">Nilai ideal: {getIdealRange('methane')}</p>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader className="pb-1">
                    <CardTitle>Hydrogen Sulfide (H₂S)</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex gap-1">
                      <p className="text-2xl font-bold">{formatValue(latestData?.h2s, 3)}<span className="text-xl"> ppm</span></p>
                      {latestData && (
                        <div className="flex flex-col gap-1">
                          <Badge 
                            className={`self-center ${getStatusColor(getParameterStatus(latestData?.h2s ?? 0, 'h2s'))}`} 
                            variant="outline"
                          >
                            {getStatusLabel(getParameterStatus(latestData?.h2s ?? 0, 'h2s'))}
                          </Badge>
                          
                         
                        </div>
                      )}
                    </div>
                    <Progress 
                            value={getProgressValue(latestData?.h2s ?? 0, 'h2s')} 
                            className={`h-2 mt-1 ${getProgressBarColor(getParameterStatus(latestData?.h2s ?? 0, 'h2s'))}`}
                          />
                    <p className="text-xs text-muted-foreground mt-1">Nilai ideal: {getIdealRange('h2s')}</p>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader className="pb-1">
                    <CardTitle>Light Intensity</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex gap-1">
                      <p className="text-2xl font-bold">{formatValue(latestData?.intensity, 2)}<span className="text-xl"> lux</span></p>
                      {latestData && (
                        <div className="flex flex-col gap-1">
                          <Badge 
                            className={`self-center ${getStatusColor(getParameterStatus(latestData?.intensity ?? 0, 'intensity'))}`} 
                            variant="outline"
                          >
                            {getStatusLabel(getParameterStatus(latestData?.intensity ?? 0, 'intensity'))}
                          </Badge>
                          
                          
                        </div>
                      )}
                    </div>
                    <Progress 
                            value={getProgressValue(latestData?.intensity ?? 0, 'intensity')} 
                            className={`h-2 mt-1 ${getProgressBarColor(getParameterStatus(latestData?.intensity ?? 0, 'intensity'))}`}
                          />
                    <p className="text-xs text-muted-foreground mt-1">Nilai ideal: {getIdealRange('intensity')}</p>
                  </CardContent>
                </Card>
              </div>
            </div>
            
            <div className="lg:w-1/2">
              <Card>
                <CardHeader>
                  <div className="flex justify-between items-center">
                    <CardTitle>Grafik Parameter Sensor</CardTitle>
                    <Select value={selectedTimeRange} onValueChange={setSelectedTimeRange}>
                      <SelectTrigger className="w-[160px]">
                        <SelectValue>
                          {selectedTimeRange === '1h' ? '1 Jam Terakhir' :
                           selectedTimeRange === '6h' ? '6 Jam Terakhir' :
                           selectedTimeRange === '24h' ? '24 Jam Terakhir' :
                           selectedTimeRange === '7d' ? '7 Hari Terakhir' :
                           '30 Hari Terakhir'}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1h">1 Jam Terakhir</SelectItem>
                        <SelectItem value="6h">6 Jam Terakhir</SelectItem>
                        <SelectItem value="24h">24 Jam Terakhir</SelectItem>
                        <SelectItem value="7d">7 Hari Terakhir</SelectItem>
                        <SelectItem value="30d">30 Hari Terakhir</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    <div className="flex flex-wrap gap-2 p-0 bg-gray-100/50 dark:bg-gray-800/50 rounded-xl">
                      {['temperature', 'humidity', 'ammonia', 'methane', 'h2s', 'intensity'].map((parameter) => (
                        <div 
                          key={parameter} 
                          className={cn(
                            "flex items-center gap-2 px-2 py-2 rounded-sm transition-all duration-200 cursor-pointer",
                            selectedParameters.includes(parameter) 
                              ? "bg-amber-500/90 text-white shadow-md" 
                              : "bg-white dark:bg-neutral-800 hover:bg-amber-50 dark:hover:bg-gray-600 shadow-sm"
                          )}
                          onClick={() => handleParameterChange(parameter)}
                        >
                          <div className="relative flex items-center justify-center">
                            <input
                              type="checkbox"
                              id={parameter}
                              checked={selectedParameters.includes(parameter)}
                              onChange={() => {}}
                              className="peer sr-only"
                            />
                            <div className={cn(
                              "h-4 w-4 rounded-sm border transition-all duration-200",
                              selectedParameters.includes(parameter)
                                ? "border-white bg-white/20"
                                : "border-gray-300 dark:border-gray-500"
                            )}>
                              <svg
                                className={cn(
                                  "h-4 w-4 transition-all duration-200",
                                  selectedParameters.includes(parameter)
                                    ? "text-white opacity-100 scale-100"
                                    : "opacity-0 scale-90"
                                )}
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                                strokeWidth={3}
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  d="M5 13l4 4L19 7"
                                />
                              </svg>
                            </div>
                          </div>
                          <label
                            htmlFor={parameter}
                            className={cn(
                              "text-sm font-medium select-none",
                              selectedParameters.includes(parameter)
                                ? "text-white"
                                : "text-gray-700 dark:text-gray-200"
                            )}
                          >
                            {getParameterLabel(parameter)}
                          </label>
                        </div>
                      ))}
                    </div>
                    <div className="h-[265px] w-full p-0">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                          <XAxis 
                            dataKey="time" 
                            angle={-45}
                            textAnchor="end"
                            height={60}
                            interval={Math.floor(chartData.length / 6)}
                            tick={{ fill: '#6b7280', fontSize: 12 }}
                          />
                          <YAxis 
                            yAxisId="main"
                            label={{ 
                              value: selectedParameters.map(param => {
                                switch(param) {
                                  case 'temperature':
                                    return '°C';
                                  case 'humidity':
                                    return '%';
                                  case 'ammonia':
                                  case 'methane':
                                  case 'h2s':
                                    return 'ppm';
                                  case 'intensity':
                                    return 'lux';
                                  default:
                                    return '';
                                }
                              }).filter((value, index, self) => self.indexOf(value) === index).join('\n'),
                              position: 'insideLeft', 
                              offset: -10, 
                              fill: '#6b7280',
                              angle: -90,
                            }}
                            domain={['auto', 'auto']}
                            tick={{ fill: '#6b7280', fontSize: 12 }}
                          />
                          <Tooltip 
                            formatter={(value: any, name: string) => {
                              const unit = getParameterUnit(name);
                              return [`${Number(value).toFixed(2)} ${unit}`, getParameterLabel(name)];
                            }}
                            labelFormatter={(label) => {
                              const dataPoint = chartData.find(d => d.time === label);
                              if (dataPoint) {
                                return formatDetailedTimestamp(dataPoint.timestamp);
                              }
                              return label;
                            }}
                            contentStyle={{
                              backgroundColor: 'rgba(255, 255, 255, 0.95)',
                              border: 'none',
                              borderRadius: '0.75rem',
                              boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
                              padding: '12px'
                            }}
                            labelStyle={{
                              color: '#111827',
                              fontWeight: '600',
                              fontSize: '0.875rem',
                              marginBottom: '4px'
                            }}
                            itemStyle={{
                              color: '#374151',
                              fontSize: '0.875rem',
                              padding: '4px 0'
                            }}
                          />
                          <Legend 
                            verticalAlign="top"
                            height={36}
                            wrapperStyle={{
                              paddingBottom: '10px'
                            }}
                          />
                          {selectedParameters.map((parameter) => (
                            <Line
                              key={parameter}
                              yAxisId="main"
                              type="monotone"
                              dataKey={parameter}
                              stroke={getParameterColor(parameter)}
                              name={getParameterLabel(parameter)}
                              dot={false}
                              strokeWidth={2.5}
                              activeDot={{ r: 6, strokeWidth: 0 }}
                            />
                          ))}
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          <div className="flex flex-col lg:flex-row gap-4 mt-4">
          <div className="lg:w-full">
          <Card className="border border-border/50 shadow-lg rounded-2xl pt-0 bg-card text-card-foreground">
          <CardHeader className="bg-gradient-to-r from-amber-600 via-amber-500 to-orange-500 text-white rounded-t-2xl p-4">
            <div className="flex justify-between items-center">
              <div>
                <CardTitle className="text-lg font-semibold text-white dark:text-amber-950">Statistik</CardTitle>
                <CardDescription className="text-sm opacity-90 text-white/80 dark:text-amber-950">
                  Ringkasan statistik parameter dalam{' '}
                  {selectedTimeRange === '1h' ? '1 jam' :
                   selectedTimeRange === '6h' ? '6 jam' :
                   selectedTimeRange === '24h' ? '24 jam' :
                   selectedTimeRange === '7d' ? '7 hari' : '30 hari'} terakhir
                </CardDescription>
              </div>
              <Select value={selectedTimeRange} onValueChange={setSelectedTimeRange}>
              <SelectTrigger className="w-[180px] bg-white/20 border-white/20 text-white">
  <SelectValue placeholder="Pilih Rentang Waktu">
    {selectedTimeRange === "1h"
      ? "1 Jam Terakhir"
      : selectedTimeRange === "6h"
      ? "6 Jam Terakhir"
      : selectedTimeRange === "24h"
      ? "24 Jam Terakhir"
      : selectedTimeRange === "7d"
      ? "7 Hari Terakhir"
      : selectedTimeRange === "30d"
      ? "30 Hari Terakhir"
      : "Pilih Rentang Waktu"}
  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1h">1 Jam Terakhir</SelectItem>
                  <SelectItem value="6h">6 Jam Terakhir</SelectItem>
                  <SelectItem value="24h">24 Jam Terakhir</SelectItem>
                  <SelectItem value="7d">7 Hari Terakhir</SelectItem>
                  <SelectItem value="30d">30 Hari Terakhir</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
  
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                   
                    <div>
                      <h3 className="font-medium mb-2">Suhu</h3>
                      <p>Min: {chartData.length > 0 ? Math.min(...chartData.map(d => d.temperature || 0)).toFixed(1) : '0'}°C</p>
                      <p>Max: {chartData.length > 0 ? Math.max(...chartData.map(d => d.temperature || 0)).toFixed(1) : '0'}°C</p>
                      <p>Rata-rata: {chartData.length > 0 ? (chartData.reduce((sum, d) => sum + (d.temperature || 0), 0) / chartData.length).toFixed(1) : '0'}°C</p>
                    </div>
                    
                    <div>
                      <h3 className="font-medium mb-2">Kelembaban</h3>
                      <p>Min: {chartData.length > 0 ? Math.min(...chartData.map(d => d.humidity || 0)).toFixed(1) : '0'}%</p>
                      <p>Max: {chartData.length > 0 ? Math.max(...chartData.map(d => d.humidity || 0)).toFixed(1) : '0'}%</p>
                      <p>Rata-rata: {chartData.length > 0 ? (chartData.reduce((sum, d) => sum + (d.humidity || 0), 0) / chartData.length).toFixed(1) : '0'}%</p>
                    </div>
                    
                    <div>
                      <h3 className="font-medium mb-2">Amonia (NH₃)</h3>
                      <p>Min: {chartData.length > 0 ? Math.min(...chartData.map(d => d.ammonia || 0)).toFixed(3) : '0'} ppm</p>
                      <p>Max: {chartData.length > 0 ? Math.max(...chartData.map(d => d.ammonia || 0)).toFixed(3) : '0'} ppm</p>
                      <p>Rata-rata: {chartData.length > 0 ? (chartData.reduce((sum, d) => sum + (d.ammonia || 0), 0) / chartData.length).toFixed(3) : '0'} ppm</p>
                    </div>
                    
                    <div>
                      <h3 className="font-medium mb-2">Metana (CH₄)</h3>
                      <p>Min: {chartData.length > 0 ? Math.min(...chartData.map(d => d.methane || 0)).toFixed(2) : '0'} ppm</p>
                      <p>Max: {chartData.length > 0 ? Math.max(...chartData.map(d => d.methane || 0)).toFixed(2) : '0'} ppm</p>
                      <p>Rata-rata: {chartData.length > 0 ? (chartData.reduce((sum, d) => sum + (d.methane || 0), 0) / chartData.length).toFixed(2) : '0'} ppm</p>
                    </div>
                    
                    <div>
                      <h3 className="font-medium mb-2">Hidrogen Sulfida (H₂S)</h3>
                      <p>Min: {chartData.length > 0 ? Math.min(...chartData.map(d => d.h2s || 0)).toFixed(4) : '0'} ppm</p>
                      <p>Max: {chartData.length > 0 ? Math.max(...chartData.map(d => d.h2s || 0)).toFixed(4) : '0'} ppm</p>
                      <p>Rata-rata: {chartData.length > 0 ? (chartData.reduce((sum, d) => sum + (d.h2s || 0), 0) / chartData.length).toFixed(4) : '0'} ppm</p>
                    </div>
                    
                    <div>
                      <h3 className="font-medium mb-2">Intensitas Cahaya</h3>
                      <p>Min: {chartData.length > 0 ? Math.min(...chartData.map(d => d.intensity || 0)).toFixed(2) : '0'} lux</p>
                      <p>Max: {chartData.length > 0 ? Math.max(...chartData.map(d => d.intensity || 0)).toFixed(2) : '0'} lux</p>
                      <p>Rata-rata: {chartData.length > 0 ? (chartData.reduce((sum, d) => sum + (d.intensity || 0), 0) / chartData.length).toFixed(2) : '0'} lux</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
          </div>
          </div>
        </>
      )}
    </div>
  );
}