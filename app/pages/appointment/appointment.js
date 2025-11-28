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

  // 处理单个订单的视图表现（颜色、状态文案等）
  processOrderView(item) {
    let statusText, statusClass, badgeBg, badgeColor;
    let isActionable = false; // 是否需要立即操作（去挂号）

    // 逻辑判定
    if (item.status === 'expired') {
      statusText = '已过期';
      statusClass = 'expired';
      badgeBg = '#f5f7fa';
      badgeColor = '#909399';
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
        // 格式化医生名字，如果太长可以截断等处理
        doctorName: item.doctor && item.doctor.name ? item.doctor.name : `医生#${item.doctor_id}`,
        deptName: item.doctor && item.doctor.department_name ? item.doctor.department_name : ''
      }
    };
  },

  async loadAppointments() {
    const account_id = wx.getStorageSync('account_id');
    if (!account_id) {
      this.setData({ message: '请先登录', ordersList: [], loading: false });
      return;
    }
    
    // 保持 loading 为 true 一小段时间，防止闪烁，或者如果正在下拉刷新
    this.setData({ message: '' });

    try {
      const res = await request({ url: `/api/registration/list/${account_id}`, method: 'GET' });
      if (!res || !res.success) {
        this.setData({ message: '无法加载预约', loading: false });
        return;
      }
      
      const orders = (res.data || []).filter(o => o.status === 'waiting');

      // 准备辅助数据
      const today = new Date();
      const todayStr = today.toISOString().slice(0,10);
      const pairs = {};
      const doctorIds = new Set();
      
      for (const o of orders) {
        const orderDate = String(o.date || '').slice(0,10);
        if (!orderDate) continue;
        const key = `${o.doctor_id}::${orderDate}`;
        pairs[key] = pairs[key] || { doctor_id: o.doctor_id, date: orderDate, orders: [] };
        pairs[key].orders.push(o);
        if (o.doctor_id) doctorIds.add(o.doctor_id);
      }

      // 获取医生和排班信息
      const availCache = {};
      const doctorCache = {};
      let deptMap = {};

      // 并行请求医生信息
      await Promise.all(Array.from(doctorIds).map(async id => {
        try {
          const r = await request({ url: `/api/doctor/${id}`, method: 'GET' });
          if (r && r.success) doctorCache[id] = r.data;
        } catch (e) {}
      }));

      // 获取科室信息
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

      // 获取可用性
      await Promise.all(Object.keys(pairs).map(async k => {
        const p = pairs[k];
        try {
          const r = await request({ url: `/api/doctor/${p.doctor_id}/availability?date=${p.date}`, method: 'GET' });
          availCache[k] = (r && r.success) ? r.data || [] : [];
        } catch (e) { availCache[k] = []; }
      }));

      const list = [];
      const slotOrder = { '8-10': 1, '10-12': 2, '14-16': 3, '16-18': 4 };

      for (const key of Object.keys(pairs)) {
        const p = pairs[key];
        const availRows = availCache[key] || [];
        for (const o of p.orders) {
          const slotRow = availRows.find(r => r.slot === o.slot) || availRows[0] || null;
          const available = slotRow ? (parseInt(slotRow.capacity||0,10) - parseInt(slotRow.booked||0,10) > 0) : false;
          
          const orderDate = String(o.date || '').slice(0,10);
          let status = 'reserved';
          if (orderDate < todayStr) {
            status = 'expired';
          } else {
            if ((o.status === 'waiting' || o.is_waitlist) && available) {
              status = 'available';
            } else {
              status = 'reserved'; // 此时 logical status 是 reserved (waiting)
            }
          }
          
          const doc = doctorCache[o.doctor_id] || { id: o.doctor_id, name: `医生#${o.doctor_id}` };
          if (doc && doc.department_id && deptMap && deptMap[doc.department_id]) {
            doc.department_name = deptMap[doc.department_id];
          }

          // 构造基础 Item
          const rawItem = Object.assign({}, o, {
            doctor: doc,
            available,
            status, // 这里的 status 是逻辑状态
            sort_key: `${available ? '0' : '1'}::${orderDate}::${slotOrder[o.slot] || 99}` // 有号源的排前面
          });

          // 处理为视图 Item
          list.push(this.processOrderView(rawItem));
        }
      }

      // 排序
      list.sort((a,b) => a.sort_key < b.sort_key ? -1 : (a.sort_key > b.sort_key ? 1 : 0));

      // 模拟一点点延迟让骨架屏动画展示完整（提升体验），实际项目中可视情况移除
      setTimeout(() => {
        this.setData({ ordersList: list, loading: false });
      }, 500);

    } catch (err) {
      console.error('loadAppointments err', err);
      this.setData({ message: '网络或服务错误', loading: false });
    }
  },

  onGoRegister(e) {
    const orderId = e.currentTarget.dataset.orderid;
    const order = (this.data.ordersList || []).find(x => String(x.id) === String(orderId));
    if (!order) return;
    
    // 增加触觉反馈
    wx.vibrateShort({ type: 'medium' });

    wx.setStorageSync('selectedDoctor', { id: order.doctor_id, name: order.doctor && order.doctor.name ? order.doctor.name : `医生#${order.doctor_id}` });
    wx.setStorageSync('selectedDate', String(order.date).slice(0,10));
    wx.setStorageSync('selectedSlot', order.slot);
    wx.navigateTo({ url: '/pages/register/register' });
  },

  onCancel(e) {
    const orderId = e.currentTarget.dataset.orderid;
    if (!orderId) return;

    // 交互优化：二次确认
    wx.showModal({
      title: '取消候补',
      content: '确定要放弃当前的候补位置吗？',
      confirmColor: '#ff4d4f',
      success: async (res) => {
        if (res.confirm) {
          this.doCancel(orderId);
        }
      }
    });
  },

  async doCancel(orderId) {
    // 乐观更新 UI
    const originalList = this.data.ordersList;
    const list = originalList.filter(x => String(x.id) !== String(orderId));
    this.setData({ ordersList: list });

    try {
      const res = await request({ url: '/api/registration/cancel', method: 'POST', data: { order_id: orderId } });
      if (res && res.success) {
        wx.showToast({ title: '已取消', icon: 'success' });
      } else {
        // 失败回滚
        this.setData({ ordersList: originalList });
        wx.showToast({ title: (res && res.message) ? res.message : '取消失败', icon: 'none' });
      }
    } catch (err) {
      console.error('cancel err', err);
      this.setData({ ordersList: originalList });
      wx.showToast({ title: '网络错误', icon: 'none' });
    }
  }
})