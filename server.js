const express = require('express');
const mongoose = require('mongoose');
const multer = require('multer');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const twilio = require('twilio')(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
const nodemailer = require('nodemailer');
const cors = require('cors');
const bodyParser = require('body-parser');
require('dotenv').config();

const Order = require('./models/Order');

const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));  // Serve frontend files

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true });

// Multer for prescription uploads
const upload = multer({ dest: 'uploads/' });

// Routes
app.post('/api/orders', upload.single('prescription'), async (req, res) => {
  try {
    const { customerName, customerEmail, customerPhone, customerAddress, medicines, paymentMethod } = req.body;
    const prescription = req.file ? req.file.path : null;

    const order = new Order({
      customerName,
      customerEmail,
      customerPhone,
      customerAddress,
      medicines: JSON.parse(medicines),  // Array of medicine objects
      prescription,
      paymentMethod
    });

    await order.save();

    // Send notifications
    await sendNotifications(order);

    res.status(201).json({ message: 'Order placed successfully!', orderId: order._id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Payment processing (for online payments)
app.post('/api/create-payment-intent', async (req, res) => {
  const { amount } = req.body;  // Amount in cents
  const paymentIntent = await stripe.paymentIntents.create({
    amount,
    currency: 'usd',
    payment_method_types: ['card'],
  });
  res.json({ clientSecret: paymentIntent.client_secret });
});

// Notification function
async function sendNotifications(order) {
  const message = `New Order: ${order.customerName} ordered ${order.medicines.map(m => `${m.name} x${m.quantity}`).join(', ')}. Payment: ${order.paymentMethod}.`;

  // Email
  const transporter = nodemailer.createTransporter({
    service: 'gmail',
    auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
  });
  await transporter.sendMail({
    from: process.env.EMAIL_USER,
    to: process.env.OWNER_EMAIL,
    subject: 'New Medicine Order',
    text: message
  });

  // WhatsApp
  await twilio.messages.create({
    body: message,
    from: `whatsapp:${process.env.TWILIO_PHONE_NUMBER}`,
    to: `whatsapp:${process.env.OWNER_PHONE}`
  });
}

app.listen(process.env.PORT, () => console.log(`Server running on port ${process.env.PORT}`));