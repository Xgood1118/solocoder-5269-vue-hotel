const cron = require('node-cron');
const { processSyncQueue } = require('../services/channelService');
const { saveMonthlyReport } = require('../services/reportService');
const dayjs = require('dayjs');

const tasks = [];

function start() {
  console.log('Starting scheduler...');
  
  const syncTask = cron.schedule('*/5 * * * *', () => {
    console.log('[Scheduler] Running channel sync...');
    processSyncQueue().catch(err => {
      console.error('[Scheduler] Channel sync error:', err);
    });
  });
  tasks.push({ name: 'channel_sync', task: syncTask });
  
  const monthlyReportTask = cron.schedule('0 2 1 * *', () => {
    console.log('[Scheduler] Running monthly report generation...');
    try {
      const lastMonth = dayjs().subtract(1, 'month');
      saveMonthlyReport(lastMonth.year(), lastMonth.month() + 1);
      console.log('[Scheduler] Monthly report generated successfully');
    } catch (err) {
      console.error('[Scheduler] Monthly report error:', err);
    }
  });
  tasks.push({ name: 'monthly_report', task: monthlyReportTask });
  
  console.log('Scheduler started with', tasks.length, 'tasks');
}

function stop() {
  tasks.forEach(t => {
    if (t.task) t.task.stop();
  });
  tasks.length = 0;
  console.log('Scheduler stopped');
}

function getStatus() {
  return {
    running: tasks.length > 0,
    taskCount: tasks.length,
    tasks: tasks.map(t => t.name),
  };
}

module.exports = {
  start,
  stop,
  getStatus,
};
