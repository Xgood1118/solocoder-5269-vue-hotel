const { getDb } = require('../db/init');
const { generateInvoiceNo } = require('../utils/helpers');
const QRCode = require('qrcode');

const TAX_RATE = 0.06;

async function createInvoice(params) {
  const db = getDb();
  const { checkoutId, bookingId, invoiceType, title, taxNo, amount, createdBy } = params;
  
  const taxAmount = parseFloat((amount * TAX_RATE).toFixed(2));
  const totalAmount = parseFloat((amount + taxAmount).toFixed(2));
  const invoiceNo = generateInvoiceNo();
  
  const qrData = JSON.stringify({
    invoiceNo,
    title,
    amount,
    taxAmount,
    totalAmount,
    taxRate: TAX_RATE,
    date: new Date().toISOString().split('T')[0],
  });
  
  const qrCodeUrl = await QRCode.toDataURL(qrData);
  
  const stmt = db.prepare(`
    INSERT INTO invoices 
      (invoice_no, checkout_id, booking_id, invoice_type, title, tax_no, 
       amount, tax_rate, tax_amount, total_amount, status, qr_code, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'issued', ?, ?)
  `);
  
  const result = stmt.run(
    invoiceNo,
    checkoutId || null,
    bookingId || null,
    invoiceType,
    title,
    taxNo || null,
    amount,
    TAX_RATE,
    taxAmount,
    totalAmount,
    qrCodeUrl,
    createdBy || null
  );
  
  return getInvoiceById(result.lastInsertRowid);
}

function getInvoiceById(id) {
  const db = getDb();
  return db.prepare('SELECT * FROM invoices WHERE id = ?').get(id);
}

function getInvoices(params = {}) {
  const db = getDb();
  const { startDate, endDate, keyword, page = 1, pageSize = 20 } = params;
  
  let where = [];
  let queryParams = [];
  
  if (startDate) {
    where.push('DATE(invoice_date) >= ?');
    queryParams.push(startDate);
  }
  if (endDate) {
    where.push('DATE(invoice_date) <= ?');
    queryParams.push(endDate);
  }
  if (keyword) {
    where.push('(invoice_no LIKE ? OR title LIKE ?)');
    queryParams.push(`%${keyword}%`, `%${keyword}%`);
  }
  
  const whereSql = where.length > 0 ? 'WHERE ' + where.join(' AND ') : '';
  
  const countSql = `SELECT COUNT(*) as count FROM invoices ${whereSql}`;
  const total = db.prepare(countSql).get(...queryParams).count;
  
  const offset = (page - 1) * pageSize;
  const listSql = `
    SELECT * FROM invoices 
    ${whereSql}
    ORDER BY created_at DESC
    LIMIT ? OFFSET ?
  `;
  const list = db.prepare(listSql).all(...queryParams, pageSize, offset);
  
  return {
    list,
    total,
    page,
    pageSize,
  };
}

function voidInvoice(id) {
  const db = getDb();
  db.prepare(`
    UPDATE invoices SET status = 'voided' WHERE id = ?
  `).run(id);
  
  return getInvoiceById(id);
}

async function mockTaxSystemSubmit(invoice) {
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  const mockPdfUrl = `/invoices/${invoice.invoice_no}.pdf`;
  
  const db = getDb();
  db.prepare(`
    UPDATE invoices SET pdf_url = ? WHERE id = ?
  `).run(mockPdfUrl, invoice.id);
  
  return { success: true, pdfUrl: mockPdfUrl };
}

module.exports = {
  createInvoice,
  getInvoiceById,
  getInvoices,
  voidInvoice,
  mockTaxSystemSubmit,
  TAX_RATE,
};
