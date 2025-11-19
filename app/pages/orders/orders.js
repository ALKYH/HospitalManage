// pages/orders/orders.js
Page({
  data: {
    orders: [],
    message: ''
  },

  onLoad: function(options) {},

  onShow: function() {
    this.loadOrders();
  },

  loadOrders: function() {
    const account_id = wx.getStorageSync('account_id') || 1;
    const { request } = require('../../utils/request');
    request({ url: `/api/registration/list/${account_id}`, method: 'GET' })
      .then(res => {
        if (res && res.success) {
          this.setData({ orders: res.data, message: '' });
        } else {
          this.setData({ message: '无法加载订单' });
        }
      })
      .catch(err => { console.error('loadOrders err', err); this.setData({ message: '网络或服务错误' }); });
  }
,

  onPay: function(e) {
    const paymentId = e.currentTarget.dataset.id;
    if (!paymentId) return;
    wx.navigateTo({ url: `/pages/payment/payment?payment_id=${paymentId}` });
  },

  onCancel: function(e) {
    const orderId = e.currentTarget.dataset.id;
    if (!orderId) return;
    const { request } = require('../../utils/request');
    request({ url: '/api/registration/cancel', method: 'POST', data: { order_id: orderId } })
      .then(res => {
        if (res && res.success) {
          wx.showToast({ title: '已取消', icon: 'success' });
          this.loadOrders();
        } else {
          wx.showToast({ title: '取消失败', icon: 'none' });
        }
      })
      .catch(err => { console.error('cancel err', err); wx.showToast({ title: '网络或服务错误', icon: 'none' }); });
  }
});