const { request } = require('../../../utils/request.js');

Page({
  data: {
    oldPassword: '',
    newPassword: '',
    confirm: ''
  },

  onOldInput(e) {
    this.setData({ oldPassword: e.detail.value });
  },
  onNewInput(e) {
    this.setData({ newPassword: e.detail.value });
  },
  onConfirmInput(e) {
    this.setData({ confirm: e.detail.value });
  },

  async onSubmit() {
    const { oldPassword, newPassword, confirm } = this.data;
    if (!oldPassword || !newPassword || !confirm) {
      wx.showToast({ title: '请填写完整', icon: 'none' });
      return;
    }
    if (newPassword !== confirm) {
      wx.showToast({ title: '两次输入的新密码不一致', icon: 'none' });
      return;
    }
    // 密码规则：至少6位，包含字母和数字
    const pwdRegex = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{6,}$/;
    if (!pwdRegex.test(newPassword)) {
      wx.showToast({ title: '新密码至少6位，且包含字母和数字', icon: 'none' });
      return;
    }

    wx.showLoading({ title: '提交中...' });
    try {
      const res = await request({ url: '/auth/change-password', method: 'POST', data: { oldPassword, newPassword } });
      wx.hideLoading();
      if (res && res.success) {
        wx.showToast({ title: '修改成功', icon: 'success' });
        // 可选：修改密码后退出登录，强制重新登录
        wx.removeStorageSync('token');
        setTimeout(() => {
          wx.reLaunch({ url: '/pages/login/login' });
        }, 800);
      } else {
        wx.showToast({ title: res.message || '修改失败', icon: 'none' });
      }
    } catch (err) {
      wx.hideLoading();
      const msg = (err && err.body && err.body.message) ? err.body.message : '网络或服务错误';
      wx.showToast({ title: msg, icon: 'none' });
    }
  }
});
