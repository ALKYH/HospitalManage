const AuthService = require('../services/authService');

const AuthController = {
  async register(req, res) {
    try {
      const { username, password } = req.body;
      // 后端校验：密码至少6位且同时包含字母和数字
      const pwdRegex = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{6,}$/;
      if (!password || !pwdRegex.test(password)) {
        throw new Error('密码应至少6位，且包含字母和数字');
      }
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

AuthController.changePassword = async (req, res) => {
  try {
    const userId = req.user && req.user.id;
    if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });
    const { oldPassword, newPassword } = req.body || {};
    if (!oldPassword || !newPassword) return res.status(400).json({ success: false, message: '需要 oldPassword 与 newPassword' });
    // 新密码规则：至少6位，包含字母和数字
    const pwdRegex = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{6,}$/;
    if (!pwdRegex.test(newPassword)) return res.status(400).json({ success: false, message: '新密码应至少6位，且包含字母和数字' });
    await AuthService.changePassword(userId, oldPassword, newPassword);
    res.json({ success: true });
  } catch (err) {
    console.error('changePassword error', err.message);
    res.status(400).json({ success: false, message: err.message });
  }
};
