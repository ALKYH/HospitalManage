const db = require('../db');

async function createDoctor(payload) {
  const { name, account_id, department_id, title, bio, contact } = payload;
  const [r] = await db.query('INSERT INTO doctors (name, account_id, department_id, title, bio, contact) VALUES (?, ?, ?, ?, ?, ?)', [name, account_id || null, department_id || null, title || null, bio || null, contact || null]);
  const [rows] = await db.query('SELECT * FROM doctors WHERE id = ?', [r.insertId]);
  return rows[0];
}

async function getDoctorById(id) {
  const [rows] = await db.query('SELECT * FROM doctors WHERE id = ?', [id]);
  return rows[0];
}

async function listDoctors(filters) {
  // filters: { department_id }
  if (filters && filters.department_id) {
    const [rows] = await db.query('SELECT * FROM doctors WHERE department_id = ?', [filters.department_id]);
    return rows;
  }
  const [rows] = await db.query('SELECT * FROM doctors');
  return rows;
}

async function getAvailabilityByDoctor(doctorId, date) {
  // date optional: if provided, filter by date
  let q = 'SELECT * FROM doctor_availability WHERE doctor_id = ?';
  const params = [doctorId];
  if (date) { q += ' AND date = ?'; params.push(date); }
  q += ' ORDER BY date, slot';
  const [rows] = await db.query(q, params);
  // map extra and compute available_by_type when possible
  const mapped = rows.map(r => {
    let extra = null;
    try { extra = r.extra ? JSON.parse(r.extra) : null; } catch(e){ extra = null; }
    const available_by_type = {};
    if (extra && extra.capacity_types) {
      // if extra specifies per-type capacities, try to use booked_types if available
      const booked_types = (extra.booked_types) ? extra.booked_types : {};
      for (const t of Object.keys(extra.capacity_types)) {
        const cap = parseInt(extra.capacity_types[t] || 0, 10);
        const b = parseInt(booked_types[t] || 0, 10);
        available_by_type[t] = Math.max(0, cap - b);
      }
    } else {
      // fallback to general capacity/booked
      available_by_type['默认'] = Math.max(0, (r.capacity || 0) - (r.booked || 0));
    }
    return Object.assign({}, r, { extra, available_by_type });
  });
  return mapped;
}

async function updateDoctor(id, payload) {
  const fields = [];
  const values = [];
  ['name','account_id','department_id','title','bio','contact'].forEach(k => {
    if (k in payload) { fields.push(`${k} = ?`); values.push(payload[k]); }
  });
  if (fields.length === 0) return getDoctorById(id);
  values.push(id);
  await db.query(`UPDATE doctors SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, values);
  return getDoctorById(id);
}

module.exports = { createDoctor, getDoctorById, listDoctors, getAvailabilityByDoctor, updateDoctor };
