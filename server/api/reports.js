const express = require('express');
const { 
  getDailyReport, 
  getMonthlyReport, 
  getRoomTypeStats,
  getChannelStats,
  saveMonthlyReport,
} = require('../services/reportService');
const dayjs = require('dayjs');

const router = express.Router();

router.get('/daily', (req, res) => {
  const { date } = req.query;
  const reportDate = date || dayjs().format('YYYY-MM-DD');
  const report = getDailyReport(reportDate);
  res.json(report);
});

router.get('/monthly', (req, res) => {
  const { year, month } = req.query;
  const now = dayjs();
  const y = year || now.year();
  const m = month || (now.month() + 1);
  
  const report = getMonthlyReport(parseInt(y), parseInt(m));
  res.json(report);
});

router.get('/overview', (req, res) => {
  const today = dayjs();
  const todayReport = getDailyReport(today.format('YYYY-MM-DD'));
  
  const thisMonth = getMonthlyReport(today.year(), today.month() + 1);
  
  const lastMonth = today.subtract(1, 'month');
  const lastMonthReport = getMonthlyReport(lastMonth.year(), lastMonth.month() + 1);
  
  res.json({
    today: todayReport,
    thisMonth,
    lastMonth: lastMonthReport,
  });
});

router.get('/room-types', (req, res) => {
  const { start_date, end_date } = req.query;
  const start = start_date || dayjs().subtract(30, 'day').format('YYYY-MM-DD');
  const end = end_date || dayjs().format('YYYY-MM-DD');
  
  const stats = getRoomTypeStats(start, end);
  res.json({ start_date: start, end_date: end, stats });
});

router.get('/channels', (req, res) => {
  const { start_date, end_date } = req.query;
  const start = start_date || dayjs().subtract(30, 'day').format('YYYY-MM-DD');
  const end = end_date || dayjs().format('YYYY-MM-DD');
  
  const stats = getChannelStats(start, end);
  res.json({ start_date: start, end_date: end, stats });
});

router.post('/monthly/generate', (req, res) => {
  const { year, month } = req.body;
  
  if (!year || !month) {
    return res.status(400).json({ error: '缺少年份或月份' });
  }
  
  const report = saveMonthlyReport(parseInt(year), parseInt(month));
  res.json(report);
});

router.get('/trend/occupancy', (req, res) => {
  const { days = 30 } = req.query;
  const numDays = parseInt(days);
  
  const trend = [];
  for (let i = numDays - 1; i >= 0; i--) {
    const date = dayjs().subtract(i, 'day').format('YYYY-MM-DD');
    const report = getDailyReport(date);
    trend.push({
      date,
      occupancyRate: report.occupancyRate,
      occupiedRooms: report.occupiedRooms,
    });
  }
  
  res.json(trend);
});

router.get('/trend/revenue', (req, res) => {
  const { days = 30 } = req.query;
  const numDays = parseInt(days);
  
  const trend = [];
  for (let i = numDays - 1; i >= 0; i--) {
    const date = dayjs().subtract(i, 'day').format('YYYY-MM-DD');
    const report = getDailyReport(date);
    trend.push({
      date,
      checkoutRevenue: report.checkoutRevenue,
      bookingRevenue: report.bookingRevenue,
    });
  }
  
  res.json(trend);
});

module.exports = router;
