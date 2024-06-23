const { MongoClient } = require("mongodb");

// async function getEspId(espid) {
//     const uri = "mongodb://localhost:27017";
//     const client = new MongoClient(uri);

//     try {
//         // Get the database and collection on which to run the operation
//         const database = client.db("database");
//         const db = database.collection("espid");


//         // Query for movies that have a runtime less than 15 minutes
//         const query = {espid: espid};
//         const options = {
//             // Sort returned documents in ascending order by title (A->Z)
//             // sort: { time: -1 },
//             // projection: { _id: 0, temp: 1, time: 1 },
//         };
//         // Execute query 
//         const cursor = db.find(query, options);
//         // Print a message if no documents were found
//         if ((await db.countDocuments(query)) === 0) {
//             console.log("No documents found!");
//         }

//         const data = await cursor.toArray();
//         dataout = data;


//         // dataout = data;

//     } catch (e) {
//         console.error(e);
//     } finally {
//         await client.close();
//     }

//     return res.json(dataout);

// }

async function getEspIdByUser(req, res){
    // console.log(req.user);
    const uri = "mongodb://localhost:27017";
    const client = new MongoClient(uri);

    try {
        // Get the database and collection on which to run the operation
        const database = client.db("database");
        const db = database.collection("espid");


        // Query for movies that have a runtime less than 15 minutes
        const query = {email: req.user};
        const options = {
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

    } catch (e) {
        console.error(e);
    } finally {
        await client.close();
    }

    return res.json(dataout);
}



module.exports = { getEspIdByUser };