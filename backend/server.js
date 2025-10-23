const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const registrationRoutes = require('./routes/registration');
const authRoutes = require('./routes/authRoutes');

const app = express();

// 允许跨域（仅用于本地调试，生产应更严格设置）
app.use(cors({ origin: true, credentials: true }));
app.use(bodyParser.json());

app.use('/api/registration', registrationRoutes);
app.use('/auth', authRoutes);

// 可选：在开发环境中运行 ensure_db（检测表并导入 init.sql）
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
app.listen(port, ip, () => {
  console.log(`The Server running on http://${ip}:${port}`);
});
