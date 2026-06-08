const dayjs = require('dayjs');
const { getDb } = require('../db/init');

function isWeekend(dateStr) {
  const d = dayjs(dateStr);
  const day = d.day();
  return day === 0 || day === 6;
}

function isHoliday(dateStr) {
  const db = getDb();
  const holiday = db.prepare('SELECT id FROM holidays WHERE date = ?').get(dateStr);
  return !!holiday;
}

function getPriceType(dateStr) {
  if (isHoliday(dateStr)) {
    return 'holiday';
  }
  if (isWeekend(dateStr)) {
    return 'weekend';
  }
  return 'weekday';
}

function getDateList(checkinDate, checkoutDate) {
  const dates = [];
  let current = dayjs(checkinDate);
  const end = dayjs(checkoutDate);
  
  while (current.isBefore(end)) {
    dates.push(current.format('YYYY-MM-DD'));
    current = current.add(1, 'day');
  }
  
  return dates;
}

function calculateRoomPrice(roomTypeId, checkinDate, checkoutDate) {
  const db = getDb();
  const roomType = db.prepare('SELECT * FROM room_types WHERE id = ?').get(roomTypeId);
  
  if (!roomType) {
    throw new Error('房型不存在');
  }

  const dates = getDateList(checkinDate, checkoutDate);
  const details = [];
  let total = 0;

  for (const date of dates) {
    const priceType = getPriceType(date);
    let price;
    switch (priceType) {
      case 'holiday':
        price = roomType.holiday_price;
        break;
      case 'weekend':
        price = roomType.weekend_price;
        break;
      default:
        price = roomType.base_price;
    }
    details.push({ date, price, priceType });
    total += price;
  }

  return {
    nights: dates.length,
    totalPrice: total,
    details,
  };
}

function generateBookingNo() {
  const timestamp = Date.now().toString().slice(-8);
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `BK${timestamp}${random}`;
}

function generateCheckinNo() {
  const timestamp = Date.now().toString().slice(-8);
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `CI${timestamp}${random}`;
}

function generateCheckoutNo() {
  const timestamp = Date.now().toString().slice(-8);
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `CO${timestamp}${random}`;
}

function generateInvoiceNo() {
  const timestamp = Date.now().toString().slice(-10);
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `INV${timestamp}${random}`;
}

module.exports = {
  isWeekend,
  isHoliday,
  getPriceType,
  getDateList,
  calculateRoomPrice,
  generateBookingNo,
  generateCheckinNo,
  generateCheckoutNo,
  generateInvoiceNo,
};
