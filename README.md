# Sistem Monitoring Peternakan Ayam Broiler

Proyek ini adalah aplikasi web komprehensif untuk memantau parameter lingkungan di peternakan ayam broiler. Dibangun dengan Next.js dan Firebase, aplikasi ini menyediakan pemantauan real-time suhu, kelembaban, kadar amonia, dan parameter penting lainnya untuk memastikan kondisi optimal bagi pertumbuhan dan kesehatan ayam.

## Fitur Utama

- Pemantauan lingkungan secara real-time (suhu, kelembaban, amonia, metana, hidrogen sulfida, intensitas cahaya)
- Ambang batas parameter yang sesuai dengan tahap pertumbuhan ayam
- Sistem manajemen batch untuk melacak beberapa kelompok ayam
- Dashboard admin untuk pengelolaan data dan pelaporan
- Desain responsif untuk perangkat desktop dan mobile
- Analisis data statistik dan visualisasi
- Fitur ekspor data

## Prasyarat

Sebelum memulai, pastikan Anda telah menginstal:

- [Node.js](https://nodejs.org/) (direkomendasikan versi 18.0.0 atau lebih tinggi)
- npm (sudah termasuk dengan Node.js), [Yarn](https://yarnpkg.com/), [pnpm](https://pnpm.io/), atau [Bun](https://bun.sh/)
- [Git](https://git-scm.com/) untuk mengkloning repositori
- Akun Firebase (tier gratis sudah cukup untuk memulai)

## Pengaturan dan Instalasi

### 1. Kloning Repositori

```bash
git clone https://github.com/yourusername/broiler-farm-monitoring.git
cd broiler-farm-monitoring
```

### 2. Instalasi Dependensi

Menggunakan npm:

```bash
npm install
```

Atau menggunakan Yarn:

```bash
yarn install
```

Atau menggunakan pnpm:

```bash
pnpm install
```

Atau menggunakan Bun:

```bash
bun install
```

### 3. Pengaturan Firebase

#### Membuat Proyek Firebase

1. Kunjungi [Firebase Console](https://console.firebase.google.com/)
2. Klik "Add project" dan ikuti wizard pengaturan
3. Setelah proyek dibuat, klik pada ikon "Web" (</>) untuk menambahkan aplikasi web
4. Daftarkan aplikasi dengan nama (misal "Monitoring Peternakan Ayam Broiler")
5. Salin objek konfigurasi Firebase

#### Menyiapkan Realtime Database

1. Di konsol Firebase, buka "Build > Realtime Database"
2. Klik "Create Database"
3. Pilih lokasi (pilih yang terdekat dengan pengguna Anda)
4. Mulai dalam "test mode" untuk pengembangan (Anda akan mengamankannya nanti)
5. Klik "Enable"

#### Menyiapkan Autentikasi

1. Di konsol Firebase, buka "Build > Authentication"
2. Klik "Get Started"
3. Aktifkan autentikasi "Email/Password"
4. Simpan perubahan

### 4. Mengonfigurasi Variabel Lingkungan

Buat file `.env.local` di direktori utama dengan konfigurasi Firebase Anda:

```env
NEXT_PUBLIC_FIREBASE_API_KEY=api_key_anda
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=proyek_anda.firebaseapp.com
NEXT_PUBLIC_FIREBASE_DATABASE_URL=https://proyek_anda-default-rtdb.region.firebasedatabase.app
NEXT_PUBLIC_FIREBASE_PROJECT_ID=id_proyek_anda
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=proyek_anda.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=sender_id_anda
NEXT_PUBLIC_FIREBASE_APP_ID=app_id_anda
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=measurement_id_anda
```

Ganti placeholder dengan nilai konfigurasi Firebase Anda yang sebenarnya.

### 5. Menjalankan Server Pengembangan

Jalankan server pengembangan:

```bash
npm run dev
# atau
yarn dev
# atau
pnpm dev
# atau
bun dev
```

Buka [http://localhost:3000](http://localhost:3000) dengan browser Anda untuk melihat aplikasi.

### 6. Membuat Pengguna Admin

1. Navigasikan ke [http://localhost:3000/setup-admin](http://localhost:3000/setup-admin)
2. Buat akun admin dengan email dan password
3. Akun ini akan memiliki hak akses administratif dalam aplikasi

## Opsi Deployment

### Deploy di Vercel (Direkomendasikan)

Cara termudah untuk men-deploy aplikasi Next.js Anda adalah menggunakan [Platform Vercel](https://vercel.com) dari pembuat Next.js.

1. Buat akun Vercel di [vercel.com](https://vercel.com)
2. Instal Vercel CLI:
   ```bash
   npm i -g vercel
   ```
3. Jalankan perintah berikut dari direktori proyek Anda:
   ```bash
   vercel
   ```
4. Ikuti petunjuk untuk menghubungkan proyek Anda ke Vercel
5. Tambahkan variabel lingkungan Anda di dashboard Vercel di bawah Project Settings > Environment Variables
6. Untuk deployment produksi, jalankan:
   ```bash
   vercel --prod
   ```

### Deploy di Netlify

1. Buat akun Netlify di [netlify.com](https://netlify.com)
2. Instal Netlify CLI:
   ```bash
   npm install -g netlify-cli
   ```
3. Build proyek Anda:
   ```bash
   npm run build
   ```
4. Deploy ke Netlify:
   ```bash
   netlify deploy
   ```
5. Untuk deployment produksi:
   ```bash
   netlify deploy --prod
   ```
6. Atur variabel lingkungan Anda di dashboard Netlify di bawah Site settings > Build & deploy > Environment

### Deploy di Server Kustom

Untuk men-deploy di server kustom, Anda perlu mem-build proyek dan menjalankannya:

1. Build proyek:
   ```bash
   npm run build
   ```

2. Mulai server produksi:
   ```bash
   npm start
   ```

3. Aplikasi akan tersedia di alamat IP server pada port 3000 (secara default)

4. Untuk penggunaan produksi, pertimbangkan untuk menggunakan manajer proses seperti [PM2](https://pm2.keymetrics.io/):
   ```bash
   npm install -g pm2
   pm2 start npm --name "peternakan-ayam" -- start
   ```

### Menyiapkan Reverse Proxy (Contoh Nginx)

Untuk penggunaan produksi, direkomendasikan untuk menyiapkan reverse proxy:

```nginx
server {
    listen 80;
    server_name domain-anda.com;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## Konfigurasi Tambahan

### Pengaturan Domain Kustom

#### Di Vercel:
1. Buka proyek Anda di dashboard Vercel
2. Navigasikan ke "Settings" > "Domains"
3. Tambahkan domain kustom Anda dan ikuti instruksi untuk menyiapkan catatan DNS

#### Di Netlify:
1. Buka situs Anda di dashboard Netlify
2. Navigasikan ke "Site settings" > "Domain management"
3. Klik pada "Add custom domain" dan ikuti instruksi

### Mengamankan Aturan Firebase

Untuk produksi, perbarui aturan Realtime Database Firebase Anda untuk mengamankan data Anda:

1. Buka Firebase Console > Realtime Database > Rules
2. Perbarui aturan menjadi seperti:

```json
{
  "rules": {
    "sensor_data": {
      ".read": true,
      ".write": "auth != null && auth.uid != null"
    },
    "chicken_data": {
      ".read": true,
      ".write": "auth != null && auth.uid != null"
    },
    "chicken_history": {
      ".read": true,
      ".write": "auth != null && auth.uid != null"
    },
    "users": {
      "$uid": {
        ".read": "$uid === auth.uid || root.child('users').child(auth.uid).child('role').val() === 'admin'",
        ".write": "$uid === auth.uid || root.child('users').child(auth.uid).child('role').val() === 'admin'"
      }
    }
  }
}
```

## Struktur Proyek

```
broiler-farm-monitoring/
├── app/                   # Halaman aplikasi Next.js
│   ├── admin/             # Halaman dashboard admin
│   ├── login/             # Halaman autentikasi
│   ├── setup-admin/       # Halaman pengaturan admin
│   └── page.tsx           # Halaman dashboard utama
├── components/            # Komponen React
│   ├── admin/             # Komponen khusus admin
│   └── ui/                # Komponen UI
├── hooks/                 # Hook React kustom
├── lib/                   # Fungsi utilitas
│   └── firebase.ts        # Konfigurasi Firebase
└── public/                # Aset statis
```

## Pemecahan Masalah

### Masalah Umum

1. **Masalah Koneksi Firebase**
   - Periksa apakah konfigurasi Firebase Anda benar di `.env.local`
   - Pastikan IP Anda tidak diblokir oleh aturan keamanan Firebase

2. **Error Build Next.js**
   - Pastikan Anda menggunakan versi Node.js yang kompatibel
   - Coba bersihkan folder cache `.next` dan build ulang

3. **Masalah Autentikasi**
   - Verifikasi bahwa autentikasi Email/Password telah diaktifkan di Firebase
   - Periksa konsol browser untuk pesan error spesifik

## Berkontribusi

Kami menyambut kontribusi untuk proyek ini! Untuk berkontribusi:

1. Fork repositori
2. Buat branch baru (`git checkout -b fitur/nama-fitur-anda`)
3. Buat perubahan Anda
4. Commit perubahan Anda (`git commit -m 'Menambahkan fitur'`)
5. Push ke branch (`git push origin fitur/nama-fitur-anda`)
6. Buat Pull Request

## Lisensi

Proyek ini dilisensikan di bawah Lisensi MIT - lihat file LICENSE untuk detailnya.

## Dukungan

Jika Anda mengalami masalah atau memiliki pertanyaan, silakan buat issue di repositori GitHub atau hubungi pengelola proyek.

---

Proyek ini dibuat dengan [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app) dan menggunakan beberapa library open-source. Kami berterima kasih kepada semua kontributor yang membuat alat-alat ini tersedia.
