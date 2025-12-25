const mysql = require('mysql2/promise');
const config = require('../config/default');

const poolConfig = {
  host: config.db.host,
  port: config.db.port || 3306,
  user: config.db.user,
  password: config.db.password,
  database: config.db.database,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

// If SSL is required (e.g., managed cloud DB), enable minimal SSL config.
if (config.db.ssl) {
  poolConfig.ssl = { rejectUnauthorized: false };
}

const pool = mysql.createPool(poolConfig);

module.exports = pool;
