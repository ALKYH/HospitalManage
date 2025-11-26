/**
 * ensure_db.js
 * 简单脚本：连接数据库并检查关键表是否存在；若不存在则执行 ../sql/init.sql
 * 用于开发环境下自动修复数据库结构问题（非生产迁移工具）
 */
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const config = require('../config/default');

async function ensure() {
  const conn = await mysql.createConnection({
    host: config.db.host,
    user: config.db.user,
    password: config.db.password,
    database: config.db.database
  });

  try {
    // 检查 accounts 表是否存在
    const [rows] = await conn.query("SHOW TABLES LIKE 'accounts';");
    if (rows.length > 0) {
      console.log('DB already initialized.');
      // perform lightweight migrations if needed (e.g., add paid_at to payments)
      try {
        const [prows] = await conn.query("SHOW TABLES LIKE 'payments';");
        if (prows.length > 0) {
          const [cols] = await conn.query("SELECT COLUMN_NAME FROM information_schema.columns WHERE table_schema = ? AND table_name = 'payments'", [config.db.database]);
          const colNames = (cols || []).map(c => c.COLUMN_NAME);
          if (!colNames.includes('paid_at')) {
            console.log('Adding paid_at column to payments table...');
            await conn.query('ALTER TABLE payments ADD COLUMN paid_at DATETIME NULL AFTER provider_info');
            console.log('paid_at column added to payments');
          }
        }
        // ensure accounts has wx_openid and notify_opt_in for WeChat subscriptions
        const [accRows] = await conn.query("SHOW TABLES LIKE 'accounts';");
        if (accRows.length > 0) {
          const [accCols] = await conn.query("SELECT COLUMN_NAME FROM information_schema.columns WHERE table_schema = ? AND table_name = 'accounts'", [config.db.database]);
          const accColNames = (accCols || []).map(c => c.COLUMN_NAME);
          if (!accColNames.includes('wx_openid')) {
            console.log('Adding wx_openid column to accounts table...');
            await conn.query("ALTER TABLE accounts ADD COLUMN wx_openid VARCHAR(128) NULL AFTER password_hash");
            console.log('wx_openid column added to accounts');
          }
          if (!accColNames.includes('notify_opt_in')) {
            console.log('Adding notify_opt_in column to accounts table...');
            await conn.query("ALTER TABLE accounts ADD COLUMN notify_opt_in TINYINT(1) DEFAULT 0 AFTER wx_openid");
            console.log('notify_opt_in column added to accounts');
          }
        }
      } catch (merr) {
        console.warn('Migration check failed', merr.message);
      }
      return;
    }

    console.log('DB appears uninitialized. Applying sql/init.sql...');
    const sqlPath = path.resolve(__dirname, '..', 'sql', 'init.sql');
    if (!fs.existsSync(sqlPath)) {
      console.error('init.sql not found at', sqlPath);
      process.exit(1);
    }

    const sql = fs.readFileSync(sqlPath, 'utf8');
    // 简单拆分；注意：此拆分不适用于非常复杂的脚本
    const statements = sql.split(/;\s*\n/).map(s => s.trim()).filter(Boolean);
    for (const stmt of statements) {
      try {
        console.log('Executing statement snippet...');
        await conn.query(stmt);
      } catch (err) {
        console.error('Failed statement:', err.message);
      }
    }

    console.log('DB init attempted.');
  } finally {
    await conn.end();
  }
}

ensure().catch(err => {
  console.error('ensure_db error', err);
  process.exit(1);
});
