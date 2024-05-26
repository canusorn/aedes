const { MongoClient } = require("mongodb");


async function getLastData(req, res) {
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


module.exports = { getLastData };