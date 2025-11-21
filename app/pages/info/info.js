// pages/profileForm/profileForm.js
Page({
  data: {
    role: 'student',
    genderOptions: ['男', '女'],
    gender: '',
    name: '',
    idNumber: '',
    idCard: '',
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
            // 学号/工号优先从 extra 中的 employeeId/ studentId 获取，再退回到顶层可能存在的字段
            idNumber: (p.extra && (p.extra.employeeId || p.extra.studentId)) || p.employeeId || '',
            idCard: p.idcard || '',
            // 如果 phone 被存在 extra 中，也进行兼容读取
            phone: p.phone || (p.extra && p.extra.phone) || '',
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
  onTelInput(e) { this.setData({ phone: e.detail.value }); },
  onGenderChange(e) { this.setData({ gender: this.data.genderOptions[e.detail.value] }); },
  onHistoryInput(e) { this.setData({ history: e.detail.value }); },

  onSubmit() {
    const { idNumber, idCard, gender, history, role, phone, name } = this.data;
    if (!idNumber || !idCard || !gender || !phone || !name) {
      wx.showToast({ title: '请填写完整信息（学/工号、姓名、身份证、手机号等）', icon: 'none' });
      return;
    }
    // 手机 11 位数字校验
    if (!/^\d{11}$/.test(String(phone))) {
      wx.showToast({ title: '手机号需为11位数字', icon: 'none' });
      return;
    }

    const { request } = require('../../utils/request');
    // 兼容性处理：为了通过后端的验证，同时把学/工号保存在 extra 以便持久化展示
    const payload = {
      display_name: this.data.name || '',
      // 保留顶层 idNumber 字段供后端 verify 使用
      idNumber: idNumber || '',
      // 身份证写到顶层列 idcard
      idcard: idCard || '',
      // phone 需要写顶层以便后续读取
      phone: phone || '',
      gender,
      // 将更多自定义字段放入 extra（持久化 student/employee id 与历史记录、role）
      extra: Object.assign({}, { history, role }, { employeeId: idNumber, phone })
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
