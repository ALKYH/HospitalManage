// pages/register/register.js
Page({
  data: {
    registerRange: ['普通号','专家号','特需号'],
    doctors: [],
    selectedDept: '请选择科室',
    selectedDoctor: '请选择医生',
    selectedRegi:'请选择号别',
    message: ''
  },
  onShow() {
    const selected = wx.getStorageSync('selectedDepartment');
    if (selected) {
      this.setData({
        selectedDept: selected
      });
      wx.removeStorageSync('selectedDepartment'); // 用完后清除缓存
    }
  },
  goToDepartment() {
    wx.navigateTo({
      url: '/pages/deptPick/deptPick'
    });
  },
  onRegiChange: function(e) {
    const index = e.detail.value;
    const regi = this.data.registerRange[index];
    this.setData({
      selectedRegi: regi,
    });
  },
  onDateSelected(e) {
    const { date } = e.detail
    console.log('用户选择的挂号日期:', date)
    wx.showToast({
      title: `已选择：${date}`,
      icon: 'success'
    })
    // TODO: 这里可以根据日期查询医生排班
  },
  onDoctorSelected(e) {
    const { doctor } = e.detail;
    this.setData({ selectedDoctor: doctor });
    console.log('已选择医生:', doctor);
  },

  onDeptChange: function(e) {

  },

  onDoctorChange: function(e) {
    const index = e.detail.value;
    const doctor = this.data.doctors[index];
    this.setData({
      selectedDoctor: doctor
    });
  },



  register: async function() {
    const { request } = require('../../utils/request');
    if (this.data.selectedDoctor === '请选择医生') {
      this.setData({ message: '请选医生后再挂号' });
      return;
    }

    // 临时从缓存中读取 account_id（实际需登录后写入）
    const account_id = wx.getStorageSync('account_id') || 1;

    const payload = {
      account_id,
      department_id: (this.data.selectedDept && this.data.selectedDept.id) ? this.data.selectedDept.id : null,
      doctor_id: (this.data.selectedDoctor && this.data.selectedDoctor.id) ? this.data.selectedDoctor.id : null,
      date: wx.getStorageSync('selectedDate') || null,
      slot: this.data.selectedRegi || null,
      note: ''
    };

    try {
      const res = await request({ url: '/api/registration/create', method: 'POST', data: payload });
      if (res && res.success) {
        wx.showToast({ title: '挂号成功', icon: 'success' });
        this.setData({ message: `挂号成功：${res.data.id} 状态:${res.data.status}` });
      } else {
        wx.showToast({ title: (res && res.message) ? res.message : '挂号失败', icon: 'none' });
        this.setData({ message: (res && res.message) ? res.message : '挂号失败' });
      }
    } catch (err) {
      console.error('register error', err);
      const msg = (err && err.body && err.body.message) ? err.body.message : (err && err.error && err.error.errMsg) ? err.error.errMsg : '网络或服务错误';
      wx.showToast({ title: msg, icon: 'none' });
      this.setData({ message: msg });
    }
  }
});
