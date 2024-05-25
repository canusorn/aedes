const cluster = require('cluster')
const Aedes = require('aedes')
const { createServer } = require('net')
const { cpus } = require('os')
const MONGO_URL = 'mongodb://127.0.0.1/aedes-clusters'
const { MongoClient } = require("mongodb");
const cors = require('cors');
const jwt = require('jsonwebtoken');

require('dotenv').config();

const config = {
  ACCESS_TOKEN_SECRET: process.env.ACCESS_TOKEN_SECRET,
  REFRESH_TOKEN_SECRET: process.env.REFRESH_TOKEN_SECRET
}

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
      const db = database.collection(String(espid));


      // Query for movies that have a runtime less than 15 minutes
      const query = {};
      const options = {
        limit: 100,
        // Sort returned documents in ascending order by title (A->Z)
        sort: { time: -1 },
        // projection: { _id: 0, temp: 1, time: 1 },
      };
      // Execute query 
      const cursor = db.find(query, options);
      // Print a message if no documents were found
      if ((await db.countDocuments(query)) === 0) {
        console.log("No documents found!");
      }

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

const jwtGenerate = (email) => {
  const accessToken = jwt.sign(
    {
      sub: email,
      iat: new Date().getTime(),
    },
    process.env.ACCESS_TOKEN_SECRET,
    { expiresIn: "1d" }
  )

  return accessToken
}

const jwtRefreshTokenGenerate = (email) => {
  const refreshToken = jwt.sign(
    {
      sub: email,
      iat: new Date().getTime(),
    },
    process.env.REFRESH_TOKEN_SECRET,
    { expiresIn: "30d" }
  )

  return refreshToken
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

  function tokenValidate(req, res, next) {
    // Extract the token from the Authorization header
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({ message: 'No token provided' });
    }

    // Verify and decode the token
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
      if (err) {
        return res.status(403).json({ message: 'Invalid token' });
      }

      // Add the decoded user information to the request object
      req.user = decoded.sub;
      // console.log(decoded.sub);
      next();
    });
  }

  app.get('/', (req, res) => {
    res.send('Hello World!')
  })
  app.get('/api/v1/:espid', tokenValidate, httpGetAll);

  app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;

    if (password !== 'vo6liIN') {
      return res.status(403);
    }

    console.log(email);

    const access_token = jwtGenerate(email);
    const refresh_token = jwtRefreshTokenGenerate(email)

    res.json({ access_token: access_token, refresh_token: refresh_token });
  })

  app.post('/api/signup', async (req, res) => {
    const { email, password } = req.body;

    // console.log(email);

    const bcrypt = require("bcrypt")
    const saltRounds = 10

    const hash = await bcrypt.hash(password, saltRounds);

    // console.log(hash);

    const uri = "mongodb://localhost:27017";
    const client = new MongoClient(uri);

    let error = "";

    async function run() {
      try {
        // Get the database and collection on which to run the operation
        const database = client.db("database");
        const db = database.collection("user");


        // Create a document to insert
        const doc = {
          email: email,
          password: hash,
        }

        // Insert the defined document into the "haiku" collection
        const result = await db.insertOne(doc);

        // Print the ID of the inserted document
        console.log(`A document was inserted with the _id: ${result.insertedId}`)

      } catch (e) {
        await client.close();
        console.error(e.code);
        error = e.message;
      } finally {
        await client.close();
      }
    }

    await run();

    if (error) {
      res.json({ error: error,email:email });
    } else {

    const access_token = jwtGenerate(email);
    const refresh_token = jwtRefreshTokenGenerate(email)

      res.json({ access_token: access_token, refresh_token: refresh_token });
    }
  })

  app.listen(port, () => {
    console.log(`Example app listening on port ${port}`)
  })
}
