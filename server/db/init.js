const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');

let db = null;
let dbPath = '';
let inTransaction = false;

function init() {
  return new Promise(async (resolve, reject) => {
    try {
      const DB_PATH = process.env.DB_PATH || path.join(__dirname, '../data/hotel.db');
      dbPath = DB_PATH;
      
      const dataDir = path.dirname(DB_PATH);
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }
      
      const SQL = await initSqlJs();
      
      if (fs.existsSync(DB_PATH)) {
        const fileBuffer = fs.readFileSync(DB_PATH);
        db = new SQL.Database(fileBuffer);
      } else {
        db = new SQL.Database();
      }
      
      createTables();
      seedData();
      saveToDisk();
      
      console.log('Database initialized successfully');
      resolve(db);
    } catch (err) {
      reject(err);
    }
  });
}

function saveToDisk() {
  if (!db || !dbPath) return;
  try {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(dbPath, buffer);
  } catch (err) {
    console.error('Failed to save database:', err);
  }
}

function createTables() {
  const tables = [
    `CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'staff',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS room_types (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      description TEXT,
      base_price REAL NOT NULL DEFAULT 0,
      weekend_price REAL NOT NULL DEFAULT 0,
      holiday_price REAL NOT NULL DEFAULT 0,
      total_rooms INTEGER NOT NULL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS rooms (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      room_no TEXT UNIQUE NOT NULL,
      room_type_id INTEGER NOT NULL,
      floor INTEGER,
      status TEXT NOT NULL DEFAULT 'available',
      version INTEGER NOT NULL DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (room_type_id) REFERENCES room_types(id)
    )`,
    `CREATE TABLE IF NOT EXISTS holidays (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'holiday',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS bookings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      booking_no TEXT UNIQUE NOT NULL,
      channel TEXT NOT NULL DEFAULT 'direct',
      channel_order_no TEXT,
      room_type_id INTEGER NOT NULL,
      room_id INTEGER,
      guest_name TEXT NOT NULL,
      guest_phone TEXT,
      id_card TEXT,
      checkin_date TEXT NOT NULL,
      checkout_date TEXT NOT NULL,
      nights INTEGER NOT NULL,
      total_price REAL NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'confirmed',
      version INTEGER NOT NULL DEFAULT 1,
      remark TEXT,
      created_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (room_type_id) REFERENCES room_types(id),
      FOREIGN KEY (room_id) REFERENCES rooms(id)
    )`,
    `CREATE TABLE IF NOT EXISTS booking_price_details (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      booking_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      price REAL NOT NULL,
      price_type TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (booking_id) REFERENCES bookings(id)
    )`,
    `CREATE TABLE IF NOT EXISTS checkins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      checkin_no TEXT UNIQUE NOT NULL,
      booking_id INTEGER,
      room_id INTEGER NOT NULL,
      guest_name TEXT NOT NULL,
      guest_phone TEXT,
      id_card TEXT,
      checkin_time DATETIME NOT NULL,
      expected_checkout TEXT,
      deposit REAL NOT NULL DEFAULT 0,
      room_card_no TEXT,
      status TEXT NOT NULL DEFAULT 'in_house',
      created_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (booking_id) REFERENCES bookings(id),
      FOREIGN KEY (room_id) REFERENCES rooms(id)
    )`,
    `CREATE TABLE IF NOT EXISTS deposits (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      checkin_id INTEGER NOT NULL,
      amount REAL NOT NULL,
      type TEXT NOT NULL,
      payment_method TEXT NOT NULL DEFAULT 'cash',
      remark TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (checkin_id) REFERENCES checkins(id)
    )`,
    `CREATE TABLE IF NOT EXISTS checkout_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      checkout_no TEXT UNIQUE NOT NULL,
      checkin_id INTEGER NOT NULL,
      room_id INTEGER NOT NULL,
      checkout_time DATETIME NOT NULL,
      room_charge REAL NOT NULL DEFAULT 0,
      extra_charge REAL NOT NULL DEFAULT 0,
      deposit_refund REAL NOT NULL DEFAULT 0,
      total_payable REAL NOT NULL DEFAULT 0,
      payment_method TEXT NOT NULL DEFAULT 'cash',
      status TEXT NOT NULL DEFAULT 'completed',
      remark TEXT,
      created_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (checkin_id) REFERENCES checkins(id),
      FOREIGN KEY (room_id) REFERENCES rooms(id)
    )`,
    `CREATE TABLE IF NOT EXISTS minibar_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      price REAL NOT NULL,
      unit TEXT,
      is_default INTEGER NOT NULL DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS minibar_charges (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      checkout_id INTEGER NOT NULL,
      item_name TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      unit_price REAL NOT NULL,
      total_price REAL NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (checkout_id) REFERENCES checkout_records(id)
    )`,
    `CREATE TABLE IF NOT EXISTS channels (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      api_key TEXT,
      api_secret TEXT,
      config TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS channel_sync_queue (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      channel_code TEXT NOT NULL,
      action TEXT NOT NULL,
      data TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      retry_count INTEGER NOT NULL DEFAULT 0,
      max_retries INTEGER NOT NULL DEFAULT 3,
      error_msg TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS channel_sync_dead_letter (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      channel_code TEXT NOT NULL,
      action TEXT NOT NULL,
      data TEXT NOT NULL,
      error_msg TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS invoices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_no TEXT UNIQUE NOT NULL,
      checkout_id INTEGER,
      booking_id INTEGER,
      invoice_type TEXT NOT NULL DEFAULT 'personal',
      title TEXT NOT NULL,
      tax_no TEXT,
      amount REAL NOT NULL,
      tax_rate REAL NOT NULL DEFAULT 0.06,
      tax_amount REAL NOT NULL,
      total_amount REAL NOT NULL,
      status TEXT NOT NULL DEFAULT 'issued',
      pdf_url TEXT,
      qr_code TEXT,
      invoice_date DATETIME DEFAULT CURRENT_TIMESTAMP,
      created_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (checkout_id) REFERENCES checkout_records(id),
      FOREIGN KEY (booking_id) REFERENCES bookings(id)
    )`,
    `CREATE TABLE IF NOT EXISTS room_inventory (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      room_type_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      available INTEGER NOT NULL,
      version INTEGER NOT NULL DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(room_type_id, date),
      FOREIGN KEY (room_type_id) REFERENCES room_types(id)
    )`,
    `CREATE TABLE IF NOT EXISTS monthly_reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      month TEXT UNIQUE NOT NULL,
      total_rooms INTEGER NOT NULL,
      available_room_nights INTEGER NOT NULL,
      occupied_room_nights INTEGER NOT NULL,
      occupancy_rate REAL NOT NULL,
      total_revenue REAL NOT NULL,
      adr REAL NOT NULL,
      revpar REAL NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
  ];
  
  for (const sql of tables) {
    db.run(sql);
  }
}

function seedData() {
  const userCount = db.exec('SELECT COUNT(*) as count FROM users')[0]?.values[0][0] || 0;
  if (userCount === 0) {
    const hash = bcrypt.hashSync('admin123', 10);
    db.run(
      'INSERT INTO users (username, password, name, role) VALUES (?, ?, ?, ?)',
      ['admin', hash, '系统管理员', 'admin']
    );
    
    const hash2 = bcrypt.hashSync('staff123', 10);
    db.run(
      'INSERT INTO users (username, password, name, role) VALUES (?, ?, ?, ?)',
      ['staff', hash2, '前台员工', 'staff']
    );
  }
  
  const roomTypeCount = db.exec('SELECT COUNT(*) as count FROM room_types')[0]?.values[0][0] || 0;
  if (roomTypeCount === 0) {
    db.run(
      'INSERT INTO room_types (name, description, base_price, weekend_price, holiday_price, total_rooms) VALUES (?, ?, ?, ?, ?, ?)',
      ['标准间', '双床，约25平米，独立卫浴', 298, 358, 498, 4]
    );
    db.run(
      'INSERT INTO room_types (name, description, base_price, weekend_price, holiday_price, total_rooms) VALUES (?, ?, ?, ?, ?, ?)',
      ['大床房', '大床，约28平米，独立卫浴', 328, 388, 528, 4]
    );
    db.run(
      'INSERT INTO room_types (name, description, base_price, weekend_price, holiday_price, total_rooms) VALUES (?, ?, ?, ?, ?, ?)',
      ['套房', '一室一厅，约45平米，大床', 598, 698, 998, 2]
    );
  }
  
  const roomCount = db.exec('SELECT COUNT(*) as count FROM rooms')[0]?.values[0][0] || 0;
  if (roomCount === 0) {
    const rooms = [
      ['201', 1, 2],
      ['202', 1, 2],
      ['203', 1, 2],
      ['204', 1, 2],
      ['301', 2, 3],
      ['302', 2, 3],
      ['303', 2, 3],
      ['304', 2, 3],
      ['401', 3, 4],
      ['402', 3, 4],
    ];
    for (const [room_no, room_type_id, floor] of rooms) {
      db.run(
        'INSERT INTO rooms (room_no, room_type_id, floor, status) VALUES (?, ?, ?, ?)',
        [room_no, room_type_id, floor, 'available']
      );
    }
  }
  
  const minibarCount = db.exec('SELECT COUNT(*) as count FROM minibar_items')[0]?.values[0][0] || 0;
  if (minibarCount === 0) {
    const items = [
      ['可乐', 5, '瓶', 1],
      ['雪碧', 5, '瓶', 1],
      ['矿泉水', 3, '瓶', 1],
      ['啤酒', 10, '瓶', 1],
      ['方便面', 8, '桶', 1],
      ['薯片', 6, '袋', 1],
    ];
    for (const [name, price, unit, is_default] of items) {
      db.run(
        'INSERT INTO minibar_items (name, price, unit, is_default) VALUES (?, ?, ?, ?)',
        [name, price, unit, is_default]
      );
    }
  }
  
  const channelCount = db.exec('SELECT COUNT(*) as count FROM channels')[0]?.values[0][0] || 0;
  if (channelCount === 0) {
    db.run(
      "INSERT INTO channels (code, name, status, config) VALUES (?, ?, 'active', '{}')",
      ['ctrip', '携程']
    );
    db.run(
      "INSERT INTO channels (code, name, status, config) VALUES (?, ?, 'active', '{}')",
      ['meituan', '美团']
    );
    db.run(
      "INSERT INTO channels (code, name, status, config) VALUES (?, ?, 'active', '{}')",
      ['fliggy', '飞猪']
    );
  }
  
  const holidayCount = db.exec('SELECT COUNT(*) as count FROM holidays')[0]?.values[0][0] || 0;
  if (holidayCount === 0) {
    seedHolidays();
  }
  
  const inventoryCount = db.exec('SELECT COUNT(*) as count FROM room_inventory')[0]?.values[0][0] || 0;
  if (inventoryCount === 0) {
    seedInventory();
  }
}

function seedHolidays() {
  const holidays = [
    ['2026-01-01', '元旦', 'holiday'],
    ['2026-01-28', '春节', 'holiday'],
    ['2026-01-29', '春节', 'holiday'],
    ['2026-01-30', '春节', 'holiday'],
    ['2026-01-31', '春节', 'holiday'],
    ['2026-02-01', '春节', 'holiday'],
    ['2026-02-02', '春节', 'holiday'],
    ['2026-02-03', '春节', 'holiday'],
    ['2026-04-04', '清明节', 'holiday'],
    ['2026-04-05', '清明节', 'holiday'],
    ['2026-04-06', '清明节', 'holiday'],
    ['2026-05-01', '劳动节', 'holiday'],
    ['2026-05-02', '劳动节', 'holiday'],
    ['2026-05-03', '劳动节', 'holiday'],
    ['2026-05-04', '劳动节', 'holiday'],
    ['2026-05-05', '劳动节', 'holiday'],
    ['2026-06-19', '端午节', 'holiday'],
    ['2026-06-20', '端午节', 'holiday'],
    ['2026-06-21', '端午节', 'holiday'],
    ['2026-09-25', '中秋节', 'holiday'],
    ['2026-09-26', '中秋节', 'holiday'],
    ['2026-09-27', '中秋节', 'holiday'],
    ['2026-10-01', '国庆节', 'holiday'],
    ['2026-10-02', '国庆节', 'holiday'],
    ['2026-10-03', '国庆节', 'holiday'],
    ['2026-10-04', '国庆节', 'holiday'],
    ['2026-10-05', '国庆节', 'holiday'],
    ['2026-10-06', '国庆节', 'holiday'],
    ['2026-10-07', '国庆节', 'holiday'],
  ];
  
  for (const [date, name, type] of holidays) {
    db.run(
      'INSERT INTO holidays (date, name, type) VALUES (?, ?, ?)',
      [date, name, type]
    );
  }
}

function seedInventory() {
  const dayjs = require('dayjs');
  const roomTypesResult = db.exec('SELECT id, total_rooms FROM room_types');
  const roomTypes = rowToObjects(roomTypesResult[0]);
  
  const dates = [];
  let start = dayjs().startOf('day');
  for (let i = 0; i < 90; i++) {
    dates.push(start.add(i, 'day').format('YYYY-MM-DD'));
  }
  
  for (const rt of roomTypes) {
    for (const date of dates) {
      db.run(
        'INSERT OR IGNORE INTO room_inventory (room_type_id, date, available) VALUES (?, ?, ?)',
        [rt.id, date, rt.total_rooms]
      );
    }
  }
}

function rowToObjects(result) {
  if (!result || !result.columns || !result.values) return [];
  const { columns, values } = result;
  return values.map(row => {
    const obj = {};
    columns.forEach((col, i) => {
      obj[col] = row[i];
    });
    return obj;
  });
}

class Statement {
  constructor(sql) {
    this.sql = sql;
    this._params = [];
  }
  
  bind(...params) {
    this._params = params.flat();
    return this;
  }
  
  run(...params) {
    const p = params.length > 0 ? params.flat() : this._params;
    db.run(this.sql, p);
    
    const lastIdResult = db.exec('SELECT last_insert_rowid() as id');
    const lastInsertRowid = lastIdResult[0]?.values[0][0] || 0;
    
    const changesResult = db.exec('SELECT changes() as c');
    const changes = changesResult[0]?.values[0][0] || 0;
    
    if (!inTransaction) {
      saveToDisk();
    }
    
    return { lastInsertRowid, changes };
  }
  
  get(...params) {
    const p = params.length > 0 ? params.flat() : this._params;
    const stmt = db.prepare(this.sql);
    stmt.bind(p);
    if (stmt.step()) {
      const row = stmt.getAsObject();
      stmt.free();
      return row;
    }
    stmt.free();
    return undefined;
  }
  
  all(...params) {
    const p = params.length > 0 ? params.flat() : this._params;
    const result = db.exec(this.sql, p);
    if (!result || result.length === 0) return [];
    return rowToObjects(result[0]);
  }
}

function prepare(sql) {
  return new Statement(sql);
}

function exec(sql) {
  const results = db.exec(sql);
  saveToDisk();
  return results;
}

function getDb() {
  if (!db) {
    throw new Error('Database not initialized');
  }
  return {
    prepare,
    exec,
    pragma: (sql) => {},
    transaction: (fn) => {
      return function(...args) {
        const wasInTransaction = inTransaction;
        if (!wasInTransaction) {
          db.run('BEGIN');
          inTransaction = true;
        }
        try {
          const result = fn.apply(null, args);
          if (!wasInTransaction) {
            db.run('COMMIT');
            inTransaction = false;
            saveToDisk();
          }
          return result;
        } catch (err) {
          if (!wasInTransaction) {
            db.run('ROLLBACK');
            inTransaction = false;
          }
          throw err;
        }
      };
    },
  };
}

module.exports = {
  init,
  getDb,
  saveToDisk,
};
