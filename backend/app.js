const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const registrationRoutes = require('./routes/registration');
const paymentRoutes = require('./routes/payment');
const authRoutes = require('./routes/authRoutes');
const patientRoutes = require('./routes/patient');
const doctorRoutes = require('./routes/doctor');
const mqRoutes = require('./routes/mq');
const notifyRoutes = require('./routes/notify');
const adminRoutes = require('./routes/admin');
const publicRoutes = require('./routes/public');
const path = require('path');
const aiRoutes = require('./routes/aiRoutes');

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
app.use('/api/notify', notifyRoutes);
app.use('/api/ai', aiRoutes);
// Admin static UI
app.use('/admin', express.static(path.join(__dirname, 'admin')));
// Admin API
app.use('/api/admin', adminRoutes);
// Public routes (no auth)
app.use('/api', publicRoutes);

app.get('/', (req, res) => {
  res.json({ success: true, message: 'Hospital Registration API Running' });
});

// 全局错误处理中间件：返回 JSON，避免 HTML 错误页
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  const status = err.status || 500;
  res.status(status).json({ success: false, message: err.message || 'Internal Server Error' });
});

module.exports = app;
