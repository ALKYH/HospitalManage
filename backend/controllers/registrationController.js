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

    const force_waitlist = req.body.force_waitlist === true || req.body.force_waitlist === 'true';
    const order = await registrationService.createRegistration({ account_id, department_id, doctor_id, date, slot, note, force_waitlist });

    // 仅在订单被确认（confirmed）且需收费时创建 payment 记录；候补（waiting/is_waitlist）不应立即要求支付
    let payment = null;
    let payment_required = false;
    if (order && order.status === 'confirmed' && amount > 0) {
      payment = await paymentService.createPayment({ account_id, order_id: order.id, amount, currency: 'CNY' });
      await db.query('UPDATE orders SET payment_id = ? WHERE id = ?', [payment.id, order.id]);
      payment_required = true;
    }

    // 返回订单信息；如果不需要支付则不返回 payment（或返回 null），前端根据 payment_required 决定是否展示支付入口
    res.json({ success: true, data: order, payment, payment_required });
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

// 仅返回“订单”视图需要的数据：排除候补预约（waiting/is_waitlist）
exports.listOrdersByUser = async (req, res) => {
  try {
    const { user_id } = req.params;
    const [rows] = await db.query(
      `SELECT o.*, p.id as payment_id, p.amount as payment_amount, p.status as payment_status, p.paid_at as payment_paid_at
       FROM orders o LEFT JOIN payments p ON o.payment_id = p.id
       WHERE o.account_id = ? AND NOT (o.is_waitlist = 1 OR o.status = 'waiting')
       ORDER BY o.created_at DESC`,
      [user_id]
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('listOrdersByUser error', err);
    res.status(500).json({ success: false, message: err.message });
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

