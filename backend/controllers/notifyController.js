const db = require('../db');

// POST /api/notify/subscribe
// body: { wx_openid?, notify_opt_in: true/false, templates: [ids] }
exports.subscribe = async (req, res) => {
  try {
    const accountId = req.user && req.user.id;
    if (!accountId) return res.status(401).json({ success: false, message: 'Unauthorized' });
    const { wx_openid, notify_opt_in } = req.body || {};
    // Update account record with openid and opt-in flag
    await db.query('UPDATE accounts SET wx_openid = ?, notify_opt_in = ? WHERE id = ?', [wx_openid || null, notify_opt_in ? 1 : 0, accountId]);
    res.json({ success: true });
  } catch (err) {
    console.error('notify.subscribe err', err);
    res.status(500).json({ success: false, message: err.message });
  }
};
