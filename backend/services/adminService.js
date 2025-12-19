const db = require('../db');
const bcrypt = require('bcryptjs');
const AccountModel = require('../schemas/accountModels');

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

async function setDoctorPassword(doctorId, { username, password }) {
  // find doctor
  const [rows] = await db.query('SELECT * FROM doctors WHERE id = ?', [doctorId]);
  if (rows.length === 0) throw new Error('Doctor not found');
  const doc = rows[0];
  // if doctor has account_id, update that account; otherwise create a new account and link it
  if (doc.account_id) {
    const hash = await bcrypt.hash(password, 10);
    await AccountModel.updatePassword(doc.account_id, hash);
    return { account_id: doc.account_id };
  } else {
    // create username if not provided
    const uname = username || `doctor${doctorId}`;
    const hash = await bcrypt.hash(password, 10);
    const accountId = await AccountModel.create(uname, hash, 'doctor');
    // link doctor to account
    await db.query('UPDATE doctors SET account_id = ? WHERE id = ?', [accountId, doctorId]);
    return { account_id: accountId, username: uname };
  }
}

// Account management (admin)
async function listAccounts() {
  const [rows] = await db.query('SELECT id, username, role, created_at, updated_at FROM accounts ORDER BY id DESC');
  return rows;
}

async function getAccountById(id) {
  const acc = await AccountModel.findById(id);
  if (!acc) return null;
  // hide password_hash
  delete acc.password_hash;
  return acc;
}

async function updateAccount(id, payload) {
  const allowed = ['username', 'role'];
  const sets = [];
  const params = [];
  allowed.forEach(k => { if (payload[k] !== undefined) { sets.push(`${k} = ?`); params.push(payload[k]); } });
  if (sets.length === 0) {
    const a = await getAccountById(id);
    return a;
  }
  params.push(id);
  const sql = `UPDATE accounts SET ${sets.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`;
  await db.query(sql, params);
  const [rows] = await db.query('SELECT id, username, role, created_at, updated_at FROM accounts WHERE id = ?', [id]);
  return rows[0];
}

async function deleteAccount(id) {
  await db.query('DELETE FROM accounts WHERE id = ?', [id]);
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
  // We'll upsert the specific slot entry, then sync the day-level capacity to all availabilities for that doctor/date.
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    // lock all avail rows for the doctor/date to avoid races
    const [rows] = await conn.query('SELECT * FROM doctor_availability WHERE doctor_id = ? AND date = ? FOR UPDATE', [doctor_id, date]);
    if (rows.length > 0) {
      // check if slot exists
      const existing = rows.find(r => r.slot === slot);
      if (existing) {
        await conn.query('UPDATE doctor_availability SET capacity = ?, extra = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [capacity, JSON.stringify(extra || {}), existing.id]);
      } else {
        // insert new slot, but use day-level capacity to keep consistency
        const dayCap = capacity || rows[0].capacity || 1;
        await conn.query('INSERT INTO doctor_availability (doctor_id, date, slot, capacity, booked, extra) VALUES (?, ?, ?, ?, ?, ?)', [doctor_id, date, slot, dayCap, rows[0].booked || 0, JSON.stringify(extra || {})]);
      }

      // sync capacity and extra.booked_types if provided to all rows for that date
      const dayCapacity = capacity || rows[0].capacity || 1;
      await conn.query('UPDATE doctor_availability SET capacity = ?, extra = ? WHERE doctor_id = ? AND date = ?', [dayCapacity, JSON.stringify(extra || {}), doctor_id, date]);

      // return all availabilities for that doctor/date (caller can decide)
      const [r2] = await conn.query('SELECT * FROM doctor_availability WHERE doctor_id = ? AND date = ? ORDER BY slot', [doctor_id, date]);
      await conn.commit();
      return r2;
    } else {
      // no existing rows for that doctor/date: insert the slot record with provided capacity
      const cap = capacity || 1;
      const [r] = await conn.query('INSERT INTO doctor_availability (doctor_id, date, slot, capacity, booked, extra) VALUES (?, ?, ?, ?, 0, ?)', [doctor_id, date, slot, cap, JSON.stringify(extra || {})]);
      const [r2] = await conn.query('SELECT * FROM doctor_availability WHERE id = ?', [r.insertId]);
      await conn.commit();
      return [r2[0]];
    }
  } catch (err) {
    try { await conn.rollback(); } catch(e){}
    throw err;
  } finally {
    conn.release();
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

async function createLeaveRequest(doctor_id, from_date, to_date, reason) {
  await ensureTables();
  const [r] = await db.query('INSERT INTO doctor_leaves (doctor_id, from_date, to_date, reason, status) VALUES (?, ?, ?, ?, ?)', [doctor_id, from_date, to_date, reason || null, 'pending']);
  const [rows] = await db.query('SELECT * FROM doctor_leaves WHERE id = ?', [r.insertId]);
  return rows[0];
}

async function getStatistics() {
  const today = new Date().toISOString().split('T')[0];
  
  // Helper to get count and trend
  const getCountAndTrend = async (table, dateField, additionalWhere = '') => {
    const [todayRows] = await db.query(
      `SELECT COUNT(*) as count FROM ${table} WHERE DATE(${dateField}) = CURDATE() ${additionalWhere}`
    );
    const [yesterdayRows] = await db.query(
      `SELECT COUNT(*) as count FROM ${table} WHERE DATE(${dateField}) = CURDATE() - INTERVAL 1 DAY ${additionalWhere}`
    );
    const todayCount = todayRows[0].count;
    const yesterdayCount = yesterdayRows[0].count;
    let trend = 0;
    if (yesterdayCount > 0) {
      trend = ((todayCount - yesterdayCount) / yesterdayCount) * 100;
    } else if (todayCount > 0) {
      trend = 100;
    }
    return { value: todayCount, trend: parseFloat(trend.toFixed(1)) };
  };

  // 1. 今日挂号
  const registrations = await getCountAndTrend('orders', 'created_at');

  // 2. 今日收入
  const [todayRevenueRows] = await db.query(
    `SELECT SUM(amount) as total FROM payments WHERE status = 'paid' AND DATE(paid_at) = CURDATE()`
  );
  const [yesterdayRevenueRows] = await db.query(
    `SELECT SUM(amount) as total FROM payments WHERE status = 'paid' AND DATE(paid_at) = CURDATE() - INTERVAL 1 DAY`
  );
  const todayRevenue = todayRevenueRows[0].total || 0;
  const yesterdayRevenue = yesterdayRevenueRows[0].total || 0;
  let revenueTrend = 0;
  if (yesterdayRevenue > 0) {
    revenueTrend = ((todayRevenue - yesterdayRevenue) / yesterdayRevenue) * 100;
  } else if (todayRevenue > 0) {
    revenueTrend = 100;
  }
  const revenue = { value: parseFloat(todayRevenue).toFixed(2), trend: parseFloat(revenueTrend.toFixed(1)) };

  // 3. 新增患者
  const newPatients = await getCountAndTrend('accounts', 'created_at', "AND role = 'user'");

  // 4. 医生出诊
  const [todayDoctors] = await db.query(
    `SELECT COUNT(DISTINCT doctor_id) as count FROM doctor_availability WHERE date = CURDATE()`
  );
  const [yesterdayDoctors] = await db.query(
    `SELECT COUNT(DISTINCT doctor_id) as count FROM doctor_availability WHERE date = CURDATE() - INTERVAL 1 DAY`
  );
  const todayDocCount = todayDoctors[0].count;
  const yesterdayDocCount = yesterdayDoctors[0].count;
  let docTrend = 0;
  if (yesterdayDocCount > 0) {
    docTrend = ((todayDocCount - yesterdayDocCount) / yesterdayDocCount) * 100;
  } else if (todayDocCount > 0) {
    docTrend = 100;
  }
  const activeDoctors = { value: todayDocCount, trend: parseFloat(docTrend.toFixed(1)) };

  // 5. 近7日挂号趋势
  const [trendRows] = await db.query(`
    SELECT DATE_FORMAT(date, '%Y-%m-%d') as date, COUNT(*) as count 
    FROM orders 
    WHERE created_at >= CURDATE() - INTERVAL 6 DAY 
    GROUP BY DATE_FORMAT(date, '%Y-%m-%d') 
    ORDER BY date ASC
  `);
  
  // Fill in missing dates
  const last7Days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    const found = trendRows.find(r => r.date === dateStr);
    last7Days.push({ date: dateStr, count: found ? found.count : 0 });
  }

  // 6. 科室挂号占比
  const [deptShareRows] = await db.query(`
    SELECT d.name, COUNT(*) as count 
    FROM orders o 
    JOIN departments d ON o.department_id = d.id 
    GROUP BY d.id, d.name
  `);

  return {
    cards: [
      { title: '今日挂号', value: registrations.value, trend: registrations.trend, type: 'primary', tag: '日' },
      { title: '今日收入', value: `¥ ${revenue.value}`, trend: revenue.trend, type: 'success', tag: '日' },
      { title: '新增患者', value: newPatients.value, trend: newPatients.trend, type: 'warning', tag: '日' },
      { title: '医生出诊', value: activeDoctors.value, trend: activeDoctors.trend, type: 'info', tag: '日' }
    ],
    trend: {
      dates: last7Days.map(d => d.date),
      values: last7Days.map(d => d.count)
    },
    departmentShare: deptShareRows.map(r => ({ name: r.name, value: r.count }))
  };
}

module.exports = {
  ensureTables,
  listDepartments, createDepartment, updateDepartment, deleteDepartment,
  listDoctors, createDoctor, updateDoctor, deleteDoctor,
  setDoctorPassword,
  // account management (admin)
  listAccounts, getAccountById, updateAccount, deleteAccount,
  getAvailabilityByDoctor, listAllAvailability, deleteAvailability, createOrUpdateAvailability,
  listFees, setFee,
  listPendingDoctorReviews, approveDoctorProfile, rejectDoctorProfile,
  listLeaveRequests, setLeaveRequestStatus, createLeaveRequest,
  getStatistics
};
