module.exports = {
  db: {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'Really0733251',
    database: process.env.DB_NAME || 'hospital',
    // set DB_SSL=true in production if your cloud provider requires SSL
    ssl: (process.env.DB_SSL === 'true' || process.env.DB_SSL === '1') || false
  },
  port: process.env.PORT || 3000,
  jwtSecret: process.env.JWT_SECRET || 'change_this_secret',
  deepseek: {
    apiKey: process.env.DEEPSEEK_API_KEY || 'API_KEY',//填写测试用API Key
    apiUrl: process.env.DEEPSEEK_API_URL || 'https://api.deepseek.com/chat/completions',
    model: process.env.DEEPSEEK_MODEL || 'deepseek-chat'
  }
};
