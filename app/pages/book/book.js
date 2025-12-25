// pages/book/book.js
const { request } = require('../../utils/request');

Page({
  data: {
    selectedDept: {},
    doctors: [],
    doctorIndex: 0,
    doctorsNames: [],
    date: '',
    slotIndex: 0,
    slots: [
      { label: '上午 08:00-10:00', value: '8-10' },
      { label: '上午 10:00-12:00', value: '10-12' },
      { label: '下午 14:00-16:00', value: '14-16' },
      { label: '下午 16:00-18:00', value: '16-18' }
    ],
    slotsLabels: ['上午 08:00-10:00','上午 10:00-12:00','下午 14:00-16:00','下午 16:00-18:00'],
    minDate: (new Date()).toISOString().slice(0,10),
    message: '',
    isLoading: false, 
    currentStep: 1, 
    availability: []
  },

  onLoad() {
    this.generateAvailability();
  },

  generateAvailability() {
    const list = [];
    const today = new Date();
    for (let i = 0; i < 14; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      const dateStr = d.toISOString().slice(0, 10);
      ['8-10', '10-12', '14-16', '16-18'].forEach(slot => {
        list.push({
          date: dateStr,
          slot: slot,
          capacity: 1,
          booked: 0
        });
      });
    }
    this.setData({ availability: list });
  },

  onTimeSelected(e) {
    const { date, time } = e.detail || {};
    if (date && time) {
       const map = {
        '上午 08:00-10:00': '8-10',
        '上午 10:00-12:00': '10-12',
        '下午 14:00-16:00': '14-16',
        '下午 16:00-18:00': '16-18'
      };
      const slot = map[time] || null;
      const slotIdx = this.data.slots.findIndex(s => s.value === slot);
      this.setData({ date: date, slotIndex: slotIdx });
    }
  },

  onShow() {
    const selectedDept = wx.getStorageSync('selectedDepartment');
    if (selectedDept && selectedDept.id) {
        if (!this.data.selectedDept || this.data.selectedDept.id !== selectedDept.id) {
            this.setData({ 
                selectedDept: selectedDept,
                doctors: [], 
                doctorIndex: 0, 
                doctorsNames: [],
                currentStep: 2 
            });
            this.loadDoctors(selectedDept.id);
        }
        wx.removeStorageSync('selectedDepartment');
    }
  },

  goToDepartment() {
    wx.navigateTo({ url: '/pages/deptPick/deptPick' });
  },

  async loadDoctors(deptId) {
      try {
        wx.showLoading({ title: '加载医生中', mask: true });
        const r = await request({ url: `/api/doctor?department_id=${deptId}`, method: 'GET' });
        wx.hideLoading();
        if (r && r.success) {
          const docs = r.data || [];
          this.setData({ doctors: docs, doctorsNames: docs.map(d => d.name), message: '' });
        } else {
            this.setData({ doctors: [], doctorsNames: [], message: '该科室暂无医生' });
        }
      } catch (err) { 
          wx.hideLoading();
          console.error('load doctors err', err);
          this.setData({ doctors: [], doctorsNames: [], message: '加载医生失败' }); 
      }
  },

  onDoctorChange(e) {
    wx.vibrateShort({ type: 'light' });
    this.setData({ doctorIndex: e.detail.value, currentStep: 3 });
  },
  
  // 优化点击跳转 step
  onFieldTap(e) {
      const step = parseInt(e.currentTarget.dataset.step, 10);
      // 只有当前步骤已完成，才能跳转到下一个步骤
      if (step <= this.data.currentStep) {
          this.setData({ currentStep: step });
      } else if (step > this.data.currentStep && step === this.data.currentStep + 1) {
          // 允许跳到下一个未完成的步骤
          this.setData({ currentStep: step });
      }
  },

  async submit() {
    wx.vibrateShort({ type: 'medium' });
    const account_id = wx.getStorageSync('account_id');
    if (!account_id) {
      wx.showToast({ title: '请先登录', icon: 'none' });
      return;
    }
    const dep = this.data.selectedDept;
    const doc = this.data.doctors[this.data.doctorIndex];
    const date = this.data.date;
    const slot = this.data.slots[this.data.slotIndex] && this.data.slots[this.data.slotIndex].value;

    // 统一校验
    let step = 1;
    let errorMsg = '';
    if (!dep || !dep.id) { errorMsg = '请选择科室'; step = 1; }
    else if (!doc || !doc.id) { errorMsg = '请选择医生'; step = 2; }
    else if (!date) { errorMsg = '请选择日期'; step = 3; }
    else if (!slot) { errorMsg = '请选择时段'; step = 3; }

    if (errorMsg) {
      wx.showToast({ title: errorMsg, icon: 'none' });
      this.setData({ currentStep: step }); // 跳转到错误步骤
      return;
    }

    const payload = {
      account_id,
      department_id: dep.id,
      doctor_id: doc.id,
      date,
      slot,
      regi_type: '普通号',
      force_waitlist: true // 预约页强制候补
    };

    wx.showLoading({ title: '提交中', mask: true });
    try {
      // Backend probe logic removed to simplify, relying on main request handling errors.
      const res = await request({ url: '/api/registration/create', method: 'POST', data: payload });
      wx.hideLoading();
      
      if (res && res.success) {
        wx.showToast({ title: '预约候补已提交', icon: 'success' });
        // 成功后跳转到候补列表页
        wx.redirectTo({ url: '/pages/appointment/appointment' });
      } else {
        const msg = (res && res.message) ? res.message : '提交失败';
        wx.showToast({ title: msg, icon: 'none' });
        console.warn('createRegistration failed', res);
      }
    } catch (err) {
      wx.hideLoading();
      console.error('submit err', err);
      let message = '网络或服务错误，请检查网络连接';
      wx.showToast({ title: message, icon: 'none' });
    }
  }
});