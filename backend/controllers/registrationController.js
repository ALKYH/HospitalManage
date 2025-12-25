const db = require('../db');
const registrationService = require('../services/registrationService');
const paymentService = require('../services/paymentService');

exports.createRegistration = async (req, res) => {
  try {
    const { account_id , department_id, doctor_id, date, slot, note, regi_type } = req.body;
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

// 返回当前登录账号（患者）的所有挂号记录，包含医生信息与 note 字段
exports.myRegistrations = async (req, res) => {
  try {
    console.log('myRegistrations called, req.user=', req.user);
    console.log('Authorization header=', req.headers && (req.headers.authorization || req.headers.Authorization));
    const accountId = req.user && req.user.id;
    if (!accountId) return res.status(401).json({ success: false, message: 'unauthenticated' });
    const list = await registrationService.getRegistrationsByAccount(accountId);
    return res.json({ success: true, data: list });
  } catch (err) {
    console.error('myRegistrations error', err);
    // 返回详细错误信息以便前端调试（上线前请移除或简化）
    const msg = err && err.message ? err.message : 'internal_error';
    return res.status(500).json({ success: false, message: msg, stack: err.stack });
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

// 医生或管理员编辑订单的病例内容（note 字段）
exports.editNote = async (req, res) => {
  try {
    const { order_id, note } = req.body;
    if (!order_id) return res.status(400).json({ success: false, message: 'missing order_id' });

    // req.user 从 authMiddleware 注入：{ id, username, role }
    const user = req.user || {};

    const [rows] = await db.query('SELECT * FROM orders WHERE id = ?', [order_id]);
    const order = rows[0];
    if (!order) return res.status(404).json({ success: false, message: 'order not found' });

    // 权限：医生只能编辑属于自己的订单；管理员可编辑任意
    if (user.role === 'doctor') {
      // req.user.id 是账号 id，需要把账号 id 映射到 doctors 表的 id
      const [docs] = await db.query('SELECT * FROM doctors WHERE account_id = ?', [user.id]);
      if (!docs || docs.length === 0) return res.status(403).json({ success: false, message: 'forbidden' });
      const doctorId = docs[0].id;
      if (parseInt(doctorId, 10) !== parseInt(order.doctor_id, 10)) {
        return res.status(403).json({ success: false, message: 'forbidden' });
      }
    } else if (user.role !== 'admin') {
      // 非医生且非管理员则拒绝（患者不应通过该接口写病例）
      return res.status(403).json({ success: false, message: 'forbidden' });
    }

    // 使用 service 执行更新（包含事务与 history 记录）
    const registrationService = require('../services/registrationService');
    const updated = await registrationService.updateOrderNote(order_id, note, user.id || null);

    res.json({ success: true, data: updated });
  } catch (err) {
    console.error('editNote error', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

