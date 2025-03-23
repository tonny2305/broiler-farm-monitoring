'use client';

import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { getSensorDataRef } from '@/lib/firebase';
import { onValue, ref, get } from 'firebase/database';
import { Download } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface SensorData {
  temperature: number;
  humidity: number;
  ammonia: number;
  methane: number;
  h2s: number;
  intensity: number;
  timestamp: number | string;
}

export default function SensorPage() {
  const [sensorData, setSensorData] = useState<SensorData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTimeRange, setSelectedTimeRange] = useState('24h');

  // Ambil data sensor dan siapkan listener realtime
  useEffect(() => {
    // Fungsi untuk memproses data sensor dari Firebase
    const processSensorData = (data: any) => {
      if (!data) return [];
      
      const formattedData: SensorData[] = [];
      Object.keys(data).forEach(key => {
        if (key.startsWith('data_ke_')) {
          const entry = data[key];
          if (entry) {
            // Konversi timestamp ke format yang konsisten
            let timestamp;

            // Cek format timestamp
            if (typeof entry.timestamp === 'string' && entry.timestamp.includes('-')) {
              // Format "YYYY-M-D H:M:S", konversi ke Date object
              try {
                timestamp = new Date(entry.timestamp).getTime();
              } catch (err) {
                console.error(`Error converting timestamp string: ${entry.timestamp}`, err);
                timestamp = Date.now(); // Fallback ke waktu sekarang
              }
            } else {
              // Format numerik (detik atau milidetik)
              timestamp = Number(entry.timestamp) || 0;
              
              // Jika timestamp terlalu kecil (dalam detik), konversi ke milisekon
              if (timestamp > 0 && timestamp < 10000000000) {
                timestamp *= 1000;
              }
            }
            
            // Pastikan semua nilai adalah angka yang valid
            const temperature = Number(entry.temperature) || 0;
            const humidity = Number(entry.humidity) || 0;
            const ammonia = Number(entry.ammonia) || 0;
            const methane = Number(entry.ch4) || 0; // Di Firebase menggunakan ch4
            const h2s = Number(entry.h2s) || 0;
            const intensity = Number(entry.intensity) || 0;
            
            // Tambahkan data jika timestamp valid
            if (timestamp > 0) {
              formattedData.push({
                temperature,
                humidity,
                ammonia,
                methane,
                h2s,
                intensity,
                timestamp
              });
            }
          }
        }
      });
      
      // Urutkan data berdasarkan timestamp (terbaru di atas)
      return formattedData.sort((a, b) => {
        const timestampA = Number(a.timestamp);
        const timestampB = Number(b.timestamp);
        return timestampB - timestampA;
      });
    };
    
    // Ambil data langsung untuk loading awal
    const fetchInitialData = async () => {
      try {
        setLoading(true);
        const sensorRef = getSensorDataRef();
        const snapshot = await get(sensorRef);
        const data = snapshot.val();
        
        if (data) {
          const processedData = processSensorData(data);
          if (processedData.length > 0) {
            setSensorData(processedData);
            setError(null);
          } else {
            setError('Tidak ada data sensor yang valid');
          }
        } else {
          setError('Tidak ada data sensor yang tersedia');
        }
      } catch (err) {
        console.error('Error fetching sensor data:', err);
        setError('Terjadi kesalahan saat mengambil data sensor');
      } finally {
        setLoading(false);
      }
    };
    
    // Panggil fungsi untuk mendapatkan data awal
    fetchInitialData();
    
    // Setup listener realtime untuk update data
    const sensorRef = getSensorDataRef();
    const unsubscribe = onValue(sensorRef, (snapshot) => {
      try {
        const data = snapshot.val();
        if (data) {
          const processedData = processSensorData(data);
          setSensorData(processedData);
          if (processedData.length > 0) {
            setError(null);
          } else {
            setError('Tidak ada data sensor yang valid');
          }
        } else {
          setError('Tidak ada data sensor yang tersedia');
        }
        setLoading(false);
      } catch (error) {
        console.error('Firebase error:', error);
        setError('Terjadi kesalahan koneksi ke database');
        setLoading(false);
      }
    });
    
    // Cleanup listener saat komponen unmount
    return () => unsubscribe();
  }, []);

  // Filter data berdasarkan rentang waktu
  const getFilteredData = () => {
    if (!sensorData || sensorData.length === 0) return [];
    
    // Gunakan timestamp dari data sensor terbaru (dari Firebase) sebagai referensi
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

    return sensorData
      .filter(data => {
        // Konversi timestamp ke format milisekon untuk perbandingan
        let dataTimestamp: number;
        
        if (typeof data.timestamp === 'string' && data.timestamp.includes('-')) {
          dataTimestamp = new Date(data.timestamp).getTime();
        } else {
          const numTimestamp = Number(data.timestamp);
          // Pastikan timestamp valid
          if (isNaN(numTimestamp) || numTimestamp <= 0) return false;
          
          dataTimestamp = numTimestamp < 10000000000 ? 
            numTimestamp * 1000 : numTimestamp;
        }
        
        // Bandingkan dengan timestamp data terakhir, bukan waktu saat ini
        const timeDifference = Math.abs(referenceTimestamp - dataTimestamp);
        return timeDifference <= timeFilter;
      })
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
        
        return timestampB - timestampA; // Urutkan dari yang baru ke lama
      });
  };

  // Format timestamp ke waktu lokal
  const formatTimestamp = (timestamp: number | string) => {
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
          second: '2-digit'
        });
      }
      
      // Jika timestamp berupa angka
      const numTimestamp = Number(timestamp);
      let date;
      
      // Jika timestamp dalam format detik (Unix timestamp)
      if (numTimestamp < 10000000000) {
        date = new Date(numTimestamp * 1000);
      } else {
        // Jika timestamp dalam format milidetik
        date = new Date(numTimestamp);
      }
      
      return date.toLocaleString('id-ID', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
    } catch (error) {
      console.error('Error formatting timestamp:', error, timestamp);
      return 'Format waktu error';
    }
  };

  // Format angka dengan desimal yang tepat
  const formatValue = (value: number, decimal: number = 2) => {
    if (isNaN(value) || value === null || value === undefined) return '0';
    return Number(value).toFixed(decimal);
  };

  // Export data ke CSV
  const exportToCSV = () => {
    try {
      const filteredData = getFilteredData();
      
      if (!filteredData || filteredData.length === 0) {
        setError('Tidak ada data untuk diekspor');
        return;
      }

      const headers = ['Waktu', 'Suhu (°C)', 'Kelembaban (%)', 'Amonia (ppm)', 'Metana (ppm)', 'H2S (ppm)', 'Intensitas (lux)'];
      
      const csvRows = [
        headers.join(','),
        ...filteredData.map(data => [
          formatTimestamp(data.timestamp),
          formatValue(data.temperature, 1),
          formatValue(data.humidity, 1),
          formatValue(data.ammonia, 3),
          formatValue(data.methane, 2),
          formatValue(data.h2s, 3),
          formatValue(data.intensity, 2)
        ].join(','))
      ];

      const csvContent = csvRows.join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      
      const fileName = `sensor_data_${selectedTimeRange}_${new Date().toISOString().slice(0,10)}.csv`;
      
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', fileName);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      setError(null);
    } catch (error) {
      console.error('Error exporting data:', error);
      setError('Terjadi kesalahan saat mengekspor data');
    }
  };

  const filteredData = getFilteredData();

  return (
    <div className="container mx-auto p-4">
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>Data Sensor</CardTitle>
              <CardDescription>
                Menampilkan data sensor dalam{' '}
                {selectedTimeRange === '1h' ? '1 jam' :
                 selectedTimeRange === '6h' ? '6 jam' :
                 selectedTimeRange === '24h' ? '24 jam' :
                 selectedTimeRange === '7d' ? '7 hari' : '30 hari'} terakhir
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Select value={selectedTimeRange} onValueChange={setSelectedTimeRange}>
                <SelectTrigger className="w-[180px]">
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
              <Button 
                onClick={exportToCSV} 
                className="flex items-center gap-2"
                disabled={loading || filteredData.length === 0}
              >
                <Download className="h-4 w-4" />
                Export CSV
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          
          {loading ? (
            <p className="text-center py-4">Memuat data sensor...</p>
          ) : filteredData.length === 0 ? (
            <p className="text-center py-4">Tidak ada data sensor dalam rentang waktu yang dipilih</p>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Waktu</TableHead>
                    <TableHead>Suhu (°C)</TableHead>
                    <TableHead>Kelembaban (%)</TableHead>
                    <TableHead>Amonia (ppm)</TableHead>
                    <TableHead>Metana (ppm)</TableHead>
                    <TableHead>H₂S (ppm)</TableHead>
                    <TableHead>Intensitas (lux)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredData.map((data, index) => (
                    <TableRow key={index}>
                      <TableCell>{formatTimestamp(data.timestamp)}</TableCell>
                      <TableCell>{formatValue(data.temperature, 1)}</TableCell>
                      <TableCell>{formatValue(data.humidity, 1)}</TableCell>
                      <TableCell>{formatValue(data.ammonia, 3)}</TableCell>
                      <TableCell>{formatValue(data.methane, 2)}</TableCell>
                      <TableCell>{formatValue(data.h2s, 3)}</TableCell>
                      <TableCell>{formatValue(data.intensity, 2)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}