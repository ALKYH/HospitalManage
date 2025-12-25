// pages/docRegister/docRegister.js
Page({

  /**
   * 页面的初始数据
   */
  data: {

  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad(options) {
    const today = new Date().toISOString().slice(0, 10);
    this.setData({ date: today });
  },

  /**
   * 生命周期函数--监听页面初次渲染完成
   */
  onReady() {

  },

  /**
   * 生命周期函数--监听页面显示
   */
  onShow() {
    this.loadRegistrations();
  },

  onDateChange(e) {
    this.setData({ date: e.detail.value });
  },

  async loadRegistrations() {
    const date = this.data.date || new Date().toISOString().slice(0, 10);
    this.setData({ loading: true });
    const { request } = require('../../utils/request');
    try {
      // prefer fetching by cached doctor_id when available
      const cachedDoctorId = wx.getStorageSync('doctor_id');
      let url = '/api/doctor/me/registrations?date=' + date;
      if (cachedDoctorId) url = `/api/doctor/${cachedDoctorId}/registrations?date=${date}`;
      const res = await request({ url, method: 'GET' });
      if (res && res.success) {
        // normalize dates and display fields
        const regs = (res.data || []).map(r => ({
          id: r.id,
          status: r.status,
          date: r.date,
          slot: r.slot,
          account_username: r.account_username,
          patient_name: r.patient_name,
          patient_phone: r.patient_phone,
          note: r.note,
          department_id: r.department_id,
          doctor_id: r.doctor_id,
          created_at: r.created_at
        }));
        this.setData({ registrations: regs, message: '' });
      }
      else this.setData({ message: res && res.message || '获取失败' });
    } catch (err) {
      console.error('load regs err', err);
      this.setData({ message: err && err.body && err.body.message || '网络或服务错误' });
    } finally { this.setData({ loading: false }); }
  },

  onPullDownRefresh() {
    // called when user pulls down; refresh list
    this.loadRegistrations().then(() => wx.stopPullDownRefresh());
  },

  onOpenOrder(e) {
    const id = e.currentTarget.dataset.id;
    const order = (this.data.registrations || []).find(r => r.id == id);
    if (order) {
      wx.showModal({ title: `订单 ${order.id}`, content: `患者: ${order.patient_name || order.account_username}\n电话: ${order.patient_phone || '—'}\n状态: ${order.status}\n备注: ${order.note || '无'}`, showCancel: false });
    }
  },

  goToCase(e) {
    // prevent parent tap
    e.stopPropagation && e.stopPropagation();
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: `/pages/Case/Case?order_id=${id}` });
  },

  /**
   * 生命周期函数--监听页面隐藏
   */
  onHide() {

  },

  /**
   * 生命周期函数--监听页面卸载
   */
  onUnload() {

  },

  /**
   * 页面相关事件处理函数--监听用户下拉动作
   */
  onPullDownRefresh() {

  },

  /**
   * 页面上拉触底事件的处理函数
   */
  onReachBottom() {

  },

  /**
   * 用户点击右上角分享
   */
  onShareAppMessage() {

  }
})