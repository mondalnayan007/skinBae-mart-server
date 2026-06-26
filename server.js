
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion } = require('mongodb');

const app = express();
const port = process.env.PORT || 3000;
const uri = process.env.MONGO_URI;




app.use(cors());
app.use(express.json());



const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});



async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        await client.connect();

        

        const db = client.db('skinBae_Mart');
        const productsCollection = db.collection('products')



       app.get('/products',async(req,res)=>{
            
        const cursor = productsCollection.find();
        const result = await cursor.toArray();
        res.send(result);

       })



       app.post('/products',async(req,res)=>{
         

        const newProduct = req.body;
        const result = await productsCollection.insertOne(newProduct);
        res.send(result);

       })





        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        
    }
}
run().catch(console.dir);

app.get('/', (req, res) => {
    res.send('Hello World!')
})

app.listen(port, () => {
    console.log(`Example app listening on port ${port}`)
})