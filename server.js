
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

const app = express();
const port = process.env.PORT || 3000;
const uri = process.env.MONGO_URI;

const allowedOrigins = [
    'http://localhost:5173',
    'https://skin-bae-mart.vercel.app'
];




app.use(cors({
    origin: allowedOrigins,
    credentials: true
}));
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
        const productsCollection = db.collection('products');
        const usersCollection = db.collection('users');


        //   get all products 
        app.get('/products', async (req, res) => {

            const cursor = productsCollection.find();
            const result = await cursor.toArray();
            res.send(result);

        });

        //  get single product by id 


        app.get('/product/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await productsCollection.findOne(query);
            res.send(result);
        })

 // ১. সব ক্যাটাগরি এবং সার্চ হ্যান্ডেল করার API
        app.get('/category', async (req, res) => {
            try {
                const { search } = req.query; // ফ্রন্টএন্ড থেকে আসা ?search=keyword
                let query = {};

                // যদি সার্চ কি-ওয়ার্ড থাকে, তাহলে নাম বা ব্র্যান্ডে খুঁজবে
                if (search) {
                    query.$or = [
                        { name: { $regex: search, $options: 'i' } },    // আপনার ডাটাবেজে ফিল্ডের নাম 'name' বা 'title' হলে সেটা দিন
                        { brand: { $regex: search, $options: 'i' } }
                    ];
                }

                const cursor = productsCollection.find(query);
                const result = await cursor.toArray();
                res.send(result);
            } catch (error) {
                console.error(error);
                res.status(500).send({ error: true, message: "Server error" });
            }
        });

        // ২. নির্দিষ্ট ক্যাটাগরি এবং সেই ক্যাটাগরির ভেতরে সার্চ হ্যান্ডেল করার API
        app.get('/category/:name', async (req, res) => {
            try {
                const cName = req.params.name;
                const { search } = req.query; // ফ্রন্টএন্ড থেকে আসা ?search=keyword
                
                let query = {};

                // ক্যাটাগরি ফিল্টার যোগ করা হলো
                if (cName) {
                    query.category = { $regex: `^${cName}$`, $options: "i" };
                }

                // যদি ওই নির্দিষ্ট ক্যাটাগরির ভেতরেও ইউজার কিছু সার্চ করে
                if (search) {
                    query.$or = [
                        { name: { $regex: search, $options: 'i' } },
                        { brand: { $regex: search, $options: 'i' } }
                    ];
                }

                const cursor = productsCollection.find(query);
                const result = await cursor.toArray();
                res.send(result);
            } catch (error) {
                console.error(error);
                res.status(500).send({ error: true, message: "Server error" });
            }
        });
        // get first 20 products 

        app.get('/product', async (req, res) => {
            const cursor = productsCollection.find().limit(20);
            const result = await cursor.toArray();
            res.send(result);
        })

        // search products api 

        // app.get('/category', async (req, res) => {
        //     const query = req.query;

        //     const searchResults = await Product.find({
        //         $or: [
        //             { title: { $regex: query, $options: 'i' } },
        //             { brand: { $regex: query, $options: 'i' } }
        //         ]
        //     });
        //     res.json(searchResults);
        // })


        app.post('/users', async (req, res) => {
            const newUser = req.body;
            const result = await usersCollection.insertOne(newUser);
            res.send(result);
        })







        app.post('/products', async (req, res) => {


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