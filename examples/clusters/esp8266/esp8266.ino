// This example uses an Adafruit Huzzah ESP8266
// to connect to shiftr.io.
//
// You can check on your device after a successful
// connection here: https://www.shiftr.io/try.
//
// by Joël Gähwiler
// https://github.com/256dpi/arduino-mqtt

#include <ESP8266WiFi.h>
#include <MQTT.h>
#include <DHT.h>

const char ssid[] = "G6PD";
const char pass[] = "570610193";

WiFiClient net;
MQTTClient client;

#define DHTPIN D7
// Uncomment whatever type you're using!
 #define DHTTYPE DHT11   // DHT 11
//#define DHTTYPE DHT22 // DHT 22  (AM2302), AM2321
// #define DHTTYPE DHT21   // DHT 21 (AM2301)
DHT dht(DHTPIN, DHTTYPE);

unsigned long lastMillis = 0;

void connect() {
  Serial.print("checking wifi...");
  while (WiFi.status() != WL_CONNECTED) {
    Serial.print(".");
    delay(1000);
  }

  Serial.print("\nconnecting...");

  String S = String(ESP.getChipId());
  int   ArrayLength  = S.length() + 1; //The +1 is for the 0x00h Terminator
  char  CharArray[ArrayLength];
  S.toCharArray(CharArray, ArrayLength);

  while (!client.connect(CharArray, "anusorn1998@gmail.com","iotbundle")) {
    Serial.print(".");
    delay(1000);
  }

  Serial.println("\nconnected!");

  client.subscribe("/" + S +"/#");
  // client.unsubscribe("/hello");
}

void messageReceived(String &topic, String &payload) {
  Serial.println("incoming: " + topic + " - " + payload);

  // Note: Do not use the client in the callback to publish, subscribe or
  // unsubscribe as it may cause deadlocks when other things arrive while
  // sending and receiving acknowledgments. Instead, change a global variable,
  // or push to a queue and handle it in the loop after calling `client.loop()`.
}

void setup() {
  Serial.begin(115200);
  WiFi.begin(ssid, pass);
  dht.begin();
  // Note: Local domain names (e.g. "Computer.local" on OSX) are not supported
  // by Arduino. You need to set the IP address directly.
  client.begin("192.168.0.101", net);
  client.onMessage(messageReceived);

  connect();
}

void loop() {
  client.loop();
  delay(10);  // <- fixes some issues with WiFi stability

  if (!client.connected()) {
    connect();
  }

  // publish a message roughly every second.
  if (millis() - lastMillis > 2000) {
    lastMillis = millis();

    float humid = dht.readHumidity();
    float temp = dht.readTemperature();

    String S = "/" + String(ESP.getChipId()) + "/data/update";
    int   ArrayLength  = S.length() + 1; //The +1 is for the 0x00h Terminator
    char  CharArray[ArrayLength];
    S.toCharArray(CharArray, ArrayLength);

    String data = "{\"humid\":" + String(humid, 1) + ",";
    data += "\"temp\":" + String(temp, 1) + "}";

    Serial.println(data);
    char msg[data.length() + 1];
    data.toCharArray(msg, (data.length() + 1));

    client.publish(CharArray, msg );
  }

}
