const db = require('../db');

async function ensureTables() {
  // fees, doctor_profile_reviews, doctor_leaves
  await db.query(`CREATE TABLE IF NOT EXISTS fees (
    id INT AUTO_INCREMENT PRIMARY KEY,
    target_type ENUM('global','department','doctor') NOT NULL,
    target_id INT NULL,
    service_type VARCHAR(50) NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  )`);

  await db.query(`CREATE TABLE IF NOT EXISTS doctor_profile_reviews (
    id INT AUTO_INCREMENT PRIMARY KEY,
    doctor_id INT NOT NULL,
    status ENUM('pending','approved','rejected') DEFAULT 'pending',
    reviewer_id INT NULL,
    comment TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`);

  await db.query(`CREATE TABLE IF NOT EXISTS doctor_leaves (
    id INT AUTO_INCREMENT PRIMARY KEY,
    doctor_id INT NOT NULL,
    from_date DATE NOT NULL,
    to_date DATE NOT NULL,
    reason TEXT NULL,
    status ENUM('pending','approved','rejected') DEFAULT 'pending',
    approved_by INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`);
}

// Departments
async function listDepartments() {
  const [rows] = await db.query('SELECT * FROM departments');
  return rows;
}

async function createDepartment(payload) {
  const { name, code, parent_id } = payload;
  const [r] = await db.query('INSERT INTO departments (name, code, parent_id) VALUES (?, ?, ?)', [name, code || null, parent_id || null]);
  const [rows] = await db.query('SELECT * FROM departments WHERE id = ?', [r.insertId]);
  return rows[0];
}

async function updateDepartment(id, payload) {
  const { name, code, parent_id } = payload;
  await db.query('UPDATE departments SET name = ?, code = ?, parent_id = ? WHERE id = ?', [name, code || null, parent_id || null, id]);
}

async function deleteDepartment(id) {
  await db.query('DELETE FROM departments WHERE id = ?', [id]);
}

// Doctors
async function listDoctors(filters) {
  const [rows] = await db.query('SELECT * FROM doctors ORDER BY created_at DESC');
  return rows;
}

async function createDoctor(payload) {
  const { name, account_id, department_id, title, bio, contact } = payload;
  const [r] = await db.query('INSERT INTO doctors (name, account_id, department_id, title, bio, contact) VALUES (?, ?, ?, ?, ?, ?)', [name, account_id || null, department_id || null, title || null, bio || null, contact || null]);
  const [rows] = await db.query('SELECT * FROM doctors WHERE id = ?', [r.insertId]);
  // create initial review
  await db.query('INSERT INTO doctor_profile_reviews (doctor_id, status) VALUES (?, ?)', [r.insertId, 'pending']);
  return rows[0];
}

async function updateDoctor(id, payload) {
  const { name, department_id, title, bio, contact } = payload;
  await db.query('UPDATE doctors SET name = ?, department_id = ?, title = ?, bio = ?, contact = ? WHERE id = ?', [name, department_id || null, title || null, bio || null, contact || null, id]);
}

async function deleteDoctor(id) {
  await db.query('DELETE FROM doctors WHERE id = ?', [id]);
}

// Availability
async function getAvailabilityByDoctor(doctorId) {
  const [rows] = await db.query('SELECT * FROM doctor_availability WHERE doctor_id = ? ORDER BY date, slot', [doctorId]);
  return rows;
}

async function listAllAvailability() {
  const [rows] = await db.query('SELECT * FROM doctor_availability ORDER BY date, slot');
  return rows;
}

async function deleteAvailability(id) {
  await db.query('DELETE FROM doctor_availability WHERE id = ?', [id]);
}

async function createOrUpdateAvailability(payload) {
  // payload: { doctor_id, date, slot, capacity, extra }
  const { doctor_id, date, slot, capacity, extra } = payload;
  const [rows] = await db.query('SELECT * FROM doctor_availability WHERE doctor_id = ? AND date = ? AND slot = ?', [doctor_id, date, slot]);
  if (rows.length > 0) {
    await db.query('UPDATE doctor_availability SET capacity = ?, extra = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [capacity, JSON.stringify(extra || {}), rows[0].id]);
    const [r2] = await db.query('SELECT * FROM doctor_availability WHERE id = ?', [rows[0].id]);
    return r2[0];
  } else {
    const [r] = await db.query('INSERT INTO doctor_availability (doctor_id, date, slot, capacity, booked, extra) VALUES (?, ?, ?, ?, 0, ?)', [doctor_id, date, slot, capacity || 1, JSON.stringify(extra || {})]);
    const [r2] = await db.query('SELECT * FROM doctor_availability WHERE id = ?', [r.insertId]);
    return r2[0];
  }
}

// Fees
async function listFees() {
  await ensureTables();
  const [rows] = await db.query('SELECT * FROM fees ORDER BY id DESC');
  return rows;
}

async function setFee(payload) {
  await ensureTables();
  const { target_type, target_id, service_type, amount } = payload;
  // upsert: delete existing with same target/service then insert
  await db.query('DELETE FROM fees WHERE target_type = ? AND target_id <=> ? AND service_type = ?', [target_type, target_id || null, service_type]);
  const [r] = await db.query('INSERT INTO fees (target_type, target_id, service_type, amount) VALUES (?, ?, ?, ?)', [target_type, target_id || null, service_type, amount]);
  const [rows] = await db.query('SELECT * FROM fees WHERE id = ?', [r.insertId]);
  return rows[0];
}

// Doctor profile reviews
async function listPendingDoctorReviews() {
  await ensureTables();
  const [rows] = await db.query("SELECT r.*, d.name as doctor_name, d.bio, d.contact FROM doctor_profile_reviews r JOIN doctors d ON r.doctor_id = d.id WHERE r.status = 'pending' ORDER BY r.created_at");
  return rows;
}

async function approveDoctorProfile(doctorId, reviewerId) {
  await ensureTables();
  await db.query('UPDATE doctor_profile_reviews SET status = ?, reviewer_id = ? WHERE doctor_id = ? AND status = ?', ['approved', reviewerId, doctorId, 'pending']);
}

async function rejectDoctorProfile(doctorId, reviewerId, comment) {
  await ensureTables();
  await db.query('UPDATE doctor_profile_reviews SET status = ?, reviewer_id = ?, comment = ? WHERE doctor_id = ? AND status = ?', ['rejected', reviewerId, comment || null, doctorId, 'pending']);
}

// Leaves
async function listLeaveRequests() {
  await ensureTables();
  const [rows] = await db.query('SELECT l.*, d.name as doctor_name FROM doctor_leaves l JOIN doctors d ON l.doctor_id = d.id ORDER BY l.created_at DESC');
  return rows;
}

async function setLeaveRequestStatus(id, status, approverId) {
  await ensureTables();
  await db.query('UPDATE doctor_leaves SET status = ?, approved_by = ? WHERE id = ?', [status, approverId, id]);
}

module.exports = {
  ensureTables,
  listDepartments, createDepartment, updateDepartment, deleteDepartment,
  listDoctors, createDoctor, updateDoctor, deleteDoctor,
  getAvailabilityByDoctor, listAllAvailability, deleteAvailability, createOrUpdateAvailability,
  listFees, setFee,
  listPendingDoctorReviews, approveDoctorProfile, rejectDoctorProfile,
  listLeaveRequests, setLeaveRequestStatus
};
