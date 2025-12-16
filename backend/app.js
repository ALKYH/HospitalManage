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
const path = require('path');
const aiRoutes = require('./routes/aiRoutes');
const publicRoutes = require('./routes/public'); 
// 导入 Swagger 配置
const { swaggerServe, swaggerSetup } = require('./swagger/swagger.setup');
const app = express();

// 允许跨域（仅用于本地调试，生产应更严格设置）
app.use(cors({ origin: true, credentials: true }));
app.use(bodyParser.json());
// 健康检查端点
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'hospital-management-api',
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development'
  });
});

// API 文档路由 - 放在其他路由之前
app.use('/api-docs', swaggerServe, swaggerSetup);
app.get('/docs', (req, res) => {
  res.redirect('/api-docs');
});

app.use('/api/registration', registrationRoutes);
app.use('/api/payment', paymentRoutes);
app.use('/api/auth', authRoutes);
// 向后兼容：旧版客户端可能直接请求 /auth
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
app.use('/api/public', publicRoutes); 

app.get('/', (req, res) => {
  res.json({ success: true, message: 'Hospital Registration API Running' });
});

// 404 处理
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: '路由不存在',
    path: req.originalUrl,
    available_routes: [
      '/api-docs - API 文档',
      '/api/auth - 认证相关',
      '/api/doctor - 医生相关',
      '/api/patient - 患者相关',
      '/api/admin - 管理员相关'
    ]
  });
});

// // 全局错误处理中间件：返回 JSON，避免 HTML 错误页
// app.use((err, req, res, next) => {
//   console.error('Unhandled error:', err);
//   const status = err.status || 500;
//   res.status(status).json({ success: false, message: err.message || 'Internal Server Error' });
// });
// 全局错误处理
app.use((err, req, res, next) => {
  console.error('服务器错误:', err.stack);
  
  const statusCode = err.statusCode || 500;
  const message = process.env.NODE_ENV === 'development' 
    ? err.message 
    : '服务器内部错误';
  
  res.status(statusCode).json({
    success: false,
    message,
    ...(process.env.NODE_ENV === 'development' && { 
      stack: err.stack,
      details: err 
    })
  });
});

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || 'localhost';

app.listen(PORT, HOST, () => {
  console.log(`🚀 服务器运行在 http://${HOST}:${PORT}`);
  console.log(`📚 API 文档: http://${HOST}:${PORT}/api-docs`);
  console.log(`🩺 健康检查: http://${HOST}:${PORT}/health`);
  console.log(`⚙️  环境: ${process.env.NODE_ENV || 'development'}`);
});

module.exports = app;
