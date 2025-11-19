// pages/payment/payment.js
Page({
  data: {
    paymentId: null,
    payment: null
  },

  onLoad: function(options) {
    const pid = options.payment_id || null;
    this.setData({ paymentId: pid, payment: null });
    if (pid) this.loadPayment(pid);
  },

  onReady: function() {},
  onShow: function() {},
  onHide: function() {},

  loadPayment: function(id) {
    const { request } = require('../../utils/request');
    request({ url: `/api/payment/${id}`, method: 'GET' })
      .then(res => { if (res && res.success) this.setData({ payment: res.data }); })
      .catch(err => { console.error('loadPayment err', err); });
  },

  doSimulatePay: function() {
    const { request } = require('../../utils/request');
    const id = this.data.paymentId;
    if (!id) return;
    request({ url: `/api/payment/${id}/pay`, method: 'POST', data: { provider_info: { method: 'simulated', note: '用户模拟支付' } } })
      .then(res => {
        if (res && res.success) {
          wx.showToast({ title: '支付成功', icon: 'success' });
          wx.navigateTo({ url: '/pages/orders/orders' });
        } else {
          wx.showToast({ title: '支付失败', icon: 'none' });
        }
      })
      .catch(err => { console.error('doSimulatePay err', err); wx.showToast({ title: '网络或服务错误', icon: 'none' }); });
  },

  onUnload: function() {},
  onPullDownRefresh: function() {},
  onReachBottom: function() {},
  onShareAppMessage: function() {}

});