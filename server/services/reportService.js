const { getDb } = require('../db/init');
const dayjs = require('dayjs');
const { getDateList } = require('../utils/helpers');

function getDailyReport(date) {
  const db = getDb();
  
  const totalRooms = db.prepare('SELECT COUNT(*) as count FROM rooms').get().count;
  
  const occupiedRooms = db.prepare(`
    SELECT COUNT(DISTINCT room_id) as count
    FROM checkins
    WHERE status = 'in_house'
      AND DATE(checkin_time) <= ?
      AND (expected_checkout >= ? OR expected_checkout IS NULL)
  `).get(date, date).count;
  
  const bookingsToday = db.prepare(`
    SELECT COUNT(*) as count, COALESCE(SUM(total_price), 0) as revenue
    FROM bookings
    WHERE DATE(created_at) = ? AND status != 'cancelled'
  `).get(date);
  
  const checkinsToday = db.prepare(`
    SELECT COUNT(*) as count
    FROM checkins
    WHERE DATE(checkin_time) = ?
  `).get(date).count;
  
  const checkoutsToday = db.prepare(`
    SELECT COUNT(*) as count, COALESCE(SUM(room_charge + extra_charge), 0) as revenue
    FROM checkout_records
    WHERE DATE(checkout_time) = ? AND status = 'completed'
  `).get(date);
  
  const occupancyRate = totalRooms > 0 ? (occupiedRooms / totalRooms * 100).toFixed(1) : 0;
  
  return {
    date,
    totalRooms,
    occupiedRooms,
    occupancyRate: parseFloat(occupancyRate),
    bookingsToday: bookingsToday.count,
    bookingRevenue: bookingsToday.revenue,
    checkinsToday,
    checkoutsToday: checkoutsToday.count,
    checkoutRevenue: checkoutsToday.revenue,
  };
}

function getMonthlyReport(year, month) {
  const db = getDb();
  const monthStr = `${year}-${String(month).padStart(2, '0')}`;
  
  const existing = db.prepare('SELECT * FROM monthly_reports WHERE month = ?').get(monthStr);
  if (existing) {
    return existing;
  }
  
  return calculateMonthlyReport(year, month);
}

function calculateMonthlyReport(year, month) {
  const db = getDb();
  const monthStr = `${year}-${String(month).padStart(2, '0')}`;
  const startDate = `${monthStr}-01`;
  const endDate = dayjs(startDate).endOf('month').format('YYYY-MM-DD');
  const daysInMonth = dayjs(startDate).daysInMonth();
  
  const totalRooms = db.prepare('SELECT COUNT(*) as count FROM rooms').get().count;
  const availableRoomNights = totalRooms * daysInMonth;
  
  let occupiedRoomNights = 0;
  const dates = getDateList(startDate, dayjs(endDate).add(1, 'day').format('YYYY-MM-DD'));
  
  for (const date of dates) {
    const occupied = db.prepare(`
      SELECT COUNT(DISTINCT room_id) as count
      FROM checkins
      WHERE status = 'in_house'
        AND DATE(checkin_time) <= ?
        AND (expected_checkout >= ? OR expected_checkout IS NULL)
    `).get(date, date).count;
    occupiedRoomNights += occupied;
  }
  
  const checkoutRevenue = db.prepare(`
    SELECT COALESCE(SUM(room_charge + extra_charge), 0) as total
    FROM checkout_records
    WHERE strftime('%Y-%m', checkout_time) = ? AND status = 'completed'
  `).get(monthStr).total;
  
  const occupancyRate = availableRoomNights > 0 
    ? (occupiedRoomNights / availableRoomNights * 100) 
    : 0;
  
  const adr = occupiedRoomNights > 0 
    ? (checkoutRevenue / occupiedRoomNights) 
    : 0;
  
  const revpar = availableRoomNights > 0 
    ? (checkoutRevenue / availableRoomNights) 
    : 0;
  
  return {
    month: monthStr,
    totalRooms,
    availableRoomNights,
    occupiedRoomNights,
    occupancyRate: parseFloat(occupancyRate.toFixed(2)),
    totalRevenue: parseFloat(checkoutRevenue.toFixed(2)),
    adr: parseFloat(adr.toFixed(2)),
    revpar: parseFloat(revpar.toFixed(2)),
  };
}

function saveMonthlyReport(year, month) {
  const db = getDb();
  const report = calculateMonthlyReport(year, month);
  
  db.prepare(`
    INSERT OR REPLACE INTO monthly_reports 
      (month, total_rooms, available_room_nights, occupied_room_nights, 
       occupancy_rate, total_revenue, adr, revpar)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    report.month,
    report.totalRooms,
    report.availableRoomNights,
    report.occupiedRoomNights,
    report.occupancyRate,
    report.totalRevenue,
    report.adr,
    report.revpar
  );
  
  return report;
}

function getRoomTypeStats(startDate, endDate) {
  const db = getDb();
  
  const stats = db.prepare(`
    SELECT 
      rt.id as room_type_id,
      rt.name as room_type_name,
      COUNT(DISTINCT r.id) as total_rooms,
      COALESCE(SUM(CASE WHEN b.status != 'cancelled' THEN b.nights ELSE 0 END), 0) as booked_nights,
      COALESCE(SUM(CASE WHEN b.status != 'cancelled' THEN b.total_price ELSE 0 END), 0) as revenue
    FROM room_types rt
    LEFT JOIN rooms r ON r.room_type_id = rt.id
    LEFT JOIN bookings b ON b.room_type_id = rt.id 
      AND b.checkin_date >= ? 
      AND b.checkin_date < ?
    GROUP BY rt.id
    ORDER BY rt.id
  `).all(startDate, endDate);
  
  return stats;
}

function getChannelStats(startDate, endDate) {
  const db = getDb();
  
  const stats = db.prepare(`
    SELECT 
      channel,
      COUNT(*) as order_count,
      COALESCE(SUM(total_price), 0) as total_revenue
    FROM bookings
    WHERE checkin_date >= ? 
      AND checkin_date < ?
      AND status != 'cancelled'
    GROUP BY channel
    ORDER BY order_count DESC
  `).all(startDate, endDate);
  
  return stats;
}

module.exports = {
  getDailyReport,
  getMonthlyReport,
  calculateMonthlyReport,
  saveMonthlyReport,
  getRoomTypeStats,
  getChannelStats,
};
