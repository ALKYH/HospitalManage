const { request } = require('../../utils/request.js');
Page({
  data: {
    username: '',
    password: '',
    confirm: ''
  },

  onUsernameInput(e) {
    this.setData({ username: e.detail.value });
  },

  onPasswordInput(e) {
    this.setData({ password: e.detail.value });
  },

  onConfirmInput(e) {
    this.setData({ confirm: e.detail.value });
  },

  async onRegister() {
    const { username, password, confirm } = this.data;
    if (!username || !password) {
      wx.showToast({ title: '请输入用户名和密码', icon: 'none' });
      return;
    }
    if (password !== confirm) {
      wx.showToast({ title: '两次输入密码不一致', icon: 'none' });
      return;
    }

    // 密码需要至少6位，并同时包含字母和数字
    const pwdRegex = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{6,}$/;
    if (!pwdRegex.test(password)) {
      wx.showToast({ title: '密码至少6位，且包含字母和数字', icon: 'none' });
      return;
    }

    wx.showLoading({ title: '注册中...' });
    try {
      const res = await request({ url: '/auth/register', method: 'POST', data: { username, password } });
      wx.hideLoading();
      if (res && res.success) {
        wx.showToast({ title: '注册成功', icon: 'success' });
        // 可将用户信息存储并跳转登录
        wx.redirectTo({ url: '/pages/login/login' });
      } else {
        wx.showToast({ title: res.message || '注册失败', icon: 'none' });
      }
    } catch (err) {
      wx.hideLoading();
      console.error('register err', err);
      const msg = (err && err.body && err.body.message) ? err.body.message : '网络或服务错误';
      wx.showToast({ title: msg, icon: 'none' });
    }
  }
});
