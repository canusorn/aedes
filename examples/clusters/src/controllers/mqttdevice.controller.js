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

function clientValidate(token) {

    if (!token) {
        return false;
    }

    try {
        let decoded = jwt.verify(token, config.ACCESS_TOKEN_SECRET);
        return decoded.sub;
    } catch (err) {
        // err
        console.error("invalid token ", err);
        return false;
    }
}

async function authenticate(client, username, password, callback) {

    const userDB = await getUser(username);
    // console.log(userDB);

    if (userDB == null) {
        callback(new Error('Authentication failed'), false);
        console.log(`Authentication failed, no email`);
    }
    else //if (username === userDB.email) 
    {
        if (password === config.DEVICE_PASS && Number(client.id)) {  // esp authen
            addEspid(client.id, username);
            callback(null, true); // Successful authentication
        } else if (clientValidate(password) === userDB.email) {  // web mqtt authen
            callback(null, true); // Successful authentication
        } else {
            callback(new Error('Authentication failed'), false);
        }
    }
    // else {
    //     callback(new Error('Authentication failed'), false);
    // }
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