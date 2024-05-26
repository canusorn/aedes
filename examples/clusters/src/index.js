const cluster = require('cluster')
const Aedes = require('aedes')
const { createServer } = require('net')
const { cpus } = require('os')
const { MongoClient } = require("mongodb");
const cors = require('cors');

const api = require('./routes/api');

const MONGO_URL = 'mongodb://127.0.0.1/aedes-clusters'


const express = require('express')
const app = express()
const port = 3000

app.use(cors({
  origin: ['http://192.168.0.101:8080', 'http://localhost:5173']
}));

const mq = require('mqemitter-mongodb')({
  url: MONGO_URL
})

const persistence = require('aedes-persistence-mongodb')({
  url: MONGO_URL
})

function startAedes() {

  const port = 1883

  const aedes = Aedes({
    id: 'BROKER_' + cluster.worker.id,
    mq,
    persistence
  })

  const server = createServer(aedes.handle)

  server.listen(port, '0.0.0.0', function () {
    console.log('Aedes listening on port:', port)
    aedes.publish({ topic: 'aedes/hello', payload: "I'm broker " + aedes.id })
  })

  server.on('error', function (err) {
    console.log('Server error', err)
    process.exit(1)
  })

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

    if (packet.topic.includes('data/update')) {
      // console.table(Buffer.from(packet.payload, 'base64').toString());
      const datapayload = JSON.parse(Buffer.from(packet.payload, 'base64').toString());
      datapayload.time = new Date();

      const uri = "mongodb://localhost:27017";
      const clientmongo = new MongoClient(uri);
      const database = clientmongo.db("insertDB");
      const db = database.collection(client.id);

      const result = await db.insertOne(datapayload);
      clientmongo.close();

      console.log(`A document was inserted with the _id: ${result.insertedId}`);
    }

  })
}

function startHttp(){
  app.use(express.json());

  app.get('/', (req, res) => {
    res.send('Hello World!')
  })

  app.use('/api', api);

  app.listen(port, () => {
    console.log(`Example app listening on port ${port}`)
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
