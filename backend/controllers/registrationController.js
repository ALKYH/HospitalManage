const db = require('../db');
const registrationService = require('../services/registrationService');

exports.createRegistration = async (req, res) => {
  try {
    const { account_id, department_id, doctor_id, date, slot, note } = req.body;
    if (!account_id || !department_id || !doctor_id || !date || !slot) {
      return res.status(400).json({ success: false, message: 'missing parameters' });
    }

    const order = await registrationService.createRegistration({ account_id, department_id, doctor_id, date, slot, note });
    res.json({ success: true, data: order });
  } catch (err) {
    console.error('createRegistration error', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.listByUser = async (req, res) => {
  try {
    const { user_id } = req.params;
    const [rows] = await db.query(
      'SELECT * FROM orders WHERE account_id = ? ORDER BY created_at DESC',
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

