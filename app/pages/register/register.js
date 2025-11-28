// pages/register/register.js
const { request } = require('../../utils/request');

Page({
  data: {
    registerRange: ['普通号','专家号','特需号'],
    doctors: [],
    selectedDept: '请选择科室', // 存储科室对象或名称
    selectedDoctor: '请选择医生', // 存储医生对象或名称
    selectedRegi:'请选择号别', // 存储号别名称
    // normalized key used to filter availability (e.g. '普通','专家','特需')
    selectedRegiKey: '',
    message: '',
    availability: [],
    availableTypes: {},
    availableTypesList: [],
    // 1:科室, 2:医生, 3:号别, 4:时间
    currentStep: 1 
  },

  onShow() {
    const selectedDept = wx.getStorageSync('selectedDepartment');
    
    // === 步骤 1: 科室选择后的处理 ===
    if (selectedDept) {
      // 确保科室对象存储正确，并更新步骤状态
      if (typeof selectedDept === 'object' && selectedDept.id) {
        this.setData({
          selectedDept: selectedDept,
          // 激活下一步：选择医生
          currentStep: 2 
        });
        wx.removeStorageSync('selectedDepartment');
        // 选中科室后立即加载医生列表
        this.loadDoctorsForDept(selectedDept.id);
      } else {
         // 处理不完整科室名称缓存
         wx.removeStorageSync('selectedDepartment');
      }
    }
    
    // === 步骤 2: 医生选择后的处理 ===
    const selDoc = wx.getStorageSync('selectedDoctor');
    if (selDoc) {
      if (typeof selDoc === 'object' && selDoc.id) {
        this.setData({ 
          selectedDoctor: selDoc,
          // 激活下一步：选择号别
          currentStep: 3 
        }); 
        wx.removeStorageSync('selectedDoctor');
        // 加载医生号源
        this.loadAvailability(selDoc.id);
      } else {
        // 如果医生信息不完整，清除缓存并重置状态
        wx.removeStorageSync('selectedDoctor');
        // 如果科室已选，仍停留在步骤 2
        if (this.data.selectedDept.id) this.setData({ currentStep: 2 });
      }
    } else if (this.data.selectedDept.id && this.data.doctors.length > 0) {
      // 医生未选，但科室已选且医生列表已加载，停留在步骤 2
      this.setData({ currentStep: 2 });
    }
  },
  
  goToDepartment() {
    wx.navigateTo({
      url: '/pages/deptPick/deptPick'
    });
  },

  // === 步骤 3: 号别选择 ===
  onRegiChange: function(e) {
    const index = e.detail.value;
    const regi = this.data.registerRange[index];
    const key = (regi || '').replace(/号$/, '').trim();
    wx.vibrateShort({ type: 'light' });
    this.setData({ 
        selectedRegi: regi, 
        selectedRegiKey: key,
        // 激活下一步：选择时间
        currentStep: 4 
    });
  },

  // 处理来自 date-picker 组件的时间选择事件
  onTimeSelected(e) {
    const { date, time } = e.detail || {};
    if (date && time) { 
      wx.showToast({ title: `已选择：${date} ${time}`, icon: 'none' });
      // 映射时间段
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
    }
  },
  
  // 医生选择组件的事件 (如果使用单独的医生选择组件)
  onDoctorSelected(e) {
    const { doctor } = e.detail;
    this.setData({ 
        selectedDoctor: doctor,
        currentStep: 3 // 激活下一步：选择号别
    });
    if (doctor && doctor.id) this.loadAvailability(doctor.id);
  },

  // === 步骤 2: 医生选择（Picker）===
  onDoctorChange: function(e) {
    const index = e.detail.value;
    const doctor = this.data.doctors[index];
    wx.vibrateShort({ type: 'light' });
    this.setData({
      selectedDoctor: doctor,
      // 激活下一步：选择号别
      currentStep: 3 
    });
    if (doctor && doctor.id) this.loadAvailability(doctor.id);
  },
    
  async loadDoctorsForDept(deptId) {
    wx.showLoading({ title: '加载医生中', mask: true });
    try {
      const res = await request({ url: `/api/doctor?department_id=${deptId}`, method: 'GET' });
      wx.hideLoading();
      if (res && res.success) {
        this.setData({ doctors: res.data });
        
        if (res.data && res.data.length > 0) {
           // 如果医生列表不为空，确保当前步骤是 2
           if (this.data.currentStep < 2) this.setData({ currentStep: 2 });
           // 确保 selectedDoctor 是对象，或者重置为 '请选择医生'
           if (!this.data.selectedDoctor.id) {
               this.setData({ selectedDoctor: '请选择医生' });
           }
        } else {
           wx.showToast({ title: '该科室暂无排班医生', icon: 'none' });
           this.setData({ selectedDoctor: '该科室无医生', currentStep: 2 });
        }
      }
    } catch (err) {
      wx.hideLoading();
      console.error('loadDoctorsForDept error', err);
      wx.showToast({ title: '加载医生失败', icon: 'none' });
    }
  },

  async loadAvailability(doctorId, date) {
    // 避免冗余加载
    try {
      const key = `${doctorId || ''}::${date || ''}`;
      if (this._lastAvailKey && this._lastAvailKey === key) {
        console.log('loadAvailability skipped (cached):', key);
        return;
      }
      this._lastAvailKey = key;
    } catch (e) { /* ignore */ }
    
    wx.showLoading({ title: '加载号源中', mask: true });
    try {
      const url = `/api/doctor/${doctorId}/availability` + (date ? `?date=${date}` : '');
      const res = await request({ url, method: 'GET' });
      wx.hideLoading();

      if (res && res.success) {
        let avail = res.data || [];
        
        // 日期格式化逻辑 (保持原逻辑不变)
        avail = avail.map(a => {
          try {
            if (a && a.date) {
              const raw = String(a.date || '');
              if (raw.length === 10 && /^\d{4}-\d{2}-\d{2}$/.test(raw)) {
                return a; 
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
            // 汇总所有日期的 available_by_type 信息
            const availableTypesMap = {};
            avail.forEach(day => {
                const types = day.available_by_type || {};
                Object.keys(types).forEach(type => {
                    // 确保是数字后进行累加
                    const count = parseInt(types[type] || 0, 10);
                    availableTypesMap[type] = (availableTypesMap[type] || 0) + count;
                });
            });
            // 转换为列表
            const availableTypesList = Object.keys(availableTypesMap).map(k => ({ type: k, count: availableTypesMap[k] }));
            
            this.setData({ 
                availability: avail, 
                availableTypes: availableTypesMap, 
                availableTypesList: availableTypesList
            });
        } else {
          this.setData({ availability: [], availableTypes: {}, availableTypesList: [] });
        }
      }
    } catch (err) {
      wx.hideLoading();
      console.error('loadAvailability error', err);
    }
  },

  register: async function() {
    wx.vibrateShort({ type: 'medium' });
    
    // 统一校验
    let errorMsg = '';
    let step = 0;
    const docId = this.data.selectedDoctor && this.data.selectedDoctor.id;
    const date = this.data.selectedDate || wx.getStorageSync('selectedDate');
    const slot = this.data.selectedSlot || wx.getStorageSync('selectedSlot');

    if (!this.data.selectedDept.id) { errorMsg = '请先选择科室'; step = 1; }
    else if (!docId) { errorMsg = '请先选择医生'; step = 2; }
    else if (this.data.selectedRegi === '请选择号别') { errorMsg = '请选择号别'; step = 3; }
    else if (!date || !slot) { errorMsg = '请选择就诊日期和时间'; step = 4; }

    if (errorMsg) {
      wx.showToast({ title: errorMsg, icon: 'none' });
      this.setData({ message: errorMsg, currentStep: step });
      return;
    }

    const account_id = wx.getStorageSync('account_id') || 1;
    
    wx.showLoading({ title: '挂号处理中', mask: true });

    const payload = {
      account_id,
      department_id: this.data.selectedDept.id,
      doctor_id: docId,
      date: date,
      slot: slot,
      regi_type: this.data.selectedRegi
    };

    try {
      const res = await request({ url: '/api/registration/create', method: 'POST', data: payload });
      wx.hideLoading();

      if (res && res.success) {
        if (res.payment && res.payment.id) {
          wx.showToast({ title: '挂号成功，请支付', icon: 'success' });
          wx.navigateTo({ url: `/pages/payment/payment?payment_id=${res.payment.id}` });
          return;
        }
        wx.showToast({ title: '挂号成功', icon: 'success' });
        this.setData({ message: `挂号成功：${res.data.id}` });
        wx.redirectTo({ url: '/pages/orders/orders' });
      } else {
        const msg = (res && res.message) ? res.message : '挂号失败';
        wx.showToast({ title: msg, icon: 'none' });
        this.setData({ message: msg });
      }
    } catch (err) {
      wx.hideLoading();
      console.error('register error', err);
      const msg = (err && err.body && err.body.message) ? err.body.message : '网络或服务错误';
      wx.showToast({ title: msg, icon: 'none' });
      this.setData({ message: msg });
    }
  }
});