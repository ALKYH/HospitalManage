const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const registrationRoutes = require('./routes/registration');
const paymentRoutes = require('./routes/payment');
const authRoutes = require('./routes/authRoutes');
const patientRoutes = require('./routes/patient');
const doctorRoutes = require('./routes/doctor');
const mqRoutes = require('./routes/mq');
const mq = require('./mq');
const orderSubscriber = require('./mq/subscriber');
const adminRoutes = require('./routes/admin');
const path = require('path');
const adminService = require('./services/adminService');
const publicRoutes = require('./routes/public');

const app = express();

// 允许跨域（仅用于本地调试，生产应更严格设置）
app.use(cors({ origin: true, credentials: true }));
app.use(bodyParser.json());

app.use('/api/registration', registrationRoutes);
app.use('/api/payment', paymentRoutes);
app.use('/auth', authRoutes);
app.use('/api/patient', patientRoutes);
app.use('/api/doctor', doctorRoutes);
app.use('/api/mq', mqRoutes);
// Admin static UI
app.use('/admin', express.static(path.join(__dirname, 'admin')));
// Admin API
app.use('/api/admin', adminRoutes);
// Public routes (no auth)
app.use('/api', publicRoutes);

// 可选：在开发环境中运行 ensure_db（检测表并导入 init.sql）
// 如果不是生产环境，则默认尝试初始化数据库结构，便于开发环境自动创建缺失表
if (process.env.NODE_ENV !== 'production') {
  process.env.ENSURE_DB = 'true';
}
if (process.env.ENSURE_DB === 'true') {
  try {
    console.log('ENSURE_DB=true, running ensure_db...');
    require('./scripts/ensure_db');
  } catch (err) {
    console.error('Failed to run ensure_db', err);
  }
}

app.get('/', (req, res) => {
  res.json({ success: true, message: 'Hospital Registration API Running' });
});

// 全局错误处理中间件：返回 JSON，避免 HTML 错误页
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  const status = err.status || 500;
  res.status(status).json({ success: false, message: err.message || 'Internal Server Error' });
});

const port = process.env.PORT || 3000;
const ip = '0.0.0.0';

// 启动过程：优先初始化 MQ 连接并注册基础订阅，然后启动 HTTP 服务
(async () => {
  try {
    // Ensure auxiliary admin tables exist before starting
    try {
      await adminService.ensureTables();
      console.log('Admin auxiliary tables ensured');
    } catch (tblErr) {
      console.warn('Failed to ensure admin tables', tblErr.message);
    }

    await mq.connect();

    // 注册一个通用的订单事件订阅（示例：只是打印并为后续扩展预留挂钩）
    try {
      await orderSubscriber.registerOrderSubscriber('order.#', async (body, meta) => {
        console.log('Received MQ event', meta.routingKey, body);
        // TODO: 根据 routingKey 分发到不同服务（通知、审计、统计等）
        // 示例占位：如果是 order.cancelled，可以触发历史记录或通知
      });
      console.log('Order subscriber registered for order.#');
    } catch (subErr) {
      console.warn('Failed to register order subscriber', subErr.message);
    }

    // 初始化示例消费者：通知服务（写入 notifications 表）
    try {
      const notificationConsumer = require('./consumers/notificationConsumer');
      await notificationConsumer.init();
    } catch (ncErr) {
      console.warn('Failed to init notification consumer', ncErr.message);
    }

    app.listen(port, ip, () => {
      console.log(`The Server running on http://${ip}:${port}`);
    });
  } catch (err) {
    console.error('Failed to initialize MQ or start server', err);
    process.exit(1);
  }
})();
