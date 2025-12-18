// pages/appointment/appointment.js
const { request } = require('../../utils/request');

Page({
  data: {
    ordersList: [],
    loading: true, // 初始为 true 以展示骨架屏
    message: ''
  },

  onShow() {
    this.loadAppointments();
  },

  // 处理单个订单的视图表现
  processOrderView(item) {
    let statusText, statusClass, badgeBg, badgeColor;
    let isActionable = false; // 是否需要立即操作（去挂号）

    // 逻辑判定
    if (item.status === 'expired') {
      statusText = '已过期';
      statusClass = 'expired';
      badgeBg = '#f5f7fa';
      badgeColor = '#909399';
    } else if (item.status === 'confirmed' || item.status === 'completed') { 
      // 修改这里：confirmed 状态也显示为已成功
      statusText = '已成功';
      statusClass = 'completed';
      badgeBg = '#e1f3d8';
      badgeColor = '#67c23a';
    } else if (item.available === true) {
      statusText = '号源释放';
      statusClass = 'available';
      badgeBg = '#e1f3d8';
      badgeColor = '#67c23a';
      isActionable = true;
    } else {
      statusText = '候补等待中';
      statusClass = 'waiting';
      badgeBg = '#fdf6ec';
      badgeColor = '#e6a23c';
    }

    return {
      ...item,
      view: {
        statusText,
        statusClass,
        badgeBg,
        badgeColor,
        isActionable,
        doctorName: item.doctor && item.doctor.name ? item.doctor.name : `医生#${item.doctor_id}`,
        deptName: item.doctor && item.doctor.department_name ? item.doctor.department_name : ''
      }
    };
  },

  // 核心逻辑：标记同天同医生/同科室的候补订单为已完成（已成功）
  markSameDayOrdersAsCompleted(orders, doctorCache, deptMap) {
    const processedOrders = [...orders];
    
    // 1. 先建立一个科室映射：医生ID -> 科室ID
    const doctorDeptMap = {};
    for (const [doctorId, doctorInfo] of Object.entries(doctorCache)) {
      if (doctorInfo && doctorInfo.department_id) {
        doctorDeptMap[doctorId] = doctorInfo.department_id;
      }
    }

    // 2. 收集已完成订单的关键信息
    const completedMap = {};
    for (const order of processedOrders) {
      // 修改这里：包括 confirmed 和 completed 状态
      if (order.status !== 'completed' && order.status !== 'confirmed') continue;

      const orderDate = String(order.date || '').slice(0,10);
      if (!orderDate) continue;
      
      if (!completedMap[orderDate]) {
        completedMap[orderDate] = { doctorIds: new Set(), deptIds: new Set() };
      }

      // 收集已完成订单的医生ID
      if (order.doctor_id) {
        completedMap[orderDate].doctorIds.add(order.doctor_id);
      }

      // 收集已完成订单的科室ID
      let deptId = null;
      // 优先级1：订单本身的科室ID
      if (order.department_id) {
        deptId = order.department_id;
      }
      // 优先级2：医生的科室ID
      else if (order.doctor_id && doctorDeptMap[order.doctor_id]) {
        deptId = doctorDeptMap[order.doctor_id];
      }
      // 优先级3：从doctor对象获取
      else if (order.doctor && order.doctor.department_id) {
        deptId = order.doctor.department_id;
      }
      
      if (deptId) {
        completedMap[orderDate].deptIds.add(deptId);
      }
    }

    // 3. 遍历所有候补订单，标记同天同医生/同科室为已完成
    for (const order of processedOrders) {
      // 跳过已完成/已过期/已确认订单
      if (order.status === 'completed' || order.status === 'expired' || order.status === 'confirmed') continue;

      const orderDate = String(order.date || '').slice(0,10);
      if (!orderDate || !completedMap[orderDate]) continue;

      // 获取当前订单的医生ID
      const currentDoctorId = order.doctor_id;
      
      // 获取当前订单的科室ID
      let currentDeptId = null;
      // 优先级1：订单本身的科室ID
      if (order.department_id) {
        currentDeptId = order.department_id;
      }
      // 优先级2：医生的科室ID（从缓存）
      else if (currentDoctorId && doctorDeptMap[currentDoctorId]) {
        currentDeptId = doctorDeptMap[currentDoctorId];
      }
      // 优先级3：从doctor对象获取
      else if (order.doctor && order.doctor.department_id) {
        currentDeptId = order.doctor.department_id;
      }

      // 核心规则：同天 且（同医生 OR 同科室）→ 标记为已完成
      const isSameDoctor = completedMap[orderDate].doctorIds.has(currentDoctorId);
      const isSameDept = currentDeptId && completedMap[orderDate].deptIds.has(currentDeptId);
      
      if (isSameDoctor || isSameDept) {
        order.status = 'completed';
        order.autoCompleted = true;
        console.log(`自动标记订单${order.id}为已完成：同天(${orderDate})，医生匹配:${isSameDoctor}，科室匹配:${isSameDept}`);
      }
    }

    return processedOrders;
  },

  async loadAppointments() {
    const account_id = wx.getStorageSync('account_id');
    if (!account_id) {
      this.setData({ message: '请先登录', ordersList: [], loading: false });
      return;
    }
    
    this.setData({ message: '' });

    try {
      const res = await request({ url: `/api/registration/list/${account_id}`, method: 'GET' });
      if (!res || !res.success) {
        this.setData({ message: '无法加载预约', loading: false });
        return;
      }
      
      let orders = (res.data || []);
      
      // ============ 核心修改：过滤掉候补订单 ============
      orders = orders.filter(order => {
        // 排除候补订单
        const isWaitlist = order.is_waitlist === 1 || order.status === 'waiting';
        // 只保留已确认、已完成、已取消的预约
        const isValidStatus = ['confirmed', 'completed', 'cancelled'].includes(order.status);
        return !isWaitlist && isValidStatus;
      });
      
      // ============ 如果没有数据，直接返回 ============
      if (orders.length === 0) {
        this.setData({ 
          ordersList: [], 
          loading: false,
          message: '暂无预约记录'
        });
        return;
      }
      
      const today = new Date();
      const todayStr = today.toISOString().slice(0,10);
      const pairs = {};
      const doctorIds = new Set();
      
      // 收集所有医生ID（包括已完成订单）
      for (const o of orders) {
        if (o.doctor_id) doctorIds.add(o.doctor_id);
      }

      // 获取医生和科室信息
      const doctorCache = {};
      let deptMap = {};

      // 1. 加载所有医生信息
      await Promise.all(Array.from(doctorIds).map(async id => {
        try {
          const r = await request({ url: `/api/doctor/${id}`, method: 'GET' });
          if (r && r.success) doctorCache[id] = r.data;
        } catch (e) {}
      }));

      // 2. 加载科室信息
      try {
        const depRes = await request({ url: '/api/departments', method: 'GET' });
        if (depRes && depRes.success) {
          const flatten = [];
          (depRes.data || []).forEach(p => {
            flatten.push({ id: p.id, name: p.name });
            if (p.children && p.children.length) {
              p.children.forEach(c => flatten.push({ id: c.id, name: c.name }));
            }
          });
          deptMap = flatten.reduce((m, d) => { m[d.id] = d.name; return m; }, {});
        }
      } catch (e) {}

      // 核心步骤：标记同天同医生/同科室的候补订单为已完成
      orders = this.markSameDayOrdersAsCompleted(orders, doctorCache, deptMap);

      // 整理活跃订单（未完成/未过期）用于号源检查
      // 修改这里：confirmed 状态不再被视为活跃订单，因为已成功
      const activeOrders = orders.filter(o => o.status !== 'completed' && o.status !== 'expired' && o.status !== 'confirmed');
      
      // 构建医生+日期配对（仅活跃订单）
      for (const o of activeOrders) {
        const orderDate = String(o.date || '').slice(0,10);
        if (!orderDate) continue;
        const key = `${o.doctor_id}::${orderDate}`;
        pairs[key] = pairs[key] || { doctor_id: o.doctor_id, date: orderDate, orders: [] };
        pairs[key].orders.push(o);
      }

      // 获取号源可用性（仅对活跃订单）
      const availCache = {};
      await Promise.all(Object.keys(pairs).map(async k => {
        const p = pairs[k];
        try {
          const r = await request({ url: `/api/doctor/${p.doctor_id}/availability?date=${p.date}`, method: 'GET' });
          availCache[k] = (r && r.success) ? r.data || [] : [];
        } catch (e) { availCache[k] = []; }
      }));

      const list = [];
      const slotOrder = { '8-10': 1, '10-12': 2, '14-16': 3, '16-18': 4 };

      // 处理活跃订单（检查号源）
      for (const key of Object.keys(pairs)) {
        const p = pairs[key];
        const availRows = availCache[key] || [];
        for (const o of p.orders) {
          const slotRow = availRows.find(r => r.slot === o.slot) || availRows[0] || null;
          const available = slotRow ? (parseInt(slotRow.capacity||0,10) - parseInt(slotRow.booked||0,10) > 0) : false;
          
          const orderDate = String(o.date || '').slice(0,10);
          let status = o.status;
          
          // 仅处理未被自动完成的订单
          if (status !== 'completed' && status !== 'confirmed') {
            if (orderDate < todayStr) {
              status = 'expired';
            } else {
              // 注意：这里不会再有 confirmed 状态，因为已经过滤了
              if ((o.status === 'waiting' || o.is_waitlist) && available) {
                status = 'available';
              } else {
                status = 'reserved';
              }
            }
          }
          
          // 补充医生和科室信息
          const doc = doctorCache[o.doctor_id] || { id: o.doctor_id, name: `医生#${o.doctor_id}` };
          if (doc && doc.department_id && deptMap && deptMap[doc.department_id]) {
            doc.department_name = deptMap[doc.department_id];
          }

          const rawItem = Object.assign({}, o, {
            doctor: doc,
            available,
            status,
            sort_key: this.getSortKey(status, orderDate, o.slot, slotOrder)
          });

          list.push(this.processOrderView(rawItem));
        }
      }

      // 处理已完成/已过期/已确认订单
      const completedOrExpiredOrConfirmedOrders = orders.filter(o => 
        o.status === 'completed' || o.status === 'expired' || o.status === 'confirmed'
      );
      for (const o of completedOrExpiredOrConfirmedOrders) {
        const orderDate = String(o.date || '').slice(0,10);
        const doc = doctorCache[o.doctor_id] || { id: o.doctor_id, name: `医生#${o.doctor_id}` };
        
        if (doc && doc.department_id && deptMap && deptMap[doc.department_id]) {
          doc.department_name = deptMap[doc.department_id];
        }

        const rawItem = Object.assign({}, o, {
          doctor: doc,
          available: false,
          status: o.status,
          sort_key: this.getSortKey(o.status, orderDate, o.slot, slotOrder)
        });

        list.push(this.processOrderView(rawItem));
      }

      // 排序
      list.sort((a,b) => a.sort_key < b.sort_key ? -1 : (a.sort_key > b.sort_key ? 1 : 0));

      setTimeout(() => {
        this.setData({ ordersList: list, loading: false });
      }, 500);

    } catch (err) {
      console.error('loadAppointments err', err);
      this.setData({ message: '网络或服务错误', loading: false });
    }
  },

  // 辅助方法：生成排序键
  getSortKey(status, orderDate, slot, slotOrder) {
    let statusPriority = '3'; // 已过期
    if (status === 'available') statusPriority = '0'; // 号源释放
    else if (status === 'reserved' || status === 'waiting') statusPriority = '1'; // 候补中
    else if (status === 'completed' || status === 'confirmed') statusPriority = '2'; // 已成功
    
    return `${statusPriority}::${orderDate}::${slotOrder[slot] || 99}`;
  },

  // 挂号按钮点击事件
  onGoRegister(e) {
    const orderId = e.currentTarget.dataset.orderid;
    const order = (this.data.ordersList || []).find(x => String(x.id) === String(orderId));
    if (!order) return;
    
    // 仅拦截非可操作状态的订单（已完成/已过期/无号源）
    if (!order.view.isActionable) {
      // 修改这里：confirmed 状态也提示已成功
      if (order.status === 'completed' || order.status === 'confirmed') {
        wx.showToast({ 
          title: '该订单已成功挂号', 
          icon: 'none' 
        });
      } else {
        wx.showToast({ 
          title: '当前无可用号源', 
          icon: 'none' 
        });
      }
      return;
    }
    
    wx.vibrateShort({ type: 'medium' });
    wx.setStorageSync('selectedDoctor', { id: order.doctor_id, name: order.view.doctorName });
    wx.setStorageSync('selectedDate', String(order.date).slice(0,10));
    wx.setStorageSync('selectedSlot', order.slot);
    wx.navigateTo({ url: '/pages/register/register' });
  },

  // 取消订单事件
  onCancel(e) {
    const orderId = e.currentTarget.dataset.orderid;
    if (!orderId) return;

    const order = (this.data.ordersList || []).find(x => String(x.id) === String(orderId));
    if (!order) return;

    // 仅拦截已完成/已确认订单
    if (order.status === 'completed' || order.status === 'confirmed') {
      wx.showToast({ 
        title: '已成功的订单无法取消', 
        icon: 'none' 
      });
      return;
    }

    wx.showModal({
      title: '取消预约',
      content: '确定要取消这个预约吗？',
      confirmColor: '#ff4d4f',
      success: async (res) => {
        if (res.confirm) {
          this.doCancel(orderId);
        }
      }
    });
  },

  async doCancel(orderId) {
    const originalList = this.data.ordersList;
    const list = originalList.filter(x => String(x.id) !== String(orderId));
    this.setData({ ordersList: list });

    try {
      const res = await request({ url: '/api/registration/cancel', method: 'POST', data: { order_id: orderId } });
      if (res && res.success) {
        wx.showToast({ title: '已取消', icon: 'success' });
        setTimeout(() => this.loadAppointments(), 800);
      } else {
        this.setData({ ordersList: originalList });
        wx.showToast({ title: (res && res.message) ? res.message : '取消失败', icon: 'none' });
      }
    } catch (err) {
      console.error('cancel err', err);
      this.setData({ ordersList: originalList });
      wx.showToast({ title: '网络错误', icon: 'none' });
    }
  },

  // 辅助方法：获取单个医生信息
  async getDoctorInfo(doctorId) {
    try {
      const r = await request({ url: `/api/doctor/${doctorId}`, method: 'GET' });
      return r && r.success ? r.data : null;
    } catch (e) {
      return null;
    }
  }
})