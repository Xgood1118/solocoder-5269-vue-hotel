const { getDb } = require('../db/init');
const { getDateList } = require('../utils/helpers');

function getInventory(roomTypeId, date) {
  const db = getDb();
  let inv = db.prepare(`
    SELECT * FROM room_inventory 
    WHERE room_type_id = ? AND date = ?
  `).get(roomTypeId, date);

  if (!inv) {
    const roomType = db.prepare('SELECT total_rooms FROM room_types WHERE id = ?').get(roomTypeId);
    if (!roomType) throw new Error('房型不存在');
    
    db.prepare(`
      INSERT OR IGNORE INTO room_inventory (room_type_id, date, available)
      VALUES (?, ?, ?)
    `).run(roomTypeId, date, roomType.total_rooms);
    
    inv = db.prepare(`
      SELECT * FROM room_inventory 
      WHERE room_type_id = ? AND date = ?
    `).get(roomTypeId, date);
  }

  return inv;
}

function getInventoryRange(roomTypeId, startDate, endDate) {
  const db = getDb();
  const dates = getDateList(startDate, endDate);
  
  const inventories = [];
  for (const date of dates) {
    inventories.push(getInventory(roomTypeId, date));
  }
  
  return inventories;
}

function decrementInventory(roomTypeId, startDate, endDate, count = 1) {
  const db = getDb();
  const dates = getDateList(startDate, endDate);
  
  for (const date of dates) {
    const inv = getInventory(roomTypeId, date);
    
    if (inv.available < count) {
      throw new Error(`${date} 库存不足`);
    }
    
    const updated = db.prepare(`
      UPDATE room_inventory 
      SET available = available - ?, version = version + 1, updated_at = CURRENT_TIMESTAMP
      WHERE room_type_id = ? AND date = ? AND version = ?
    `).run(count, roomTypeId, date, inv.version);
    
    if (updated.changes === 0) {
      throw new Error(`${date} 库存更新失败，版本不匹配`);
    }
  }
  
  return true;
}

function incrementInventory(roomTypeId, startDate, endDate, count = 1) {
  const db = getDb();
  const dates = getDateList(startDate, endDate);
  
  for (const date of dates) {
    const inv = getInventory(roomTypeId, date);
    const roomType = db.prepare('SELECT total_rooms FROM room_types WHERE id = ?').get(roomTypeId);
    
    const newAvailable = Math.min(inv.available + count, roomType.total_rooms);
    
    db.prepare(`
      UPDATE room_inventory 
      SET available = ?, version = version + 1, updated_at = CURRENT_TIMESTAMP
      WHERE room_type_id = ? AND date = ?
    `).run(newAvailable, roomTypeId, date);
  }
  
  return true;
}

function checkAvailability(roomTypeId, startDate, endDate, count = 1) {
  const db = getDb();
  const dates = getDateList(startDate, endDate);
  
  for (const date of dates) {
    const inv = getInventory(roomTypeId, date);
    if (inv.available < count) {
      return {
        available: false,
        date,
        remaining: inv.available,
      };
    }
  }
  
  return { available: true };
}

function getRoomStatus(roomId, date) {
  const db = getDb();
  
  const checkin = db.prepare(`
    SELECT c.*, b.guest_name 
    FROM checkins c
    LEFT JOIN bookings b ON c.booking_id = b.id
    WHERE c.room_id = ? 
      AND c.status = 'in_house'
      AND DATE(c.checkin_time) <= ?
      AND (c.expected_checkout >= ? OR c.expected_checkout IS NULL)
    ORDER BY c.checkin_time DESC
    LIMIT 1
  `).get(roomId, date, date);
  
  if (checkin) {
    return { status: 'occupied', guestName: checkin.guest_name, checkinId: checkin.id };
  }
  
  const booking = db.prepare(`
    SELECT * FROM bookings
    WHERE room_id = ?
      AND status IN ('confirmed', 'checked_in')
      AND checkin_date <= ?
      AND checkout_date > ?
    ORDER BY checkin_date ASC
    LIMIT 1
  `).get(roomId, date, date);
  
  if (booking) {
    return { status: 'booked', guestName: booking.guest_name, bookingId: booking.id };
  }
  
  const room = db.prepare('SELECT status FROM rooms WHERE id = ?').get(roomId);
  if (room.status === 'dirty') {
    return { status: 'dirty' };
  }
  if (room.status === 'maintenance') {
    return { status: 'maintenance' };
  }
  
  return { status: 'available' };
}

function getRoomStatusRange(roomId, startDate, endDate) {
  const db = getDb();
  const dates = getDateList(startDate, endDate);
  const result = {};
  
  for (const date of dates) {
    result[date] = getRoomStatus(roomId, date);
  }
  
  return result;
}

module.exports = {
  getInventory,
  getInventoryRange,
  decrementInventory,
  incrementInventory,
  checkAvailability,
  getRoomStatus,
  getRoomStatusRange,
};
