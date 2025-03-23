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
  const today = new Date();
  const dateStr = today.getFullYear().toString() +
    (today.getMonth() + 1).toString().padStart(2, '0') +
    today.getDate().toString().padStart(2, '0');
  
  // Dapatkan referensi untuk data ayam hari ini
  const database = getFirebaseDatabase();
  const todayRef = ref(database, 'chicken_data');
  const snapshot = await get(todayRef);
  const data = snapshot.val() || {};
  
  // Filter batch yang dibuat hari ini
  const todayBatches = Object.keys(data).filter(key => 
    key.includes(`BTH-${dateStr}`)
  );
  
  // Tentukan nomor urut berikutnya
  const nextNumber = (todayBatches.length + 1).toString().padStart(3, '0');
  
  // Format: BTH-YYYYMMDD-001
  return `BTH-${dateStr}-${nextNumber}`;
};

// Tambahkan data ayam baru
export const addChickenBatch = async (batchData: {
  hatchDate: string;
  quantity: number;
  notes?: string;
}) => {
  const chickenRef = getChickenDataRef();
  const batchId = await generateBatchId();
  const batchRef = ref(getFirebaseDatabase(), `chicken_data/${batchId}`);
  
  await set(batchRef, {
    ...batchData,
    createdAt: Date.now()
  });
  
  return batchId;
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

