#include <ModbusMaster.h>
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <SPI.h>
#include <nRF24L01.h>
#include <RF24.h>
#include <RTClib.h> // Tambahkan library RTC

//========= nRF Declaration ================//
RF24 radio(4, 5); // CE, CSN
const byte address[6] = "00001";
struct Data_package {
  float d1 = 0; // Temperatur
  float d2 = 0; // Humidity
  float d3 = 0; // Intensitas Cahaya
  float d4 = 0; // Ammonia
  float d5 = 0; // MQ-4 CH4
  float d6 = 0; // MQ-136 H2S
  DateTime timestamp; // Tambahkan timestamp
};
Data_package data;

#define BUZZ GPIO_NUM_15
#define LED1 GPIO_NUM_2

/////////======OLED============///////
#define SCREEN_WIDTH 128 // OLED display width, in pixels
#define SCREEN_HEIGHT 64 // OLED display height, in pixels
Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, -1);

// Variabel untuk slide
bool slide1 = true; // Slide pertama aktif
unsigned long lastSlideChange = 0;
const unsigned long slideInterval = 5000; // Ganti slide setiap 5 detik

//=======MQ135======//
const int MQ135pin = 26;  // Define the pin for MQ135 sensor
#define ledBadQuality 1
float threshold = 5.199;    // Batas ambang untuk memberikan peringatan suara (dalam ppm)

///////// PART OF CODE SHT20/////////
#define MAX485_DE      4
#define MAX485_RE_NEG  0
#define RX2 16
#define TX2 17

ModbusMaster node;

uint8_t result;
float temp, hum;
void preTransmission() {
  digitalWrite(MAX485_RE_NEG, 1);
  digitalWrite(MAX485_DE, 1);
}

void postTransmission() {
  digitalWrite(MAX485_RE_NEG, 0);
  digitalWrite(MAX485_DE, 0);
}

///////// PART OF CODE  LDR/////////
#define LDR_PIN 33 // ESP32 pin GPIO33 (ADC0)
float RL10 = 50; // Nilai resistansi LDR pada kondisi standar (misalnya, dalam keadaan gelap)
float GAMMA = 0.7; // Koefisien karakteristik sensor LDR
int sensorValue;
float lux;

// Pin analog dan digital untuk sensor MQ-4 dan MQ-136
#define MQ4_A_PIN 27  // Pin GPIO pada ESP32 untuk MQ-4 (Analog Output)
#define MQ136_A_PIN 25 // Pin GPIO pada ESP32 untuk MQ-136 (Analog Output)
#define MQ136_D_PIN 14 // Pin GPIO pada ESP32 untuk MQ-136 (Digital Output)

// Kalibrasi sensor (ubah sesuai dengan datasheet atau eksperimen)
const float R0_MQ4 = 10.0;   // Nilai resistansi udara bersih (kohm) untuk MQ-4
const float RL_MQ4 = 20.0;   // Nilai resistansi beban (kohm) untuk MQ-4
const float R0_MQ136 = 10.0; // Nilai resistansi udara bersih (kohm) untuk MQ-136
const float RL_MQ136 = 20.0; // Nilai resistansi beban (kohm) untuk MQ-136

// Inisialisasi RTC
RTC_DS3231 rtc;

void setup() {
  Serial.begin(115200);
  pinMode(BUZZ, OUTPUT);
  pinMode(LED1, OUTPUT);

  pinMode(MAX485_RE_NEG, OUTPUT);
  pinMode(MAX485_DE, OUTPUT);
  digitalWrite(MAX485_RE_NEG, 0);
  digitalWrite(MAX485_DE, 0);
  Serial2.begin(9600, SERIAL_8N1, RX2, TX2);
  node.begin(1, Serial2);
  node.preTransmission(preTransmission);
  node.postTransmission(postTransmission);

  // set the ADC attenuation to 11 dB (up to ~3.3V input)
  analogSetAttenuation(ADC_11db);

  if (!display.begin(SSD1306_SWITCHCAPVCC, 0x3C)) {
    Serial.println(F("SSD1306 allocation failed"));
    for (;;);
  }
  delay(2000);
  display.clearDisplay();
  display.setTextColor(WHITE);

  radio.begin();
  radio.openWritingPipe(address);
  radio.setPALevel(RF24_PA_MIN);
  radio.stopListening();

  pinMode(MQ136_D_PIN, INPUT); // Atur pin digital MQ-136 sebagai input

  // Inisialisasi RTC
  if (!rtc.begin()) {
    Serial.println("Couldn't find RTC");
    while (1);
  }

  if (rtc.lostPower()) {
    Serial.println("RTC lost power, let's set the time!");
    // Jika RTC kehilangan daya, set waktu ke waktu kompilasi
    rtc.adjust(DateTime(F(__DATE__), F(__TIME__)));
  }
}

void loop() {
  unsigned long currentMillis = millis();

  // Baca nilai sensor MQ-4
  int sensorValue_MQ4 = analogRead(MQ4_A_PIN);
  float voltage_MQ4 = sensorValue_MQ4 * (3.3 / 4095.0);
  float Rs_MQ4 = (3.3 - voltage_MQ4) / voltage_MQ4 * RL_MQ4;
  float ratio_MQ4 = Rs_MQ4 / R0_MQ4;
  float ppmCH4 = 1012.7 * pow(ratio_MQ4, -2.786); // Rumus CH4 yang diperbaiki

  // Baca nilai sensor MQ-136 (Analog)
  int sensorValue_MQ136 = analogRead(MQ136_A_PIN);
  float voltage_MQ136 = sensorValue_MQ136 * (3.3 / 4095.0);
  float Rs_MQ136 = (3.3 - voltage_MQ136) / voltage_MQ136 * RL_MQ136;
  float ratio_MQ136 = Rs_MQ136 / R0_MQ136;
  float ppmH2S = 36.737 * pow(ratio_MQ136, -3.536); // Rumus H2S yang diperbaiki

  // Baca nilai sensor MQ-136 (Digital)
  int digital_MQ136 = digitalRead(MQ136_D_PIN);

  // Cetak hanya konsentrasi ke Serial Monitor
  Serial.print("MQ-4 CH4 Concentration: ");
  Serial.print(ppmCH4);
  Serial.println(" ppm");

  Serial.print("MQ-136 H2S Concentration: ");
  Serial.print(ppmH2S);
  Serial.println(" ppm");

  Serial.print("MQ-136 H2S Digital Output: ");
  Serial.println(digital_MQ136);

  //==================================LDR PART=====================/////////
  int sensorValue = analogRead(LDR_PIN); // Membaca nilai analog dari pin LDR
  float voltage = sensorValue * (3.3 / 4095); // Mengonversi nilai bacaan ke tegangan
  float resistance = 10000 * (1 / ((3.3 / voltage) - 1)); // Menghitung resistansi LDR
  float lux = pow((RL10 * 1e3 * pow(10.0, GAMMA) / resistance), (1.0 / GAMMA));

  Serial.print("Nilai LDR: ");
  Serial.println(sensorValue);

  Serial.print("Intensitas Cahaya (lux): ");
  Serial.print(lux);
  Serial.println(" lux");
  delay(500);

  ///=================================SHT20============================////
  result = node.readInputRegisters(0x0001, 2);
  if (result == node.ku8MBSuccess) {
    temp = node.getResponseBuffer(0) / 10.0f;
    hum = node.getResponseBuffer(1) / 10.0f;
    Serial.print("Temp: "); Serial.print(temp);
    Serial.println(" ℃");

    Serial.print("Hum: "); Serial.print(hum);
    Serial.println(" %");

    node.clearResponseBuffer();
    node.clearTransmitBuffer();
    delay(500);
  }

  //==============================MQ135================================//
  int rawValue = analogRead(MQ135pin);
  float voltage2 = rawValue / 4095.0 * 5.0;
  float resistance2 = (5.0 - voltage2) / voltage2;
  float ppm = 1.0 / (0.03588 * pow(resistance2, 1.336));
  float co = ppm / 2.2;        // Approximate conversion from PPM to CO
  float methane = ppm / 2.7;    // Approximate conversion from PPM to CH4
  float ammonia = ppm / 3.6;    // Approximate conversion from PPM to NH3

  if (ammonia > threshold) {
    digitalWrite(BUZZ, HIGH);
    digitalWrite(LED1, HIGH);
    delay(500);
    digitalWrite(BUZZ, LOW);
    digitalWrite(LED1, LOW);
    delay(1000);
  }

  Serial.print("Raw Analog Value: ");
  Serial.println(rawValue);
  Serial.print("Voltage: ");
  Serial.println(voltage2);
  Serial.print("Sensor Resistance: ");
  Serial.println(resistance);
  Serial.print("CO2 PPM: ");
  Serial.println(ppm);
  Serial.print("CO: ");
  Serial.println(co);
  Serial.print("Methane (CH4) PPM: ");
  Serial.println(methane);
  Serial.print("Ammonia (NH3) PPM: ");
  Serial.println(ammonia, 3);
  delay(500);

  // ====Packing the Data NRF SENSOR======//
  data.d1 = temp;
  data.d2 = hum;
  data.d3 = lux;
  data.d4 = ammonia;
  data.d5 = ppmCH4; // Tambahan untuk MQ-4 CH4
  data.d6 = ppmH2S; // Tambahan untuk MQ-136 H2S
  data.timestamp = rtc.now(); // Tambahkan timestamp
  radio.write(&data, sizeof(Data_package));

  //=============================OLED=================//////
  if (currentMillis - lastSlideChange >= slideInterval) {
    lastSlideChange = currentMillis;
    slide1 = !slide1; // Toggle antara slide 1 dan slide 2
  }

  if (slide1) {
    displaySlide1(temp, hum, lux); // Slide 1: Temperatur, Humidity, Intensitas Cahaya
  } else {
    displaySlide2(ammonia, ppmCH4, ppmH2S); // Slide 2: Ammonia, CH4, H2S
  }
}

// Fungsi untuk menampilkan Slide 1 (Temperatur, Humidity, Intensitas Cahaya)
void displaySlide1(float temp, float hum, float intensity) {
  display.clearDisplay();
  display.setTextSize(1);
  display.setCursor(0, 0);
  display.print("Temp: " + String(temp) + " C");
  display.setCursor(0, 12);
  display.print("Hum: " + String(hum) + " %");
  display.setCursor(0, 24);
  display.print("Light: " + String(intensity) + " lux");
  display.display();
}

// Fungsi untuk menampilkan Slide 2 (Ammonia, CH4, H2S)
void displaySlide2(float ammonia, float ch4, float h2s) {
  display.clearDisplay();
  display.setTextSize(1);
  display.setCursor(0, 0);
  display.print("NH3: " + String(ammonia, 3) + " ppm");
  display.setCursor(0, 12);
  display.print("CH4: " + String(ch4, 3) + " ppm");
  display.setCursor(0, 24);
  display.print("H2S: " + String(h2s, 3) + " ppm");
  display.display();
}