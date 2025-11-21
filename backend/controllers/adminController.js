const adminService = require('../services/adminService');

exports.listDepartments = async (req, res) => {
  try {
    const rows = await adminService.listDepartments();
    res.json({ success: true, data: rows });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.createDepartment = async (req, res) => {
  try {
    const row = await adminService.createDepartment(req.body);
    res.json({ success: true, data: row });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.updateDepartment = async (req, res) => {
  try {
    const id = req.params.id;
    await adminService.updateDepartment(id, req.body);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.deleteDepartment = async (req, res) => {
  try {
    const id = req.params.id;
    await adminService.deleteDepartment(id);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// Doctors
exports.listDoctors = async (req, res) => {
  try {
    const rows = await adminService.listDoctors(req.query);
    res.json({ success: true, data: rows });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.createDoctor = async (req, res) => {
  try {
    const row = await adminService.createDoctor(req.body);
    res.json({ success: true, data: row });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.updateDoctor = async (req, res) => {
  try {
    const id = req.params.id;
    await adminService.updateDoctor(id, req.body);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.deleteDoctor = async (req, res) => {
  try {
    const id = req.params.id;
    await adminService.deleteDoctor(id);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.setDoctorPassword = async (req, res) => {
  try {
    const doctorId = req.params.id;
    const { username, password } = req.body || {};
    if (!password) return res.status(400).json({ success: false, message: '需要提供 password 字段' });
    const row = await adminService.setDoctorPassword(doctorId, { username, password });
    res.json({ success: true, data: row });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// Availability
exports.getAvailabilityByDoctor = async (req, res) => {
  try {
    const doctorId = req.params.doctorId;
    const rows = await adminService.getAvailabilityByDoctor(doctorId);
    res.json({ success: true, data: rows });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.createOrUpdateAvailability = async (req, res) => {
  try {
    const row = await adminService.createOrUpdateAvailability(req.body);
    res.json({ success: true, data: row });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.listAllAvailability = async (req, res) => {
  try {
    const rows = await adminService.listAllAvailability();
    res.json({ success: true, data: rows });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.deleteAvailability = async (req, res) => {
  try {
    const id = req.params.id;
    await adminService.deleteAvailability(id);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// Fees
exports.listFees = async (req, res) => {
  try {
    const rows = await adminService.listFees();
    res.json({ success: true, data: rows });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.setFee = async (req, res) => {
  try {
    const row = await adminService.setFee(req.body);
    res.json({ success: true, data: row });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// Doctor profile reviews
exports.listPendingDoctorReviews = async (req, res) => {
  try {
    const rows = await adminService.listPendingDoctorReviews();
    res.json({ success: true, data: rows });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.approveDoctorProfile = async (req, res) => {
  try {
    const doctorId = req.params.doctorId;
    await adminService.approveDoctorProfile(doctorId, req.user.id);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.rejectDoctorProfile = async (req, res) => {
  try {
    const doctorId = req.params.doctorId;
    const { comment } = req.body || {};
    await adminService.rejectDoctorProfile(doctorId, req.user.id, comment);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// Leave requests
exports.listLeaveRequests = async (req, res) => {
  try {
    const rows = await adminService.listLeaveRequests();
    res.json({ success: true, data: rows });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.approveLeaveRequest = async (req, res) => {
  try {
    const id = req.params.id;
    await adminService.setLeaveRequestStatus(id, 'approved', req.user.id);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.rejectLeaveRequest = async (req, res) => {
  try {
    const id = req.params.id;
    await adminService.setLeaveRequestStatus(id, 'rejected', req.user.id);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// Debug: list all tables and optionally row counts
exports.listAllTables = async (req, res) => {
  try {
    const db = require('../db');
    const config = require('../config/default');
    // query information_schema.tables for current database
    const sql = `SELECT TABLE_NAME, TABLE_ROWS, ENGINE, TABLE_TYPE FROM information_schema.tables WHERE table_schema = ? ORDER BY TABLE_NAME`;
    const [rows] = await db.query(sql, [config.db.database]);
    res.json({ success: true, data: rows, database: config.db.database });
  } catch (err) { console.error('listAllTables err', err); res.status(500).json({ success: false, message: err.message }); }
};

// Admin: list orders with basic joins
exports.listOrders = async (req, res) => {
  try {
    const db = require('../db');
    // optional filters via query: doctor_id, date, status
    const { doctor_id, date, status } = req.query;
  let sql = `SELECT o.*, p.amount as payment_amount, p.status as payment_status, p.paid_at as payment_paid_at, d.name as doctor_name, dept.name as department_name,
                CASE WHEN o.is_waitlist = 1 THEN (
                  SELECT COUNT(1) FROM orders w WHERE w.doctor_id = o.doctor_id AND w.date = o.date AND w.status = 'waiting' AND w.is_waitlist = 1 AND w.created_at < o.created_at
                ) ELSE 0 END as wait_position,
                CASE WHEN o.is_waitlist = 1 THEN (
                  SELECT COUNT(1) FROM orders w WHERE w.doctor_id = o.doctor_id AND w.date = o.date AND w.status = 'waiting' AND w.is_waitlist = 1
                ) ELSE 0 END as wait_total
               FROM orders o
               LEFT JOIN payments p ON o.payment_id = p.id
               LEFT JOIN doctors d ON o.doctor_id = d.id
               LEFT JOIN departments dept ON d.department_id = dept.id
               WHERE 1=1`;
    const params = [];
    if (doctor_id) { sql += ' AND o.doctor_id = ?'; params.push(doctor_id); }
    if (date) { sql += ' AND o.date = ?'; params.push(date); }
    if (status) { sql += ' AND o.status = ?'; params.push(status); }
    sql += ' ORDER BY o.created_at DESC LIMIT 500';
    const [rows] = await db.query(sql, params);
    res.json({ success: true, data: rows });
  } catch (err) { console.error('listOrders err', err); res.status(500).json({ success: false, message: err.message }); }
};

// Account management (admin)
exports.listAccounts = async (req, res) => {
  try {
    const rows = await adminService.listAccounts();
    res.json({ success: true, data: rows });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.getAccount = async (req, res) => {
  try {
    const id = req.params.id;
    const row = await adminService.getAccountById(id);
    if (!row) return res.status(404).json({ success: false, message: 'Account not found' });
    res.json({ success: true, data: row });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.updateAccount = async (req, res) => {
  try {
    const id = req.params.id;
    const row = await adminService.updateAccount(id, req.body);
    res.json({ success: true, data: row });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.deleteAccount = async (req, res) => {
  try {
    const id = req.params.id;
    await adminService.deleteAccount(id);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};
