# Notification Service

轻量通知微服务骨架，演示如何订阅 RabbitMQ 事件并发送通知（示例使用 SMTP）。

启动:

```bash
cd backend/notification-service
npm install
npm start
```

环境变量:
- `MQ_URL` - RabbitMQ 连接字符串
- `SMTP_HOST` `SMTP_PORT` `SMTP_USER` `SMTP_PASS` `SMTP_FROM`

说明:
- 本示例会订阅 `appointment.*`, `waitlist.*`, `visit.*` 事件并调用对应的 provider。
- 持久化使用后端现有 `db` 连接，将写入 `notifications` 表（请先运行 SQL 初始化）。
