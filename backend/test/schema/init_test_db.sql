-- 创建测试数据库
CREATE DATABASE IF NOT EXISTS `hospital_test`;
USE `hospital_test`;

-- accounts 表（用于认证测试）
CREATE TABLE `accounts` (
  `id` int NOT NULL AUTO_INCREMENT,
  `username` varchar(50) NOT NULL,
  `password_hash` varchar(255) NOT NULL,
  `role` varchar(20) DEFAULT 'user',
  `email` varchar(100) DEFAULT NULL,
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `username` (`username`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- departments 表（科室）
CREATE TABLE `departments` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(100) NOT NULL,
  `code` varchar(50) DEFAULT NULL,
  `description` text,
  `parent_id` int DEFAULT NULL,
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- doctors 表（医生）
CREATE TABLE `doctors` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(100) NOT NULL,
  `account_id` int DEFAULT NULL,
  `department_id` int NOT NULL,
  `title` varchar(100) DEFAULT NULL,
  `bio` text,
  `contact` varchar(50) DEFAULT NULL,
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `department_id` (`department_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- doctor_availability 表（医生排班）
CREATE TABLE `doctor_availability` (
  `id` int NOT NULL AUTO_INCREMENT,
  `doctor_id` int NOT NULL,
  `date` date NOT NULL,
  `slot` varchar(10) NOT NULL,
  `capacity` int DEFAULT 20,
  `booked` int DEFAULT 0,
  `extra` json DEFAULT NULL,
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `doctor_date_slot` (`doctor_id`, `date`, `slot`),
  KEY `doctor_id` (`doctor_id`),
  KEY `date` (`date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- orders 表（挂号订单）
CREATE TABLE `orders` (
  `id` int NOT NULL AUTO_INCREMENT,
  `account_id` int NOT NULL,
  `department_id` int NOT NULL,
  `doctor_id` int NOT NULL,
  `availability_id` int DEFAULT NULL,
  `date` date NOT NULL,
  `slot` varchar(10) NOT NULL,
  `status` varchar(20) DEFAULT 'pending',
  `is_waitlist` tinyint(1) DEFAULT 0,
  `priority` int DEFAULT 0,
  `queue_number` int DEFAULT NULL,
  `note` text,
  `payment_id` int DEFAULT NULL,
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `account_id` (`account_id`),
  KEY `doctor_id` (`doctor_id`),
  KEY `date` (`date`),
  KEY `status` (`status`),
  KEY `is_waitlist` (`is_waitlist`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- payments 表（支付）
CREATE TABLE `payments` (
  `id` int NOT NULL AUTO_INCREMENT,
  `account_id` int NOT NULL,
  `order_id` int DEFAULT NULL,
  `amount` decimal(10,2) NOT NULL,
  `currency` varchar(10) DEFAULT 'CNY',
  `status` varchar(20) DEFAULT 'created',
  `provider_info` json DEFAULT NULL,
  `paid_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `account_id` (`account_id`),
  KEY `order_id` (`order_id`),
  KEY `status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 插入测试数据
INSERT INTO `departments` (`id`, `name`, `code`) VALUES 
(1, '内科', 'NEIKE'),
(2, '外科', 'WAIKE'),
(3, '儿科', 'ERKE'),
(4, '妇产科', 'FUCHANKE');

INSERT INTO `doctors` (`id`, `name`, `department_id`, `title`) VALUES 
(1, '张医生', 1, '主任医师'),
(2, '李医生', 1, '副主任医师'),
(3, '王医生', 2, '主任医师'),
(4, '赵医生', 3, '主治医师');

-- 为张医生插入排班（有剩余号源）
INSERT INTO `doctor_availability` (`doctor_id`, `date`, `slot`, `capacity`, `booked`) VALUES 
(1, DATE_ADD(CURDATE(), INTERVAL 7 DAY), '8-10', 20, 5),  -- 剩余15个号源
(1, DATE_ADD(CURDATE(), INTERVAL 7 DAY), '10-12', 20, 20); -- 已满（测试候补）

-- 为李医生插入排班
INSERT INTO `doctor_availability` (`doctor_id`, `date`, `slot`, `capacity`, `booked`) VALUES 
(2, DATE_ADD(CURDATE(), INTERVAL 7 DAY), '14-16', 10, 3); -- 剩余7个号源