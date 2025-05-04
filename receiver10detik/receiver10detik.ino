#include <SPI.h>
#include <nRF24L01.h>
#include <RF24.h>
#include "WiFi.h"
#include "HTTPClient.h"
#include "WiFiClientSecure.h"
#include <ArduinoJson.h> // Library untuk parsing JSON
#include <RTClib.h> // Library untuk RTC (hanya untuk tipe data DateTime)

// Konfigurasi NRF24L01
RF24 radio(4, 5); // CE, CSN
const byte address[6] = "00001";

// Struktur data yang diterima
struct Data_package {
  float d1 = 0; // Temperatur
  float d2 = 0; // Humidity
  float d3 = 0; // Intensitas Cahaya
  float d4 = 0; // Ammonia
  float d5 = 0; // MQ-4 CH4
  float d6 = 0; // MQ-136 H2S
  DateTime timestamp; // Timestamp dari RTC
};

Data_package data;
int LED = 2; // LED indikator koneksi

// Konfigurasi WiFi
const char* SSID = "Suharso"; // Ganti dengan SSID WiFi Anda
const char* PASSWORD = "ayamjago"; // Ganti dengan Password WiFi Anda
const char* host = "192.168.1.13"; // IP server XAMPP

// Konfigurasi Firebase
const char* firebase_host = "https://broilerfarm-2a830-default-rtdb.asia-southeast1.firebasedatabase.app/";
const char* firebase_auth = "akzBGW0jOCndjNpEbPZukiW1eU4gaZY6TXgIHuYD"; 

// Variabel penyimpanan untuk interval pengiriman
const unsigned long sendInterval = 10000; // Kirim data setiap 10 detik
unsigned long lastSendTime = 0;

// Variabel untuk menyimpan counter data di Firebase
int dataCounter = 0;

void setup() {
  Serial.begin(9600);
  pinMode(LED, OUTPUT);

  // Koneksi ke WiFi
  connectToWiFi();

  // Inisialisasi radio NRF24L01
  Serial.println("Inisialisasi NRF24L01...");
  if (!radio.begin()) {
    Serial.println("Gagal menginisialisasi radio!");
    while (1);
  }
  radio.openReadingPipe(1, address);
  radio.setPALevel(RF24_PA_MIN);
  radio.startListening();
  Serial.println("Radio siap menerima data.");

  // Ambil counter terakhir dari Firebase
  getLastDataCounter();
}

void loop() {
  unsigned long currentMillis = millis();

  // Cek koneksi WiFi
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("WiFi terputus, mencoba menghubungkan kembali...");
    connectToWiFi();
  }

  // Cek apakah ada data yang diterima
  if (radio.available()) {
    radio.read(&data, sizeof(Data_package));

    // Tampilkan data di Serial Monitor
    Serial.println("Data diterima:");
    Serial.print("Temperatur: "); Serial.print(data.d1); Serial.println(" C");
    Serial.print("Humidity: "); Serial.print(data.d2); Serial.println(" %");
    Serial.print("Intensitas Cahaya: "); Serial.print(data.d3); Serial.println(" lux");
    Serial.print("Ammonia: "); Serial.print(data.d4, 3); Serial.println(" ppm");
    Serial.print("MQ-4 CH4: "); Serial.print(data.d5, 3); Serial.println(" ppm");
    Serial.print("MQ-136 H2S: "); Serial.print(data.d6, 3); Serial.println(" ppm");
    Serial.print("Timestamp: ");
    Serial.print(data.timestamp.year()); Serial.print("-");
    Serial.print(data.timestamp.month()); Serial.print("-");
    Serial.print(data.timestamp.day()); Serial.print(" ");
    Serial.print(data.timestamp.hour()); Serial.print(":");
    Serial.print(data.timestamp.minute()); Serial.print(":");
    Serial.println(data.timestamp.second());
    Serial.println("============================");

    // Kirim data setiap 10 detik
    if (currentMillis - lastSendTime >= sendInterval) {
      lastSendTime = currentMillis;

      // Format timestamp
      String timestamp = String(data.timestamp.year()) + "-" +
                         String(data.timestamp.month()) + "-" +
                         String(data.timestamp.day()) + " " +
                         String(data.timestamp.hour()) + ":" +
                         String(data.timestamp.minute()) + ":" +
                         String(data.timestamp.second());

      // Kirim data ke MySQL (XAMPP)
      sendToMySQL(data.d1, data.d2, data.d3, data.d4, data.d5, data.d6, timestamp);

      // Kirim data ke Firebase
      sendToFirebase(data.d1, data.d2, data.d3, data.d4, data.d5, data.d6, timestamp);
    }
  }
}

// Fungsi untuk menghubungkan ke WiFi
void connectToWiFi() {
  Serial.print("Menghubungkan ke WiFi");
  WiFi.begin(SSID, PASSWORD);

  while (WiFi.status() != WL_CONNECTED) {
    Serial.print(".");
    digitalWrite(LED, LOW);
    delay(500);
  }
  digitalWrite(LED, HIGH);
  Serial.println(" Terhubung ke WiFi");
}

// Fungsi untuk mengirim data ke MySQL (XAMPP)
void sendToMySQL(float temp, float hum, float intensity, float ammonia, float ch4, float h2s, String timestamp) {
  if (WiFi.status() == WL_CONNECTED) {
    HTTPClient http;

    // Encode timestamp (ganti spasi dengan %20)
    timestamp.replace(" ", "%20");

    // Buat URL dengan data sensor
    String url = "http://" + String(host) + "/Iot_sensors/senddata.php?temperature=" 
                 + String(temp, 2)  // 2 digit di belakang koma
                 + "&humidity=" + String(hum, 2)  // 2 digit di belakang koma
                 + "&intensity=" + String(intensity, 2)  // 2 digit di belakang koma
                 + "&ammonia=" + String(ammonia, 3)  // 3 digit di belakang koma
                 + "&ch4=" + String(ch4, 3)  // 3 digit di belakang koma
                 + "&h2s=" + String(h2s, 3)  // 3 digit di belakang koma
                 + "&timestamp=" + timestamp;

    Serial.print("Mengirim data ke MySQL: ");
    Serial.println(url);

    http.begin(url.c_str());
    int httpResponseCode = http.GET();

    if (httpResponseCode > 0) {
      String response = http.getString();
      Serial.println("Respons MySQL: " + response);
    } else {
      Serial.print("Error MySQL: ");
      Serial.println(httpResponseCode);
    }
    http.end();
  } else {
    Serial.println("Tidak terhubung ke WiFi");
  }
}

// Fungsi untuk mengirim data ke Firebase
void sendToFirebase(float temp, float hum, float intensity, float ammonia, float ch4, float h2s, String timestamp) {
  if (WiFi.status() == WL_CONNECTED) {
    HTTPClient http;
    WiFiClientSecure client;
    client.setInsecure();  // Gunakan ini jika tidak ada sertifikat

    // Buat path untuk data baru (misalnya, "sensor_data/data_ke_1")
    String firebase_url = String(firebase_host) + "/sensor_data/data_ke_" + String(dataCounter + 1) + ".json?auth=" + String(firebase_auth);

    // Buat payload JSON
    String jsonPayload = "{\"temperature\": " + String(temp, 2) +  // 2 digit di belakang koma
                         ", \"humidity\": " + String(hum, 2) +  // 2 digit di belakang koma
                         ", \"intensity\": " + String(intensity, 2) +  // 2 digit di belakang koma
                         ", \"ammonia\": " + String(ammonia, 3) +  // 3 digit di belakang koma
                         ", \"ch4\": " + String(ch4, 3) +  // 3 digit di belakang koma
                         ", \"h2s\": " + String(h2s, 3) +  // 3 digit di belakang koma
                         ", \"timestamp\": \"" + timestamp + "\"}";

    Serial.print("Mengirim data ke Firebase: ");
    Serial.println(firebase_url);
    Serial.println("Payload: " + jsonPayload);

    http.begin(client, firebase_url.c_str());
    http.addHeader("Content-Type", "application/json");
    int httpResponseCode = http.PUT(jsonPayload); // Gunakan PUT untuk menambahkan data baru

    if (httpResponseCode > 0) {
      String response = http.getString();
      Serial.println("Respons Firebase: " + response);

      // Update counter setelah data berhasil dikirim
      dataCounter++;
      updateDataCounter();
    } else {
      Serial.print("Error Firebase: ");
      Serial.println(httpResponseCode);
    }
    http.end();
  }
}

// Fungsi untuk mengambil counter terakhir dari Firebase
void getLastDataCounter() {
  if (WiFi.status() == WL_CONNECTED) {
    HTTPClient http;
    WiFiClientSecure client;
    client.setInsecure();  // Gunakan ini jika tidak ada sertifikat

    String firebase_url = String(firebase_host) + "/data_counter.json?auth=" + String(firebase_auth);

    http.begin(client, firebase_url.c_str());
    int httpResponseCode = http.GET();

    if (httpResponseCode > 0) {
      String response = http.getString();
      dataCounter = response.toInt();
      Serial.println("Counter terakhir: " + String(dataCounter));
    } else {
      Serial.print("Error mengambil counter: ");
      Serial.println(httpResponseCode);
    }
    http.end();
  } else {
    Serial.println("Tidak terhubung ke WiFi");
  }
}

// Fungsi untuk mengupdate counter di Firebase
void updateDataCounter() {
  if (WiFi.status() == WL_CONNECTED) {
    HTTPClient http;
    WiFiClientSecure client;
    client.setInsecure();  // Gunakan ini jika tidak ada sertifikat

    String firebase_url = String(firebase_host) + "/data_counter.json?auth=" + String(firebase_auth);

    String jsonPayload = String(dataCounter);

    http.begin(client, firebase_url.c_str());
    http.addHeader("Content-Type", "application/json");
    int httpResponseCode = http.PUT(jsonPayload); // Gunakan PUT untuk mengupdate counter

    if (httpResponseCode > 0) {
      String response = http.getString();
      Serial.println("Counter diupdate: " + response);
    } else {
      Serial.print("Error mengupdate counter: ");
      Serial.println(httpResponseCode);
    }
    http.end();
  } else {
    Serial.println("Tidak terhubung ke WiFi");
  }
}