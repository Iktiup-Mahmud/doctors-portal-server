const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config()
const jwt = require('jsonwebtoken');
const port = process.env.PORT || 5000;

require('colors')

const app = express();

// middleware
app.use(cors())
app.use(express.json())


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.xhirnxw.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

function verifyJwt(req, res, next) {
    // console.log('token', req.headers.authorization)
    const authHeader = req.headers.authorization
    if (!authHeader) {
        res.status(401).send('unauthorized access')
    }

    const token = authHeader.split(' ')[1]

    // jwt verify
    jwt.verify(token, process.env.ACCESS_TOKEN, function (err, decoded) {
        if (err) {
            return res.status(403).send({ message: 'forbidden access' })
        }
        req.decoded = decoded;
        next()
    })
}

async function run() {
    try {
        const appoinmentOptionsCollection = client.db('doctorsportal').collection('appoinmentOptions');
        const bookingsCollection = client.db('doctorsportal').collection('bookings');
        const usersCollection = client.db('doctorsportal').collection('users');
        const doctorsCollection = client.db('doctorsportal').collection('doctors');

        // use aggregate to query multiple collection and then merge data
        app.get('/appoinmentoptions', async (req, res) => {
            const date = req.query.date;
            const query = {};
            const options = await appoinmentOptionsCollection.find(query).toArray();

            // get the all booking of the provided date
            const bookingQuery = { appoinmentDate: date }
            const alreadyBooked = await bookingsCollection.find(bookingQuery).toArray()

            // remove the slots for every treatements
            options.forEach(option => {
                const optionBooked = alreadyBooked.filter(book => book.treatement === option.name)
                const bookedSlots = optionBooked.map(book => book.slot)

                // remaining slots
                const remainingSlots = option.slots.filter(slot => !bookedSlots.includes(slot))

                // set options slot 
                option.slots = remainingSlots;
                // console.log(date, option.name, remainingSlots.length);
            })

            res.send(options)
        })

        app.get('/appointmentSpeciality', async(req, res) => {
            const query = {}
            const result = await appoinmentOptionsCollection.find(query).project({name: 1}).toArray()
            res.send(result)
        } )

        /* 
        API nameing convention (bookings)
        app.get('/bookings')
        app.get('/bookings/:id')
        app.post('/bookings')
        app.patch('/bookings/:id')
        app.delete('/bookings/:id')
        */

        app.get('/bookings', verifyJwt, async (req, res) => {
            const email = req.query.email;
            const decodedEmail = req.decoded.email;
            if (email !== decodedEmail) {
                return res.status(403).send({ message: 'forbidden access' })
            }

            const query = { email: email }
            const bookings = await bookingsCollection.find(query).toArray()
            res.send(bookings)
        })

        app.post('/bookings', async (req, res) => {
            const booking = req.body;
            // console.log(booking)

            const query = {
                email: booking.email,
                appoinmentDate: booking.appoinmentDate,
                treatement: booking.treatement
            }

            const alreadyBooked = await bookingsCollection.find(query).toArray()

            if (alreadyBooked.length) {
                const message = `You already have a booking on ${booking.appoinmentDate}`
                return res.send({ acknowledge: false, message })
            }

            const result = await bookingsCollection.insertOne(booking)
            res.send(result)
        })


        app.get('/jwt', async (req, res) => {
            const email = req.query.email
            const query = { email: email }
            const user = await usersCollection.findOne(query)
            if (user) {
                const token = jwt.sign({ email }, process.env.ACCESS_TOKEN, { expiresIn: '1day' })
                return res.send({ accessToken: token })
            }
            res.status(403).send({ accessToken: '' })
        })

        // users collection
        app.post('/users', async (req, res) => {
            const user = req.body;
            const result = await usersCollection.insertOne(user)
            res.send(result)
        })

        app.get('/users', async (req, res) => {
            const query = {}
            const users = await usersCollection.find(query).toArray()
            res.send(users)
        })

        // admin email validation
        app.get('/users/admin/:email', async (req, res) => {
            const email = req.params.email
            const query = { email }
            const user = await usersCollection.findOne(query)
            res.send({ isAdmin: user?.role === 'admin' })
        })

        app.put('/users/admin/:id', verifyJwt, async (req, res) => {
            const decodedEmail = req.decoded.email
            const query = { email: decodedEmail }
            const user = await usersCollection.findOne(query)
            if (user?.role !== 'admin') {
                return res.status(403).send({ message: 'forbidden access' })
            }
            const id = req.params.id;
            const filter = { _id: ObjectId(id) }
            const option = { upsert: true }
            const updatedDoc = {
                $set: {
                    role: 'admin'
                }
            }
            const result = await usersCollection.updateOne(filter, updatedDoc, option)
            res.send(result)
        })

        app.get('/doctors', async(req, res) => {
            const query = {}
            const result = await doctorsCollection.find(query).toArray()
            res.send(result)
        })

        app.post('/doctors', async(req, res) => {
            const doctor = req.body;
            const result = await doctorsCollection.insertOne(doctor)
            res.send(result)
        })



    }
    finally {

    }
}

run().catch(console.log)


app.get('/', (req, res) => {
    res.send('server is running')
})

app.listen(port, () => console.log(`Doctor's portal is running on ${port}`.bgBlue))