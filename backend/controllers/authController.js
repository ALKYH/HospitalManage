const AuthService = require('../services/authService');

const AuthController = {
  async register(req, res) {
    try {
      const { username, password } = req.body;
      const result = await AuthService.register(username, password);
      res.status(201).json({ success: true, data: result, message: '注册成功' });
    } catch (err) {
      res.status(400).json({ success: false, message: err.message });
    }
  },

  async login(req, res) {
    try {
      const { username, password } = req.body;
      console.log('Login attempt:', req.body.username);
      const result = await AuthService.login(username, password);
      res.status(200).json({ success: true, data: result.data, message: '登录成功' });
    } catch (err) {
      console.log('Login error:', err.message);
      res.status(401).json({ success: false, message: err.message });
    }
  }
};

module.exports = AuthController;
