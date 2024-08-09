const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const bcrypt = require('bcryptjs');
const session = require('express-session');
const path = require('path');

const app = express();

const MONGODB_URI = "mongodb://localhost:27017/restaurant";
const SESSION_SECRET = "your_secret_key";

mongoose.connect(MONGODB_URI)
    .then(() => console.log('MongoDB connected'))
    .catch(err => console.log('Connection error:', err));


app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
}));

app.use(express.static(path.join(__dirname, '..')));

const User = require('./models/User');
const Booking = require('./models/Booking');
const Order = require('./models/Order');

app.get('/', (req, res) => res.sendFile(path.join(__dirname, '..', 'Home-Page.html')));
app.get('/about', (req, res) => res.sendFile(path.join(__dirname, '..', 'About.html')));
app.get('/book-table', (req, res) => res.sendFile(path.join(__dirname, '..', 'Book-Table.html')));
app.get('/cart', (req, res) => res.sendFile(path.join(__dirname, '..', 'Cart-Page.html')));
app.get('/login', (req, res) => res.sendFile(path.join(__dirname, '..', 'Login-Page.html')));
app.get('/menu', (req, res) => res.sendFile(path.join(__dirname, '..', 'Menu-Page.html')));
app.get('/order-food', (req, res) => res.sendFile(path.join(__dirname, '..', 'Order-Food.html')));
app.get('/register', (req, res) => res.sendFile(path.join(__dirname, '..', 'Registration.html')));
app.get('/reviews', (req, res) => res.sendFile(path.join(__dirname, '..', 'Reviews.html')));
app.get('/bill', (req, res) => {
    if (!req.session.orderDetails) {
        return res.status(400).send('No order details found.');
    }
    res.sendFile(path.join(__dirname, '..', 'bill.html'));
});
app.get('/api/order-details', (req, res) => {
    if (!req.session.orderDetails) {
        return res.status(404).json({ error: 'Order details not found.' });
    }
    res.json(req.session.orderDetails);
});

app.get('/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            return res.status(500).send('Logout failed');
        }
        res.redirect('/');
    });
});

// Owner login route
app.get('/owner-login', (req, res) => res.sendFile(path.join(__dirname, '..', 'Owner-Login.html')));

app.post('/owner-login', async (req, res) => {
    const { username, password } = req.body;

    if (username === "Laliths-Canvas" && password === "Welcome") {
        req.session.owner = true;
        res.redirect('/owner-dashboard');
    } else {
        res.status(401).send('Invalid credentials');
    }
});

app.get('/owner-dashboard', (req, res) => {
    if (!req.session.owner) {
        return res.status(401).redirect('/owner-login');
    }
    res.sendFile(path.join(__dirname, '..', 'Owner-Dashboard.html'));
});

app.get('/view-booking-schema', (req, res) => {
    if (!req.session.owner) {
        return res.status(401).redirect('/owner-login');
    }
    res.sendFile(path.join(__dirname, '..', 'View-Booking-Schema.html'));
});

app.get('/view-order-schema', (req, res) => {
    if (!req.session.owner) {
        return res.status(401).redirect('/owner-login');
    }
    res.sendFile(path.join(__dirname, '..', 'View-Order-Schema.html'));
});

app.get('/view-booking-schema-data', async (req, res) => {
    if (!req.session.owner) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    const bookings = await Booking.find({});
    res.json(bookings);
});

app.get('/view-order-schema-data', async (req, res) => {
    if (!req.session.owner) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    const orders = await Order.find({});
    res.json(orders);
});

app.post('/register', async (req, res) => {
    const { fullName, contactNo, email, username, password } = req.body;

    if (!fullName || !contactNo || !email || !username || !password) {
        return res.status(400).send('Please fill in all fields');
    }

    const userExists = await User.findOne({ username });
    if (userExists) {
        console.log('Username already exists:', username);
        return res.status(400).send('Username already exists');
    }

    const emailExists = await User.findOne({ email });
    if (emailExists) {
        console.log('Email already exists:', email);
        return res.status(400).send('Email already exists');
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    console.log('Creating user with hashed password');
    const newUser = new User({
        fullName,
        contactNo,
        email,
        username,
        password: hashedPassword
    });

    try {
        await newUser.save();
        console.log('User registered successfully:', username);
        res.redirect('/login');
    } catch (error) {
        console.error('Error registering user:', error);
        res.status(500).send('Server error, please try again later.');
    }
});

app.post('/login', async (req, res) => {
    const { username, password } = req.body;

    try {
        const user = await User.findOne({ username });
        if (!user) {
            console.log('User not found:', username);
            return res.status(400).send('Invalid credentials');
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            console.log('Password does not match for user:', username);
            return res.status(400).send('Invalid credentials');
        }

        req.session.userId = user._id;
        console.log('User logged in successfully:', username);
        res.redirect('/book-table');
    } catch (error) {
        console.error('Error during login:', error);
        res.status(500).send('Server error, please try again later.');
    }
});

// Route for offline table booking
app.post('/book-table', async (req, res) => {
    const { name, email, phone, guests } = req.body;

    if (!name || !email || !phone || !guests) {
        return res.status(400).send('Please fill in all fields.');
    }

    const newBooking = new Booking({ name, email, phone, guests, source: 'offline' });

    try {
        await newBooking.save();
        req.session.booking = { name, email, phone, guests, source: 'offline' };
        res.redirect('/order-food');
    } catch (error) {
        res.status(500).send('Server error, please try again later.');
    }
});

// Route for online food order
app.post('/online-order', async (req, res) => {
    const { name, email, phone } = req.body;

    if (!name || !email || !phone) {
        return res.status(400).send('Please fill in all fields.');
    }

    const newBooking = new Booking({ name, email, phone, guests: 0, source: 'online' });

    try {
        await newBooking.save();
        req.session.booking = { name, email, phone, guests: 0, source: 'online' };
        res.redirect('/order-food');
    } catch (error) {
        res.status(500).send('Server error, please try again later.');
    }
});

// Route for placing the order
app.post('/place-order', async (req, res) => {
    const { items } = req.body;

    if (!items || !req.session.booking) {
        return res.status(400).json({ error: 'Please fill in all fields.' });
    }

    const { name, email, phone, guests, source } = req.session.booking;

    const processedItems = items.map(item => ({
        ...item,
        price: parseFloat(item.price) // Convert price from string to number
    }));

    const newOrder = new Order({ name, email, phone, guests, items, source });

    try {
        await newOrder.save();
        req.session.orderDetails = { name, email, phone, guests, items, source };
        res.json({ message: 'Order placed successfully!' });
    } catch (error) {
        res.status(500).json({ error: 'Server error, please try again later.' });
    }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));