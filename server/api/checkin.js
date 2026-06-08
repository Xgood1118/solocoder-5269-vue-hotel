const express = require('express');
const { getDb } = require('../db/init');
const { generateCheckinNo } = require('../utils/helpers');
const { getRoomStatus } = require('../services/inventoryService');
const dayjs = require('dayjs');

const router = express.Router();

router.get('/', (req, res) => {
  const db = getDb();
  const { status, room_id, keyword, page = 1, pageSize = 20 } = req.query;
  
  let where = ['1=1'];
  let params = [];
  
  if (status) {
    where.push('c.status = ?');
    params.push(status);
  }
  if (room_id) {
    where.push('c.room_id = ?');
    params.push(room_id);
  }
  if (keyword) {
    where.push('(c.guest_name LIKE ? OR c.checkin_no LIKE ? OR c.id_card LIKE ?)');
    params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
  }
  
  const whereSql = where.join(' AND ');
  
  const total = db.prepare(`
    SELECT COUNT(*) as count FROM checkins c WHERE ${whereSql}
  `).get(...params).count;
  
  const offset = (page - 1) * pageSize;
  const list = db.prepare(`
    SELECT c.*, r.room_no, rt.name as room_type_name, b.booking_no
    FROM checkins c
    LEFT JOIN rooms r ON c.room_id = r.id
    LEFT JOIN room_types rt ON r.room_type_id = rt.id
    LEFT JOIN bookings b ON c.booking_id = b.id
    WHERE ${whereSql}
    ORDER BY c.checkin_time DESC
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
  const checkin = db.prepare(`
    SELECT c.*, r.room_no, rt.name as room_type_name, b.booking_no, b.total_price as booking_total
    FROM checkins c
    LEFT JOIN rooms r ON c.room_id = r.id
    LEFT JOIN room_types rt ON r.room_type_id = rt.id
    LEFT JOIN bookings b ON c.booking_id = b.id
    WHERE c.id = ?
  `).get(req.params.id);
  
  if (!checkin) {
    return res.status(404).json({ error: '入住记录不存在' });
  }
  
  const deposits = db.prepare(`
    SELECT * FROM deposits WHERE checkin_id = ? ORDER BY created_at
  `).all(req.params.id);
  
  res.json({ ...checkin, deposits });
});

router.post('/verify-id', async (req, res) => {
  const { id_card, name } = req.body;
  
  if (!id_card || !name) {
    return res.status(400).json({ error: '身份证号和姓名不能为空' });
  }
  
  await new Promise(resolve => setTimeout(resolve, 500));
  
  if (id_card.length !== 18) {
    return res.json({
      valid: false,
      message: '身份证号格式不正确',
    });
  }
  
  res.json({
    valid: true,
    message: '身份验证通过',
    idInfo: {
      name,
      idCard: id_card,
      gender: parseInt(id_card.charAt(16)) % 2 === 0 ? '女' : '男',
      birthday: `${id_card.substr(6, 4)}-${id_card.substr(10, 2)}-${id_card.substr(14, 2)}`,
    },
  });
});

router.post('/', (req, res) => {
  const db = getDb();
  const {
    booking_id,
    room_id,
    guest_name,
    guest_phone,
    id_card,
    checkin_time,
    expected_checkout,
    deposit,
    room_card_no,
    payment_method = 'cash',
  } = req.body;
  
  if (!room_id || !guest_name) {
    return res.status(400).json({ error: '房间和客人姓名不能为空' });
  }
  
  try {
    const today = dayjs(checkin_time || new Date()).format('YYYY-MM-DD');
    const roomStatus = getRoomStatus(room_id, today);
    
    if (roomStatus.status === 'occupied') {
      return res.status(400).json({ error: '该房间当前有人入住，不能重复入住' });
    }
    
    const room = db.prepare('SELECT status FROM rooms WHERE id = ?').get(room_id);
    if (room.status === 'dirty' || room.status === 'maintenance') {
      return res.status(400).json({ error: `房间状态为${room.status === 'dirty' ? '脏房' : '维护中'}，不能入住` });
    }
    
    const checkinNo = generateCheckinNo();
    const actualCheckinTime = checkin_time || new Date().toISOString();
    const actualDeposit = deposit || 0;
    
    const result = db.transaction(() => {
      const stmt = db.prepare(`
        INSERT INTO checkins 
          (checkin_no, booking_id, room_id, guest_name, guest_phone, 
           id_card, checkin_time, expected_checkout, deposit, room_card_no, 
           status, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'in_house', ?)
      `);
      
      const checkinResult = stmt.run(
        checkinNo,
        booking_id || null,
        room_id,
        guest_name,
        guest_phone || null,
        id_card || null,
        actualCheckinTime,
        expected_checkout || null,
        actualDeposit,
        room_card_no || null,
        req.user?.id || null
      );
      
      const checkinId = checkinResult.lastInsertRowid;
      
      if (actualDeposit > 0) {
        db.prepare(`
          INSERT INTO deposits (checkin_id, amount, type, payment_method, remark)
          VALUES (?, ?, 'deposit', ?, '入住押金')
        `).run(checkinId, actualDeposit, payment_method);
      }
      
      if (booking_id) {
        db.prepare(`
          UPDATE bookings SET status = 'checked_in', room_id = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).run(room_id, booking_id);
      }
      
      db.prepare("UPDATE rooms SET status = 'occupied' WHERE id = ?").run(room_id);
      
      return checkinId;
    })();
    
    const newCheckin = db.prepare(`
      SELECT c.*, r.room_no
      FROM checkins c
      LEFT JOIN rooms r ON c.room_id = r.id
      WHERE c.id = ?
    `).get(result);
    
    res.status(201).json(newCheckin);
    
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/:id/add-deposit', (req, res) => {
  const db = getDb();
  const { amount, payment_method = 'cash', remark } = req.body;
  const checkinId = req.params.id;
  
  if (!amount || amount <= 0) {
    return res.status(400).json({ error: '押金金额必须大于0' });
  }
  
  const checkin = db.prepare('SELECT * FROM checkins WHERE id = ?').get(checkinId);
  if (!checkin) {
    return res.status(404).json({ error: '入住记录不存在' });
  }
  if (checkin.status !== 'in_house') {
    return res.status(400).json({ error: '当前状态不能添加押金' });
  }
  
  db.prepare(`
    INSERT INTO deposits (checkin_id, amount, type, payment_method, remark)
    VALUES (?, ?, 'deposit', ?, ?)
  `).run(checkinId, amount, payment_method, remark || '');
  
  db.prepare(`
    UPDATE checkins SET deposit = deposit + ? WHERE id = ?
  `).run(amount, checkinId);
  
  const updated = db.prepare(`
    SELECT c.*, r.room_no
    FROM checkins c
    LEFT JOIN rooms r ON c.room_id = r.id
    WHERE c.id = ?
  `).get(checkinId);
  
  res.json(updated);
});

router.put('/:id/room-card', (req, res) => {
  const db = getDb();
  const { room_card_no } = req.body;
  
  db.prepare(`
    UPDATE checkins SET room_card_no = ? WHERE id = ?
  `).run(room_card_no || null, req.params.id);
  
  const checkin = db.prepare('SELECT * FROM checkins WHERE id = ?').get(req.params.id);
  res.json(checkin);
});

module.exports = router;
