const express = require('express');
const { getDb } = require('../db/init');
const { getRoomStatus, getRoomStatusRange } = require('../services/inventoryService');
const dayjs = require('dayjs');

const router = express.Router();

router.get('/types', (req, res) => {
  const db = getDb();
  const roomTypes = db.prepare(`
    SELECT rt.*, COUNT(r.id) as room_count
    FROM room_types rt
    LEFT JOIN rooms r ON r.room_type_id = rt.id
    GROUP BY rt.id
    ORDER BY rt.id
  `).all();
  res.json(roomTypes);
});

router.get('/types/:id', (req, res) => {
  const db = getDb();
  const roomType = db.prepare('SELECT * FROM room_types WHERE id = ?').get(req.params.id);
  if (!roomType) {
    return res.status(404).json({ error: '房型不存在' });
  }
  res.json(roomType);
});

router.post('/types', (req, res) => {
  const db = getDb();
  const { name, description, base_price, weekend_price, holiday_price } = req.body;
  
  const stmt = db.prepare(`
    INSERT INTO room_types (name, description, base_price, weekend_price, holiday_price)
    VALUES (?, ?, ?, ?, ?)
  `);
  const result = stmt.run(name, description || '', base_price, weekend_price, holiday_price);
  
  res.json({ id: result.lastInsertRowid, ...req.body });
});

router.put('/types/:id', (req, res) => {
  const db = getDb();
  const { name, description, base_price, weekend_price, holiday_price } = req.body;
  
  db.prepare(`
    UPDATE room_types 
    SET name = ?, description = ?, base_price = ?, weekend_price = ?, holiday_price = ?
    WHERE id = ?
  `).run(name, description || '', base_price, weekend_price, holiday_price, req.params.id);
  
  const updated = db.prepare('SELECT * FROM room_types WHERE id = ?').get(req.params.id);
  res.json(updated);
});

router.get('/', (req, res) => {
  const db = getDb();
  const { room_type_id, status } = req.query;
  
  let sql = `
    SELECT r.*, rt.name as room_type_name
    FROM rooms r
    LEFT JOIN room_types rt ON r.room_type_id = rt.id
    WHERE 1=1
  `;
  const params = [];
  
  if (room_type_id) {
    sql += ' AND r.room_type_id = ?';
    params.push(room_type_id);
  }
  if (status) {
    sql += ' AND r.status = ?';
    params.push(status);
  }
  
  sql += ' ORDER BY r.room_no';
  
  const rooms = db.prepare(sql).all(...params);
  res.json(rooms);
});

router.get('/:id', (req, res) => {
  const db = getDb();
  const room = db.prepare(`
    SELECT r.*, rt.name as room_type_name, rt.base_price, rt.weekend_price, rt.holiday_price
    FROM rooms r
    LEFT JOIN room_types rt ON r.room_type_id = rt.id
    WHERE r.id = ?
  `).get(req.params.id);
  
  if (!room) {
    return res.status(404).json({ error: '房间不存在' });
  }
  res.json(room);
});

router.post('/', (req, res) => {
  const db = getDb();
  const { room_no, room_type_id, floor, status } = req.body;
  
  try {
    const stmt = db.prepare(`
      INSERT INTO rooms (room_no, room_type_id, floor, status)
      VALUES (?, ?, ?, ?)
    `);
    const result = stmt.run(room_no, room_type_id, floor, status || 'available');
    res.json({ id: result.lastInsertRowid, ...req.body });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.put('/:id/status', (req, res) => {
  const db = getDb();
  const { status } = req.body;
  
  const validStatuses = ['available', 'dirty', 'maintenance', 'out_of_service'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: '无效的房间状态' });
  }
  
  db.prepare('UPDATE rooms SET status = ? WHERE id = ?').run(status, req.params.id);
  
  const room = db.prepare('SELECT * FROM rooms WHERE id = ?').get(req.params.id);
  res.json(room);
});

router.put('/:id/clean', (req, res) => {
  const db = getDb();
  db.prepare("UPDATE rooms SET status = 'available' WHERE id = ? AND status = 'dirty'")
    .run(req.params.id);
  
  const room = db.prepare('SELECT * FROM rooms WHERE id = ?').get(req.params.id);
  res.json(room);
});

router.get('/:id/status', (req, res) => {
  const { date } = req.query;
  const statusDate = date || dayjs().format('YYYY-MM-DD');
  const status = getRoomStatus(req.params.id, statusDate);
  res.json(status);
});

router.get('/:id/status-range', (req, res) => {
  const { start_date, end_date } = req.query;
  const start = start_date || dayjs().format('YYYY-MM-DD');
  const end = end_date || dayjs().add(30, 'day').format('YYYY-MM-DD');
  
  const statuses = getRoomStatusRange(req.params.id, start, end);
  res.json(statuses);
});

router.get('/map/statuses', (req, res) => {
  const db = getDb();
  const { start_date, end_date } = req.query;
  const start = start_date || dayjs().format('YYYY-MM-DD');
  const end = end_date || dayjs().add(30, 'day').format('YYYY-MM-DD');
  
  const rooms = db.prepare(`
    SELECT r.*, rt.name as room_type_name
    FROM rooms r
    LEFT JOIN room_types rt ON r.room_type_id = rt.id
    ORDER BY r.room_no
  `).all();
  
  const result = rooms.map(room => {
    const statuses = getRoomStatusRange(room.id, start, end);
    return {
      ...room,
      statuses,
    };
  });
  
  res.json({ rooms: result, startDate: start, endDate: end });
});

module.exports = router;
