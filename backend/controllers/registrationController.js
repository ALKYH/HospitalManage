const db = require('../db');
const registrationService = require('../services/registrationService');
const paymentService = require('../services/paymentService');

exports.createRegistration = async (req, res) => {
  try {
    const { account_id, department_id, doctor_id, date, slot, note, regi_type } = req.body;
    if (!account_id || !department_id || !doctor_id || !date || !slot) {
      return res.status(400).json({ success: false, message: 'missing parameters' });
    }

    // 简单收费策略：根据号别决定金额（单位：CNY）
    const priceMap = { '普通号': 0.00, '专家号': 20.00, '特需号': 50.00 };
    const amount = priceMap[regi_type] !== undefined ? priceMap[regi_type] : 0.00;

    const order = await registrationService.createRegistration({ account_id, department_id, doctor_id, date, slot, note });

    // 始终创建 payment 记录（即使金额为0），并要求用户/前端手动完成支付以将 payment.status 置为 paid
    const payment = await paymentService.createPayment({ account_id, order_id: order.id, amount, currency: 'CNY' });
    await db.query('UPDATE orders SET payment_id = ? WHERE id = ?', [payment.id, order.id]);

    // 返回包含 payment 信息的结果，前端应跳转到 payment 页面并等待用户手动支付
    res.json({ success: true, data: order, payment, payment_required: true });
  } catch (err) {
    console.error('createRegistration error', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.listByUser = async (req, res) => {
  try {
    const { user_id } = req.params;
    // 返回带 payment 信息的订单列表（如果有），并对候补订单返回候补进度 (wait_position) 和当天候补总数 (wait_total)
    const [rows] = await db.query(
      `SELECT o.*, p.id as payment_id, p.amount as payment_amount, p.status as payment_status, p.paid_at as payment_paid_at,
        CASE WHEN o.is_waitlist = 1 THEN (
          SELECT COUNT(1) FROM orders w WHERE w.doctor_id = o.doctor_id AND w.date = o.date AND w.status = 'waiting' AND w.is_waitlist = 1 AND w.created_at < o.created_at
        ) ELSE 0 END as wait_position,
        CASE WHEN o.is_waitlist = 1 THEN (
          SELECT COUNT(1) FROM orders w WHERE w.doctor_id = o.doctor_id AND w.date = o.date AND w.status = 'waiting' AND w.is_waitlist = 1
        ) ELSE 0 END as wait_total
       FROM orders o LEFT JOIN payments p ON o.payment_id = p.id
       WHERE o.account_id = ? ORDER BY o.created_at DESC`,
      [user_id]
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false });
  }
};

exports.updateStatus = async (req, res) => {
  try {
    const { id, status } = req.body;
    await db.query('UPDATE registration_requests SET status = ? WHERE id = ?', [status, id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false });
  }
};

