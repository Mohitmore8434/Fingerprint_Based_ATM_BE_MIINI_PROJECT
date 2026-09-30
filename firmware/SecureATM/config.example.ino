#include <WiFi.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>
#include <Adafruit_Fingerprint.h>

// ================= WIFI =================
const char* ssid = "Tanveer 1";
const char* password = "Jeetu@143";

// ================= FIREBASE =================
String baseURL = "https://fingerprint-atm-6f38f-default-rtdb.firebaseio.com/";

// ================= HARDWARE =================
#define BUZZER 25
#define LOGOUT_BTN 26

// ================= FINGERPRINT =================
HardwareSerial SerialFP(2);
Adafruit_Fingerprint finger = Adafruit_Fingerprint(&SerialFP);

bool fingerBusy = false;

// ================= SETUP =================
void setup() {
  Serial.begin(115200);

  pinMode(BUZZER, OUTPUT);
  pinMode(LOGOUT_BTN, INPUT_PULLUP);

  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) delay(500);

  SerialFP.begin(57600, SERIAL_8N1, 16, 17);
  finger.begin(57600);

  if (!finger.verifyPassword()) {
    Serial.println("Fingerprint error");
    while (1);
  }

  Serial.println("System Ready");
}

// ================= LOOP =================
void loop() {

  checkFingerprint();
  checkCommand();
  checkLogout();

  delay(300);
}

// ================= FINGERPRINT LOGIN =================
void checkFingerprint() {

  if (fingerBusy) return;

  int id = getFingerprintID();
  if (id == -1) return;

  fingerBusy = true;

  updateLogin(id);

  while (finger.getImage() != FINGERPRINT_NOFINGER);
  delay(800);

  fingerBusy = false;
}

int getFingerprintID() {
  if (finger.getImage() != FINGERPRINT_OK) return -1;
  if (finger.image2Tz() != FINGERPRINT_OK) return -1;
  if (finger.fingerFastSearch() != FINGERPRINT_OK) return -1;
  return finger.fingerID;
}

void updateLogin(int id) {

  WiFiClientSecure client;
  client.setInsecure();
  HTTPClient http;

  // reset first
  http.begin(client, baseURL + "atm/currentUser.json");
  http.PUT("0");
  http.end();

  delay(200);

  // send ID
  http.begin(client, baseURL + "atm/currentUser.json");
  http.PUT(String(id));
  http.end();

  http.begin(client, baseURL + "atm/loginType.json");
  http.PUT("\"fingerprint\"");
  http.end();

  Serial.println("Login Updated");
}

// ================= COMMAND HANDLER =================
void checkCommand() {

  WiFiClientSecure client;
  client.setInsecure();
  HTTPClient http;

  String url = baseURL + "commands/current.json";

  http.begin(client, url);
  int code = http.GET();

  if (code != 200) {
    http.end();
    return;
  }

  String payload = http.getString();
  http.end();

  if (payload.indexOf("\"status\":\"pending\"") == -1) return;

  String action = extract(payload, "action");
  String uid = extract(payload, "userID");
  int amount = extract(payload, "amount").toInt();

  int balance = getBalance(uid);

  if (action == "balance") {
    completeCommand();
    return;
  }

  if (action == "deposit") {
    balance += amount;
    updateBalance(uid, balance);
    beepSuccess();
  }

  else if (action == "withdraw") {
    if (amount > balance) {
      beepFail();
      completeCommand();
      return;
    }
    balance -= amount;
    updateBalance(uid, balance);
    beepSuccess();
  }

  pushReceipt(uid, action, amount, balance);
  completeCommand();
}

// ================= FIREBASE OPS =================
int getBalance(String id) {

  WiFiClientSecure client;
  client.setInsecure();
  HTTPClient http;

  String url = baseURL + "users/" + id + "/balance.json";

  http.begin(client, url);
  http.GET();

  int bal = http.getString().toInt();
  http.end();

  return bal;
}

void updateBalance(String id, int bal) {

  WiFiClientSecure client;
  client.setInsecure();
  HTTPClient http;

  String url = baseURL + "users/" + id + "/balance.json";

  http.begin(client, url);
  http.PUT(String(bal));
  http.end();
}

void completeCommand() {

  WiFiClientSecure client;
  client.setInsecure();
  HTTPClient http;

  http.begin(client, baseURL + "commands/current/status.json");
  http.PUT("\"done\"");
  http.end();
}

void pushReceipt(String id, String type, int amt, int bal) {

  WiFiClientSecure client;
  client.setInsecure();
  HTTPClient http;

  String url = baseURL + "receipts/" + id + ".json";

  String json = "{";
  json += "\"type\":\"" + type + "\",";
  json += "\"amount\":" + String(amt) + ",";
  json += "\"balance\":" + String(bal) + ",";
  json += "\"time\":\"" + String(millis()) + "\"";
  json += "}";

  http.begin(client, url);
  http.POST(json);
  http.end();
}

// ================= LOGOUT BUTTON =================
void checkLogout() {

  if (digitalRead(LOGOUT_BTN) == LOW) {

    WiFiClientSecure client;
    client.setInsecure();
    HTTPClient http;

    http.begin(client, baseURL + "atm/currentUser.json");
    http.PUT("0");
    http.end();

    http.begin(client, baseURL + "atm/loginType.json");
    http.PUT("\"\"");
    http.end();

    beepSuccess();
    delay(1000);
  }
}

// ================= BUZZER =================
void beepSuccess() {
  digitalWrite(BUZZER, HIGH);
  delay(200);
  digitalWrite(BUZZER, LOW);
}

void beepFail() {
  for (int i = 0; i < 2; i++) {
    digitalWrite(BUZZER, HIGH);
    delay(150);
    digitalWrite(BUZZER, LOW);
    delay(150);
  }
}

// ================= JSON PARSER =================
String extract(String data, String key) {
  int start = data.indexOf(key);
  if (start == -1) return "";

  start = data.indexOf(":", start) + 1;
  while (data[start] == '"' || data[start] == ' ') start++;

  int end = start;
  while (end < data.length() && data[end] != '"' && data[end] != ',' && data[end] != '}') end++;

  return data.substring(start, end);
}
