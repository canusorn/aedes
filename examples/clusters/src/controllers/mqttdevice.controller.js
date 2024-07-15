const jwt = require('jsonwebtoken');
const { MongoClient } = require("mongodb");
const { getUser } = require("../routes/auth/auth.controller")
require('dotenv').config();

const config = {
    ACCESS_TOKEN_SECRET: process.env.ACCESS_TOKEN_SECRET,
    DEVICE_PASS: process.env.DEVICE_PASS,
    CLIENT_PASS: process.env.CLIENT_PASS,
}

async function publish(packet, client) {

    if (packet.topic.endsWith('/data/update')) {
        // console.table(Buffer.from(packet.payload, 'base64').toString());
        try {
            const datapayload = JSON.parse(Buffer.from(packet.payload, 'base64').toString());
            datapayload.time = new Date();

            const uri = "mongodb://localhost:27017";
            const clientmongo = new MongoClient(uri);
            const database = clientmongo.db("timedata");
            const db = database.collection(client.id);

            db.insertOne(datapayload)
                .then(result => {
                    console.log(`A document was inserted with the _id: ${result.insertedId}`);
                    clientmongo.close();
                });
        } catch (err) {
            // err
            console.error("\x1B[31mError json format, ", err.message);
            return false;

        }

    }
}

function clientValidate(token) {

    if (!token) {
        return false;
    }
    try {
        let decoded = jwt.verify(token, config.ACCESS_TOKEN_SECRET);
        return decoded.sub;
    } catch (err) {
        // err
        console.error("\x1B[31minvalid token ", err.message);
        return false;
    }
}

async function authenticate(client, username, password, callback) {

    const userDB = await getUser(username);
    const deviceID = client.id;
    // console.log(userDB);

    if (userDB == null) {
        callback(new Error('Authentication failed'), false);
        console.log(`\x1B[31mAuthentication failed, no email`);
    }
    else //if (username === userDB.email) 
    {
        if (password === config.DEVICE_PASS && deviceID) {  // esp authen
            addEspid(deviceID, username);
            callback(null, true); // Successful authentication
        } else if (clientValidate(password) === userDB.email) {  // web mqtt authen
            callback(null, true); // Successful authentication
        } else {
            console.log(`\x1B[31mAuthentication failed, password invalid`);
            callback(new Error('Authentication failed'), false);
        }
    }
}

async function authorizeSub(email) {
    const uri = "mongodb://localhost:27017";
    const client = new MongoClient(uri);
    let dataout;
    try {
        // Get the database and collection on which to run the operation
        const db = client.db("database").collection("espid");

        // Query for movies that have a runtime less than 15 minutes
        const query = { email: email };
        const options = {
            // Sort returned documents in ascending order by title (A->Z)
            sort: { time: -1 },
            // projection: { _id: 0, temp: 1, time: 1 },
        };
        // Execute query 
        const cursor = db.find(query, options);
        // Print a message if no documents were found
        if ((await db.countDocuments(query)) === 0) {
            console.log("\x1B[31mNo documents found!");
        }
        const data = await cursor.toArray();
        dataout = data;
    } catch (e) {
        console.error(e);
    } finally {
        client.close();
    }

    return dataout;
}

async function addEspid(espid, email) {

    const uri = "mongodb://localhost:27017";
    const clientmongo = new MongoClient(uri);
    const database = clientmongo.db("database");
    const db = database.collection("espid");
    try {
        const thisesp = await db.findOne({ espid: espid });
        // console.log("get device: " + thisesp.email);
        if (thisesp && thisesp.email != email) {
            const result = await db.updateOne({ espid: espid }, { $set: { email: email } });
            console.log(`${result.matchedCount} device matched the filter, updated ${result.modifiedCount} device`,);
        } else if (!thisesp) {
            const result = await db.insertOne({ espid: espid, email: email, name: 'Device-' + espid.split('_')[1], time: new Date() });
            console.log(`A new device was inserted with the _id: ${result.insertedId}`);
        }

    } catch (e) {
        console.error(e.message);
    } finally {
        clientmongo.close();
    }
}


module.exports = { publish, authenticate, authorizeSub };