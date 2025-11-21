// pages/register/register.js
Page({
  data: {
    registerRange: ['普通号','专家号','特需号'],
    doctors: [],
    selectedDept: '请选择科室',
    selectedDoctor: '请选择医生',
    selectedRegi:'请选择号别',
    // normalized key used to filter availability (e.g. '普通','专家','特需')
    selectedRegiKey: '',
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
    // also check if a doctor was selected from docPick and stored
    const selDoc = wx.getStorageSync('selectedDoctor');
    if (selDoc) {
      this.setData({ selectedDoctor: selDoc });
      wx.removeStorageSync('selectedDoctor');
      // always load availability for the selected doctor (no date filter) to populate datepicker
      if (selDoc && selDoc.id) this.loadAvailability(selDoc.id);
      else if (selDoc && selDoc.name) {
        // if only name supplied (no id), still try to load doctors list to find matching id
        // trigger loadDoctorsForDept if department known
        if (this.data.selectedDept && this.data.selectedDept.id) this.loadDoctorsForDept(this.data.selectedDept.id);
      }
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
    // normalize to key without the trailing '号'
    const key = (regi || '').replace(/号$/, '').trim();
    this.setData({ selectedRegi: regi, selectedRegiKey: key });
  },
  // handle timeSelected event from register-date-picker component
  onTimeSelected(e) {
    const { date, time } = e.detail || {};
    if (date) {
      wx.showToast({ title: `已选择：${date}` });
      // map time label to internal slot enum used by backend
      const map = {
        '上午 08:00-10:00': '8-10',
        '上午 10:00-12:00': '10-12',
        '下午 14:00-16:00': '14-16',
        '下午 16:00-18:00': '16-18'
      };
      const slot = map[time] || null;
      this.setData({ selectedDate: date, selectedSlot: slot });
      wx.setStorageSync('selectedDate', date);
      wx.setStorageSync('selectedSlot', slot);
      // load availability for this doctor/date
      const doctor = this.data.selectedDoctor;
      if (doctor && doctor.id) this.loadAvailability(doctor.id, date);
    }
  },
  onDoctorSelected(e) {
    const { doctor } = e.detail;
    this.setData({ selectedDoctor: doctor });
    console.log('已选择医生:', doctor);
    // always load availability for the selected doctor to populate datepicker
    if (doctor && doctor.id) this.loadAvailability(doctor.id);
  },

  onDeptChange: function(e) {

  },

  onDoctorChange: function(e) {
    const index = e.detail.value;
    const doctor = this.data.doctors[index];
    this.setData({
      selectedDoctor: doctor
    });
    // always load availability when doctor changes (no date filter)
    if (doctor && doctor.id) this.loadAvailability(doctor.id);
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
    // avoid redundant loads for same doctorId+date
    try {
      const key = `${doctorId || ''}::${date || ''}`;
      if (this._lastAvailKey && this._lastAvailKey === key) {
        console.log('loadAvailability skipped (cached):', key);
        return;
      }
      this._lastAvailKey = key;
    } catch (e) { /* ignore */ }
    try {
      const url = `/api/doctor/${doctorId}/availability` + (date ? `?date=${date}` : '');
      const res = await request({ url, method: 'GET' });
      if (res && res.success) {
        // map availability into selectable slots and available types
        // 简单示例：把第一个 availability 的 available_by_type 转成选择项
  let avail = res.data || [];
        // normalize date fields to YYYY-MM-DD so date-picker and maps align
        avail = avail.map(a => {
          try {
            if (a && a.date) {
              const raw = String(a.date || '');
              if (raw.length === 10 && /^\d{4}-\d{2}-\d{2}$/.test(raw)) {
                return a; // already YYYY-MM-DD
              }
              const d = new Date(raw);
              if (!isNaN(d.getTime())) {
                const norm = d.toISOString().slice(0,10);
                return Object.assign({}, a, { date: norm });
              }
            }
          } catch(e) {}
          return a;
        });
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
      date: this.data.selectedDate || wx.getStorageSync('selectedDate') || null,
      // slot should be a time-slot enum (e.g. '8-10'), choose selectedSlot (from date picker) first
      slot: this.data.selectedSlot || wx.getStorageSync('selectedSlot') || null,
      note: '',
      regi_type: this.data.selectedRegi
    };

    try {
      const res = await request({ url: '/api/registration/create', method: 'POST', data: payload });
      if (res && res.success) {
        // 挂号后直接跳转到支付页面（若后端返回了 payment 对象）
        if (res.payment && res.payment.id) {
          wx.navigateTo({ url: `/pages/payment/payment?payment_id=${res.payment.id}` });
          return;
        }
        wx.showToast({ title: '挂号成功', icon: 'success' });
        this.setData({ message: `挂号成功：${res.data.id} 状态:${res.data.status}` });
        // 跳转到订单页
        wx.navigateTo({ url: '/pages/orders/orders' });
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
