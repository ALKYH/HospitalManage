-- notifications 表与 templates 示例
CREATE TABLE IF NOT EXISTS notification_templates (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(128) NOT NULL,
  event_type VARCHAR(128) NOT NULL,
  channel VARCHAR(32) NOT NULL,
  locale VARCHAR(8) DEFAULT 'zh-CN',
  subject TEXT,
  body TEXT,
  variables TEXT,
  enabled TINYINT(1) DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS notifications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  event_id VARCHAR(128),
  event_type VARCHAR(128),
  recipient_id VARCHAR(64),
  recipient_addr VARCHAR(256),
  channel VARCHAR(32),
  template VARCHAR(128),
  status VARCHAR(32) DEFAULT 'pending',
  attempts INT DEFAULT 0,
  last_error TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  sent_at DATETIME NULL
);
