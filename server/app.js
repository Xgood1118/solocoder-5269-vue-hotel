const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const db = require('./db/init');
const authMiddleware = require('./middleware/auth');

const roomsApi = require('./api/rooms');
const bookingsApi = require('./api/bookings');
const checkinApi = require('./api/checkin');
const checkoutApi = require('./api/checkout');
const channelsApi = require('./api/channels');
const reportsApi = require('./api/reports');
const invoiceApi = require('./api/invoice');
const authApi = require('./api/auth');

const scheduler = require('./scheduler/index');

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/api/auth', authApi);
app.use('/api/rooms', authMiddleware, roomsApi);
app.use('/api/bookings', authMiddleware, bookingsApi);
app.use('/api/checkin', authMiddleware, checkinApi);
app.use('/api/checkout', authMiddleware, checkoutApi);
app.use('/api/channels', authMiddleware, channelsApi);
app.use('/api/reports', authMiddleware, reportsApi);
app.use('/api/invoice', authMiddleware, invoiceApi);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: err.message || 'Internal Server Error' });
});

const PORT = process.env.PORT || 8100;

db.init().then(() => {
  scheduler.start();
  app.listen(PORT, () => {
    console.log(`Hotel PMS Server running on port ${PORT}`);
  });
}).catch(err => {
  console.error('Failed to initialize database:', err);
  process.exit(1);
});

module.exports = app;
