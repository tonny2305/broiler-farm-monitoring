<?php
error_reporting(0); // Nonaktifkan pesan error/warning

// Konfigurasi koneksi database
$servername = "localhost";
$username = "root";
$password = "";
$dbname = "iot_sensors";

// Buat koneksi ke database
$conn = new mysqli($servername, $username, $password, $dbname);

// Periksa koneksi
if ($conn->connect_error) {
    die("Koneksi gagal: " . $conn->connect_error);
}

// Ambil data dari URL (HTTP GET request)
$temperature = $_GET['temperature'];
$humidity = $_GET['humidity'];
$intensity = $_GET['intensity'];
$ammonia = $_GET['ammonia'];
$ch4 = $_GET['ch4'];
$h2s = $_GET['h2s'];
$timestamp = $_GET['timestamp'];

// Validasi data (pastikan data tidak kosong)
if (empty($temperature) || empty($humidity) || empty($intensity) || empty($ammonia) || empty($ch4) || empty($h2s) || empty($timestamp)) {
    die("Error: Data tidak lengkap.");
}

// Query SQL untuk menyimpan data ke tabel
$sql = "INSERT INTO sensor_data (temperature, humidity, intensity, ammonia, ch4, h2s, timestamp)
        VALUES ('$temperature', '$humidity', '$intensity', '$ammonia', '$ch4', '$h2s', '$timestamp')";

// Eksekusi query
if ($conn->query($sql) === TRUE) {
    echo "Data berhasil disimpan.";
} else {
    echo "Error: " . $sql . "<br>" . $conn->error;
}

// Tutup koneksi database
$conn->close();
?>
