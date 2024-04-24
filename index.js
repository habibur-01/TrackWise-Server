const express = require('express')
const app = express()
const cors = require('cors')
require('dotenv').config()
const SSLCommerzPayment = require('sslcommerz-lts')
const port = process.env.PORT || 3000

// middleware
app.use(cors({

    origin: [
        'http://localhost:5173',
        'https://trackwise-2e16c.web.app',

    ],
    credentials: true,

}))
app.use(express.json())


const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USERNAME}:${process.env.DB_PASSWORD}@cluster0.cbqlcas.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

const store_id = process.env.STORE_ID
const store_passwd = process.env.STORE_PASS
const is_live = false

async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        await client.connect();

        // create database
        const userCollection = client.db("TrackWise").collection("users")
        const registeredUserCollection = client.db("TrackWise").collection("registerUsers")


        // user post
        app.post('/users', async (req, res) => {
            const user = req.body
            const query = { email: user?.email }
            const existingUser = await userCollection.findOne(query)
            if (existingUser) {
                return res.send({ message: 'user already exist', insertedId: null })
            }
            const result = await userCollection.insertOne(user)
            res.send(result)
        })

        app.get("/users", async (req, res) => {
            const email = req.query?.email
            let query = {}
            if (email) {
                query = { email: email }
            }
            const result = await userCollection.find(query).toArray()
            res.send(result)
        })
        const tran_id = new ObjectId().toString()
        app.post("/registerUser", async (req, res) => {
            const regUserInfo = req.body
            // name, email, studentId, department, program, phone, route, transportFee
            console.log(req.body)
            const data = {
                total_amount: regUserInfo.transportFee,
                currency: 'BDT',
                tran_id: tran_id, // use unique tran_id for each api call
                success_url: `http://localhost:3000/registerUser/succeess/${tran_id}`,
                fail_url: `http://localhost:3000/registerUser/fail/${tran_id}`,
                cancel_url: 'http://localhost:3030/cancel',
                ipn_url: 'http://localhost:3030/ipn',
                shipping_method: 'Courier',
                product_name: 'Computer.',
                product_category: 'Electronic',
                product_profile: 'general',
                cus_name: regUserInfo.name,
                cus_email: regUserInfo.email,
                cus_add1: 'Dhaka',
                cus_add2: 'Dhaka',
                cus_city: 'Dhaka',
                cus_state: 'Dhaka',
                cus_postcode: '1000',
                cus_country: 'Bangladesh',
                cus_phone: regUserInfo.phone,
                cus_fax: '01711111111',
                ship_name: 'Customer Name',
                ship_add1: 'Dhaka',
                ship_add2: 'Dhaka',
                ship_city: 'Dhaka',
                ship_state: 'Dhaka',
                ship_postcode: 1000,
                ship_country: 'Bangladesh',
            };
            console.log(data)
            const sslcz = new SSLCommerzPayment(store_id, store_passwd, is_live)
            sslcz.init(data).then(apiResponse => {
                // Redirect the user to payment gateway
                let GatewayPageURL = apiResponse.GatewayPageURL
                res.send({ url: GatewayPageURL })

                const paymentData = {
                    regUserInfo,
                    paidStatus: false,
                    transactionId: tran_id
                }
                const result =  registeredUserCollection.insertOne(paymentData)

                console.log('Redirecting to: ', GatewayPageURL)
            });
            app.post("/registerUser/succeess/:transId", async (req, res) => {
                console.log(req.params.transId)
                const query = {transactionId: req.params.transId}
                const updateDoc = {
                    $set:{
                        paidStatus: true
                    }
                }
                const result= await registeredUserCollection.updateOne(query, updateDoc)
                if(result.modifiedCount > 0){
                    res.redirect(`http://localhost:5173/payment/success/${req.params.transId}`)

                }
            })
            app.post("/registerUser/fail/:transId", async (req, res) => {
                // console.log(req.params.transId)
                const query = {transactionId: req.params.transId}
               
                const result= await registeredUserCollection.deleteOne(query)
                if(result.deletedCount){
                    res.redirect(`http://localhost:5173/payment/fail/${req.params.transId}`)

                }
            })


        })

        app.get("/registerUser", async (req, res) => {

            const result = await registeredUserCollection.find().toArray()
            res.send(result)
        })



        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);



app.get('/', (req, res) => {
    res.send('Hello World!')
})

app.listen(port, () => {
    console.log(`Example app listening on port ${port}`)
})