const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion } = require('mongodb');
require('dotenv').config()
const port = process.env.PORT || 5000;

require('colors')

const app = express();

// middleware
app.use(cors())
app.use(express.json())


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.xhirnxw.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

async function run() {
    try {
        const appoinmentOptionsCollection = client.db('doctorsportal').collection('appoinmentOptions');
        const bookingsCollection = client.db('doctorsportal').collection('bookings');

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

        /* 
        API nameing convention (bookings)
        app.get('/bookings')
        app.get('/bookings/:id')
        app.post('/bookings')
        app.patch('/bookings/:id')
        app.delete('/bookings/:id')
        */

        app.get('/bookings', async (req, res) => {
            const email = req.query.email;
            const query = { email: email }
            const bookings = await bookingsCollection.find(query).toArray()
            res.send(bookings)
        })


        app.post('/bookings', async (req, res) => {
            const booking = req.body;
            console.log(booking)

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








    }
    finally {

    }
}

run().catch(console.log)


app.get('/', (req, res) => {
    res.send('server is running')
})

app.listen(port, () => console.log(`Doctor's portal is running on ${port}`.bgBlue))