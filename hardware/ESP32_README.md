# ESP32-S3 + WiFi + RC522 + Ultrasonic for CLIRDEC

ESP32-S3 devices connect to the system **over WiFi**. They read RFID (RC522) and distance (ultrasonic), then send events to the server via **REST** or **WebSocket (IoT channel)**.

## Connectivity

- **WiFi:** ESP32-S3 joins the same network as the CLIRDEC server (or a network that can reach it). Configure SSID and password in the device firmware.
- **Server URL:** Set the base URL (e.g. `http://192.168.1.10:3001` for local dev, or `https://your-app.railway.app` in production) so the device can POST to `/api/iot/attendance` or connect to `/iot` (WebSocket).

## Endpoints

- **REST:** `POST https://<server>/api/iot/attendance` with JSON body (see below).
- **WebSocket (IoT):** `wss://<server>/iot` — connect and send messages:
  - `{"type":"ping"}` or `{"type":"heartbeat"}` → server replies `{"type":"pong","ts":...}` for connection monitoring.
  - `{"type":"attendance","data":{"card_uid":"...","proximity_cm":35,"session_id":"optional-uuid","device_id":"optional"}}` → same validation as REST; attendance is recorded and dashboard is updated.

## WiFi configuration (ESP32-S3)

In your firmware, configure WiFi and the server URL, for example:

```cpp
// Arduino/ESP-IDF style
const char* WIFI_SSID = "YourNetwork";
const char* WIFI_PASS = "YourPassword";
const char* SERVER_URL = "http://192.168.1.10:3001";  // or https://your-app.railway.app
```

After `WiFi.begin(WIFI_SSID, WIFI_PASS)` and connection, use `SERVER_URL` as the base for REST and WebSocket (e.g. `SERVER_URL + "/api/iot/attendance"`).

## Wiring (conceptual)

- **RC522:** SDA, SCK, MOSI, MISO, RST, 3.3V, GND to ESP32-S3.
- **Ultrasonic (e.g. HC-SR04):** Trig, Echo, VCC, GND to ESP32-S3. Measure distance in cm.

## Endpoint

`POST https://<your-server>/api/iot/attendance`

Body (JSON):

```json
{
  "card_uid": "ABC123",
  "proximity_cm": 35,
  "session_id": "optional-uuid",
  "device_id": "optional"
}
```

- `card_uid`: string from RC522 (e.g. hex or decimal UID).
- `proximity_cm`: distance in cm; attendance is accepted only if within `PROXIMITY_MAX_CM` (default 80).
- `session_id`: optional; if omitted, the current active session is used.

## Logic on ESP32-S3

1. Connect to WiFi (e.g. `WiFi.begin`), then ensure the server URL is reachable.
2. On RFID read, read ultrasonic distance.
3. If distance within range (e.g. 5–80 cm), send the payload.
4. Use HTTP client (e.g. `WiFiClient`, `HTTPClient` in Arduino/ESP-IDF) to POST JSON to `<SERVER_URL>/api/iot/attendance`, or open a WebSocket to `<SERVER_URL>/iot` and send `{"type":"attendance","data":{...}}`.

## Libraries (Arduino)

- MFRC522 for RC522.
- NewPing or similar for HC-SR04.

Example snippet (pseudo):

```cpp
// After reading card UID and distance:
String payload = "{\"card_uid\":\"" + String(uid) + "\",\"proximity_cm\":" + String(distanceCm) + "}";
http.begin(client, "https://YOUR_RAILWAY_URL/api/iot/attendance");
http.addHeader("Content-Type", "application/json");
int code = http.POST(payload);
```
