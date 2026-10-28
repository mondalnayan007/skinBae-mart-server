require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const SSLCommerzPayment = require('sslcommerz-lts');

const app = express();
const port = process.env.PORT || 4000;
const uri = process.env.MONGO_URI;

const store_id = process.env.STORE_ID;
const store_passwd = process.env.STORE_PASS;
const is_live = false; // true for live, false for sandbox

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

// ডেটাবেস এবং কালেকশন রেফারেন্স গ্লোবালি ডিক্লেয়ার করা ভালো, যাতে সার্ভারলেস ফাংশনে দ্রুত এক্সেস পাওয়া যায়
let db, productsCollection, usersCollection, cartCollection,ordersCollection;

async function connectDB() {
    if (!client.topology || !client.topology.isConnected()) {
        await client.connect();
        db = client.db('skinBae_Mart');
        productsCollection = db.collection('products');
        usersCollection = db.collection('users');
        cartCollection = db.collection('carts');
        ordersCollection = db.collection('orders');
        console.log("Successfully connected to MongoDB!");
    }
}

// কানেকশন নিশ্চিত করার জন্য একটি মিডলওয়্যার বা ফাংশন ব্যবহার করতে পারেন
app.use(async (req, res, next) => {
    try {
        await connectDB();
        next();
    } catch (error) {
        console.error("Database connection error:", error);
        res.status(500).json({ error: true, message: "Database connection failed" });
    }
});

// --- API ROUTES ---

app.get('/', (req, res) => {
    res.send('SkinBae Mart Server is running!');
});

app.get('/products', async (req, res) => {
    const cursor = productsCollection.find();
    const result = await cursor.toArray();
    res.send(result);
});

app.get('/product/:id', async (req, res) => {
    const id = req.params.id;
    const query = { _id: new ObjectId(id) };
    const result = await productsCollection.findOne(query);
    res.send(result);
});

app.get('/category', async (req, res) => {
    try {
        const { search } = req.query;
        let query = {};
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

app.get('/category/:name', async (req, res) => {
    try {
        const cName = req.params.name;
        const { search } = req.query;
        let query = {};
        if (cName) {
            query.category = { $regex: `^${cName}$`, $options: "i" };
        }
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

app.get('/product', async (req, res) => {
    const cursor = productsCollection.find().limit(20);
    const result = await cursor.toArray();
    res.send(result);
});

app.post('/users', async (req, res) => {
    const newUser = req.body;
    const result = await usersCollection.insertOne(newUser);
    res.send(result);
});

app.post('/api/orders', async (req, res) => {
    const orderData = req.body;
    const tran_id = 'REF_' + Date.now();
    
    const serverBaseUrl = 'https://skin-bae-mart-server.vercel.app';
    const frontendBaseUrl = 'https://skin-bae-mart.vercel.app';

    // 1. Prothome user-er cart items gulo fetch kore temporary order object baniye rakhi
    const cartItems = await cartCollection.find({ userEmail: orderData.userEmail }).toArray();
    
    if (cartItems.length === 0) {
        return res.status(400).send({ error: "Cart is empty" });
    }

    const subtotal = cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const deliveryCharge = 60;
    const totalAmount = subtotal + deliveryCharge;

    // 2. Ekta pending order database-e save kore rakhi (shipping info shoho)
    const pendingOrder = {
        tran_id: tran_id,
        userEmail: orderData.userEmail,
        shippingInfo: orderData.shippingInfo, // Ekhane name, phone, address thakbe
        items: cartItems.map(item => ({
            productId: item.productId,
            title: item.title,
            price: item.price,
            quantity: item.quantity,
            images: item.images
        })),
        subtotal: subtotal,
        deliveryCharge: deliveryCharge,
        totalAmount: totalAmount,
        paymentStatus: 'unpaid',
        orderStatus: 'pending',
        createdAt: new Date()
    };

    await ordersCollection.insertOne(pendingOrder);

    // 3. SSLCommerz Data setup
    const data = {
        total_amount: totalAmount,
        currency: 'BDT',
        tran_id: tran_id, // Ei tran_id tai success URL er sathe pathabo
        success_url: `${serverBaseUrl}/payment-success?tran_id=${tran_id}&email=${orderData.userEmail}`,
        fail_url: `${serverBaseUrl}/payment-fail`,
        cancel_url: `${serverBaseUrl}/payment-cancel`,
        ipn_url: `${serverBaseUrl}/payment-ipn`,
        shipping_method: 'Courier',
        product_name: 'Cosmetics / Skincare',
        product_category: 'Beauty',
        product_profile: 'general',
        cus_name: orderData.shippingInfo?.fullName || 'Customer',
        cus_email: orderData.userEmail,
        cus_add1: orderData.shippingInfo?.address || 'Dhaka',
        cus_city: 'Dhaka',
        cus_postcode: '1000',
        cus_country: 'Bangladesh',
        cus_phone: orderData.shippingInfo?.phone || '01700000000',
        ship_name: orderData.shippingInfo?.fullName || 'Customer',
        ship_add1: orderData.shippingInfo?.address || 'Dhaka',
        ship_city: 'Dhaka',
        ship_postcode: '1000',
        ship_country: 'Bangladesh',
    };

    const sslcz = new SSLCommerzPayment(store_id, store_passwd, is_live);
    sslcz.init(data).then(apiResponse => {
        let GatewayPageURL = apiResponse.GatewayPageURL;
        res.send({ url: GatewayPageURL });
    });
});

app.post('/payment-success', async (req, res) => {
    try {
        const { tran_id, email } = req.query;

        if (!tran_id) {
            return res.status(400).send({ error: "Transaction ID is required" });
        }

        // 1. Database theke oi tran_id er order-ke 'paid' kore dao ebong shipping info shoho save thakbei
        const updateResult = await ordersCollection.updateOne(
            { tran_id: tran_id },
            { 
                $set: { 
                    paymentStatus: 'paid',
                    orderStatus: 'processing' // ba pending rakhte paren
                } 
            }
        );

        if (updateResult.matchedCount === 0) {
            return res.status(404).send({ error: "Order not found" });
        }

        // 2. Order confirm howar por user-er cart khali kore dao
        if (email) {
            await cartCollection.deleteMany({ userEmail: email });
        }

        // 3. Frontend-er success page-e redirect koro
        return res.redirect(`https://skin-bae-mart.vercel.app/payment-success?tran_id=${tran_id}`);

    } catch (error) {
        console.error("Payment success error:", error);
        res.status(500).send({ error: "Internal Server Error" });
    }
});

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
});

app.post('/api/cart', async (req, res) => {
    const { userEmail, productId, quantity, maxStock } = req.body;
    const filter = { userEmail: userEmail, productId: productId };
    const existingItem = await cartCollection.findOne(filter);

    if (existingItem) {
        const newQuantity = existingItem.quantity + quantity;
        if (maxStock && newQuantity > maxStock) {
            return res.status(400).send({ error: "Stock limit exceeded!" });
        }
        const updateDoc = { $set: { quantity: newQuantity } };
        const result = await cartCollection.updateOne(filter, updateDoc);
        res.send(result);
    } else {
        const newItem = req.body;
        const result = await cartCollection.insertOne(newItem);
        res.send(result);
    }
});

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

// লোকাল ডেভেলপমেন্টের জন্য অ্যাপ লিসেন করার ব্যবস্থা (Vercel-এ এটি স্বয়ংক্রিয়ভাবে ইগনোর হবে)
if (process.env.NODE_ENV !== 'production') {
    app.listen(port, () => {
        console.log(`Server is running on port ${port}`);
    });
}

// Vercel-এর জন্য এক্সপোর্ট বাধ্যতামূলক
module.exports = app;