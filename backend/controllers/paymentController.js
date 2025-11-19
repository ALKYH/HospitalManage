const paymentService = require('../services/paymentService');
const db = require('../db');

exports.createPayment = async (req, res) => {
  try {
    const { account_id, order_id, amount, currency } = req.body;
    if (!account_id || !amount) return res.status(400).json({ success: false, message: 'missing params' });
    const payment = await paymentService.createPayment({ account_id, order_id, amount, currency });
    // if linked to order, update order.payment_id
    if (order_id) {
      await db.query('UPDATE orders SET payment_id = ? WHERE id = ?', [payment.id, order_id]);
    }
    res.json({ success: true, data: payment });
  } catch (err) {
    console.error('createPayment err', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getPayment = async (req, res) => {
  try {
    const { id } = req.params;
    const p = await paymentService.getPaymentById(id);
    if (!p) return res.status(404).json({ success: false, message: 'not found' });
    res.json({ success: true, data: p });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.pay = async (req, res) => {
  try {
    const { id } = req.params;
    const provider_info = req.body.provider_info || { method: 'simulated' };
    const p = await paymentService.markPaid(id, provider_info);
    // if payment linked to order, update order.status -> confirmed (if waiting/pending), and set is_waitlist false
    if (p && p.order_id) {
      await db.query('UPDATE orders SET status = ?, is_waitlist = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?', ['confirmed', p.order_id]);
    }
    res.json({ success: true, data: p });
  } catch (err) {
    console.error('pay err', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.listByAccount = async (req, res) => {
  try {
    const account_id = req.params.account_id || req.query.account_id || (req.user && req.user.account_id);
    if (!account_id) return res.status(400).json({ success: false, message: 'missing account_id' });
    const rows = await paymentService.listPaymentsByAccount(account_id);
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('listByAccount err', err);
    res.status(500).json({ success: false, message: err.message });
  }
};
