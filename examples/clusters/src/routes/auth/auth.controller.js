const { MongoClient } = require("mongodb");
const bcrypt = require("bcrypt")
const jwt = require('jsonwebtoken');
require('dotenv').config();

const config = {
    ACCESS_TOKEN_SECRET: process.env.ACCESS_TOKEN_SECRET,
    REFRESH_TOKEN_SECRET: process.env.REFRESH_TOKEN_SECRET
}

const jwtGenerate = (email) => {
    const accessToken = jwt.sign(
        {
            sub: email,
            iat: new Date().getTime(),
        },
        config.ACCESS_TOKEN_SECRET,
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

async function getUser(email) {
    const uri = "mongodb://localhost:27017";
    const client = new MongoClient(uri);

    const database = client.db("database");
    const db = database.collection("user");

    // Query for movies that have a runtime less than 15 minutes
    const query = { email: email };
    let userDB = {};
    try {
        // Execute query 
        userDB = await db.findOne(query);

        // console.log(userDB);
        // Print a message if no documents were found

    }
    catch (e) {
        console.error(e);
    }
    finally {
        await client.close();
    }

    return userDB;
}

async function tokenValidate(req, res, next) {
    // Extract the token from the Authorization header
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ message: 'No token provided' });
    }

    let decoded, userDB
    // Verify and decode the token
    try {
        decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET)
        userDB = await getUser(decoded.sub);
    } catch (err) {
        // err
        return res.status(403).json({ message: 'error token ' + err.message });
    }

    if (!userDB.email) {
        return res.status(403).json({ message: 'Invalid token' });
    }

    // Add the decoded user information to the request object
    req.user = decoded.sub;
    // console.log(decoded.sub);
    next();

}

async function login(req, res) {
    const { email, password } = req.body;

    if (!email) {
        res.status(400).send({ error: "no data" });
    }


    try {
        const userDB = await getUser(email);
        // console.log(userDB.password);

        if (!userDB) {
            console.log("No documents found!");
            res.status(403).send({ error: "No user found!" });
        }

        const match = await bcrypt.compare(password, userDB.password);

        if (!match) {
            console.log("unmatched password");
            await client.close();
            res.status(403).send({ error: "unmatched password" });
        }
    } catch (e) {
        console.error(e);
        res.status(403).send({ error: "error get from database" });
    }

    const access_token = jwtGenerate(email);
    const refresh_token = jwtRefreshTokenGenerate(email)

    res.json({ access_token: access_token, refresh_token: refresh_token });
}

async function signup(req, res) {
    const { email, password } = req.body;

    // console.log(email);


    const saltRounds = 10

    const hash = await bcrypt.hash(password, saltRounds);

    // console.log(hash);

    const uri = "mongodb://localhost:27017";
    const client = new MongoClient(uri);

    let error = "";

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
        console.error(e);
        error = e.message;
    } finally {
        await client.close();
    }

    if (error) {
        res.json({ error: error, email: email });
    } else {

        const access_token = jwtGenerate(email);
        const refresh_token = jwtRefreshTokenGenerate(email)

        res.json({
            access_token: access_token,
            refresh_token: refresh_token
        });
    }
}


module.exports = { jwtGenerate, jwtRefreshTokenGenerate, tokenValidate, login, signup, getUser };