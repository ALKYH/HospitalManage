// scripts/recreate_test_db.js
const mysql = require('mysql2');

async function recreateTestDatabase() {
  // 创建连接时不指定数据库
  const connection = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'Really0733251',
    multipleStatements: true // 允许多条SQL语句
  });

  return new Promise((resolve, reject) => {
    console.log('🗑️  删除旧数据库...');
    
    const sql = `
-- 删除旧数据库
DROP DATABASE IF EXISTS hospital_test;

-- 创建新数据库
CREATE DATABASE hospital_test CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 切换到新数据库
USE hospital_test;

-- accounts 表
CREATE TABLE accounts (
  id INT NOT NULL AUTO_INCREMENT,
  username VARCHAR(50) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(20) DEFAULT 'user',
  email VARCHAR(100) DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY username (username)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- departments 表
CREATE TABLE departments (
  id INT NOT NULL AUTO_INCREMENT,
  name VARCHAR(100) NOT NULL,
  code VARCHAR(50) DEFAULT NULL,
  description TEXT,
  parent_id INT DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- doctors 表
CREATE TABLE doctors (
  id INT NOT NULL AUTO_INCREMENT,
  name VARCHAR(100) NOT NULL,
  account_id INT DEFAULT NULL,
  department_id INT NOT NULL,
  title VARCHAR(100) DEFAULT NULL,
  bio TEXT,
  contact VARCHAR(50) DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY department_id (department_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- doctor_availability 表
CREATE TABLE doctor_availability (
  id INT NOT NULL AUTO_INCREMENT,
  doctor_id INT NOT NULL,
  date DATE NOT NULL,
  slot VARCHAR(10) NOT NULL,
  capacity INT DEFAULT 20,
  booked INT DEFAULT 0,
  extra JSON DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY doctor_date_slot (doctor_id, date, slot),
  KEY doctor_id (doctor_id),
  KEY date (date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- orders 表
CREATE TABLE orders (
  id INT NOT NULL AUTO_INCREMENT,
  account_id INT NOT NULL,
  department_id INT NOT NULL,
  doctor_id INT NOT NULL,
  availability_id INT DEFAULT NULL,
  date DATE NOT NULL,
  slot VARCHAR(10) NOT NULL,
  status VARCHAR(20) DEFAULT 'pending',
  is_waitlist TINYINT(1) DEFAULT 0,
  priority INT DEFAULT 0,
  queue_number INT DEFAULT NULL,
  note TEXT,
  payment_id INT DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY account_id (account_id),
  KEY doctor_id (doctor_id),
  KEY date (date),
  KEY status (status),
  KEY is_waitlist (is_waitlist)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- payments 表
CREATE TABLE payments (
  id INT NOT NULL AUTO_INCREMENT,
  account_id INT NOT NULL,
  order_id INT DEFAULT NULL,
  amount DECIMAL(10,2) NOT NULL,
  currency VARCHAR(10) DEFAULT 'CNY',
  status VARCHAR(20) DEFAULT 'created',
  provider_info JSON DEFAULT NULL,
  paid_at TIMESTAMP NULL DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY account_id (account_id),
  KEY order_id (order_id),
  KEY status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 插入测试数据
INSERT INTO departments (id, name, code) VALUES 
(1, '内科', 'NEIKE'),
(2, '外科', 'WAIKE'),
(3, '儿科', 'ERKE'),
(4, '妇产科', 'FUCHANKE');

INSERT INTO doctors (id, name, department_id, title) VALUES 
(1, '张医生', 1, '主任医师'),
(2, '李医生', 1, '副主任医师'),
(3, '王医生', 2, '主任医师'),
(4, '赵医生', 3, '主治医师');

SET @next_week = DATE_ADD(CURDATE(), INTERVAL 7 DAY);

INSERT INTO doctor_availability (doctor_id, date, slot, capacity, booked) VALUES 
(1, @next_week, '8-10', 20, 5),
(1, @next_week, '10-12', 20, 20),
(2, @next_week, '14-16', 10, 3);
`;

    connection.query(sql, (error, results) => {
      if (error) {
        console.error('❌ 重建数据库失败:', error.message);
        reject(error);
      } else {
        console.log('🎉 测试数据库重建完成！');
        console.log('📊 数据库名称: hospital_test');
        console.log('📅 测试排班日期: 7天后');
        
        // 验证创建结果
        connection.query('SHOW TABLES', (err, tables) => {
          if (err) {
            console.error('❌ 验证表结构失败:', err.message);
          } else {
            console.log(`📊 成功创建 ${tables.length} 张表:`);
            tables.forEach(table => {
              const tableName = Object.values(table)[0];
              console.log(`  - ${tableName}`);
            });
          }
          connection.end();
          resolve();
        });
      }
    });
  });
}

// 执行
recreateTestDatabase().then(() => {
  console.log('✅ 数据库重建完成，可以运行测试了！');
  console.log('🚀 运行测试: npm run test:integration:fullflow');
}).catch(error => {
  console.error('❌ 数据库重建失败');
  process.exit(1);
});