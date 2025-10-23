const db = require('../db');

exports.createRegistration = async (req, res) => {
  
};

exports.listByUser = async (req, res) => {
  try {
    const { user_id } = req.params;
    const [rows] = await db.query(
      'SELECT * FROM registration_requests WHERE user_id = ? ORDER BY created_at DESC',
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
