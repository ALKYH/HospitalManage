module.exports = {
  db: {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '123456',
    database: process.env.DB_NAME || 'hospital'
  },
  port: process.env.PORT || 3000,
  jwtSecret: process.env.JWT_SECRET || 'change_this_secret',
  deepseek: {
    apiKey: process.env.DEEPSEEK_API_KEY || 'sk-YOUR_DEEPSEEK_API_KEY_HERE',//填写测试用API Key
    apiUrl: process.env.DEEPSEEK_API_URL || 'https://api.deepseek.com/chat/completions',
    model: process.env.DEEPSEEK_MODEL || 'deepseek-chat'
  }
};
