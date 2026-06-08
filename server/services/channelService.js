const { getDb } = require('../db/init');

const channelAdapters = {
  ctrip: {
    name: '携程',
    async pushBooking(booking) {
      await new Promise(resolve => setTimeout(resolve, 500));
      console.log(`[携程 Mock] 推送订单 ${booking.booking_no} 成功`);
      return { success: true, channelOrderNo: `CT${Date.now()}` };
    },
    async updateInventory(roomTypeId, date, available) {
      await new Promise(resolve => setTimeout(resolve, 300));
      console.log(`[携程 Mock] 更新库存 房型${roomTypeId} ${date} 剩余${available}`);
      return { success: true };
    },
    async updatePrice(roomTypeId, date, price) {
      await new Promise(resolve => setTimeout(resolve, 300));
      console.log(`[携程 Mock] 更新价格 房型${roomTypeId} ${date} 价格${price}`);
      return { success: true };
    },
    async cancelBooking(booking) {
      await new Promise(resolve => setTimeout(resolve, 300));
      console.log(`[携程 Mock] 取消订单 ${booking.booking_no}`);
      return { success: true };
    },
  },
  meituan: {
    name: '美团',
    async pushBooking(booking) {
      await new Promise(resolve => setTimeout(resolve, 500));
      console.log(`[美团 Mock] 推送订单 ${booking.booking_no} 成功`);
      return { success: true, channelOrderNo: `MT${Date.now()}` };
    },
    async updateInventory(roomTypeId, date, available) {
      await new Promise(resolve => setTimeout(resolve, 300));
      console.log(`[美团 Mock] 更新库存 房型${roomTypeId} ${date} 剩余${available}`);
      return { success: true };
    },
    async updatePrice(roomTypeId, date, price) {
      await new Promise(resolve => setTimeout(resolve, 300));
      console.log(`[美团 Mock] 更新价格 房型${roomTypeId} ${date} 价格${price}`);
      return { success: true };
    },
    async cancelBooking(booking) {
      await new Promise(resolve => setTimeout(resolve, 300));
      console.log(`[美团 Mock] 取消订单 ${booking.booking_no}`);
      return { success: true };
    },
  },
  fliggy: {
    name: '飞猪',
    async pushBooking(booking) {
      await new Promise(resolve => setTimeout(resolve, 500));
      console.log(`[飞猪 Mock] 推送订单 ${booking.booking_no} 成功`);
      return { success: true, channelOrderNo: `FG${Date.now()}` };
    },
    async updateInventory(roomTypeId, date, available) {
      await new Promise(resolve => setTimeout(resolve, 300));
      console.log(`[飞猪 Mock] 更新库存 房型${roomTypeId} ${date} 剩余${available}`);
      return { success: true };
    },
    async updatePrice(roomTypeId, date, price) {
      await new Promise(resolve => setTimeout(resolve, 300));
      console.log(`[飞猪 Mock] 更新价格 房型${roomTypeId} ${date} 价格${price}`);
      return { success: true };
    },
    async cancelBooking(booking) {
      await new Promise(resolve => setTimeout(resolve, 300));
      console.log(`[飞猪 Mock] 取消订单 ${booking.booking_no}`);
      return { success: true };
    },
  },
};

function enqueueSync(channelCode, action, data) {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO channel_sync_queue (channel_code, action, data, status)
    VALUES (?, ?, ?, 'pending')
  `);
  return stmt.run(channelCode, action, JSON.stringify(data));
}

async function processSyncQueue() {
  const db = getDb();
  const items = db.prepare(`
    SELECT * FROM channel_sync_queue 
    WHERE status IN ('pending', 'retrying')
    ORDER BY created_at ASC
    LIMIT 10
  `).all();

  for (const item of items) {
    try {
      const adapter = channelAdapters[item.channel_code];
      if (!adapter) {
        throw new Error(`未知渠道: ${item.channel_code}`);
      }

      const data = JSON.parse(item.data);
      let result;

      switch (item.action) {
        case 'push_booking':
          result = await adapter.pushBooking(data);
          break;
        case 'update_inventory':
          result = await adapter.updateInventory(data.roomTypeId, data.date, data.available);
          break;
        case 'update_price':
          result = await adapter.updatePrice(data.roomTypeId, data.date, data.price);
          break;
        case 'cancel_booking':
          result = await adapter.cancelBooking(data);
          break;
        default:
          throw new Error(`未知操作: ${item.action}`);
      }

      if (result.success) {
        db.prepare(`
          UPDATE channel_sync_queue 
          SET status = 'success', updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).run(item.id);
      } else {
        throw new Error('操作失败');
      }
    } catch (err) {
      const newRetryCount = item.retry_count + 1;
      
      if (newRetryCount >= item.max_retries) {
        db.prepare(`
          INSERT INTO channel_sync_dead_letter (channel_code, action, data, error_msg)
          VALUES (?, ?, ?, ?)
        `).run(item.channel_code, item.action, item.data, err.message);
        
        db.prepare(`
          UPDATE channel_sync_queue 
          SET status = 'failed', error_msg = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).run(err.message, item.id);
      } else {
        db.prepare(`
          UPDATE channel_sync_queue 
          SET status = 'retrying', retry_count = ?, error_msg = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).run(newRetryCount, err.message, item.id);
      }
    }
  }
}

function getSyncStatus() {
  const db = getDb();
  const stats = db.prepare(`
    SELECT 
      status,
      COUNT(*) as count
    FROM channel_sync_queue
    GROUP BY status
  `).all();
  
  const deadLetterCount = db.prepare(`
    SELECT COUNT(*) as count FROM channel_sync_dead_letter
  `).get().count;
  
  return {
    stats,
    deadLetterCount,
  };
}

function getActiveChannels() {
  const db = getDb();
  return db.prepare('SELECT * FROM channels WHERE status = ?').all('active');
}

module.exports = {
  channelAdapters,
  enqueueSync,
  processSyncQueue,
  getSyncStatus,
  getActiveChannels,
};
