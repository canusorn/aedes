const cluster = require('cluster')
const Aedes = require('aedes')
const { createServer } = require('net')
const { cpus } = require('os')
const cors = require('cors');

const api = require('./routes/api');
const { publish, authenticate, authorizeSub } = require('./controllers/mqttdevice.controller.js');

const MONGO_URL = 'mongodb://127.0.0.1/aedes-clusters'


const express = require('express')
const app = express()
const port = 3000

app.use(cors({
  origin: ['http://192.168.0.101:8080', 'http://localhost:5173', 'http://localhost:4173']
}));

const mq = require('mqemitter-mongodb')({
  url: MONGO_URL
})

const persistence = require('aedes-persistence-mongodb')({
  url: MONGO_URL
})

function startAedes() {

  // const port = 1883
  const aedes = Aedes({
    id: 'BROKER_' + cluster.worker.id,
    mq,
    persistence
  })

  const ws = require('websocket-stream');
  const httpServer = require('http').createServer();
  ws.createServer({ server: httpServer }, aedes.handle);
  httpServer.listen(8888, function () {
    console.log('websocket server listening on port ', 8888)
  })

  const server = createServer(aedes.handle)
  server.listen(1883, '0.0.0.0', function () {
    console.log('Aedes listening on port:', 1883)
    aedes.publish({ topic: 'aedes/hello', payload: "I'm broker " + aedes.id })
  })

  server.on('error', function (err) {
    console.log('Server error', err)
    process.exit(1)
  })

  aedes.preConnect = function (client, packet, callback) {
    callback(null, true)
    // console.log('preConnect'); console.log(client.conn.remoteAddress);
  }

  aedes.authenticate = (client, username, password, callback) => {
    // Replace this with your actual authentication mechanism
    password = Buffer.from(password, 'base64').toString();
    console.log("MQTT Authenticate id:", client.id, "User:", username);
    // console.log("authenticate password:", password); // spacing level = 2
    authenticate(client, username, password, callback);
  };

  aedes.authorizeSubscribe = async function (client, sub, callback) {

    // console.dir(client.id);
    const espid = client.id;

    // if (ic === 'esp8266' || ic === 'esp32') {
    const thisDevice = { email: client._parser.settings.username, espid: espid };
    const allDevice = await authorizeSub(thisDevice.email);
    // console.dir(thisDevice)
    const matchid = allDevice.find(e => e.espid == thisDevice.espid);
    // console.log(matchid);
    // const matchemail = matchid.email === thisDevice.email;
    // console.log(matchemail);

    if (!matchid) {
      console.error("\x1B[31mSubscribe Unauthorize from " + client.id + ', Wrong user' + " at " + sub.topic)
      return callback(new Error('Subscribe Unauthorize, Wrong user'))
    }

    const subId = sub.topic.split('/')[1];
    const matchSub = allDevice.find(e => e.espid == subId);
    // console.log(matchSub);

    // console.log(sub.topic);
    // if (!sub.topic.startsWith("/" + espid + "/")) {
    if(!matchSub) {
      console.error("\x1B[31mSubscribe Unauthorize from " + client.id + ', Wrong Topic' + " at " + sub.topic)
      return callback(new Error('Subscribe Unauthorize, Wrong Topic'))
    }
    console.log("Subscribe Authorize from \x1b[32m" + client.id + "\x1b[0m at " + sub.topic);
    callback(null, sub)
  }

  aedes.authorizePublish = function (client, packet, callback) {
    const espid = client.id;
    if (!packet.topic.startsWith("/" + espid + "/")) {
      console.error("\x1B[31mPublish Unauthorize from " + client.id + ', Wrong Topic' + "at " + packet.topic)
      return callback(new Error('wrong topic'));
    }
    callback(null)
  }

  aedes.on('subscribe', function (subscriptions, client) {
    console.log('MQTT client \x1b[32m' + (client ? client.id : client) +
      '\x1b[0m subscribed to topics: ' + subscriptions.map(s => s.topic).join('\n'), 'from broker', aedes.id)
  })

  aedes.on('unsubscribe', function (subscriptions, client) {
    console.log('MQTT client \x1b[31m' + (client ? client.id : client) +
      '\x1b[0m unsubscribed to topics: ' + subscriptions.join('\n'), 'from broker', aedes.id)
  })

  // fired when a client connects
  aedes.on('client', function (client) {
    console.log('Client Connected: \x1b[32m' + (client ? client.id : client) + '\x1b[0m', 'to broker', aedes.id)
  })

  // fired when a client disconnects
  aedes.on('clientDisconnect', function (client) {
    console.log('Client Disconnected: \x1b[31m' + (client ? client.id : client) + '\x1b[0m', 'to broker', aedes.id)
  })

  // fired when a message is published
  aedes.on('publish', async function (packet, client) {
    console.log('Client \x1b[33m' + (client ? client.id : 'BROKER_' + aedes.id) + '\x1b[0m has published\x1b[33m', packet.payload.toString(), '\x1b[0mon', packet.topic, 'to broker', aedes.id)

    publish(packet, client);

  })
}

function startHttp() {
  app.use(express.json());

  app.get('/', (req, res) => {
    res.send('Hello World!')
  })

  app.use('/api', api);

  app.listen(port, () => {
    console.log(`Http app listening on port ${port}`)
  })
}

if (cluster.isMaster) {
  const numWorkers = cpus().length
  for (let i = 0; i < numWorkers; i++) {
    cluster.fork()
  }

  cluster.on('online', function (worker) {
    console.log('Worker ' + worker.process.pid + ' is online')
  })

  cluster.on('exit', function (worker, code, signal) {
    console.log('Worker ' + worker.process.pid + ' died with code: ' + code + ', and signal: ' + signal)
    console.log('Starting a new worker')
    cluster.fork()
  })
} else {
  startAedes();
  startHttp();
}
