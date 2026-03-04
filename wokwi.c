#include <WiFi.h>
#include <HTTPClient.h>
#include "DHT.h"

#define DHTPIN 4
#define DHTTYPE DHT22

DHT dht(DHTPIN, DHTTYPE);

const char* ssid = "Wokwi-GUEST";
const char* password = "";

// ⚠️⚠️ MODIFIQUE A URL ⚠️⚠️
const char* serverUrl = "https://url.trycloudflare.com/api/leituras";

// Variáveis para classificar os eventos
float previousTemperature = 0.0;
unsigned long previousTime = 0;

// Agora enviamos todos os dados a cada 5 segundos (5000 ms)
unsigned long sendInterval = 5000; 
unsigned long lastSend = 0;

void setup(){
  Serial.begin(115200);
  delay(1000);
  dht.begin();
  connectWiFi();
}

void loop(){
  unsigned long currentTime = millis();
  
  // Executa a cada 5 segundos
  if (currentTime - lastSend > sendInterval) {
    lastSend = currentTime;

    float temperature;
    float humidity;
    
    if(readSensor(temperature, humidity)){
      
      String eventDetected = "normal"; // Por padrão, tudo está normal

      // ==========================================
      // Classificação do Evento (Sem bloquear o envio)
      // ==========================================
      if (temperature > 30.0) {
        eventDetected = "temperatura_alta";
      }

      unsigned long timeDifference = currentTime - previousTime;
      float tempDifference = abs(temperature - previousTemperature);

      // Se variou 5 graus ou mais desde o último envio
      if (tempDifference >= 5.0 && timeDifference <= sendInterval) {
        eventDetected = "variacao_abrupta";
      }

      // ==========================================
      // Envio Contínuo
      // ==========================================
      Serial.println("\n[+] Coleta realizada. Enviando dados para o servidor...");
      Serial.print("Classificação: "); Serial.println(eventDetected);
      
      String jsonPayload = buildJson(temperature, humidity, eventDetected);
      sendHTTP(jsonPayload);

      // Atualiza o histórico para a próxima leitura
      previousTemperature = temperature;
      previousTime = currentTime;
    }
  }
}

void connectWiFi(){
  Serial.println("Conectando ao WiFi...");
  WiFi.begin(ssid, password);

  while (WiFi.status() != WL_CONNECTED){
    delay(500);
    Serial.print(".");
  }

  Serial.println("\nWiFi conectado!");
  Serial.println("IP: ");
  Serial.println(WiFi.localIP());
}

bool readSensor(float &temperature, float &humidity){
  humidity = dht.readHumidity();
  temperature = dht.readTemperature();

  if (isnan(humidity) || isnan(temperature)){
    Serial.println("Erro ao ler DHT22");
    return false;
  } 

  Serial.print("\nLeitura - Temp: ");
  Serial.print(temperature);
  Serial.print("°C | Umidade: ");
  Serial.print(humidity);
  Serial.println("%");

  return true;
}

String buildJson(float temp, float hum, String evento){
  unsigned long timestamp = millis();

  String json = "{";
  json += "\"device_id\":\"esp32-01\",";
  json += "\"timestamp\":" + String(timestamp) + ",";
  json += "\"temperatura\":" + String(temp, 2) + ",";
  json += "\"umidade\":" + String(hum, 2) + ",";
  json += "\"evento\":\"" + evento + "\"";
  json += "}";

  return json;
}

void sendHTTP(String payload) {
  if (WiFi.status() == WL_CONNECTED) {
    HTTPClient http;
    http.begin(serverUrl);
    http.addHeader("Content-Type", "application/json");

    int httpResponseCode = http.POST(payload);

    if (httpResponseCode > 0) {
      Serial.print("HTTP Response code: ");
      Serial.println(httpResponseCode);
    } else {
      Serial.print("Erro HTTP: ");
      Serial.println(http.errorToString(httpResponseCode).c_str());
    }

    http.end();
  } else {
    Serial.println("Wifi desconectado.");
  }
}
