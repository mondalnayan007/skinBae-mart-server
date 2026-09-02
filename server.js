
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const SSLCommerzPayment = require('sslcommerz-lts')
const app = express();
const port = process.env.PORT || 3000;
const uri = process.env.MONGO_URI;


const store_id = process.env.STORE_ID;
const store_passwd = process.env.STORE_PASS;
const is_live = false //true for live, false for sandbox



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
        const cartCollection = db.collection('carts');


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



        app.post('/api/orders', async (req, res) => {
            const orderData = req.body;
            

            const data = {
                total_amount: orderData.totalAmount,
                currency: 'BDT',
                tran_id: 'REF123', // use unique tran_id for each api call
                success_url: 'http://localhost:3030/success',
                fail_url: 'http://localhost:3030/fail',
                cancel_url: 'http://localhost:3030/cancel',
                ipn_url: 'http://localhost:3030/ipn',
                shipping_method: 'Courier',
                product_name: 'Computer.',
                product_category: 'Electronic',
                product_profile: 'general',
                cus_name: orderData.shippingInfo.fullName,
                cus_email: orderData.userEmail,
                cus_add1: 'Dhaka',
                cus_add2: 'Dhaka',
                cus_city: 'Dhaka',
                cus_state: 'Dhaka',
                cus_postcode: '1000',
                cus_country: 'Bangladesh',
                cus_phone: orderData.shippingInfo.phone,
                cus_fax: '01711111111',
                ship_name: 'Customer Name',
                ship_add1: 'Dhaka',
                ship_add2: 'Dhaka',
                ship_city: 'Dhaka',
                ship_state: 'Dhaka',
                ship_postcode: 1000,
                ship_country: 'Bangladesh',
            };
            console.log(data);

            const sslcz = new SSLCommerzPayment(store_id, store_passwd, is_live)
            sslcz.init(data).then(apiResponse => {
                
                let GatewayPageURL = apiResponse.GatewayPageURL
                res.send({url: GatewayPageURL})
                console.log('Redirecting to: ', GatewayPageURL)
            });
        });


            // ১. UPDATE/EDIT API (PUT METHOD)
            app.put('/products/:id', async (req, res) => {
                try {
                    const id = req.params.id;
                    const filter = { _id: new ObjectId(id) };
                    const updatedProduct = req.body;

                    const updateDoc = {
                        $set: {
                            title: updatedProduct.title,
                            brand: updatedProduct.brand,
                            size: updatedProduct.size,
                            sku: updatedProduct.sku,
                            category: updatedProduct.category,
                            status: updatedProduct.status,
                            availability: updatedProduct.availability,
                            pricing: updatedProduct.pricing,
                            briefDescription: updatedProduct.briefDescription,
                            tags: updatedProduct.tags,
                            images: updatedProduct.images
                        },
                    };

                    const result = await productsCollection.updateOne(filter, updateDoc);
                    res.send(result);
                } catch (error) {
                    res.status(500).send({ error: true, message: error.message });
                }
            });


            //  delete apii 


            app.delete('/products/:id', async (req, res) => {
                try {
                    const id = req.params.id;
                    const query = { _id: new ObjectId(id) };
                    const result = await productsCollection.deleteOne(query);
                    res.send(result);
                } catch (error) {
                    res.status(500).send({ error: true, message: error.message });
                }
            });







            app.post('/products', async (req, res) => {


                const newProduct = req.body;
                const result = await productsCollection.insertOne(newProduct);
                res.send(result);

            })




            // ১. কার্টে প্রোডাক্ট যোগ অথবা কোয়ান্টিটি আপডেটের রুট (Upsert Logic)
            app.post('/api/cart', async (req, res) => {
                const { userEmail, productId, quantity, title, price, images, maxStock } = req.body;



                // ফিল্টার: এই ইউজারের কার্টে এই নির্দিষ্ট প্রোডাক্টটি অলরেডি আছে কি না
                const filter = { userEmail: userEmail, productId: productId };

                // চেক করা হচ্ছে কার্টে আইটেমটি অলরেডি এক্সিস্ট করে কি না
                const existingItem = await cartCollection.findOne(filter);

                if (existingItem) {
                    const newQuantity = existingItem.quantity + quantity;

                    // সেফটি গার্ড: স্টক কাউন্টের বেশি হতে দেবে না
                    if (newQuantity > maxStock) {
                        return res.status(400).send({ error: "Stock limit exceeded!" });
                    }

                    // অলরেডি থাকলে কোয়ান্টিটি আপডেট হবে
                    const updateDoc = { $set: { quantity: newQuantity } };
                    const result = await cartCollection.updateOne(filter, updateDoc);
                    res.send(result);
                } else {
                    // কার্টে নতুন আইটেম হলে সরাসরি ইনসার্ট হবে
                    const newItem = { userEmail, productId, quantity, title, price, images };
                    const result = await cartCollection.insertOne(newItem);
                    res.send(result);
                }
            });

            // ২. ইউজারের ইমেইল অনুযায়ী নির্দিষ্ট কার্ট ডাটা নিয়ে আসার গেট (GET) রুট
            app.get('/api/cart/:email', async (req, res) => {
                const email = req.params.email;

                const query = { userEmail: email };
                const result = await cartCollection.find(query).toArray();
                res.send(result);
            });

            app.delete('/api/cart/remove', async (req, res) => {
                const { userEmail, productId } = req.body;


                const query = { userEmail: userEmail, productId: productId };
                const result = await cartCollection.deleteOne(query);
                res.send(result);
            });










            // Send a ping to confirm a successful connection
            await client.db("admin").command({ ping: 1 });
            console.log("Pinged your deployment. You successfully connected to MongoDB!");
        }finally {
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

    module.exports = app;