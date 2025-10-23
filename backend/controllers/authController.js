const AuthService = require('../services/authService');

const AuthController = {
  async register(req, res) {
    try {
      const { username, password } = req.body;
      const result = await AuthService.register(username, password);
      res.status(201).json({ message: '注册成功', user: result });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  },

  async login(req, res) {
    try {
      const { username, password } = req.body;
      console.log('Login attempt:', req.body.username);
      const result = await AuthService.login(username, password);
      res.status(200).json({ message: '登录成功', ...result });
    } catch (err) {
      console.log('Login error:', err.message);
      res.status(401).json({ error: err.message });
    }
  }
};

module.exports = AuthController;
