const db = require('../db');
const staffList = require('../data/staffList.json');

// 字段最大长度映射（与 init.sql 保持一致）
const FIELD_LIMITS = {
  display_name: 100,
  phone: 30,
  address: 255,
  idcard: 64
};

function truncateIfNeeded(key, value) {
  if (!value || typeof value !== 'string') return value;
  const limit = FIELD_LIMITS[key];
  if (!limit) return value;
  if (value.length > limit) {
    console.warn(`Truncating field ${key} from length ${value.length} to ${limit}`);
    return value.slice(0, limit);
  }
  return value;
}

async function getProfileByAccountId(accountId) {
  const [rows] = await db.query('SELECT * FROM profiles WHERE account_id = ?', [accountId]);
  return rows[0] || null;
}

function verifyAgainstStaffList({ employeeId, name, idNumber }) {
  // 严格匹配：要求学/工号(employeeId)、姓名(name)、身份证(idNumber)三项与 staffList 中同一条记录完全一致
  console.log('Strict verifying against staff list:', { employeeId, name, idNumber });
  if (!employeeId || !name || !idNumber) return false;
  const found = staffList.find(s => {
    try {
      return String(s.employeeId || '').trim() === String(employeeId || '').trim()
        && String(s.name || '').trim() === String(name || '').trim()
        && String(s.idNumber || '').trim() === String(idNumber || '').trim();
    } catch (e) {
      return false;
    }
  });
  return !!found;
}

async function saveProfile(accountId, payload) {
  // payload: { display_name, phone, gender, birthday, address, idcard, extra }
  // 先做长度校验并截断（避免 SQL Data too long）
  const safe = Object.assign({}, payload);
  ['display_name', 'phone', 'address', 'idcard'].forEach(k => {
    if (k in safe && typeof safe[k] === 'string') {
      safe[k] = truncateIfNeeded(k, safe[k]);
    }
  });

  // 规范化性别：前端可能提交 '男'/'女'，数据库 schema 使用 ENUM('M','F')
  if (safe.gender) {
    const g = String(safe.gender).trim();
    if (g === '男' || g.toUpperCase() === 'M') safe.gender = 'M';
    else if (g === '女' || g.toUpperCase() === 'F') safe.gender = 'F';
    else safe.gender = null; // 不识别的值写入 null，避免插入非法 ENUM
  }

  // debug log
  console.log('Saving profile for account', accountId, 'payload keys:', Object.keys(safe));

  const exists = await getProfileByAccountId(accountId);
  try {
    if (exists) {
      // update
      await db.query(
        `UPDATE profiles SET display_name=?, phone=?, gender=?, birthday=?, address=?, idcard=?, extra=JSON_MERGE_PATCH(COALESCE(extra,'{}'), ?), updated_at=CURRENT_TIMESTAMP WHERE account_id = ?`,
        [safe.display_name || null, safe.phone || null, safe.gender || null, safe.birthday || null, safe.address || null, safe.idcard || null, JSON.stringify(safe.extra || {}), accountId]
      );
      const [rows] = await db.query('SELECT * FROM profiles WHERE account_id = ?', [accountId]);
      console.log('Profile updated for', accountId);
      return rows[0];
    } else {
      const [r] = await db.query(
        'INSERT INTO profiles (account_id, display_name, phone, gender, birthday, address, idcard, extra) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [accountId, safe.display_name || null, safe.phone || null, safe.gender || null, safe.birthday || null, safe.address || null, safe.idcard || null, JSON.stringify(safe.extra || {})]
      );
      const [rows] = await db.query('SELECT * FROM profiles WHERE id = ?', [r.insertId]);
      console.log('Profile created for', accountId);
      return rows[0];
    }
  } catch (err) {
    console.error('Error saving profile for account', accountId, err.message);
    // 如果是数据截断等 SQL 错误，可以返回更明确的错误信息
    if (err && err.message && err.message.includes('Data too long')) {
      throw new Error('某些字段长度超出数据库限制，请检查输入并缩短。');
    }
    throw err;
  }
}

module.exports = { getProfileByAccountId, verifyAgainstStaffList, saveProfile };
