const express = require('express');
const { getDb } = require('../db/init');
const { 
  calculateRoomPrice, 
  generateBookingNo,
  getDateList,
} = require('../utils/helpers');
const { 
  decrementInventory, 
  incrementInventory, 
  checkAvailability,
  getInventoryRange,
} = require('../services/inventoryService');
const { enqueueSync, getActiveChannels } = require('../services/channelService');

const router = express.Router();

router.get('/', (req, res) => {
  const db = getDb();
  const { 
    status, 
    channel, 
    start_date, 
    end_date, 
    keyword, 
    page = 1, 
    pageSize = 20 
  } = req.query;
  
  let where = ['1=1'];
  let params = [];
  
  if (status) {
    where.push('b.status = ?');
    params.push(status);
  }
  if (channel) {
    where.push('b.channel = ?');
    params.push(channel);
  }
  if (start_date) {
    where.push('b.checkin_date >= ?');
    params.push(start_date);
  }
  if (end_date) {
    where.push('b.checkout_date <= ?');
    params.push(end_date);
  }
  if (keyword) {
    where.push('(b.guest_name LIKE ? OR b.booking_no LIKE ? OR b.channel_order_no LIKE ?)');
    params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
  }
  
  const whereSql = where.join(' AND ');
  
  const countSql = `
    SELECT COUNT(*) as count FROM bookings b WHERE ${whereSql}
  `;
  const total = db.prepare(countSql).get(...params).count;
  
  const offset = (page - 1) * pageSize;
  const listSql = `
    SELECT b.*, rt.name as room_type_name, r.room_no
    FROM bookings b
    LEFT JOIN room_types rt ON b.room_type_id = rt.id
    LEFT JOIN rooms r ON b.room_id = r.id
    WHERE ${whereSql}
    ORDER BY b.created_at DESC
    LIMIT ? OFFSET ?
  `;
  const list = db.prepare(listSql).all(...params, pageSize, offset);
  
  res.json({
    list,
    total,
    page: parseInt(page),
    pageSize: parseInt(pageSize),
  });
});

router.get('/:id', (req, res) => {
  const db = getDb();
  const booking = db.prepare(`
    SELECT b.*, rt.name as room_type_name, rt.base_price, r.room_no
    FROM bookings b
    LEFT JOIN room_types rt ON b.room_type_id = rt.id
    LEFT JOIN rooms r ON b.room_id = r.id
    WHERE b.id = ?
  `).get(req.params.id);
  
  if (!booking) {
    return res.status(404).json({ error: '预订不存在' });
  }
  
  const priceDetails = db.prepare(`
    SELECT * FROM booking_price_details WHERE booking_id = ? ORDER BY date
  `).all(req.params.id);
  
  res.json({ ...booking, priceDetails });
});

router.post('/calculate-price', (req, res) => {
  const { room_type_id, checkin_date, checkout_date } = req.body;
  
  try {
    const result = calculateRoomPrice(room_type_id, checkin_date, checkout_date);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/', (req, res) => {
  const db = getDb();
  const {
    room_type_id,
    room_id,
    guest_name,
    guest_phone,
    id_card,
    checkin_date,
    checkout_date,
    channel = 'direct',
    channel_order_no,
    remark,
  } = req.body;
  
  if (!room_type_id || !guest_name || !checkin_date || !checkout_date) {
    return res.status(400).json({ error: '缺少必要参数' });
  }
  
  try {
    const availability = checkAvailability(room_type_id, checkin_date, checkout_date, 1);
    if (!availability.available) {
      return res.status(400).json({ error: `${availability.date} 库存不足` });
    }
    
    const priceResult = calculateRoomPrice(room_type_id, checkin_date, checkout_date);
    const bookingNo = generateBookingNo();
    
    const result = db.transaction(() => {
      const stmt = db.prepare(`
        INSERT INTO bookings 
          (booking_no, channel, channel_order_no, room_type_id, room_id, 
           guest_name, guest_phone, id_card, checkin_date, checkout_date, 
           nights, total_price, status, remark, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'confirmed', ?, ?)
      `);
      
      const bookingResult = stmt.run(
        bookingNo,
        channel,
        channel_order_no || null,
        room_type_id,
        room_id || null,
        guest_name,
        guest_phone || null,
        id_card || null,
        checkin_date,
        checkout_date,
        priceResult.nights,
        priceResult.totalPrice,
        remark || null,
        req.user?.id || null
      );
      
      const bookingId = bookingResult.lastInsertRowid;
      
      const detailStmt = db.prepare(`
        INSERT INTO booking_price_details 
          (booking_id, date, price, price_type)
        VALUES (?, ?, ?, ?)
      `);
      
      for (const detail of priceResult.details) {
        detailStmt.run(bookingId, detail.date, detail.price, detail.priceType);
      }
      
      decrementInventory(room_type_id, checkin_date, checkout_date, 1);
      
      return bookingId;
    })();
    
    if (channel !== 'direct') {
      const booking = db.prepare('SELECT * FROM bookings WHERE id = ?').get(result);
      enqueueSync(channel, 'push_booking', booking);
    }
    
    const newBooking = db.prepare(`
      SELECT b.*, rt.name as room_type_name
      FROM bookings b
      LEFT JOIN room_types rt ON b.room_type_id = rt.id
      WHERE b.id = ?
    `).get(result);
    
    res.status(201).json(newBooking);
    
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.put('/:id/status', (req, res) => {
  const db = getDb();
  const { status } = req.body;
  const bookingId = req.params.id;
  
  const validTransitions = {
    confirmed: ['checked_in', 'cancelled', 'no_show'],
    checked_in: ['checked_out', 'cancelled'],
    checked_out: [],
    cancelled: [],
    no_show: [],
  };
  
  const booking = db.prepare('SELECT * FROM bookings WHERE id = ?').get(bookingId);
  if (!booking) {
    return res.status(404).json({ error: '预订不存在' });
  }
  
  const allowedTransitions = validTransitions[booking.status] || [];
  if (!allowedTransitions.includes(status)) {
    return res.status(400).json({ 
      error: `无法从 ${booking.status} 变更为 ${status}` 
    });
  }
  
  if (status === 'cancelled' || status === 'no_show') {
    try {
      incrementInventory(booking.room_type_id, booking.checkin_date, booking.checkout_date, 1);
      
      if (booking.channel !== 'direct') {
        enqueueSync(booking.channel, 'cancel_booking', booking);
      }
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }
  }
  
  db.prepare(`
    UPDATE bookings SET status = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(status, bookingId);
  
  const updated = db.prepare('SELECT * FROM bookings WHERE id = ?').get(bookingId);
  res.json(updated);
});

router.put('/:id', (req, res) => {
  const db = getDb();
  const { guest_name, guest_phone, id_card, remark, room_id } = req.body;
  const bookingId = req.params.id;
  
  const booking = db.prepare('SELECT * FROM bookings WHERE id = ?').get(bookingId);
  if (!booking) {
    return res.status(404).json({ error: '预订不存在' });
  }
  
  db.prepare(`
    UPDATE bookings 
    SET guest_name = ?, guest_phone = ?, id_card = ?, remark = ?, 
        room_id = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(
    guest_name || booking.guest_name,
    guest_phone !== undefined ? guest_phone : booking.guest_phone,
    id_card !== undefined ? id_card : booking.id_card,
    remark !== undefined ? remark : booking.remark,
    room_id !== undefined ? room_id : booking.room_id,
    bookingId
  );
  
  const updated = db.prepare('SELECT * FROM bookings WHERE id = ?').get(bookingId);
  res.json(updated);
});

router.get('/availability/check', (req, res) => {
  const { room_type_id, start_date, end_date, count = 1 } = req.query;
  
  const result = checkAvailability(
    room_type_id,
    start_date,
    end_date,
    parseInt(count)
  );
  
  res.json(result);
});

router.get('/inventory/calendar', (req, res) => {
  const { room_type_id, start_date, end_date } = req.query;
  
  if (!room_type_id) {
    return res.status(400).json({ error: '缺少房型参数' });
  }
  
  const start = start_date || new Date().toISOString().split('T')[0];
  const end = end_date || new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0];
  
  const inventories = getInventoryRange(room_type_id, start, end);
  res.json(inventories);
});

module.exports = router;
