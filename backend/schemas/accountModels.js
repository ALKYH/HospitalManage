const db = require('../db');

const AccountModel = {
  async create(username, passwordHash, role = 'user') {
    const [result] = await db.execute(
      'INSERT INTO accounts (username, password_hash, role) VALUES (?, ?, ?)',
      [username, passwordHash, role]
    );
    return result.insertId;
  },

  async findByUsername(username) {
    const [rows] = await db.execute('SELECT * FROM accounts WHERE username = ?', [username]);
    return rows[0];
  }
};

module.exports = AccountModel;
