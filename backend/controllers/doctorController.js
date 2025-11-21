const doctorService = require('../services/doctorService');

exports.create = async (req, res) => {
  try {
    const payload = req.body || {};
    const created = await doctorService.createDoctor(payload);
    res.json({ success: true, data: created });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.get = async (req, res) => {
  try {
    const id = req.params.id;
    const doc = await doctorService.getDoctorById(id);
    if (!doc) return res.status(404).json({ success: false, message: 'Doctor not found' });
    res.json({ success: true, data: doc });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getMyDoctor = async (req, res) => {
  try {
    const accountId = req.user && req.user.id;
    if (!accountId) return res.status(401).json({ success: false, message: 'Unauthorized' });
    const [rows] = await require('../db').query('SELECT * FROM doctors WHERE account_id = ?', [accountId]);
    if (!rows || rows.length === 0) return res.status(404).json({ success: false, message: '医生未绑定账户' });
    res.json({ success: true, data: rows[0] });
  } catch (err) { console.error(err); res.status(500).json({ success: false, message: err.message }); }
};

  // allow doctor to update their own profile
  exports.updateMe = async (req, res) => {
    try {
      const accountId = req.user && req.user.id;
      if (!accountId) return res.status(401).json({ success: false, message: 'Unauthorized' });
      const db = require('../db');
      const [docs] = await db.query('SELECT * FROM doctors WHERE account_id = ?', [accountId]);
      if (!docs || docs.length === 0) return res.status(404).json({ success: false, message: '医生未绑定账户' });
      const doctorId = docs[0].id;
      const updated = await require('../services/doctorService').updateDoctor(doctorId, req.body || {});
      res.json({ success: true, data: updated });
    } catch (err) { console.error(err); res.status(500).json({ success: false, message: err.message }); }
  };

  // allow doctor to submit a leave request (will be pending for admin review)
  exports.createLeaveRequest = async (req, res) => {
    try {
      const accountId = req.user && req.user.id;
      if (!accountId) return res.status(401).json({ success: false, message: 'Unauthorized' });
      const db = require('../db');
      const [docs] = await db.query('SELECT * FROM doctors WHERE account_id = ?', [accountId]);
      if (!docs || docs.length === 0) return res.status(404).json({ success: false, message: '医生未绑定账户' });
      const doctorId = docs[0].id;
      const { from_date, to_date, reason } = req.body || {};
      if (!from_date || !to_date) return res.status(400).json({ success: false, message: '需要提供 from_date 和 to_date' });
      const row = await require('../services/adminService').createLeaveRequest(doctorId, from_date, to_date, reason || null);
      res.json({ success: true, data: row });
    } catch (err) { console.error(err); res.status(500).json({ success: false, message: err.message }); }
  };

exports.getRegistrationsForMe = async (req, res) => {
  try {
    const accountId = req.user && req.user.id;
    if (!accountId) return res.status(401).json({ success: false, message: 'Unauthorized' });
    const date = req.query.date;
    const db = require('../db');
    // find doctor id
    const [docs] = await db.query('SELECT * FROM doctors WHERE account_id = ?', [accountId]);
    if (!docs || docs.length === 0) return res.status(404).json({ success: false, message: '医生未绑定账户' });
    const doctorId = docs[0].id;
    // join accounts/profiles to show patient info in the doctor view
    let q = `SELECT o.*, a.username as account_username, p.display_name as patient_name, p.phone as patient_phone
             FROM orders o
             LEFT JOIN accounts a ON o.account_id = a.id
             LEFT JOIN profiles p ON p.account_id = a.id
             WHERE o.doctor_id = ?`;
    const params = [doctorId];
    if (date) { q += ' AND o.date = ?'; params.push(date); }
    q += ' ORDER BY o.created_at DESC';
    const [rows] = await db.query(q, params);
    res.json({ success: true, data: rows });
  } catch (err) { console.error(err); res.status(500).json({ success: false, message: err.message }); }
};

// get registrations for a specific doctor id (access controlled)
exports.getRegistrationsByDoctorId = async (req, res) => {
  try {
    const doctorId = parseInt(req.params.id, 10);
    if (!doctorId) return res.status(400).json({ success: false, message: 'Invalid doctor id' });
    const db = require('../db');
    const requester = req.user && req.user.id;
    const requesterRole = req.user && req.user.role;
    // allow if admin
    if (requesterRole !== 'admin') {
      // otherwise requester must be the linked account for this doctor
      const [docs] = await db.query('SELECT * FROM doctors WHERE id = ?', [doctorId]);
      if (!docs || docs.length === 0) return res.status(404).json({ success: false, message: 'Doctor not found' });
      const doc = docs[0];
      if (doc.account_id !== requester) return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    const date = req.query.date;
    let q = `SELECT o.*, a.username as account_username, p.display_name as patient_name, p.phone as patient_phone
             FROM orders o
             LEFT JOIN accounts a ON o.account_id = a.id
             LEFT JOIN profiles p ON p.account_id = a.id
             WHERE o.doctor_id = ?`;
    const params = [doctorId];
    if (date) { q += ' AND o.date = ?'; params.push(date); }
    q += ' ORDER BY o.created_at DESC';
    const [rows] = await db.query(q, params);
    res.json({ success: true, data: rows });
  } catch (err) { console.error('getRegistrationsByDoctorId err', err); res.status(500).json({ success: false, message: err.message }); }
};

// allow doctor to manage their own availability (create/update)
exports.upsertAvailabilityForMe = async (req, res) => {
  try {
    const accountId = req.user && req.user.id;
    if (!accountId) return res.status(401).json({ success: false, message: 'Unauthorized' });
    const db = require('../db');
    const [docs] = await db.query('SELECT * FROM doctors WHERE account_id = ?', [accountId]);
    if (!docs || docs.length === 0) return res.status(404).json({ success: false, message: '医生未绑定账户' });
    const doctorId = docs[0].id;
    const payload = Object.assign({}, req.body, { doctor_id: doctorId });
    const row = await require('../services/adminService').createOrUpdateAvailability(payload);
    res.json({ success: true, data: row });
  } catch (err) { console.error(err); res.status(500).json({ success: false, message: err.message }); }
};

exports.deleteAvailabilityForMe = async (req, res) => {
  try {
    const accountId = req.user && req.user.id;
    if (!accountId) return res.status(401).json({ success: false, message: 'Unauthorized' });
    const db = require('../db');
    const [docs] = await db.query('SELECT * FROM doctors WHERE account_id = ?', [accountId]);
    if (!docs || docs.length === 0) return res.status(404).json({ success: false, message: '医生未绑定账户' });
    const doctorId = docs[0].id;
    const id = req.params.id;
    // confirm the availability belongs to this doctor
    const [rows] = await db.query('SELECT * FROM doctor_availability WHERE id = ? AND doctor_id = ?', [id, doctorId]);
    if (!rows || rows.length === 0) return res.status(404).json({ success: false, message: '排班未找到或无权限' });
    await require('../services/adminService').deleteAvailability(id);
    res.json({ success: true });
  } catch (err) { console.error(err); res.status(500).json({ success: false, message: err.message }); }
};

exports.list = async (req, res) => {
  try {
    const filters = {};
    if (req.query && req.query.department_id) filters.department_id = req.query.department_id;
    const rows = await doctorService.listDoctors(filters);
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.update = async (req, res) => {
  try {
    const id = req.params.id;
    const updated = await doctorService.updateDoctor(id, req.body || {});
    res.json({ success: true, data: updated });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getAvailability = async (req, res) => {
  try {
    const id = req.params.id;
    const date = req.query.date || null;
    const rows = await doctorService.getAvailabilityByDoctor(id, date);
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
};
