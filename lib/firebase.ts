/* eslint-disable prefer-const */
import { initializeApp, getApps } from 'firebase/app';
import { getDatabase, ref, DatabaseReference, set, push, get } from 'firebase/database';
import { getAuth, signInWithEmailAndPassword, signOut, createUserWithEmailAndPassword, User, onAuthStateChanged } from 'firebase/auth';

export const firebaseConfig = {
    apiKey: "AIzaSyCITsTM_wZmn4WMz1vg0QVmT4FSvyxQcWQ",
    authDomain: "broilerfarm-2a830.firebaseapp.com",
    databaseURL: "https://broilerfarm-2a830-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "broilerfarm-2a830",
    storageBucket: "broilerfarm-2a830.appspot.com",
    messagingSenderId: "444674411351",
    appId: "1:444674411351:web:1722ffa518544749a14c12",
    measurementId: "G-0QSPV4608W"
  };
  
// Inisialisasi Firebase jika belum diinisialisasi
export const initializeFirebase = () => {
  const apps = getApps();
  if (!apps.length) {
    return initializeApp(firebaseConfig);
  }
  return apps[0];
};

// Mendapatkan referensi database
export const getFirebaseDatabase = () => {
  const app = initializeFirebase();
  return getDatabase(app);
};

// Mendapatkan referensi untuk data sensor
export const getSensorDataRef = (): DatabaseReference => {
  const database = getFirebaseDatabase();
  return ref(database, 'sensor_data');
};

// Mendapatkan referensi untuk data ayam
export const getChickenDataRef = (): DatabaseReference => {
  const database = getFirebaseDatabase();
  return ref(database, 'chicken_data');
};

// Mendapatkan referensi untuk history data ayam
export const getChickenHistoryRef = (): DatabaseReference => {
  const database = getFirebaseDatabase();
  return ref(database, 'chicken_history');
};

// Mendapatkan referensi untuk data admin/user
export const getUsersRef = (): DatabaseReference => {
  const database = getFirebaseDatabase();
  return ref(database, 'users');
};

// Mendapatkan Auth instance Firebase
export const getFirebaseAuth = () => {
  const app = initializeFirebase();
  return getAuth(app);
};

// Login dengan email dan password
export const loginWithEmailAndPassword = async (email: string, password: string) => {
  const auth = getFirebaseAuth();
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    return userCredential.user;
  } catch (error) {
    throw error;
  }
};

// Logout
export const logout = async () => {
  const auth = getFirebaseAuth();
  return signOut(auth);
};

// Mendaftarkan admin baru (gunakan dengan hati-hati)
export const registerAdmin = async (email: string, password: string, displayName: string) => {
  const auth = getFirebaseAuth();
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    
    // Simpan info tambahan admin ke database
    const usersRef = getUsersRef();
    await set(ref(getFirebaseDatabase(), `users/${user.uid}`), {
      email,
      displayName,
      role: 'admin',
      createdAt: Date.now()
    });
    
    return user;
  } catch (error) {
    throw error;
  }
};

// Fungsi untuk menghasilkan ID batch yang terformat
const generateBatchId = async () => {
  try {
    console.log("Generating new batch ID...");
    const today = new Date();
    const dateStr = today.getFullYear().toString() +
      (today.getMonth() + 1).toString().padStart(2, '0') +
      today.getDate().toString().padStart(2, '0');
    
    console.log("Date string for batch ID:", dateStr);
    
    // Dapatkan referensi untuk data ayam hari ini
    const database = getFirebaseDatabase();
    const chickenDataRef = ref(database, 'chicken_data');
    const snapshot = await get(chickenDataRef);
    const data = snapshot.val() || {};
    
    console.log("Found existing chicken data:", Object.keys(data).length, "batches");
    
    // Filter batch yang dibuat hari ini
    const todayBatches = Object.keys(data).filter(key => 
      key.includes(`BTH-${dateStr}`)
    );
    
    console.log("Today's batches:", todayBatches);
    
    // Tentukan nomor urut berikutnya
    const nextNumber = (todayBatches.length + 1).toString().padStart(3, '0');
    
    // Format: BTH-YYYYMMDD-001
    const newBatchId = `BTH-${dateStr}-${nextNumber}`;
    console.log("Generated new batch ID:", newBatchId);
    
    return newBatchId;
  } catch (error) {
    console.error("Error generating batch ID:", error);
    // Fallback jika terjadi error
    const timestamp = Date.now();
    return `BTH-FALLBACK-${timestamp}`;
  }
};

// Tambahkan data ayam baru
export const addChickenBatch = async (batchData: {
  hatchDate: string;
  quantity: number;
  notes?: string;
  averageWeight?: number;
  deaths?: number;
  feedAmount?: number;
  feedType?: string;
  waterStatus?: 'OK' | 'NOT OK';
  lastUpdated?: number;
}) => {
  try {
    console.log("Starting addChickenBatch with data:", batchData);
    
    const chickenRef = getChickenDataRef();
    console.log("Got chicken reference");
    
    const batchId = await generateBatchId();
    console.log("Generated batch ID:", batchId);
    
    const batchRef = ref(getFirebaseDatabase(), `chicken_data/${batchId}`);
    console.log("Created reference for new batch:", `chicken_data/${batchId}`);
    
    const dataToSave = {
      ...batchData,
      createdAt: Date.now(),
      lastUpdated: Date.now()
    };
    
    console.log("About to save data:", dataToSave);
    await set(batchRef, dataToSave);
    console.log("Data successfully saved to Firebase");
    
    return batchId;
  } catch (error) {
    console.error("Error in addChickenBatch:", error);
    throw error;
  }
};

// Update data ayam
export const updateChickenBatch = async (batchId: string, updateData: {
  hatchDate?: string;
  quantity?: number;
  averageWeight?: number;
  deaths?: number;
  feedAmount?: number;
  feedType?: string;
  waterStatus?: 'OK' | 'NOT OK';
  notes?: string;
}) => {
  const database = getFirebaseDatabase();
  const batchRef = ref(database, `chicken_data/${batchId}`);
  
  // Tambahkan timestamp terakhir diupdate
  const updatedData = {
    ...updateData,
    lastUpdated: Date.now()
  };
  
  // Ambil data existing sebelum update
  const snapshot = await get(batchRef);
  const existingData = snapshot.val() || {};
  
  // Update data
  await set(batchRef, {
    ...existingData,
    ...updatedData
  });

  // Simpan history update
  await recordChickenHistory(batchId, existingData, updatedData);
  
  // Update juga data harian
  await updateDailyProgress(batchId, true);
  
  return batchId;
};

interface ChickenHistoryData {
  averageWeight: number;
  deaths: number;
  feedAmount: number;
  feedType: string;
  waterStatus: 'OK' | 'NOT OK';
  notes: string;
  quantity?: number;
}

interface ChickenHistoryEntry {
  timestamp: number;
  previous: ChickenHistoryData;
  current: ChickenHistoryData;
  changeNote: string;
}

// Fungsi untuk mencatat history update
export const recordChickenHistory = async (
  batchId: string, 
  previousData: any, 
  newData: any
) => {
  try {
    const database = getFirebaseDatabase();
    const historyRef = ref(database, `chicken_history/${batchId}`);
    
    // Generate ID untuk history entry baru
    const timestamp = Date.now();
    const entryRef = ref(database, `chicken_history/${batchId}/${timestamp}`);
    
    // Catat perubahan yang terjadi
    const historyEntry: ChickenHistoryEntry = {
      timestamp,
      previous: {
        averageWeight: previousData.averageWeight || 0,
        deaths: previousData.deaths || 0,
        feedAmount: previousData.feedAmount || 0,
        feedType: previousData.feedType || '',
        waterStatus: previousData.waterStatus || 'OK',
        notes: previousData.notes || '',
        quantity: previousData.quantity
      },
      current: {
        averageWeight: newData.averageWeight || previousData.averageWeight || 0,
        deaths: newData.deaths || previousData.deaths || 0,
        feedAmount: newData.feedAmount || previousData.feedAmount || 0,
        feedType: newData.feedType || previousData.feedType || '',
        waterStatus: newData.waterStatus || previousData.waterStatus || 'OK',
        notes: newData.notes || previousData.notes || '',
        quantity: newData.quantity !== undefined ? newData.quantity : previousData.quantity
      },
      changeNote: newData.notes || 'Update rutin'
    };

    // Selalu simpan history entry, tidak perlu cek perubahan
    await set(entryRef, historyEntry);
    console.log('History recorded successfully:', historyEntry);
    return timestamp;
  } catch (error) {
    console.error("Error recording chicken history:", error);
    throw error;
  }
};

// Mendapatkan history data ayam berdasarkan batch ID
export const getChickenHistory = async (batchId: string) => {
  try {
    console.log(`Getting history for batch ID: ${batchId}`);
    const database = getFirebaseDatabase();
    const historyRef = ref(database, `chicken_history/${batchId}`);
    
    console.log(`Reference path: chicken_history/${batchId}`);
    const snapshot = await get(historyRef);
    const data = snapshot.val() || {};
    
    console.log(`Raw history data:`, data);
    
    // Konversi objek menjadi array dan urutkan berdasarkan timestamp (terbaru di atas)
    const historyEntries = Object.entries(data)
      .map(([key, value]) => ({
        id: key,
        ...(value as any)
      }))
      .sort((a, b) => b.timestamp - a.timestamp);
    
    console.log(`Processed ${historyEntries.length} history entries`);
    return historyEntries;
  } catch (error) {
    console.error(`Error getting history for batch ${batchId}:`, error);
    return [];
  }
};

// Mendapatkan daily progress data ayam berdasarkan batch ID
export const getDailyChickenProgress = async (batchId: string) => {
  try {
    console.log(`Getting daily progress for batch ID: ${batchId}`);
    const database = getFirebaseDatabase();
    const dailyRef = ref(database, `chicken_daily/${batchId}`);
    
    const snapshot = await get(dailyRef);
    const data = snapshot.val() || {};
    
    // Konversi objek menjadi array dan urutkan berdasarkan dateString (terbaru di atas)
    const dailyEntries = Object.entries(data)
      .map(([dateString, value]) => ({
        dateString,
        ...(value as any)
      }))
      .sort((a, b) => new Date(b.dateString).getTime() - new Date(a.dateString).getTime());
    
    console.log(`Processed ${dailyEntries.length} daily entries`);
    return dailyEntries;
  } catch (error) {
    console.error(`Error getting daily progress for batch ${batchId}:`, error);
    return [];
  }
};

// Update harian batch ayam (untuk update otomatis atau manual)
export const updateDailyProgress = async (batchId: string, manualUpdate = false) => {
  try {
    console.log(`Updating daily progress for batch ID: ${batchId}`);
    const database = getFirebaseDatabase();
    
    // Dapatkan data batch terkini
    const batchRef = ref(database, `chicken_data/${batchId}`);
    const batchSnapshot = await get(batchRef);
    
    if (!batchSnapshot.exists()) {
      console.error(`Batch ${batchId} not found`);
      return null;
    }
    
    const batchData = batchSnapshot.val();
    
    // Format tanggal hari ini (YYYY-MM-DD)
    const today = new Date();
    const dateString = today.toISOString().split('T')[0];
    
    // Cek apakah sudah ada update untuk hari ini
    const dailyRef = ref(database, `chicken_daily/${batchId}`);
    const dailySnapshot = await get(dailyRef);
    const dailyData = dailySnapshot.val() || {};
    
    // Jika sudah ada update hari ini dan bukan update manual, skip
    if (dailyData[dateString] && !manualUpdate) {
      console.log(`Already have update for ${dateString}, skipping`);
      return dailyData[dateString];
    }
    
    // Hitung usia batch hari ini
    const hatchDate = new Date(batchData.hatchDate);
    const ageInDays = Math.floor((today.getTime() - hatchDate.getTime()) / (1000 * 60 * 60 * 24));
    
    // Data untuk disimpan
    const dailyEntry = {
      dateString,
      timestamp: Date.now(),
      ageInDays,
      averageWeight: batchData.averageWeight || 0,
      deaths: batchData.deaths || 0,
      feedAmount: batchData.feedAmount || 0,
      feedType: batchData.feedType || '',
      waterStatus: batchData.waterStatus || 'OK',
      notes: batchData.notes || '',
      quantity: batchData.quantity || 0,
      manualUpdate: manualUpdate
    };
    
    // Simpan ke Firebase
    const entryRef = ref(database, `chicken_daily/${batchId}/${dateString}`);
    await set(entryRef, dailyEntry);
    
    console.log(`Daily progress saved for ${dateString}:`, dailyEntry);
    return dailyEntry;
    
  } catch (error) {
    console.error(`Error updating daily progress for batch ${batchId}:`, error);
    throw error;
  }
};

// Fungsi untuk melakukan backfill data harian dari tanggal menetas hingga kemarin
// Berguna saat pertama kali mengaktifkan fitur ini
export const backfillDailyProgress = async (batchId: string) => {
  try {
    console.log(`Starting backfill for batch ID: ${batchId}`);
    const database = getFirebaseDatabase();
    
    // Dapatkan data batch terkini
    const batchRef = ref(database, `chicken_data/${batchId}`);
    const batchSnapshot = await get(batchRef);
    
    if (!batchSnapshot.exists()) {
      console.error(`Batch ${batchId} not found`);
      return false;
    }
    
    const batchData = batchSnapshot.val();
    const hatchDate = new Date(batchData.hatchDate);
    const today = new Date();
    
    // Periksa apakah tanggal menetas di masa depan
    if (hatchDate > today) {
      console.log(`Batch ${batchId} memiliki tanggal menetas di masa depan: ${batchData.hatchDate}. Tidak perlu backfill.`);
      return true;
    }
    
    // Dapatkan history record untuk data historis
    const historyRef = ref(database, `chicken_history/${batchId}`);
    const historySnapshot = await get(historyRef);
    const historyData = historySnapshot.val() || {};
    
    // Dapatkan daily data yang sudah ada
    const dailyRef = ref(database, `chicken_daily/${batchId}`);
    const dailySnapshot = await get(dailyRef);
    const existingDailyData = dailySnapshot.val() || {};
    
    // Konversi history menjadi timestamp map untuk pencarian efisien
    const historyMap = new Map();
    for (const [key, entry] of Object.entries(historyData)) {
      const timestamp = parseInt(key);
      const date = new Date(timestamp);
      const dateString = date.toISOString().split('T')[0];
      if (!historyMap.has(dateString) || timestamp > historyMap.get(dateString).timestamp) {
        historyMap.set(dateString, { timestamp, data: entry });
      }
    }
    
    // Loop dari tanggal menetas hingga hari ini
    // eslint-disable-next-line prefer-const
    let currentDate = new Date(hatchDate);
    currentDate.setHours(0, 0, 0, 0);
    
    const endDate = new Date(today);
    endDate.setHours(23, 59, 59, 999);
    
    let dataSnapshot = { ...batchData };
    
    while (currentDate <= endDate) {
      const dateString = currentDate.toISOString().split('T')[0];
      
      // Skip jika sudah ada data untuk tanggal ini
      if (existingDailyData[dateString]) {
        currentDate.setDate(currentDate.getDate() + 1);
        continue;
      }
      
      // Cek apakah ada history update pada tanggal ini
      if (historyMap.has(dateString)) {
        const historyEntry = historyMap.get(dateString);
        dataSnapshot = {
          ...dataSnapshot,
          ...historyEntry.data.current
        };
      }
      
      // Hitung usia batch pada tanggal ini
      const ageInDays = Math.floor((currentDate.getTime() - hatchDate.getTime()) / (1000 * 60 * 60 * 24));
      
      // Buat daily entry
      const dailyEntry = {
        dateString,
        timestamp: currentDate.getTime(),
        ageInDays,
        averageWeight: dataSnapshot.averageWeight || 0,
        deaths: dataSnapshot.deaths || 0,
        feedAmount: dataSnapshot.feedAmount || 0,
        feedType: dataSnapshot.feedType || '',
        waterStatus: dataSnapshot.waterStatus || 'OK',
        notes: dataSnapshot.notes || '',
        quantity: dataSnapshot.quantity || 0,
        manualUpdate: false,
        autoBackfilled: true
      };
      
      // Simpan ke Firebase
      const entryRef = ref(database, `chicken_daily/${batchId}/${dateString}`);
      await set(entryRef, dailyEntry);
      
      console.log(`Backfilled data for ${dateString}`);
      
      // Lanjut ke hari berikutnya
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    console.log(`Backfill completed for batch ${batchId}`);
    return true;
    
  } catch (error) {
    console.error(`Error during backfill for batch ${batchId}:`, error);
    return false;
  }
};

// Mendapatkan status autentikasi saat ini
export const getCurrentUser = (): Promise<User | null> => {
  return new Promise((resolve) => {
    const auth = getFirebaseAuth();
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      unsubscribe();
      resolve(user);
    });
  });
};

// Cek apakah user adalah admin
export const isUserAdmin = async (user: User): Promise<boolean> => {
  if (!user) return false;
  
  const userRef = ref(getFirebaseDatabase(), `users/${user.uid}`);
  const snapshot = await get(userRef);
  const userData = snapshot.val();
  
  return userData && userData.role === 'admin';
};

// Fungsi untuk memeriksa dan mengisi data harian jika belum ada data hari ini
export const checkAndCreateDailyEntry = async (batchId: string) => {
  try {
    // Format tanggal hari ini (YYYY-MM-DD)
    const today = new Date();
    const dateString = today.toISOString().split('T')[0];

    // Cek apakah sudah ada data harian untuk hari ini
    const database = getFirebaseDatabase();
    const todayEntryRef = ref(database, `chicken_daily/${batchId}/${dateString}`);
    const snapshot = await get(todayEntryRef);

    // Jika sudah ada data untuk hari ini, tidak perlu membuat baru
    if (snapshot.exists()) {
      console.log(`Data harian untuk batch ${batchId} tanggal ${dateString} sudah ada`);
      return null;
    }

    // Data belum ada, buat entry baru berdasarkan data batch terkini
    console.log(`Membuat data harian untuk batch ${batchId} tanggal ${dateString}`);
    return await updateDailyProgress(batchId, false);
  } catch (error) {
    console.error(`Error saat memeriksa/membuat data harian untuk batch ${batchId}:`, error);
    return null;
  }
};

// Fungsi untuk memeriksa dan backfill data harian yang terlewat (untuk periode tertentu)
export const checkAndBackfillMissingDays = async (batchId: string, days: number = 7) => {
  try {
    const database = getFirebaseDatabase();
    
    // Dapatkan data batch
    const batchRef = ref(database, `chicken_data/${batchId}`);
    const batchSnapshot = await get(batchRef);
    
    if (!batchSnapshot.exists()) {
      console.error(`Batch ${batchId} tidak ditemukan`);
      return false;
    }
    
    const batchData = batchSnapshot.val();
    const hatchDate = new Date(batchData.hatchDate);
    const today = new Date();
    
    // Periksa apakah tanggal menetas di masa depan
    if (hatchDate > today) {
      console.log(`Batch ${batchId} memiliki tanggal menetas di masa depan: ${batchData.hatchDate}. Tidak perlu backfill.`);
      return true;
    }
    
    // Dapatkan data harian yang sudah ada
    const dailyRef = ref(database, `chicken_daily/${batchId}`);
    const dailySnapshot = await get(dailyRef);
    const existingDailyData = dailySnapshot.val() || {};
    
    // PENTING: Mulai dari tanggal penetasan, bukan dari hari ini mundur beberapa hari
    // Ini mencegah data harian muncul sebelum tanggal penetasan
    const startDate = new Date(hatchDate);
    startDate.setHours(0, 0, 0, 0);
    
    // Loop dari tanggal menetas hingga hari ini
    // eslint-disable-next-line prefer-const
    let currentDate = new Date(startDate);
    
    const endDate = new Date(today);
    endDate.setHours(23, 59, 59, 999);
    
    // Hapus data harian yang mungkin ada sebelum tanggal penetasan
    // Ini untuk membersihkan data yang tidak valid
    for (const dateString in existingDailyData) {
      const entryDate = new Date(dateString);
      if (entryDate < startDate) {
        console.log(`Menghapus data harian yang tidak valid (sebelum penetasan): ${dateString}`);
        const invalidEntryRef = ref(database, `chicken_daily/${batchId}/${dateString}`);
        await set(invalidEntryRef, null);
      }
    }
    
    let backfilledCount = 0;
    
    // Loop dari tanggal penetasan hingga hari ini
    while (currentDate <= endDate) {
      const dateString = currentDate.toISOString().split('T')[0];
      
      // Skip jika sudah ada data untuk tanggal ini
      if (existingDailyData[dateString]) {
        currentDate.setDate(currentDate.getDate() + 1);
        continue;
      }
      
      // Cari data batch pada tanggal tersebut (gunakan data terkini)
      console.log(`Backfilling data untuk ${dateString}`);
      
      // Hitung usia batch pada tanggal ini
      const ageInDays = Math.floor((currentDate.getTime() - hatchDate.getTime()) / (1000 * 60 * 60 * 24));
      
      // Buat data harian untuk tanggal ini
      const dailyEntry = {
        dateString,
        timestamp: currentDate.getTime(),
        ageInDays: Math.max(0, ageInDays),
        averageWeight: batchData.averageWeight || 0,
        deaths: batchData.deaths || 0,
        feedAmount: batchData.feedAmount || 0,
        feedType: batchData.feedType || '',
        waterStatus: batchData.waterStatus || 'OK',
        notes: batchData.notes || '',
        quantity: batchData.quantity || 0,
        manualUpdate: false,
        autoBackfilled: true
      };
      
      // Simpan ke Firebase
      const entryRef = ref(database, `chicken_daily/${batchId}/${dateString}`);
      await set(entryRef, dailyEntry);
      backfilledCount++;
      
      // Lanjut ke hari berikutnya
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    console.log(`Backfill selesai: ${backfilledCount} hari ditambahkan untuk batch ${batchId}`);
    return true;
  } catch (error) {
    console.error(`Error saat backfill untuk batch ${batchId}:`, error);
    return false;
  }
};

