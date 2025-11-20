// pages/profileForm/profileForm.js
Page({
  data: {
    role: 'student',
    genderOptions: ['男', '女'],
    gender: '',
    name: '',
    employeeId: '', // 学号 / 工号
    idNumber: '',   // 身份证号
    phone: '',
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
            employeeId: (p.extra && p.extra.employeeId) || '',
            idNumber: p.idcard || '',
            phone: p.phone || '',
            gender: p.gender || '',
            history: (p.extra && p.extra.history) || '',
            role: (p.extra && p.extra.role) || this.data.role,
            hasProfile: true,
            editMode: false
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
  onEmployeeIdInput(e) { this.setData({ employeeId: e.detail.value }); },
  onIdNumberInput(e) { this.setData({ idNumber: e.detail.value }); },
  onTelInput(e) { this.setData({ phone: e.detail.value }); },
  onGenderChange(e) { this.setData({ gender: this.data.genderOptions[e.detail.value] }); },
  onHistoryInput(e) { this.setData({ history: e.detail.value }); },

  onSubmit() {
    const { employeeId, name, idNumber, gender, history, role, phone } = this.data;
    if (!employeeId || !name || !idNumber || !gender || !phone) {
      wx.showToast({ title: '请填写完整信息', icon: 'none' });
      return;
    }
    if (!/^\d{11}$/.test(String(phone).trim())) {
      wx.showToast({ title: '手机号需为11位数字', icon: 'none' });
      return;
    }

    const { request } = require('../../utils/request');
    const payload = {
      employeeId,
      display_name: name || '',
      idNumber,            // 身份证号（用于后端三字段匹配）
      idcard: idNumber,    // 数据库存储字段
      phone,               // 顶层提供便于后端校验
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
        wx.showToast({ title: '请核对信息是否正确', icon: 'none' });
      });
  },

  // ✅ 新增：切换到编辑模式
  enterEditMode() {
    this.setData({ editMode: true });
  }
});
