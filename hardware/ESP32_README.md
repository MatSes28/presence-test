# ESP32 + RC522 + Ultrasonic for CLIRDEC

Use an ESP32 to read RFID (RC522) and distance (ultrasonic), then send to the server via **REST** or **WebSocket (IoT channel)**.

## Endpoints

- **REST:** `POST https://<server>/api/iot/attendance` with JSON body (see below).
- **WebSocket (IoT):** `wss://<server>/iot` — connect and send messages:
  - `{"type":"ping"}` or `{"type":"heartbeat"}` → server replies `{"type":"pong","ts":...}` for connection monitoring.
  - `{"type":"attendance","data":{"card_uid":"...","proximity_cm":35,"session_id":"optional-uuid","device_id":"optional"}}` → same validation as REST; attendance is recorded and dashboard is updated.

## Wiring (conceptual)

- **RC522:** SDA, SCK, MOSI, MISO, RST, 3.3V, GND to ESP32.
- **Ultrasonic (e.g. HC-SR04):** Trig, Echo, VCC, GND to ESP32. Measure distance in cm.

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

## Logic on ESP32

1. On RFID read, read ultrasonic distance.
2. If distance within range (e.g. 5–80 cm), send the payload.
3. Use WiFi and HTTP client (e.g. `WiFiClient`, `HTTPClient` in Arduino/ESP-IDF) to POST JSON to the server.

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
