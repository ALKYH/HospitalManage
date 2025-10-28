// pages/register/register.js
Page({
  data: {
    registerRange: ['普通号','专家号','特需号'],
    doctors: [],
    selectedDept: '请选择科室',
    selectedDoctor: '请选择医生',
    selectedRegi:'请选择号别',
    message: '',
    availability: [],
    availableTypes: {},
    availableTypesList: []
  },
  onShow() {
    const selected = wx.getStorageSync('selectedDepartment');
    if (selected) {
      this.setData({
        selectedDept: selected
      });
      wx.removeStorageSync('selectedDepartment'); // 用完后清除缓存
      // fetch doctors for this department
      this.loadDoctorsForDept(selected.id);
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
    // 根据已选医生查询该医生该日期的可用排班
    const doctor = this.data.selectedDoctor;
    if (doctor && doctor.id) {
      this.loadAvailability(doctor.id, date);
    }
    // 缓存选择的日期
    wx.setStorageSync('selectedDate', date);
  },
  onDoctorSelected(e) {
    const { doctor } = e.detail;
    this.setData({ selectedDoctor: doctor });
    console.log('已选择医生:', doctor);
    // load availability for default date or selectedDate
    const date = wx.getStorageSync('selectedDate') || null;
    if (date) this.loadAvailability(doctor.id, date);
  },

  onDeptChange: function(e) {

  },

  onDoctorChange: function(e) {
    const index = e.detail.value;
    const doctor = this.data.doctors[index];
    this.setData({
      selectedDoctor: doctor
    });
    const date = wx.getStorageSync('selectedDate') || null;
    if (date) this.loadAvailability(doctor.id, date);
  },

  async loadDoctorsForDept(deptId) {
    const { request } = require('../../utils/request');
    try {
      const res = await request({ url: `/api/doctor?department_id=${deptId}`, method: 'GET' });
      if (res && res.success) {
        this.setData({ doctors: res.data });
      }
    } catch (err) {
      console.error('loadDoctorsForDept error', err);
    }
  },

  async loadAvailability(doctorId, date) {
    const { request } = require('../../utils/request');
    try {
      const url = `/api/doctor/${doctorId}/availability` + (date ? `?date=${date}` : '');
      const res = await request({ url, method: 'GET' });
      if (res && res.success) {
        // map availability into selectable slots and available types
        // 简单示例：把第一个 availability 的 available_by_type 转成选择项
        const avail = res.data || [];
        if (avail.length > 0) {
          const first = avail[0];
            // 把 available_by_type 转换为数组方便 WXML 渲染
            const byType = first.available_by_type || {};
            const availableTypesList = Object.keys(byType).map(k => ({ type: k, count: byType[k] }));
            this.setData({ availability: avail, availableTypes: byType, availableTypesList });
        } else {
          this.setData({ availability: [], availableTypes: {} });
            this.setData({ availability: [], availableTypes: {}, availableTypesList: [] });
        }
      }
    } catch (err) {
      console.error('loadAvailability error', err);
    }
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
