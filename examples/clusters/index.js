const cluster = require('cluster')
const Aedes = require('aedes')
const { createServer } = require('net')
const { cpus } = require('os')
const MONGO_URL = 'mongodb://127.0.0.1/aedes-clusters'
const { MongoClient } = require("mongodb");
const cors = require('cors');

const express = require('express')
const app = express()
const port = 3000

app.use(cors({
  origin: ['http://192.168.0.101:8080','http://localhost:5173']
}));

const mq = require('mqemitter-mongodb')({
  url: MONGO_URL
})

const persistence = require('aedes-persistence-mongodb')({
  url: MONGO_URL
})

async function httpGetAll(req, res) {
  const espid = Number(req.params.espid);
  console.log(espid);
  var dataout = { labels: [], datasets: [] }

  console.log('***********httpGetAll************');

  const uri = "mongodb://localhost:27017";
  const client = new MongoClient(uri);
  async function run() {
    try {
      // Get the database and collection on which to run the operation
      const database = client.db("insertDB");
      const movies = database.collection(String(espid));


      // Query for movies that have a runtime less than 15 minutes
      const query = {};
      const options = {
        limit: 100,
        // Sort returned documents in ascending order by title (A->Z)
        sort: { time: -1 },
        // projection: { _id: 0, temp: 1, time: 1 },
      };
      // Execute query 
      const cursor = movies.find(query, options);
      // Print a message if no documents were found
      if ((await movies.countDocuments(query)) === 0) {
        console.log("No documents found!");
      }
      // Print returned documents
      // for await (const doc of cursor) {
      //   console.dir(doc);
      // }

      const data = await cursor.toArray();
      dataout = data;


      // dataout = data;

    } finally {
      await client.close();
    }
  }

  await run().catch(console.dir);


  return res.json(dataout);

}

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
      const haiku = database.collection(client.id);

      const result = await haiku.insertOne(datapayload);
      clientmongo.close();

      console.log(`A document was inserted with the _id: ${result.insertedId}`);
    }

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
  startAedes()

  app.use(express.json());

  app.get('/', (req, res) => {
    res.send('Hello World!')
  })
  app.get('/api/v1/:espid', httpGetAll);

  app.listen(port, () => {
    console.log(`Example app listening on port ${port}`)
  })
}
