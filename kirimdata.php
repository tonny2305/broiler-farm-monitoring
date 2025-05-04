<?php
// Konfigurasi database
$host = "192.168.1.13";  // IP MySQL Workbench
$user = "root";          // Username MySQL
$pass = "yobelmartha123"; // Password MySQL
$dbname = "iot_sensors"; // Nama database

// Aktifkan error reporting untuk debugging
mysqli_report(MYSQLI_REPORT_ERROR | MYSQLI_REPORT_STRICT);

// Koneksi ke database dengan penanganan error
try {
    $conn = new mysqli($host, $user, $pass, $dbname);
    $conn->set_charset("utf8mb4"); // Pastikan menggunakan karakter UTF-8
} catch (mysqli_sql_exception $e) {
    die("Koneksi gagal: " . $e->getMessage());
}

// Ambil data dari GET request dan validasi
$temperature = isset($_GET['temperature']) ? floatval($_GET['temperature']) : null;
$humidity = isset($_GET['humidity']) ? floatval($_GET['humidity']) : null;
$intensity = isset($_GET['intensity']) ? floatval($_GET['intensity']) : null;
$ammonia = isset($_GET['ammonia']) ? floatval($_GET['ammonia']) : null;

// Cek apakah semua nilai valid
if ($temperature === null || $humidity === null || $intensity === null || $ammonia === null) {
    die("Error: Data tidak lengkap!");
}

// Buat query menggunakan prepared statement untuk keamanan
$sql = "INSERT INTO sensor_data (temperature, humidity, intensity, ammonia) VALUES (?, ?, ?, ?)";
$stmt = $conn->prepare($sql);

// Bind parameter ke query
$stmt->bind_param("dddd", $temperature, $humidity, $intensity, $ammonia);

// Eksekusi query dan cek keberhasilan
if ($stmt->execute()) {
    echo "Data berhasil disimpan";
} else {
    echo "Error: " . $stmt->error;
}

// Tutup koneksi
$stmt->close();
$conn->close();
?>
