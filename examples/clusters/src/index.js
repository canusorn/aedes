const cluster = require('cluster')
const Aedes = require('aedes')
const { createServer } = require('net')
const { cpus } = require('os')
const cors = require('cors');


const httpServer = require('http').createServer()
const ws = require('websocket-stream')

const api = require('./routes/api');
const { publish, authenticate } = require('./controllers/mqttdevice.controller.js');

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

  // const port = 8888
  ws.createServer({ server: httpServer }, aedes.handle)
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

  // Define your subscription authorization logic
  // Attach the authorization handler to the Aedes instance
  // aedes.authorizeSubscribe = (client, sub, callback) => {
  // Replace this with your actual authorization mechanism
  // console.log("authorizeSubscribe" + client.username + sub.topic);
  // if (client.username === 'anusorn1998@gmail.com' && sub.topic.startsWith('1733696')) {
  // callback(null, true); // Allow subscription
  // } else {
  //   callback(new Error('Unauthorized subscription'), false);
  // }
  // };
  // aedes.authorizeSubscribe = function (client, sub, callback) {
  //   if (sub.topic === 'aaaa') {
  //     return callback(new Error('wrong topic'))
  //   }
  //   if (sub.topic === 'bbb') {
  //     // overwrites subscription
  //     sub.topic = 'foo'
  //     sub.qos = 1
  //   }
  //   console.log("authorizeSubscribe" + client.username + sub.topic);
  //   callback(null, sub)
  // }

  // aedes.authorizePublish = function (client, packet, callback) {
  //   if (packet.topic === 'aaaa') {
  //     return callback(new Error('wrong topic'))
  //   }
  //   if (packet.topic === 'bbb') {
  //     packet.payload = Buffer.from('overwrite packet payload')
  //   }
  //   callback(null)
  // }

  aedes.on('subscribe', function (subscriptions, client) {
    console.log('MQTT client \x1b[32m' + (client ? client.id : client) +
      '\x1b[0m subscribed to topics: ' + subscriptions.map(s => s.topic).join('\n'), 'from broker', aedes.id)
  })

  aedes.on('unsubscribe', function (subscriptions, client) {
    console.log('MQTT client \x1b[32m' + (client ? client.id : client) +
      '\x1b[0m unsubscribed to topics: ' + subscriptions.join('\n'), 'from broker', aedes.id)
  })

  // fired when a client connects
  aedes.on('client', function (client) {
    console.log('Client Connected: \x1b[33m' + (client ? client.id : client) + '\x1b[0m', 'to broker', aedes.id)
  })

  // fired when a client disconnects
  aedes.on('clientDisconnect', function (client) {
    console.log('Client Disconnected: \x1b[31m' + (client ? client.id : client) + '\x1b[0m', 'to broker', aedes.id)
  })

  // fired when a message is published
  aedes.on('publish', async function (packet, client) {
    console.log('Client \x1b[31m' + (client ? client.id : 'BROKER_' + aedes.id) + '\x1b[0m has published', packet.payload.toString(), 'on', packet.topic, 'to broker', aedes.id)

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
