// pages/book/book.js
const { request } = require('../../utils/request');

Page({
  data: {
    departments: [],
    // deptOptions: [], // Removed
    // deptIndex: 0,    // Removed
    selectedDept: { name: '' }, // Added
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
    isLoading: false, // Changed default to false as we don't load depts on load
    currentStep: 1, 
  },

  onLoad() {
    // this.loadDepartments(); // Removed
  },

  onShow() {
    const selectedDept = wx.getStorageSync('selectedDepartment');
    if (selectedDept) {
      if (typeof selectedDept === 'object' && selectedDept.id) {
        this.setData({
          selectedDept: selectedDept,
          currentStep: 2,
          doctors: [], 
          doctorIndex: 0,
          doctorsNames: []
        });
        wx.removeStorageSync('selectedDepartment');
        this.loadDoctorsForDept(selectedDept.id);
      } else {
         wx.removeStorageSync('selectedDepartment');
      }
    }
  },

  goToDepartment() {
    wx.navigateTo({
      url: '/pages/deptPick/deptPick',
    });
  },

  async loadDoctorsForDept(deptId) {
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

  // Removed loadDepartments and onDeptChange


  onDoctorChange(e) {
    wx.vibrateShort({ type: 'light' });
    this.setData({ doctorIndex: e.detail.value, currentStep: 3 });
  },

  onDateChange(e) {
    wx.vibrateShort({ type: 'light' });
    this.setData({ date: e.detail.value });
  },

  onSlotChange(e) {
    wx.vibrateShort({ type: 'light' });
    this.setData({ slotIndex: e.detail.value, currentStep: 4 });
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
    const dep = this.data.departments[this.data.deptIndex];
    const doc = this.data.doctors[this.data.doctorIndex];
    const date = this.data.date;
    const slot = this.data.slots[this.data.slotIndex] && this.data.slots[this.data.slotIndex].value;

    // 统一校验
    let step = 1;
    let errorMsg = '';
    if (!dep || !dep.id) { errorMsg = '请选择科室'; step = 1; }
    else if (!doc || !doc.id) { errorMsg = '请选择医生'; step = 2; }
    else if (!date) { errorMsg = '请选择日期'; step = 3; }
    else if (!slot) { errorMsg = '请选择时段'; step = 4; }

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