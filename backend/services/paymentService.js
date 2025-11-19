const db = require('../db');

async function createPayment({ account_id, order_id, amount, currency }) {
  const [r] = await db.query('INSERT INTO payments (account_id, order_id, amount, currency, status) VALUES (?, ?, ?, ?, ?)', [account_id, order_id || null, amount || 0.0, currency || 'CNY', 'created']);
  const [rows] = await db.query('SELECT * FROM payments WHERE id = ?', [r.insertId]);
  return rows[0];
}

async function markPaid(paymentId, provider_info) {
  await db.query('UPDATE payments SET status = ?, provider_info = ?, paid_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?', ['paid', JSON.stringify(provider_info || {}), paymentId]);
  const [rows] = await db.query('SELECT * FROM payments WHERE id = ?', [paymentId]);
  return rows[0];
}

async function getPaymentById(id) {
  const [rows] = await db.query('SELECT * FROM payments WHERE id = ?', [id]);
  return rows[0];
}

async function listPaymentsByAccount(account_id) {
  const [rows] = await db.query('SELECT * FROM payments WHERE account_id = ? ORDER BY created_at DESC', [account_id]);
  return rows;
}

module.exports = { createPayment, markPaid, getPaymentById, listPaymentsByAccount };
