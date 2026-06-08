const express = require('express');
const { createInvoice, getInvoices, getInvoiceById, voidInvoice, TAX_RATE } = require('../services/invoiceService');

const router = express.Router();

router.get('/', (req, res) => {
  const { startDate, endDate, keyword, page, pageSize } = req.query;
  
  const result = getInvoices({
    startDate,
    endDate,
    keyword,
    page: page ? parseInt(page) : 1,
    pageSize: pageSize ? parseInt(pageSize) : 20,
  });
  
  res.json(result);
});

router.get('/:id', (req, res) => {
  const invoice = getInvoiceById(req.params.id);
  
  if (!invoice) {
    return res.status(404).json({ error: '发票不存在' });
  }
  
  res.json(invoice);
});

router.post('/', async (req, res) => {
  try {
    const { checkoutId, bookingId, invoiceType, title, taxNo, amount } = req.body;
    
    if (!title || !amount) {
      return res.status(400).json({ error: '发票抬头和金额不能为空' });
    }
    
    if (invoiceType === 'enterprise' && !taxNo) {
      return res.status(400).json({ error: '企业发票需要税号' });
    }
    
    const invoice = await createInvoice({
      checkoutId,
      bookingId,
      invoiceType: invoiceType || 'personal',
      title,
      taxNo,
      amount: parseFloat(amount),
      createdBy: req.user?.id,
    });
    
    res.status(201).json(invoice);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/:id/void', (req, res) => {
  const invoice = getInvoiceById(req.params.id);
  
  if (!invoice) {
    return res.status(404).json({ error: '发票不存在' });
  }
  
  if (invoice.status === 'voided') {
    return res.status(400).json({ error: '发票已作废' });
  }
  
  const result = voidInvoice(req.params.id);
  res.json(result);
});

router.get('/tax/rate', (req, res) => {
  res.json({ taxRate: TAX_RATE, taxType: '服务业增值税' });
});

router.post('/calculate', (req, res) => {
  const { amount } = req.body;
  
  if (!amount) {
    return res.status(400).json({ error: '金额不能为空' });
  }
  
  const amt = parseFloat(amount);
  const taxAmount = parseFloat((amt * TAX_RATE).toFixed(2));
  const totalAmount = parseFloat((amt + taxAmount).toFixed(2));
  
  res.json({
    amount: amt,
    taxRate: TAX_RATE,
    taxAmount,
    totalAmount,
  });
});

module.exports = router;
