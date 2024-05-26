const { MongoClient } = require("mongodb");
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

async function login(req, res) {
    const { email, password } = req.body;

    if (!email) {
        return res.status(400);
    }

    if (password !== 'vo6liIN') {
        return res.status(403);
    }

    console.log(email);

    const access_token = jwtGenerate(email);
    const refresh_token = jwtRefreshTokenGenerate(email)

    res.json({ access_token: access_token, refresh_token: refresh_token });
}

async function signup(req, res) {
    const { email, password } = req.body;

    // console.log(email);

    const bcrypt = require("bcrypt")
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


module.exports = { jwtGenerate, jwtRefreshTokenGenerate, tokenValidate, login, signup };