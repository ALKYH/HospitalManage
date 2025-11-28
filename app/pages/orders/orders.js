// pages/orders/orders.js
Page({
  data: {
    // 选项卡数据，key为筛选条件，name为显示名称
    tabs: [
      { key: 'all', name: '全部', count: 0 },
      { key: 'paid', name: '已支付', count: 0 },
      { key: 'unpaid', name: '待支付', count: 0 },
      { key: 'waitlist', name: '候补中', count: 0 },
      { key: 'cancelled', name: '已取消', count: 0 },
    ],
    activeTab: 'all', // 默认选中'全部'
    orders: [], // 原始加载的全部订单
    filteredOrders: [], // 经过筛选和映射后的订单列表（用于WXML渲染）
    message: ''
  },

  onLoad: function(options) {},

  onShow: function() {
    this.loadOrders();
  },

  // 映射订单状态和样式
  mapOrderStatus: function(order) {
    let statusText, statusColor, statusBg;
    
    // 基础状态映射
    if (order.status === 'cancelled') {
      statusText = '已取消';
      statusColor = '#909399';
      statusBg = '#f0f2f5';
    } else if (order.is_waitlist) {
      statusText = `候补中 (位置 ${order.wait_position + 1})`;
      statusColor = '#ff9900';
      statusBg = '#fff6e5';
    } else if (order.status === 'completed') {
      statusText = '已完成/已就诊';
      statusColor = '#409eff';
      statusBg = '#ecf5ff';
    } else if (order.payment_id && order.payment_status !== 'paid') {
      statusText = '待支付';
      statusColor = '#f56c6c';
      statusBg = '#fef0f0';
    } else if (order.status === 'confirmed' || (order.payment_id && order.payment_status === 'paid')) {
      statusText = '已支付/已预约';
      statusColor = '#67c23a';
      statusBg = '#f0f9eb';
    } else {
      statusText = '状态未知';
      statusColor = '#909399';
      statusBg = '#f0f2f5';
    }

    return {
      ...order,
      displayStatus: statusText,
      statusColor: statusColor,
      statusBg: statusBg,
      isUnpaid: order.payment_id && order.payment_status !== 'paid',
      isPaid: order.payment_id && order.payment_status === 'paid',
      isCancelled: order.status === 'cancelled',
      isWaitlist: order.is_waitlist,
      // 确定主要操作按钮是否显示
      showPrimaryAction: !order.is_waitlist && !order.isCancelled && !order.isCompleted,
    };
  },

  // 根据当前 activeTab 过滤订单
  filterOrders: function() {
    const { orders, activeTab, tabs } = this.data;
    let filtered = [];
    let tabCounts = { all: 0, paid: 0, unpaid: 0, waitlist: 0, cancelled: 0 };

    if (!orders || orders.length === 0) {
      this.setData({ filteredOrders: [], tabs: tabs.map(t => ({ ...t, count: 0 })) });
      return;
    }

    // 筛选和计数
    filtered = orders.map(this.mapOrderStatus).filter(order => {
      // 计数逻辑
      tabCounts.all++;
      if (order.isPaid) tabCounts.paid++;
      if (order.isUnpaid) tabCounts.unpaid++;
      if (order.isWaitlist) tabCounts.waitlist++;
      if (order.isCancelled) tabCounts.cancelled++;

      // 筛选逻辑
      switch (activeTab) {
        case 'paid':
          return order.isPaid;
        case 'unpaid':
          return order.isUnpaid;
        case 'waitlist':
          return order.isWaitlist;
        case 'cancelled':
          return order.isCancelled;
        case 'all':
        default:
          return true;
      }
    });

    // 更新 tabs 上的计数
    const updatedTabs = tabs.map(tab => ({
      ...tab,
      count: tabCounts[tab.key] || 0
    }));

    this.setData({
      filteredOrders: filtered,
      tabs: updatedTabs
    });
  },

  // 切换选项卡
  changeTab: function(e) {
    const key = e.currentTarget.dataset.key;
    if (key && this.data.activeTab !== key) {
      this.setData({ activeTab: key }, () => {
        this.filterOrders(); // 切换 Tab 后重新筛选
      });
    }
  },

  loadOrders: function() {
    const account_id = wx.getStorageSync('account_id') || 1;
    const { request } = require('../../utils/request');
    
    wx.showLoading({ title: '加载中' });
    request({ url: `/api/registration/orders/${account_id}`, method: 'GET' })
      .then(res => {
        wx.hideLoading();
        if (res && res.success) {
          // 将原始数据存入 orders，然后调用 filterOrders 进行处理和渲染
          this.setData({ orders: res.data || [], message: '' }, () => {
            this.filterOrders();
          });
        } else {
          this.setData({ orders: [], filteredOrders: [], message: '无法加载订单' });
        }
      })
      .catch(err => { 
        wx.hideLoading();
        console.error('loadOrders err', err); 
        this.setData({ orders: [], filteredOrders: [], message: '网络或服务错误' }); 
      });
  },

  onPay: function(e) {
    const paymentId = e.currentTarget.dataset.id;
    if (!paymentId) return;
    // 实际业务中，可能需要先校验支付状态再跳转
    wx.navigateTo({ url: `/pages/payment/payment?payment_id=${paymentId}` });
  },

  onCancel: function(e) {
    const orderId = e.currentTarget.dataset.id;
    if (!orderId) return;
    
    wx.showModal({
      title: '确认操作',
      content: '确定要取消此预约/候补吗？操作不可恢复。',
      confirmColor: '#f56c6c',
      success: (res) => {
        if (res.confirm) {
          wx.showLoading({ title: '操作中' });
          const { request } = require('../../utils/request');
          request({ url: '/api/registration/cancel', method: 'POST', data: { order_id: orderId } })
            .then(res => {
              wx.hideLoading();
              if (res && res.success) {
                wx.showToast({ title: '已取消', icon: 'success' });
                this.loadOrders(); // 刷新数据
              } else {
                wx.showToast({ title: res.message || '取消失败', icon: 'none' });
              }
            })
            .catch(err => { 
              wx.hideLoading();
              console.error('cancel err', err); 
              wx.showToast({ title: '网络或服务错误', icon: 'none' }); 
            });
        }
      }
    });
  }
});