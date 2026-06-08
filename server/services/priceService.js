const { getDb } = require('../db/init');
const { calculateRoomPrice } = require('../utils/helpers');

function getPriceCalendar(roomTypeId, startDate, endDate) {
  const { details } = calculateRoomPrice(roomTypeId, startDate, endDate);
  return details;
}

function updateRoomTypePrices(roomTypeId, prices) {
  const db = getDb();
  const { base_price, weekend_price, holiday_price } = prices;
  
  db.prepare(`
    UPDATE room_types 
    SET base_price = ?, weekend_price = ?, holiday_price = ?
    WHERE id = ?
  `).run(base_price, weekend_price, holiday_price, roomTypeId);
  
  return db.prepare('SELECT * FROM room_types WHERE id = ?').get(roomTypeId);
}

function getRoomTypePrice(roomTypeId, dateStr) {
  const db = getDb();
  const roomType = db.prepare('SELECT * FROM room_types WHERE id = ?').get(roomTypeId);
  const { calculateRoomPrice: calc } = require('../utils/helpers');
  const result = calc(roomTypeId, dateStr, new Date(dateStr).getTime() + 86400000);
  return result.details[0];
}

module.exports = {
  getPriceCalendar,
  updateRoomTypePrices,
  getRoomTypePrice,
};
