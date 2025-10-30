// pages/profileForm/profileForm.js
Page({
  data: {
    role: 'student',
    genderOptions: ['男', '女'],
    gender: '',
    name: '',
    idNumber: '',
    idCard: '',
    history: '',
    hasProfile: false, // 是否已有档案
    editMode: false    // 是否处于编辑状态
  },

  onLoad() {
    const { request } = require('../../utils/request');
    wx.showLoading({ title: '加载中...' });

    request({ url: '/api/patient/me', method: 'GET' })
      .then(res => {
        wx.hideLoading();
        if (res && res.success && res.data) {
          const p = res.data;
          this.setData({
            name: p.display_name || '',
            idNumber: p.idcard || '',
            idCard: p.idcard || '',
            gender: p.gender || '',
            history: (p.extra && p.extra.history) || '',
            role: (p.extra && p.extra.role) || this.data.role,
            hasProfile: true,   // ✅ 表示已有档案
            editMode: false     // ✅ 默认查看模式
          });
        }
      })
      .catch(err => {
        wx.hideLoading();
        console.warn('读取 profile 失败', err);
        this.setData({ hasProfile: false, editMode: true }); // 没数据则进入编辑模式
      });
  },

  switchToStudent() {
    this.setData({ role: 'student' });
  },

  switchToTeacher() {
    this.setData({ role: 'teacher' });
  },

  onNameInput(e) { this.setData({ name: e.detail.value }); },
  onIDInput(e) { this.setData({ idNumber: e.detail.value }); },
  onIDCardInput(e) { this.setData({ idCard: e.detail.value }); },
  onGenderChange(e) { this.setData({ gender: this.data.genderOptions[e.detail.value] }); },
  onHistoryInput(e) { this.setData({ history: e.detail.value }); },

  onSubmit() {
    const { idNumber, idCard, gender, history, role } = this.data;
    if (!idNumber || !idCard || !gender) {
      wx.showToast({ title: '请填写完整信息', icon: 'none' });
      return;
    }

    const { request } = require('../../utils/request');
    const payload = {
      display_name: this.data.name || '',
      idNumber,
      idcard: idCard,
      gender,
      extra: { history, role }
    };

    wx.showLoading({ title: '保存中...' });
    request({ url: '/api/patient/submit', method: 'POST', data: payload })
      .then(res => {
        wx.hideLoading();
        if (res && res.success) {
          wx.showToast({ title: '保存成功', icon: 'success' });
          this.setData({ hasProfile: true, editMode: false }); // 保存后进入查看模式
        } else {
          wx.showToast({ title: res?.message || '保存失败', icon: 'none' });
        }
      })
      .catch(err => {
        wx.hideLoading();
        console.error('保存失败', err);
        wx.showToast({ title: '网络或服务错误', icon: 'none' });
      });
  },

  // ✅ 新增：切换到编辑模式
  enterEditMode() {
    this.setData({ editMode: true });
  }
});
