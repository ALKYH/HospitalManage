// pages/login/login.js
const { request } = require('../../utils/request.js');
Page({
  data: {
    username: '',
    password: ''
  },

  onUsernameInput(e) {
    this.setData({ username: e.detail.value });
  },

  onPasswordInput(e) {
    this.setData({ password: e.detail.value });
  },

  async onLogin() {
    const { username, password } = this.data;
    if (!username || !password) {
      wx.showToast({ title: '请输入用户名和密码', icon: 'none' });
      return;
    }

    wx.showLoading({ title: '登录中...' });

    try {
      const res = await request({
        url: '/auth/login',
        method: 'POST',
        data: { username, password }
      });

      wx.hideLoading();

      if (res.success) {
        wx.showToast({ title: '登录成功', icon: 'success' });
        wx.setStorageSync('token', res.token);
        wx.redirectTo({ url: '/pages/home/home' });
      } else {
        wx.showToast({ title: res.message || '登录失败', icon: 'none' });
      }

    } catch (error) {
      wx.hideLoading();
      console.error('登录失败:', error);
      wx.showToast({ title: '网络错误，请重试', icon: 'none' });
    }
  
  },

  onRegister() {
    wx.navigateTo({ url: '/pages/registerUser/registerUser' });
  },

  onForgetPwd() {
    wx.navigateTo({ url: '/pages/forget/forget' });
  }
});
