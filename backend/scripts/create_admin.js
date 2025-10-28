const db = require('../db');
const bcrypt = require('bcryptjs');

async function createAdmin(username, password) {
  const [rows] = await db.query('SELECT * FROM accounts WHERE username = ?', [username]);
  if (rows.length > 0) {
    console.log('Admin user already exists');
    return;
  }
  const hash = bcrypt.hashSync(password, 10);
  const [r] = await db.query('INSERT INTO accounts (username, password_hash, role) VALUES (?, ?, ?)', [username, hash, 'admin']);
  console.log('Created admin user id=', r.insertId);
}

const argv = process.argv.slice(2);
const username = argv[0] || 'admin';
const password = argv[1] || 'admin';

createAdmin(username, password).then(()=>{ process.exit(0); }).catch(err=>{ console.error(err); process.exit(1); });
