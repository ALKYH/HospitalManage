
CREATE DATABASE IF NOT EXISTS hospital CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;
USE hospital;

-- 1. 账号表（登录/鉴权）
CREATE TABLE accounts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(100) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('user','admin','doctor') DEFAULT 'user',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 2. 个人档案（Profile）与 Account 一对一
CREATE TABLE profiles (
  id INT AUTO_INCREMENT PRIMARY KEY,
  account_id INT NOT NULL UNIQUE,
  display_name VARCHAR(100),
  email VARCHAR(255) NULL,
  phone VARCHAR(30),
  gender ENUM('M','F'),
  birthday DATE NULL,
  address VARCHAR(255) NULL,
  idcard VARCHAR(64) NULL,
  extra JSON NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
);

-- 3. 科室（Department）
CREATE TABLE departments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  code VARCHAR(50) UNIQUE NULL,
  parent_id INT NULL, -- 支持二级/多级结构（parent_id=NULL 表示主科室）
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (parent_id) REFERENCES departments(id) ON DELETE SET NULL
);

-- 4. 医生表
CREATE TABLE doctors (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  account_id INT NULL, -- 若医生也有登录账号
  department_id INT,
  title VARCHAR(100),
  bio TEXT,
  contact VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL,
  FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE SET NULL
);

-- 5. 医生排班/空闲时间（以日为粒度+时段，capacity 可用于候补逻辑）
CREATE TABLE doctor_availability (
  id INT AUTO_INCREMENT PRIMARY KEY,
  doctor_id INT NOT NULL,
  date DATE NOT NULL,
  slot ENUM('8-10','10-12','14-16','16-18')NOT NULL,
  capacity INT DEFAULT 1, -- 当日该时段可预约名额
  booked INT DEFAULT 0,   -- 已被预约的数量
  extra JSON NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY ux_doc_date_slot (doctor_id, date, slot),
  FOREIGN KEY (doctor_id) REFERENCES doctors(id) ON DELETE CASCADE
);

-- 支付表（payments）：保存模拟/真实支付记录
CREATE TABLE payments (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  account_id INT NOT NULL,
  order_id BIGINT NULL,
  amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  currency VARCHAR(10) DEFAULT 'CNY',
  status ENUM('created','paid','failed','refunded') DEFAULT 'created',
  provider_info JSON NULL,
  paid_at DATETIME NULL, --新增
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
);


-- 6. 挂号订单（orders / registrations）
CREATE TABLE orders (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  account_id INT NOT NULL,     -- 谁下单（用户）
  department_id INT NULL,
  sub_department_id INT NULL,
  doctor_id INT NULL,          -- 若用户指定医生
  availability_id INT NULL,    -- 被分配的 availability id（若已分配）
  date DATE NOT NULL,
  slot ENUM('8-10','10-12','14-16','16-18') NOT NULL,
  is_waitlist BOOLEAN DEFAULT FALSE, -- 是否候补
  priority INT DEFAULT 0,      -- 候补优先级
  status ENUM('pending','confirmed','waiting','cancelled','completed') DEFAULT 'pending',
  queue_number INT NULL,
  note TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  payment_id BIGINT NULL, --新增
  FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
  FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL,
  FOREIGN KEY (sub_department_id) REFERENCES departments(id) ON DELETE SET NULL,
  FOREIGN KEY (doctor_id) REFERENCES doctors(id) ON DELETE SET NULL,
  FOREIGN KEY (availability_id) REFERENCES doctor_availability(id) ON DELETE SET NULL,
  FOREIGN KEY (payment_id) REFERENCES payments(id) ON DELETE SET NULL, --新增
  INDEX idx_account_status (account_id, status),
  INDEX idx_date_slot (date, slot)
);

-- 7. 订单历史（状态变更日志）
CREATE TABLE order_history (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  order_id BIGINT NOT NULL,
  old_status VARCHAR(50),
  new_status VARCHAR(50),
  action_by INT NULL, -- 操作人 account_id（管理员/系统/doctor）
  comment TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
);

-- 8. 通知记录（Push）
CREATE TABLE notifications (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  account_id INT NOT NULL,
  event_type VARCHAR(50), -- 'waitlist_success','appointment_remind','arrival_remind', ...
  payload JSON NULL,
  delivered BOOLEAN DEFAULT FALSE,
  delivered_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
  INDEX idx_account_event (account_id, event_type)
);

-- 9. 可选：refresh tokens（若使用 refresh token）
CREATE TABLE refresh_tokens (
  id INT AUTO_INCREMENT PRIMARY KEY,
  account_id INT NOT NULL,
  token VARCHAR(255) NOT NULL,
  expires_at DATETIME,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
);


