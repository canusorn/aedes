const { MongoClient } = require("mongodb");
require('dotenv').config();

const config = {
    DEVICE_PASS: process.env.DEVICE_PASS,
    CLIENT_PASS: process.env.CLIENT_PASS,
}

async function publish(packet, client) {


    if (packet.topic.includes('data/update')) {
        // console.table(Buffer.from(packet.payload, 'base64').toString());
        const datapayload = JSON.parse(Buffer.from(packet.payload, 'base64').toString());
        datapayload.time = new Date();

        const uri = "mongodb://localhost:27017";
        const clientmongo = new MongoClient(uri);
        const database = clientmongo.db("timedata");
        const db = database.collection(client.id);

        const result = await db.insertOne(datapayload);
        clientmongo.close();

        console.log(`A document was inserted with the _id: ${result.insertedId}`);
    }

}

function authenticate(client, username, password, callback) {

    if (username === 'anusorn1998@gmail.com') {

        if (password === config.DEVICE_PASS && Number(client.id)) {
            addEspid(client.id, username);
            callback(null, true); // Successful authentication
        } else if (password === config.DEVICE_PASS) {
            callback(null, true); // Successful authentication
        } else{
            callback(new Error('Authentication failed'), false);
        }
    }
    else {
        callback(new Error('Authentication failed'), false);
    }
}

async function addEspid(espid, email) {

    const uri = "mongodb://localhost:27017";
    const clientmongo = new MongoClient(uri);
    const database = clientmongo.db("database");
    const db = database.collection("espid");
    try {
        const result = await db.insertOne({ espid: Number(espid), email: email, name: 'device-' + espid, time: new Date() });
        console.log(`A document was inserted with the _id: ${result.insertedId}`);
    } catch (e) {
        console.error(e);
    } finally {
        clientmongo.close();
    }
}


module.exports = { publish, authenticate };