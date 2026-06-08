const express = require('express');
const { getDb } = require('../db/init');
const { enqueueSync, getSyncStatus, processSyncQueue, channelAdapters } = require('../services/channelService');

const router = express.Router();

router.get('/', (req, res) => {
  const db = getDb();
  const channels = db.prepare('SELECT * FROM channels ORDER BY id').all();
  res.json(channels);
});

router.post('/', (req, res) => {
  const db = getDb();
  const { code, name, status = 'active', api_key, api_secret, config } = req.body;
  
  try {
    const stmt = db.prepare(`
      INSERT INTO channels (code, name, status, api_key, api_secret, config)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(
      code, name, status, 
      api_key || null, 
      api_secret || null, 
      config ? JSON.stringify(config) : '{}'
    );
    res.json({ id: result.lastInsertRowid, ...req.body });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.put('/:id', (req, res) => {
  const db = getDb();
  const { name, status, api_key, api_secret, config } = req.body;
  
  const channel = db.prepare('SELECT * FROM channels WHERE id = ?').get(req.params.id);
  if (!channel) {
    return res.status(404).json({ error: '渠道不存在' });
  }
  
  db.prepare(`
    UPDATE channels 
    SET name = ?, status = ?, api_key = ?, api_secret = ?, config = ?
    WHERE id = ?
  `).run(
    name || channel.name,
    status !== undefined ? status : channel.status,
    api_key !== undefined ? api_key : channel.api_key,
    api_secret !== undefined ? api_secret : channel.api_secret,
    config !== undefined ? JSON.stringify(config) : channel.config,
    req.params.id
  );
  
  const updated = db.prepare('SELECT * FROM channels WHERE id = ?').get(req.params.id);
  res.json(updated);
});

router.get('/sync/status', (req, res) => {
  const status = getSyncStatus();
  res.json(status);
});

router.get('/sync/queue', (req, res) => {
  const db = getDb();
  const { status, page = 1, pageSize = 50 } = req.query;
  
  let where = '1=1';
  let params = [];
  
  if (status) {
    where += ' AND status = ?';
    params.push(status);
  }
  
  const total = db.prepare(`
    SELECT COUNT(*) as count FROM channel_sync_queue WHERE ${where}
  `).get(...params).count;
  
  const offset = (page - 1) * pageSize;
  const list = db.prepare(`
    SELECT * FROM channel_sync_queue 
    WHERE ${where}
    ORDER BY created_at DESC
    LIMIT ? OFFSET ?
  `).all(...params, pageSize, offset);
  
  res.json({
    list: list.map(item => ({
      ...item,
      data: item.data ? JSON.parse(item.data) : null,
    })),
    total,
    page: parseInt(page),
    pageSize: parseInt(pageSize),
  });
});

router.get('/sync/dead-letter', (req, res) => {
  const db = getDb();
  const items = db.prepare(`
    SELECT * FROM channel_sync_dead_letter
    ORDER BY created_at DESC
    LIMIT 100
  `).all();
  
  res.json(items.map(item => ({
    ...item,
    data: item.data ? JSON.parse(item.data) : null,
  })));
});

router.post('/sync/trigger', async (req, res) => {
  try {
    await processSyncQueue();
    res.json({ success: true, message: '同步已触发' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/sync/retry/:id', (req, res) => {
  const db = getDb();
  const item = db.prepare('SELECT * FROM channel_sync_queue WHERE id = ?').get(req.params.id);
  
  if (!item) {
    return res.status(404).json({ error: '同步记录不存在' });
  }
  
  db.prepare(`
    UPDATE channel_sync_queue 
    SET status = 'pending', retry_count = 0, error_msg = NULL, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(req.params.id);
  
  res.json({ success: true, message: '已重置为重试状态' });
});

router.post('/test/:channelCode', async (req, res) => {
  const channelCode = req.params.channelCode;
  const adapter = channelAdapters[channelCode];
  
  if (!adapter) {
    return res.status(404).json({ error: '渠道适配器不存在' });
  }
  
  try {
    const result = await adapter.pushBooking({ booking_no: 'TEST-' + Date.now() });
    res.json({ success: true, channel: channelCode, result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/pull-orders/:channelCode', async (req, res) => {
  const db = getDb();
  const channelCode = req.params.channelCode;
  
  await new Promise(resolve => setTimeout(resolve, 800));
  
  const mockOrders = [
    {
      channel_order_no: `MOCK-${Date.now()}-1`,
      channel: channelCode,
      room_type_id: 1,
      guest_name: '渠道测试客人1',
      guest_phone: '13800000001',
      checkin_date: new Date(Date.now() + 86400000).toISOString().split('T')[0],
      checkout_date: new Date(Date.now() + 2 * 86400000).toISOString().split('T')[0],
      total_price: 298,
    },
  ];
  
  res.json({
    success: true,
    channel: channelCode,
    pulled: mockOrders.length,
    orders: mockOrders,
    message: 'Mock 数据，实际接入渠道 API 后替换',
  });
});

module.exports = router;
