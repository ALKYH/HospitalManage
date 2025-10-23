const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const AccountModel = require('../schemas/accountModels');

const SECRET = '1234567890abcdef';

const AuthService = {
  async register(username, password) {
    const existing = await AccountModel.findByUsername(username);
    if (existing) console.log('Registration attempt with existing username:', username);
    if (existing) throw new Error('用户名已存在');

    const hash = await bcrypt.hash(password, 10);
    const userId = await AccountModel.create(username, hash);
    return { id: userId, username };
  },

  async login(username, password) {
    const user = await AccountModel.findByUsername(username);
    if (!user) console.log('User not found for login:', user);
    if (!user) throw new Error('用户不存在');

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) console.log('Invalid password attempt for user:', username);
    if (!valid) throw new Error('密码错误');

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      SECRET,
      { expiresIn: '2h' }
    );
    return { token, role: user.role };
  }
};

module.exports = AuthService;
