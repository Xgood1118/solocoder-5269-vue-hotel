const express = require('express');
const { getDb } = require('../db/init');
const { generateCheckoutNo, calculateRoomPrice } = require('../utils/helpers');
const { incrementInventory } = require('../services/inventoryService');
const dayjs = require('dayjs');

const router = express.Router();

router.get('/minibar/items', (req, res) => {
  const db = getDb();
  const items = db.prepare('SELECT * FROM minibar_items ORDER BY is_default DESC, name').all();
  res.json(items);
});

router.post('/minibar/items', (req, res) => {
  const db = getDb();
  const { name, price, unit, is_default = 0 } = req.body;
  
  try {
    const stmt = db.prepare(`
      INSERT INTO minibar_items (name, price, unit, is_default)
      VALUES (?, ?, ?, ?)
    `);
    const result = stmt.run(name, price, unit || '', is_default);
    res.json({ id: result.lastInsertRowid, ...req.body });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/', (req, res) => {
  const db = getDb();
  const { start_date, end_date, keyword, page = 1, pageSize = 20 } = req.query;
  
  let where = ['1=1'];
  let params = [];
  
  if (start_date) {
    where.push('DATE(c.checkout_time) >= ?');
    params.push(start_date);
  }
  if (end_date) {
    where.push('DATE(c.checkout_time) <= ?');
    params.push(end_date);
  }
  if (keyword) {
    where.push('(c.checkout_no LIKE ? OR c2.guest_name LIKE ?)');
    params.push(`%${keyword}%`, `%${keyword}%`);
  }
  
  const whereSql = where.join(' AND ');
  
  const total = db.prepare(`
    SELECT COUNT(*) as count FROM checkout_records c WHERE ${whereSql}
  `).get(...params).count;
  
  const offset = (page - 1) * pageSize;
  const list = db.prepare(`
    SELECT c.*, r.room_no, c2.guest_name, c2.checkin_no, b.booking_no
    FROM checkout_records c
    LEFT JOIN rooms r ON c.room_id = r.id
    LEFT JOIN checkins c2 ON c.checkin_id = c2.id
    LEFT JOIN bookings b ON c2.booking_id = b.id
    WHERE ${whereSql}
    ORDER BY c.checkout_time DESC
    LIMIT ? OFFSET ?
  `).all(...params, pageSize, offset);
  
  res.json({
    list,
    total,
    page: parseInt(page),
    pageSize: parseInt(pageSize),
  });
});

router.get('/:id', (req, res) => {
  const db = getDb();
  const checkout = db.prepare(`
    SELECT c.*, r.room_no, rt.name as room_type_name, 
           c2.guest_name, c2.id_card, c2.guest_phone,
           c2.checkin_time, c2.deposit as total_deposit,
           b.booking_no, b.channel
    FROM checkout_records c
    LEFT JOIN rooms r ON c.room_id = r.id
    LEFT JOIN room_types rt ON r.room_type_id = rt.id
    LEFT JOIN checkins c2 ON c.checkin_id = c2.id
    LEFT JOIN bookings b ON c2.booking_id = b.id
    WHERE c.id = ?
  `).get(req.params.id);
  
  if (!checkout) {
    return res.status(404).json({ error: '退房记录不存在' });
  }
  
  const minibarCharges = db.prepare(`
    SELECT * FROM minibar_charges WHERE checkout_id = ?
  `).all(req.params.id);
  
  res.json({ ...checkout, minibarCharges });
});

router.post('/calculate', (req, res) => {
  const db = getDb();
  const { checkin_id, minibar_items = [], extra_charges = [] } = req.body;
  
  const checkin = db.prepare(`
    SELECT c.*, r.room_type_id, r.room_no, b.checkin_date as booking_checkin, b.checkout_date as booking_checkout
    FROM checkins c
    LEFT JOIN rooms r ON c.room_id = r.id
    LEFT JOIN bookings b ON c.booking_id = b.id
    WHERE c.id = ? AND c.status = 'in_house'
  `).get(checkin_id);
  
  if (!checkin) {
    return res.status(404).json({ error: '入住记录不存在或已退房' });
  }
  
  const checkinDate = dayjs(checkin.checkin_time).format('YYYY-MM-DD');
  const checkoutDate = dayjs().format('YYYY-MM-DD');
  const today = dayjs().startOf('day');
  const checkinDay = dayjs(checkinDate).startOf('day');
  let nights = today.diff(checkinDay, 'day');
  if (nights <= 0) nights = 1;
  
  const priceResult = calculateRoomPrice(
    checkin.room_type_id,
    checkinDate,
    dayjs(checkinDate).add(nights, 'day').format('YYYY-MM-DD')
  );
  
  let minibarTotal = 0;
  const minibarDetails = minibar_items.map(item => {
    const total = item.quantity * item.unit_price;
    minibarTotal += total;
    return {
      item_name: item.item_name || item.name,
      quantity: item.quantity,
      unit_price: item.unit_price,
      total_price: total,
    };
  });
  
  let extraTotal = 0;
  const extraDetails = extra_charges.map(item => {
    extraTotal += item.amount;
    return item;
  });
  
  const roomCharge = priceResult.totalPrice;
  const extraCharge = minibarTotal + extraTotal;
  const totalCharge = roomCharge + extraCharge;
  const depositRefund = Math.max(0, checkin.deposit - totalCharge);
  const totalPayable = Math.max(0, totalCharge - checkin.deposit);
  
  res.json({
    checkin: {
      id: checkin.id,
      guest_name: checkin.guest_name,
      room_no: checkin.room_no,
      checkin_time: checkin.checkin_time,
      deposit: checkin.deposit,
    },
    nights,
    priceDetails: priceResult.details,
    roomCharge,
    minibarCharges: minibarDetails,
    minibarTotal,
    extraCharges: extraDetails,
    extraTotal,
    totalCharge,
    deposit: checkin.deposit,
    depositRefund,
    totalPayable,
  });
});

router.post('/', (req, res) => {
  const db = getDb();
  const {
    checkin_id,
    minibar_items = [],
    extra_charges = [],
    payment_method = 'cash',
    remark,
  } = req.body;
  
  try {
    const checkin = db.prepare(`
      SELECT * FROM checkins WHERE id = ? AND status = 'in_house'
    `).get(checkin_id);
    
    if (!checkin) {
      return res.status(400).json({ error: '入住记录不存在或已退房' });
    }
    
    const checkoutNo = generateCheckoutNo();
    const checkoutTime = new Date().toISOString();
    
    const calculation = calculateCheckoutFees(checkin_id, minibar_items, extra_charges);
    
    const result = db.transaction(() => {
      const stmt = db.prepare(`
        INSERT INTO checkout_records 
          (checkout_no, checkin_id, room_id, checkout_time, 
           room_charge, extra_charge, deposit_refund, total_payable, 
           payment_method, status, remark, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'completed', ?, ?)
      `);
      
      const checkoutResult = stmt.run(
        checkoutNo,
        checkin_id,
        checkin.room_id,
        checkoutTime,
        calculation.roomCharge,
        calculation.extraCharge,
        calculation.depositRefund,
        calculation.totalPayable,
        payment_method,
        remark || null,
        req.user?.id || null
      );
      
      const checkoutId = checkoutResult.lastInsertRowid;
      
      const minibarStmt = db.prepare(`
        INSERT INTO minibar_charges 
          (checkout_id, item_name, quantity, unit_price, total_price)
        VALUES (?, ?, ?, ?, ?)
      `);
      
      for (const item of calculation.minibarCharges) {
        minibarStmt.run(
          checkoutId,
          item.item_name,
          item.quantity,
          item.unit_price,
          item.total_price
        );
      }
      
      if (calculation.depositRefund > 0) {
        db.prepare(`
          INSERT INTO deposits (checkin_id, amount, type, payment_method, remark)
          VALUES (?, ?, 'refund', ?, '退房退还押金')
        `).run(checkin_id, -calculation.depositRefund, payment_method);
      }
      
      db.prepare(`
        UPDATE checkins SET status = 'checked_out' WHERE id = ?
      `).run(checkin_id);
      
      if (checkin.booking_id) {
        const booking = db.prepare('SELECT * FROM bookings WHERE id = ?').get(checkin.booking_id);
        if (booking) {
          db.prepare(`
            UPDATE bookings SET status = 'checked_out', updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `).run(checkin.booking_id);
          
          incrementInventory(booking.room_type_id, booking.checkin_date, booking.checkout_date, 1);
        }
      }
      
      db.prepare("UPDATE rooms SET status = 'dirty' WHERE id = ?").run(checkin.room_id);
      
      return checkoutId;
    })();
    
    const newCheckout = db.prepare(`
      SELECT c.*, r.room_no, c2.guest_name
      FROM checkout_records c
      LEFT JOIN rooms r ON c.room_id = r.id
      LEFT JOIN checkins c2 ON c.checkin_id = c2.id
      WHERE c.id = ?
    `).get(result);
    
    res.status(201).json(newCheckout);
    
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

function calculateCheckoutFees(checkinId, minibarItems, extraCharges) {
  const db = require('../db/init').getDb();
  
  const checkin = db.prepare(`
    SELECT c.*, r.room_type_id
    FROM checkins c
    LEFT JOIN rooms r ON c.room_id = r.id
    WHERE c.id = ?
  `).get(checkinId);
  
  const checkinDate = dayjs(checkin.checkin_time).format('YYYY-MM-DD');
  const today = dayjs().startOf('day');
  const checkinDay = dayjs(checkinDate).startOf('day');
  let nights = today.diff(checkinDay, 'day');
  if (nights <= 0) nights = 1;
  
  const priceResult = calculateRoomPrice(
    checkin.room_type_id,
    checkinDate,
    dayjs(checkinDate).add(nights, 'day').format('YYYY-MM-DD')
  );
  
  let minibarTotal = 0;
  const minibarCharges = minibarItems.map(item => {
    const total = item.quantity * item.unit_price;
    minibarTotal += total;
    return {
      item_name: item.item_name || item.name,
      quantity: item.quantity,
      unit_price: item.unit_price,
      total_price: total,
    };
  });
  
  let extraTotal = 0;
  for (const item of extraCharges) {
    extraTotal += item.amount || 0;
  }
  
  const roomCharge = priceResult.totalPrice;
  const extraCharge = minibarTotal + extraTotal;
  const totalCharge = roomCharge + extraCharge;
  const depositRefund = Math.max(0, checkin.deposit - totalCharge);
  const totalPayable = Math.max(0, totalCharge - checkin.deposit);
  
  return {
    roomCharge,
    extraCharge,
    minibarCharges,
    deposit: checkin.deposit,
    depositRefund,
    totalPayable,
    priceDetails: priceResult.details,
  };
}

module.exports = router;
