'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CalendarDays, ChevronRight, Activity, Thermometer, Droplets, AlertCircle, Flame, Cloud, Sun } from 'lucide-react';
import Link from 'next/link';
import { onValue, get, ref as dbRef } from 'firebase/database';
import { getSensorDataRef, getChickenDataRef, getFirebaseDatabase } from '@/lib/firebase';

interface ChickenBatch {
  id: string;
  hatchDate: string;
  quantity: number;
  notes?: string;
  ageInDays?: number;
}

interface SensorData {
  temperature: number;
  humidity: number;
  ammonia: number;
  methane: number;
  h2s: number;
  intensity: number;
  timestamp: number | string;
}

export default function AdminDashboardPage() {
  const [latestSensorData, setLatestSensorData] = useState<SensorData | null>(null);
  const [chickenBatches, setChickenBatches] = useState<ChickenBatch[]>([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    const sensorRef = getSensorDataRef();
    const chickenRef = getChickenDataRef();
    
    // Pantau perubahan data sensor secara real-time
    const sensorUnsubscribe = onValue(sensorRef, (snapshot) => {
      try {
        const data = snapshot.val();
        if (data) {
          const entries = Object.entries(data)
            .filter(([key]) => key.startsWith('data_ke_'))
            .map(([_, value]: [string, any]) => {
              let timestamp;
              
              // Cek format timestamp
              if (typeof value.timestamp === 'string' && value.timestamp.includes('-')) {
                // Format "YYYY-M-D H:M:S", simpan dalam format string asli
                timestamp = value.timestamp;
              } else {
                // Format numerik
                timestamp = Number(value.timestamp) || Math.floor(Date.now() / 1000);
              }
              
              return {
                temperature: Number(value.temperature) || 0,
                humidity: Number(value.humidity) || 0,
                ammonia: Number(value.ammonia) || 0,
                methane: Number(value.ch4) || 0, // Perhatikan nama field di Firebase
                h2s: Number(value.h2s) || 0,
                intensity: Number(value.intensity) || 0,
                timestamp
              };
            });
            
          // Urutkan data
          if (entries.length > 0) {
            // Urutkan berdasarkan timestamp
            const sortedEntries = entries.sort((a, b) => {
              // Jika keduanya string dengan format tanggal
              if (typeof a.timestamp === 'string' && typeof b.timestamp === 'string' &&
                  a.timestamp.includes('-') && b.timestamp.includes('-')) {
                return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
              }
              
              // Jika salah satu string, konversi ke timestamp
              const timestampA = typeof a.timestamp === 'string' && a.timestamp.includes('-') 
                ? new Date(a.timestamp).getTime() / 1000 
                : Number(a.timestamp);
                
              const timestampB = typeof b.timestamp === 'string' && b.timestamp.includes('-') 
                ? new Date(b.timestamp).getTime() / 1000 
                : Number(b.timestamp);
                
              return timestampB - timestampA;
            });
            
            setLatestSensorData(sortedEntries[0]);
          }
        }
      } catch (error) {
        console.error('Error saat memproses data sensor:', error);
      }
    });

    // Pantau perubahan data batch ayam secara real-time
    const chickenUnsubscribe = onValue(chickenRef, (snapshot) => {
      try {
        const data = snapshot.val();
        if (data) {
          const batches = Object.entries(data)
            .map(([id, value]: [string, any]) => {
              const hatchDate = new Date(value.hatchDate);
              const today = new Date();
              const ageInDays = Math.floor((today.getTime() - hatchDate.getTime()) / (1000 * 60 * 60 * 24));
              
              return {
                id,
                hatchDate: value.hatchDate,
                quantity: Number(value.quantity) || 0,
                notes: value.notes || '',
                ageInDays
              };
            })
            .sort((a, b) => new Date(b.hatchDate).getTime() - new Date(a.hatchDate).getTime());

          setChickenBatches(batches);
        }
        setLoading(false);
      } catch (error) {
        console.error('Error saat memproses data batch ayam:', error);
        setLoading(false);
      }
    });

    return () => {
      sensorUnsubscribe();
      chickenUnsubscribe();
    };
  }, []);

  // Format angka dengan 2 desimal
  const formatNumber = (value: number, decimals: number = 2) => {
    return Number(value).toFixed(decimals);
  };

  // Format timestamp menjadi tanggal dan waktu lokal
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
          second: '2-digit',
          timeZoneName: 'short'
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
        second: '2-digit',
        timeZoneName: 'short'
      });
    } catch (error) {
      console.error('Error saat memformat timestamp:', error, timestamp);
      return 'Format waktu error';
    }
  };
  
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold tracking-tight">Dashboard Admin</h1>
        <Button asChild>
          <Link href="/admin/chickens/add">
            Tambah Batch Ayam Baru
          </Link>
        </Button>
      </div>
      
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Suhu</CardTitle>
            <Thermometer className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(latestSensorData?.temperature || 0)}°C</div>
            <p className="text-xs text-muted-foreground">
              Update terakhir: {formatTimestamp(latestSensorData?.timestamp || 0)}
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Kelembaban</CardTitle>
            <Droplets className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(latestSensorData?.humidity || 0)}%</div>
            <p className="text-xs text-muted-foreground">
              Update terakhir: {formatTimestamp(latestSensorData?.timestamp || 0)}
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Amonia</CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(latestSensorData?.ammonia || 0, 3)} ppm</div>
            <p className="text-xs text-muted-foreground">
              Update terakhir: {formatTimestamp(latestSensorData?.timestamp || 0)}
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Metana</CardTitle>
            <Flame className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(latestSensorData?.methane || 0, 3)} ppm</div>
            <p className="text-xs text-muted-foreground">
              Update terakhir: {formatTimestamp(latestSensorData?.timestamp || 0)}
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">H2S</CardTitle>
            <Cloud className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(latestSensorData?.h2s || 0, 3)} ppm</div>
            <p className="text-xs text-muted-foreground">
              Update terakhir: {formatTimestamp(latestSensorData?.timestamp || 0)}
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Intensitas Cahaya</CardTitle>
            <Sun className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(latestSensorData?.intensity || 0)} lux</div>
            <p className="text-xs text-muted-foreground">
              Update terakhir: {formatTimestamp(latestSensorData?.timestamp || 0)}
            </p>
          </CardContent>
        </Card>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle>Batch Ayam Aktif</CardTitle>
          <CardDescription>
            Daftar batch ayam yang sedang dalam pemeliharaan
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {chickenBatches.length === 0 ? (
              <p className="text-sm text-muted-foreground">Belum ada batch ayam yang ditambahkan</p>
            ) : (
              chickenBatches.map(batch => (
                <div key={batch.id} className="flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-sm font-medium leading-none">
                      Batch {batch.id.slice(-6)}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {batch.quantity} ekor • {batch.ageInDays} hari
                    </p>
                  </div>
                  <Button variant="ghost" size="sm" asChild>
                    <Link href={`/admin/chickens/${batch.id}`}>
                      <ChevronRight className="h-4 w-4" />
                    </Link>
                  </Button>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 